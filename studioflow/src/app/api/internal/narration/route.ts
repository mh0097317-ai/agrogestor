import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { elevenLabsCredential } from "@/services/assistant/speech";

/*
 * TEMPORÁRIO: narração dos Reels de divulgação com a voz ElevenLabs da
 * plataforma, sem a chave sair do servidor. Só responde com o token de
 * NARRATION_TOKEN (sem a variável, a rota não existe). Remover depois.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("voices") }),
  z.object({
    action: z.literal("speak"),
    text: z.string().trim().min(1).max(400),
    voiceId: z
      .string()
      .regex(/^[A-Za-z0-9]{10,40}$/)
      .optional(),
    model: z
      .enum(["eleven_multilingual_v2", "eleven_v3", "eleven_flash_v2_5"])
      .default("eleven_multilingual_v2"),
  }),
]);

const digest = (value: string) => createHash("sha256").update(value).digest();
function allowed(request: Request) {
  const expected = process.env.NARRATION_TOKEN || "";
  const given = request.headers.get("x-narration-token") || "";
  return (
    expected.length >= 32 && timingSafeEqual(digest(expected), digest(given))
  );
}

export async function POST(request: Request) {
  if (!allowed(request)) return new Response("not found", { status: 404 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("bad request", { status: 400 });
  const config = await elevenLabsCredential();
  if (!config) return new Response("no voice", { status: 409 });
  const body = parsed.data;
  if (body.action === "voices") {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": config.key },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      return new Response(`voices ${response.status}`, { status: 502 });
    const data = (await response.json()) as {
      voices?: { voice_id: string; name: string; labels?: object }[];
    };
    return Response.json({
      current: config.voiceId,
      voices: (data.voices || []).map((v) => ({
        id: v.voice_id,
        name: v.name,
        labels: v.labels || {},
      })),
    });
  }
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(body.voiceId || config.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: body.text,
        model_id: body.model,
        language_code: "pt",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok) {
    // ElevenLabs says why (quota, permission); never echoes the key.
    const detail = (await response.json().catch(() => null)) as {
      detail?: { status?: string; message?: string };
    } | null;
    return new Response(
      `speech ${response.status} ${detail?.detail?.status || ""} ${String(detail?.detail?.message || "").slice(0, 160)}`,
      { status: 502 },
    );
  }
  return new Response(await response.arrayBuffer(), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
