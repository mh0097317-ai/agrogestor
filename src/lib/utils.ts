import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes condicionais + resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata valor em Real (R$). */
export function formatBRL(value: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(value);
}

/** Formata número no padrão pt-BR. */
export function formatNumber(value: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("pt-BR", opts).format(value);
}

/** Formata hectares. */
export function formatHa(value: number) {
  return `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ha`;
}
