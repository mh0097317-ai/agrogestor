import { z } from "zod";
import { accessOpen } from "@/lib/access";
import { appUrl } from "@/lib/app-url";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, readBusinessAccess } from "@/lib/supabase/server";
import { money } from "@/lib/utils";
import { weeklyPeriod, weeklySummary } from "@/lib/weekly-report";
import type { ReminderStage } from "../billing";
import { requirePlatformAdmin } from "../platform";
import { isDemo } from "../server-demo";
import { getPublicStore } from "../server-store";
import { queryWeeklyRows } from "../weekly-report";
import { weeklyReportPdf } from "../weekly-report-pdf";
import { brandEmail, firstName } from "./brand-email";
import { encryptSecret } from "../server-secrets";
import { marketingAiAccess } from "../marketing/service";
import { emailConfigured, forgetResendKey, resendKey, sendEmail, type Email } from "./resend";

/*
 * E-mails da StudioFlow para os donos: cobrança da mensalidade, boas-vindas
 * de quem acabou de se inscrever e o relatório semanal em PDF. Vão para o
 * e-mail de login do dono. O /admin → E-mails liga, desliga e mostra o
 * histórico.
 */

export type EmailKind = "billing" | "welcome" | "setup" | "share" | "weekly" | "test" | "campaign";

export interface EmailSettings {
  enabled: boolean;
  billing: boolean;
  onboarding: boolean;
  weekly: boolean;
  replyTo: string;
}

const defaults: EmailSettings = {
  enabled: true,
  billing: true,
  onboarding: true,
  weekly: true,
  replyTo: "",
};

export async function readEmailSettings(): Promise<EmailSettings> {
  if (isDemo()) return defaults;
  const { data } = await createSupabaseAdmin()
    .from("platform_email_settings")
    .select("enabled,billing,onboarding,weekly,reply_to")
    .eq("id", true)
    .maybeSingle();
  return data
    ? {
        enabled: data.enabled,
        billing: data.billing,
        onboarding: data.onboarding,
        weekly: data.weekly,
        replyTo: data.reply_to || "",
      }
    : defaults;
}

/** Pode mandar este tipo agora? Chave do Resend + chave geral + chave do tipo. */
async function allowed(kind: "billing" | "onboarding" | "weekly") {
  if (!(await emailConfigured()) || isDemo()) return null;
  const settings = await readEmailSettings();
  return settings.enabled && settings[kind] ? settings : null;
}

const validEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

/** Envia e registra no histórico do /admin. Nunca lança: devolve se saiu. */
export async function deliver(
  kind: EmailKind,
  email: Email,
  options: { businessId?: string | null; key?: string; replyTo?: string } = {},
) {
  if (!validEmail(email.to)) return false;
  const admin = createSupabaseAdmin();
  try {
    const id = await sendEmail(
      { ...email, ...(options.replyTo ? { replyTo: options.replyTo } : {}) },
      options.key,
    );
    await admin.from("platform_email_log").insert({
      business_id: options.businessId ?? null,
      kind,
      recipient: email.to,
      subject: email.subject.slice(0, 300),
      status: "sent",
      provider_id: id || null,
    });
    return true;
  } catch (cause) {
    await admin.from("platform_email_log").insert({
      business_id: options.businessId ?? null,
      kind,
      recipient: email.to,
      subject: email.subject.slice(0, 300),
      status: "failed",
      error: (cause instanceof Error ? cause.message : "falha").slice(0, 300),
    });
    return false;
  }
}

/* ------------------------------ Cobrança ------------------------------ */

export function billingEmail(input: {
  to: string;
  stage: ReminderStage;
  owner: string;
  business: string;
  plan: string;
  price: number;
  until: string | null;
  link: string;
}) {
  const late = input.stage === "late";
  const due = input.until
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long" }).format(
        new Date(input.until),
      )
    : "";
  const when = input.stage === "today" ? "vence hoje" : input.stage === "soon" ? "vence em 3 dias" : "venceu";
  const hello = firstName(input.owner) ? `Oi, ${firstName(input.owner)}!` : "Olá!";
  return brandEmail({
    to: input.to,
    subject: late
      ? `Acesso da ${input.business} pausado: mensalidade em aberto`
      : `A mensalidade da ${input.business} ${when}`,
    preview: late
      ? "Pague pelo link e o acesso volta na hora."
      : "Pix, boleto ou cartão: o acesso renova sozinho.",
    title: late ? "Seu acesso ficou pausado" : `Sua mensalidade ${when}`,
    paragraphs: [
      late
        ? `${hello} O acesso da ${input.business} ao StudioFlow ficou pausado porque a mensalidade venceu. Assim que o pagamento cair, tudo volta na hora: agenda, link de agendamento e lembretes.`
        : `${hello} Passando para avisar que a mensalidade da ${input.business} ${when}. Pagando pelo link, o acesso renova sozinho, sem precisar falar com ninguém.`,
    ],
    rows: [
      ["Estabelecimento", input.business],
      ...(input.plan ? ([["Plano", input.plan]] as [string, string][]) : []),
      ["Valor", money(input.price)],
      ...(due ? ([[late ? "Venceu em" : "Vencimento", due]] as [string, string][]) : []),
    ],
    cta: { label: late ? "Pagar e liberar o acesso" : "Pagar mensalidade", url: input.link },
    footnote: "Pix, boleto ou cartão. Se já pagou, pode ignorar este e-mail. Dúvidas? É só responder.",
  });
}

/* ---------------------------- Boas-vindas ----------------------------- */

type OnboardingKind = "welcome" | "setup" | "share";

/** Dias depois do cadastro em que cada passo sai (e até quando ainda vale). */
const onboardingWindow: Record<OnboardingKind, [number, number]> = {
  welcome: [0, 3],
  setup: [2, 6],
  share: [5, 10],
};

export function onboardingEmail(kind: OnboardingKind, input: { to: string; owner: string; business: string; slug: string }) {
  const hello = firstName(input.owner) ? `Oi, ${firstName(input.owner)}!` : "Olá!";
  const link = `${appUrl}/${input.slug}`;
  if (kind === "welcome")
    return brandEmail({
      to: input.to,
      subject: `Boas-vindas ao StudioFlow, ${input.business}`,
      preview: "Três passos para sua agenda online começar a receber clientes.",
      title: "Sua barbearia já está no StudioFlow",
      paragraphs: [
        `${hello} Que bom ter a ${input.business} com a gente. Em poucos minutos sua agenda online fica pronta para receber clientes.`,
      ],
      steps: [
        "Cadastre seus serviços, preços e os horários de cada profissional.",
        "Coloque foto, logo e endereço na sua página.",
        "Compartilhe seu link na bio do Instagram e no status do WhatsApp.",
      ],
      cta: { label: "Abrir meu painel", url: `${appUrl}/dashboard` },
      footnote: `Seu link de agendamento: ${link}`,
    });
  if (kind === "setup")
    return brandEmail({
      to: input.to,
      subject: "Sua página de agendamento está pronta?",
      preview: "Confira como o cliente vê a sua barbearia.",
      title: "Veja sua página como o cliente vê",
      paragraphs: [
        `${hello} Abra o link da ${input.business} no celular e faça um agendamento de teste. É o melhor jeito de conferir serviços, preços e horários antes de divulgar.`,
        "Dica: com o lembrete automático no WhatsApp ligado, o cliente recebe o aviso antes do horário e falta bem menos.",
      ],
      cta: { label: "Ver minha página", url: link },
      footnote: "Precisa de ajuda para configurar? É só responder este e-mail.",
    });
  return brandEmail({
    to: input.to,
    subject: "Hora de divulgar sua agenda online",
    preview: "Artes prontas com seu nome, foto e QR Code.",
    title: "Seus clientes já sabem que agenda online?",
    paragraphs: [
      `${hello} Na aba Divulgar do painel tem artes prontas da ${input.business}: post para o feed, story com QR Code e o story com as vagas do dia, direto da agenda.`,
      "Coloque o link na bio do Instagram e mande para quem já é cliente. Cada horário marcado pelo link é uma mensagem a menos para você responder.",
    ],
    cta: { label: "Abrir a aba Divulgar", url: `${appUrl}/dashboard/divulgar` },
  });
}

interface OverviewRow {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  created_at: string;
}

async function overviewRows() {
  const { data, error } = await createSupabaseAdmin().rpc("platform_overview");
  if (error) throw new Error("overview");
  return (data || []) as OverviewRow[];
}

/** Todo dia: quem se inscreveu nos últimos 10 dias recebe o próximo passo. */
export async function sendOnboardingEmails(now = new Date()) {
  const report = { checked: 0, sent: 0, skipped: 0 };
  const settings = await allowed("onboarding");
  if (!settings) return report;
  const admin = createSupabaseAdmin();
  for (const row of await overviewRows()) {
    const age = (now.getTime() - Date.parse(row.created_at)) / 86_400_000;
    if (!(age >= 0 && age <= 10) || !validEmail(row.owner_email || "")) continue;
    report.checked++;
    const kind = (Object.keys(onboardingWindow) as OnboardingKind[]).find(
      (k) => age >= onboardingWindow[k][0] && age <= onboardingWindow[k][1],
    );
    if (!kind) continue;
    // Reivindica antes de mandar: duas execuções nunca mandam o mesmo passo.
    const { data: claimed } = await admin
      .from("owner_email_notices")
      .upsert({ business_id: row.id, kind }, { onConflict: "business_id,kind", ignoreDuplicates: true })
      .select("business_id");
    if (!claimed?.length) {
      report.skipped++;
      continue;
    }
    const ok = await deliver(
      kind,
      onboardingEmail(kind, { to: row.owner_email, owner: row.owner_name, business: row.name, slug: row.slug }),
      { businessId: row.id, key: `onboarding-${kind}-${row.id}`, replyTo: settings.replyTo },
    );
    if (ok) report.sent++;
    else {
      await admin.from("owner_email_notices").delete().eq("business_id", row.id).eq("kind", kind);
      report.skipped++;
    }
  }
  return report;
}

/* ------------------------- Relatório semanal -------------------------- */

export function weeklyEmail(input: { to: string; owner: string; business: string; week: string; pdf?: Uint8Array }) {
  const hello = firstName(input.owner) ? `Oi, ${firstName(input.owner)}!` : "Olá!";
  const start = new Date(`${input.week}T12:00:00-03:00`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" }).format(d);
  return brandEmail({
    to: input.to,
    subject: `Relatório da semana · ${input.business}`,
    preview: `Atendimentos, faturamento e clientes de ${fmt(start)} a ${fmt(end)}.`,
    title: "Como foi a sua semana",
    paragraphs: [
      `${hello} Segue em anexo o relatório da ${input.business} de ${fmt(start)} a ${fmt(end)}: atendimentos, faturamento, faltas e o resultado de cada profissional.`,
    ],
    cta: { label: "Abrir o painel", url: `${appUrl}/dashboard` },
    footnote: "Não quer mais receber por e-mail? Desligue em Relatórios semanais, no seu painel.",
    attachments: input.pdf
      ? [{ filename: `studioflow-semanal-${input.week}.pdf`, content: Buffer.from(input.pdf).toString("base64") }]
      : undefined,
  });
}

/** Segunda, 9h: o relatório da semana anterior vai para o e-mail de cada dono. */
export async function sendWeeklyEmails(now = new Date(), limit = 20) {
  const report = { checked: 0, sent: 0, failed: 0 };
  const settings = await allowed("weekly");
  if (!settings) return report;
  const admin = createSupabaseAdmin();
  const { from: week } = weeklyPeriod(undefined, now);
  const { data: off } = await admin
    .from("weekly_report_preferences")
    .select("business_id")
    .eq("email_enabled", false);
  const skip = new Set((off || []).map((r) => r.business_id as string));
  for (const row of await overviewRows()) {
    if (report.sent + report.failed >= limit) break;
    if (skip.has(row.id) || !validEmail(row.owner_email || "")) continue;
    if (!accessOpen(await readBusinessAccess(row.id))) continue;
    report.checked++;
    const key = { business_id: row.id, week, target: "owner-email" };
    const { error } = await admin.from("weekly_report_deliveries").insert(key);
    if (error) continue; // já saiu (ou está saindo) nesta semana
    try {
      const store = await getPublicStore(row.slug);
      const rows = await queryWeeklyRows(admin, row.id, week);
      const pdf = await weeklyReportPdf(
        weeklySummary(store, week, undefined, rows.appointments, rows.receipts, rows.sales, now),
      );
      const ok = await deliver(
        "weekly",
        weeklyEmail({ to: row.owner_email, owner: row.owner_name, business: row.name, week, pdf }),
        { businessId: row.id, key: `weekly-${row.id}-${week}`, replyTo: settings.replyTo },
      );
      await admin
        .from("weekly_report_deliveries")
        .update(ok ? { status: "sent", sent_at: now.toISOString() } : { status: "failed" })
        .match(key);
      report[ok ? "sent" : "failed"]++;
    } catch {
      await admin.from("weekly_report_deliveries").update({ status: "failed" }).match(key);
      report.failed++;
    }
  }
  return report;
}

/* -------------------------------- Admin ------------------------------- */

export const emailSettingsSchema = z
  .object({
    enabled: z.boolean(),
    billing: z.boolean(),
    onboarding: z.boolean(),
    weekly: z.boolean(),
    replyTo: z
      .string()
      .trim()
      .max(320)
      .refine((v) => v === "" || validEmail(v), "Informe um e-mail válido para as respostas."),
  })
  .strict();

export async function saveEmailSettings(input: z.infer<typeof emailSettingsSchema>) {
  await requirePlatformAdmin();
  if (isDemo()) throw new DomainError("Os e-mails são configurados no app publicado.", 400);
  const { error } = await createSupabaseAdmin()
    .from("platform_email_settings")
    .upsert({
      id: true,
      enabled: input.enabled,
      billing: input.billing,
      onboarding: input.onboarding,
      weekly: input.weekly,
      reply_to: input.replyTo,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new DomainError("Não foi possível salvar.", 503);
  return input;
}

export const resendKeySchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^re_[A-Za-z0-9_]{10,200}$/, "Cole a chave do Resend completa (começa com re_)."),
});

/** Guarda a chave do Resend cifrada; ela nunca volta para o navegador. */
export async function saveResendKey(key: string | null) {
  await requirePlatformAdmin();
  if (isDemo()) throw new DomainError("A chave é salva no app publicado.", 400);
  const { error } = await createSupabaseAdmin()
    .from("platform_email_settings")
    .update({ resend_key_enc: key ? encryptSecret(key) : null, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new DomainError("Não foi possível salvar a chave.", 503);
  forgetResendKey();
  return { ok: true };
}

export const previewKinds = ["billing", "welcome", "setup", "share", "weekly"] as const;
export type PreviewKind = (typeof previewKinds)[number];

/** Modelo com dados de exemplo, para o admin ver antes de ligar. */
export function sampleEmail(kind: PreviewKind, to = "dono@barbearia.com.br"): Email {
  const sample = { to, owner: "Carlos Souza", business: "Barbearia Navalha", slug: "barbearia-navalha" };
  if (kind === "billing")
    return billingEmail({
      ...sample,
      stage: "soon",
      plan: "Profissional",
      price: 99,
      until: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      link: `${appUrl}/dashboard`,
    });
  if (kind === "weekly") return weeklyEmail({ ...sample, week: weeklyPeriod(undefined, new Date()).from });
  return onboardingEmail(kind, sample);
}

async function adminEmail(userId: string | null) {
  if (!userId) return "";
  const { data } = await createSupabaseAdmin().auth.admin.getUserById(userId);
  return data.user?.email || "";
}

export async function sendTestEmail(kind: PreviewKind) {
  const { userId } = await requirePlatformAdmin();
  if (isDemo()) throw new DomainError("O teste funciona no app publicado.", 400);
  if (!(await emailConfigured()))
    throw new DomainError("Salve a chave do Resend no topo desta aba. Sem ela nenhum e-mail sai.", 409);
  const to = await adminEmail(userId);
  if (!to) throw new DomainError("Não achei o e-mail da sua conta.", 400);
  const email = sampleEmail(kind, to);
  const ok = await deliver("test", { ...email, subject: `[Teste] ${email.subject}` });
  if (!ok)
    throw new DomainError(
      "O Resend recusou o envio. Confira se o domínio studioflowapp.tech está verificado no Resend.",
      502,
    );
  return { to };
}

export async function emailOverview() {
  await requirePlatformAdmin();
  const settings = await readEmailSettings();
  const key = await resendKey();
  const ai = await marketingAiAccess().then(
    () => true,
    () => false,
  );
  const base = {
    keySource: key.source,
    ai,
    configured: await emailConfigured(),
    from: process.env.EMAIL_FROM || "StudioFlow <avisos@studioflowapp.tech>",
    settings,
    demo: isDemo(),
  };
  if (isDemo()) return { ...base, counts: {}, recent: [] };
  const admin = createSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: month }, { data: recent }] = await Promise.all([
    admin.from("platform_email_log").select("kind,status").gte("created_at", since).limit(5000),
    admin
      .from("platform_email_log")
      .select("id,kind,recipient,subject,status,error,created_at,business_id")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const counts: Record<string, { sent: number; failed: number }> = {};
  for (const row of month || []) {
    const c = (counts[row.kind as string] ??= { sent: 0, failed: 0 });
    c[row.status === "sent" ? "sent" : "failed"]++;
  }
  return {
    ...base,
    counts,
    recent: (recent || []).map((r) => ({
      id: r.id as string,
      kind: r.kind as EmailKind,
      recipient: r.recipient as string,
      subject: r.subject as string,
      status: r.status as "sent" | "failed",
      error: (r.error as string) || "",
      createdAt: r.created_at as string,
    })),
  };
}

export { allowed as emailAllowed };
