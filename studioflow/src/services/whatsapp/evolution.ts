import { DomainError } from "@/lib/availability";
import QRCode from "qrcode";
import { evolutionCredential } from "../admin-vault";

/**
 * Evolution API (v2): instâncias independentes da loja e dos profissionais.
 * A loja conecta o próprio WhatsApp lendo um QR Code; ninguém mexe em chave.
 * Credenciais de servidor nas variáveis do ambiente ou no cofre da plataforma.
 */
export const evolutionReady = async () =>
  !!(await evolutionCredential().catch(() => null));

export type LinkState = "connecting" | "open" | "close";

async function evo<T>(path: string, init: RequestInit = {}): Promise<T> {
  const credential = await evolutionCredential();
  if (!credential)
    throw new DomainError(
      "O WhatsApp por QR Code ainda não foi ligado no servidor do StudioFlow.",
      503,
    );
  const response = await fetch(`${credential.url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: credential.key,
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
    redirect: "error",
  }).catch(() => null);
  if (!response)
    throw new DomainError(
      "O servidor do WhatsApp não respondeu. Tente de novo.",
      502,
    );
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: unknown;
    response?: { message?: unknown };
  };
  if (!response.ok) {
    // Provider errors can echo request headers, including webhook credentials.
    const alreadyExists = /already|exist|in use/i.test(
      JSON.stringify(data.response?.message ?? data.message ?? ""),
    );
    const error = new DomainError(
      alreadyExists
        ? "Esta instância já existe no servidor do WhatsApp."
        : `O servidor do WhatsApp recusou a solicitação (HTTP ${response.status}). Confira a conexão e tente novamente.`,
      response.status === 404 ? 404 : 502,
    );
    throw error;
  }
  return data;
}

const events = [
  "MESSAGES_UPSERT",
  "MESSAGES_DELETE",
  "CHATS_DELETE",
  "CONNECTION_UPDATE",
];

/** Instância da loja, já com o webhook que traz mensagens e o status. */
export async function createInstance(
  instance: string,
  webhookUrl?: string,
  webhookToken?: string,
) {
  return evo<{ qrcode?: { base64?: string; pairingCode?: string | null } }>(
    "/instance/create",
    {
      method: "POST",
      body: JSON.stringify({
        instanceName: instance,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        ...(webhookUrl
          ? {
              webhook: {
                enabled: true,
                url: webhookUrl,
                byEvents: false,
                base64: true,
                events,
                ...(webhookToken
                  ? { headers: { "x-studioflow-webhook-token": webhookToken } }
                  : {}),
              },
            }
          : {}),
      }),
    },
  );
}
export async function setWebhook(
  instance: string,
  webhookUrl: string,
  webhookToken?: string,
) {
  await evo(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events,
        ...(webhookToken
          ? { headers: { "x-studioflow-webhook-token": webhookToken } }
          : {}),
      },
    }),
  });
}

/** QR Code (imagem em base64) e código de pareamento para ligar o WhatsApp. */
export async function connectInstance(instance: string) {
  const data = await evo<{
    base64?: string;
    pairingCode?: string | null;
    code?: string;
  }>(`/instance/connect/${encodeURIComponent(instance)}`);
  return {
    qr:
      typeof data.base64 === "string" && data.base64.startsWith("data:image/")
        ? data.base64
        : typeof data.code === "string" && data.code
          ? await QRCode.toDataURL(data.code, { width: 320, margin: 2 })
          : "",
    pairingCode: data.pairingCode || "",
  };
}

export async function instanceState(instance: string): Promise<LinkState> {
  const data = await evo<{ instance?: { state?: string } }>(
    `/instance/connectionState/${encodeURIComponent(instance)}`,
  );
  return normalState(data.instance?.state);
}
export const normalState = (state?: string): LinkState =>
  state === "open" ? "open" : state === "connecting" ? "connecting" : "close";

/** Número e nome do WhatsApp ligado à instância. */
export async function instanceOwner(instance: string) {
  const data = await evo<
    {
      ownerJid?: string;
      owner?: string;
      profileName?: string;
      name?: string;
      instance?: {
        instanceName?: string;
        owner?: string;
        profileName?: string;
      };
    }[]
  >(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
  const item = Array.isArray(data)
    ? data.find(
        (row) => (row.name || row.instance?.instanceName) === instance,
      ) ||
      (data.length === 1 && !data[0].name && !data[0].instance?.instanceName
        ? data[0]
        : undefined)
    : undefined;
  const jid = item?.ownerJid || item?.owner || item?.instance?.owner || "";
  return {
    phone: jid.split("@")[0].replace(/\D/g, "").slice(0, 15),
    name: (item?.profileName || item?.instance?.profileName || "").slice(
      0,
      120,
    ),
  };
}

export async function sendText(
  instance: string,
  number: string,
  text: string,
  role: "staff" | "assistant" = "staff",
) {
  const digits = number.replace(/\D/g, "");
  if (!/^[0-9]{10,15}$/.test(digits))
    throw new DomainError("Número de WhatsApp inválido.");
  const sent = await evo<{ key?: { id?: string } }>(
    `/message/sendText/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      body: JSON.stringify({ number: digits, text: text.slice(0, 4000) }),
    },
  );
  if (sent.key?.id) {
    const { recordOutgoing } = await import("./history");
    await recordOutgoing(instance, digits, text, sent.key.id, role);
  }
  return sent.key?.id;
}

/** Stored address book of this instance; no messages or groups are imported. */
export async function findContacts(instance: string, page = 1) {
  const data = await evo<unknown>(
    `/chat/findContacts/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      body: JSON.stringify({ where: {}, offset: 500, page }),
    },
  );
  if (!Array.isArray(data))
    throw new DomainError(
      "O servidor retornou uma lista de contatos inválida.",
      502,
    );
  return data;
}

export async function findChats(instance: string) {
  const data = await evo<unknown>(
    `/chat/findChats/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      body: "{}",
    },
  );
  if (!Array.isArray(data))
    throw new DomainError("Histórico do WhatsApp indisponível.", 502);
  return data as {
    remoteJid?: string;
    lastMessage?: {
      key?: { remoteJidAlt?: string; senderPn?: string };
      [key: string]: unknown;
    };
  }[];
}

export async function findMessages(
  instance: string,
  key: { id?: string; remoteJid?: string },
  offset = 500,
) {
  const data = await evo<{ messages?: { records?: unknown[] } }>(
    `/chat/findMessages/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      body: JSON.stringify({
        where: {
          key: {
            ...key,
            ...(key.remoteJid ? { remoteJidAlt: key.remoteJid } : {}),
          },
        },
        offset,
        page: 1,
      }),
    },
  );
  if (!Array.isArray(data.messages?.records))
    throw new DomainError("Histórico do WhatsApp indisponível.", 502);
  return data.messages.records;
}

/** Authenticated download from the trusted instance, never an inbound media URL. */
export async function evolutionAudio(
  instance: string,
  id: string,
  inline?: string,
  mime = "audio/ogg",
) {
  const media = inline
    ? { base64: inline, mimetype: mime }
    : await evo<{ base64?: string; mimetype?: string }>(
        `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`,
        {
          method: "POST",
          body: JSON.stringify({
            message: { key: { id } },
            convertToMp4: false,
          }),
        },
      );
  const encoded = (media.base64 || "").replace(/^data:[^,]+,/, "");
  if (
    !encoded ||
    encoded.length > Math.ceil((16 * 1024 * 1024 * 4) / 3) ||
    !/^[A-Za-z0-9+/=\r\n]+$/.test(encoded)
  )
    throw new Error("audio-unavailable");
  const bytes = Buffer.from(encoded, "base64");
  return {
    audio: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
    mime: (media.mimetype || mime).split(";")[0],
  };
}

export async function removeInstance(instance: string) {
  await evo(`/instance/logout/${encodeURIComponent(instance)}`, {
    method: "DELETE",
  }).catch(() => undefined);
  await evo(`/instance/delete/${encodeURIComponent(instance)}`, {
    method: "DELETE",
  }).catch((error) => {
    if (!(error instanceof DomainError) || error.status !== 404) throw error;
  });
}

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

export interface EvolutionMessage {
  id: string;
  /** Who wrote, with country code (digits); replies go to this number. */
  from: string;
  name: string;
  text: string;
  /** Voice note sent inline (base64) when the webhook has base64 on. */
  audio?: { base64: string; mime: string };
  audioId?: string;
  fromMe?: boolean;
  createdAt?: string;
}
export interface EvolutionDelivery {
  instance: string;
  state?: LinkState;
  messages: EvolutionMessage[];
}

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const contentWrappers = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
] as const;

/** Unwrap delivery envelopes, never protocol edits, reactions or other controls. */
function messageContent(value: unknown) {
  let content = asRecord(value);
  for (let depth = 0; depth < 5; depth++) {
    const wrapper = contentWrappers.find((name) => content[name] != null);
    if (!wrapper) break;
    content = asRecord(asRecord(content[wrapper]).message);
  }
  return content;
}

const messageText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const hasMedia = (content: Record<string, unknown>, name: string) =>
  content[name] !== null &&
  typeof content[name] === "object" &&
  !Array.isArray(content[name]);

/** A WhatsApp id → digits of the phone, or "" for groups, lists and ids without a number. */
export function jidPhone(jid: unknown) {
  const value = String(jid || "");
  if (!value.endsWith("@s.whatsapp.net") && !value.endsWith("@c.us")) return "";
  return value.split("@")[0].split(":")[0].replace(/\D/g, "");
}

/** Authenticated deletion events; opaque LIDs never become phone numbers. */
export function parseEvolutionChanges(body: unknown) {
  const root = asRecord(body);
  const event = String(root.event || "")
    .toLowerCase()
    .replace(/_/g, ".");
  const values = Array.isArray(root.data) ? root.data : [root.data];
  const messages: string[] = [],
    phones: string[] = [];
  for (const value of values) {
    if (event === "messages.delete") {
      const data = asRecord(value),
        key = asRecord(data.key || data);
      if (typeof key.id === "string" && key.id) messages.push(key.id);
    }
    if (event === "chats.delete") {
      const phone = jidPhone(
        typeof value === "string" ? value : asRecord(value).remoteJid,
      );
      if (phone) {
        const local = phone.startsWith("55") ? phone.slice(2) : phone;
        phones.push(
          local.length === 10 && /[6-9]/.test(local[2])
            ? `${local.slice(0, 2)}9${local.slice(2)}`
            : local,
        );
      }
    }
  }
  return { messages, phones };
}

/** What matters in one Evolution webhook call: the status and new texts from customers. */
export function parseEvolution(
  body: unknown,
  includeOutgoing = false,
): EvolutionDelivery {
  const root = asRecord(body);
  const event = String(root.event || "")
    .toLowerCase()
    .replace(/_/g, ".");
  const instance = String(root.instance || "");
  const result: EvolutionDelivery = { instance, messages: [] };
  if (event === "connection.update") {
    result.state = normalState(String(asRecord(root.data).state || ""));
    return result;
  }
  if (event !== "messages.upsert") return result;
  const items = Array.isArray(root.data) ? root.data : [root.data];
  for (const raw of items) {
    const data = asRecord(raw);
    const key = asRecord(data.key);
    if (
      (key.fromMe === true && !includeOutgoing) ||
      String(key.remoteJid || "").endsWith("@g.us") ||
      String(key.remoteJid || "").includes("@broadcast")
    )
      continue;
    // Newer WhatsApp ids (@lid) carry the real number in an alternate field.
    const from =
      jidPhone(key.remoteJid) ||
      jidPhone(key.remoteJidAlt) ||
      jidPhone(key.senderPn) ||
      (key.fromMe !== true ? jidPhone(data.sender) : "");
    if (!from) continue;
    const envelope = asRecord(data.message);
    const message = messageContent(envelope);
    const extended = asRecord(message.extendedTextMessage);
    const audioMessage = asRecord(message.audioMessage);
    const text =
      messageText(message.conversation) || messageText(extended.text);
    const id = String(key.id || "");
    if (!id) continue;
    const timestamp = Number(data.messageTimestamp);
    const meta = {
      ...(key.fromMe === true ? { fromMe: true } : {}),
      ...(Number.isFinite(timestamp) &&
      timestamp > 0 &&
      timestamp <= 8_640_000_000_000
        ? { createdAt: new Date(timestamp * 1000).toISOString() }
        : {}),
    };
    if (hasMedia(message, "audioMessage")) {
      const base64 =
        messageText(message.base64) || messageText(envelope.base64);
      result.messages.push({
        ...meta,
        id,
        from,
        name: String(data.pushName || "").slice(0, 80),
        text: base64 ? "" : "[O cliente enviou um áudio.]",
        audioId: id,
        audio: base64
          ? {
              base64,
              mime: String(audioMessage.mimetype || "audio/ogg").split(";")[0],
            }
          : undefined,
      });
      continue;
    }
    if (!text) {
      // An upsert can contain only protocol/context metadata. It is not a file
      // and must not enter the conversation or trigger a paid AI response.
      const mediaType = [
        "imageMessage",
        "documentMessage",
        "videoMessage",
      ].find((type) => hasMedia(message, type));
      if (!mediaType) continue;
      const caption = messageText(asRecord(message[mediaType]).caption);
      const description =
        mediaType === "imageMessage"
          ? "[O cliente enviou uma foto.]"
          : "[O cliente enviou um arquivo.]";
      result.messages.push({
        ...meta,
        id,
        from,
        name: String(data.pushName || "").slice(0, 80),
        text: `${description}${caption ? `\n${caption}` : ""}`.slice(0, 4000),
      });
      continue;
    }
    result.messages.push({
      ...meta,
      id,
      from,
      name: String(data.pushName || "").slice(0, 80),
      text: text.slice(0, 4000),
    });
  }
  result.messages = result.messages.filter(
    (message) => message.text || message.audio,
  );
  return result;
}
