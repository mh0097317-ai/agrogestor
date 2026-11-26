import { DomainError } from "@/lib/availability";

/*
 * Trava de envio para homologação. Um preview ou staging nunca pode mandar
 * WhatsApp, e-mail ou cobrança real para quem não está na lista de teste.
 *
 * - STUDIOFLOW_OUTBOUND_MODE=live    envia normalmente (produção).
 * - STUDIOFLOW_OUTBOUND_MODE=sandbox só para destinos em
 *   STUDIOFLOW_OUTBOUND_ALLOWLIST (telefones só com dígitos ou e-mails,
 *   separados por vírgula); cobranças reais no Asaas de produção bloqueadas.
 * - STUDIOFLOW_OUTBOUND_MODE=off     nada sai.
 *
 * Sem a variável: preview da Vercel ou STUDIOFLOW_STAGING=1 viram
 * "sandbox" (o padrão seguro); o resto segue "live".
 */
type Env = Record<string, string | undefined>;
export type OutboundMode = "live" | "sandbox" | "off";
export type OutboundChannel = "whatsapp" | "instagram" | "email" | "payment";

export class OutboundBlockedError extends DomainError {
  constructor(channel: OutboundChannel) {
    super(
      `Envio por ${channel} bloqueado no modo de homologação. Coloque o destino na lista de teste para liberar.`,
      409,
    );
    this.name = "OutboundBlockedError";
  }
}

export function outboundMode(
  env: Env = process.env,
): OutboundMode {
  const explicit = (env.STUDIOFLOW_OUTBOUND_MODE || "").trim().toLowerCase();
  if (explicit === "live" || explicit === "sandbox" || explicit === "off")
    return explicit;
  if (env.VERCEL_ENV === "preview" || env.STUDIOFLOW_STAGING === "1")
    return "sandbox";
  return "live";
}

const normalize = (value: string) =>
  value.includes("@")
    ? value.trim().toLowerCase()
    : value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

export function outboundAllowlist(env: Env = process.env) {
  return new Set(
    (env.STUDIOFLOW_OUTBOUND_ALLOWLIST || "")
      .split(",")
      .map(normalize)
      .filter(Boolean),
  );
}

/** Throws before anything leaves the server when the destination is not allowed. */
export function assertOutboundAllowed(
  channel: OutboundChannel,
  recipient: string,
  env: Env = process.env,
) {
  const mode = outboundMode(env);
  if (mode === "live") return;
  if (mode === "sandbox" && outboundAllowlist(env).has(normalize(recipient)))
    return;
  throw new OutboundBlockedError(channel);
}

/** Real money: in sandbox/off only the provider's own test environment is used. */
export function assertPaymentAllowed(
  providerEnvironment: string,
  method: string,
  env: Env = process.env,
) {
  if (outboundMode(env) === "live") return;
  if (providerEnvironment === "sandbox") return;
  if (method.toUpperCase() === "GET") return;
  throw new OutboundBlockedError("payment");
}
