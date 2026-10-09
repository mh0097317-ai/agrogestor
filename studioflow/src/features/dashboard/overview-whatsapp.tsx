"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowClockwise, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { inboxQueue } from "@/lib/inbox";
import type { ConversationSummary, Store } from "@/types";

export function OverviewWhatsApp({ data }: { data: Store }) {
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace/conversations", {
        cache: "no-store",
        signal,
      });
      if (!response.ok)
        throw new Error("Não foi possível atualizar as conversas.");
      const result = (await response.json()) as ConversationSummary[];
      if (signal?.aborted) return;
      setList(result.filter((item) => item.channel === "whatsapp"));
      setError("");
      setUpdated(
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    } catch (e) {
      if (!signal?.aborted)
        setError(
          e instanceof Error ? e.message : "Não foi possível atualizar.",
        );
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external live inbox summary
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
  const count = (queue: string) =>
    list?.filter((item) => inboxQueue(item) === queue).length ?? "—";
  const connections =
    (data.whatsappLink?.status === "open" || data.whatsapp ? 1 : 0) +
    (data.professionalWhatsAppLinks || []).filter(
      (link) => link.status === "open",
    ).length;
  return (
    <section className="ov-whatsapp" aria-labelledby="ov-whatsapp-title">
      <div className="ov-whatsapp-head">
        <span>
          <WhatsAppIcon size={23} />
          <span>
            <h2 id="ov-whatsapp-title">Atendimento no WhatsApp</h2>
            <small>
              {connections}{" "}
              {connections === 1 ? "número conectado" : "números conectados"} ·{" "}
              {data.settings.assistantEnabled
                ? "StudioFlow ativado"
                : "StudioFlow desligado"}
            </small>
          </span>
        </span>
        <button
          type="button"
          aria-label="Atualizar resumo do WhatsApp"
          disabled={busy}
          onClick={() => void load()}
        >
          <ArrowClockwise size={18} />
        </button>
      </div>
      {error ? (
        <p className="ov-whatsapp-error" role="status">
          {error} {list && "Exibindo a última consulta."}
        </p>
      ) : null}
      <div className="ov-whatsapp-counts">
        <div>
          <strong>{count("attention")}</strong>
          <span>Precisam de atenção</span>
        </div>
        <div>
          <strong>{count("ai")}</strong>
          <span>Com StudioFlow</span>
        </div>
        <div>
          <strong>{count("human")}</strong>
          <span>Com a equipe</span>
        </div>
      </div>
      <footer>
        <small>
          {updated ? `Consultado às ${updated}` : "Consultando conversas…"} ·
          últimas 60 conversas
        </small>
        <Link href="/dashboard/conversas">
          Abrir conversas <ArrowUpRight size={16} />
        </Link>
      </footer>
    </section>
  );
}
