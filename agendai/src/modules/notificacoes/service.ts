import "server-only";
import type { CanalNotificacao, Destinatario, TipoNotificacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/utils";
import { ymdDe } from "@/lib/tempo";
import { mensagemCliente, mensagemDono, type DadosMensagem } from "./mensagens";
import { enviarEmail, enviarWhatsapp } from "./provedores";

type Envio = { destinatario: Destinatario; canal: CanalNotificacao; para: string | null };

/**
 * Gera e envia os avisos de um evento do agendamento.
 * Tudo fica registrado em Notificacao (histórico no painel), inclusive o que foi simulado.
 */
export async function notificar(
  agendamentoId: string,
  tipo: TipoNotificacao,
  opts: { cliente?: boolean; dono?: boolean } = { cliente: true, dono: true },
) {
  const ag = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      negocio: { include: { usuarios: { where: { papel: "DONO" }, take: 1 } } },
      cliente: true,
      servico: true,
      profissional: true,
    },
  });
  if (!ag) return;
  const n = ag.negocio;

  const dados: DadosMensagem = {
    negocio: n,
    cliente: ag.cliente,
    servico: ag.servico,
    profissional: ag.profissional,
    inicio: ag.inicio,
    precoCentavos: ag.precoCentavos,
    status: ag.status,
    observacao: ag.observacao,
    motivo: ag.motivoCancelamento,
    linkCliente: `${appUrl()}/agendamento/${ag.token}`,
    linkPainel: `${appUrl()}/painel/agenda?data=${ymdDe(ag.inicio, n.fusoHorario)}`,
  };

  const envios: Envio[] = [];
  if (opts.cliente) {
    if (n.notificarClienteWhatsapp) envios.push({ destinatario: "CLIENTE", canal: "WHATSAPP", para: ag.cliente.telefone });
    if (n.notificarClienteEmail && ag.cliente.email) envios.push({ destinatario: "CLIENTE", canal: "EMAIL", para: ag.cliente.email });
  }
  if (opts.dono) {
    envios.push({ destinatario: "DONO", canal: "PAINEL", para: null });
    if (n.notificarDonoWhatsapp && n.whatsapp) envios.push({ destinatario: "DONO", canal: "WHATSAPP", para: n.whatsapp });
    const emailDono = n.email ?? n.usuarios[0]?.email;
    if (n.notificarDonoEmail && emailDono) envios.push({ destinatario: "DONO", canal: "EMAIL", para: emailDono });
  }

  await Promise.all(
    envios.map(async (e) => {
      const { titulo, mensagem } = e.destinatario === "CLIENTE" ? mensagemCliente(tipo, dados) : mensagemDono(tipo, dados);
      const registro = await prisma.notificacao.create({
        data: {
          negocioId: n.id,
          agendamentoId: ag.id,
          destinatario: e.destinatario,
          canal: e.canal,
          tipo,
          para: e.para,
          titulo,
          mensagem,
          status: "PENDENTE",
        },
      });

      const resultado =
        e.canal === "PAINEL"
          ? { status: "ENVIADA" as const }
          : e.canal === "WHATSAPP"
            ? await enviarWhatsapp(e.para!, mensagem)
            : await enviarEmail(e.para!, titulo, mensagem);

      await prisma.notificacao.update({
        where: { id: registro.id },
        data: {
          status: resultado.status,
          erro: resultado.erro,
          enviadaEm: resultado.status === "ENVIADA" ? new Date() : null,
        },
      });
    }),
  );
}
