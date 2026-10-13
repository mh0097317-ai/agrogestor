"use client";

import { useEffect, useState } from "react";
import { Robot } from "@phosphor-icons/react/dist/ssr";
import "./ai-control.css";

export function PlatformAiControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/ai-control", { cache: "no-store", signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("Não foi possível consultar o estado da IA.");
        const data = await r.json();
        setEnabled(data.enabled === true);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, []);

  async function toggle() {
    if (enabled === null || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/ai-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!r.ok) throw Error("Não foi possível alterar a IA. Tente novamente.");
      const data = await r.json();
      setEnabled(data.enabled === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar a IA.");
    } finally {
      setBusy(false);
    }
  }

  const state = enabled === null ? "loading" : enabled ? "on" : "off";
  return (
    <section className={`pf-ai is-${state}`} aria-labelledby="pf-ai-title">
      <span className="pf-ai-icon" aria-hidden="true">
        <Robot size={24} weight="duotone" />
      </span>
      <div className="pf-ai-text">
        <div className="pf-ai-head">
          <h2 id="pf-ai-title">Atendimento com IA</h2>
          <span className="pf-ai-badge" role="status">
            <i aria-hidden="true" />
            {state === "loading" ? "Consultando…" : enabled ? "Ligada" : "Desligada"}
          </span>
        </div>
        <p>
          {enabled
            ? "A recepcionista responde nas barbearias que a ativaram. Cada casa segue as próprias configurações."
            : "Nenhuma barbearia usa a IA agora. Só você pode ligar, por aqui."}{" "}
          <span>Confirmações, lembretes e relatórios funcionam sempre.</span>
        </p>
        {error && (
          <p className="pf-ai-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled === true}
        aria-labelledby="pf-ai-title"
        className="pf-ai-switch"
        onClick={toggle}
        disabled={enabled === null || busy}
      >
        <span className="pf-ai-track">
          <span className="pf-ai-thumb" />
        </span>
        <span className="pf-ai-label">
          {busy ? "Salvando…" : enabled ? "Desligar" : "Ligar"}
        </span>
      </button>
    </section>
  );
}
