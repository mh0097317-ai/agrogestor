import { formatPhone, money } from "@/lib/utils";
import type { Appointment, Store } from "@/types";
import { isDemo, mutateDemo } from "../server-demo";
import { getPublicStore } from "../server-store";
import { demoOutbox, shopSender } from "./link";

const day = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
const hour = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * The note the professional gets on WhatsApp when a customer books.
 * Short, warm and easy to read on the lock screen.
 */
export function professionalMessage(store: Store, appointment: Appointment, origin: string) {
  const professional = store.professionals.find((person) => person.id === appointment.professionalId);
  const services = appointment.serviceIds
    .map((id) => store.services.find((service) => service.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  const visits = store.appointments.filter(
    (item) =>
      item.id !== appointment.id &&
      item.customerPhone === appointment.customerPhone &&
      !["cancelled", "no_show"].includes(item.status),
  ).length;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(appointment.start),
  );
  const lines = [
    `Oi, ${firstName(professional?.name || "")}! ✂️`,
    `*${appointment.customerName}* marcou com você na *${store.business.name}*.`,
    "",
    `🗓  ${capital(day(appointment.start))}`,
    `🕐  ${hour(appointment.start)} às ${hour(appointment.end)}`,
    `💈  ${services || "Atendimento"}`,
    appointment.membershipId
      ? "⭐  Assinante do clube"
      : appointment.price > 0
        ? `💵  ${money(appointment.price)}`
        : "",
    "",
    visits === 0 ? "É a primeira vez dele(a) na casa. Capricha na recepção! 🙌" : `Já veio ${visits} ${visits === 1 ? "vez" : "vezes"}.`,
    appointment.depositStatus === "pending"
      ? "⏳ Aguardando o sinal no Pix. Se não pagar no prazo, o horário volta a ficar livre."
      : "",
    `📱 ${formatPhone(appointment.customerPhone)}`,
    "",
    `Agenda do dia: ${origin}/dashboard/agenda?date=${date}`,
  ];
  return lines
    .filter((line, index, all) => line !== "" || (all[index - 1] !== "" && index > 0))
    .join("\n")
    .trim();
}

/**
 * Sends the note to whoever will attend, through the business WhatsApp.
 * Never blocks the booking: failures are only logged.
 */
export async function notifyNewBooking(slug: string, appointmentId: string, origin: string) {
  try {
    if (isDemo()) {
      await mutateDemo((store) => {
        const appointment = store.appointments.find((item) => item.id === appointmentId);
        const professional = store.professionals.find((person) => person.id === appointment?.professionalId);
        if (!appointment || !professional?.phone || store.settings.notifyProfessionals === false) return;
        demoOutbox(store, professional.phone, professionalMessage(store, appointment, origin), "profissional");
      }, slug);
      return;
    }
    const store = await getPublicStore(slug);
    if (store.settings.notifyProfessionals === false) return;
    const appointment = store.appointments.find((item) => item.id === appointmentId);
    const professional = store.professionals.find((person) => person.id === appointment?.professionalId);
    if (!appointment || !professional?.phone) return;
    const send = await shopSender(store.business.id);
    if (!send) return;
    await send(professional.phone, professionalMessage(store, appointment, origin));
  } catch (error) {
    console.error(
      "StudioFlow professional notice error:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
