import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DomainError } from "@/lib/availability";
import { isDemo } from "../server-demo";
import { openVault, sealVault } from "../server-secrets";

const MODEL = "eleven_flash_v2_5";
const scope = "platform:elevenlabs";

export const elevenLabsSchema = z.object({
  key: z.string().trim().min(20).max(1000),
  voiceId: z.string().trim().min(3).max(100),
});

export interface ElevenLabsView {
  configured: boolean;
  voiceId?: string;
  hint?: string;
  source?: "admin" | "environment";
}

export async function elevenLabsView(): Promise<ElevenLabsView> {
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)
    return {
      configured: true,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
      hint: process.env.ELEVENLABS_API_KEY.slice(-4),
      source: "environment",
    };
  if (isDemo()) return { configured: false };
  const { data, error } = await createSupabaseAdmin()
    .from("platform_voice_credentials")
    .select("voice_id,key_hint")
    .eq("id", "elevenlabs")
    .maybeSingle();
  if (error) throw new DomainError("Não foi possível consultar a voz.", 503);
  return data
    ? {
        configured: true,
        voiceId: data.voice_id,
        hint: data.key_hint,
        source: "admin",
      }
    : { configured: false };
}

export async function saveElevenLabs(
  actor: string,
  input: z.infer<typeof elevenLabsSchema>,
) {
  if (isDemo()) throw new DomainError("Configure no admin publicado.", 409);
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)
    throw new DomainError(
      "Esta voz é administrada pelas variáveis de ambiente da publicação.",
      409,
    );
  const response = await fetch(
    `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(input.voiceId)}`,
    {
      headers: { "xi-api-key": input.key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    },
  ).catch(() => null);
  if (!response?.ok)
    throw new DomainError(
      "A ElevenLabs não validou a chave e o ID da voz. Confira os dois dados.",
      409,
    );
  const voice = (await response.json().catch(() => null)) as
    | { voice_id?: string }
    | null;
  if (voice?.voice_id !== input.voiceId)
    throw new DomainError("O ID da voz não pertence à sua conta.", 409);
  const { error } = await createSupabaseAdmin().rpc(
    "platform_save_voice_credential",
    {
      p_actor: actor,
      p_secret: sealVault(input.key, scope),
      p_hint: input.key.slice(-4),
      p_voice_id: input.voiceId,
    },
  );
  if (error) throw new DomainError("Não foi possível salvar a voz.", 503);
  return elevenLabsView();
}

export async function removeElevenLabs(actor: string) {
  if (isDemo()) throw new DomainError("Configure no admin publicado.", 409);
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)
    throw new DomainError(
      "Remova a chave e a voz nas variáveis de ambiente da publicação.",
      409,
    );
  const { error } = await createSupabaseAdmin().rpc(
    "platform_save_voice_credential",
    { p_actor: actor, p_secret: null, p_hint: null, p_voice_id: null },
  );
  if (error) throw new DomainError("Não foi possível desativar a voz.", 503);
  return elevenLabsView();
}

export async function elevenLabsCredential() {
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)
    return {
      key: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
    };
  if (isDemo()) return null;
  const { data, error } = await createSupabaseAdmin()
    .from("platform_voice_credentials")
    .select("secret_enc,voice_id")
    .eq("id", "elevenlabs")
    .maybeSingle();
  if (error) throw new Error("elevenlabs-credential-unavailable");
  return data
    ? { key: openVault(data.secret_enc, scope), voiceId: data.voice_id }
    : null;
}

/** Returns a compact MP3, or null when voice replies have not been configured. */
export async function synthesizeWhatsAppReply(text: string) {
  const config = await elevenLabsCredential();
  const clean = text.trim();
  if (!config || !clean || clean.length > 1200) return null;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_22050_32`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: clean,
        model_id: MODEL,
        language_code: "pt",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error(`elevenlabs-speech-${response.status}`);
  const audio = new Uint8Array(await response.arrayBuffer());
  if (!audio.length || audio.length > 4_000_000)
    throw new Error("elevenlabs-speech-size");
  return audio;
}
