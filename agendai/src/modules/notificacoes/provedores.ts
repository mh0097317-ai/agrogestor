import "server-only";

/**
 * Provedores de envio. Todos são opcionais: sem credenciais, a mensagem é
 * registrada como SIMULADA e o dono pode enviá-la manualmente pelo WhatsApp (wa.me).
 */

export type ResultadoEnvio = { status: "ENVIADA" | "SIMULADA" | "FALHOU"; erro?: string };

export function provedorWhatsapp(): "zapi" | "twilio" | null {
  if (process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN) return "zapi";
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) return "twilio";
  return null;
}

export function provedorEmail(): "resend" | null {
  return process.env.RESEND_API_KEY ? "resend" : null;
}

async function falhaHttp(r: Response): Promise<ResultadoEnvio> {
  const corpo = await r.text().catch(() => "");
  return { status: "FALHOU", erro: `HTTP ${r.status} ${corpo.slice(0, 300)}` };
}

export async function enviarWhatsapp(telefone: string, mensagem: string): Promise<ResultadoEnvio> {
  const provedor = provedorWhatsapp();
  try {
    if (provedor === "zapi") {
      const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.ZAPI_CLIENT_TOKEN ? { "Client-Token": process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone: telefone, message: mensagem }),
      });
      return r.ok ? { status: "ENVIADA" } : falhaHttp(r);
    }
    if (provedor === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: process.env.TWILIO_WHATSAPP_FROM!,
          To: `whatsapp:+${telefone}`,
          Body: mensagem,
        }),
      });
      return r.ok ? { status: "ENVIADA" } : falhaHttp(r);
    }
    return { status: "SIMULADA" };
  } catch (e) {
    return { status: "FALHOU", erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function enviarEmail(para: string, assunto: string, texto: string): Promise<ResultadoEnvio> {
  if (provedorEmail() !== "resend") return { status: "SIMULADA" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Agendaí <onboarding@resend.dev>",
        to: [para],
        subject: assunto,
        text: texto,
        html: emailHtml(assunto, texto),
      }),
    });
    return r.ok ? { status: "ENVIADA" } : falhaHttp(r);
  } catch (e) {
    return { status: "FALHOU", erro: e instanceof Error ? e.message : String(e) };
  }
}

function escapar(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emailHtml(titulo: string, texto: string): string {
  const corpo = escapar(texto)
    .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/\S+)/g, '<a href="$1" style="color:#E4572E">$1</a>')
    .replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;background:#F6F4F0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#17151C">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="font-weight:800;font-size:18px;margin-bottom:16px">Agenda<span style="color:#E4572E">í</span></div>
<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E9E5DE">
<h1 style="font-size:18px;margin:0 0 12px">${escapar(titulo)}</h1>
<div style="font-size:15px;line-height:1.6">${corpo}</div></div>
<p style="font-size:12px;color:#8A8490;margin-top:16px">Mensagem automática enviada pelo Agendaí.</p>
</div></body></html>`;
}
