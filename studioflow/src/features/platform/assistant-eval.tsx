"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Flask, XCircle } from "@phosphor-icons/react/dist/ssr";
import "./assistant-eval.css";

interface Turn {
  customer: string;
  reply: string;
  list: string;
  seconds: number;
}
interface Result {
  name: string;
  ok: boolean;
  problems: string[];
  turns: Turn[];
}
interface Run {
  passed: number;
  total: number;
  results: Result[];
  created_at?: string;
  model?: string;
}

/**
 * Roda as conversas de teste da recepcionista com a IA de verdade e a chave
 * da própria loja, numa cópia da agenda: nada é marcado, nada é enviado.
 */
export function AssistantEval({
  shops,
}: {
  shops: { slug: string; name: string }[];
}) {
  const [slug, setSlug] = useState(
    () =>
      shops.find((s) => /coliseu/i.test(s.slug))?.slug || shops[0]?.slug || "",
  );
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!slug) return;
    const abort = new AbortController();
    fetch(`/api/admin/assistant-eval?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then((r) => (r.ok ? r.json() : { runs: [] }))
      .then((data) => setRun(data.runs?.[0] || null))
      .catch(() => undefined);
    return () => abort.abort();
  }, [slug]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/assistant-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(data.error || "Não foi possível rodar o teste.");
      setRun({ ...data, created_at: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no teste.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pf-eval" aria-labelledby="pf-eval-title">
      <div className="pf-eval-head">
        <span className="pf-eval-icon" aria-hidden="true">
          <Flask size={22} weight="duotone" />
        </span>
        <div>
          <h2 id="pf-eval-title">Testar a recepcionista</h2>
          <p>
            Conversas de teste com a IA de verdade e a chave da loja, numa cópia
            da agenda. Nada é marcado e nenhuma mensagem sai. Leva uns 2
            minutos.
          </p>
        </div>
        <div className="pf-eval-actions">
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={busy}
            aria-label="Loja"
          >
            {shops.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={start} disabled={busy || !slug}>
            {busy ? "Testando…" : "Rodar teste"}
          </button>
        </div>
      </div>
      {error && (
        <p className="pf-eval-error" role="alert">
          {error}
        </p>
      )}
      {run && (
        <div className="pf-eval-run">
          <strong className={run.passed === run.total ? "is-ok" : "is-bad"}>
            {run.passed} de {run.total} conversas certas
          </strong>
          {run.created_at && (
            <small>
              {new Date(run.created_at).toLocaleString("pt-BR")}
              {run.model ? ` · ${run.model}` : ""}
            </small>
          )}
          <ul>
            {run.results.map((r) => (
              <li key={r.name} className={r.ok ? "is-ok" : "is-bad"}>
                <details>
                  <summary>
                    {r.ok ? (
                      <CheckCircle size={16} weight="fill" />
                    ) : (
                      <XCircle size={16} weight="fill" />
                    )}
                    {r.name}
                    {!r.ok && <em>{r.problems.join(" · ")}</em>}
                  </summary>
                  <ol>
                    {r.turns.map((t, i) => (
                      <li key={i}>
                        <p className="is-customer">{t.customer}</p>
                        <p>
                          {t.reply || "(sem resposta)"}
                          <small> · {t.seconds}s</small>
                        </p>
                        {t.list && <p className="is-list">Lista: {t.list}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
