"use client";
import Link from "next/link";
import { ArrowClockwise, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { inboxQueue } from "@/lib/inbox";
import { useConversations } from "@/hooks/use-conversations";
import type { Store } from "@/types";

export function OverviewWhatsApp({ data }: { data: Store }) {
  const { list: all, error, busy, updatedAt, reload } = useConversations();
  const list = all?.filter((item) => item.channel === "whatsapp") ?? null;
  const updated = updatedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }).format(updatedAt)
    : "";
  const load = () => void reload();
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
          onClick={load}
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
          <span>Com a IA</span>
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
