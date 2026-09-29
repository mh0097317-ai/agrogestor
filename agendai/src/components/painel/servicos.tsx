"use client";

import { useState, useTransition } from "react";
import { Clock, Loader2, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { excluirServico, salvarServico } from "@/modules/painel/actions";
import { cn, formatarDuracao, formatarPreco } from "@/lib/utils";
import { AreaTexto, Botao, Campo, Cartao, Rotulo, Selecao, Selo, Vazio } from "@/components/ui";
import { Cabecalho } from "./cabecalho";
import { Gaveta } from "./gaveta";

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  duracaoMin: number;
  precoCentavos: number;
  ativo: boolean;
  agendamentos: number;
};

const DURACOES = [10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240];

export function GerenciarServicos({ servicos }: { servicos: Servico[] }) {
  const [editando, setEditando] = useState<Servico | "novo" | null>(null);

  return (
    <div>
      <Cabecalho titulo="Serviços" subtitulo="O que seus clientes podem agendar online">
        <Botao onClick={() => setEditando("novo")}>
          <Plus className="size-4" /> Novo serviço
        </Botao>
      </Cabecalho>

      {servicos.length === 0 ? (
        <Cartao>
          <Vazio icone={<Scissors className="size-6" />} titulo="Nenhum serviço ainda" texto="Cadastre o que você oferece, com duração e preço.">
            <Botao onClick={() => setEditando("novo")}>
              <Plus className="size-4" /> Cadastrar serviço
            </Botao>
          </Vazio>
        </Cartao>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {servicos.map((s) => (
            <Cartao key={s.id} className={cn("group flex flex-col p-5 transition hover:shadow-flutuante", !s.ativo && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold leading-tight text-ink">{s.nome}</h3>
                {!s.ativo && <Selo>Oculto</Selo>}
              </div>
              {s.descricao && <p className="mt-1 line-clamp-2 text-sm text-suave">{s.descricao}</p>}
              <div className="mt-auto flex items-end justify-between pt-5">
                <div>
                  <p className="font-display text-2xl font-extrabold text-ink">{formatarPreco(s.precoCentavos)}</p>
                  <p className="inline-flex items-center gap-1 text-sm text-suave">
                    <Clock className="size-3.5" /> {formatarDuracao(s.duracaoMin)}
                  </p>
                </div>
                <Botao variante="secundario" tamanho="sm" onClick={() => setEditando(s)}>
                  <Pencil className="size-3.5" /> Editar
                </Botao>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {editando && <EditorServico servico={editando === "novo" ? null : editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

function EditorServico({ servico, aoFechar }: { servico: Servico | null; aoFechar: () => void }) {
  const [form, setForm] = useState({
    nome: servico?.nome ?? "",
    descricao: servico?.descricao ?? "",
    duracaoMin: String(servico?.duracaoMin ?? 30),
    preco: servico ? (servico.precoCentavos / 100).toFixed(2).replace(".", ",") : "",
    ativo: servico?.ativo ?? true,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const duracoes = DURACOES.includes(Number(form.duracaoMin)) ? DURACOES : [...DURACOES, Number(form.duracaoMin)].sort((a, b) => a - b);

  return (
    <Gaveta aberta aoFechar={aoFechar} titulo={servico ? "Editar serviço" : "Novo serviço"}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErro(null);
          iniciar(async () => {
            const r = await salvarServico({ ...form, id: servico?.id });
            if (r.erro) setErro(r.erro);
            else aoFechar();
          });
        }}
      >
        <div>
          <Rotulo htmlFor="sv-nome">Nome</Rotulo>
          <Campo id="sv-nome" required placeholder="Ex.: Corte + Barba" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div>
          <Rotulo htmlFor="sv-desc" dica="Aparece para o cliente">
            Descrição
          </Rotulo>
          <AreaTexto id="sv-desc" rows={2} maxLength={200} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Rotulo htmlFor="sv-dur">Duração</Rotulo>
            <Selecao id="sv-dur" value={form.duracaoMin} onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })}>
              {duracoes.map((d) => (
                <option key={d} value={d}>
                  {formatarDuracao(d)}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="sv-preco">Preço (R$)</Rotulo>
            <Campo id="sv-preco" inputMode="decimal" required placeholder="45,00" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-4 py-3 text-sm font-medium text-ink">
          Disponível para agendamento online
          <input type="checkbox" className="size-4 accent-marca-500" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
        </label>
        {erro && <p className="rounded-xl bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{erro}</p>}
        <Botao tamanho="lg" disabled={pendente}>
          {pendente && <Loader2 className="size-5 animate-spin" />} Salvar
        </Botao>
        {servico && (
          <button
            type="button"
            disabled={pendente}
            onClick={() => {
              const msg = servico.agendamentos > 0
                ? "Esse serviço tem histórico de agendamentos, então ele será ocultado (não excluído). Continuar?"
                : "Excluir este serviço?";
              if (confirm(msg)) iniciar(async () => { await excluirServico(servico.id); aoFechar(); });
            }}
            className="inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-erro hover:underline"
          >
            <Trash2 className="size-4" /> {servico.agendamentos > 0 ? "Ocultar serviço" : "Excluir serviço"}
          </button>
        )}
      </form>
    </Gaveta>
  );
}
