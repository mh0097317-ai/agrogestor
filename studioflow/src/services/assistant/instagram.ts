import { DomainError } from "@/lib/availability";

/** Instagram API com login do Instagram (mensagens do Direct). */
export const instagramVersion = "v23.0";
const base = `https://graph.instagram.com/${instagramVersion}`;

export interface InstagramMessage {
  /** Conta da casa que recebeu. */
  recipient: string;
  /** Quem escreveu (id do Instagram dentro desta conta). */
  from: string;
  id: string;
  text: string;
  /** Link temporário do áudio, quando é uma mensagem de voz. */
  audioUrl?: string;
}

/** Mensagens recebidas de um webhook do Instagram; ecos da própria conta ficam de fora. */
export function inboundInstagram(body: unknown, ownId: string): InstagramMessage[] {
  const found: InstagramMessage[] = [];
  const entries = (body as { object?: string; entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return found;
  for (const entry of entries) {
    const events = (entry as { messaging?: unknown[] })?.messaging;
    if (!Array.isArray(events)) continue;
    for (const event of events as Record<string, unknown>[]) {
      const sender = String((event.sender as { id?: string })?.id || "");
      const recipient = String((event.recipient as { id?: string })?.id || "");
      const message = event.message as
        | {
            mid?: string;
            text?: string;
            is_echo?: boolean;
            attachments?: { type?: string; payload?: { url?: string } }[];
          }
        | undefined;
      if (!message?.mid || message.is_echo || !sender || sender === ownId) continue;
      const attachment = message.attachments?.[0];
      const audio = attachment?.type === "audio" ? attachment.payload?.url || "" : "";
      const text =
        message.text ||
        (attachment
          ? attachment.type === "audio"
            ? "[O cliente enviou um áudio.]"
            : attachment.type === "image"
              ? "[O cliente enviou uma imagem.]"
              : "[O cliente enviou uma mensagem que não é texto.]"
          : "");
      if (!text.trim()) continue;
      found.push({
        recipient,
        from: sender,
        id: message.mid,
        text: text.slice(0, 2000),
        ...(audio ? { audioUrl: audio } : {}),
      });
    }
  }
  return found;
}

export async function sendInstagram(input: {
  igUserId: string;
  token: string;
  to: string;
  body: string;
}) {
  let response: Response;
  try {
    response = await fetch(`${base}/${encodeURIComponent(input.igUserId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: input.to },
        message: { text: input.body.slice(0, 1000) },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DomainError("O Instagram não respondeu. Tente de novo.", 502);
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; error_subcode?: number };
    };
    throw new DomainError(
      data.error?.error_subcode === 2534022 || data.error?.code === 10
        ? "Passaram 24 horas desde a última mensagem do cliente: o Instagram só permite responder dentro dessa janela."
        : `Instagram: ${data.error?.message || "não foi possível enviar."}`,
      response.status === 401 ? 400 : 502,
    );
  }
}

/** Confere o token e devolve a conta profissional ligada a ele. */
export async function checkInstagram(token: string) {
  const response = await fetch(`${base}/me?fields=user_id,username`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response) throw new DomainError("A Meta não respondeu. Tente de novo.", 502);
  const data = (await response.json().catch(() => ({}))) as {
    user_id?: string | number;
    username?: string;
    error?: { message?: string };
  };
  if (!response.ok || !data.user_id)
    throw new DomainError(
      `A Meta recusou: ${data.error?.message || "confira o token de acesso do Instagram."}`,
      400,
    );
  return { igUserId: String(data.user_id), username: data.username || "" };
}
