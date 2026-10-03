import type { Appointment, Business, Service } from "@/types";

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
function icsDate(date: string) {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function downloadCalendar(
  appointment: Appointment,
  business: Business,
  services: Service[],
) {
  const title = services
    .filter((service) => appointment.serviceIds.includes(service.id))
    .map((service) => service.name)
    .join(" + ");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studioflow//Agendamentos//PT-BR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@studioflow`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(appointment.start)}`,
    `DTEND:${icsDate(appointment.end)}`,
    `SUMMARY:${escapeIcs(`${title} — ${business.name}`)}`,
    `LOCATION:${escapeIcs(business.address)}`,
    `DESCRIPTION:${escapeIcs(`Agendamento em ${business.name}. Gerencie em ${window.location.href}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
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
