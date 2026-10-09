import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { assertProfessionalChannel } from "@/lib/professional-scope";
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
const instanceName = (businessId: string, professionalId?: string) =>
  professionalId ? `sf-pro-${professionalId}` : `sf-${businessId}`;
const linkTable = (professionalId?: string) =>
  professionalId ? "professional_whatsapp_links" : "whatsapp_links";
function scoped(professionalId?: string) {
  const query = createSupabaseAdmin().from(linkTable(professionalId));
  return query;
}
const webhookUrl = (
  origin: string,
  businessId: string,
  professionalId?: string,
) =>
  `${origin}/api/evolution/${businessId}${professionalId ? `?professionalId=${professionalId}` : ""}`;

async function editor(professionalId?: string) {
  const membership = await requireMembership();
  assertProfessionalChannel(membership, professionalId);
  if (!editors.includes(membership.role) && membership.role !== "professional")
    throw new DomainError(
      "Só o dono ou a gerência conecta o WhatsApp da loja.",
      403,
    );
  return membership;
}

async function readRow(businessId: string, professionalId?: string) {
  let query = scoped(professionalId)
    .select("instance,status,phone,profile_name,webhook_token_hash")
    .eq("business_id", businessId);
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data, error } = await query.maybeSingle();
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error)
    throw new DomainError("Não foi possível consultar o WhatsApp.", 503);
  return data;
}

/** Status shown in the panel (no secrets). */
export async function readWhatsAppLink(
  businessId: string,
): Promise<WhatsAppLink | null> {
  const row = await readRow(businessId).catch(() => null);
  if (!row) return null;
  return {
    status: row.status as LinkState,
    phone: row.phone || "",
    profileName: row.profile_name || "",
  };
}

export interface LinkView extends WhatsAppLink {
  qr?: string;
  pairingCode?: string;
  /** false when the StudioFlow server has no Evolution configured yet. */
  ready: boolean;
}

/** Starts (or resumes) the connection and returns the QR Code to scan. */
export async function startWhatsAppLink(
  origin: string,
  professionalId?: string,
): Promise<LinkView> {
  if (professionalId) {
    if (isDemo())
      throw new DomainError(
        "Conexões dos profissionais são feitas no ambiente publicado.",
        409,
      );
    const { businessId } = await editor(professionalId);
    const { data } = await createSupabaseAdmin()
      .from("professionals")
      .select("id")
      .eq("business_id", businessId)
      .eq("id", professionalId)
      .eq("active", true)
      .maybeSingle();
    if (!data)
      throw new DomainError(
        "Profissional não encontrado neste estabelecimento.",
        404,
      );
    const { requireModule } = await import("../modules-guard");
    await requireModule("recepcionista");
  }
  if (isDemo()) {
    const slug = await demoWorkspaceSlug();
    const QR = await import("qrcode");
    const qr = await QR.toDataURL(`studioflow-demo:${slug}:${Date.now()}`, {
      margin: 1,
      width: 320,
    });
    await mutateDemo((store) => {
      store.whatsappLink = { status: "connecting", phone: "", profileName: "" };
    }, slug);
    return {
      status: "connecting",
      phone: "",
      profileName: "",
      qr,
      ready: true,
    };
  }
  const { businessId } = await editor(professionalId);
  if (!(await evolutionReady()))
    return { status: "close", phone: "", profileName: "", ready: false };
  const admin = createSupabaseAdmin();
  const instance = instanceName(businessId, professionalId);
  const row = await readRow(businessId, professionalId);
  // A fresh token on every start: an old URL stops working.
  const token = randomBytes(24).toString("base64url");
  const hook = webhookUrl(origin, businessId, professionalId);
  if (!row) {
    const { data: business } = await admin
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    const { error } = await admin.from(linkTable(professionalId)).insert({
      ...(professionalId ? { professional_id: professionalId } : {}),
      business_id: businessId,
      tenant_id: business!.tenant_id,
      instance,
      status: "connecting",
      webhook_token_hash: `\\x${sha256(token).toString("hex")}`,
    });
    if (error)
      throw new DomainError("Não foi possível preparar a conexão.", 503);
    try {
      await createInstance(instance, hook, token);
    } catch (error) {
      // Already exists on the server (an earlier try): reuse it.
      if (
        !(error instanceof DomainError) ||
        !/already|exist|in use/i.test(error.message)
      ) {
        let cleanup = admin
          .from(linkTable(professionalId))
          .delete()
          .eq("business_id", businessId);
        if (professionalId)
          cleanup = cleanup.eq("professional_id", professionalId);
        await cleanup;
        throw error;
      }
      await setWebhook(instance, hook, token);
    }
  } else {
    let update = admin
      .from(linkTable(professionalId))
      .update({
        webhook_token_hash: `\\x${sha256(token).toString("hex")}`,
        status: "connecting",
      })
      .eq("business_id", businessId);
    if (professionalId) update = update.eq("professional_id", professionalId);
    const { error: updateError } = await update;
    if (updateError)
      throw new DomainError("Não foi possível atualizar a conexão.", 503);
    await setWebhook(instance, hook, token).catch(async () => {
      await createInstance(instance, hook, token);
    });
  }
  const state = await instanceState(instance).catch(() => "close" as LinkState);
  if (state === "open")
    return { ...(await refreshLink(businessId, professionalId)), ready: true };
  const { qr, pairingCode } = await connectInstance(instance);
  return {
    status: "connecting",
    phone: "",
    profileName: "",
    qr,
    pairingCode,
    ready: true,
  };
}

/** Checks the server: once the QR was read, saves the number. */
async function refreshLink(
  businessId: string,
  professionalId?: string,
): Promise<WhatsAppLink> {
  const instance = instanceName(businessId, professionalId);
  const state = await instanceState(instance);
  const patch: Record<string, unknown> = { status: state };
  if (state === "open") {
    const previous = await readRow(businessId, professionalId);
    const owner = await instanceOwner(instance).catch(() => ({
      phone: previous?.phone || "",
      name: previous?.profile_name || "",
    }));
    patch.phone = owner.phone;
    patch.profile_name = owner.name;
    patch.connected_at = new Date().toISOString();
  }
  let update = scoped(professionalId)
    .update(patch)
    .eq("business_id", businessId);
  if (professionalId) update = update.eq("professional_id", professionalId);
  const { error } = await update;
  if (error)
    throw new DomainError(
      "Não foi possível atualizar o status do WhatsApp.",
      503,
    );
  return {
    status: state,
    phone: (patch.phone as string) || "",
    profileName: (patch.profile_name as string) || "",
  };
}

export async function pollWhatsAppLink(
  professionalId?: string,
): Promise<LinkView> {
  if (isDemo()) {
    const store = await readDemo(await demoWorkspaceSlug());
    return {
      ...(store.whatsappLink || {
        status: "close",
        phone: "",
        profileName: "",
      }),
      ready: true,
    };
  }
  const membership = await requireMembership();
  assertProfessionalChannel(membership, professionalId);
  const { businessId } = membership;
  if (!(await readRow(businessId, professionalId)))
    return {
      status: "close",
      phone: "",
      profileName: "",
      ready: await evolutionReady(),
    };
  return { ...(await refreshLink(businessId, professionalId)), ready: true };
}

/** Demonstração: simula a leitura do QR Code. */
export async function simulateDemoScan() {
  if (!isDemo()) throw new DomainError("Só na demonstração.", 404);
  const slug = await demoWorkspaceSlug();
  return mutateDemo((store) => {
    store.whatsappLink = {
      status: "open",
      phone: "5511987654321",
      profileName: store.business.name,
    };
    return store.whatsappLink;
  }, slug);
}

export async function unlinkWhatsApp(professionalId?: string) {
  if (isDemo()) {
    await mutateDemo(
      (store) => {
        store.whatsappLink = null;
      },
      await demoWorkspaceSlug(),
    );
    return { ok: true };
  }
  const { businessId } = await editor(professionalId);
  const row = await readRow(businessId, professionalId);
  if (row) await removeInstance(row.instance);
  let remove = scoped(professionalId).delete().eq("business_id", businessId);
  if (professionalId) remove = remove.eq("professional_id", professionalId);
  const { error } = await remove;
  if (error) throw new DomainError("Não foi possível desconectar.", 503);
  return { ok: true };
}

export const notifySchema = z
  .object({
    notifyProfessionals: z.boolean().optional(),
    notifications: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.notifyProfessionals !== undefined ||
      input.notifications !== undefined,
    "Escolha qual aviso alterar.",
  );
export async function updateNotify(input: z.infer<typeof notifySchema>) {
  if (isDemo())
    return mutateDemo(
      (store) => {
        if (input.notifyProfessionals !== undefined)
          store.settings.notifyProfessionals = input.notifyProfessionals;
        if (input.notifications !== undefined)
          store.settings.notifications = input.notifications;
        return input;
      },
      await demoWorkspaceSlug(),
    );
  const { businessId } = await editor();
  const { error } = await createSupabaseAdmin()
    .from("business_settings")
    .update({
      ...(input.notifyProfessionals !== undefined
        ? { notify_professionals: input.notifyProfessionals }
        : {}),
      ...(input.notifications !== undefined
        ? { notifications: input.notifications }
        : {}),
    })
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
  return !phone.trim().startsWith("+") && digits.length <= 11
    ? `55${digits}`
    : digits;
};

export type Sender = (to: string, body: string) => Promise<string | void>;

/**
 * How this business sends WhatsApp messages: its own number by QR Code
 * first, the Meta Cloud API if it set that up, or nothing.
 */
export async function shopSender(
  businessId: string,
  role: "staff" | "assistant" = "staff",
): Promise<Sender | null> {
  if (isDemo()) return null;
  const row = await readRow(businessId).catch(() => null);
  if (row?.status === "open" && (await evolutionReady()))
    return (to, body) => sendText(row.instance, withCountry(to), body, role);
  const { whatsappAccount } = await import("../assistant/conversations");
  const account = await whatsappAccount(businessId).catch(() => null);
  if (account)
    return (to, body) =>
      sendWhatsApp({
        phoneNumberId: account.phoneNumberId,
        token: account.token,
        to: withCountry(to),
        body,
      });
  return null;
}

/** Demonstração: o que "sairia" pelo WhatsApp fica numa caixa de saída. */
export function demoOutbox(
  store: Store,
  to: string,
  body: string,
  kind: string,
) {
  store.outbox = [
    ...(store.outbox || []),
    { to: to.replace(/\D/g, ""), body, kind, at: new Date().toISOString() },
  ].slice(-40);
}

/** Webhook check: the token in the URL must match the saved hash. */
export async function linkForWebhook(
  businessId: string,
  token: string | null,
  professionalId?: string,
) {
  const row = await readRow(businessId, professionalId).catch(() => null);
  if (!row || !token) return null;
  const hash = Buffer.from(
    String(row.webhook_token_hash).replace(/^\\x/, ""),
    "hex",
  );
  return matchesHash(token, hash) ? row : null;
}
export async function saveLinkState(
  businessId: string,
  state: LinkState,
  professionalId?: string,
) {
  const patch: Record<string, unknown> = { status: state };
  if (state === "open") {
    const owner = await instanceOwner(
      instanceName(businessId, professionalId),
    ).catch(() => null);
    if (owner?.phone) {
      patch.phone = owner.phone;
      patch.profile_name = owner.name;
    }
    patch.connected_at = new Date().toISOString();
  }
  let update = scoped(professionalId)
    .update(patch)
    .eq("business_id", businessId);
  if (professionalId) update = update.eq("professional_id", professionalId);
  const { error } = await update;
  if (error)
    throw new DomainError(
      "Não foi possível atualizar o status do WhatsApp.",
      503,
    );
}

export async function readProfessionalLinks(
  businessId: string,
  professionalId?: string,
) {
  if (isDemo()) return [];
  let query = createSupabaseAdmin()
    .from("professional_whatsapp_links")
    .select("professional_id,status,phone,profile_name")
    .eq("business_id", businessId);
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data, error } = await query;
  if (error)
    throw new DomainError(
      "Não foi possível consultar as conexões dos profissionais.",
      503,
    );
  return (data || []).map((row) => ({
    professionalId: row.professional_id as string,
    status: row.status as LinkState,
    phone: row.phone as string,
    profileName: row.profile_name as string,
  }));
}
export async function conversationSender(
  businessId: string,
  professionalId?: string | null,
  role: "staff" | "assistant" = "staff",
): Promise<Sender | null> {
  if (!professionalId) return shopSender(businessId, role);
  const row = await readRow(businessId, professionalId);
  return row?.status === "open" && (await evolutionReady())
    ? (to, body) => sendText(row.instance, withCountry(to), body, role)
    : null;
}
