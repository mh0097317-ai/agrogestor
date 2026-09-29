import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarPreco(centavos: number): string {
  return brl.format(centavos / 100);
}

/** "35,90" | "35.90" | "35" → 3590 */
export function parsePreco(valor: string): number {
  const limpo = valor.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatarDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Normaliza telefone brasileiro para só dígitos com DDI 55 (ex.: 5511999998888). */
export function normalizarTelefone(entrada: string): string {
  let d = entrada.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

export function telefoneValido(entrada: string): boolean {
  const d = normalizarTelefone(entrada);
  return d.length >= 12 && d.length <= 13;
}

/** 5511999998888 → (11) 99999-8888 */
export function formatarTelefone(tel: string | null | undefined): string {
  if (!tel) return "";
  const d = tel.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

export function linkWhatsapp(tel: string, mensagem?: string): string {
  const d = normalizarTelefone(tel);
  return `https://wa.me/${d}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
