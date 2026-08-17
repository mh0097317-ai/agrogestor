import { z } from "zod";

/** Converte string pt-BR ("184,3") ou number em número; vazio → undefined. */
export const decimalBR = (msg = "Número inválido") =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "number") return v;
    const n = Number(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? v : n;
  }, z.number({ message: msg }).nonnegative(msg).optional());

/** Igual ao decimalBR, mas obrigatório. */
export const decimalBRObrigatorio = (msg = "Informe um número válido") =>
  z.preprocess((v) => {
    if (typeof v === "number") return v;
    const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? v : n;
  }, z.number({ message: msg }).positive(msg));
