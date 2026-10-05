import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import type { Store, WhatsAppLink } from "@/types";
import { isDemo, mutateDemo, readDemo } from "../server-demo";
import { matchesHash, sha256 } from "../server-secrets";
import { demoWorkspaceSlug } from "../server-store";
import { sendWhatsApp } from "../assistant/whatsapp";
import {
  connectInstance,
  createInstance,
  evolutionReady,
  instanceOwner,
  instanceState,
  removeInstance,
  sendText,
  setWebhook,
  type LinkState,
} from "./evolution";

/**
 * WhatsApp da loja: conectado por QR Code na Evolution API do StudioFlow.
 * Também é por onde saem as mensagens automáticas (recepcionista e avisos).
 */
const editors = ["owner", "admin", "manager"];
const instanceName = (businessId: string) => `sf-${businessId}`;
const webhookUrl = (origin: string, businessId: string, token: string) =>
  `${origin}/api/evolution/${businessId}?token=${token}`;

async function editor() {
  const membership = await requireMembership();
  if (!editors.includes(membership.role))
    throw new DomainError("Só o dono ou a gerência conecta o WhatsApp da loja.", 403);
  return membership;
}

async function readRow(businessId: string) {
  const { data, error } = await createSupabaseAdmin()
    .from("whatsapp_links")
    .select("instance,status,phone,profile_name,webhook_token_hash")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  return data;
}

/** Status shown in the panel (no secrets). */
export async function readWhatsAppLink(businessId: string): Promise<WhatsAppLink | null> {
  const row = await readRow(businessId).catch(() => null);
  if (!row) return null;
  return { status: row.status as LinkState, phone: row.phone || "", profileName: row.profile_name || "" };
}

export interface LinkView extends WhatsAppLink {
  qr?: string;
  pairingCode?: string;
  /** false when the StudioFlow server has no Evolution configured yet. */
  ready: boolean;
}

/** Starts (or resumes) the connection and returns the QR Code to scan. */
export async function startWhatsAppLink(origin: string): Promise<LinkView> {
  if (isDemo()) {
    const slug = await demoWorkspaceSlug();
    const QR = await import("qrcode");
    const qr = await QR.toDataURL(`studioflow-demo:${slug}:${Date.now()}`, { margin: 1, width: 320 });
    await mutateDemo((store) => {
      store.whatsappLink = { status: "connecting", phone: "", profileName: "" };
    }, slug);
    return { status: "connecting", phone: "", profileName: "", qr, ready: true };
  }
  const { businessId } = await editor();
  if (!evolutionReady())
    return { status: "close", phone: "", profileName: "", ready: false };
  const admin = createSupabaseAdmin();
  const instance = instanceName(businessId);
  const row = await readRow(businessId);
  // A fresh token on every start: an old URL stops working.
  const token = randomBytes(24).toString("base64url");
  const hook = webhookUrl(origin, businessId, token);
  if (!row) {
    const { data: business } = await admin
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    const { error } = await admin.from("whatsapp_links").insert({
      business_id: businessId,
      tenant_id: business!.tenant_id,
      instance,
      status: "connecting",
      webhook_token_hash: `\\x${sha256(token).toString("hex")}`,
    });
    if (error) throw new DomainError("Não foi possível preparar a conexão.", 503);
    try {
      await createInstance(instance, hook);
    } catch (error) {
      // Already exists on the server (an earlier try): reuse it.
      if (!(error instanceof DomainError) || !/already|exist|in use/i.test(error.message)) {
        await admin.from("whatsapp_links").delete().eq("business_id", businessId);
        throw error;
      }
      await setWebhook(instance, hook);
    }
  } else {
    await admin
      .from("whatsapp_links")
      .update({ webhook_token_hash: `\\x${sha256(token).toString("hex")}`, status: "connecting" })
      .eq("business_id", businessId);
    await setWebhook(instance, hook).catch(async () => {
      await createInstance(instance, hook);
    });
  }
  const state = await instanceState(instance).catch(() => "close" as LinkState);
  if (state === "open") return { ...(await refreshLink(businessId)), ready: true };
  const { qr, pairingCode } = await connectInstance(instance);
  return { status: "connecting", phone: "", profileName: "", qr, pairingCode, ready: true };
}

/** Checks the server: once the QR was read, saves the number. */
async function refreshLink(businessId: string): Promise<WhatsAppLink> {
  const instance = instanceName(businessId);
  const state = await instanceState(instance).catch(() => "close" as LinkState);
  const patch: Record<string, unknown> = { status: state };
  if (state === "open") {
    const owner = await instanceOwner(instance).catch(() => ({ phone: "", name: "" }));
    patch.phone = owner.phone;
    patch.profile_name = owner.name;
    patch.connected_at = new Date().toISOString();
  }
  await createSupabaseAdmin().from("whatsapp_links").update(patch).eq("business_id", businessId);
  return {
    status: state,
    phone: (patch.phone as string) || "",
    profileName: (patch.profile_name as string) || "",
  };
}

export async function pollWhatsAppLink(): Promise<LinkView> {
  if (isDemo()) {
    const store = await readDemo(await demoWorkspaceSlug());
    return { ...(store.whatsappLink || { status: "close", phone: "", profileName: "" }), ready: true };
  }
  const { businessId } = await requireMembership();
  if (!(await readRow(businessId))) return { status: "close", phone: "", profileName: "", ready: evolutionReady() };
  return { ...(await refreshLink(businessId)), ready: true };
}

/** Demonstração: simula a leitura do QR Code. */
export async function simulateDemoScan() {
  if (!isDemo()) throw new DomainError("Só na demonstração.", 404);
  const slug = await demoWorkspaceSlug();
  return mutateDemo((store) => {
    store.whatsappLink = { status: "open", phone: "5511987654321", profileName: store.business.name };
    return store.whatsappLink;
  }, slug);
}

export async function unlinkWhatsApp() {
  if (isDemo()) {
    await mutateDemo((store) => {
      store.whatsappLink = null;
    }, await demoWorkspaceSlug());
    return { ok: true };
  }
  const { businessId } = await editor();
  const row = await readRow(businessId);
  if (row) await removeInstance(row.instance).catch(() => undefined);
  await createSupabaseAdmin().from("whatsapp_links").delete().eq("business_id", businessId);
  return { ok: true };
}

export const notifySchema = z.object({ notifyProfessionals: z.boolean() });
export async function updateNotify(input: z.infer<typeof notifySchema>) {
  if (isDemo())
    return mutateDemo((store) => {
      store.settings.notifyProfessionals = input.notifyProfessionals;
      return input;
    }, await demoWorkspaceSlug());
  const { businessId } = await editor();
  const { error } = await createSupabaseAdmin()
    .from("business_settings")
    .update({ notify_professionals: input.notifyProfessionals })
    .eq("business_id", businessId);
  if (error) throw new DomainError("Não foi possível salvar.", 503);
  return input;
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

/** Brazilian 10/11-digit numbers get the country code; others go as they are. */
export const withCountry = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 11 ? `55${digits}` : digits;
};

export type Sender = (to: string, body: string) => Promise<void>;

/**
 * How this business sends WhatsApp messages: its own number by QR Code
 * first, the Meta Cloud API if it set that up, or nothing.
 */
export async function shopSender(businessId: string): Promise<Sender | null> {
  if (isDemo()) return null;
  const row = await readRow(businessId).catch(() => null);
  if (row?.status === "open" && evolutionReady())
    return (to, body) => sendText(row.instance, withCountry(to), body);
  const { whatsappAccount } = await import("../assistant/conversations");
  const account = await whatsappAccount(businessId).catch(() => null);
  if (account)
    return (to, body) =>
      sendWhatsApp({ phoneNumberId: account.phoneNumberId, token: account.token, to: withCountry(to), body });
  return null;
}

/** Demonstração: o que "sairia" pelo WhatsApp fica numa caixa de saída. */
export function demoOutbox(store: Store, to: string, body: string, kind: string) {
  store.outbox = [
    ...(store.outbox || []),
    { to: to.replace(/\D/g, ""), body, kind, at: new Date().toISOString() },
  ].slice(-40);
}

/** Webhook check: the token in the URL must match the saved hash. */
export async function linkForWebhook(businessId: string, token: string | null) {
  const row = await readRow(businessId).catch(() => null);
  if (!row || !token) return null;
  const hash = Buffer.from(String(row.webhook_token_hash).replace(/^\\x/, ""), "hex");
  return matchesHash(token, hash) ? row : null;
}
export async function saveLinkState(businessId: string, state: LinkState) {
  const patch: Record<string, unknown> = { status: state };
  if (state === "open") {
    const owner = await instanceOwner(instanceName(businessId)).catch(() => null);
    if (owner?.phone) {
      patch.phone = owner.phone;
      patch.profile_name = owner.name;
    }
    patch.connected_at = new Date().toISOString();
  }
  await createSupabaseAdmin().from("whatsapp_links").update(patch).eq("business_id", businessId);
}
