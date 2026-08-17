import { z } from "zod";
import { decimalBR } from "@/modules/shared/decimal";

export const StatusSafraValues = ["PLANEJADA", "EM_ANDAMENTO", "COLHIDA", "ENCERRADA"] as const;
export const EtapaValues = ["PLANEJAMENTO", "PLANTIO", "MANEJO", "COLHEITA", "COMERCIALIZACAO"] as const;
export const StatusEtapaValues = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"] as const;

export const safraSchema = z.object({
  nome: z.string().min(2, "Informe o nome (ex.: 2026/2027)"),
  fazendaId: z.string().optional(),
  culturaId: z.string().optional(),
  status: z.enum(StatusSafraValues).default("PLANEJADA"),
  precoVendaPrevisto: decimalBR("Preço inválido"),
  produtividadeEstimada: decimalBR("Produtividade inválida"),
  talhaoIds: z.array(z.string()).default([]),
});

export type SafraInput = z.infer<typeof safraSchema>;

export const etapaUpdateSchema = z.object({
  etapa: z.enum(EtapaValues),
  status: z.enum(StatusEtapaValues),
});
