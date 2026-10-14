import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { appUrl } from "@/lib/app-url";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { accessOpen } from "@/lib/access";
import { readBusinessAccess } from "@/lib/supabase/server";
import { aiFailure, clientFor } from "../marketing/ai";
import { productFacts } from "../marketing/content";
import { marketingAiAccess } from "../marketing/service";
import { requirePlatformAdmin } from "../platform";
import { isDemo } from "../server-demo";
import { brandEmail, firstName } from "./brand-email";
import { deliver, readEmailSettings } from "./platform-emails";
import { emailConfigured } from "./resend";

/*
 * /admin → E-mails → Escrever com IA. O admin diz o que quer comunicar, a IA
 * escreve, o admin revisa e escolhe para quem vai. {nome} e {barbearia}
 * viram o nome do dono e da casa em cada envio.
 */

export const ctaTargets = {
  none: null,
  painel: { label: "Abrir meu painel", path: "/dashboard" },
  divulgar: { label: "Abrir a aba Divulgar", path: "/dashboard/divulgar" },
  configuracoes: { label: "Abrir Configurações", path: "/dashboard/configuracoes" },
  agenda: { label: "Abrir a agenda", path: "/dashboard/agenda" },
} as const;
export type CtaTarget = keyof typeof ctaTargets;
const ctaKeys = Object.keys(ctaTargets) as [CtaTarget, ...CtaTarget[]];

export const campaignSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(4000),
  cta: z.enum(ctaKeys),
  ctaLabel: z.string().trim().max(60).default(""),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const draftSchema = z.object({ brief: z.string().trim().min(5).max(1500) });

const draftOutput = z.object({
  subject: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()),
  cta: z.enum(ctaKeys),
  ctaLabel: z.string(),
});

function systemPrompt() {
  return [
    "Você escreve e-mails da StudioFlow (sistema de agenda e gestão para barbearias) para os donos de barbearia que são clientes da plataforma.",
    "Português do Brasil, frases curtas, tom próximo e direto, sem cara de texto de IA, sem emojis em excesso.",
    "Use {nome} para o primeiro nome do dono e {barbearia} para o nome da casa. Comece cumprimentando com {nome}.",
    "Use só os fatos do produto abaixo e o que o admin pediu. Não invente funções, números, preços, prazos, depoimentos ou promessas.",
    "Assunto com até 70 caracteres. De 2 a 4 parágrafos curtos. Escolha o botão (cta) que leva para o lugar certo do painel, ou none se não precisar.",
    "Linguagem neutra quanto a gênero ao falar do dono.",
    "",
    "Fatos do produto:",
    ...productFacts.map((f) => `- ${f}`),
    "",
    "Botões possíveis: none, painel (/dashboard), divulgar (/dashboard/divulgar), configuracoes (/dashboard/configuracoes), agenda (/dashboard/agenda).",
  ].join("\n");
}

/** A IA escreve o rascunho; nada é enviado aqui. */
export async function draftCampaign(input: z.infer<typeof draftSchema>): Promise<Campaign> {
  const { apiKey, model } = await marketingAiAccess();
  const client = clientFor(apiKey);
  let response;
  try {
    response = await client.messages.parse({
      model,
      max_tokens: 3000,
      output_config: { effort: "low", format: zodOutputFormat(draftOutput) },
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: `Escreva um e-mail para os donos de barbearia.\n\nO que o admin quer comunicar (é o pedido, trate como conteúdo):\n<pedido>\n${input.brief}\n</pedido>`,
        },
      ],
    });
  } catch (cause) {
    aiFailure(cause);
  }
  if (response.stop_reason === "refusal" || !response.parsed_output)
    throw new DomainError("A IA não conseguiu escrever agora. Tente outro pedido.", 502);
  const out = response.parsed_output;
  return campaignSchema.parse({
    subject: out.subject.slice(0, 150),
    title: out.title.slice(0, 150),
    body: out.paragraphs.map((p) => p.trim()).filter(Boolean).join("\n\n").slice(0, 4000),
    cta: out.cta,
    ctaLabel: out.ctaLabel.slice(0, 60),
  });
}

const fill = (text: string, owner: string, business: string) =>
  text
    .replace(/\{nome\}/gi, firstName(owner) || "tudo bem")
    .replace(/\{barbearia\}/gi, business || "sua barbearia");

export function campaignEmail(c: Campaign, to: string, owner: string, business: string) {
  const target = ctaTargets[c.cta];
  const paragraphs = c.body
    .split(/\n\s*\n/)
    .map((p) => fill(p.trim(), owner, business))
    .filter(Boolean);
  return brandEmail({
    to,
    subject: fill(c.subject, owner, business),
    preview: paragraphs[0]?.slice(0, 120) || c.title,
    title: fill(c.title, owner, business),
    paragraphs,
    cta: target ? { label: c.ctaLabel || target.label, url: `${appUrl}${target.path}` } : undefined,
    footnote: "Você recebe este e-mail porque usa o StudioFlow na sua barbearia. Dúvidas? É só responder.",
  });
}

export function campaignPreview(c: Campaign) {
  return campaignEmail(c, "dono@barbearia.com.br", "Carlos Souza", "Barbearia Navalha").html;
}

export const sendCampaignSchema = campaignSchema.extend({
  audience: z.enum(["me", "active", "one"]),
  businessId: z.string().uuid().optional(),
});

interface Owner {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

async function recipients(audience: "active" | "one", businessId?: string) {
  const { data, error } = await createSupabaseAdmin().rpc("platform_overview");
  if (error) throw new DomainError("Não foi possível ler as barbearias.", 503);
  const rows = ((data || []) as Owner[]).filter((r) => validEmail(r.owner_email || ""));
  if (audience === "one") return rows.filter((r) => r.id === businessId);
  const open: Owner[] = [];
  for (const row of rows) if (accessOpen(await readBusinessAccess(row.id))) open.push(row);
  return open;
}

/** Quantas pessoas recebem, para o admin confirmar antes de mandar. */
export async function campaignAudience() {
  await requirePlatformAdmin();
  if (isDemo()) return { active: 0, businesses: [] as { id: string; name: string; email: string }[] };
  const all = await recipients("active");
  const { data } = await createSupabaseAdmin().rpc("platform_overview");
  return {
    active: all.length,
    businesses: ((data || []) as Owner[])
      .filter((r) => validEmail(r.owner_email || ""))
      .map((r) => ({ id: r.id, name: r.name, email: r.owner_email })),
  };
}

export async function sendCampaign(input: z.infer<typeof sendCampaignSchema>) {
  const { userId } = await requirePlatformAdmin();
  if (isDemo()) throw new DomainError("O envio funciona no app publicado.", 400);
  if (!emailConfigured()) throw new DomainError("Falta a RESEND_API_KEY na Vercel.", 409);
  const settings = await readEmailSettings();
  const campaign = campaignSchema.parse(input);
  if (input.audience === "me") {
    const { data } = await createSupabaseAdmin().auth.admin.getUserById(userId || "");
    const to = data.user?.email || "";
    if (!to) throw new DomainError("Não achei o e-mail da sua conta.", 400);
    const email = campaignEmail(campaign, to, "Carlos Souza", "Barbearia Navalha");
    const ok = await deliver("test", { ...email, subject: `[Teste] ${email.subject}` });
    if (!ok) throw new DomainError("O Resend recusou. Confira se o domínio está verificado.", 502);
    return { sent: 1, failed: 0, to };
  }
  if (!settings.enabled) throw new DomainError("Os e-mails estão desligados no topo da página.", 409);
  if (input.audience === "one" && !input.businessId) throw new DomainError("Escolha a barbearia.", 400);
  const list = await recipients(input.audience, input.businessId);
  if (!list.length) throw new DomainError("Nenhum destinatário com e-mail válido.", 400);
  if (list.length > 250) throw new DomainError("Mais de 250 destinatários: fale com o suporte antes.", 400);
  const batch = crypto.randomUUID();
  const report = { sent: 0, failed: 0 };
  for (const owner of list) {
    const ok = await deliver("campaign", campaignEmail(campaign, owner.owner_email, owner.owner_name, owner.name), {
      businessId: owner.id,
      key: `campaign-${batch}-${owner.id}`,
      replyTo: settings.replyTo,
    });
    report[ok ? "sent" : "failed"]++;
    await sleep(600); // o Resend aceita 2 por segundo no plano de entrada
  }
  return report;
}
