import type { Agendamento, Cliente, Profissional, Servico, StatusAgendamento } from "@prisma/client";
import { formatarHora, formatarNoFuso } from "@/lib/tempo";

/** Formato serializável de um agendamento para componentes cliente do painel. */
export interface AgendamentoVM {
  id: string;
  token: string;
  inicio: string;
  fim: string;
  hora: string;
  horaFim: string;
  dataExtenso: string;
  dataCurta: string;
  status: StatusAgendamento;
  origem: "ONLINE" | "PAINEL";
  precoCentavos: number;
  observacao: string | null;
  cliente: { nome: string; telefone: string };
  servico: { nome: string; duracaoMin: number };
  profissional: { id: string; nome: string; cor: string };
}

export function paraVM(
  a: Agendamento & { cliente: Cliente; servico: Servico; profissional: Profissional },
  fuso: string,
): AgendamentoVM {
  return {
    id: a.id,
    token: a.token,
    inicio: a.inicio.toISOString(),
    fim: a.fim.toISOString(),
    hora: formatarHora(a.inicio, fuso),
    horaFim: formatarHora(a.fim, fuso),
    dataExtenso: formatarNoFuso(a.inicio, fuso, "EEEE, d 'de' MMMM"),
    dataCurta: formatarNoFuso(a.inicio, fuso, "EEE dd/MM"),
    status: a.status,
    origem: a.origem,
    precoCentavos: a.precoCentavos,
    observacao: a.observacao,
    cliente: { nome: a.cliente.nome, telefone: a.cliente.telefone },
    servico: { nome: a.servico.nome, duracaoMin: a.servico.duracaoMin },
    profissional: { id: a.profissional.id, nome: a.profissional.nome, cor: a.profissional.cor },
  };
}

export const incluirVM = { cliente: true, servico: true, profissional: true } as const;
