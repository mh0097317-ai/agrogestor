"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";
import { criarBloqueio } from "@/modules/painel/actions";
import { Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { Gaveta } from "./gaveta";

export function BotaoBloqueio({ data, profissionais }: { data: string; profissionais: { id: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ profissionalId: "", data, diaInteiro: true, inicio: "12:00", fim: "13:00", motivo: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <>
      <Botao variante="secundario" onClick={() => { setForm((f) => ({ ...f, data })); setAberto(true); }}>
        <Lock className="size-4" /> Bloquear
      </Botao>
      <Gaveta aberta={aberto} aoFechar={() => setAberto(false)} titulo="Bloquear horário">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErro(null);
            iniciar(async () => {
              const r = await criarBloqueio({ ...form, profissionalId: form.profissionalId || undefined });
              if (r.erro) setErro(r.erro);
              else setAberto(false);
            });
          }}
        >
          <p className="text-sm text-suave">Folga, feriado, consulta médica… Os clientes não conseguem agendar nesse período.</p>
          <div>
            <Rotulo htmlFor="bl-pro">Quem</Rotulo>
            <Selecao id="bl-pro" value={form.profissionalId} onChange={(e) => setForm({ ...form, profissionalId: e.target.value })}>
              <option value="">Estabelecimento inteiro</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="bl-data">Data</Rotulo>
            <Campo id="bl-data" type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-ink">
            <input type="checkbox" className="size-4 accent-marca-500" checked={form.diaInteiro} onChange={(e) => setForm({ ...form, diaInteiro: e.target.checked })} />
            Dia inteiro
          </label>
          {!form.diaInteiro && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Rotulo htmlFor="bl-ini">Das</Rotulo>
                <Campo id="bl-ini" type="time" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
              </div>
              <div>
                <Rotulo htmlFor="bl-fim">Até</Rotulo>
                <Campo id="bl-fim" type="time" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
              </div>
            </div>
          )}
          <div>
            <Rotulo htmlFor="bl-mot" dica="Opcional">
              Motivo
            </Rotulo>
            <Campo id="bl-mot" placeholder="Ex.: Feriado, almoço, curso" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </div>
          {erro && <p className="rounded-xl bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{erro}</p>}
          <Botao tamanho="lg" disabled={pendente}>
            {pendente && <Loader2 className="size-5 animate-spin" />} Bloquear
          </Botao>
        </form>
      </Gaveta>
    </>
  );
}
