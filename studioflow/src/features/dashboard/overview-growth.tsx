"use client";
import { useState } from "react";
import {
  BellRinging,
  CheckCircle,
  ClockCountdown,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateLabel } from "@/lib/utils";
import type { Store, WaitlistEntry } from "@/types";
import {
  reminderMessage,
  tomorrowReminders,
  waitlistMessage,
  waitlistQueue,
  waitlistWhen,
} from "./growth";
import { hasModule } from "@/lib/modules";

function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
}

const sentKey = "studioflow:reminders-sent";
function readSent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(sentKey) || "[]");
    return Array.isArray(value) ? value.slice(-300) : [];
  } catch {
    return [];
  }
}

/** Tomorrow's customers with a ready-made WhatsApp reminder. */
export function RemindersCard({ data, now }: { data: Store; now: number }) {
  const items = tomorrowReminders(data, now);
  // Which reminders went out is remembered on this device only.
  const [sent, setSent] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readSent(),
  );
  if (!items.length) return null;
  function markSent(id: string) {
    const next = [...new Set([...sent, id])];
    setSent(next);
    try {
      localStorage.setItem(sentKey, JSON.stringify(next));
    } catch {
      // Storage unavailable: the mark lasts until the page reloads.
    }
  }
  const pending = items.filter((a) => !sent.includes(a.id)).length;
  return (
    <section className="ov-card ov-reminders" aria-labelledby="ov-rem-title">
      <div className="ov-card-head">
        <h2 id="ov-rem-title">
          <BellRinging size={18} weight="duotone" /> Lembretes de amanhã
        </h2>
        <span className="ov-rem-count">
          {pending ? `${pending} para enviar` : "Todos enviados"}
        </span>
      </div>
      <ul role="list" className="ov-growth-list">
        {items.map((a) => {
          const done = sent.includes(a.id);
          return (
            <li key={a.id} className={done ? "is-done" : ""}>
              <div className="ov-growth-info">
                <strong>{a.customerName}</strong>
                <span>
                  {dateLabel(a.start, "HH:mm")}
                  {a.reminder && <em>Pediu lembrete</em>}
                </span>
              </div>
              <a
                className="ov-att-action is-whatsapp sf-press"
                href={whatsappLink(a.customerPhone, reminderMessage(data, a))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markSent(a.id)}
              >
                {done ? (
                  <>
                    <CheckCircle size={16} weight="fill" /> Enviado
                  </>
                ) : (
                  <>
                    <WhatsAppIcon size={16} /> Lembrar
                  </>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Customers waiting for a free spot, with a ready-made invite. */
export function WaitlistCard({
  data,
  now,
  canEdit,
}: {
  data: Store;
  now: number;
  canEdit: boolean;
}) {
  const { refresh } = useWorkspace();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState("");
  const queue = waitlistQueue(data, now);
  if (!queue.length || !hasModule(data.access?.modules, "espera")) return null;
  async function change(entry: WaitlistEntry, action: "notify" | "remove") {
    setBusyId(entry.id);
    try {
      const response = await fetch("/api/workspace/waitlist", {
        method: action === "remove" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "remove"
            ? { id: entry.id }
            : { id: entry.id, status: "notified" },
        ),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      await refresh();
      if (action === "remove") toast("Pedido removido da lista de espera.");
    } catch (cause) {
      toast(
        cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível atualizar a lista de espera.",
      );
    } finally {
      setBusyId("");
    }
  }
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <section className="ov-card ov-waitlist" aria-labelledby="ov-wait-title">
      <div className="ov-card-head">
        <h2 id="ov-wait-title">
          <ClockCountdown size={18} weight="duotone" /> Lista de espera
        </h2>
        <span className="ov-rem-count">
          {queue.length} {queue.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>
      <ul role="list" className="ov-growth-list">
        {queue.map(({ entry, opening }) => {
          const service = data.services.find((s) => s.id === entry.serviceId);
          const link = `${origin}/${data.business.slug}/agendar?service=${entry.serviceId}`;
          return (
            <li
              key={entry.id}
              className={entry.status === "notified" ? "is-done" : ""}
            >
              <div className="ov-growth-info">
                <strong>{entry.customerName}</strong>
                <span>
                  {service?.name ?? "Serviço"} · {waitlistWhen(entry)}
                  {opening && entry.status === "waiting" && (
                    <em className="is-open">Abriu vaga</em>
                  )}
                  {entry.status === "notified" && <em>Avisado</em>}
                </span>
              </div>
              <div className="ov-growth-actions">
                <a
                  className="ov-att-action is-whatsapp sf-press"
                  href={whatsappLink(
                    entry.customerPhone,
                    waitlistMessage(data, entry, link),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (canEdit && entry.status === "waiting")
                      void change(entry, "notify");
                  }}
                >
                  <WhatsAppIcon size={16} /> Chamar
                </a>
                {canEdit && (
                  <button
                    type="button"
                    className="ov-growth-remove"
                    aria-label={`Remover ${entry.customerName} da lista`}
                    disabled={busyId === entry.id}
                    onClick={() => void change(entry, "remove")}
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
