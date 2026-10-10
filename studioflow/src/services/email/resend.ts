/** Envio de e-mail pelo Resend. Sem RESEND_API_KEY, nada é enviado. */
export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(email: Email, idempotencyKey?: string) {
  const key = process.env.RESEND_API_KEY;
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
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`email-failed-${response.status}`);
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
