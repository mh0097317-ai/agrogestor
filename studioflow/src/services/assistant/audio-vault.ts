import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { openVault, sealVault } from "../server-secrets";
import { isDemo } from "../server-demo";

export const audioKeySchema = z.object({
  provider: z.enum(["groq", "openai"]),
  key: z.string().trim().min(20).max(1000),
});
export interface AudioVaultView {
  configured: boolean;
  provider?: string;
  hint?: string;
  model?: string;
}
const config = {
  groq: {
    base: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
  },
  openai: { base: "https://api.openai.com/v1", model: "whisper-1" },
};
const scope = (id: string) => `business:${id}:audio`;
export async function audioVaultView(
  businessId: string,
): Promise<AudioVaultView> {
  if (isDemo()) return { configured: false };
  const { data, error } = await createSupabaseAdmin()
    .from("business_transcription_credentials")
    .select("provider,model,key_hint")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error)
    throw new DomainError(
      "Não foi possível consultar a configuração de áudio.",
      503,
    );
  if (data)
    return {
      configured: true,
      provider: data.provider,
      model: data.model,
      hint: data.key_hint,
    };
  return {
    configured: !!process.env.TRANSCRIBE_API_KEY,
    provider: process.env.TRANSCRIBE_API_KEY ? "servidor" : undefined,
  };
}
export async function audioCredential(businessId?: string) {
  if (businessId && !isDemo()) {
    const { data, error } = await createSupabaseAdmin()
      .from("business_transcription_credentials")
      .select("provider,model,secret_enc")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw new Error("audio-vault-unavailable");
    if (data)
      return {
        ...config[data.provider as keyof typeof config],
        model: data.model as string,
        key: openVault(data.secret_enc, scope(businessId)),
      };
  }
  return process.env.TRANSCRIBE_API_KEY
    ? {
        key: process.env.TRANSCRIBE_API_KEY,
        base: process.env.TRANSCRIBE_BASE_URL || "https://api.openai.com/v1",
        model: process.env.TRANSCRIBE_MODEL || "whisper-1",
      }
    : null;
}
export async function saveAudioKey(
  businessId: string,
  actor: string,
  input: z.infer<typeof audioKeySchema>,
) {
  if (isDemo())
    throw new DomainError("Cadastre a chave no admin publicado.", 409);
  const admin = createSupabaseAdmin();
  const { data: business } = await admin
    .from("businesses")
    .select("tenant_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new DomainError("Estabelecimento não encontrado.", 404);
  const { base, model } = config[input.provider];
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${input.key}` },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
    cache: "no-store",
  }).catch(() => null);
  const models = response?.ok
    ? ((await response.json().catch(() => null)) as {
        data?: { id: string }[];
      } | null)
    : null;
  if (!models?.data?.some((m) => m.id === model))
    throw new DomainError(
      "O provedor não validou a chave e o modelo de transcrição. Confira a credencial.",
      409,
    );
  const { error } = await admin
    .from("business_transcription_credentials")
    .upsert({
      business_id: businessId,
      tenant_id: business.tenant_id,
      provider: input.provider,
      model,
      secret_enc: sealVault(input.key, scope(businessId)),
      key_hint: input.key.slice(-4),
      updated_by: actor,
      updated_at: new Date().toISOString(),
    });
  if (error)
    throw new DomainError("Não foi possível salvar a chave de áudio.", 503);
  return audioVaultView(businessId);
}
