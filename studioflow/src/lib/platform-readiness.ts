/*
 * Prontidão da plataforma: o que está configurado para operar e vender.
 * Só diz se cada item existe; nunca devolve valor de chave.
 */
export interface ReadinessItem {
  id: string;
  area: "operação" | "cobrança" | "segurança" | "atendimento" | "suporte";
  label: string;
  ok: boolean;
  /** Quando não está ok: o que fazer, em uma frase. */
  fix: string;
  /** Itens que o servidor não consegue conferir sozinho (painéis externos). */
  manual?: boolean;
}

type Env = Record<string, string | undefined>;

export function readinessFromEnv(
  env: Env,
  extra: { evolution: boolean; aiVaultKeys: number; outboundMode: string },
): ReadinessItem[] {
  const has = (name: string) => !!(env[name] || "").trim();
  return [
    {
      id: "cron-secret",
      area: "operação",
      label: "Rotina diária (cobrança, Instagram, boas-vindas)",
      ok: has("CRON_SECRET"),
      fix: "Criar CRON_SECRET na Vercel (produção). Sem ele, /api/cron/billing recusa todas as chamadas.",
    },
    {
      id: "asaas-platform",
      area: "cobrança",
      label: "Mensalidade automática (Asaas da StudioFlow)",
      ok: has("STUDIOFLOW_ASAAS_API_KEY") && has("STUDIOFLOW_ASAAS_WEBHOOK_TOKEN"),
      fix: "Definir STUDIOFLOW_ASAAS_API_KEY, STUDIOFLOW_ASAAS_ENV e STUDIOFLOW_ASAAS_WEBHOOK_TOKEN e cadastrar o webhook /api/billing/asaas no Asaas.",
    },
    {
      id: "support-whatsapp",
      area: "suporte",
      label: "Canal oficial de suporte (botões \"Falar com o StudioFlow\")",
      ok: has("NEXT_PUBLIC_STUDIOFLOW_WHATSAPP"),
      fix: "Definir NEXT_PUBLIC_STUDIOFLOW_WHATSAPP com o número de suporte (só dígitos, com 55).",
    },
    {
      id: "ai-platform-key",
      area: "atendimento",
      label: "Chave de IA da plataforma (reserva para lojas sem chave própria)",
      ok: has("ANTHROPIC_API_KEY") || has("ANTHROPIC_AUTH_TOKEN"),
      fix: `Opcional. Hoje ${extra.aiVaultKeys} loja(s) têm chave própria no cofre; as demais ficam sem recepcionista.`,
    },
    {
      id: "evolution",
      area: "atendimento",
      label: "Servidor de WhatsApp (Evolution) configurado",
      ok: extra.evolution,
      fix: "Cadastrar endereço e chave da Evolution no /admin (cofre).",
    },
    {
      id: "email",
      area: "operação",
      label: "E-mail transacional (Resend)",
      ok: has("RESEND_API_KEY"),
      fix: "Definir RESEND_API_KEY e verificar o domínio de envio no Resend.",
    },
    {
      id: "encryption-key",
      area: "segurança",
      label: "Chave própria de cifra dos segredos (PAYMENTS_ENCRYPTION_KEY)",
      ok: has("PAYMENTS_ENCRYPTION_KEY"),
      fix: "Hoje a cifra deriva da chave do Supabase. Gerar 32 bytes aleatórios em base64 e reconectar as credenciais cifradas.",
    },
    {
      id: "outbound-mode",
      area: "segurança",
      label: `Modo de envio: ${extra.outboundMode}`,
      ok: extra.outboundMode === "live" ? env.VERCEL_ENV !== "preview" : true,
      fix: "Preview com envio real: definir STUDIOFLOW_OUTBOUND_MODE=sandbox no ambiente de preview.",
    },
    {
      id: "leftover-narration",
      area: "segurança",
      label: "Sem variáveis temporárias esquecidas",
      ok: !has("NARRATION_TOKEN"),
      fix: "Apagar NARRATION_TOKEN da Vercel (a rota que usava foi removida).",
    },
    {
      id: "leaked-passwords",
      area: "segurança",
      label: "Proteção contra senhas vazadas (Supabase Auth)",
      ok: false,
      manual: true,
      fix: "Conferir em Supabase → Authentication → Password security.",
    },
    {
      id: "backups",
      area: "segurança",
      label: "Backup com restauração testada",
      ok: false,
      manual: true,
      fix: "O plano gratuito do Supabase não oferece backup baixável nem PITR. Ver STUDIOFLOW_AUTORIZACOES_PENDENTES.md.",
    },
  ];
}
