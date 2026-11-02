/*
 * Regras da Captação sem rede nem banco: telefone, WhatsApp, o que o site
 * da barbearia revela e a nota com o motivo. Tudo determinístico, para a
 * equipe saber exatamente por que um lead está no topo.
 */

export type LeadStatus =
  | "new"
  | "contacted"
  | "replied"
  | "demo"
  | "trial"
  | "customer"
  | "lost"
  | "opted_out";

export const leadStatuses: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "Novo" },
  { id: "contacted", label: "Mensagem enviada" },
  { id: "replied", label: "Respondeu" },
  { id: "demo", label: "Demonstração" },
  { id: "trial", label: "Em teste grátis" },
  { id: "customer", label: "Cliente" },
  { id: "lost", label: "Não fechou" },
  { id: "opted_out", label: "Pediu para não receber" },
];

export interface LeadSignals {
  /** Ferramenta de agendamento que o site usa; null = nenhuma achada. */
  bookingTool?: string | null;
  /** O site foi lido (senão, não dá para afirmar que não tem agendamento). */
  siteRead?: boolean;
  siteError?: string;
  whatsappOnSite?: boolean;
  usesStudioFlow?: boolean;
}

export interface LeadFacts {
  name: string;
  phone: string;
  website: string;
  instagram: string;
  rating: number | null;
  reviews: number | null;
  city: string;
  signals: LeadSignals;
}

/** "+55 (62) 99999-1234" → "62999991234" (DDD + número, sem o 55). */
export function normalizePhone(raw: string | null | undefined) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    digits = digits.slice(2);
  return /^[1-9][0-9]{9,10}$/.test(digits) ? digits : "";
}

/** Celular brasileiro (11 dígitos, começa com 9 depois do DDD): quase sempre tem WhatsApp. */
export const isMobile = (phone: string) => /^[1-9][0-9]9[0-9]{8}$/.test(phone);

export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
}

export function formatLeadPhone(phone: string) {
  if (phone.length === 11) return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  if (phone.length === 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  return phone;
}

/** Quem já resolve o agendamento online: o lead vira campanha de troca. */
const bookingTools: [RegExp, string][] = [
  [/studioflowapp\.(tech|com)/i, "StudioFlow"],
  [/booksy\.com/i, "Booksy"],
  [/trinks\.com/i, "Trinks"],
  [/appbarber\.com\.br/i, "AppBarber"],
  [/cashbarber\.com\.br/i, "CashBarber"],
  [/avec\.(app|beauty)|salao\.avec/i, "Avec"],
  [/salaovip\.com\.br/i, "Salão VIP"],
  [/beautydate\.com\.br|beauty\.date/i, "Beauty Date"],
  [/agendapro\.com/i, "AgendaPro"],
  [/simplesagenda\.com/i, "Simples Agenda"],
  [/gendo\.app|meugendo/i, "Gendo"],
  [/tuaagenda\.com/i, "Tua Agenda"],
  [/calendly\.com/i, "Calendly"],
  [/setmore\.com/i, "Setmore"],
  [/fresha\.com/i, "Fresha"],
  [/agendaedu|agendafacil\.com/i, "Agenda Fácil"],
];

const instagramRe =
  /instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/|stories\/)([A-Za-z0-9._]{2,30})/i;

/** O que dá para afirmar lendo o HTML do site (sem IA, sem navegador). */
export function readSite(html: string) {
  const text = html.slice(0, 600_000);
  const tool = bookingTools.find(([pattern]) => pattern.test(text));
  const handle = text.match(instagramRe)?.[1]?.replace(/\.$/, "") || "";
  return {
    bookingTool: tool ? tool[1] : null,
    usesStudioFlow: tool?.[1] === "StudioFlow",
    whatsappOnSite: /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(text),
    instagram: /^(sharer|share|instagram)$/i.test(handle) ? "" : handle,
  };
}

/** Instagram digitado de qualquer jeito vira só o @, sem link. */
export function instagramHandle(value: string | null | undefined) {
  const raw = (value || "").trim();
  const fromUrl = raw.match(instagramRe)?.[1];
  const handle = (fromUrl || raw).replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{2,30}$/.test(handle) ? handle : "";
}

/**
 * Nota de 0 a 100 e o porquê, na língua de quem vende. Quem já usa a
 * StudioFlow sai do jogo; sem telefone não dá para falar com a casa.
 */
export function scoreLead(lead: LeadFacts) {
  const reasons: string[] = [];
  if (lead.signals.usesStudioFlow) return { score: 0, reasons: ["Já usa a StudioFlow"] };
  let score = 0;
  if (lead.signals.bookingTool) {
    score += 5;
    reasons.push(`Já agenda pelo ${lead.signals.bookingTool}: campanha de troca`);
  } else if (lead.signals.siteRead || !lead.website) {
    score += 35;
    reasons.push("Sem agendamento online");
  } else {
    score += 18;
    reasons.push("Site não abriu: agendamento online não confirmado");
  }
  if (isMobile(lead.phone)) {
    score += 20;
    reasons.push("Celular com WhatsApp");
  } else if (lead.phone) {
    score += 5;
    reasons.push("Só telefone fixo");
  } else reasons.push("Sem telefone");
  const reviews = lead.reviews ?? 0;
  if (reviews >= 150) {
    score += 15;
    reasons.push(`${reviews} avaliações: casa movimentada`);
  } else if (reviews >= 40) {
    score += 12;
    reasons.push(`${reviews} avaliações`);
  } else if (reviews >= 10) score += 6;
  if ((lead.rating ?? 0) >= 4.5) {
    score += 10;
    reasons.push(`Nota ${lead.rating?.toFixed(1).replace(".", ",")} no Google`);
  } else if ((lead.rating ?? 0) >= 4) score += 6;
  if (lead.instagram) {
    score += 8;
    reasons.push("Tem Instagram");
  }
  if (!lead.website) {
    score += 7;
    reasons.push("Sem site: a página da StudioFlow vira o site dela");
  }
  return { score: Math.min(100, score), reasons };
}

const firstWord = (value: string) => value.trim().split(/\s+/)[0] || "";

/**
 * Mensagem de reserva, quando a IA está desligada: curta, de barbeiro para
 * barbeiro, com um fato da casa, a oferta e a saída para quem não quer.
 */
export function fallbackMessage(lead: LeadFacts, sender: string) {
  const fact = lead.signals.bookingTool
    ? `Vi que vocês agendam pelo ${lead.signals.bookingTool}.`
    : (lead.reviews ?? 0) >= 40
      ? `Vi as ${lead.reviews} avaliações de vocês no Google${(lead.rating ?? 0) >= 4.5 ? `, nota ${lead.rating?.toFixed(1).replace(".", ",")}` : ""}. Casa cheia, né?`
      : `Vi a ${lead.name} aqui no Google.`;
  const who = sender ? `Aqui é o ${firstWord(sender)}, da StudioFlow.` : "Aqui é da StudioFlow.";
  return [
    `Fala, tudo certo? ${who}`,
    `${fact} A gente tem uma agenda online pra barbearia: o cliente marca sozinho pelo link, recebe lembrete no WhatsApp e a falta cai bastante.`,
    "Tô liberando 30 dias grátis pra testar, sem compromisso. Posso te mandar o link pra você ver como fica com a cara da sua barbearia?",
    "Se não fizer sentido, é só me falar que eu não mando mais 👍",
  ].join("\n\n");
}
