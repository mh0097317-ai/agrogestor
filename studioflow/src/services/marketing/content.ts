import { z } from "zod";

/** Uma tela do post: título curto e um texto de apoio. */
export const slideSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(280).default(""),
});
export type Slide = z.infer<typeof slideSchema>;

export const formats = ["post", "carousel", "story", "reel"] as const;
export type MarketingFormat = (typeof formats)[number];
export type MarketingStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "discarded";

export interface MarketingPost {
  id: string;
  status: MarketingStatus;
  format: MarketingFormat;
  theme: string;
  slides: Slide[];
  caption: string;
  videoUrl: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  permalink: string | null;
  error: string | null;
  likes: number | null;
  comments: number | null;
  origin: "ia" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface MarketingSettings {
  autopilot: boolean;
  autoPublish: boolean;
  postsPerWeek: number;
  postHour: number;
  voice: string;
}

export const settingsSchema = z
  .object({
    autopilot: z.boolean(),
    autoPublish: z.boolean(),
    postsPerWeek: z.number().int().min(1).max(14),
    postHour: z.number().int().min(6).max(22),
    voice: z.string().trim().max(1000),
  })
  .strict();

/** O que a IA devolve para cada ideia. */
export const ideaSchema = z.object({
  format: z.enum(["post", "carousel", "story"]),
  theme: z.string().trim().min(3).max(200),
  slides: z.array(slideSchema).min(1).max(7),
  caption: z.string().trim().min(10).max(2000),
  hashtags: z.array(z.string().trim().regex(/^#?[\p{L}\p{N}_]{2,40}$/u)).max(12).default([]),
});
export type Idea = z.infer<typeof ideaSchema>;

/** Ajusta a quantidade de telas ao formato e junta as hashtags na legenda. */
export function normalizeIdea(idea: Idea) {
  const slides =
    idea.format === "carousel"
      ? idea.slides.slice(0, 7)
      : idea.slides.slice(0, 1);
  const format: MarketingFormat =
    idea.format === "carousel" && slides.length < 2 ? "post" : idea.format;
  const tags = [...new Set(idea.hashtags.map((t) => `#${t.replace(/^#/, "")}`))];
  const caption = [idea.caption.trim(), tags.join(" ")]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2200);
  return { format, theme: idea.theme, slides, caption };
}

/** Fatos verdadeiros do produto; a IA não pode prometer nada além disto. */
export const productFacts = [
  "Página própria da barbearia com fotos, serviços e preços, mapa, Instagram e avaliações de clientes.",
  "Agendamento online 24 horas: o cliente escolhe serviço, profissional, dia e horário, sem baixar app nem criar senha.",
  "Recepcionista com IA no WhatsApp e no Instagram: tira dúvidas, mostra horários livres e marca o horário.",
  "Lembrete automático pelo WhatsApp perto do horário e por e-mail na véspera.",
  "A agenda impede dois clientes no mesmo horário com o mesmo profissional.",
  "Sinal por Pix na hora de agendar, para reduzir faltas.",
  "Clube de assinatura (mensalidade do cliente na barbearia).",
  "Financeiro com recebido, a receber e comissão de cada profissional.",
  "Venda de produtos com controle de estoque.",
  "Check-in por QR Code, modo TV da recepção, cartão fidelidade e lista de espera.",
  "O profissional recebe aviso no WhatsApp quando um horário é marcado.",
];

export const pillars = [
  "dor do dono de barbearia (WhatsApp entre um corte e outro, cliente que falta, agenda no caderno)",
  "dica prática de gestão de barbearia (sem números inventados)",
  "mostrar uma função do StudioFlow resolvendo um problema real",
  "atendimento e experiência do cliente da barbearia",
  "organização financeira e comissão",
];

export function marketingSystemPrompt(voice: string) {
  return [
    "Você é o social media da StudioFlow, um sistema para barbearias no Brasil.",
    "Escreva para donos de barbearia, em português do Brasil, com frases curtas, tom direto e próximo, sem cara de texto de IA.",
    "Regras obrigatórias:",
    "- Use apenas os fatos do produto listados abaixo. Não invente funções, números, estatísticas, depoimentos, clientes, prêmios ou preços.",
    "- Não prometa resultado garantido (nada de 'dobre seu faturamento').",
    "- Títulos das telas com no máximo 70 caracteres; texto de apoio com no máximo 160.",
    "- Legenda com gancho na primeira linha, até 600 caracteres, terminando com uma chamada leve (ex.: link na bio, comente, salve).",
    "- No máximo 8 hashtags relevantes em português.",
    "- Carrossel tem de 4 a 7 telas: capa com gancho, telas com um ponto cada, e a última com chamada para ação.",
    "- Varie os temas e não repita os temas recentes.",
    "",
    "Fatos do produto:",
    ...productFacts.map((f) => `- ${f}`),
    "",
    "Pilares de conteúdo:",
    ...pillars.map((p) => `- ${p}`),
    ...(voice.trim() ? ["", `Orientação da equipe: ${voice.trim()}`] : []),
  ].join("\n");
}

/** Próximos horários livres de publicação, um por dia, a partir de amanhã (horário de Brasília). */
export function nextSlots(
  count: number,
  hour: number,
  taken: string[],
  postsPerWeek: number,
  now = new Date(),
) {
  const gap = Math.max(1, Math.floor(7 / Math.max(1, postsPerWeek)));
  const takenDays = new Set(taken.map((t) => dayKey(new Date(t))));
  const slots: string[] = [];
  // 03:00 UTC = 00:00 em Brasília (sem horário de verão).
  const base = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour + 3),
  );
  let day = 1;
  while (slots.length < count && day < 120) {
    const at = new Date(base.getTime() + day * 86_400_000);
    if (!takenDays.has(dayKey(at)) && at.getTime() > now.getTime()) {
      slots.push(at.toISOString());
      takenDays.add(dayKey(at));
      day += gap;
    } else day++;
  }
  return slots;
}
const dayKey = (d: Date) =>
  new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

export function rowToPost(row: Record<string, unknown>): MarketingPost {
  return {
    id: row.id as string,
    status: row.status as MarketingStatus,
    format: row.format as MarketingFormat,
    theme: (row.theme as string) || "",
    slides: z.array(slideSchema).catch([]).parse(row.slides),
    caption: (row.caption as string) || "",
    videoUrl: (row.video_url as string) || null,
    scheduledFor: (row.scheduled_for as string) || null,
    publishedAt: (row.published_at as string) || null,
    permalink: (row.permalink as string) || null,
    error: (row.error as string) || null,
    likes: (row.likes as number | null) ?? null,
    comments: (row.comments as number | null) ?? null,
    origin: (row.origin as "ia" | "admin") || "ia",
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) || (row.created_at as string),
  };
}
