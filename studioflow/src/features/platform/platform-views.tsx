"use client";
import { useMemo, useState } from "react";
import {
  DownloadSimple,
  ArrowRight,
  WarningCircle,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { PlatformBusiness } from "@/services/platform";
import type { ActivityPeriod } from "@/lib/platform-activity";
import {
  aggregateActivity,
  billingSummary,
  invoiceState,
  platformPlanLabel,
  receptionistState,
  reportCsv,
  type PlatformMonitoring,
} from "@/lib/platform-reporting";
import type { IntegrationStatus } from "./platform-controls";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const number = (value: number) => value.toLocaleString("pt-BR");
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value));
export function downloadReport(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type BusinessProps = {
  items: PlatformBusiness[];
  onOpen: (item: PlatformBusiness) => void;
};
export function OverviewPanels({
  items,
  monitoring,
  integrations,
  period,
  onOpen,
  onBusinesses,
}: BusinessProps & {
  monitoring: PlatformMonitoring;
  integrations: IntegrationStatus | null;
  period: ActivityPeriod;
  onBusinesses: (filter: "pending" | "expiring" | "closed" | "all") => void;
}) {
  const [ranking, setRanking] = useState<
    "appointments" | "assistantBookings" | "received"
  >("appointments");
  const totals = aggregateActivity(items);
  const bills = billingSummary(
    monitoring.invoices,
    period,
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    ),
  );
  const ranked = [...items]
    .sort(
      (a, b) =>
        b.activity[ranking] - a.activity[ranking] ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
    .filter((i) => i.activity[ranking] > 0)
    .slice(0, 5);
  const attention = items
    .map((item) => ({
      item,
      reasons: [
        item.state === "pending" && "Aguardando liberação",
        item.state === "expiring" && "Prazo de acesso termina em breve",
        item.state === "expired" && "Prazo de acesso vencido",
        item.activity.waitingHuman > 0 &&
          `${item.activity.waitingHuman} conversa(s) aguardando humano`,
        item.assistantEnabled &&
          receptionistState(item, integrations).id !== "ready" &&
          receptionistState(item, integrations).label,
      ].filter(Boolean) as string[],
    }))
    .filter((i) => i.reasons.length)
    .sort(
      (a, b) =>
        (a.item.state === "pending" ? -1 : 0) -
          (b.item.state === "pending" ? -1 : 0) ||
        b.item.activity.waitingHuman - a.item.activity.waitingHuman,
    )
    .slice(0, 6);
  const plans = new Map<string, { count: number; monthly: number }>();
  for (const item of items) {
    const name = platformPlanLabel(item),
      plan = plans.get(name) || { count: 0, monthly: 0 };
    plan.count++;
    if (["active", "expiring"].includes(item.state))
      plan.monthly += item.price || 0;
    plans.set(name, plan);
  }
  const sources = [
    ["Link público", totals.publicBookings, "public"],
    ["StudioFlow", totals.assistantBookings, "assistant"],
    ["Manuais", totals.manualBookings, "manual"],
    ["Sem origem registrada", totals.legacyBookings, "legacy"],
  ] as const;
  return (
    <div className="pf-dashboard-grid">
      <section className="pf-panel pf-wide">
        <div className="pf-panel-head">
          <div>
            <small>STUDIOFLOW</small>
            <h2>Sua operação</h2>
          </div>
          <span>Receitas da plataforma</span>
        </div>
        <div className="pf-operation-stats">
          <div>
            <span>Mensalidades recebidas</span>
            <strong>{money(bills.received)}</strong>
            <small>{bills.paid} pagamentos no período</small>
          </div>
          <div>
            <span>Faturas em aberto agora</span>
            <strong>{money(bills.outstanding)}</strong>
            <small>
              {bills.pending} faturas · {bills.overdueCount} vencidas
            </small>
          </div>
          <div>
            <span>Estabelecimentos</span>
            <strong>{items.length}</strong>
            <small>
              {
                items.filter((i) => ["active", "expiring"].includes(i.state))
                  .length
              }{" "}
              com acesso liberado
            </small>
          </div>
        </div>
        <div className="pf-shortcuts">
          <button onClick={() => onBusinesses("pending")}>
            {items.filter((i) => i.state === "pending").length} aguardando
            liberação <ArrowRight size={14} />
          </button>
          <button onClick={() => onBusinesses("expiring")}>
            {items.filter((i) => i.state === "expiring").length} vencendo{" "}
            <ArrowRight size={14} />
          </button>
          <button onClick={() => onBusinesses("closed")}>
            {
              items.filter((i) => ["expired", "suspended"].includes(i.state))
                .length
            }{" "}
            vencidos ou pausados <ArrowRight size={14} />
          </button>
        </div>
      </section>
      <section className="pf-panel">
        <div className="pf-panel-head">
          <h2>Precisa de atenção</h2>
          <WarningCircle size={20} />
        </div>
        {attention.length ? (
          <ul className="pf-alert-list">
            {attention.map(({ item, reasons }) => (
              <li key={item.id}>
                <button onClick={() => onOpen(item)}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{reasons.join(" · ")}</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pf-panel-empty">
            <CheckCircle size={24} />
            Nenhuma pendência identificada nos dados atuais.
          </p>
        )}
      </section>
      <section className="pf-panel">
        <div className="pf-panel-head">
          <h2>Origem dos agendamentos</h2>
          <span>{number(totals.appointments)} criados</span>
        </div>
        <div className="pf-source-bar" aria-hidden="true">
          {sources.map(([label, value, key]) => (
            <span
              key={key}
              className={`is-${key}`}
              style={{
                width: `${totals.appointments ? (value / totals.appointments) * 100 : 0}%`,
              }}
              title={`${label}: ${value}`}
            />
          ))}
        </div>
        <ul className="pf-source-list">
          {sources.map(([label, value, key]) => (
            <li key={key}>
              <span>
                <i className={`is-${key}`} />
                {label}
              </span>
              <b>{number(value)}</b>
            </li>
          ))}
        </ul>
        <p className="pf-metric-note">
          Origens passaram a ser registradas na implantação dos canais.
          Cancelados ficam fora desta distribuição.
        </p>
      </section>
      <section className="pf-panel">
        <div className="pf-panel-head">
          <h2>Resultados por estabelecimento</h2>
        </div>
        <label className="pf-ranking-label">
          Comparar por
          <select
            value={ranking}
            onChange={(e) => setRanking(e.target.value as typeof ranking)}
          >
            <option value="appointments">Agendamentos criados</option>
            <option value="assistantBookings">Agendamentos pela IA</option>
            <option value="received">Valores recebidos pelas lojas</option>
          </select>
        </label>
        {ranked.length ? (
          <ol className="pf-ranking">
            {ranked.map((item, index) => (
              <li key={item.id}>
                <button onClick={() => onOpen(item)}>
                  <b>{index + 1}</b>
                  <span>
                    {item.name}
                    <i
                      style={{
                        width: `${(item.activity[ranking] / ranked[0].activity[ranking]) * 100}%`,
                      }}
                    />
                  </span>
                  <strong>
                    {ranking === "received"
                      ? money(item.activity.received)
                      : number(item.activity[ranking])}
                  </strong>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pf-panel-empty">
            Sem resultados registrados para esta comparação no período.
          </p>
        )}
        <p className="pf-metric-note">
          Recebimentos das lojas incluem pagamentos e produtos. Lucro líquido
          não é apurado.
        </p>
      </section>
      <section className="pf-panel">
        <div className="pf-panel-head">
          <h2>Planos contratados</h2>
          <span>{plans.size} configurações</span>
        </div>
        <ul className="pf-source-list">
          {[...plans]
            .sort((a, b) => b[1].count - a[1].count)
            .map(([name, value]) => (
              <li key={name}>
                <span>
                  {name}
                  <small>{value.count} estabelecimento(s)</small>
                </span>
                <b>
                  {money(value.monthly)}
                  <small>/mês combinado</small>
                </b>
              </li>
            ))}
        </ul>
        <p className="pf-metric-note">
          Somente acessos ativos entram na mensalidade combinada. O valor
          recebido está na área Cobranças.
        </p>
      </section>
    </div>
  );
}

export function ReceptionistsPanel({
  items,
  integrations,
  onOpen,
}: BusinessProps & { integrations: IntegrationStatus | null }) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const rows = items.filter(
    (i) =>
      i.name
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")) &&
      (filter === "all" ||
        (filter === "ready"
          ? receptionistState(i, integrations).id === "ready"
          : filter === "pending"
            ? i.assistantEnabled &&
              receptionistState(i, integrations).id !== "ready"
            : filter === "human"
              ? i.activity.waitingHuman > 0
              : !i.assistantEnabled)),
  );
  const totals = aggregateActivity(items);
  return (
    <section className="pf-view-section">
      <div className="pf-section-head">
        <div>
          <h2>StudioFlow no WhatsApp e conexões</h2>
          <p>Configuração, atendimento e resultados de cada estabelecimento.</p>
        </div>
      </div>
      <div className="pf-status-strip">
        <span>
          Evolution API{" "}
          <b>
            {integrations?.evolution ? "Configurada" : "Configuração pendente"}
          </b>
        </span>
        <span>
          Provedor de IA{" "}
          <b>
            {integrations?.ai
              ? "Padrão configurado"
              : `${items.filter((i) => i.aiConfigured).length} com chave própria`}
          </b>
        </span>
        <span>
          Prontas para atender{" "}
          <b>
            {
              items.filter(
                (i) => receptionistState(i, integrations).id === "ready",
              ).length
            }
          </b>
        </span>
        <span>
          Aguardando humano agora <b>{totals.waitingHuman}</b>
        </span>
      </div>
      <div className="pf-list-tools">
        <div className="pf-search">
          <input
            aria-label="Buscar recepcionista"
            placeholder="Buscar estabelecimento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="pf-sort">
          Situação
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todas</option>
            <option value="ready">Prontas para atender</option>
            <option value="pending">Ativadas com pendências</option>
            <option value="human">Aguardando humano</option>
            <option value="disabled">Desativadas</option>
          </select>
        </label>
      </div>
      <p className="pf-metric-note">
        Estado de conexão registrado pelo sistema. O cliente conecta seu próprio
        número em Configurações → StudioFlow. Este painel acompanha os
        resultados, configura a recepcionista e mantém a credencial de cada
        cliente no cofre.
      </p>
      <div className="pf-table-wrap">
        <table className="pf-table">
          <thead>
            <tr>
              <th>Estabelecimento</th>
              <th>StudioFlow / WhatsApp</th>
              <th>Conversas</th>
              <th>Agendamentos IA</th>
              <th>Clientes IA</th>
              <th>Recebido da IA</th>
              <th>Uso da IA</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <th scope="row">
                  {i.name}
                  <small>{platformPlanLabel(i)}</small>
                </th>
                <td>
                  <span
                    className={`pf-state-pill ${receptionistState(i, integrations).id === "ready" ? "is-ready" : ""}`}
                  >
                    {receptionistState(i, integrations).label}
                  </span>
                  <small>
                    {i.whatsappStatus === "open"
                      ? "WhatsApp conectado"
                      : i.whatsappStatus === "connecting"
                        ? "Aguardando leitura do QR"
                        : "WhatsApp desconectado"}
                  </small>
                </td>
                <td>
                  {number(i.activity.conversations)}
                  <small>{i.activity.waitingHuman} aguardando humano</small>
                </td>
                <td>
                  {number(i.activity.assistantBookings)}
                  <small>{i.activity.whatsappBookings} pelo WhatsApp</small>
                </td>
                <td>{number(i.activity.assistantCustomers)}</td>
                <td>{money(i.activity.assistantReceived)}</td>
                <td>
                  {number(i.activity.turns)} respostas
                  <small>
                    {number(i.activity.inputTokens + i.activity.outputTokens)}{" "}
                    tokens
                  </small>
                </td>
                <td>
                  <button className="pf-text-button" onClick={() => onOpen(i)}>
                    Gerenciar <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="pf-empty">Nenhum estabelecimento com este filtro.</p>
        )}
      </div>
      <p className="pf-metric-note">
        Tokens representam consumo registrado, sem estimativa de custo.
        Aguardando humano é a fila atual; os demais indicadores seguem o período
        selecionado.
      </p>
    </section>
  );
}

export function BillingPanel({
  items,
  monitoring,
  period,
  onOpen,
}: BusinessProps & { monitoring: PlatformMonitoring; period: ActivityPeriod }) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const names = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const totals = billingSummary(monitoring.invoices, period, today);
  const visible = monitoring.invoices.filter(
    (i) =>
      (filter === "all" ||
        (filter === "pending"
          ? i.status === "pending"
          : invoiceState(i, today) === filter)) &&
      (names.get(i.businessId)?.name || "")
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 25)),
    current = Math.min(page, pages);
  const labels: Record<string, string> = {
    pending: "Em aberto",
    paid: "Paga",
    cancelled: "Cancelada",
    overdue: "Vencida",
  };
  const exportInvoices = () =>
    downloadReport(
      reportCsv([
        [
          "Estabelecimento",
          "Valor da fatura",
          "Situação",
          "Vencimento",
          "Pagamento",
          "Emissão",
          "Origem da cobrança",
          "Forma de pagamento",
          "Início do período",
          "Fim do período",
        ],
        ...visible.map((i) => [
          names.get(i.businessId)?.name || "Estabelecimento indisponível",
          i.value,
          labels[invoiceState(i, today)],
          i.dueDate,
          i.paidAt || "",
          i.createdAt,
          i.source === "manual" ? "Manual" : "Asaas",
          i.method || "",
          period.from,
          period.to,
        ]),
      ]),
      `studioflow-cobrancas-${period.from}-${period.to}.csv`,
    );
  return (
    <section className="pf-view-section">
      <div className="pf-section-head">
        <div>
          <h2>Cobranças do StudioFlow</h2>
          <p>
            Mensalidades registradas na plataforma e faturas ainda em aberto.
          </p>
        </div>
        <button
          className="pf-export"
          onClick={exportInvoices}
          disabled={!visible.length}
        >
          <DownloadSimple size={16} />
          Exportar cobranças
        </button>
      </div>
      <div className="pf-operation-stats pf-panel">
        <div>
          <span>Recebido no período</span>
          <strong>{money(totals.received)}</strong>
          <small>{totals.paid} faturas pagas</small>
        </div>
        <div>
          <span>Em aberto agora</span>
          <strong>{money(totals.outstanding)}</strong>
          <small>{totals.pending} faturas pendentes</small>
        </div>
        <div>
          <span>Vencido agora</span>
          <strong>{money(totals.overdue)}</strong>
          <small>{totals.overdueCount} faturas vencidas</small>
        </div>
      </div>
      {!monitoring.billingReady && (
        <p className="pf-readiness">
          Cobrança online aguardando configuração do Asaas da plataforma. O
          relatório continua mostrando os registros existentes.
        </p>
      )}
      <div className="pf-list-tools">
        <div className="pf-search">
          <input
            aria-label="Buscar cobrança"
            placeholder="Buscar estabelecimento"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <label className="pf-sort">
          Situação
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todas as faturas</option>
            <option value="pending">Em aberto</option>
            <option value="overdue">Vencidas</option>
            <option value="paid">Pagas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>
      </div>
      <p className="pf-results">
        {visible.length} fatura(s). Lista inclui emissões/pagamentos no período
        e todas as faturas em aberto.
      </p>
      <div className="pf-table-wrap">
        <table className="pf-table">
          <thead>
            <tr>
              <th>Estabelecimento</th>
              <th>Valor</th>
              <th>Situação</th>
              <th>Vencimento</th>
              <th>Pago em</th>
              <th>Emissão</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.slice((current - 1) * 25, current * 25).map((i) => (
              <tr key={i.id}>
                <th scope="row">
                  {names.get(i.businessId)?.name ||
                    "Estabelecimento indisponível"}
                </th>
                <td>
                  {money(i.value)}
                  <small>
                    {i.source === "manual" ? "Registro manual" : "Asaas"}
                  </small>
                </td>
                <td>
                  <span
                    className={`pf-state-pill is-${invoiceState(i, today)}`}
                  >
                    {labels[invoiceState(i, today)]}
                  </span>
                </td>
                <td>{date(i.dueDate)}</td>
                <td>{i.paidAt ? date(i.paidAt) : "—"}</td>
                <td>{date(i.createdAt)}</td>
                <td>
                  {names.has(i.businessId) && (
                    <button
                      className="pf-text-button"
                      onClick={() => onOpen(names.get(i.businessId)!)}
                    >
                      Gerenciar <ArrowRight size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="pf-empty">Nenhuma fatura registrada com este filtro.</p>
        )}
      </div>
      {pages > 1 && (
        <Pagination page={current} pages={pages} onChange={setPage} />
      )}
      <p className="pf-metric-note">
        Recebido considera a data do pagamento. Mensalidade combinada não
        equivale a pagamento confirmado. Os registros manuais ficam separados
        das cobranças online do Asaas. Abra Gerenciar para registrar
        mensalidades e confirmar recebimentos.
      </p>
    </section>
  );
}

export function ActivityPanel({
  items,
  monitoring,
  onOpen,
}: BusinessProps & { monitoring: PlatformMonitoring }) {
  const [kind, setKind] = useState("all"),
    [business, setBusiness] = useState("all");
  const names = new Map(items.map((i) => [i.id, i]));
  const rows = monitoring.events.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (business === "all" || e.businessId === business),
  );
  return (
    <section className="pf-view-section">
      <div className="pf-section-head">
        <div>
          <h2>Atividade administrativa</h2>
          <p>
            Últimas 50 alterações no período: acessos, planos, canais e
            configurações.
          </p>
        </div>
      </div>
      <div className="pf-list-tools">
        <label className="pf-sort">
          Estabelecimento
          <select
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
          >
            <option value="all">Todos</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="pf-sort">
          Tipo de alteração
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Todas</option>
            <option value="access">Acesso e plano</option>
            <option value="configuration">Configurações e cofre</option>
            <option value="channel">Canais de agendamento</option>
          </select>
        </label>
      </div>
      <ol className="pf-activity-list">
        {rows.map((e) => (
          <li key={e.id}>
            <time dateTime={e.createdAt}>
              {new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Sao_Paulo",
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(e.createdAt))}
            </time>
            <div>
              <strong>
                {names.get(e.businessId)?.name ||
                  (e.businessId === "platform"
                    ? "StudioFlow"
                    : "Estabelecimento indisponível")}
              </strong>
              <span>{e.label}</span>
            </div>
            {names.has(e.businessId) && (
              <button
                className="pf-text-button"
                onClick={() => onOpen(names.get(e.businessId)!)}
              >
                Ver detalhes <ArrowRight size={14} />
              </button>
            )}
          </li>
        ))}
      </ol>
      {!rows.length && (
        <p className="pf-empty">
          Nenhuma alteração registrada com estes filtros.
        </p>
      )}
      <p className="pf-metric-note">
        Cada estabelecimento mantém seu histórico individual em Gerenciar. A
        fila atual do atendimento humano fica na área StudioFlow no WhatsApp.
      </p>
    </section>
  );
}
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pf-pagination" aria-label="Paginação">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Próxima
      </button>
    </nav>
  );
}
