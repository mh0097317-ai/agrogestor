"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { excluirProfissional, salvarProfissional } from "@/modules/painel/actions";
import { cn } from "@/lib/utils";
import { DIAS_CURTOS } from "@/lib/tempo";
import { AreaTexto, Avatar, Botao, Campo, Cartao, Rotulo, Selo } from "@/components/ui";
import { Cabecalho } from "./cabecalho";
import { EditorHorarios, type Faixa } from "./editor-horarios";
import { Gaveta } from "./gaveta";

type Pro = { id: string; nome: string; bio: string; cor: string; ativo: boolean; servicos: string[]; jornada: Faixa[] };

export const CORES = ["#E4572E", "#C8872E", "#D94680", "#7B5CE0", "#2F6FDE", "#16A085", "#0F766E", "#17151C", "#B45309", "#9333EA"];

function resumoJornada(j: Faixa[]) {
  const dias = [1, 2, 3, 4, 5, 6, 0].filter((d) => j.some((f) => f.diaSemana === d));
  if (dias.length === 0) return "Sem horários";
  const primeira = j.find((f) => f.diaSemana === dias[0])!;
  return `${dias.map((d) => DIAS_CURTOS[d]).join(", ")} · ${primeira.inicio}–${j.filter((f) => f.diaSemana === dias[0]).at(-1)!.fim}`;
}

export function GerenciarEquipe({
  profissionais,
  servicos,
  horarioPadrao,
}: {
  profissionais: Pro[];
  servicos: { id: string; nome: string }[];
  horarioPadrao: Faixa[];
}) {
  const [editando, setEditando] = useState<Pro | null>(null);
  const novo = (): Pro => ({
    id: "",
    nome: "",
    bio: "",
    cor: CORES[profissionais.length % CORES.length],
    ativo: true,
    servicos: servicos.map((s) => s.id),
    jornada: horarioPadrao,
  });

  return (
    <div>
      <Cabecalho titulo="Equipe" subtitulo="Quem atende, quais serviços faz e em quais horários">
        <Botao onClick={() => setEditando(novo())}>
          <Plus className="size-4" /> Adicionar profissional
        </Botao>
      </Cabecalho>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {profissionais.map((p) => (
          <Cartao key={p.id} className={cn("p-5", !p.ativo && "opacity-60")}>
            <div className="flex items-center gap-3">
              <Avatar nome={p.nome} cor={p.cor} tamanho={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold text-ink">{p.nome}</p>
                <p className="truncate text-sm text-suave">{p.bio || `${p.servicos.length} serviço(s)`}</p>
              </div>
              {!p.ativo && <Selo>Inativo</Selo>}
            </div>
            <p className="mt-4 rounded-xl bg-fundo px-3 py-2 text-xs font-medium text-texto">{resumoJornada(p.jornada)}</p>
            <Botao variante="secundario" tamanho="sm" className="mt-4 w-full" onClick={() => setEditando(p)}>
              <Pencil className="size-3.5" /> Editar
            </Botao>
          </Cartao>
        ))}
      </div>

      {editando && <EditorProfissional pro={editando} servicos={servicos} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

function EditorProfissional({ pro, servicos, aoFechar }: { pro: Pro; servicos: { id: string; nome: string }[]; aoFechar: () => void }) {
  const [form, setForm] = useState(pro);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function alternarServico(id: string) {
    setForm((f) => ({ ...f, servicos: f.servicos.includes(id) ? f.servicos.filter((s) => s !== id) : [...f.servicos, id] }));
  }

  return (
    <Gaveta aberta aoFechar={aoFechar} titulo={pro.id ? `Editar ${pro.nome}` : "Novo profissional"} largura="max-w-lg">
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErro(null);
          iniciar(async () => {
            const r = await salvarProfissional({ ...form, id: form.id || undefined });
            if (r.erro) setErro(r.erro);
            else aoFechar();
          });
        }}
      >
        <div className="flex items-center gap-4">
          <Avatar nome={form.nome || "?"} cor={form.cor} tamanho={60} />
          <div className="flex flex-wrap gap-1.5">
            {CORES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, cor: c })}
                className="grid size-7 place-items-center rounded-full ring-offset-2 transition"
                style={{ background: c, boxShadow: form.cor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
                aria-label={`Cor ${c}`}
              >
                {form.cor === c && <Check className="size-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Rotulo htmlFor="pf-nome">Nome</Rotulo>
          <Campo id="pf-nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div>
          <Rotulo htmlFor="pf-bio" dica="Aparece para o cliente">
            Especialidade
          </Rotulo>
          <AreaTexto id="pf-bio" rows={2} maxLength={160} placeholder="Ex.: Especialista em degradê e barba" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>

        <div>
          <Rotulo>Serviços que realiza</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {servicos.map((s) => {
              const on = form.servicos.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => alternarServico(s.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                    on ? "border-ink bg-ink text-white" : "border-linha-forte text-suave hover:border-ink/40",
                  )}
                >
                  {on && <Check className="size-3.5" />} {s.nome}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Rotulo>Jornada de trabalho</Rotulo>
          <EditorHorarios valor={form.jornada} onChange={(jornada) => setForm({ ...form, jornada })} />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-4 py-3 text-sm font-medium text-ink">
          Aceitando agendamentos
          <input type="checkbox" className="size-4 accent-marca-500" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
        </label>

        {erro && <p className="rounded-xl bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{erro}</p>}
        <Botao tamanho="lg" disabled={pendente}>
          {pendente && <Loader2 className="size-5 animate-spin" />} Salvar
        </Botao>
        {pro.id && (
          <button
            type="button"
            disabled={pendente}
            onClick={() => {
              if (!confirm(`Remover ${pro.nome} da equipe?`)) return;
              iniciar(async () => {
                const r = await excluirProfissional(pro.id);
                if (r.erro) setErro(r.erro);
                else aoFechar();
              });
            }}
            className="inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-erro hover:underline"
          >
            <Trash2 className="size-4" /> Remover da equipe
          </button>
        )}
      </form>
    </Gaveta>
  );
}
