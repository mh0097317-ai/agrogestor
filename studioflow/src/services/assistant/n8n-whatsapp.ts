import { z } from "zod";
import {
  n8nWhatsAppReply,
  type N8nWhatsAppTurn,
} from "./n8n-whatsapp-contract";

const configuration = z
  .object({
    businessId: z.string().uuid(),
    professionalId: z.string().uuid().nullable(),
    token: z.string().min(32).max(256),
    basicUser: z.string().min(1).max(100),
    basicPassword: z.string().min(1).max(256),
  })
  .strict();
export type N8nWhatsAppConfiguration = z.infer<typeof configuration>;

// The destination is infrastructure configuration, never a model/customer URL.
const endpoint = "https://n8n.studioflowapp.tech/webhook/studioflow-whatsapp";
export function n8nWhatsAppConfiguration(
  businessId: string,
  professionalId?: string | null,
  raw = process.env.N8N_WHATSAPP,
) {
  let entries: N8nWhatsAppConfiguration[];
  try {
    entries = z
      .array(configuration)
      .max(20)
      .parse(JSON.parse(raw || "[]"));
  } catch {
    throw new Error("n8n-configuration-invalid");
  }
  const matches = entries.filter(
    (entry) =>
      entry.businessId === businessId &&
      entry.professionalId === (professionalId || null),
  );
  if (matches.length > 1) throw new Error("n8n-configuration-duplicate");
  return matches[0] || null;
}

export class N8nTurnError extends Error {
  constructor() {
    super("n8n-turn-unconfirmed");
  }
}

/** Exactly one attempt. A timeout/invalid reply never falls back to another model. */
export async function requestN8nTurn(
  turn: N8nWhatsAppTurn,
  config: N8nWhatsAppConfiguration,
  transport: typeof fetch = fetch,
  timeoutMs = 45_000,
) {
  if (
    turn.context.businessId !== config.businessId ||
    turn.context.professionalId !== config.professionalId
  )
    throw new N8nTurnError();
  try {
    const response = await transport(endpoint, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.basicUser}:${config.basicPassword}`).toString("base64")}`,
        "x-studioflow-n8n-token": config.token,
      },
      body: JSON.stringify(turn),
      // Leave room within the existing 90 second conversation lease.
      signal: AbortSignal.timeout(Math.min(45_000, Math.max(1, timeoutMs))),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      throw new N8nTurnError();
    const reader = response.body?.getReader();
    if (!reader) throw new N8nTurnError();
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 16_000) throw new N8nTurnError();
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    return n8nWhatsAppReply(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
      turn,
    );
  } catch {
    // No provider body, secret, URL credentials or customer text in diagnostics.
    throw new N8nTurnError();
  }
}
