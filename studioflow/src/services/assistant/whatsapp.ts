import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/availability";

/** Graph API version used for the WhatsApp Cloud API. */
export const graphVersion = "v23.0";

export interface InboundMessage {
  phoneNumberId: string;
  /** Sender as WhatsApp sends it (wa_id, with country code). */
  from: string;
  name: string;
  id: string;
  text: string;
}

/**
 * Meta signs every delivery with the app secret:
 * `X-Hub-Signature-256: sha256=<hex hmac of the raw body>`.
 */
export function validSignature(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const received = Buffer.from(header.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Brazilian wa_id → the 11-digit number the app uses. Older mobile
 * numbers can arrive without the 9 after the area code.
 */
export function brazilPhone(waId: string) {
  const digits = waId.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 10 && /[6-9]/.test(local[2]))
    return `${local.slice(0, 2)}9${local.slice(2)}`;
  return local;
}

/** Text messages from a webhook payload; other kinds are described. */
export function inboundMessages(body: unknown): InboundMessage[] {
  const found: InboundMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return found;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;
      const phoneNumberId = String(
        (value.metadata as { phone_number_id?: string })?.phone_number_id || "",
      );
      const contacts = (value.contacts as { wa_id?: string; profile?: { name?: string } }[]) || [];
      const messages = (value.messages as Record<string, unknown>[]) || [];
      for (const message of messages) {
        const from = String(message.from || "");
        const type = String(message.type || "");
        const text =
          type === "text"
            ? String((message.text as { body?: string })?.body || "")
            : type === "button"
              ? String((message.button as { text?: string })?.text || "")
              : type === "interactive"
                ? String(
                    ((message.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } })?.button_reply?.title ||
                      (message.interactive as { list_reply?: { title?: string } })?.list_reply?.title) ??
                      "",
                  )
                : `[O cliente enviou ${type === "audio" ? "um áudio" : type === "image" ? "uma imagem" : "uma mensagem que não é texto"}.]`;
        if (!from || !message.id || !text.trim()) continue;
        found.push({
          phoneNumberId,
          from,
          name: contacts.find((contact) => contact.wa_id === from)?.profile?.name || "",
          id: String(message.id),
          text: text.slice(0, 2000),
        });
      }
    }
  }
  return found;
}

export async function sendWhatsApp(input: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
}) {
  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(input.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to,
          type: "text",
          text: { body: input.body.slice(0, 4000), preview_url: true },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new DomainError("O WhatsApp não respondeu. Tente de novo.", 502);
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number };
    };
    // 131047: more than 24h since the customer's last message.
    throw new DomainError(
      data.error?.code === 131047
        ? "Passaram 24 horas desde a última mensagem do cliente: o WhatsApp só permite responder com um modelo aprovado."
        : `WhatsApp: ${data.error?.message || "não foi possível enviar."}`,
      response.status === 401 ? 400 : 502,
    );
  }
}

/** Confirms the phone number id and token before saving them. */
export async function checkWhatsApp(phoneNumberId: string, token: string) {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  ).catch(() => null);
  if (!response) throw new DomainError("A Meta não respondeu. Tente de novo.", 502);
  const data = (await response.json().catch(() => ({}))) as {
    display_phone_number?: string;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new DomainError(
      `A Meta recusou: ${data.error?.message || "confira o ID do número e o token."}`,
      400,
    );
  return data.display_phone_number || "";
}
