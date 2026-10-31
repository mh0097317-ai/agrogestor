import type Anthropic from "@anthropic-ai/sdk";

/*
 * O motor de conversa, sem nada de barbearia: um modelo que fala com o
 * cliente e usa ferramentas. Cada negócio entra com o próprio prompt e as
 * próprias ferramentas (o "pacote"), então o mesmo motor serve outros
 * sistemas. Uma chamada por mensagem quando não há ferramenta; o código do
 * negócio confere fatos e ações, o modelo cuida da conversa.
 */

export type Message = Anthropic.Beta.BetaMessageParam;
export type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;
export type CreateMessage = (
  params: Params,
) => Promise<Anthropic.Beta.BetaMessage>;

export interface ToolOutcome {
  content: string;
  isError?: boolean;
}

export interface AgentTurn {
  /** Text sent to the customer; "" when the model chose silence. */
  reply: string;
  /** Every message of this turn, including tool calls and results. */
  messages: Message[];
  usage: { input: number; output: number };
  stop: "reply" | "refusal" | "steps";
}

export interface AgentTurnInput {
  create: CreateMessage;
  model: string;
  /** Stable per business so it caches; anything that changes goes in messages. */
  system: string;
  tools: Anthropic.Beta.BetaTool[];
  /** Earlier conversation as plain user/assistant text. */
  history: Message[];
  /** This turn: what the customer said plus context lines (time, name). */
  user: Anthropic.Beta.BetaContentBlockParam[];
  execute: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<ToolOutcome>;
  /**
   * Called with the draft reply. Return a correction to make the model write
   * it again (once per problem), or null to accept it.
   */
  review?: (reply: string) => string | null;
  /** Stop calling tools and end the turn (e.g. the model chose silence). */
  done?: () => boolean;
  maxSteps?: number;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

const text = (message: Anthropic.Beta.BetaMessage) =>
  message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurn> {
  const messages: Message[] = [
    ...input.history,
    { role: "user", content: input.user },
  ];
  const usage = { input: 0, output: 0 };
  const corrections = new Set<string>();
  const maxSteps = input.maxSteps ?? 5;
  for (let step = 0; step < maxSteps; step++) {
    const response = await input.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 2000,
      cache_control: { type: "ephemeral" },
      output_config: { effort: input.effort ?? "low" },
      system: input.system,
      tools: input.tools,
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages,
    });
    usage.input +=
      (response.usage.input_tokens || 0) +
      (response.usage.cache_read_input_tokens || 0) +
      (response.usage.cache_creation_input_tokens || 0);
    usage.output += response.usage.output_tokens || 0;
    if (response.stop_reason === "refusal")
      return { reply: "", messages, usage, stop: "refusal" };
    // Thinking blocks go back unchanged inside the turn.
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;
    const calls = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (response.stop_reason === "max_tokens" && calls.length)
      // A cut tool call has incomplete arguments: never run it.
      throw new Error("agent-truncated-tool-call");
    if (!calls.length) {
      const reply = text(response);
      const problem = reply ? input.review?.(reply) : null;
      if (problem && !corrections.has(problem) && step < maxSteps - 1) {
        corrections.add(problem);
        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: `[Nota interna do sistema, o cliente não vê] ${problem} Reescreva a resposta ao cliente.`,
            },
          ],
        });
        continue;
      }
      return { reply, messages, usage, stop: "reply" };
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      const outcome = await input.execute(
        call.name,
        (call.input || {}) as Record<string, unknown>,
      );
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: outcome.content,
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: results });
    if (input.done?.()) return { reply: "", messages, usage, stop: "reply" };
  }
  return { reply: "", messages, usage, stop: "steps" };
}

/** Earlier messages of a chat as alternating user/assistant text turns. */
export function transcriptHistory(
  items: { role: "user" | "assistant"; text: string }[],
): Message[] {
  const merged: { role: "user" | "assistant"; text: string }[] = [];
  for (const item of items) {
    const body = item.text.trim();
    if (!body) continue;
    const last = merged.at(-1);
    if (last?.role === item.role) last.text += `\n${body}`;
    else merged.push({ role: item.role, text: body });
  }
  // The API wants the first message from the user.
  while (merged[0]?.role === "assistant") merged.shift();
  return merged.map((m) => ({ role: m.role, content: m.text.slice(0, 4000) }));
}
