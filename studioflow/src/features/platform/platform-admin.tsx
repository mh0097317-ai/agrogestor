"use client";

import {
  ClientConfigurationPanel,
  EvolutionConfiguration,
} from "./client-configuration";
import { PlatformWhatsApp } from "./platform-whatsapp";
import { ClientAudit } from "./client-audit";
import { notifyWorkspaceChange } from "@/lib/workspace-sync";
import {
  ChannelHistory,
  PlatformControls,
  PlatformMetrics,
  type IntegrationStatus,
} from "./platform-controls";
import { activityPeriod, type ActivityPeriod } from "@/lib/platform-activity";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityPanel,
  BillingPanel,
  downloadReport,
  OverviewPanels,
  Pagination,
  ReceptionistsPanel,
} from "./platform-views";
import {
  businessReport,
  platformPlanLabel,
  receptionistState,
  type PlatformMonitoring,
} from "@/lib/platform-reporting";
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
  SignOut,
  ShieldCheck,
  DownloadSimple,
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
import type { ChannelEvent, PlatformBusiness } from "@/services/platform";
import {
  platformSummary,
  searchPlatform,
  type PlatformOrder,
} from "./platform-summary";
import "./platform.css";
import { MarketingPanel } from "./marketing-panel";
import { OperationsPanel } from "./operations-panel";

type Filter = "all" | AccessState | "closed";
const filters: { id: Filter; label: string }[] = [
  { id: "pending", label: "Aguardando" },
  { id: "active", label: "Ativos" },
  { id: "expiring", label: "Vencendo" },
  { id: "closed", label: "Vencidos e pausados" },
  { id: "all", label: "Todos" },
];
const viewCopy: Record<string, { title: string; description: string }> = {
  operations: {
    title: "Central de controle.",
    description:
      "Acessos, canais, atendimento e financeiro dos seus clientes em um só lugar.",
  },
  overview: {
    title: "Seu negócio, em perspectiva.",
    description:
      "Acompanhe seus estabelecimentos, organize acessos e veja a atividade da plataforma.",
  },
  businesses: {
    title: "Seus estabelecimentos.",
    description:
      "Clientes da plataforma, planos contratados e canais de agendamento.",
  },
  receptionists: {
    title: "Atendimento dos seus clientes.",
    description:
      "Acompanhe conexões, agendamentos e atendimentos que precisam da equipe.",
  },
  billing: {
    title: "Mensalidades do StudioFlow.",
    description:
      "Acompanhe o que foi recebido e as faturas que ainda estão em aberto.",
  },
  marketing: {
    title: "Marketing da StudioFlow.",
    description:
      "A IA cria posts, carrosséis e stories para o Instagram. Você aprova ou deixa no piloto automático.",
  },
  activity: {
    title: "Histórico da administração.",
    description:
      "Mudanças de acessos, planos e canais, registradas por estabelecimento.",
  },
};
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
const planLabel = platformPlanLabel;
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

export function PlatformAdmin({ demo = false }: { demo?: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<PlatformBusiness[] | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [view, setView] = useState("operations");
  const [openEvolution, setOpenEvolution] = useState(false);
  const [openTab, setOpenTab] = useState<"assistant" | "vault" | "billing">(
    "assistant",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [page, setPage] = useState(1);
  const requestVersion = useRef(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<PlatformBusiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<PlatformOrder>("attention");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [period, setPeriod] = useState<ActivityPeriod>(() => activityPeriod());
  const [loadedPeriod, setLoadedPeriod] = useState<ActivityPeriod>(() =>
    activityPeriod(),
  );
  const [draftPeriod, setDraftPeriod] = useState<ActivityPeriod>(() =>
    activityPeriod(),
  );
  const [monitoring, setMonitoring] = useState<PlatformMonitoring | null>(null);
  const [monitoringError, setMonitoringError] = useState("");
  const [preset, setPreset] = useState("30");
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(
    null,
  );
  const endpoint = `/api/admin/platform?from=${period.from}&to=${period.to}`;
  const periodLabel = `${day(`${loadedPeriod.from}T12:00:00`)} a ${day(`${loadedPeriod.to}T12:00:00`)}`;

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const data = await call<{
        businesses: PlatformBusiness[];
        integrations: IntegrationStatus;
        monitoring: PlatformMonitoring | null;
        monitoringError: string;
        period: ActivityPeriod;
      }>(endpoint);
      if (version !== requestVersion.current) return;
      setItems(data.businesses);
      setOpen((current) =>
        current
          ? data.businesses.find((i) => i.id === current.id) || null
          : null,
      );
      setUpdated(new Date());
      setIntegrations(data.integrations);
      setMonitoring(data.monitoring);
      setMonitoringError(data.monitoringError);
      setLoadedPeriod(data.period);
      setError("");
    } catch (cause) {
      if (version !== requestVersion.current) return;
      const status = (cause as { status?: number }).status;
      if (status === 403 || status === 401) setDenied(true);
      setError(cause instanceof Error ? cause.message : "Falha de conexão.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [endpoint]);
  const invalidateRequests = useCallback(() => {
    requestVersion.current++;
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
    return invalidateRequests;
  }, [load, invalidateRequests]);

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
  const summary = platformSummary(items || []);
  const effective = filter;
  const visible = useMemo(() => {
    return searchPlatform(items || [], query, order).filter((item) => {
      const inFilter =
        effective === "all" ||
        (effective === "closed"
          ? item.state === "expired" || item.state === "suspended"
          : effective === "active"
            ? item.state === "active" || item.state === "expiring"
            : item.state === effective);
      const inPlan = planFilter === "all" || planLabel(item) === planFilter;
      const inChannel =
        channelFilter === "all" ||
        (channelFilter === "public"
          ? item.onlineBookingEnabled
          : channelFilter === "without_link"
            ? !item.onlineBookingEnabled
            : channelFilter === "receptionist"
              ? item.assistantEnabled
              : channelFilter === "ready"
                ? receptionistState(item, integrations).id === "ready"
                : item.activity.waitingHuman > 0);
      return inFilter && inPlan && inChannel;
    });
  }, [items, effective, query, order, planFilter, channelFilter, integrations]);
  const pages = Math.max(1, Math.ceil(visible.length / 25));
  const currentPage = Math.min(page, pages);

  async function act(
    body: Record<string, unknown>,
    message: string,
    method = "POST",
  ) {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const data = await call<{
        businesses: PlatformBusiness[];
        monitoring: PlatformMonitoring | null;
        monitoringError: string;
        integrations: IntegrationStatus;
        period: ActivityPeriod;
      }>(endpoint, {
        method,
        body: JSON.stringify(body),
      });
      notifyWorkspaceChange();
      if (version !== requestVersion.current) {
        toast(message);
        return;
      }
      setItems(data.businesses);
      setMonitoring(data.monitoring);
      setMonitoringError(data.monitoringError);
      setIntegrations(data.integrations);
      setLoadedPeriod(data.period);
      setError("");
      setUpdated(new Date());
      setOpen(
        data.businesses.find((item) => item.id === body.businessId) || null,
      );
      toast(message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  if (denied)
    return (
      <main className="pf-denied">
        <Brand size={34} />
        <h1>Área da equipe StudioFlow</h1>
        <p>{error || "Esta área é só para a equipe StudioFlow."}</p>
        <Link className="btn btn-secondary" href="/admin/login">
          Entrar no admin
        </Link>
      </main>
    );

  return (
    <div className="pf">
      <a className="pf-skip" href="#overview">
        Ir para o conteúdo do admin
      </a>
      <header className="pf-top">
        <Link href="/admin" className="pf-brand" aria-label="Plataforma">
          <Brand tone="on-dark" size={30} />
          <span className="pf-brand-label">Admin</span>
        </Link>
        <nav className="pf-nav" aria-label="Administração">
          {[
            ["operations", "Central de controle"],
            ["overview", "Visão geral"],
            ["businesses", "Estabelecimentos"],
            ["receptionists", "StudioFlow no WhatsApp"],
            ["billing", "Cobranças"],
            ["marketing", "Marketing"],
            ["activity", "Histórico"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={view === key ? "is-current" : ""}
              aria-pressed={view === key}
              onClick={() => {
                setOpenEvolution(false);
                setView(key);
                setOpen(null);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <select
          className="pf-mobile-navigation"
          aria-label="Seção do administrador"
          value={view}
          onChange={(event) => {
            setOpenEvolution(false);
            setView(event.target.value);
            setOpen(null);
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
        >
          <option value="operations">Central de controle</option>
          <option value="overview">Visão geral</option>
          <option value="businesses">Estabelecimentos</option>
          <option value="receptionists">StudioFlow no WhatsApp</option>
          <option value="billing">Cobranças</option>
          <option value="marketing">Marketing</option>
          <option value="activity">Histórico</option>
        </select>
        <div className="pf-top-actions">
          <span className="pf-session">
            <ShieldCheck size={14} />{" "}
            {demo ? "Demonstração local" : "Acesso administrativo"}
          </span>
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
            Estabelecimento
          </Link>
          {!demo && (
            <form action="/api/admin/logout" method="POST">
              <button className="pf-back" type="submit">
                <SignOut size={16} /> Sair
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="pf-main" id="overview" aria-busy={loading}>
        <div className="pf-head">
          <div>
            <small>ADMINISTRAÇÃO DA PLATAFORMA</small>
            <h1>{viewCopy[view].title}</h1>
            <p>{viewCopy[view].description}</p>
          </div>
          {items && view === "overview" && (
            <div className="pf-mrr">
              <small>Receita mensal combinada</small>
              <strong>{money(summary.monthly)}</strong>
              <span>
                {summary.paying}{" "}
                {summary.paying === 1 ? "cliente pagante" : "clientes pagantes"}
              </span>
            </div>
          )}
        </div>
        {view === "overview" && (
          <section className="pf-summary" aria-label="Visão geral">
            <article>
              <CalendarCheck size={20} />
              <span>Agendamentos no período</span>
              <strong>
                {items
                  ? items
                      .reduce(
                        (sum, item) => sum + item.activity.appointments,
                        0,
                      )
                      .toLocaleString("pt-BR")
                  : "–"}
              </strong>
              <small>{periodLabel}</small>
            </article>
            <article>
              <UsersThree size={20} />
              <span>Clientes cadastrados</span>
              <strong>
                {items ? summary.customers.toLocaleString("pt-BR") : "–"}
              </strong>
              <small>Total dos cadastros por estabelecimento</small>
            </article>
            <article>
              <ArrowSquareOut size={20} />
              <span>Links de agendamento ativos</span>
              <strong>{items ? summary.online : "–"}</strong>
              <small>Estabelecimentos com acesso liberado</small>
            </article>
            <article>
              <CalendarCheck size={20} />
              <span>Agendamentos pela recepcionista</span>
              <strong>
                {items
                  ? items.reduce(
                      (sum, item) => sum + item.activity.assistantBookings,
                      0,
                    )
                  : "–"}
              </strong>
              <small>No período selecionado</small>
            </article>
            <article>
              <UsersThree size={20} />
              <span>Conversas com clientes</span>
              <strong>
                {items
                  ? items.reduce(
                      (sum, item) => sum + item.activity.conversations,
                      0,
                    )
                  : "–"}
              </strong>
              <small>Com mensagens no período</small>
            </article>
            <article>
              <Package size={20} />
              <span>Recebido pelos estabelecimentos</span>
              <strong>
                {items
                  ? money(
                      items.reduce(
                        (sum, item) => sum + item.activity.received,
                        0,
                      ),
                    )
                  : "–"}
              </strong>
              <small>Pagamentos registrados, incluindo produtos</small>
            </article>
          </section>
        )}
        <div
          className="pf-period-bar"
          style={view === "marketing" ? { display: "none" } : undefined}
        >
          <label>
            Período dos indicadores{" "}
            <select
              value={preset}
              onChange={(e) => {
                const value = e.target.value;
                setPreset(value);
                if (value === "custom") {
                  setDraftPeriod(period);
                  return;
                }
                const today = activityPeriod().to;
                const from =
                  value === "today"
                    ? today
                    : value === "month"
                      ? `${today.slice(0, 7)}-01`
                      : new Date(
                          Date.parse(`${today}T12:00:00Z`) -
                            (Number(value) - 1) * 86400000,
                        )
                          .toISOString()
                          .slice(0, 10);
                setPeriod(activityPeriod(from, today));
                setOpen(null);
              }}
            >
              <option value="today">Hoje</option>
              <option value="month">Este mês</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <span role="status">
            {loading
              ? "Atualizando indicadores…"
              : `${periodLabel}${updated ? ` · atualizado às ${format(updated, "HH:mm")}` : ""}`}
          </span>
        </div>
        {preset === "custom" && (
          <form
            className="pf-custom-period"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                setPeriod(activityPeriod(draftPeriod.from, draftPeriod.to));
                setOpen(null);
              } catch (cause) {
                toast(
                  cause instanceof Error
                    ? cause.message
                    : "Escolha um período válido.",
                );
              }
            }}
          >
            <label>
              De
              <input
                type="date"
                value={draftPeriod.from}
                required
                onChange={(e) =>
                  setDraftPeriod({ ...draftPeriod, from: e.target.value })
                }
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={draftPeriod.to}
                required
                onChange={(e) =>
                  setDraftPeriod({ ...draftPeriod, to: e.target.value })
                }
              />
            </label>
            <Button type="submit" variant="secondary">
              Aplicar período
            </Button>
            <small>Até 366 dias.</small>
          </form>
        )}
        {error && (
          <p className="pf-error" role="alert">
            {error}
            {items
              ? " Os dados exibidos são da última consulta concluída."
              : ""}
          </p>
        )}
        {monitoringError &&
          ["operations", "overview", "billing", "activity"].includes(view) && (
            <p className="pf-error" role="alert">
              {monitoringError}
            </p>
          )}
        {view === "overview" && items && monitoring && (
          <OverviewPanels
            items={items}
            monitoring={monitoring}
            integrations={integrations}
            period={loadedPeriod}
            onOpen={setOpen}
            onBusinesses={(value) => {
              setView("businesses");
              window.scrollTo({ top: 0, behavior: "instant" });
              setFilter(value);
              setPage(1);
              setPlanFilter("all");
              setChannelFilter("all");
              setQuery("");
            }}
          />
        )}
        {view === "operations" && items && (
          <OperationsPanel
            items={items}
            monitoring={monitoring}
            integrations={integrations}
            onOpen={(item, tab) => {
              setOpenTab(tab);
              setOpen(item);
            }}
            onIntegrations={() => {
              setOpenEvolution(true);
              setView("receptionists");
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
          />
        )}
        {view === "receptionists" && items && (
          <ReceptionistsPanel
            items={items}
            integrations={integrations}
            onOpen={setOpen}
          />
        )}
        {view === "billing" && items && monitoring && (
          <BillingPanel
            items={items}
            monitoring={monitoring}
            period={loadedPeriod}
            onOpen={setOpen}
          />
        )}
        {view === "activity" && items && monitoring && (
          <ActivityPanel
            items={items}
            monitoring={monitoring}
            onOpen={setOpen}
          />
        )}
        {view === "marketing" && <MarketingPanel />}
        {view !== "businesses" && view !== "marketing" && !items && (
          <p className="pf-empty">
            {loading
              ? "Carregando o painel…"
              : "Não foi possível carregar os dados. Use Atualizar para tentar novamente."}
          </p>
        )}
        {view === "businesses" && (
          <>
            {items && (summary.pending > 0 || summary.expiring > 0) && (
              <div className="pf-attention">
                <ClockCountdown size={20} />
                <div>
                  <strong>Atenção aos próximos passos</strong>
                  <span>
                    {summary.pending} aguardando liberação · {summary.expiring}{" "}
                    com vencimento próximo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFilter(summary.pending ? "pending" : "expiring")
                  }
                >
                  Ver estabelecimentos <ArrowSquareOut size={14} />
                </button>
              </div>
            )}
            <div className="pf-section-head" id="businesses">
              <div>
                <h2>Estabelecimentos</h2>
                <p>Liberações, planos e atividade de cada cliente.</p>
              </div>
              <span role="status">
                {updated
                  ? `Atualizado às ${format(updated, "HH:mm")}`
                  : "Carregando…"}
              </span>
              <button
                className="pf-export"
                type="button"
                disabled={!visible.length || loading}
                onClick={() =>
                  downloadReport(
                    businessReport(visible, loadedPeriod),
                    `studioflow-estabelecimentos-${loadedPeriod.from}-${loadedPeriod.to}.csv`,
                  )
                }
              >
                <DownloadSimple size={16} />
                Exportar relatório
              </button>
            </div>
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
                  onClick={() => {
                    setFilter(item.id);
                    setPage(1);
                  }}
                >
                  <strong>
                    {items ? counts[item.id as keyof typeof counts] : "–"}
                  </strong>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="pf-list-tools">
              <div className="pf-search">
                <MagnifyingGlass size={16} />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por nome, dono, e-mail ou telefone"
                  aria-label="Buscar estabelecimento"
                />
              </div>
              <label className="pf-sort">
                Ordenar por
                <select
                  value={order}
                  onChange={(e) => {
                    setOrder(e.target.value as PlatformOrder);
                    setPage(1);
                  }}
                >
                  <option value="attention">Precisa de atenção</option>
                  <option value="recent">Cadastros recentes</option>
                  <option value="name">Nome do estabelecimento</option>
                  <option value="bookings">Mais agendamentos</option>
                  <option value="ai">Mais agendamentos pela IA</option>
                  <option value="revenue">
                    Maior valor recebido pela loja
                  </option>
                </select>
              </label>
            </div>
            <div className="pf-advanced-filters">
              <label>
                Plano
                <select
                  value={planFilter}
                  onChange={(e) => {
                    setPlanFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos os planos</option>
                  {[...new Set((items || []).map(planLabel))]
                    .sort()
                    .map((name) => (
                      <option value={name} key={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Canais e atendimento
                <select
                  value={channelFilter}
                  onChange={(e) => {
                    setChannelFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos os canais</option>
                  <option value="public">Link público ativado</option>
                  <option value="without_link">Link público desativado</option>
                  <option value="receptionist">StudioFlow ativada</option>
                  <option value="ready">WhatsApp e IA prontos</option>
                  <option value="human">Aguardando humano</option>
                </select>
              </label>
              <button
                className="pf-text-button"
                onClick={() => {
                  setQuery("");
                  setPlanFilter("all");
                  setChannelFilter("all");
                  setFilter("all");
                  setPage(1);
                }}
              >
                Limpar filtros
              </button>
            </div>
            {items && (
              <p className="pf-results" aria-live="polite">
                {visible.length} de {items.length} estabelecimentos
              </p>
            )}
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
                {visible
                  .slice((currentPage - 1) * 25, currentPage * 25)
                  .map((item, index) => (
                    <li
                      key={item.id}
                      className={`pf-row is-${item.state}`}
                      style={{
                        animationDelay: `${Math.min(index, 10) * 40}ms`,
                      }}
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
                          {item.onlineBookingEnabled ? (
                            <a
                              href={`/${item.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              /{item.slug} <ArrowSquareOut size={11} />
                            </a>
                          ) : (
                            <small>/{item.slug} · link desativado</small>
                          )}
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
                        <span
                          className={`pf-channel ${item.onlineBookingEnabled ? "is-online" : ""}`}
                        >
                          Link{" "}
                          {item.onlineBookingEnabled ? "ativado" : "desativado"}
                        </span>
                        <span>
                          <CalendarCheck size={14} />{" "}
                          {item.activity.appointments} no período ·{" "}
                          {item.activity.assistantBookings} pela IA
                        </span>
                        <span>
                          <UsersThree size={14} /> {item.customers} clientes
                        </span>
                        <span>
                          {money(item.activity.received)} recebidos · WhatsApp{" "}
                          {item.whatsappStatus === "open"
                            ? "conectado"
                            : "desconectado"}
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
            {pages > 1 && (
              <Pagination page={currentPage} pages={pages} onChange={setPage} />
            )}
          </>
        )}
        {view === "receptionists" && (
          <EvolutionConfiguration
            demo={demo}
            onSaved={load}
            initiallyOpen={openEvolution}
          />
        )}
        {view === "billing" && (
          <details className="pf-integration">
            <summary>
              WhatsApp da plataforma <span>Lembretes de mensalidade</span>
            </summary>
            <PlatformWhatsApp />
          </details>
        )}
      </main>
      {open && (
        <AccessSheet
          key={open.id}
          item={open}
          integrations={integrations}
          periodLabel={periodLabel}
          onClose={() => setOpen(null)}
          demo={demo}
          initialTab={
            view === "operations"
              ? openTab
              : view === "billing"
                ? "billing"
                : "assistant"
          }
          onSaved={load}
          onAct={act}
        />
      )}
    </div>
  );
}

const quick = [7, 15, 30, 90, 365];

function AccessSheet({
  demo,
  onSaved,
  initialTab,
  item,
  integrations,
  periodLabel,
  onClose,
  onAct,
}: {
  item: PlatformBusiness;
  demo: boolean;
  initialTab: string;
  onSaved: () => Promise<void>;
  integrations: IntegrationStatus | null;
  periodLabel: string;
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
  const [eventsError, setEventsError] = useState("");
  const [channelEvents, setChannelEvents] = useState<ChannelEvent[]>([]);
  const modulesKey = item.modules?.join(",") ?? "all";
  const [now] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    void call<{ events: AccessEvent[]; channelEvents: ChannelEvent[] }>(
      `/api/admin/platform/${item.id}`,
    )
      .then((data) => {
        if (alive) {
          setEvents(data.events);
          setChannelEvents(data.channelEvents);
        }
      })
      .catch(() => {
        if (alive)
          setEventsError(
            "Não foi possível carregar o histórico. Reabra o estabelecimento para tentar novamente.",
          );
      });
    return () => {
      alive = false;
    };
  }, [
    item.id,
    item.status,
    item.until,
    item.onlineBookingEnabled,
    item.assistantEnabled,
    item.note,
    item.plan,
    item.price,
    modulesKey,
  ]);

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

        <PlatformControls
          item={item}
          integrations={integrations}
          onAct={onAct}
        />
        <ClientConfigurationPanel
          item={item}
          demo={demo}
          onSaved={onSaved}
          initialTab={initialTab}
        />
        <PlatformMetrics item={item} periodLabel={periodLabel} />
        <ClientAudit item={item} />
        <ChannelHistory events={channelEvents} />
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
          {eventsError ? (
            <p className="pf-error" role="alert">
              {eventsError}
            </p>
          ) : !events ? (
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
  const [price, setPrice] = useState(
    item.price ? item.price.toFixed(2).replace(".", ",") : "",
  );
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
        <Package size={18} /> Plano e módulos liberados
      </h3>
      <p className="pf-metric-note">
        Marcado = disponível para o cliente. Desmarcado = oculto e bloqueado.
        Painéis já abertos atualizam ao voltar à janela ou em até 30 segundos.
      </p>
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
        Sempre incluso: canais de agendamento configuráveis, agenda, clientes,
        serviços, equipe, financeiro, relatórios e divulgação.
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
