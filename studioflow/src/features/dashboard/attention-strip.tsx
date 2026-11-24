"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ChatsCircle,
  CalendarX,
  Robot,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";
import { useConversations, useLatestRun } from "@/hooks/use-conversations";
import { inboxQueue } from "@/lib/inbox";
import { hasModule } from "@/lib/modules";
import { ownerAlerts, type OwnerAlert } from "@/lib/owner-alerts";
import type { Store } from "@/types";

const icons: Record<OwnerAlert["id"], typeof WifiSlash> = {
  whatsapp: WifiSlash,
  ai: Robot,
  conversations: ChatsCircle,
  unfinished: CalendarX,
};

const support = (process.env.NEXT_PUBLIC_STUDIOFLOW_WHATSAPP || "").replace(
  /\D/g,
  "",
);

/** "Precisa de você": o que está quebrado ou esperando o dono, com o botão que resolve. */
export function AttentionStrip({ data, now }: { data: Store; now: number }) {
  const management = ["owner", "admin", "manager"].includes(
    data.viewer?.role || "",
  );
  const assistant = hasModule(data.access?.modules, "recepcionista");
  const { list } = useConversations(management && assistant);
  const latestRun = useLatestRun(
    management && assistant && data.settings.assistantEnabled,
  );
  if (!management) return null;
  const alerts = ownerAlerts(data, {
    now,
    attention: list?.filter((item) => inboxQueue(item, now) === "attention")
      .length,
    latestRun,
    support,
  });
  if (!alerts.length) return null;
  return (
    <section className="ov-needs" aria-labelledby="ov-needs-title">
      <h2 id="ov-needs-title">Precisa de você</h2>
      <ul role="list">
        {alerts.map((alert) => {
          const Icon = icons[alert.id];
          return (
            <li key={alert.id} data-kind={alert.id}>
              <Icon size={20} weight="duotone" aria-hidden="true" />
              <span>
                <strong>{alert.title}</strong>
                <small>{alert.detail}</small>
              </span>
              {alert.action.external ? (
                <a href={alert.action.href} target="_blank" rel="noreferrer">
                  {alert.action.label} <ArrowUpRight size={14} />
                </a>
              ) : (
                <Link href={alert.action.href}>{alert.action.label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
