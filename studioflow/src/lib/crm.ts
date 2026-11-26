import { z } from "zod";
import type { Customer } from "@/types";

/*
 * CRM: aniversários, consentimento e pedido de avaliação. Mensagem de
 * marketing só para quem consentiu; nada é disparado em massa: o painel
 * monta a mensagem e alguém da equipe envia, uma a uma.
 */
export const crmUpdateSchema = z
  .object({
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    marketingConsent: z.boolean().optional(),
    consentSource: z.enum(["painel", "cliente_pediu", "agendamento", "whatsapp_sair"]).optional(),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

/** Dias até o próximo aniversário (0 = hoje). 29/02 conta em 28/02 nos anos comuns. */
export function daysToBirthday(birthDate: string, today: string) {
  const [, m, d] = birthDate.split("-").map(Number);
  const [y] = today.split("-").map(Number);
  const at = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const day = m === 2 && d === 29 && !leap ? 28 : d;
    return Date.UTC(year, m - 1, day);
  };
  const now = Date.parse(`${today}T00:00:00Z`);
  let next = at(y);
  if (next < now) next = at(y + 1);
  return Math.round((next - now) / 86_400_000);
}

export function upcomingBirthdays(customers: Customer[], today: string, days = 7) {
  return customers
    .filter((c) => c.birthDate)
    .map((c) => ({ customer: c, inDays: daysToBirthday(c.birthDate!, today) }))
    .filter((b) => b.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays || a.customer.name.localeCompare(b.customer.name, "pt-BR"));
}

export const canMarket = (customer: Customer) => customer.marketingConsent === true;

export const optOutLine = "Se não quiser mais receber mensagens como esta, é só responder SAIR.";

export function birthdayMessage(customer: Customer, businessName: string) {
  return `Feliz aniversário, ${customer.name.split(" ")[0]}! Toda a equipe da ${businessName} deseja um ótimo dia. ${optOutLine}`;
}

/**
 * Pedido de avaliação neutro: o mesmo texto para todo atendimento concluído,
 * sem perguntar antes se gostou e sem filtrar quem recebe o link público.
 */
export function reviewRequestMessage(input: {
  customerName: string;
  businessName: string;
  reviewUrl?: string;
}) {
  const first = input.customerName.split(" ")[0];
  const where = input.reviewUrl
    ? `Se puder, deixe sua avaliação, seja ela qual for: ${input.reviewUrl}`
    : "Se puder, responda aqui contando como foi, seja o que for.";
  return `Olá, ${first}! Obrigado por vir à ${input.businessName}. Sua opinião sincera nos ajuda a melhorar. ${where}`;
}
