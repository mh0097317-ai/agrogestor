import { DomainError } from "@/lib/availability";

/**
 * Evolution API (v2) do StudioFlow: um servidor só, uma instância por loja.
 * A loja conecta o próprio WhatsApp lendo um QR Code; ninguém mexe em chave.
 * Configuração só no servidor: EVOLUTION_API_URL e EVOLUTION_API_KEY.
 */
export const evolutionReady = () =>
  !!process.env.EVOLUTION_API_URL && !!process.env.EVOLUTION_API_KEY;

export type LinkState = "connecting" | "open" | "close";

const base = () => (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");

async function evo<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!evolutionReady())
    throw new DomainError("O WhatsApp por QR Code ainda não foi ligado no servidor do StudioFlow.", 503);
  const response = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.EVOLUTION_API_KEY || "",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  }).catch(() => null);
  if (!response) throw new DomainError("O servidor do WhatsApp não respondeu. Tente de novo.", 502);
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: unknown;
    response?: { message?: unknown };
  };
  if (!response.ok) {
    const detail = JSON.stringify(data.response?.message ?? data.message ?? "").slice(0, 200);
    const error = new DomainError(`WhatsApp: ${detail || response.status}`, response.status === 404 ? 404 : 502);
    throw error;
  }
  return data;
}

const events = ["MESSAGES_UPSERT", "CONNECTION_UPDATE"];

/** Instância da loja, já com o webhook que traz mensagens e o status. */
export async function createInstance(instance: string, webhookUrl?: string) {
  return evo<{ qrcode?: { base64?: string; pairingCode?: string | null } }>("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      ...(webhookUrl ? { webhook: { url: webhookUrl, byEvents: false, base64: true, events } } : {}),
    }),
  });
}
export async function setWebhook(instance: string, webhookUrl: string) {
  await evo(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: true, events },
    }),
  });
}

/** QR Code (imagem em base64) e código de pareamento para ligar o WhatsApp. */
export async function connectInstance(instance: string) {
  const data = await evo<{ base64?: string; pairingCode?: string | null; code?: string }>(
    `/instance/connect/${encodeURIComponent(instance)}`,
  );
  return {
    qr: typeof data.base64 === "string" && data.base64.startsWith("data:image/") ? data.base64 : "",
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
    { ownerJid?: string; owner?: string; profileName?: string; instance?: { owner?: string; profileName?: string } }[]
  >(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
  const item = Array.isArray(data) ? data[0] : undefined;
  const jid = item?.ownerJid || item?.owner || item?.instance?.owner || "";
  return {
    phone: jid.split("@")[0].replace(/\D/g, "").slice(0, 15),
    name: (item?.profileName || item?.instance?.profileName || "").slice(0, 120),
  };
}

export async function sendText(instance: string, number: string, text: string) {
  const digits = number.replace(/\D/g, "");
  if (!/^[0-9]{10,15}$/.test(digits)) throw new DomainError("Número de WhatsApp inválido.");
  await evo(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({ number: digits, text: text.slice(0, 4000) }),
  });
}

export async function removeInstance(instance: string) {
  await evo(`/instance/logout/${encodeURIComponent(instance)}`, { method: "DELETE" }).catch(() => undefined);
  await evo(`/instance/delete/${encodeURIComponent(instance)}`, { method: "DELETE" }).catch(() => undefined);
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
}
export interface EvolutionDelivery {
  instance: string;
  state?: LinkState;
  messages: EvolutionMessage[];
}

const asRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** A WhatsApp id → digits of the phone, or "" for groups, lists and ids without a number. */
export function jidPhone(jid: unknown) {
  const value = String(jid || "");
  if (!value.endsWith("@s.whatsapp.net") && !value.endsWith("@c.us")) return "";
  return value.split("@")[0].split(":")[0].replace(/\D/g, "");
}

/** What matters in one Evolution webhook call: the status and new texts from customers. */
export function parseEvolution(body: unknown): EvolutionDelivery {
  const root = asRecord(body);
  const event = String(root.event || "").toLowerCase().replace(/_/g, ".");
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
    if (key.fromMe === true) continue;
    // Newer WhatsApp ids (@lid) carry the real number in an alternate field.
    const from =
      jidPhone(key.remoteJid) ||
      jidPhone(key.remoteJidAlt) ||
      jidPhone(key.senderPn) ||
      jidPhone(data.sender);
    if (!from) continue;
    const message = asRecord(data.message);
    const extended = asRecord(message.extendedTextMessage);
    const audioMessage = asRecord(message.audioMessage);
    const text = String(message.conversation || extended.text || "").trim();
    const id = String(key.id || "");
    if (!id) continue;
    if (message.audioMessage !== undefined || String(data.messageType || "").includes("audio")) {
      const base64 = typeof message.base64 === "string" ? message.base64 : "";
      result.messages.push({
        id,
        from,
        name: String(data.pushName || "").slice(0, 80),
        text: base64 ? "" : "[O cliente enviou um áudio.]",
        audio: base64 ? { base64, mime: String(audioMessage.mimetype || "audio/ogg").split(";")[0] } : undefined,
      });
      continue;
    }
    if (!text) {
      const type = String(data.messageType || "mensagem");
      result.messages.push({
        id,
        from,
        name: String(data.pushName || "").slice(0, 80),
        text: type.includes("image")
          ? "[O cliente enviou uma foto.]"
          : type.includes("sticker") || type.includes("reaction")
            ? ""
            : "[O cliente enviou um arquivo.]",
      });
      continue;
    }
    result.messages.push({ id, from, name: String(data.pushName || "").slice(0, 80), text: text.slice(0, 4000) });
  }
  result.messages = result.messages.filter((message) => message.text || message.audio);
  return result;
}
