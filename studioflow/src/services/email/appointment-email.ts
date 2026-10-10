import { appUrl } from "@/lib/app-url";
import { money } from "@/lib/utils";
import type { Appointment, Store } from "@/types";
import { escapeHtml, type Email } from "./resend";

export type AppointmentEmailKind = "confirmation" | "day_before";

/** Conteúdo do e-mail ao cliente; sem dados de outros clientes nem tokens. */
export function appointmentEmail(
  kind: AppointmentEmailKind,
  store: Store,
  appointment: Appointment,
  to: string,
): Email {
  const zone = "America/Sao_Paulo";
  const start = new Date(appointment.start);
  const day = new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(start);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);
  const services = appointment.serviceIds
    .map((id) => store.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  const professional = store.professionals.find(
    (p) => p.id === appointment.professionalId,
  )?.name;
  const first = appointment.customerName.trim().split(/\s+/)[0] || "";
  const business = store.business;
  const link = `${appUrl}/${business.slug}`;
  const color = /^#[0-9a-f]{6}$/i.test(business.color || "")
    ? business.color!
    : "#16130F";
  const pending = appointment.status === "pending";
  const title =
    kind === "day_before"
      ? `Amanhã é seu horário na ${business.name}`
      : pending
        ? `Recebemos seu pedido na ${business.name}`
        : `Horário confirmado na ${business.name}`;
  const intro =
    kind === "day_before"
      ? `Oi${first ? `, ${first}` : ""}! Passando para lembrar do seu horário amanhã.`
      : pending
        ? `Oi${first ? `, ${first}` : ""}! Seu pedido foi registrado e está aguardando confirmação.`
        : `Oi${first ? `, ${first}` : ""}! Seu horário está confirmado.`;
  const rows: [string, string][] = [
    ["Quando", `${day} às ${time}`],
    ...(services ? ([["Serviço", services]] as [string, string][]) : []),
    ...(professional
      ? ([["Profissional", professional]] as [string, string][])
      : []),
    ...(appointment.price
      ? ([["Valor", money(appointment.price)]] as [string, string][])
      : []),
    ...(business.address
      ? ([["Endereço", business.address]] as [string, string][])
      : []),
  ];
  const text = [
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Precisa remarcar? Fale com a ${business.name}${business.phone ? ` pelo ${business.phone}` : ""} ou acesse ${link}`,
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F4F0E8;font-family:Arial,Helvetica,sans-serif;color:#16130F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFDF9;border-radius:16px;overflow:hidden;border:1px solid #E4DACB">
<tr><td style="background:${color};padding:22px 28px;color:#FFFFFF;font-size:13px;letter-spacing:2px;text-transform:uppercase">${escapeHtml(business.name)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.2">${escapeHtml(title)}</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:1.5;color:#5E554B">${escapeHtml(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EDE5D8">
${rows.map(([k, v]) => `<tr><td style="padding:12px 0;border-bottom:1px solid #EDE5D8;font-size:13px;color:#8C8276;width:110px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:12px 0;border-bottom:1px solid #EDE5D8;font-size:15px">${escapeHtml(v)}</td></tr>`).join("")}
</table>
<p style="margin:26px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:${color};color:#FFFFFF;text-decoration:none;padding:13px 22px;border-radius:999px;font-size:15px">Ver a página da ${escapeHtml(business.name)}</a></p>
<p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#8C8276">Precisa remarcar ou cancelar? Fale com a ${escapeHtml(business.name)}${business.phone ? ` pelo ${escapeHtml(business.phone)}` : ""}.</p>
</td></tr></table>
<p style="font-size:12px;color:#A39886;margin:18px 0 0">Agendado com StudioFlow</p>
</td></tr></table></body></html>`;
  return { to, subject: title, html, text };
}
