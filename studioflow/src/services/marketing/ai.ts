import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { ideaSchema, marketingSystemPrompt, normalizeIdea } from "./content";

export const marketingModel =
  process.env.STUDIOFLOW_MARKETING_MODEL || "claude-opus-5-5";

// Formato que a IA preenche; as regras finas (tamanhos) são conferidas depois com ideaSchema.
const output = z.object({
  posts: z.array(
    z.object({
      format: z.enum(["post", "carousel", "story"]),
      theme: z.string(),
      slides: z.array(z.object({ title: z.string(), body: z.string() })),
      caption: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
});

export function marketingAiConfigured() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Pede ideias prontas para publicar; descarta o que não passar nas regras. */
export async function generateIdeas(input: {
  count: number;
  voice: string;
  recentThemes: string[];
  request?: string;
  format?: "post" | "carousel" | "story";
}) {
  if (!marketingAiConfigured())
    throw new DomainError("A IA não está configurada no servidor.", 503);
  const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });
  const ask = [
    `Crie ${input.count} ${input.count === 1 ? "publicação" : "publicações"} para o Instagram da StudioFlow.`,
    input.format
      ? `Formato obrigatório: ${input.format}.`
      : "Misture os formatos: carrossel (o que mais engaja), post único e story.",
    input.request?.trim() ? `Pedido da equipe: ${input.request.trim()}` : "",
    input.recentThemes.length
      ? `Temas recentes que não devem se repetir:\n${input.recentThemes.map((t) => `- ${t}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  let response;
  try {
    response = await client.messages.parse({
      model: marketingModel,
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(output) },
      system: marketingSystemPrompt(input.voice),
      messages: [{ role: "user", content: ask }],
    });
  } catch (cause) {
    if (cause instanceof Anthropic.RateLimitError)
      throw new DomainError("A IA está ocupada agora. Tente em alguns minutos.", 429);
    if (cause instanceof Anthropic.APIError)
      throw new DomainError("A IA não respondeu. Tente de novo.", 502);
    throw cause;
  }
  if (response.stop_reason === "refusal" || !response.parsed_output)
    throw new DomainError("A IA não conseguiu criar agora. Tente outro pedido.", 502);
  const ideas = response.parsed_output.posts.flatMap((post) => {
    const parsed = ideaSchema.safeParse(post);
    return parsed.success ? [normalizeIdea(parsed.data)] : [];
  });
  if (!ideas.length)
    throw new DomainError("A IA devolveu um conteúdo fora do padrão. Tente de novo.", 502);
  return ideas.slice(0, input.count);
}
