"use client";

import { Check, Copy, Timer } from "@phosphor-icons/react/dist/ssr";
import { useCallback, useEffect, useRef, useState } from "react";
import { money } from "@/lib/utils";
import { publicRequest } from "@/features/public/use-public-catalog";

interface DepositState {
  status: "pending" | "paid" | "expired" | "none";
  amount: number;
  expiresAt: string | null;
  pix?: { image: string; payload: string };
  simulated?: boolean;
}

const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Waiting for the Pix deposit: QR code, copy-paste code and the time the
 * slot stays held. Checks quietly every few seconds (asking the provider
 * itself now and then) and hands over when it is paid or expires.
 */
export function DepositPanel({
  token,
  amount,
  expiresAt,
  chargeId,
  onSettled,
}: {
  token: string;
  amount: number;
  expiresAt: string;
  chargeId?: string | null;
  onSettled: () => void;
}) {
  const [pix, setPix] = useState<DepositState["pix"]>();
  const [simulated, setSimulated] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);
  const settled = useRef(false);
  const deadline = Date.parse(expiresAt);
  const left = deadline - now;
  const url = `/api/booking/${encodeURIComponent(token)}/deposit`;

  const settle = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onSettled();
  }, [onSettled]);

  const check = useCallback(
    async (askProvider: boolean) => {
      try {
        const state = await publicRequest<DepositState>(
          `${url}${askProvider ? "?check=1" : ""}`,
        );
        if (state.status !== "pending") settle();
      } catch {
        // A failed check waits for the next one.
      }
    },
    [url, settle],
  );

  useEffect(() => {
    const controller = new AbortController();
    publicRequest<DepositState>(`${url}?pix=1`, {
      signal: controller.signal,
    }).then(
      (state) => {
        if (state.status !== "pending") return settle();
        setPix(state.pix);
        setSimulated(!!state.simulated);
      },
      (cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar o Pix.",
          );
      },
    );
    return () => controller.abort();
  }, [url, settle]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    // Every 4 s our database (webhook); every 5th time, the provider too.
    const poll = window.setInterval(() => {
      polls.current += 1;
      void check(polls.current % 5 === 0);
    }, 4000);
    const back = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", back);
    };
  }, [check]);

  useEffect(() => {
    if (left <= 0) void check(true);
  }, [left <= 0, check]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copy() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Não foi possível copiar. Selecione o código abaixo.");
    }
  }

  async function simulate() {
    if (!chargeId) return;
    setBusy(true);
    try {
      await publicRequest(`/api/demo/charges/${encodeURIComponent(chargeId)}`, {
        method: "POST",
      });
      await check(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bk-deposit" aria-labelledby="deposit-title">
      <header className="bk-done-head">
        <h1 id="deposit-title" tabIndex={-1}>
          Falta só o sinal
        </h1>
        <p>
          Pague {money(amount)} no Pix para confirmar. O valor é descontado no
          dia do atendimento.
        </p>
      </header>
      <div className="bk-pix">
        <div className="bk-pix-frame">
          {pix ? (
            <img
              src={`data:image/png;base64,${pix.image}`}
              alt="QR Code do Pix"
              width={220}
              height={220}
            />
          ) : (
            <span className="bk-pix-skeleton" aria-hidden="true" />
          )}
        </div>
        <p className={`bk-pix-timer ${left < 120_000 ? "is-ending" : ""}`}>
          <Timer weight="duotone" size={16} />
          {left > 0 ? (
            <>
              Horário guardado por <b>{clock(left)}</b>
            </>
          ) : (
            "Conferindo o pagamento…"
          )}
        </p>
        <button
          type="button"
          className="bk-primary"
          onClick={copy}
          disabled={!pix}
        >
          {copied ? (
            <>
              <Check weight="bold" size={17} /> Código copiado
            </>
          ) : (
            <>
              <Copy weight="duotone" size={17} /> Copiar Pix copia e cola
            </>
          )}
        </button>
        {pix && (
          <details className="bk-pix-code">
            <summary>Ver o código</summary>
            <code>{pix.payload}</code>
          </details>
        )}
        <ol className="bk-pix-steps">
          <li>Abra o app do seu banco e escolha Pix.</li>
          <li>Leia o QR Code ou cole o código.</li>
          <li>Esta tela confirma sozinha assim que o Pix cair.</li>
        </ol>
        {simulated && chargeId && (
          <button
            type="button"
            className="bk-secondary"
            onClick={simulate}
            disabled={busy}
          >
            Simular pagamento (demonstração)
          </button>
        )}
        {error && (
          <div className="bk-alert" role="alert">
            <p>{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}
