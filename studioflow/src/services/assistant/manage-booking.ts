import {
  chooseProfessional,
  DomainError,
  servicesFor,
} from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { displayName } from "@/lib/person-name";
import { isDemo, mutateDemo } from "../server-demo";
import { camel, customerClash } from "../server-store";
import type { Appointment, ConversationMessage, Store } from "@/types";
import { bookingMenu, type BookingMenu } from "./booking-menu";
import { brazilPhone } from "./whatsapp";

export type ChangeAction = "cancel" | "reschedule";
export interface ManageResult {
  reply: string;
  menu?: BookingMenu | null;
  /** Internal note for the next turns: which appointment is being changed. */
  event?: string;
  handoff?: string;
  cancelled?: Appointment;
}

const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const uuid = "[0-9a-f-]{36}";
const minutes30 = 30 * 60_000;
export const moveEvent = (id: string) => `Remarcação pedida: ${id}`;
export const moveDoneEvent = (id: string) => `Remarcação concluída: ${id}`;
const cancelEvent = (id: string) => `Cancelamento pedido: ${id}`;

/** "Quero cancelar", "preciso remarcar", "dá pra mudar o horário?". */
export function changeRequest(text: string): ChangeAction | null {
  const value = plain(text);
  if (
    /\b(?:nao (?:quero |precisa )?(?:mais )?(?:cancelar|desmarcar))\b/.test(
      value,
    )
  )
    return null;
  if (/\b(?:cancel|desmarc)/.test(value)) return "cancel";
  if (
    /\b(?:reagend|remarc|adiar|mudar (?:o |meu )?(?:horario|dia)|trocar (?:o |meu )?(?:horario|dia)|outro (?:dia|horario) pro meu)/.test(
      value,
    )
  )
    return "reschedule";
  return null;
}

/** Only this verified phone's future appointments at this business. */
export function upcomingFor(store: Store, phone: string, now = new Date()) {
  const own = brazilPhone(phone);
  if (!/^\d{10,15}$/.test(own)) return [];
  return store.appointments
    .filter(
      (a) =>
        a.businessId === store.business.id &&
        ["confirmed", "pending"].includes(a.status) &&
        Date.parse(a.start) > now.getTime() &&
        brazilPhone(a.customerPhone) === own,
    )
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function describeAppointment(store: Store, a: Appointment) {
  const services = a.serviceIds
    .map((id) => store.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .map((name) => displayName(name!))
    .join(" + ");
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(a.start))
    .replace(/, (\d{2}:\d{2})$/, " às $1")
    .replace(/ (\d{2}:\d{2})$/, " às $1");
  const person = store.professionals.find((p) => p.id === a.professionalId);
  return `${services || "Atendimento"} · ${when}${person ? ` com ${displayName(person.name)}` : ""}`;
}

/** The latest open request recorded in this chat, within its time window. */
function openRequest(
  messages: ConversationMessage[],
  kind: "cancel" | "move",
  now: Date,
  window = minutes30,
) {
  const pattern = new RegExp(
    `^${kind === "cancel" ? "Cancelamento" : "Remarcação"} pedid[oa]: (${uuid})$`,
  );
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "event") continue;
    if (now.getTime() - Date.parse(m.createdAt) > window) return "";
    if (
      /^Remarcação concluída|^Cancelamento concluído|^Pedido de alteração encerrado/.test(
        m.body,
      )
    )
      return "";
    const match = pattern.exec(m.body);
    if (match) return match[1];
  }
  return "";
}

/** The appointment a pending "remarcar" applies to, if still open (1 hour). */
export function pendingMove(
  messages: ConversationMessage[],
  store: Store,
  phone: string,
  now = new Date(),
) {
  const id = openRequest(messages, "move", now, 60 * 60_000);
  return id
    ? upcomingFor(store, phone, now).find((a) => a.id === id)
    : undefined;
}

function tooLate(store: Store, a: Appointment, now: Date) {
  return (
    Date.parse(a.start) <
    now.getTime() + store.settings.cancellationHours * 3600_000
  );
}
const lateReply = (store: Store) =>
  `Pelo WhatsApp eu consigo alterar até ${store.settings.cancellationHours} ${store.settings.cancellationHours === 1 ? "hora" : "horas"} antes do horário. Vou chamar a equipe para te ajudar com isso.`;

function chooser(
  store: Store,
  list: Appointment[],
  prefix: "SF_CANCEL_ASK" | "SF_MOVE",
): BookingMenu {
  return {
    title:
      prefix === "SF_MOVE" ? "Qual horário mudar?" : "Qual horário cancelar?",
    button: "Ver horários",
    rows: list.slice(0, 10).map((a) => {
      const text = describeAppointment(store, a);
      return {
        id: `${prefix}|${a.id}`,
        title: text.split(" · ")[1]?.slice(0, 24) || text.slice(0, 24),
        description: text.slice(0, 72),
      };
    }),
  };
}

function confirmCancel(store: Store, a: Appointment): ManageResult {
  return {
    reply: `Encontrei seu horário:\n\n${describeAppointment(store, a)}\n\nQuer mesmo cancelar?`,
    menu: {
      title: "Cancelar este horário?",
      button: "Responder",
      rows: [
        { id: `SF_CANCEL|${a.id}`, title: "Sim, cancelar", description: "" },
        { id: `SF_KEEP|${a.id}`, title: "Não, manter", description: "" },
      ],
    },
    event: cancelEvent(a.id),
  };
}

function askNewDay(store: Store, a: Appointment, now: Date): ManageResult {
  return {
    reply: `Seu horário atual:\n\n${describeAppointment(store, a)}\n\nPara qual dia você quer mudar?`,
    menu: bookingMenu(
      store,
      {
        intent: "BOOK",
        stage: "CHOOSING_TIME",
        confidence: 1,
        serviceIds: a.serviceIds,
        professionalId: "",
        date: "",
        time: "",
        missing: ["date"],
        nextAction: "ASK",
      },
      "Quero remarcar",
      now,
    ),
    event: moveEvent(a.id),
  };
}

/**
 * Cancel and reschedule without the model. The verified WhatsApp number is
 * the only identity: a customer sees and changes only their own bookings.
 */
export async function manageReply(input: {
  store: Store;
  text: string;
  messages: ConversationMessage[];
  phone: string;
  now?: Date;
  change: (action: ChangeAction, a: Appointment) => Promise<Appointment>;
}): Promise<ManageResult | null> {
  const { store, text, messages, phone } = input;
  const now = input.now || new Date();
  const value = text.trim();
  const list = upcomingFor(store, phone, now);
  const row = new RegExp(
    `^(SF_CANCEL|SF_KEEP|SF_CANCEL_ASK|SF_MOVE)\\|(${uuid})$`,
  ).exec(value);
  const lastAssistant = messages
    .filter((m) => m.role === "assistant" || m.role === "staff")
    .at(-1);
  const yes =
    /^(?:sim|pode|pode sim|pode cancelar|sim,? (?:pode )?cancelar|confirmo|isso|quero sim)[.!]?$/i.test(
      value,
    );
  const no =
    /^(?:n[aã]o|nao quero|deixa|deixa assim|manter|n[aã]o,? (?:pode )?manter)[.!]?$/i.test(
      value,
    );
  const pendingCancel =
    lastAssistant?.body.includes("Quer mesmo cancelar?") &&
    now.getTime() - Date.parse(lastAssistant.createdAt) <= minutes30
      ? openRequest(messages, "cancel", now)
      : "";
  const target = (id: string) => list.find((a) => a.id === id);

  let action: "cancel-now" | "keep" | "ask-cancel" | "ask-move" | null = null;
  let chosen: Appointment | undefined;
  if (row) {
    chosen = target(row[2]);
    if (!chosen)
      return {
        reply:
          "Não encontrei esse horário entre os seus agendamentos futuros. Ele pode já ter sido alterado.",
      };
    action =
      row[1] === "SF_CANCEL"
        ? "cancel-now"
        : row[1] === "SF_KEEP"
          ? "keep"
          : row[1] === "SF_MOVE"
            ? "ask-move"
            : "ask-cancel";
  } else if (pendingCancel && (yes || no)) {
    chosen = target(pendingCancel);
    if (!chosen)
      return {
        reply: "Esse horário não está mais entre os seus agendamentos.",
      };
    action = yes ? "cancel-now" : "keep";
  } else {
    const kind = changeRequest(value);
    if (!kind) return null;
    if (!list.length)
      return {
        reply:
          kind === "cancel"
            ? "Não encontrei nenhum horário marcado neste número. Se quiser marcar um, é só me dizer."
            : "Não encontrei nenhum horário marcado neste número para mudar. Quer marcar um novo?",
      };
    if (list.length > 1)
      return {
        reply: `Você tem ${list.length} horários marcados. Qual deles você quer ${kind === "cancel" ? "cancelar" : "mudar"}?`,
        menu: chooser(
          store,
          list,
          kind === "cancel" ? "SF_CANCEL_ASK" : "SF_MOVE",
        ),
      };
    chosen = list[0];
    action = kind === "cancel" ? "ask-cancel" : "ask-move";
  }
  const a = chosen!;
  if (action === "keep")
    return {
      reply: `Combinado, seu horário continua marcado:\n\n${describeAppointment(store, a)}`,
      event: "Pedido de alteração encerrado.",
    };
  if (tooLate(store, a, now))
    return { reply: lateReply(store), handoff: "Alteração fora do prazo" };
  if (action === "ask-cancel") return confirmCancel(store, a);
  if (action === "ask-move") {
    if (a.depositStatus === "pending")
      return {
        reply:
          "Esse horário ainda está aguardando o sinal por Pix. Vou chamar a equipe para te ajudar a mudar.",
        handoff: "Remarcação com sinal pendente",
      };
    return askNewDay(store, a, now);
  }
  try {
    const cancelled = await input.change("cancel", a);
    return {
      reply: `Pronto, cancelei seu horário:\n\n${describeAppointment(store, a)}\n\nQuando quiser marcar de novo, é só chamar.`,
      event: `Cancelamento concluído: ${a.id}`,
      cancelled,
    };
  } catch (error) {
    if (error instanceof DomainError && /prazo|antes/i.test(error.message))
      return { reply: lateReply(store), handoff: "Alteração fora do prazo" };
    return {
      reply: "Não consegui cancelar agora. Vou chamar a equipe para conferir.",
      handoff: "Cancelamento sem confirmação",
    };
  }
}

/** Same rules as the receipt link, keyed by id and the verified phone. */
export async function changeBooking(
  slug: string,
  store: Store,
  appointment: Appointment,
  phone: string,
  action: ChangeAction,
  start?: string,
  professionalId?: string,
): Promise<Appointment> {
  if (isDemo())
    return mutateDemo((live) => {
      const a = live.appointments.find(
        (item) =>
          item.id === appointment.id && item.businessId === live.business.id,
      );
      if (!a || brazilPhone(a.customerPhone) !== brazilPhone(phone))
        throw new DomainError("Agendamento não encontrado.", 404);
      if (action === "cancel" && a.status === "cancelled") return a;
      if (
        !["confirmed", "pending"].includes(a.status) ||
        Date.parse(a.start) <
          Date.now() + live.settings.cancellationHours * 3600_000
      )
        throw new DomainError("Fora do prazo para alterar.", 409);
      if (action === "cancel") {
        a.status = "cancelled";
        return a;
      }
      if (a.depositStatus === "pending")
        throw new DomainError("Sinal pendente.", 409);
      const person = chooseProfessional(
        live,
        a.serviceIds,
        professionalId || a.professionalId,
        start!,
        a.id,
      );
      const duration = servicesFor(live, a.serviceIds).reduce(
        (sum, s) => sum + s.duration,
        0,
      );
      if (customerClash(live, a.customerPhone, start!, duration, a.id))
        throw new DomainError("Você já tem um horário nesse período.", 409);
      Object.assign(a, {
        professionalId: person.id,
        start: new Date(start!).toISOString(),
        end: new Date(Date.parse(start!) + duration * 60_000).toISOString(),
      });
      return a;
    }, slug);
  const { data, error } = await createSupabaseAdmin().rpc(
    "assistant_manage_booking",
    {
      p_business_id: store.business.id,
      p_appointment_id: appointment.id,
      p_phone: phone,
      p_action: action,
      p_start: action === "reschedule" ? start : null,
      p_professional_id:
        action === "reschedule" && professionalId && professionalId !== "any"
          ? professionalId
          : null,
    },
  );
  if (error)
    throw new DomainError(
      error.message.includes("cancellation policy")
        ? "Fora do prazo para alterar."
        : error.message.includes("customer busy")
          ? "Você já tem um horário nesse período."
          : "Não foi possível alterar este agendamento.",
      409,
    );
  return camel(data) as Appointment;
}
