"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChatCircleDots,
  LockKey,
  Receipt,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { PlatformBusiness } from "@/services/platform";
import type { PlatformMonitoring } from "@/lib/platform-reporting";
import { platformPlanLabel } from "@/lib/platform-reporting";
import {
  businessOperations,
  matchesOperation,
  type OperationFilter,
} from "@/lib/platform-operations";
import type { IntegrationStatus } from "./platform-controls";
import { searchPlatform } from "./platform-summary";
import { Pagination } from "./platform-views";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const number = (value: number) => value.toLocaleString("pt-BR");
const accessLabels = {
  active: "Liberado",
  expiring: "Vence em breve",
  expired: "Vencido",
  pending: "Aguardando liberação",
  suspended: "Pausado",
};
const filterLabels: [OperationFilter, string][] = [
  ["all", "Todos os estabelecimentos"],
  ["attention", "Precisam de atenção"],
  ["human", "Aguardando atendimento humano"],
  ["ready", "StudioFlow no WhatsApp prontas"],
  ["overdue", "Mensalidades vencidas"],
  ["vault", "Credencial de IA pendente"],
];

export function OperationsPanel({
  items,
  monitoring,
  integrations,
  onOpen,
  onIntegrations,
}: {
  items: PlatformBusiness[];
  monitoring: PlatformMonitoring | null;
  integrations: IntegrationStatus | null;
  onOpen: (
    item: PlatformBusiness,
    tab: "assistant" | "vault" | "billing",
  ) => void;
  onIntegrations: () => void;
}) {
  const [filter, setFilter] = useState<OperationFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const rows = useMemo(
    () =>
      items.map((i) =>
        businessOperations(
          i,
          monitoring?.invoices ?? null,
          integrations,
          today,
        ),
      ),
    [items, monitoring, integrations, today],
  );
  const searched = new Set(
    searchPlatform(items, query, "name").map((i) => i.id),
  );
  const visible = rows
    .filter((r) => searched.has(r.item.id) && matchesOperation(r, filter))
    .sort(
      (a, b) =>
        b.item.activity.waitingHuman - a.item.activity.waitingHuman ||
        b.reasons.length - a.reasons.length ||
        a.item.name.localeCompare(b.item.name, "pt-BR"),
    );
  const pages = Math.max(1, Math.ceil(visible.length / 12));
  const currentPage = Math.min(page, pages);
  const metrics: [OperationFilter, string, number][] = [
    ["all", "Estabelecimentos", rows.length],
    [
      "attention",
      "Precisam de atenção",
      rows.filter((r) => r.reasons.length).length,
    ],
    [
      "ready",
      "StudioFlow no WhatsApp prontas",
      rows.filter((r) => r.receptionist.id === "ready").length,
    ],
    [
      "human",
      "Conversas aguardando humano",
      items.reduce((sum, i) => sum + i.activity.waitingHuman, 0),
    ],
    [
      "overdue",
      "Clientes com mensalidade vencida",
      rows.filter((r) => (r.overdueInvoices ?? 0) > 0).length,
    ],
  ];
  return (
    <section className="pf-operations" aria-label="Central de controle">
      <div className="pf-command">
        <div>
          <small>OPERAÇÃO DO STUDIOFLOW</small>
          <h2>
            Cada cliente. Cada canal.
            <br />
            Tudo sob controle.
          </h2>
          <p>
            Encontre pendências, acompanhe resultados e abra a configuração de
            cada estabelecimento.
          </p>
        </div>
        <div className="pf-command-services">
          <span>
            <i className={integrations?.evolution ? "is-ready" : ""} />
            Evolution API{" "}
            <b>
              {integrations === null
                ? "Verificando"
                : integrations.evolution
                  ? "Configurada"
                  : "Pendente"}
            </b>
          </span>
          <span>
            <i className={integrations?.ai ? "is-ready" : ""} />
            IA da plataforma{" "}
            <b>
              {integrations === null
                ? "Verificando"
                : integrations.ai
                  ? "Configurada"
                  : "Cofres individuais"}
            </b>
          </span>
          <span>
            <LockKey size={14} />
            Cofres individuais{" "}
            <b>{rows.filter((r) => r.item.aiConfigured).length} configurados</b>
          </span>
          <button type="button" onClick={onIntegrations}>
            Configurar WhatsApp <ArrowRight size={16} />
          </button>
          <small>
            O status indica configuração cadastrada. A conexão de cada número
            aparece abaixo.
          </small>
        </div>
      </div>
      <div className="pf-operation-kpis">
        {metrics.map(([key, label, value]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "is-current" : ""}
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
            aria-pressed={filter === key}
          >
            <span>{label}</span>
            <strong>
              {key === "overdue" && !monitoring ? "–" : number(value)}
            </strong>
          </button>
        ))}
      </div>
      <div className="pf-operations-tools">
        <label>
          Buscar cliente da plataforma
          <input
            type="search"
            placeholder="Nome, responsável ou e-mail"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Prioridade
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as OperationFilter);
              setPage(1);
            }}
          >
            {filterLabels.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="pf-results" role="status">
        {visible.length} de {items.length} estabelecimentos · resultados no
        período selecionado; conexões, acessos e dívida na situação atual.
      </p>
      <div className="pf-operation-clients">
        {visible.slice((currentPage - 1) * 12, currentPage * 12).map((row) => {
          const { item } = row;
          return (
            <article className="pf-operation-client" key={item.id}>
              <header>
                <div>
                  <small>{platformPlanLabel(item)}</small>
                  <h3>{item.name}</h3>
                  <span>{item.ownerName || "Responsável não informado"}</span>
                </div>
                <span className={`pf-badge is-${item.state}`}>
                  {accessLabels[item.state]}
                </span>
              </header>
              <div className="pf-client-channels">
                <span>
                  <ShieldCheck size={14} />
                  Link {item.onlineBookingEnabled ? "ativado" : "desativado"}
                </span>
                <span
                  className={row.receptionist.id === "ready" ? "is-ready" : ""}
                >
                  <ChatCircleDots size={14} />
                  {row.receptionist.label}
                </span>
              </div>
              <dl className="pf-client-numbers">
                <div>
                  <dt>Agendamentos</dt>
                  <dd>{number(item.activity.appointments)}</dd>
                  <small>
                    {number(item.activity.bookingCustomers)} clientes que
                    agendaram
                  </small>
                </div>
                <div>
                  <dt>Pela recepcionista</dt>
                  <dd>{number(item.activity.assistantBookings)}</dd>
                  <small>
                    {number(item.activity.assistantCustomers)} clientes
                    atendidos
                  </small>
                </div>
                <div>
                  <dt>Recebido pela loja</dt>
                  <dd>{money(item.activity.received)}</dd>
                  <small>Pagamentos registrados</small>
                </div>
                <div>
                  <dt>Recebido de agendamentos IA</dt>
                  <dd>{money(item.activity.assistantReceived)}</dd>
                  <small>Parte do total recebido</small>
                </div>
              </dl>
              {row.reasons.length > 0 ? (
                <ul className="pf-client-alerts">
                  {row.reasons.map((reason) => (
                    <li key={reason}>
                      <WarningCircle size={14} />
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pf-client-clear">
                  <ShieldCheck size={15} />
                  Sem pendências identificadas
                </p>
              )}
              <details className="pf-client-detail">
                <summary>Atendimento, consumo e financeiro</summary>
                <dl>
                  <div>
                    <dt>Conversas no período</dt>
                    <dd>{number(item.activity.conversations)}</dd>
                  </div>
                  <div>
                    <dt>Aguardando humano agora</dt>
                    <dd>{number(item.activity.waitingHuman)}</dd>
                  </div>
                  <div>
                    <dt>Respostas da IA</dt>
                    <dd>{number(item.activity.turns)}</dd>
                  </div>
                  <div>
                    <dt>Tokens de entrada / saída</dt>
                    <dd>
                      {number(item.activity.inputTokens)} /{" "}
                      {number(item.activity.outputTokens)}
                    </dd>
                  </div>
                  <div>
                    <dt>Credencial de IA</dt>
                    <dd>
                      {item.aiConfigured
                        ? "Cofre individual configurado"
                        : integrations?.ai
                          ? "Chave da plataforma"
                          : "Pendente"}
                    </dd>
                  </div>
                  <div>
                    <dt>Mensalidade combinada</dt>
                    <dd>
                      {item.price === null ? "Não definida" : money(item.price)}
                    </dd>
                  </div>
                  <div>
                    <dt>Mensalidades em aberto</dt>
                    <dd>
                      {row.outstanding === null
                        ? "Indisponível"
                        : `${money(row.outstanding)} · ${row.openInvoices} fatura(s)`}
                    </dd>
                  </div>
                  <div>
                    <dt>Mensalidades vencidas</dt>
                    <dd>
                      {row.overdue === null
                        ? "Indisponível"
                        : `${money(row.overdue)} · ${row.overdueInvoices} fatura(s)`}
                    </dd>
                  </div>
                </dl>
                <p>
                  Recebimentos não equivalem a lucro líquido. Consumo mostra
                  tokens registrados, sem estimativa de custo.
                </p>
              </details>
              <footer>
                <button type="button" onClick={() => onOpen(item, "assistant")}>
                  <ChatCircleDots size={15} />
                  Gerenciar
                </button>
                <button type="button" onClick={() => onOpen(item, "vault")}>
                  <LockKey size={15} />
                  Cofre
                </button>
                <button type="button" onClick={() => onOpen(item, "billing")}>
                  <Receipt size={15} />
                  Cobranças
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <p className="pf-panel-empty">
          Nenhum estabelecimento corresponde aos filtros.
        </p>
      )}
      {pages > 1 && (
        <Pagination page={currentPage} pages={pages} onChange={setPage} />
      )}
    </section>
  );
}
