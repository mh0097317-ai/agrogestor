import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  elevenLabsCredential,
  synthesizeWhatsAppReply,
} from "@/services/assistant/speech";
import { transcribe } from "@/services/assistant/transcribe";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  findChats,
  findMessages,
  instanceState,
  webhookTarget,
} from "@/services/whatsapp/evolution";

/*
 * TEMPORÁRIO: narração dos Reels de divulgação com a voz ElevenLabs da
 * plataforma, sem a chave sair do servidor. Só responde com o token de
 * NARRATION_TOKEN (sem a variável, a rota não existe). Remover depois.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("voices") }),
  z.object({ action: z.literal("selftest") }),
  z.object({ action: z.literal("whatsapp"), slug: z.string().min(3).max(80) }),
  z.object({
    action: z.literal("timeline"),
    conversationId: z.string().uuid(),
  }),
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
  const body = parsed.data;
  if (body.action === "timeline") {
    // Só horário, direção e tipo das últimas mensagens no servidor do
    // WhatsApp, sem texto: mostra se a mensagem chegou lá.
    const admin = createSupabaseAdmin();
    const { data: chat } = await admin
      .from("conversations")
      .select("business_id,contact_phone")
      .eq("id", body.conversationId)
      .single();
    if (!chat) return new Response("no chat", { status: 404 });
    const { data: link } = await admin
      .from("whatsapp_links")
      .select("instance")
      .eq("business_id", chat.business_id)
      .single();
    if (!link) return new Response("no link", { status: 404 });
    const tail = (v?: string) => (v || "").replace(/\D/g, "").slice(-8);
    const want = tail(chat.contact_phone);
    const chats = await findChats(link.instance).catch(() => []);
    const stamp = (m: unknown) => {
      const r = m as {
        messageTimestamp?: number | string;
        key?: { fromMe?: boolean };
      };
      return {
        at: r?.messageTimestamp
          ? new Date(Number(r.messageTimestamp) * 1000).toISOString()
          : "",
        fromMe: !!r?.key?.fromMe,
      };
    };
    const recent = chats
      .map((c) => ({
        chat: tail(
          c.lastMessage?.key?.remoteJidAlt ||
            c.lastMessage?.key?.senderPn ||
            c.remoteJid,
        ).slice(-4),
        lid: (c.remoteJid || "").endsWith("@lid"),
        ...stamp(c.lastMessage),
      }))
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 8);
    const mine = chats.filter((c) =>
      [
        c.remoteJid,
        c.lastMessage?.key?.remoteJidAlt,
        c.lastMessage?.key?.senderPn,
      ].some((j) => tail(j || "") === want),
    );
    const timeline = [];
    for (const c of mine) {
      const records = (await findMessages(
        link.instance,
        { remoteJid: c.remoteJid },
        30,
      ).catch(() => [])) as { messageType?: string }[];
      timeline.push(
        ...records.map((r) => ({ ...stamp(r), type: r.messageType || "" })),
      );
    }
    return Response.json({
      recentChats: recent,
      thisChat: timeline.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 12),
    });
  }
  if (body.action === "whatsapp") {
    // Diagnóstico só de leitura: estado real das instâncias e destino do webhook.
    const admin = createSupabaseAdmin();
    const { data: shop } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", body.slug)
      .single();
    if (!shop) return new Response("no shop", { status: 404 });
    const [{ data: main }, { data: pros }] = await Promise.all([
      admin
        .from("whatsapp_links")
        .select("instance,status")
        .eq("business_id", shop.id),
      admin
        .from("professional_whatsapp_links")
        .select("instance,status")
        .eq("business_id", shop.id),
    ]);
    const rows = [
      ...(main || []).map((r) => ({ ...r, kind: "shop" })),
      ...(pros || []).map((r) => ({ ...r, kind: "pro" })),
    ];
    return Response.json(
      await Promise.all(
        rows.map(async (r) => ({
          kind: r.kind,
          saved: r.status,
          live: await instanceState(r.instance).catch(() => "erro"),
          webhook: await webhookTarget(r.instance),
        })),
      ),
    );
  }
  const config = await elevenLabsCredential();
  if (!config) return new Response("no voice", { status: 409 });
  if (body.action === "selftest") {
    // Fala uma frase e transcreve de volta: confere as duas permissões.
    const audio = await synthesizeWhatsAppReply(
      "Oi, tem horário amanhã de manhã?",
    ).catch((e: unknown) => (e instanceof Error ? e.message : "erro"));
    if (!(audio instanceof Uint8Array))
      return Response.json({
        speech: String(audio),
        transcription: "não testada",
      });
    const text = await transcribe(
      audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength,
      ) as ArrayBuffer,
      "audio/mpeg",
    ).catch((e: unknown) => `ERRO ${e instanceof Error ? e.message : "?"}`);
    return Response.json({ speech: "ok", transcription: text });
  }
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
