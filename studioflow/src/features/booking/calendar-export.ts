import type { Appointment, Business, Service } from "@/types";

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}
function icsDate(date: string) {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function calendarContent(
  appointment: Appointment,
  business: Business,
  services: Service[],
  manageUrl: string,
  now = new Date(),
) {
  const title = services
    .filter((service) => appointment.serviceIds.includes(service.id))
    .map((service) => service.name)
    .join(" + ");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studioflow//Agendamentos//PT-BR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@studioflow`,
    `DTSTAMP:${icsDate(now.toISOString())}`,
    `DTSTART:${icsDate(appointment.start)}`,
    `DTEND:${icsDate(appointment.end)}`,
    `SUMMARY:${escapeIcs(`${title} — ${business.name}`)}`,
    `LOCATION:${escapeIcs(business.address)}`,
    `DESCRIPTION:${escapeIcs(`Agendamento em ${business.name}. Gerencie em ${manageUrl}`)}`,
    ...["-PT12H", "-PT2H", "-PT1H"].flatMap((trigger) => [
      "BEGIN:VALARM",
      `TRIGGER:${trigger}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(`Lembrete do seu atendimento em ${business.name}`)}`,
      "END:VALARM",
    ]),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadCalendar(
  appointment: Appointment,
  business: Business,
  services: Service[],
) {
  const content = calendarContent(
    appointment,
    business,
    services,
    window.location.href,
  );
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agendamento-${business.slug}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
