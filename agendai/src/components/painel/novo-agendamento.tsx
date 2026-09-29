"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { criarAgendamento } from "@/modules/painel/actions";
import { cn, formatarDuracao, formatarPreco } from "@/lib/utils";
import { AreaTexto, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { mascaraTelefone } from "@/components/mascara";
import { Gaveta } from "./gaveta";

type Opcoes = {
  slug: string;
  dataInicial: string;
  servicos: { id: string; nome: string; duracaoMin: number; precoCentavos: number }[];
  profissionais: { id: string; nome: string; servicos: string[] }[];
};

export function BotaoNovoAgendamento(props: Opcoes & { className?: string; compacto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao onClick={() => setAberto(true)} className={props.className}>
        <Plus className="size-4" /> {props.compacto ? "Novo" : "Novo agendamento"}
      </Botao>
      {aberto && <FormNovoAgendamento {...props} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function FormNovoAgendamento({ slug, dataInicial, servicos, profissionais, aoFechar }: Opcoes & { aoFechar: () => void }) {
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");
  const prosDoServico = profissionais.filter((p) => p.servicos.includes(servicoId));
  const [profissionalId, setProfissionalId] = useState(prosDoServico[0]?.id ?? "");
  const [data, setData] = useState(dataInicial);
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    if (!prosDoServico.some((p) => p.id === profissionalId)) setProfissionalId(prosDoServico[0]?.id ?? "");
  }, [servicoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!servicoId || !profissionalId || !data) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ negocio: slug, servico: servicoId, profissional: profissionalId, data });
    fetch(`/api/horarios?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setSugestoes((j.horarios ?? []).map((h: { hora: string }) => h.hora)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [slug, servicoId, profissionalId, data]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await criarAgendamento({ servicoId, profissionalId, data, hora, nome, telefone, observacao, avisarCliente: avisar });
      if (r.erro) setErro(r.erro);
      else aoFechar();
    });
  }

  return (
    <Gaveta aberta aoFechar={aoFechar} titulo="Novo agendamento">
      <form onSubmit={salvar} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Rotulo htmlFor="na-nome">Cliente</Rotulo>
            <Campo id="na-nome" required placeholder="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="na-tel">WhatsApp</Rotulo>
            <Campo
              id="na-tel"
              type="tel"
              required
              placeholder="(11) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="na-serv">Serviço</Rotulo>
            <Selecao id="na-serv" value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · {formatarDuracao(s.duracaoMin)} · {formatarPreco(s.precoCentavos)}
                </option>
              ))}
            </Selecao>
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="na-pro">Profissional</Rotulo>
            <Selecao id="na-pro" value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)}>
              {prosDoServico.length === 0 && <option value="">Ninguém faz esse serviço</option>}
              {prosDoServico.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="na-data">Data</Rotulo>
            <Campo id="na-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Rotulo htmlFor="na-hora">Horário</Rotulo>
            <Campo id="na-hora" type="time" required step={300} value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>

        {sugestoes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-suave">Horários livres</p>
            <div className="flex flex-wrap gap-1.5">
              {sugestoes.slice(0, 24).map((h) => (
                <button
                  type="button"
                  key={h}
                  onClick={() => setHora(h)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums",
                    hora === h ? "border-ink bg-ink text-white" : "border-linha text-ink hover:border-ink",
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Rotulo htmlFor="na-obs" dica="Opcional">
            Observação
          </Rotulo>
          <AreaTexto id="na-obs" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>

        <label className="flex items-center gap-3 rounded-xl bg-fundo px-4 py-3 text-sm font-medium text-ink">
          <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="size-4 accent-marca-500" />
          Enviar confirmação para o cliente no WhatsApp
        </label>

        {erro && <p className="rounded-xl bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{erro}</p>}

        <Botao tamanho="lg" disabled={pendente || !profissionalId}>
          {pendente && <Loader2 className="size-5 animate-spin" />} Agendar
        </Botao>
      </form>
    </Gaveta>
  );
}
