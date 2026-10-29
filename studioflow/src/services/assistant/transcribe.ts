import { graphVersion } from "./whatsapp";
import { audioCredential } from "./audio-vault";
import { elevenLabsCredential } from "./speech";

/**
 * Áudio → texto por um serviço compatível com /audio/transcriptions
 * (OpenAI, Groq e outros). Configurado só no servidor:
 * TRANSCRIBE_API_KEY, e opcionalmente TRANSCRIBE_BASE_URL e TRANSCRIBE_MODEL.
 */
export const transcriptionReady = () => !!process.env.TRANSCRIBE_API_KEY;

const maxBytes = 16 * 1024 * 1024;

export async function transcribe(
  audio: ArrayBuffer,
  mime: string,
  businessId?: string,
): Promise<string> {
  if (audio.byteLength > maxBytes) throw new Error("audio too large");
  const extension = mime.includes("mpeg")
    ? "mp3"
    : mime.includes("mp4")
      ? "m4a"
      : mime.includes("wav")
        ? "wav"
        : "ogg";
  const file = new Blob([audio], { type: mime || "audio/ogg" });
  const credential = await audioCredential(businessId);
  if (credential) {
    const form = new FormData();
    form.append("file", file, `audio.${extension}`);
    form.append("model", credential.model);
    form.append("language", "pt");
    form.append("response_format", "json");
    try {
      const response = await fetch(
        `${credential.base.replace(/\/$/, "")}/audio/transcriptions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${credential.key}` },
          body: form,
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (response.ok) {
        const data = (await response.json()) as { text?: string };
        const text = (data.text || "").trim();
        if (text) return text;
      }
    } catch {
      // Fall through to the platform's ElevenLabs transcription credential.
    }
  }

  const elevenLabs = await elevenLabsCredential();
  if (!elevenLabs) throw new Error("transcription off");
  const form = new FormData();
  form.append("file", file, `audio.${extension}`);
  form.append("model_id", "scribe_v2");
  form.append("language_code", "por");
  form.append("tag_audio_events", "false");
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": elevenLabs.key },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`transcription ${response.status}`);
  const data = (await response.json()) as { text?: string };
  return (data.text || "").trim();
}

/** Mídia do WhatsApp: o id vira um link temporário que exige o token. */
export async function downloadWhatsAppMedia(mediaId: string, token: string) {
  const meta = await fetch(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(mediaId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!meta.ok) throw new Error(`media ${meta.status}`);
  const info = (await meta.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (!info.url || (info.file_size || 0) > maxBytes)
    throw new Error("media unavailable");
  const file = await fetch(info.url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!file.ok) throw new Error(`media file ${file.status}`);
  return {
    audio: await file.arrayBuffer(),
    mime: info.mime_type || "audio/ogg",
  };
}

/** Mídia do Instagram: o webhook já traz um link público temporário. */
export async function downloadUrl(url: string) {
  if (!/^https:\/\//.test(url)) throw new Error("invalid media url");
  const file = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!file.ok) throw new Error(`media file ${file.status}`);
  return {
    audio: await file.arrayBuffer(),
    mime: file.headers.get("content-type") || "audio/mp4",
  };
}

export const audioPlaceholder = "[O cliente enviou um áudio.]";

/** Texto da mensagem de áudio: a transcrição marcada com 🎤, ou o aviso. */
export async function audioText(
  load: () => Promise<{ audio: ArrayBuffer; mime: string }>,
  businessId?: string,
) {
  try {
    if (!(await audioCredential(businessId)) && !(await elevenLabsCredential()))
      return audioPlaceholder;
    const { audio, mime } = await load();
    const text = await transcribe(audio, mime, businessId);
    return text ? `🎤 ${text}` : audioPlaceholder;
  } catch (error) {
    console.error("StudioFlow transcription error:", {
      code:
        error instanceof Error && /too large/.test(error.message)
          ? "audio-too-large"
          : "transcription-unavailable",
    });
    return audioPlaceholder;
  }
}
