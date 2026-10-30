import { availableSlots } from "@/lib/availability";
import { depositFor, isValidCpf } from "@/lib/payments";
import { money } from "@/lib/utils";
import type { ConversationMessage, Store } from "@/types";
import { runTool, type AssistantContext, type TurnResult } from "./agent";
import { nameAnswer, type Interpretation } from "./understanding";
import { offeredChoice } from "./offered-choice";
import { menuSelection } from "./booking-menu";

const displayName = (value: string) =>
  value === value.toUpperCase()
    ? value.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
    : value;

/** Closing a sale is a backend operation, never permission delegated to n8n. */
export function completeBookingSelection(selection: Interpretation) {
  return (
    selection.intent === "BOOK" &&
    selection.nextAction === "CONFIRM" &&
    selection.confidence >= 0.7 &&
    selection.serviceIds.length > 0 &&
    new Set(selection.serviceIds).size === selection.serviceIds.length &&
    /^\d{4}-\d{2}-\d{2}$/.test(selection.date) &&
    /^\d{2}:\d{2}$/.test(selection.time) &&
    selection.missing.length === 0
  );
}

const declined = (text: string) =>
  /[?]|\b(?:n[aã]o|cancelar|cancela|desisti|talvez)\b/i.test(text);
function consent(text: string, time: string) {
  if (declined(text)) return false;
  return (
    /\b(?:pode(?: ser)? marcar|confirma|confirmo|quero marcar|vamos marcar|fechado)\b/i.test(
      text,
    ) ||
    new RegExp(
      `^(?:quero |prefiro |pode ser |às? )?0?${Number(time.slice(0, 2))}(?::${time.slice(3)}|h${time.slice(3) === "00" ? "(?:00)?" : time.slice(3)})(?:\\s*(?:sim|por favor|tá ótimo|ta otimo))?[.!]?$`,
      "i",
    ).test(text.trim())
  );
}

export async function finishConfirmedBooking(input: {
  selection: Interpretation;
  text: string;
  recent: ConversationMessage[];
  store: Store;
  ctx: AssistantContext;
  beforeBooking: () => Promise<void>;
}): Promise<TurnResult | null> {
  const { text, recent, store, ctx } = input;
  if (!completeBookingSelection(input.selection)) return null;
  const now = ctx.now || new Date();
  // A slot tapped in the list a moment ago: the same day, time and services.
  const tapped = (body: string) => {
    const chosen = menuSelection(store, body);
    return chosen?.time &&
      chosen.date === input.selection.date &&
      chosen.time === input.selection.time &&
      chosen.serviceIds.join() === input.selection.serviceIds.join() &&
      (!input.selection.professionalId ||
        input.selection.professionalId === "any" ||
        chosen.professionalId === input.selection.professionalId)
      ? chosen
      : null;
  };
  // Answering the name must not drop the barber picked in the list.
  let picked: Interpretation | null = null;
  for (let i = recent.length - 1; i >= 0 && !picked; i--) {
    const message = recent[i];
    if (now.getTime() - Date.parse(message.createdAt) > 30 * 60_000) break;
    if (message.role === "customer") picked = tapped(message.body);
  }
  const selection: Interpretation =
    picked?.professionalId &&
    (!input.selection.professionalId || input.selection.professionalId === "any")
      ? { ...input.selection, professionalId: picked.professionalId }
      : input.selection;
  const confirmsSummary = (value: string, previous?: ConversationMessage) =>
    /^(sim|pode sim|pode ser|confirmado)[.!]?$/i.test(value.trim()) &&
    previous?.role === "assistant" &&
    /Posso confirmar/i.test(previous.body) &&
    previous.body.includes(selection.time) &&
    previous.body.includes(selection.date.split("-").reverse().join("/")) &&
    Date.parse(previous.createdAt) <= now.getTime() &&
    now.getTime() - Date.parse(previous.createdAt) <= 30 * 60_000;
  let recentConsent = false;
  // Only carry consent across the requested name/CPF collection, never across
  // a refusal, changed choice or unrelated intervening customer message.
  for (let i = recent.length - 1; i >= 0; i--) {
    const message = recent[i];
    if (message.role !== "customer") continue;
    const age = now.getTime() - Date.parse(message.createdAt);
    if (!Number.isFinite(age) || age < 0 || age > 30 * 60_000) break;
    if (declined(message.body)) break;
    const chosen = offeredChoice(message.body, store, recent.slice(0, i), now);
    if (
      consent(message.body, selection.time) ||
      confirmsSummary(message.body, recent[i - 1]) ||
      !!tapped(message.body) ||
      (chosen?.date === selection.date &&
        chosen.time === selection.time &&
        chosen.serviceIds.join() === selection.serviceIds.join() &&
        chosen.professionalId === selection.professionalId)
    ) {
      recentConsent = true;
      break;
    }
    const previous = recent[i - 1];
    const requestedCpf =
      previous?.role === "assistant" &&
      /\bCPF\b/i.test(previous.body) &&
      isValidCpf(message.body.replace(/\D/g, ""));
    if (!nameAnswer(message.body, recent.slice(0, i)) && !requestedCpf) break;
  }
  const answeringName = nameAnswer(text, recent);
  const answeringCpf =
    /\bCPF\b/i.test(recent.at(-1)?.body || "") &&
    recent.at(-1)?.role === "assistant";
  const confirmingSummary = confirmsSummary(text, recent.at(-1));
  const authorized =
    !declined(text) &&
    (consent(text, selection.time) ||
      (() => {
        const chosen = offeredChoice(text, store, recent, now);
        return (
          chosen?.date === selection.date &&
          chosen.time === selection.time &&
          chosen.serviceIds.join() === selection.serviceIds.join() &&
          chosen.professionalId === selection.professionalId
        );
      })() ||
      confirmingSummary ||
      (!!recentConsent && (!!answeringName || answeringCpf)));
  const response = (reply: string, handoff?: string): TurnResult => ({
    history: [],
    reply,
    handoff,
    usage: { input: 0, output: 0 },
  });
  if (!authorized) {
    const person = store.professionals.find(
      (p) => p.id === selection.professionalId,
    );
    return response(
      `Posso confirmar ${store.services
        .filter((s) => selection.serviceIds.includes(s.id))
        .map((s) => s.name.toLowerCase())
        .join(" + ")}${person ? ` com ${displayName(person.name)}` : ""} em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(new Date(`${selection.date}T12:00:00Z`))}, ${selection.date.split("-").reverse().join("/")}, às ${selection.time}?`,
    );
  }
  let name = ctx.customerName || answeringName;
  if (!name) {
    for (let i = recent.length - 1; i > 0; i--) {
      if (recent[i].role === "customer")
        name = nameAnswer(recent[i].body, recent.slice(0, i));
      if (name) break;
    }
  }
  if (!name || name.length < 3)
    return response("Qual nome você prefere para o agendamento?");
  if (!ctx.verifiedPhone)
    return response(
      "Vou chamar a equipe para conferir seu contato.",
      "Contato não verificado",
    );
  const slots = availableSlots(
    store,
    selection.serviceIds,
    ctx.professionalId || selection.professionalId || "any",
    selection.date,
    now,
  );
  const slot = slots.find((s) => s.time === selection.time);
  if (!slot)
    return response(
      slots.length
        ? `Esse horário acabou de ficar indisponível. Tenho ${slots
            .slice(0, 3)
            .map((s) => s.time)
            .join(" / ")}. Qual você prefere?`
        : "Esse horário ficou indisponível. Você prefere consultar outro dia?",
    );
  const price = store.services
    .filter((s) => selection.serviceIds.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);
  const cpf = answeringCpf ? text.replace(/\D/g, "") : "";
  if (ctx.payments && depositFor(store.settings, price) > 0 && !isValidCpf(cpf))
    return response(
      "Para gerar o sinal por Pix, preciso do seu CPF. Pode informar?",
    );
  await input.beforeBooking();
  const state: Parameters<typeof runTool>[3] = {};
  const result = await runTool(
    "agendar",
    {
      servicos: selection.serviceIds,
      profissional: slot.professionalId,
      inicio: slot.start,
      nome: name,
      cpf,
    },
    { ...ctx, bookingAllowed: true, bookingSelection: selection },
    state,
  );
  if (result.isError || !state.booked)
    return response(
      "Vou chamar a equipe para conferir esse pedido antes de confirmar o horário.",
      "Reserva sem confirmação",
    );
  const a = state.booked;
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(a.start));
  const receipt = a.token
    ? ` Seu comprovante: ${ctx.origin}/booking/${a.token}`
    : "";
  const reply =
    a.depositStatus === "pending"
      ? `Seu horário para ${when} está reservado, aguardando o sinal de ${money(Number(a.depositAmount))} via Pix em até ${store.settings.depositHold} minutos.${receipt}`
      : `${a.status === "confirmed" ? "Tudo certo! Agendamento confirmado" : "Seu agendamento foi registrado, aguardando confirmação"} para ${when}.${receipt}`;
  return { ...response(reply), booked: a };
}
