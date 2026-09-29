"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Clock, Loader2, Moon, Sun, Sunrise, Users } from "lucide-react";
import { agendar } from "@/app/[slug]/actions";
import { cn, formatarDuracao, formatarPreco } from "@/lib/utils";
import { Avatar, Botao, Campo, AreaTexto, Rotulo } from "@/components/ui";
import { mascaraTelefone } from "@/components/mascara";

type Servico = { id: string; nome: string; descricao: string | null; duracaoMin: number; precoCentavos: number };
type Profissional = { id: string; nome: string; bio: string | null; cor: string; servicos: string[] };
type Horario = { inicio: string; hora: string; profissionais: string[] };

const QUALQUER = "qualquer";
const PASSOS = ["Serviço", "Profissional", "Data e hora", "Seus dados"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const CHAVE_CLIENTE = "agendai:cliente";

function diasDaJanela(hoje: string, quantidade: number) {
  const [a, m, d] = hoje.split("-").map(Number);
  return Array.from({ length: quantidade + 1 }, (_, i) => {
    const dt = new Date(Date.UTC(a, m - 1, d + i));
    const ymd = dt.toISOString().slice(0, 10);
    return { ymd, dia: dt.getUTCDate(), mes: MESES[dt.getUTCMonth()], semana: dt.getUTCDay() };
  });
}

function descreverData(ymd: string, hoje: string) {
  const [a, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  const [ha, hm, hd] = hoje.split("-").map(Number);
  const diff = Math.round((dt.getTime() - Date.UTC(ha, hm - 1, hd)) / 86_400_000);
  const base = `${d} de ${MESES[m - 1]}`;
  if (diff === 0) return `Hoje, ${base}`;
  if (diff === 1) return `Amanhã, ${base}`;
  const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return `${nomes[dt.getUTCDay()]}, ${base}`;
}

export function FluxoAgendamento(props: {
  slug: string;
  nomeNegocio: string;
  fuso: string;
  hoje: string;
  janelaDias: number;
  diasAbertos: number[];
  confirmacaoAutomatica: boolean;
  servicos: Servico[];
  profissionais: Profissional[];
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [servico, setServico] = useState<Servico | null>(null);
  const [profissionalId, setProfissionalId] = useState<string>(QUALQUER);
  const [data, setData] = useState<string | null>(null);
  const [horario, setHorario] = useState<Horario | null>(null);
  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [dados, setDados] = useState({ nome: "", telefone: "", email: "", observacao: "" });
  const [recarregar, setRecarregar] = useState(0);
  const topoRef = useRef<HTMLDivElement>(null);

  const dias = useMemo(() => diasDaJanela(props.hoje, Math.min(props.janelaDias, 60)), [props.hoje, props.janelaDias]);

  const prosDoServico = useMemo(
    () => (servico ? props.profissionais.filter((p) => p.servicos.includes(servico.id)) : []),
    [servico, props.profissionais],
  );
  const pularProfissional = prosDoServico.length <= 1;
  const profissional = props.profissionais.find((p) => p.id === profissionalId);

  // Cliente que já agendou antes: preenche nome/telefone.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_CLIENTE);
      if (salvo) setDados((d) => ({ ...d, ...JSON.parse(salvo) }));
    } catch {}
  }, []);

  // Primeira data com expediente.
  useEffect(() => {
    if (!data) {
      const primeira = dias.find((d) => props.diasAbertos.includes(d.semana));
      if (primeira) setData(primeira.ymd);
    }
  }, [dias, data, props.diasAbertos]);

  // Busca horários livres.
  useEffect(() => {
    if (!servico || !data || passo !== 2) return;
    const ctrl = new AbortController();
    setCarregando(true);
    setHorario(null);
    const q = new URLSearchParams({ negocio: props.slug, servico: servico.id, data });
    if (profissionalId !== QUALQUER) q.set("profissional", profissionalId);
    fetch(`/api/horarios?${q}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setHorarios(j.horarios ?? []))
      .catch((e) => {
        if (e.name !== "AbortError") setHorarios([]);
      })
      .finally(() => setCarregando(false));
    return () => ctrl.abort();
  }, [servico, data, profissionalId, passo, props.slug, recarregar]);

  function irPara(n: number) {
    setErro(null);
    setPasso(n);
    requestAnimationFrame(() => topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function escolherServico(s: Servico) {
    setServico(s);
    setHorario(null);
    const pros = props.profissionais.filter((p) => p.servicos.includes(s.id));
    if (profissionalId !== QUALQUER && !pros.some((p) => p.id === profissionalId)) setProfissionalId(QUALQUER);
    if (pros.length <= 1) {
      setProfissionalId(pros[0]?.id ?? QUALQUER);
      irPara(2);
    } else irPara(1);
  }

  function voltar() {
    if (passo === 2 && pularProfissional) irPara(0);
    else irPara(Math.max(0, passo - 1));
  }

  function confirmar() {
    if (!servico || !horario) return;
    setErro(null);
    iniciarEnvio(async () => {
      const r = await agendar(props.slug, {
        servicoId: servico.id,
        profissionalId: profissionalId === QUALQUER ? null : profissionalId,
        inicio: horario.inicio,
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        observacao: dados.observacao,
      });
      if (r.ok) {
        try {
          localStorage.setItem(CHAVE_CLIENTE, JSON.stringify({ nome: dados.nome, telefone: dados.telefone, email: dados.email }));
        } catch {}
        router.push(`/agendamento/${r.token}?novo=1`);
      } else if (r.ocupado) {
        setHorario(null);
        setRecarregar((n) => n + 1);
        irPara(2);
        setErro(r.erro);
      } else setErro(r.erro);
    });
  }

  const grupos = useMemo(() => {
    const g = [
      { nome: "Manhã", icone: Sunrise, itens: [] as Horario[] },
      { nome: "Tarde", icone: Sun, itens: [] as Horario[] },
      { nome: "Noite", icone: Moon, itens: [] as Horario[] },
    ];
    for (const h of horarios ?? []) {
      const hh = Number(h.hora.slice(0, 2));
      g[hh < 12 ? 0 : hh < 18 ? 1 : 2].itens.push(h);
    }
    return g.filter((x) => x.itens.length);
  }, [horarios]);

  const passosVisiveis = pularProfissional && servico ? PASSOS.filter((_, i) => i !== 1) : PASSOS;
  const indiceVisivel = pularProfissional && servico && passo > 1 ? passo - 1 : passo;

  return (
    <section ref={topoRef} className="scroll-mt-4 overflow-hidden rounded-3xl border border-linha bg-papel shadow-flutuante">
      {/* Cabeçalho do passo */}
      <div className="border-b border-linha px-5 pb-4 pt-5 sm:px-7">
        <div className="flex items-center gap-3">
          {passo > 0 && (
            <button
              onClick={voltar}
              className="grid size-9 place-items-center rounded-full border border-linha hover:bg-fundo"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-suave">
              Passo {indiceVisivel + 1} de {passosVisiveis.length}
            </p>
            <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
              {["Escolha o serviço", "Com quem?", "Quando fica bom?", "Quase lá! Seus dados"][passo]}
            </h2>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {passosVisiveis.map((p, i) => (
            <div key={p} className="h-1 flex-1 overflow-hidden rounded-full bg-linha">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: i <= indiceVisivel ? "100%" : "0%", background: "var(--marca)" }}
              />
            </div>
          ))}
        </div>

        {/* Resumo das escolhas */}
        {passo > 0 && servico && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <button onClick={() => irPara(0)} className="rounded-full bg-fundo px-3 py-1.5 font-semibold text-ink hover:bg-linha">
              {servico.nome} · {formatarPreco(servico.precoCentavos)}
            </button>
            {passo > 1 && !pularProfissional && (
              <button onClick={() => irPara(1)} className="rounded-full bg-fundo px-3 py-1.5 font-semibold text-ink hover:bg-linha">
                {profissional?.nome ?? "Sem preferência"}
              </button>
            )}
            {passo > 2 && horario && data && (
              <button onClick={() => irPara(2)} className="rounded-full bg-fundo px-3 py-1.5 font-semibold text-ink hover:bg-linha">
                {descreverData(data, props.hoje)} · {horario.hora}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        {erro && (
          <div className="mb-4 animate-surgir rounded-xl border border-erro/20 bg-erro-bg px-4 py-3 text-sm font-medium text-erro">{erro}</div>
        )}

        {/* 1. Serviço */}
        {passo === 0 && (
          <ul className="grid gap-2.5">
            {props.servicos.length === 0 && (
              <p className="py-10 text-center text-sm text-suave">Nenhum serviço disponível para agendamento online.</p>
            )}
            {props.servicos.map((s, i) => (
              <li key={s.id} className="animate-surgir" style={{ animationDelay: `${i * 35}ms` }}>
                <button
                  onClick={() => escolherServico(s)}
                  className={cn(
                    "group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-cartao",
                    servico?.id === s.id ? "border-[color:var(--marca)] bg-[color-mix(in_srgb,var(--marca)_6%,white)]" : "border-linha hover:border-linha-forte",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{s.nome}</p>
                    {s.descricao && <p className="mt-0.5 line-clamp-2 text-sm text-suave">{s.descricao}</p>}
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-suave">
                      <Clock className="size-3.5" /> {formatarDuracao(s.duracaoMin)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-bold text-ink">{formatarPreco(s.precoCentavos)}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-apagado transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 2. Profissional */}
        {passo === 1 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[{ id: QUALQUER, nome: "Sem preferência", bio: "Primeiro horário livre com qualquer profissional", cor: "" }, ...prosDoServico].map(
              (p, i) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProfissionalId(p.id);
                    irPara(2);
                  }}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    "flex animate-surgir items-center gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-cartao",
                    profissionalId === p.id ? "border-[color:var(--marca)] bg-[color-mix(in_srgb,var(--marca)_6%,white)]" : "border-linha",
                  )}
                >
                  {p.id === QUALQUER ? (
                    <span className="grid size-12 place-items-center rounded-full bg-fundo text-suave">
                      <Users className="size-5" />
                    </span>
                  ) : (
                    <Avatar nome={p.nome} cor={p.cor} tamanho={48} />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{p.nome}</p>
                    {p.bio && <p className="line-clamp-2 text-sm text-suave">{p.bio}</p>}
                  </div>
                </button>
              ),
            )}
          </div>
        )}

        {/* 3. Data e hora */}
        {passo === 2 && (
          <div>
            <div className="sem-barra -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:-mx-7 sm:px-7">
              {dias.map((d) => {
                const aberto = props.diasAbertos.includes(d.semana);
                const ativo = d.ymd === data;
                return (
                  <button
                    key={d.ymd}
                    disabled={!aberto}
                    onClick={() => setData(d.ymd)}
                    className={cn(
                      "flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition",
                      ativo ? "border-transparent text-white shadow-lg" : "border-linha hover:border-linha-forte",
                      !aberto && "opacity-35",
                    )}
                    style={ativo ? { background: "var(--marca)" } : undefined}
                  >
                    <span className={cn("text-[11px] font-semibold uppercase", ativo ? "text-white/80" : "text-suave")}>
                      {d.ymd === props.hoje ? "hoje" : DIAS[d.semana]}
                    </span>
                    <span className="font-display text-xl font-bold leading-tight">{d.dia}</span>
                    <span className={cn("text-[11px]", ativo ? "text-white/80" : "text-suave")}>{d.mes}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 min-h-40">
              {carregando || horarios === null ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-xl bg-fundo" />
                  ))}
                </div>
              ) : grupos.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-fundo text-suave">
                    <Clock className="size-5" />
                  </div>
                  <p className="font-semibold text-ink">Sem horários livres nesse dia</p>
                  <p className="text-sm text-suave">Tente outra data{profissionalId !== QUALQUER ? " ou outro profissional" : ""}.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {grupos.map((g) => (
                    <div key={g.nome}>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-suave">
                        <g.icone className="size-3.5" /> {g.nome}
                      </p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {g.itens.map((h) => {
                          const ativo = horario?.inicio === h.inicio;
                          return (
                            <button
                              key={h.inicio}
                              onClick={() => setHorario(h)}
                              className={cn(
                                "h-11 rounded-xl border text-sm font-semibold tabular-nums transition",
                                ativo ? "border-transparent text-white shadow-md" : "border-linha text-ink hover:border-ink",
                              )}
                              style={ativo ? { background: "var(--marca)" } : undefined}
                            >
                              {h.hora}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 -mx-5 mt-6 border-t border-linha bg-papel/95 px-5 pt-4 backdrop-blur sm:-mx-7 sm:px-7">
              <Botao
                tamanho="lg"
                className="w-full text-white"
                style={{ background: "var(--marca)" }}
                disabled={!horario}
                onClick={() => irPara(3)}
              >
                {horario && data ? `Continuar · ${descreverData(data, props.hoje)} às ${horario.hora}` : "Escolha um horário"}
              </Botao>
            </div>
          </div>
        )}

        {/* 4. Dados */}
        {passo === 3 && servico && horario && data && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmar();
            }}
            className="grid gap-4"
          >
            <div className="rounded-2xl bg-fundo p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{servico.nome}</p>
                  <p className="text-sm text-suave">
                    {descreverData(data, props.hoje)} às <strong className="text-ink">{horario.hora}</strong> ·{" "}
                    {formatarDuracao(servico.duracaoMin)}
                  </p>
                  <p className="text-sm text-suave">
                    {profissional ? `com ${profissional.nome}` : "Profissional: primeiro disponível"}
                  </p>
                </div>
                <p className="font-display text-xl font-bold text-ink">{formatarPreco(servico.precoCentavos)}</p>
              </div>
            </div>

            <div>
              <Rotulo htmlFor="nome">Seu nome</Rotulo>
              <Campo
                id="nome"
                autoComplete="name"
                required
                placeholder="Como podemos te chamar?"
                value={dados.nome}
                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
              />
            </div>
            <div>
              <Rotulo htmlFor="telefone" dica="Enviamos a confirmação por aqui">
                WhatsApp
              </Rotulo>
              <Campo
                id="telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                placeholder="(11) 99999-9999"
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: mascaraTelefone(e.target.value) })}
              />
            </div>
            <div>
              <Rotulo htmlFor="email" dica="Opcional">
                E-mail
              </Rotulo>
              <Campo
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={dados.email}
                onChange={(e) => setDados({ ...dados, email: e.target.value })}
              />
            </div>
            <div>
              <Rotulo htmlFor="obs" dica="Opcional">
                Observação
              </Rotulo>
              <AreaTexto
                id="obs"
                rows={2}
                maxLength={300}
                placeholder="Ex.: quero manter o comprimento em cima"
                value={dados.observacao}
                onChange={(e) => setDados({ ...dados, observacao: e.target.value })}
              />
            </div>

            <Botao tamanho="lg" type="submit" disabled={enviando} className="mt-1 w-full text-white" style={{ background: "var(--marca)" }}>
              {enviando ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {enviando ? "Agendando..." : props.confirmacaoAutomatica ? "Confirmar agendamento" : "Solicitar horário"}
            </Botao>
            <p className="text-center text-xs text-suave">
              Você recebe a confirmação no WhatsApp e pode cancelar pelo link.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
