import type { TipoNotificacao } from "@prisma/client";
import { formatarPreco, formatarTelefone } from "@/lib/utils";
import { formatarHora, formatarNoFuso } from "@/lib/tempo";

export interface DadosMensagem {
  negocio: { nome: string; fusoHorario: string; endereco: string | null; whatsapp: string | null };
  cliente: { nome: string; telefone: string };
  servico: { nome: string };
  profissional: { nome: string };
  inicio: Date;
  precoCentavos: number;
  status: string;
  observacao: string | null;
  linkCliente: string;
  linkPainel: string;
  motivo?: string | null;
}

type Msg = { titulo: string; mensagem: string };

function quando(d: DadosMensagem) {
  const data = formatarNoFuso(d.inicio, d.negocio.fusoHorario, "EEEE, dd/MM").toLowerCase();
  return { data, hora: formatarHora(d.inicio, d.negocio.fusoHorario) };
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0];
}

export function mensagemCliente(tipo: TipoNotificacao, d: DadosMensagem): Msg {
  const { data, hora } = quando(d);
  const nome = primeiroNome(d.cliente.nome);
  const onde = d.negocio.endereco ? `\n📍 ${d.negocio.endereco}` : "";
  const detalhes = `✂️ *${d.servico.nome}* com ${d.profissional.nome}\n📅 ${data} às *${hora}*\n💰 ${formatarPreco(d.precoCentavos)}${onde}`;

  switch (tipo) {
    case "NOVO_AGENDAMENTO":
      if (d.status === "PENDENTE") {
        return {
          titulo: `Recebemos seu pedido — ${d.negocio.nome}`,
          mensagem: `Olá, ${nome}! 👋\n\nRecebemos seu pedido de horário na *${d.negocio.nome}*:\n\n${detalhes}\n\nAssim que confirmarmos, você recebe uma mensagem. Para ver ou cancelar: ${d.linkCliente}`,
        };
      }
      return {
        titulo: `Horário confirmado — ${d.negocio.nome}`,
        mensagem: `Olá, ${nome}! ✅\n\nSeu horário na *${d.negocio.nome}* está confirmado:\n\n${detalhes}\n\nPrecisa remarcar ou cancelar? ${d.linkCliente}\n\nAté lá! 💈`,
      };
    case "CONFIRMACAO":
      return {
        titulo: `Horário confirmado — ${d.negocio.nome}`,
        mensagem: `Oba, ${nome}! ✅ A *${d.negocio.nome}* confirmou seu horário:\n\n${detalhes}\n\nDetalhes: ${d.linkCliente}`,
      };
    case "LEMBRETE":
      return {
        titulo: `Lembrete: ${d.servico.nome} ${data} às ${hora}`,
        mensagem: `Oi, ${nome}! ⏰ Passando pra lembrar do seu horário na *${d.negocio.nome}*:\n\n${detalhes}\n\nNão vai conseguir ir? Cancele pelo link para liberar o horário: ${d.linkCliente}`,
      };
    case "CANCELAMENTO":
      return {
        titulo: `Agendamento cancelado — ${d.negocio.nome}`,
        mensagem: `Olá, ${nome}. Seu horário de *${d.servico.nome}* (${data} às ${hora}) na *${d.negocio.nome}* foi cancelado.${d.motivo ? `\nMotivo: ${d.motivo}` : ""}\n\nQuer marcar outro? ${d.linkCliente.replace(/\/agendamento\/.*/, "")}`,
      };
    default:
      return {
        titulo: `Atualização do seu horário — ${d.negocio.nome}`,
        mensagem: `Olá, ${nome}! Seu agendamento na *${d.negocio.nome}* foi atualizado.\n\n${detalhes}\n\n${d.linkCliente}`,
      };
  }
}

export function mensagemDono(tipo: TipoNotificacao, d: DadosMensagem): Msg {
  const { data, hora } = quando(d);
  const cliente = `${d.cliente.nome} · ${formatarTelefone(d.cliente.telefone)}`;
  const obs = d.observacao ? `\n📝 "${d.observacao}"` : "";

  switch (tipo) {
    case "NOVO_AGENDAMENTO":
      return {
        titulo: `Novo agendamento: ${d.cliente.nome} — ${data} ${hora}`,
        mensagem: `🔔 *Novo agendamento${d.status === "PENDENTE" ? " (aguardando sua confirmação)" : ""}*\n\n👤 ${cliente}\n✂️ ${d.servico.nome} com ${d.profissional.nome}\n📅 ${data} às *${hora}*\n💰 ${formatarPreco(d.precoCentavos)}${obs}\n\nVer na agenda: ${d.linkPainel}`,
      };
    case "CANCELAMENTO":
      return {
        titulo: `Cancelado: ${d.cliente.nome} — ${data} ${hora}`,
        mensagem: `❌ *Agendamento cancelado pelo cliente*\n\n👤 ${cliente}\n✂️ ${d.servico.nome} com ${d.profissional.nome}\n📅 ${data} às ${hora}${d.motivo ? `\nMotivo: ${d.motivo}` : ""}\n\nO horário já está livre na agenda.`,
      };
    default:
      return {
        titulo: `Atualização: ${d.cliente.nome} — ${data} ${hora}`,
        mensagem: `Agendamento de ${cliente} (${d.servico.nome}, ${data} às ${hora}) foi atualizado.`,
      };
  }
}
