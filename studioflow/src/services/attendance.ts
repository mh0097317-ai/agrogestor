import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Appointment, Store } from "@/types";
import { isDemo, mutateDemo } from "./server-demo";
import { getPublicStore } from "./server-store";
import {
  conversationSender,
  readProfessionalLinks,
  shopSender,
} from "./whatsapp/link";

/*
 * Atendimento sem baixa. 15 minutos depois do horário, se ninguém iniciou o
 * atendimento, quem ia atender recebe no WhatsApp um link de um toque:
 * atendi, estou atendendo ou o cliente faltou. Duas horas sem resposta, o
 * dono recebe a lista. Nada muda de status sozinho.
 */

const LINK_HOURS = 48;

function key() {
  const secret =
    process.env.ATTENDANCE_LINK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (isDemo() ? "studioflow-demo" : "");
  if (!secret) throw new DomainError("Link indisponível.", 503);
  return createHash("sha256").update(`studioflow:attendance:${secret}`).digest();
}

const sign = (payload: string) =>
  createHmac("sha256", key()).update(payload).digest("base64url");

/** Signed, expiring link token: only this appointment, only for 48 hours. */
export function attendanceToken(slug: string, id: string, now = Date.now()) {
  const payload = Buffer.from(
    `${slug}|${id}|${Math.floor(now / 1000) + LINK_HOURS * 3600}`,
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readAttendanceToken(token: string, now = Date.now()) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null;
  const [slug, id, exp] = Buffer.from(payload, "base64url")
    .toString("utf8")
    .split("|");
  if (!slug || !id || Number(exp) * 1000 < now) return null;
  return { slug, id };
}

const hour = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const servicesOf = (store: Store, appointment: Appointment) =>
  appointment.serviceIds
    .map((id) => store.services.find((service) => service.id === id)?.name)
    .filter(Boolean)
    .join(" + ") || "Atendimento";

export function attendanceQuestion(
  store: Store,
  appointment: Appointment,
  link: string,
) {
  const professional = store.professionals.find(
    (person) => person.id === appointment.professionalId,
  );
  return [
    `Oi, ${professional?.name.split(" ")[0] || ""}! ✂️`,
    `O horário das *${hour(appointment.start)}* com *${appointment.customerName}* (${servicesOf(store, appointment)}) ainda não foi iniciado na agenda.`,
    "",
    "Toque no link e responda em um toque: atendi, estou atendendo ou o cliente faltou.",
    link,
  ].join("\n");
}

export function ownerDigest(
  store: Store,
  appointments: Appointment[],
  origin: string,
) {
  const lines = appointments.map((appointment) => {
    const professional = store.professionals.find(
      (person) => person.id === appointment.professionalId,
    );
    return `• ${hour(appointment.start)} · ${appointment.customerName} · ${professional?.name.split(" ")[0] || "sem profissional"}`;
  });
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(appointments[0].start));
  return [
    `*${store.business.name}*: ${appointments.length === 1 ? "1 atendimento ficou" : `${appointments.length} atendimentos ficaram`} sem baixa.`,
    "O profissional não respondeu se o cliente veio:",
    "",
    ...lines,
    "",
    `Dê a baixa na agenda para os relatórios e a comissão fecharem certo: ${origin}/dashboard/agenda?date=${day}`,
  ].join("\n");
}

async function professionalPhone(store: Store, professionalId: string) {
  const professional = store.professionals.find(
    (person) => person.id === professionalId,
  );
  if (professional?.phone) return professional.phone;
  const links = await readProfessionalLinks(store.business.id);
  return (
    links.find((l) => l.professionalId === professionalId && l.status === "open")
      ?.phone || ""
  );
}

async function markNotice(
  appointment: Appointment,
  kind: "professional_checkup" | "owner_unsettled",
  status: "sent" | "failed",
) {
  await createSupabaseAdmin()
    .from("appointment_whatsapp_notices")
    .update(
      status === "sent"
        ? { status, sent_at: new Date().toISOString() }
        : { status },
    )
    .eq("appointment_id", appointment.id)
    .eq("kind", kind)
    .eq("appointment_start", appointment.start);
}

async function claim(
  appointment: Appointment,
  kind: "professional_checkup" | "owner_unsettled",
) {
  const { data, error } = await createSupabaseAdmin().rpc(
    "claim_appointment_notice",
    { p_id: appointment.id, p_kind: kind, p_start: appointment.start },
  );
  return !error && data === true;
}

/** Cron: asks whoever should have attended. No AI. */
export async function sendAttendanceChecks(origin: string) {
  const report = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  if (isDemo()) return report;
  const { data, error } = await createSupabaseAdmin().rpc(
    "due_attendance_checks",
  );
  if (error) throw new Error("attendance query failed");
  const rows = (data || []) as { id: string; slug: string }[];
  report.checked = rows.length;
  for (const row of rows) {
    try {
      const store = await getPublicStore(row.slug);
      const appointment = store.appointments.find((a) => a.id === row.id);
      if (!appointment || appointment.status !== "confirmed") {
        report.skipped++;
        continue;
      }
      const phone = await professionalPhone(store, appointment.professionalId);
      const send =
        (await shopSender(store.business.id)) ||
        (await conversationSender(
          store.business.id,
          appointment.professionalId,
        ));
      if (!phone || !send || !(await claim(appointment, "professional_checkup"))) {
        report.skipped++;
        continue;
      }
      const link = `${origin}/atendimento/${attendanceToken(row.slug, appointment.id)}`;
      try {
        await send(phone, attendanceQuestion(store, appointment, link));
        await markNotice(appointment, "professional_checkup", "sent");
        report.sent++;
      } catch {
        await markNotice(appointment, "professional_checkup", "failed");
        report.failed++;
      }
    } catch {
      report.failed++;
    }
  }
  return report;
}

/** Owner: the professional's own WhatsApp if the owner also attends, else the shop number. */
export async function ownerPhone(store: Store) {
  const { data } = await createSupabaseAdmin()
    .from("business_members")
    .select("user_id")
    .eq("business_id", store.business.id)
    .eq("role", "owner")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const own = store.professionals.find(
    (person) => data?.user_id && person.userId === data.user_id && person.phone,
  );
  return own?.phone || store.business.phone;
}

/** Cron: two hours without an answer, the owner gets one list per shop. */
export async function sendOwnerUnsettledAlerts(origin: string) {
  const report = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  if (isDemo()) return report;
  const { data, error } = await createSupabaseAdmin().rpc(
    "due_unsettled_owner_alerts",
  );
  if (error) throw new Error("owner alert query failed");
  const rows = (data || []) as { id: string; slug: string }[];
  report.checked = rows.length;
  const bySlug = new Map<string, string[]>();
  for (const row of rows)
    bySlug.set(row.slug, [...(bySlug.get(row.slug) || []), row.id]);
  for (const [slug, ids] of bySlug) {
    try {
      const store = await getPublicStore(slug);
      const phone = await ownerPhone(store);
      const send = await shopSender(store.business.id);
      if (!phone || !send) {
        report.skipped += ids.length;
        continue;
      }
      const claimed: Appointment[] = [];
      for (const id of ids) {
        const appointment = store.appointments.find((a) => a.id === id);
        if (appointment?.status === "confirmed" && (await claim(appointment, "owner_unsettled")))
          claimed.push(appointment);
      }
      if (!claimed.length) continue;
      claimed.sort((a, b) => a.start.localeCompare(b.start));
      try {
        await send(phone, ownerDigest(store, claimed, origin));
        await Promise.all(
          claimed.map((a) => markNotice(a, "owner_unsettled", "sent")),
        );
        report.sent += claimed.length;
      } catch {
        await Promise.all(
          claimed.map((a) => markNotice(a, "owner_unsettled", "failed")),
        );
        report.failed += claimed.length;
      }
    } catch {
      report.failed += ids.length;
    }
  }
  return report;
}

export type AttendanceAnswer = "in_progress" | "completed" | "no_show";

/** What the link page shows: the appointment, never the customer's phone. */
export async function attendanceView(token: string) {
  const ref = readAttendanceToken(token);
  if (!ref) throw new DomainError("Este link expirou ou não é válido.", 404);
  const store = await getPublicStore(ref.slug);
  const appointment = store.appointments.find((a) => a.id === ref.id);
  if (!appointment) throw new DomainError("Atendimento não encontrado.", 404);
  const professional = store.professionals.find(
    (person) => person.id === appointment.professionalId,
  );
  return {
    business: {
      name: store.business.name,
      logo: store.business.logo || "",
      color: store.business.color || "",
    },
    customer: appointment.customerName.split(" ")[0],
    services: servicesOf(store, appointment),
    professional: professional?.name.split(" ")[0] || "",
    start: appointment.start,
    end: appointment.end,
    status: appointment.status,
  };
}

export async function answerAttendance(token: string, answer: AttendanceAnswer) {
  const ref = readAttendanceToken(token);
  if (!ref) throw new DomainError("Este link expirou ou não é válido.", 404);
  if (isDemo()) {
    const status = await mutateDemo((store) => {
      const appointment = store.appointments.find((a) => a.id === ref.id);
      if (!appointment) return null;
      const from = appointment.status;
      if (
        from === "confirmed" ||
        (from === "in_progress" && answer !== "in_progress")
      ) {
        appointment.status = answer;
        return answer;
      }
      return null;
    }, ref.slug);
    if (!status) throw new DomainError("Este atendimento já teve baixa.", 409);
    return attendanceView(token);
  }
  const store = await getPublicStore(ref.slug);
  if (!store.appointments.some((a) => a.id === ref.id))
    throw new DomainError("Atendimento não encontrado.", 404);
  const { data, error } = await createSupabaseAdmin().rpc("settle_attendance", {
    p_id: ref.id,
    p_status: answer,
  });
  if (error) throw new DomainError("Não foi possível salvar agora.", 503);
  if (!data) throw new DomainError("Este atendimento já teve baixa.", 409);
  return attendanceView(token);
}
