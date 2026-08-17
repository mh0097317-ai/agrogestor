import { z } from "zod";
import { decimalBR } from "@/modules/shared/decimal";

export const fazendaSchema = z.object({
  nome: z.string().min(2, "Informe o nome da fazenda"),
  produtorNome: z.string().optional(),
  documento: z.string().optional(),
  municipio: z.string().optional(),
  estado: z.string().max(2, "Use a sigla (ex.: GO)").optional().or(z.literal("")),
  areaTotal: decimalBR("Área total inválida"),
  areaProdutiva: decimalBR("Área produtiva inválida"),
  observacoes: z.string().optional(),
});

export type FazendaInput = z.infer<typeof fazendaSchema>;
