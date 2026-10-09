import type { ConversationMessage, ConversationSummary, Store } from "@/types";

/** Operational events are activity records, never messages from the channel. */
export function channelMessages(messages: ConversationMessage[]) {
  return messages.filter((message) => message.role !== "event");
}

const processing = new Set([
  "RECEIVED",
  "UNDERSTANDING",
  "UNDERSTOOD",
  "DECIDING",
  "GENERATING",
  "VALIDATING",
  "SENDING",
  "RETRY",
]);

export function needsAttention(item: ConversationSummary, now = Date.now()) {
  if (item.status === "closed" || item.latestRole !== "customer") return false;
  if (item.runState === "FAILED") return true;
  return (
    item.latestRole === "customer" &&
    item.runState !== "SILENT" &&
    !processing.has(item.runState || "") &&
    now - Date.parse(item.latestMessageAt || item.lastMessageAt) >= 120_000
  );
}

export function inboxLabel(item: ConversationSummary, now = Date.now()) {
  if (item.status === "closed") return "Concluída";
  if (needsAttention(item, now)) return "Precisa de atenção";
  if (item.status === "human") return "Com a equipe";
  if (item.runState === "SILENT") return "Fora do atendimento";
  if (processing.has(item.runState || "")) return "StudioFlow atendendo";
  return "Com StudioFlow";
}

export function inboxQueue(item: ConversationSummary, now = Date.now()) {
  if (item.status === "closed") return "closed";
  if (needsAttention(item, now)) return "attention";
  if (item.status === "human") return "human";
  if (item.runState === "SILENT") return "outside";
  return "ai";
}

export function waitingLabel(item: ConversationSummary, now = Date.now()) {
  const minutes = Math.max(
    0,
    Math.floor(
      (now - Date.parse(item.latestMessageAt || item.lastMessageAt)) / 60_000,
    ),
  );
  if (!Number.isFinite(minutes)) return "Aguardando resposta";
  return minutes < 60
    ? `Aguarda há ${minutes} min`
    : minutes < 1440
      ? `Aguarda há ${Math.floor(minutes / 60)} h`
      : `Aguarda há ${Math.floor(minutes / 1440)} dias`;
}

const phoneKey = (phone: string) =>
  phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

/** Use actual phone identity, never a display name, and preserve the professional scope. */
export function customerContext(
  store: Store,
  item: ConversationSummary,
  now = Date.now(),
) {
  const phone = phoneKey(item.contactPhone);
  const customer =
    phone.length >= 10
      ? store.customers.find(
          (c) =>
            c.businessId === store.business.id && phoneKey(c.phone) === phone,
        )
      : undefined;
  const appointments = store.appointments.filter(
    (a) =>
      a.businessId === store.business.id &&
      (customer
        ? a.customerId === customer.id
        : phone.length >= 10 && phoneKey(a.customerPhone) === phone) &&
      (!item.whatsappProfessionalId ||
        a.professionalId === item.whatsappProfessionalId),
  );
  const next = appointments
    .filter(
      (a) =>
        ["confirmed", "pending"].includes(a.status) &&
        Date.parse(a.start) > now,
    )
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const previous = appointments
    .filter((a) => a.status === "completed" && Date.parse(a.start) <= now)
    .sort((a, b) => b.start.localeCompare(a.start))[0];
  return { customer, next, previous };
}
