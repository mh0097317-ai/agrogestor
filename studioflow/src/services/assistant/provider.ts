import Anthropic from "@anthropic-ai/sdk";
import type { CreateMessage } from "./agent";
import { claudeCreate } from "./agent";
import { businessAiCredential } from "../admin-vault";
import { businessAiTier, tierModel } from "./ai-tier";
import { DomainError } from "@/lib/availability";

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

/** Adapts providers to the same tool loop. Booking validation stays in StudioFlow. */
export function openAiCreate(key: string, model: string): CreateMessage {
  return async (params) => {
    const messages: Record<string, unknown>[] = [
      {
        role: "system",
        content:
          typeof params.system === "string"
            ? params.system
            : (params.system || []).map((b) => b.text).join("\n"),
      },
    ];
    for (const message of params.messages) {
      if (typeof message.content === "string") {
        messages.push({ role: message.role, content: message.content });
        continue;
      }
      const userContent: OpenAIContentPart[] = [];
      for (const block of message.content) {
        if (block.type === "text")
          userContent.push({ type: "text", text: block.text });
        else if (block.type === "image" && block.source.type === "base64")
          userContent.push({
            type: "image_url",
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`,
              detail: "high",
            },
          });
      }
      const texts = userContent
        .filter((part) => part.type === "text")
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n");
      const calls = message.content
        .filter((b) => b.type === "tool_use")
        .map((b) =>
          b.type === "tool_use"
            ? {
                id: b.id,
                type: "function",
                function: { name: b.name, arguments: JSON.stringify(b.input) },
              }
            : null,
        );
      if (message.role === "assistant")
        messages.push({
          role: "assistant",
          content: texts || null,
          ...(calls.length ? { tool_calls: calls } : {}),
        });
      else {
        if (userContent.length)
          messages.push({
            role: "user",
            content:
              userContent.length === 1 && userContent[0].type === "text"
                ? texts
                : userContent,
          });
        for (const block of message.content)
          if (block.type === "tool_result")
            messages.push({
              role: "tool",
              tool_call_id: block.tool_use_id,
              content:
                typeof block.content === "string"
                  ? block.content
                  : JSON.stringify(block.content),
            });
      }
    }
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: params.max_tokens,
        ...(params.tools?.length
          ? {
              parallel_tool_calls: false,
              tools: params.tools
                .filter((t) => "input_schema" in t)
                .map((t) => ({
                  type: "function",
                  function: {
                    name: t.name,
                    description: "description" in t ? t.description : "",
                    parameters: "input_schema" in t ? t.input_schema : {},
                    ...("strict" in t && t.strict ? { strict: true } : {}),
                  },
                })),
              ...(params.tool_choice?.type === "tool"
                ? {
                    tool_choice: {
                      type: "function",
                      function: { name: params.tool_choice.name },
                    },
                  }
                : params.tool_choice?.type === "any"
                  ? { tool_choice: "required" }
                  : params.tool_choice?.type === "none"
                    ? { tool_choice: "none" }
                    : {}),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new DomainError(
        "O provedor de IA recusou a solicitação. Confira a chave, o modelo e o saldo no cofre.",
        502,
      );
    const data = (await response.json()) as {
      id: string;
      choices: {
        message: {
          content?: string;
          tool_calls?: {
            id: string;
            function: { name: string; arguments: string };
          }[];
        };
      }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const message = data.choices[0]?.message;
    if (!message)
      throw new DomainError("O provedor de IA não retornou uma resposta.", 502);
    return {
      id: data.id,
      type: "message",
      role: "assistant",
      model,
      content: [
        ...(message.content
          ? [{ type: "text" as const, text: message.content, citations: null }]
          : []),
        ...(message.tool_calls || []).map((call) => ({
          type: "tool_use" as const,
          id: call.id,
          name: call.function.name,
          input: JSON.parse(call.function.arguments),
        })),
      ],
      stop_reason: message.tool_calls?.length ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    } as Anthropic.Beta.BetaMessage;
  };
}

type AiCredential = {
  provider: "anthropic" | "openai" | "mwapi";
  model: string;
  key: string;
};

function anthropicProviderCreate(
  credential: AiCredential,
  baseURL?: string,
): CreateMessage {
  const client = new Anthropic({
    apiKey: credential.key,
    ...(baseURL ? { baseURL } : {}),
    authToken: null,
    timeout: 40000,
    maxRetries: 0,
  });
  return async (params) => {
    try {
      return await client.beta.messages.create({
        ...params,
        model: credential.model,
      });
    } catch (error) {
      // Only repair explicitly unsupported optional provider features. Domain
      // validation, tenant checks and booking constraints remain in StudioFlow.
      if (!(error instanceof Anthropic.BadRequestError)) throw error;
      const unsupportedStrict =
        /strict/i.test(error.message) &&
        /unsupported|not supported|unknown|extra inputs/i.test(error.message);
      const unsupportedCache =
        /cache_control/i.test(error.message) &&
        /unsupported|not supported|unknown|extra inputs/i.test(error.message);
      if (!unsupportedStrict && !unsupportedCache) throw error;
      console.warn("StudioFlow provider compatibility:", {
        provider: credential.provider,
        feature: unsupportedStrict ? "strict" : "cache-control",
      });
      return client.beta.messages.create({
        ...params,
        ...(unsupportedStrict
          ? {
              tools: params.tools?.map((tool) => {
                const compatible = { ...tool };
                if ("strict" in compatible) delete compatible.strict;
                return compatible;
              }),
            }
          : {}),
        ...(unsupportedCache ? { cache_control: undefined } : {}),
        model: credential.model,
      });
    }
  };
}

function credentialCreate(credential: AiCredential): CreateMessage {
  if (credential.provider === "openai")
    return openAiCreate(credential.key, credential.model);
  if (credential.provider === "mwapi")
    return anthropicProviderCreate(credential, "https://api.mwapi.dev");
  return anthropicProviderCreate(credential);
}

function shouldFailover(error: unknown) {
  if (error instanceof DomainError) return error.status === 502 || error.status === 503;
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number(error.status) : undefined;
  if (status === 401 || status === 403 || status === 408 || status === 429 || (status !== undefined && status >= 500))
    return true;
  const name = "name" in error ? String(error.name) : "";
  return (
    error instanceof TypeError ||
    name === "APIConnectionError" ||
    name === "APIConnectionTimeoutError" ||
    name === "TimeoutError"
  );
}

/** Retry the same turn through the encrypted backup only for provider outages. */
export async function runWithAiFailover<T>(
  primary: () => Promise<T>,
  fallback: (() => Promise<T>) | null,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if (!fallback || !shouldFailover(error)) throw error;
    console.warn("StudioFlow AI provider failover", {
      reason:
        error instanceof DomainError
          ? `http-${error.status}`
          : error && typeof error === "object" && "status" in error
            ? `http-${String(error.status)}`
            : "connection",
    });
    return fallback();
  }
}

export async function businessCreate(
  businessId: string,
): Promise<CreateMessage | null> {
  const credential = await businessAiCredential(businessId);
  if (!credential)
    return claudeCreate(tierModel(await businessAiTier(businessId)));
  const primary = credentialCreate(credential);
  const fallback = credential.fallback
    ? credentialCreate(credential.fallback)
    : null;
  if (!fallback) return primary;
  return async (params) => {
    return runWithAiFailover(
      () => primary(params),
      () => fallback(params),
    );
  };
}
