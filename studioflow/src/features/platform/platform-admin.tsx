"use client";

import { PlatformWhatsApp } from "./platform-whatsapp";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CalendarCheck,
  ClockCountdown,
  EnvelopeSimple,
  Infinity as InfinityIcon,
  MagnifyingGlass,
  NotePencil,
  Package,
  Pause,
  Play,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { WhatsAppIcon } from "@/components/brand-icons";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { SegmentIcon } from "@/lib/segments";
import {
  daysLeft,
  extendUntil,
  type AccessEvent,
  type AccessState,
} from "@/lib/access";
import {
  allModules,
  enabledModules,
  moduleCatalog,
  planCatalog,
  planFor,
  type ModuleKey,
  type PlanKey,
} from "@/lib/modules";
import type { PlatformBusiness } from "@/services/platform";
import "./platform.css";

type Filter = "all" | AccessState | "closed";
const filters: { id: Filter; label: string }[] = [
  { id: "pending", label: "Aguardando" },
  { id: "active", label: "Ativos" },
  { id: "expiring", label: "Vencendo" },
  { id: "closed", label: "Vencidos e pausados" },
  { id: "all", label: "Todos" },
];
const stateLabels: Record<AccessState, string> = {
  pending: "Aguardando liberação",
  active: "Liberado",
  expiring: "Vence em breve",
  expired: "Vencido",
  suspended: "Pausado",
};
const actionLabels: Record<AccessEvent["action"], string> = {
  created: "Cadastro recebido",
  granted: "Liberou",
  unlimited: "Liberou sem prazo",
  until: "Definiu o prazo",
  suspended: "Pausou o acesso",
  pending: "Voltou para aguardando",
  note: "Anotação",
  plan: "Mudou o plano e os módulos",
  paid: "Pagou a mensalidade",
};
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Plano mostrado na lista: o nome combinado ou o que bate com os módulos. */
function planLabel(item: Pick<PlatformBusiness, "plan" | "modules">) {
  if (item.plan) return item.plan;
  if (!item.modules) return "Completo";
  const key = planFor(item.modules);
  return key ? planCatalog[key].label : "Personalizado";
}
const day = (value: string) =>
  format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
const ago = (value: string) =>
  formatDistanceToNowStrict(new Date(value), { locale: ptBR, addSuffix: true });

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.error || "Não foi possível concluir.",
    ) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

function accessLine(item: PlatformBusiness) {
  if (item.state === "pending") return `Cadastrou ${ago(item.createdAt)}`;
  if (item.state === "suspended")
    return item.until ? `Pausado · prazo era ${day(item.until)}` : "Pausado";
  if (!item.until) return "Sem prazo";
  const left = daysLeft({ status: item.status, until: item.until })!;
  if (item.state === "expired")
    return `Venceu ${ago(item.until)} · ${day(item.until)}`;
  return `Até ${day(item.until)} · ${left === 1 ? "falta 1 dia" : `faltam ${left} dias`}`;
}

export function PlatformAdmin() {
  const { toast } = useToast();
  const [items, setItems] = useState<PlatformBusiness[] | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<PlatformBusiness | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await call<{ businesses: PlatformBusiness[] }>(
        "/api/admin/platform",
      );
      setItems(data.businesses);
      setError("");
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (status === 403 || status === 401) setDenied(true);
      setError(cause instanceof Error ? cause.message : "Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const counts = useMemo(() => {
    const list = items || [];
    return {
      pending: list.filter((item) => item.state === "pending").length,
      active: list.filter(
        (item) => item.state === "active" || item.state === "expiring",
      ).length,
      expiring: list.filter((item) => item.state === "expiring").length,
      closed: list.filter(
        (item) => item.state === "expired" || item.state === "suspended",
      ).length,
      all: list.length,
    };
  }, [items]);
  const paying = (items || []).filter(
    (item) =>
      (item.state === "active" || item.state === "expiring") && item.price,
  );
  const monthly = paying.reduce((sum, item) => sum + (item.price || 0), 0);
  // Opens on the queue that needs attention; with nothing waiting, on all.
  const effective: Filter =
    filter === "pending" && items && !counts.pending ? "all" : filter;
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (items || []).filter((item) => {
      const inFilter =
        effective === "all" ||
        (effective === "closed"
          ? item.state === "expired" || item.state === "suspended"
          : effective === "active"
            ? item.state === "active" || item.state === "expiring"
            : item.state === effective);
      const inSearch =
        !term ||
        [item.name, item.slug, item.ownerName, item.ownerEmail, item.phone]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return inFilter && inSearch;
    });
  }, [items, effective, query]);

  async function act(
    body: Record<string, unknown>,
    message: string,
    method = "POST",
  ) {
    const data = await call<{ businesses: PlatformBusiness[] }>(
      "/api/admin/platform",
      {
        method,
        body: JSON.stringify(body),
      },
    );
    setItems(data.businesses);
    setOpen(
      data.businesses.find((item) => item.id === body.businessId) || null,
    );
    toast(message);
  }

  if (denied)
    return (
      <main className="pf-denied">
        <Brand size={34} />
        <h1>Área da equipe StudioFlow</h1>
        <p>{error || "Esta área é só para a equipe StudioFlow."}</p>
        <Link className="btn btn-secondary" href="/dashboard">
          Voltar ao painel
        </Link>
      </main>
    );

  return (
    <div className="pf">
      <header className="pf-top">
        <Link href="/admin" className="pf-brand" aria-label="Plataforma">
          <Brand tone="on-dark" size={30} />
          <span className="pf-brand-label">Plataforma</span>
        </Link>
        <div className="pf-top-actions">
          <button
            type="button"
            className="pf-refresh"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Atualizar"
          >
            <ArrowsClockwise
              size={17}
              className={loading ? "is-spinning" : ""}
            />
          </button>
          <Link href="/dashboard" className="pf-back">
            Meu painel
          </Link>
        </div>
      </header>
      <main className="pf-main">
        <div className="pf-head">
          <div>
            <small>Acesso dos estabelecimentos</small>
            <h1>Quem usa o StudioFlow</h1>
            <p>
              Cadastro novo entra em <b>Aguardando</b>. Painel e agenda online
              só abrem depois que você libera, e fecham sozinhos quando o prazo
              acaba.
            </p>
          </div>
          {items && (
            <div className="pf-mrr">
              <small>Receita mensal combinada</small>
              <strong>{money(monthly)}</strong>
              <span>
                {paying.length}{" "}
                {paying.length === 1 ? "cliente pagante" : "clientes pagantes"}
              </span>
            </div>
          )}
        </div>
        <PlatformWhatsApp />
        <div
          className="pf-kpis"
          role="tablist"
          aria-label="Filtrar estabelecimentos"
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={effective === item.id}
              className={`pf-kpi ${effective === item.id ? "is-current" : ""}`}
              data-filter={item.id}
              onClick={() => setFilter(item.id)}
            >
              <strong>
                {items ? counts[item.id as keyof typeof counts] : "–"}
              </strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="pf-search">
          <MagnifyingGlass size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, dono, e-mail ou telefone"
            aria-label="Buscar estabelecimento"
          />
        </div>
        {error && items && <p className="pf-error">{error}</p>}
        {!items ? (
          <div className="pf-list">
            {[0, 1, 2].map((index) => (
              <div className="pf-row is-skeleton" key={index} />
            ))}
            {error && <p className="pf-error">{error}</p>}
          </div>
        ) : visible.length === 0 ? (
          <p className="pf-empty">
            {query
              ? "Nada encontrado com essa busca."
              : "Nenhum estabelecimento nesta lista."}
          </p>
        ) : (
          <ul className="pf-list">
            {visible.map((item, index) => (
              <li
                key={item.id}
                className={`pf-row is-${item.state}`}
                style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
              >
                <div className="pf-who">
                  <span className="pf-mark">
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      <SegmentIcon
                        category={item.category}
                        size={20}
                        weight="duotone"
                      />
                    )}
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <a href={`/${item.slug}`} target="_blank" rel="noreferrer">
                      /{item.slug} <ArrowSquareOut size={11} />
                    </a>
                  </div>
                </div>
                <div className="pf-owner">
                  <span>{item.ownerName || "Dono sem nome"}</span>
                  {item.ownerEmail && <small>{item.ownerEmail}</small>}
                </div>
                <div className="pf-access">
                  <span className={`pf-badge is-${item.state}`}>
                    {stateLabels[item.state]}
                  </span>
                  <small>{accessLine(item)}</small>
                </div>
                <div className="pf-usage">
                  <span className="pf-plan">
                    <Package size={14} /> {planLabel(item)}
                    {item.price ? ` · ${money(item.price)}/mês` : ""}
                  </span>
                  <span>
                    <CalendarCheck size={14} /> {item.appointments30d} em 30
                    dias
                  </span>
                  <span>
                    <UsersThree size={14} /> {item.customers} clientes
                  </span>
                </div>
                <div className="pf-actions">
                  {item.state === "pending" ? (
                    <Button type="button" onClick={() => setOpen(item)}>
                      Liberar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOpen(item)}
                    >
                      Gerenciar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      {open && (
        <AccessSheet
          key={open.id}
          item={open}
          onClose={() => setOpen(null)}
          onAct={act}
        />
      )}
    </div>
  );
}

const quick = [7, 15, 30, 90, 365];

function AccessSheet({
  item,
  onClose,
  onAct,
}: {
  item: PlatformBusiness;
  onClose: () => void;
  onAct: (
    body: Record<string, unknown>,
    message: string,
    method?: string,
  ) => Promise<void>;
}) {
  const [days, setDays] = useState(30);
  const [date, setDate] = useState("");
  const [note, setNote] = useState(item.note);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmPause, setConfirmPause] = useState(false);
  const [events, setEvents] = useState<AccessEvent[] | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    void call<{ events: AccessEvent[] }>(`/api/admin/platform/${item.id}`)
      .then((data) => alive && setEvents(data.events))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [item.id, item.status, item.until]);

  async function run(
    label: string,
    body: Record<string, unknown>,
    message: string,
  ) {
    setBusy(label);
    setError("");
    try {
      await onAct({ businessId: item.id, ...body }, message);
      setConfirmPause(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy("");
    }
  }
  const preview = extendUntil(
    item.state === "suspended" || item.state === "pending" ? null : item.until,
    days,
    now,
  );
  const phone = item.phone.replace(/\D/g, "");

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      description={`/${item.slug}`}
    >
      <div className="pf-sheet">
        <div className={`pf-sheet-state is-${item.state}`}>
          <span className={`pf-badge is-${item.state}`}>
            {stateLabels[item.state]}
          </span>
          <strong>{accessLine(item)}</strong>
          <div className="pf-contact">
            {item.ownerEmail && (
              <a href={`mailto:${item.ownerEmail}`}>
                <EnvelopeSimple size={15} /> {item.ownerEmail}
              </a>
            )}
            {phone.length >= 10 && (
              <a
                href={`https://wa.me/55${phone.replace(/^55/, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon size={14} /> WhatsApp da casa
              </a>
            )}
            {item.lastSignInAt && (
              <span>Último acesso {ago(item.lastSignInAt)}</span>
            )}
          </div>
        </div>

        <PlanEditor
          item={item}
          onAct={(body, message, method) =>
            onAct({ businessId: item.id, ...body }, message, method)
          }
        />

        <section className="pf-block">
          <h3>
            <ClockCountdown size={18} /> Liberar por dias
          </h3>
          <div
            className="pf-chips"
            role="radiogroup"
            aria-label="Dias de acesso"
          >
            {quick.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={days === value}
                className={days === value ? "is-on" : ""}
                onClick={() => setDays(value)}
              >
                {value === 365 ? "1 ano" : `${value} dias`}
              </button>
            ))}
            <span className="pf-custom">
              <input
                type="number"
                min={1}
                max={3660}
                value={days}
                onChange={(event) =>
                  setDays(Math.max(1, Number(event.target.value) || 1))
                }
                aria-label="Outra quantidade de dias"
              />
              dias
            </span>
          </div>
          <p className="pf-preview">
            {item.state === "active" || item.state === "expiring"
              ? item.until
                ? "Soma ao prazo atual: "
                : "Passa a ter prazo: "
              : "Acesso até "}
            <b>{day(preview)}</b>
          </p>
          <Button
            type="button"
            disabled={!!busy}
            onClick={() =>
              void run(
                "granted",
                { action: "granted", days },
                `${item.name}: +${days} dias liberados.`,
              )
            }
          >
            <Play size={15} weight="fill" />
            {busy === "granted"
              ? "Liberando…"
              : `Liberar ${days} ${days === 1 ? "dia" : "dias"}`}
          </Button>
        </section>

        <section className="pf-block pf-two">
          <div>
            <h3>Até uma data</h3>
            <div className="pf-inline">
              <input
                type="date"
                value={date}
                min={format(now, "yyyy-MM-dd")}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Acesso até"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!date || !!busy}
                onClick={() =>
                  void run(
                    "until",
                    { action: "until", date },
                    `Acesso até ${day(`${date}T12:00:00`)}.`,
                  )
                }
              >
                Definir
              </Button>
            </div>
          </div>
          <div>
            <h3>Sem prazo</h3>
            <Button
              type="button"
              variant="secondary"
              disabled={!!busy || (item.status === "active" && !item.until)}
              onClick={() =>
                void run(
                  "unlimited",
                  { action: "unlimited" },
                  "Liberado sem prazo.",
                )
              }
            >
              <InfinityIcon size={16} /> Liberar sem prazo
            </Button>
          </div>
        </section>

        <section className="pf-block">
          <h3>
            <NotePencil size={18} /> Anotação interna
          </h3>
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            placeholder="Ex.: Plano mensal, paga todo dia 10. Indicado pelo Rafael."
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={!!busy || note === item.note}
            onClick={() =>
              void run("note", { action: "note", note }, "Anotação salva.")
            }
          >
            Salvar anotação
          </Button>
        </section>

        {item.state !== "pending" && item.state !== "suspended" && (
          <section className="pf-block pf-danger">
            {confirmPause ? (
              <>
                <p>
                  Pausar fecha o painel e a agenda online de <b>{item.name}</b>{" "}
                  agora. Os dados ficam guardados.
                </p>
                <div className="pf-inline">
                  <Button
                    type="button"
                    className="pf-pause"
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        "suspended",
                        { action: "suspended" },
                        "Acesso pausado.",
                      )
                    }
                  >
                    {busy === "suspended" ? "Pausando…" : "Sim, pausar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmPause(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="pf-link-danger"
                onClick={() => setConfirmPause(true)}
              >
                <Pause size={15} /> Pausar acesso
              </button>
            )}
          </section>
        )}
        {error && <p className="pf-error">{error}</p>}

        <section className="pf-history">
          <h3>Histórico</h3>
          {!events ? (
            <p className="pf-muted">Carregando…</p>
          ) : events.length === 0 ? (
            <p className="pf-muted">Sem registros ainda.</p>
          ) : (
            <ol>
              {events.map((event) => (
                <li key={event.id}>
                  <span>
                    {actionLabels[event.action]}
                    {event.days
                      ? ` ${event.days} ${event.days === 1 ? "dia" : "dias"}`
                      : ""}
                    {event.until &&
                    event.action !== "suspended" &&
                    event.action !== "note"
                      ? ` · até ${day(event.until)}`
                      : ""}
                  </span>
                  <small>
                    {format(new Date(event.createdAt), "dd/MM/yyyy HH:mm")}
                  </small>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}

/** Plano, mensalidade e módulos que o cliente fechou. */
function PlanEditor({
  item,
  onAct,
}: {
  item: PlatformBusiness;
  onAct: (
    body: Record<string, unknown>,
    message: string,
    method?: string,
  ) => Promise<void>;
}) {
  const [modules, setModules] = useState<ModuleKey[]>(
    enabledModules(item.modules),
  );
  const [plan, setPlan] = useState(item.plan || planLabel(item));
  const [price, setPrice] = useState(item.price ? item.price.toFixed(2).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matched = planFor(modules);

  function pick(key: PlanKey) {
    setModules([...planCatalog[key].modules]);
    setPlan(planCatalog[key].label);
  }
  function toggle(key: ModuleKey) {
    const next = modules.includes(key)
      ? modules.filter((value) => value !== key)
      : [...modules, key];
    setModules(next);
    const found = planFor(next);
    setPlan(found ? planCatalog[found].label : "Personalizado");
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const value = price.trim()
        ? Number(price.replace(/\./g, "").replace(",", "."))
        : null;
      if (value !== null && !Number.isFinite(value))
        throw new Error("Mensalidade inválida.");
      await onAct(
        { plan: plan.trim(), price: value, modules },
        `Plano ${plan.trim() || "salvo"} para ${item.name}.`,
        "PUT",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }
  const dirty =
    plan !== (item.plan || planLabel(item)) ||
    price !== (item.price ? item.price.toFixed(2).replace(".", ",") : "") ||
    modules.slice().sort().join() !==
      enabledModules(item.modules).slice().sort().join();

  return (
    <section className="pf-block pf-plan-editor">
      <h3>
        <Package size={18} /> Plano e módulos
      </h3>
      <div className="pf-chips" role="radiogroup" aria-label="Plano">
        {(Object.keys(planCatalog) as PlanKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={matched === key}
            className={matched === key ? "is-on" : ""}
            onClick={() => pick(key)}
          >
            {planCatalog[key].label}
          </button>
        ))}
        {!matched && <span className="pf-custom-tag">Personalizado</span>}
      </div>
      <ul className="pf-modules">
        {allModules.map((key) => (
          <li key={key}>
            <label>
              <input
                type="checkbox"
                checked={modules.includes(key)}
                onChange={() => toggle(key)}
              />
              <span>
                <strong>{moduleCatalog[key].label}</strong>
                <small>{moduleCatalog[key].detail}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="pf-base">
        Sempre incluso: página e agendamento online, agenda, clientes, serviços,
        equipe, financeiro, relatórios e divulgação.
      </p>
      <div className="pf-inline">
        <label className="pf-field">
          <span>Nome do plano</span>
          <input
            value={plan}
            maxLength={40}
            onChange={(event) => setPlan(event.target.value)}
          />
        </label>
        <label className="pf-field">
          <span>Mensalidade (R$)</span>
          <input
            inputMode="decimal"
            placeholder="149,90"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
      </div>
      {error && <p className="pf-error">{error}</p>}
      <Button
        type="button"
        disabled={busy || !dirty}
        onClick={() => void save()}
      >
        {busy ? "Salvando…" : "Salvar plano"}
      </Button>
    </section>
  );
}
