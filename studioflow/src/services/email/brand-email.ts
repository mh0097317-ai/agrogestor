import { appUrl } from "@/lib/app-url";
import { escapeHtml, type Email } from "./resend";

/*
 * E-mails da StudioFlow para os donos de barbearia: cobrança, boas-vindas e
 * relatório. Um modelo só, com a cara do produto e versão em texto puro.
 */

export interface BrandEmailInput {
  to: string;
  subject: string;
  /** Linha que o leitor de e-mail mostra antes de abrir. */
  preview: string;
  title: string;
  paragraphs: string[];
  rows?: [string, string][];
  steps?: string[];
  cta?: { label: string; url: string };
  footnote?: string;
  attachments?: Email["attachments"];
}

const ink = "#16130F";
const brass = "#8A6430";

export function brandEmail(input: BrandEmailInput): Email {
  const text = [
    input.title,
    "",
    ...input.paragraphs.flatMap((p) => [p, ""]),
    ...(input.rows || []).map(([k, v]) => `${k}: ${v}`),
    ...(input.rows?.length ? [""] : []),
    ...(input.steps || []).map((step, i) => `${i + 1}. ${step}`),
    ...(input.steps?.length ? [""] : []),
    ...(input.cta ? [`${input.cta.label}: ${input.cta.url}`, ""] : []),
    ...(input.footnote ? [input.footnote, ""] : []),
    "StudioFlow · agenda e gestão para barbearias",
    appUrl,
  ].join("\n");
  const rows = input.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EDE5D8;margin:0 0 22px">${input.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:11px 0;border-bottom:1px solid #EDE5D8;font-size:13px;color:#8C8276;width:130px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:11px 0;border-bottom:1px solid #EDE5D8;font-size:15px;color:${ink}">${escapeHtml(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const steps = input.steps?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px">${input.steps
        .map(
          (step, i) =>
            `<tr><td style="width:34px;vertical-align:top;padding:6px 0"><span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;background:${ink};color:#F4F0E8;font-size:12px;text-align:center">${i + 1}</span></td><td style="padding:8px 0;font-size:15px;line-height:1.45;color:${ink}">${escapeHtml(step)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const html = `<!doctype html><html lang="pt-BR"><head><meta name="color-scheme" content="light"></head><body style="margin:0;background:#F4F0E8;font-family:Arial,Helvetica,sans-serif;color:${ink}">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFDF9;border-radius:16px;overflow:hidden;border:1px solid #E4DACB">
<tr><td style="background:${ink};padding:22px 28px;font-family:Georgia,serif;font-size:22px;color:#F4F0E8">Studio<i style="color:#D9B77A">Flow</i></td></tr>
<tr><td style="padding:30px 28px">
<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.25;color:${ink}">${escapeHtml(input.title)}</h1>
${input.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#4A4239">${escapeHtml(p)}</p>`).join("")}
${rows}${steps}
${input.cta ? `<p style="margin:8px 0 0"><a href="${escapeHtml(input.cta.url)}" style="display:inline-block;background:${brass};color:#FFFFFF;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:15px;font-weight:bold">${escapeHtml(input.cta.label)}</a></p>` : ""}
${input.footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#8C8276">${escapeHtml(input.footnote)}</p>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#A39886;margin:18px 0 0">StudioFlow · agenda e gestão para barbearias · <a href="${appUrl}" style="color:#A39886">${appUrl.replace(/^https?:\/\//, "")}</a></p>
</td></tr></table></body></html>`;
  return {
    to: input.to,
    subject: input.subject,
    html,
    text,
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
  };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "";
