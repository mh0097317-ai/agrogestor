import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Helpers de data/hora sempre relativos ao fuso do negócio.
 * No banco tudo é UTC; "ymd" é uma data de calendário local no formato YYYY-MM-DD.
 */

export function partesYmd(ymd: string): [number, number, number] {
  const [a, m, d] = ymd.split("-").map(Number);
  return [a, m, d];
}

/** Dia da semana (0 = domingo) de uma data de calendário — independe de fuso. */
export function diaSemanaDe(ymd: string): number {
  const [a, m, d] = partesYmd(ymd);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Instante UTC correspondente a `ymd` + `minutos` desde meia-noite no fuso informado. */
export function instante(ymd: string, minutos: number, fuso: string): Date {
  const [a, m, d] = partesYmd(ymd);
  return new Date(new TZDate(a, m - 1, d, Math.floor(minutos / 60), minutos % 60, fuso).getTime());
}

export function noFuso(data: Date, fuso: string): TZDate {
  return new TZDate(data.getTime(), fuso);
}

export function ymdDe(data: Date, fuso: string): string {
  return format(noFuso(data, fuso), "yyyy-MM-dd");
}

export function hojeYmd(fuso: string): string {
  return ymdDe(new Date(), fuso);
}

export function somarDiasYmd(ymd: string, dias: number): string {
  const [a, m, d] = partesYmd(ymd);
  return format(addDays(new Date(a, m - 1, d), dias), "yyyy-MM-dd");
}

export function minutosDoDia(data: Date, fuso: string): number {
  const z = noFuso(data, fuso);
  return z.getHours() * 60 + z.getMinutes();
}

export function formatarHora(data: Date, fuso: string): string {
  return format(noFuso(data, fuso), "HH:mm");
}

/** Formata com padrão do date-fns em pt-BR, no fuso do negócio. */
export function formatarNoFuso(data: Date, fuso: string, padrao: string): string {
  return primeiraMaiuscula(format(noFuso(data, fuso), padrao, { locale: ptBR }));
}

/** Formata uma data de calendário (YYYY-MM-DD) em pt-BR. */
export function formatarYmd(ymd: string, padrao: string): string {
  const [a, m, d] = partesYmd(ymd);
  return primeiraMaiuscula(format(new Date(a, m - 1, d), padrao, { locale: ptBR }));
}

function primeiraMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 540 → "09:00" */
export function minParaHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "09:30" → 570 */
export function horaParaMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function descreverDataRelativa(ymd: string, fuso: string): string {
  const hoje = hojeYmd(fuso);
  if (ymd === hoje) return "Hoje";
  if (ymd === somarDiasYmd(hoje, 1)) return "Amanhã";
  return formatarYmd(ymd, "EEEE, d 'de' MMMM");
}
