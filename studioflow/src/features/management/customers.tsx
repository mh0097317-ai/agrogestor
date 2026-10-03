"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Plus } from "lucide-react";
import { Avatar, Button, EmptyState, PageHeader } from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { money } from "@/lib/utils";
import type { Customer } from "@/types";
import { ManagementBoundary, SearchField } from "./shared";
import { CustomerProfile } from "./customer-profile";
import { CustomerEditor } from "./customer-editor";
import {
  customerDays,
  customerNeedsReturn,
  customerVisitLabel,
} from "@/lib/customer-metrics";
import "./customers.css";

type Filter = "all" | "new" | "active" | "inactive" | "return";
const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "return", label: "À retornar" },
  { id: "new", label: "Novos" },
  { id: "active", label: "Ativos" },
  { id: "inactive", label: "Inativos" },
];

export default function CustomersPage() {
  const { data } = useWorkspace();
  const { canMutate } = usePermissions();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null | undefined>();
  const customers = useMemo(
    () =>
      (data?.customers ?? [])
        .filter((customer) => {
          const term = search.toLocaleLowerCase("pt-BR").trim();
          const digits = term.replace(/\D/g, "");
          const matches =
            customer.name.toLocaleLowerCase("pt-BR").includes(term) ||
            (digits.length > 0 &&
              customer.phone.replace(/\D/g, "").includes(digits));
          const days = customerDays(customer.lastVisit);
          return (
            matches &&
            (filter === "all" ||
              (filter === "return" && customerNeedsReturn(customer)) ||
              (filter === "new" && customerDays(customer.createdAt)! <= 30) ||
              (filter === "active" && days !== undefined && days <= 45) ||
              (filter === "inactive" && (days === undefined || days > 45)))
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [data, search, filter],
  );
  const returnCount = (data?.customers ?? []).filter((customer) =>
    customerNeedsReturn(customer),
  ).length;
  const current = data?.customers.find((customer) => customer.id === selected);

  return (
    <ManagementBoundary>
      <div className="crm-page">
        <PageHeader
          title="Clientes"
          description="Boas relações merecem continuidade."
          actions={
            canMutate("customers") && (
              <Button onClick={() => setEditing(null)}>
                <Plus size={16} />
                Novo cliente
              </Button>
            )
          }
        />
        <div className="crm-context">
          <span>
            <strong>{data?.customers.length ?? 0}</strong> pessoas fazem parte
            da sua história
          </span>
          {returnCount > 0 && (
            <button onClick={() => setFilter("return")}>
              <Clock3 size={16} />
              <strong>{returnCount}</strong> na hora de voltar
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
        <div className="crm-controls">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome ou telefone..."
          />
          <div className="crm-filters" aria-label="Filtrar clientes">
            {filters.map((item) => (
              <button
                key={item.id}
                aria-pressed={filter === item.id}
                className={filter === item.id ? "selected" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                {item.id === "all" && (
                  <span>{data?.customers.length ?? 0}</span>
                )}
                {item.id === "return" && <span>{returnCount}</span>}
              </button>
            ))}
          </div>
        </div>
        {customers.length ? (
          <div className="crm-directory">
            <div className="crm-list-head" aria-hidden="true">
              <span>Cliente</span>
              <span>Atendimentos</span>
              <span>Última visita</span>
              <span>Total recebido</span>
              <span>Relacionamento</span>
              <span />
            </div>
            <ul>
              {customers.map((customer) => {
                const overdue = customerNeedsReturn(customer);
                const days = customerDays(customer.lastVisit);
                return (
                  <li key={customer.id}>
                    <button
                      className="crm-row"
                      onClick={() => setSelected(customer.id)}
                      aria-label={`Ver perfil de ${customer.name}`}
                    >
                      <div className="crm-person">
                        <Avatar name={customer.name} size={42} />
                        <div>
                          <strong>{customer.name}</strong>
                          <span className="crm-phone">{customer.phone}</span>
                          <span className="crm-mobile-visit">
                            {customer.visits} atendimentos ·{" "}
                            {customerVisitLabel(customer)}
                          </span>
                        </div>
                      </div>
                      <span className="crm-visits">{customer.visits}</span>
                      <span className="crm-last-visit">
                        {customerVisitLabel(customer)}
                      </span>
                      <strong className="crm-spent">
                        {money(customer.totalSpent)}
                      </strong>
                      <span
                        className={`crm-relationship ${overdue ? "is-due" : ""}`}
                      >
                        {overdue
                          ? "Hora de retornar"
                          : days !== undefined && days <= 45
                            ? "Cliente ativo"
                            : "Sem visita recente"}
                      </span>
                      <ArrowUpRight className="crm-row-arrow" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <EmptyState
            title="Nenhum cliente encontrado"
            description={
              search || filter !== "all"
                ? "Ajuste a busca ou o filtro para encontrar seu cliente."
                : "Os clientes aparecem aqui após o primeiro agendamento."
            }
            action={
              (search || filter !== "all") && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Limpar filtros
                </Button>
              )
            }
          />
        )}
        <p className="crm-list-note">
          {customers.length}{" "}
          {customers.length === 1
            ? "cliente encontrado"
            : "clientes encontrados"}{" "}
          · Retorno baseado no histórico de visitas.
        </p>
      </div>
      <CustomerProfile
        customer={current}
        onClose={() => setSelected(null)}
        onEdit={(customer) => {
          setEditing(customer);
          setSelected(null);
        }}
      />
      {editing !== undefined && (
        <CustomerEditor
          key={editing?.id ?? "new"}
          customer={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </ManagementBoundary>
  );
}
