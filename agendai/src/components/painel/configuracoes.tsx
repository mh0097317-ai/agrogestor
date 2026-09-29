"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, CircleDashed, Loader2, LogOut } from "lucide-react";
import { salvarConfiguracoes } from "@/modules/painel/actions";
import { cn } from "@/lib/utils";
import { AreaTexto, Botao, Campo, Cartao, Rotulo, Selecao } from "@/components/ui";
import { mascaraTelefone } from "@/components/mascara";
import { Cabecalho } from "./cabecalho";
import { CORES } from "./equipe";
import { EditorHorarios, type Faixa } from "./editor-horarios";

type Form = {
  nome: string;
  slug: string;
  descricao: string;
  whatsapp: string;
  email: string;
  endereco: string;
  cidade: string;
  instagram: string;
  corPrimaria: string;
  antecedenciaMinutos: string;
  janelaDias: string;
  intervaloSlotMinutos: string;
  cancelamentoAteHoras: string;
  lembreteHorasAntes: string;
  confirmacaoAutomatica: boolean;
  notificarDonoWhatsapp: boolean;
  notificarDonoEmail: boolean;
  notificarClienteWhatsapp: boolean;
  notificarClienteEmail: boolean;
  horarios: Faixa[];
};

function Secao({ titulo, texto, children }: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <Cartao className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{titulo}</h2>
        {texto && <p className="mt-1 text-sm text-suave">{texto}</p>}
      </div>
      <div className="grid gap-4">{children}</div>
    </Cartao>
  );
}

function Interruptor({ checked, onChange, titulo, texto }: { checked: boolean; onChange: (v: boolean) => void; titulo: string; texto?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between gap-4 rounded-xl border border-linha px-4 py-3 text-left hover:bg-papel-2">
      <span>
        <span className="block text-sm font-semibold text-ink">{titulo}</span>
        {texto && <span className="block text-xs text-suave">{texto}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-marca-500" : "bg-linha-forte")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function FormConfiguracoes({
  inicial,
  baseUrl,
  provedores,
}: {
  inicial: Form;
  baseUrl: string;
  provedores: { whatsapp: string | null; email: string | null };
}) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setSalvo(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await salvarConfiguracoes(form);
      if (r.erro) setErro(r.erro);
      else {
        if (r.slug) setForm((f) => ({ ...f, slug: r.slug! }));
        setSalvo(true);
      }
    });
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Cabecalho titulo="Configurações" subtitulo="Seu negócio, sua página e suas regras" />

      <Secao titulo="Seu negócio" texto="Informações que aparecem na sua página de agendamento.">
        <div>
          <Rotulo htmlFor="cf-nome">Nome</Rotulo>
          <Campo id="cf-nome" required value={form.nome} onChange={(e) => set("nome", e.target.value)} />
        </div>
        <div>
          <Rotulo htmlFor="cf-slug">Seu link</Rotulo>
          <div className="flex items-center rounded-xl border border-linha-forte bg-papel focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5">
            <span className="whitespace-nowrap pl-3.5 text-sm text-suave">{baseUrl.replace(/^https?:\/\//, "")}/</span>
            <input
              id="cf-slug"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              className="h-11 min-w-0 flex-1 bg-transparent pr-3.5 text-[15px] font-semibold text-ink outline-none"
            />
          </div>
        </div>
        <div>
          <Rotulo htmlFor="cf-desc" dica="Opcional">
            Descrição curta
          </Rotulo>
          <AreaTexto id="cf-desc" rows={2} maxLength={240} placeholder="Ex.: Barbearia clássica no coração da Vila Madalena. Cerveja gelada por conta da casa 🍺" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="cf-end">Endereço</Rotulo>
            <Campo id="cf-end" placeholder="Rua, número" value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
          </div>
          <div>
            <Rotulo htmlFor="cf-cid">Cidade</Rotulo>
            <Campo id="cf-cid" placeholder="São Paulo - SP" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div>
            <Rotulo htmlFor="cf-wpp" dica="Recebe os avisos">
              WhatsApp
            </Rotulo>
            <Campo id="cf-wpp" type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", mascaraTelefone(e.target.value))} />
          </div>
          <div>
            <Rotulo htmlFor="cf-ig">Instagram</Rotulo>
            <Campo id="cf-ig" placeholder="@suabarbearia" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Rotulo htmlFor="cf-email" dica="Recebe os avisos">
              E-mail
            </Rotulo>
            <Campo id="cf-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Aparência" texto="A cor da sua marca na página de agendamento.">
        <div className="flex flex-wrap items-center gap-2">
          {CORES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => set("corPrimaria", c)}
              className="grid size-9 place-items-center rounded-full transition"
              style={{ background: c, boxShadow: form.corPrimaria.toLowerCase() === c.toLowerCase() ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
              aria-label={`Cor ${c}`}
            >
              {form.corPrimaria.toLowerCase() === c.toLowerCase() && <Check className="size-4 text-white" />}
            </button>
          ))}
          <label className="ml-1 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-linha-forte px-3 text-sm font-semibold text-ink">
            <input type="color" value={form.corPrimaria} onChange={(e) => set("corPrimaria", e.target.value)} className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0" />
            Outra
          </label>
        </div>
        <div className="overflow-hidden rounded-2xl bg-ink p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl font-display text-lg font-extrabold" style={{ background: form.corPrimaria }}>
              {form.nome.trim()[0]?.toUpperCase() ?? "A"}
            </span>
            <span className="font-display text-xl font-bold">{form.nome || "Seu negócio"}</span>
          </div>
          <span className="mt-4 inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold" style={{ background: form.corPrimaria }}>
            Confirmar agendamento
          </span>
        </div>
      </Secao>

      <Secao titulo="Horário de funcionamento" texto="Aparece na sua página. A agenda de cada profissional é definida em Equipe.">
        <EditorHorarios valor={form.horarios} onChange={(v) => set("horarios", v)} />
      </Secao>

      <Secao titulo="Regras de agendamento" texto="Como os clientes podem marcar e desmarcar.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Rotulo htmlFor="cf-ant">Antecedência mínima</Rotulo>
            <Selecao id="cf-ant" value={form.antecedenciaMinutos} onChange={(e) => set("antecedenciaMinutos", e.target.value)}>
              {[[0, "Sem mínimo"], [15, "15 minutos"], [30, "30 minutos"], [60, "1 hora"], [120, "2 horas"], [240, "4 horas"], [720, "12 horas"], [1440, "1 dia"]].map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="cf-jan">Agenda aberta até</Rotulo>
            <Selecao id="cf-jan" value={form.janelaDias} onChange={(e) => set("janelaDias", e.target.value)}>
              {[7, 14, 21, 30, 45, 60, 90].map((d) => (
                <option key={d} value={d}>{d} dias à frente</option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="cf-int">Intervalo entre horários</Rotulo>
            <Selecao id="cf-int" value={form.intervaloSlotMinutos} onChange={(e) => set("intervaloSlotMinutos", e.target.value)}>
              {[10, 15, 20, 30, 45, 60].map((d) => (
                <option key={d} value={d}>A cada {d} min</option>
              ))}
            </Selecao>
          </div>
          <div>
            <Rotulo htmlFor="cf-canc">Cliente pode cancelar até</Rotulo>
            <Selecao id="cf-canc" value={form.cancelamentoAteHoras} onChange={(e) => set("cancelamentoAteHoras", e.target.value)}>
              {[[0, "A qualquer momento"], [1, "1h antes"], [2, "2h antes"], [4, "4h antes"], [12, "12h antes"], [24, "24h antes"], [48, "48h antes"]].map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </Selecao>
          </div>
        </div>
        <Interruptor
          checked={form.confirmacaoAutomatica}
          onChange={(v) => set("confirmacaoAutomatica", v)}
          titulo="Confirmar automaticamente"
          texto={form.confirmacaoAutomatica ? "O horário já fica confirmado quando o cliente agenda." : "Você aprova cada pedido antes de confirmar."}
        />
      </Secao>

      <Secao titulo="Avisos" texto="Quem recebe mensagem quando algo acontece na agenda.">
        <div className="grid gap-2 sm:grid-cols-2">
          <StatusProvedor rotulo="WhatsApp automático" ativo={!!provedores.whatsapp} nome={provedores.whatsapp === "zapi" ? "Z-API" : provedores.whatsapp === "twilio" ? "Twilio" : null} />
          <StatusProvedor rotulo="E-mail automático" ativo={!!provedores.email} nome={provedores.email ? "Resend" : null} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-suave">Para você (dono)</p>
        <Interruptor checked={form.notificarDonoWhatsapp} onChange={(v) => set("notificarDonoWhatsapp", v)} titulo="WhatsApp a cada novo agendamento ou cancelamento" />
        <Interruptor checked={form.notificarDonoEmail} onChange={(v) => set("notificarDonoEmail", v)} titulo="E-mail a cada novo agendamento ou cancelamento" />
        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-suave">Para o cliente</p>
        <Interruptor checked={form.notificarClienteWhatsapp} onChange={(v) => set("notificarClienteWhatsapp", v)} titulo="Confirmação, lembrete e cancelamento no WhatsApp" />
        <Interruptor checked={form.notificarClienteEmail} onChange={(v) => set("notificarClienteEmail", v)} titulo="Confirmação, lembrete e cancelamento por e-mail" texto="Só quando o cliente informa e-mail" />
        <div className="max-w-xs">
          <Rotulo htmlFor="cf-lemb">Lembrete antes do horário</Rotulo>
          <Selecao id="cf-lemb" value={form.lembreteHorasAntes} onChange={(e) => set("lembreteHorasAntes", e.target.value)}>
            {[[0, "Não enviar lembrete"], [1, "1 hora antes"], [2, "2 horas antes"], [3, "3 horas antes"], [12, "12 horas antes"], [24, "1 dia antes"], [48, "2 dias antes"]].map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </Selecao>
        </div>
      </Secao>

      <div className="sticky bottom-20 z-20 flex items-center justify-end gap-3 rounded-2xl border border-linha bg-papel/95 p-3 shadow-flutuante backdrop-blur lg:bottom-4">
        {erro && <p className="mr-auto text-sm font-medium text-erro">{erro}</p>}
        {salvo && !erro && (
          <p className="mr-auto inline-flex animate-surgir items-center gap-1.5 text-sm font-semibold text-ok">
            <CheckCircle2 className="size-4" /> Alterações salvas
          </p>
        )}
        <a href="/sair" className="inline-flex items-center gap-1.5 px-3 text-sm font-semibold text-suave hover:text-ink lg:hidden">
          <LogOut className="size-4" /> Sair
        </a>
        <Botao disabled={pendente}>{pendente && <Loader2 className="size-4 animate-spin" />} Salvar alterações</Botao>
      </div>
    </form>
  );
}

function StatusProvedor({ rotulo, ativo, nome }: { rotulo: string; ativo: boolean; nome: string | null }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3", ativo ? "bg-ok-bg" : "bg-fundo")}>
      {ativo ? <CheckCircle2 className="size-5 text-ok" /> : <CircleDashed className="size-5 text-apagado" />}
      <div>
        <p className="text-sm font-semibold text-ink">{rotulo}</p>
        <p className="text-xs text-suave">{ativo ? `Conectado via ${nome}` : "Manual (1 clique no painel de Avisos)"}</p>
      </div>
    </div>
  );
}
