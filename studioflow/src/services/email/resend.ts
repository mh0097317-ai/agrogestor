import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isDemo } from "../server-demo";
import { decryptSecret } from "../server-secrets";

/**
 * Envio de e-mail pelo Resend. A chave vem do /admin → E-mails (cifrada no
 * banco) ou, se não houver, da RESEND_API_KEY da Vercel. Sem chave, nada sai.
 */
export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Anexos em base64 (o PDF do relatório semanal, por exemplo). */
  attachments?: { filename: string; content: string }[];
}

let cached: { at: number; key: string | null; source: "panel" | "server" | null } | null = null;

export function forgetResendKey() {
  cached = null;
}

export async function resendKey() {
  if (cached && Date.now() - cached.at < 60_000) return cached;
  let panel: string | null = null;
  if (!isDemo())
    try {
      const { data } = await createSupabaseAdmin()
        .from("platform_email_settings")
        .select("resend_key_enc")
        .eq("id", true)
        .maybeSingle();
      if (data?.resend_key_enc) panel = decryptSecret(data.resend_key_enc as string);
    } catch {
      // Banco fora do ar ou chave ilegível: vale a da Vercel.
    }
  const server = process.env.RESEND_API_KEY || null;
  cached = {
    at: Date.now(),
    key: panel || server,
    source: panel ? "panel" : server ? "server" : null,
  };
  return cached;
}

export async function emailConfigured() {
  return !!(await resendKey()).key;
}

export async function sendEmail(email: Email, idempotencyKey?: string) {
  const { key } = await resendKey();
  if (!key) throw new Error("email-not-configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from:
        process.env.EMAIL_FROM || "StudioFlow <avisos@studioflowapp.tech>",
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      ...(email.attachments?.length ? { attachments: email.attachments } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`email-failed-${response.status}`);
  const body = (await response.json().catch(() => ({}))) as { id?: string };
  return body.id || "";
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
