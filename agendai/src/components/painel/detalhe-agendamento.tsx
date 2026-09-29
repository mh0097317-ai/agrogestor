"use client";

import { useState, useTransition } from "react";
import { Ban, Check, CheckCheck, ExternalLink, Loader2, MessageCircle, Phone, UserX } from "lucide-react";
import type { StatusAgendamento } from "@prisma/client";
import { mudarStatus } from "@/modules/painel/actions";
import type { AgendamentoVM } from "@/modules/painel/vm";
import { formatarDuracao, formatarPreco, formatarTelefone, linkWhatsapp } from "@/lib/utils";
import { AreaTexto, Avatar, Botao, SeloStatus } from "@/components/ui";
import { Gaveta } from "./gaveta";

export function DetalheAgendamento({
  ag,
  nomeNegocio,
  aoFechar,
}: {
  ag: AgendamentoVM | null;
  nomeNegocio: string;
  aoFechar: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [acao, setAcao] = useState<StatusAgendamento | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function executar(status: StatusAgendamento) {
    if (!ag) return;
    setErro(null);
    setAcao(status);
    iniciar(async () => {
      const r = await mudarStatus(ag.id, status, motivo);
      if (r.erro) setErro(r.erro);
      else {
        setCancelando(false);
        setMotivo("");
        aoFechar();
      }
    });
  }

  if (!ag) return <Gaveta aberta={false} aoFechar={aoFechar} titulo="">{null}</Gaveta>;

  const ativo = ag.status === "PENDENTE" || ag.status === "CONFIRMADO";
  const primeiro = ag.cliente.nome.split(" ")[0];
  const msgLembrete = `Olá, ${primeiro}! Passando pra lembrar do seu horário de ${ag.servico.nome} na ${nomeNegocio}: ${ag.dataExtenso.toLowerCase()} às ${ag.hora}. Te esperamos! 💈`;
  const spin = (s: StatusAgendamento) => pendente && acao === s;

  return (
    <Gaveta aberta={!!ag} aoFechar={aoFechar} titulo={ag.dataExtenso}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-4xl font-extrabold tabular-nums text-ink">{ag.hora}</p>
          <p className="text-sm text-suave">
            até {ag.horaFim} · {formatarDuracao(ag.servico.duracaoMin)}
          </p>
        </div>
        <SeloStatus status={ag.status} />
      </div>

      <div className="mt-5 rounded-2xl border border-linha p-4">
        <div className="flex items-center gap-3">
          <Avatar nome={ag.cliente.nome} tamanho={44} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{ag.cliente.nome}</p>
            <p className="text-sm text-suave">{formatarTelefone(ag.cliente.telefone)}</p>
          </div>
          <a href={`tel:+${ag.cliente.telefone}`} className="grid size-10 place-items-center rounded-full bg-fundo text-ink hover:bg-linha" aria-label="Ligar">
            <Phone className="size-4" />
          </a>
          <a
            href={linkWhatsapp(ag.cliente.telefone, `Olá, ${primeiro}!`)}
            target="_blank"
            rel="noreferrer"
            className="grid size-10 place-items-center rounded-full bg-[#25D366]/10 text-[#128C4B] hover:bg-[#25D366]/20"
            aria-label="WhatsApp"
          >
            <MessageCircle className="size-4" />
          </a>
        </div>
        {ag.observacao && <p className="mt-3 rounded-xl bg-alerta-bg px-3 py-2 text-sm text-ink">📝 {ag.observacao}</p>}
      </div>

      <dl className="mt-4 divide-y divide-linha rounded-2xl border border-linha text-sm">
        <div className="flex justify-between px-4 py-3">
          <dt className="text-suave">Serviço</dt>
          <dd className="font-semibold text-ink">{ag.servico.nome}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-suave">Profissional</dt>
          <dd className="flex items-center gap-2 font-semibold text-ink">
            <span className="size-2.5 rounded-full" style={{ background: ag.profissional.cor }} /> {ag.profissional.nome}
          </dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-suave">Valor</dt>
          <dd className="font-display font-bold text-ink">{formatarPreco(ag.precoCentavos)}</dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-suave">Origem</dt>
          <dd className="text-ink">{ag.origem === "ONLINE" ? "Agendou pelo link" : "Lançado no painel"}</dd>
        </div>
      </dl>

      {erro && <p className="mt-4 rounded-xl bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{erro}</p>}

      <div className="mt-5 grid gap-2">
        {ag.status === "PENDENTE" && (
          <Botao onClick={() => executar("CONFIRMADO")} disabled={pendente}>
            {spin("CONFIRMADO") ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmar e avisar cliente
          </Botao>
        )}
        {ativo && (
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="escuro" onClick={() => executar("CONCLUIDO")} disabled={pendente}>
              {spin("CONCLUIDO") ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />} Atendido
            </Botao>
            <Botao variante="secundario" onClick={() => executar("NAO_COMPARECEU")} disabled={pendente}>
              {spin("NAO_COMPARECEU") ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />} Faltou
            </Botao>
          </div>
        )}
        {ativo && (
          <a
            href={linkWhatsapp(ag.cliente.telefone, msgLembrete)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-linha-forte text-sm font-semibold text-ink hover:bg-fundo"
          >
            <MessageCircle className="size-4 text-[#25D366]" /> Enviar lembrete no WhatsApp
          </a>
        )}
        {!ativo && (
          <Botao variante="secundario" onClick={() => executar("CONFIRMADO")} disabled={pendente}>
            {spin("CONFIRMADO") && <Loader2 className="size-4 animate-spin" />} Reabrir como confirmado
          </Botao>
        )}
        <a
          href={`/agendamento/${ag.token}`}
          target="_blank"
          className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-suave hover:text-ink"
        >
          Ver página do cliente <ExternalLink className="size-3" />
        </a>

        {ativo &&
          (cancelando ? (
            <div className="animate-surgir rounded-2xl border border-erro/20 bg-erro-bg/40 p-3">
              <AreaTexto rows={2} placeholder="Motivo (vai na mensagem ao cliente)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="bg-papel" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Botao variante="secundario" onClick={() => setCancelando(false)}>
                  Voltar
                </Botao>
                <Botao variante="perigo" onClick={() => executar("CANCELADO")} disabled={pendente}>
                  {spin("CANCELADO") && <Loader2 className="size-4 animate-spin" />} Cancelar
                </Botao>
              </div>
            </div>
          ) : (
            <button onClick={() => setCancelando(true)} className="inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-erro hover:underline">
              <Ban className="size-4" /> Cancelar agendamento
            </button>
          ))}
      </div>
    </Gaveta>
  );
}
