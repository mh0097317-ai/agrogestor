import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { openVault, sealVault } from "./server-secrets";
import { isDemo } from "./server-demo";

export const aiKeySchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  model: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._:-]+$/),
  key: z.string().trim().min(20).max(1000),
});
export interface AiVaultView {
  configured: boolean;
  provider?: string;
  model?: string;
  hint?: string;
  updatedAt?: string;
}
const scope = (id: string, provider: string) => `business:${id}:ai:${provider}`;
export async function aiVaultView(businessId: string): Promise<AiVaultView> {
  if (isDemo()) return { configured: false };
  const { data, error } = await createSupabaseAdmin()
    .from("business_ai_credentials")
    .select("provider,model,key_hint,updated_at")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new DomainError("Não foi possível consultar o cofre.", 503);
  return data
    ? {
        configured: true,
        provider: data.provider,
        model: data.model,
        hint: data.key_hint,
        updatedAt: data.updated_at,
      }
    : { configured: false };
}
export async function saveAiKey(
  businessId: string,
  actor: string | null,
  input: z.infer<typeof aiKeySchema> | null,
) {
  if (isDemo())
    throw new DomainError(
      "Chaves reais são cadastradas somente no ambiente publicado.",
      409,
    );
  if (input) {
    try {
      if (input.provider === "anthropic")
        await new Anthropic({
          apiKey: input.key,
          authToken: null,
          timeout: 15000,
          maxRetries: 0,
        }).models.retrieve(input.model);
      else {
        const response = await fetch(
          `https://api.openai.com/v1/models/${encodeURIComponent(input.model)}`,
          {
            headers: { Authorization: `Bearer ${input.key}` },
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok) throw new Error();
      }
    } catch {
      throw new DomainError(
        "A chave ou o modelo não puderam ser validados. Confira a credencial e o acesso ao modelo no provedor.",
        409,
      );
    }
  }
  const { error } = await createSupabaseAdmin().rpc("platform_save_ai_key", {
    p_business_id: businessId,
    p_actor: actor,
    p_provider: input?.provider ?? null,
    p_model: input?.model ?? null,
    p_secret: input
      ? sealVault(input.key, scope(businessId, input.provider))
      : null,
    p_hint: input?.key.slice(-4) ?? null,
  });
  if (error)
    throw new DomainError("Não foi possível salvar a credencial.", 503);
  return aiVaultView(businessId);
}
export async function businessAiCredential(businessId: string) {
  if (isDemo()) return null;
  const { data, error } = await createSupabaseAdmin()
    .from("business_ai_credentials")
    .select("provider,model,secret_enc")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error)
    throw new DomainError(
      "A configuração da recepcionista está indisponível.",
      503,
    );
  return data
    ? {
        provider: data.provider as "anthropic" | "openai",
        model: data.model as string,
        key: openVault(data.secret_enc, scope(businessId, data.provider)),
      }
    : null;
}

/** Reuses the encrypted key server-side; no credential comes back to the browser. */
export async function changeAiModel(
  businessId: string,
  actor: string | null,
  model: string,
) {
  const current = await businessAiCredential(businessId);
  if (!current)
    throw new DomainError("Cadastre a chave deste cliente primeiro.", 409);
  return saveAiKey(businessId, actor, { ...current, model });
}
export async function aiConfigured(businessId: string) {
  return (
    (await aiVaultView(businessId)).configured ||
    !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
  );
}

export const evolutionConfigSchema = z.object({
  url: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(
        u.hostname,
      )
    );
  }, "Use o endereço HTTPS público do seu servidor Evolution API."),
  key: z.string().trim().min(8).max(1000),
});
export async function evolutionCredential() {
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY)
    return {
      url: process.env.EVOLUTION_API_URL.replace(/\/$/, ""),
      key: process.env.EVOLUTION_API_KEY,
      source: "environment",
    };
  if (isDemo()) return null;
  const { data, error } = await createSupabaseAdmin()
    .from("platform_integrations")
    .select("endpoint,secret_enc")
    .eq("id", "evolution")
    .maybeSingle();
  if (error)
    throw new DomainError(
      "Não foi possível consultar a conexão do WhatsApp.",
      503,
    );
  return data
    ? {
        url: data.endpoint as string,
        key: openVault(data.secret_enc, "platform:evolution"),
        source: "vault",
      }
    : null;
}
export async function evolutionConfigView() {
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY)
    return {
      configured: true,
      url: process.env.EVOLUTION_API_URL,
      source: "environment",
      hint: process.env.EVOLUTION_API_KEY.slice(-4),
    };
  if (isDemo())
    return { configured: false, url: "", source: "vault", hint: "" };
  const { data, error } = await createSupabaseAdmin()
    .from("platform_integrations")
    .select("endpoint,key_hint,updated_at")
    .eq("id", "evolution")
    .maybeSingle();
  if (error)
    throw new DomainError("Não foi possível consultar a Evolution API.", 503);
  return {
    configured: !!data,
    url: data?.endpoint || "",
    hint: data?.key_hint || "",
    source: "vault",
  };
}
export async function saveEvolution(
  actor: string | null,
  input: z.infer<typeof evolutionConfigSchema>,
) {
  if (isDemo())
    throw new DomainError("Configure o servidor no ambiente publicado.", 409);
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY)
    throw new DomainError(
      "Esta conexão é administrada nas variáveis da Vercel. Atualize a configuração naquele ambiente.",
      409,
    );
  // Authentication check only: no instance, phone or outbound message is created.
  const response = await fetch(
    `${input.url.replace(/\/$/, "")}/instance/fetchInstances`,
    {
      headers: { apikey: input.key },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    },
  ).catch(() => null);
  if (!response?.ok)
    throw new DomainError(
      "A Evolution API não confirmou a conexão. Confira endereço e chave.",
      502,
    );
  const { error } = await createSupabaseAdmin().rpc("platform_save_evolution", {
    p_actor: actor,
    p_endpoint: input.url.replace(/\/$/, ""),
    p_secret: sealVault(input.key, "platform:evolution"),
    p_hint: input.key.slice(-4),
  });
  if (error)
    throw new DomainError("Não foi possível salvar a Evolution API.", 503);
  return evolutionConfigView();
}
