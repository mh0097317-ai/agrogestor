import type { StatusTalhao, StatusSafra, StatusEtapa, NivelAlerta } from "@prisma/client";
import type { Tom } from "@/components/ui/badge";

export const statusTalhao: Record<StatusTalhao, { label: string; tom: Tom }> = {
  DISPONIVEL: { label: "Disponível", tom: "gray" },
  EM_PLANTIO: { label: "Em plantio", tom: "blue" },
  EM_MANEJO: { label: "Em manejo", tom: "amber" },
  EM_PRODUCAO: { label: "Em produção", tom: "green" },
  EM_COLHEITA: { label: "Em colheita", tom: "blue" },
  ATENCAO: { label: "Atenção", tom: "red" },
  INATIVO: { label: "Inativo", tom: "gray" },
};

export const statusSafra: Record<StatusSafra, { label: string; tom: Tom }> = {
  PLANEJADA: { label: "Planejada", tom: "gray" },
  EM_ANDAMENTO: { label: "Em andamento", tom: "green" },
  COLHIDA: { label: "Colhida", tom: "blue" },
  ENCERRADA: { label: "Encerrada", tom: "gray" },
};

export const statusEtapa: Record<StatusEtapa, { label: string; tom: Tom }> = {
  PENDENTE: { label: "Pendente", tom: "gray" },
  EM_ANDAMENTO: { label: "Em andamento", tom: "amber" },
  CONCLUIDA: { label: "Concluída", tom: "green" },
};

export const nivelAlerta: Record<NivelAlerta, { label: string; tom: Tom }> = {
  INFO: { label: "Info", tom: "gray" },
  ATENCAO: { label: "Atenção", tom: "amber" },
  CRITICO: { label: "Crítico", tom: "red" },
};

export const ETAPAS_LABEL: Record<string, string> = {
  PLANEJAMENTO: "Planejamento",
  PLANTIO: "Plantio",
  MANEJO: "Manejo",
  COLHEITA: "Colheita",
  COMERCIALIZACAO: "Comercialização",
};
