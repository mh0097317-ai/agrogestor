import { z } from "zod";
import type { Appointment } from "@/types";

export const appointmentAction = z.enum([
  "reminder_24h",
  "reminder_2h",
  "no_show_followup",
  "post_appointment",
  "daily_summary",
]);
export type AppointmentAction = z.infer<typeof appointmentAction>;
export const appointmentNotificationOptions = [
  z
    .object({
      action: z.literal("reminder_24h"),
      appointmentId: z.string().uuid(),
      test: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("reminder_2h"),
      appointmentId: z.string().uuid(),
      test: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("no_show_followup"),
      appointmentId: z.string().uuid(),
      test: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("post_appointment"),
      appointmentId: z.string().uuid(),
      test: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("daily_summary"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      test: z.boolean().default(false),
    })
    .strict(),
] as const;
export const appointmentNotificationSchema = z.discriminatedUnion(
  "action",
  appointmentNotificationOptions,
);
export const saoPauloDate = (time: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
export function appointmentEligible(
  action: AppointmentAction,
  a: Appointment,
  now: number,
) {
  const start = Date.parse(a.start),
    end = Date.parse(a.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return false;
  const until = start - now,
    since = now - end;
  if (action === "reminder_24h")
    return (
      a.status === "confirmed" &&
      a.reminder &&
      until > 23.75 * 3600000 &&
      until <= 24 * 3600000
    );
  if (action === "reminder_2h")
    return (
      a.status === "confirmed" &&
      a.reminder &&
      until >= 15 * 60000 &&
      until <= 2 * 3600000 &&
      now - Date.parse(a.createdAt) >= 10 * 60000
    );
  if (action === "no_show_followup")
    return a.status === "no_show" && since >= 0 && since <= 86400000;
  if (action === "post_appointment")
    return a.status === "completed" && since >= 30 * 60000 && since <= 86400000;
  return false;
}
export function summaryDue(date: string, now: number) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
  return date === saoPauloDate(now) && hour >= 18;
}
