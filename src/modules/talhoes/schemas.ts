import { z } from "zod";
import { decimalBRObrigatorio } from "@/modules/shared/decimal";

export const StatusTalhaoValues = [
  "DISPONIVEL",
  "EM_PLANTIO",
  "EM_MANEJO",
  "EM_PRODUCAO",
  "EM_COLHEITA",
  "ATENCAO",
  "INATIVO",
] as const;

export const talhaoSchema = z.object({
  fazendaId: z.string().min(1, "Selecione a fazenda"),
  codigo: z.string().min(1, "Informe o código (ex.: T-03)"),
  nome: z.string().optional(),
  area: decimalBRObrigatorio("Informe a área em hectares"),
  culturaAtualId: z.string().optional(),
  status: z.enum(StatusTalhaoValues).default("DISPONIVEL"),
});

export type TalhaoInput = z.infer<typeof talhaoSchema>;
