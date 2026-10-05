"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Archive,
  ArrowCounterClockwise,
  Copy,
  PencilSimple,
  Plus,
  Seal,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  MetricStrip,
  Modal,
  PageHeader,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import {
  membershipUsage,
  monthKey,
  monthlyRecurring,
} from "@/lib/payments";
import { formatPhone, money } from "@/lib/utils";
import type { Membership, MembershipPlan, Store } from "@/types";
import { FormError, FormField, ManagementBoundary } from "./shared";
import "./club.css";
import { ModuleGate } from "@/features/dashboard/module-lock";

export default function ClubPage() {
  const { data } = useWorkspace();
  return (
    <ManagementBoundary>
      <ModuleGate module="clube">
      {data && <ClubContent store={data} />}
      </ModuleGate>
    </ManagementBoundary>
  );
}

const statusLabel: Record<Membership["status"], string> = {
  active: "Ativa",
  pending: "Aguardando 1º pagamento",
  overdue: "Mensalidade atrasada",
  cancelled: "Cancelada",
};

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível.");
  return data;
}

const dueLabel = (day?: string | null) =>
  day
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      })
        .format(new Date(`${day}T12:00:00Z`))
        .replace(".", "")
    : "—";

function ClubContent({ store }: { store: Store }) {
  const { refresh } = useWorkspace();
  const { canManage } = usePermissions();
  const { toast } = useToast();
  const [editing, setEditing] = useState<MembershipPlan | "new" | null>(null);
  const [cancelling, setCancelling] = useState<Membership | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const plans = store.plans || [];
  const memberships = store.memberships || [];
  const live = memberships.filter((item) => item.status !== "cancelled");
  const month = monthKey(new Date());
  const visits = store.appointments.filter(
    (item) =>
      item.membershipId &&
      monthKey(item.start) === month &&
      !["cancelled", "no_show"].includes(item.status),
  ).length;
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const clubUrl = `${origin}/${store.business.slug}/clube`;

  async function act(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await task();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy("");
    }
  }

  async function sendAccess(member: Membership) {
    // Opened before the request so the browser does not block the tab.
    const tab = window.open("", "_blank");
    setBusy(`access-${member.id}`);
    setError("");
    try {
      const { token } = await send("/api/workspace/memberships", "PATCH", {
        id: member.id,
        action: "access",
      });
      const link = `${clubUrl}?acesso=${token}`;
      const text = `Oi, ${member.customerName.split(" ")[0]}! Aqui está o acesso ao seu clube na ${store.business.name}. Abra no celular para agendar pelo clube: ${link}`;
      const url = `https://wa.me/55${member.customerPhone}?text=${encodeURIComponent(text)}`;
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      toast("Link novo gerado. O anterior deixou de valer.");
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="club-page">
      <PageHeader
        title="Clube de assinatura"
        description="Planos mensais com serviços inclusos. A cobrança cai direto na sua conta Asaas."
        actions={
          canManage ? (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Novo plano
            </Button>
          ) : undefined
        }
      />
      {!store.paymentAccount && (
        <div className="club-notice">
          <Warning size={18} />
          <span>
            Para vender o clube, conecte sua conta Asaas em{" "}
            <Link href="/dashboard/configuracoes">
              Configurações → Pagamentos
            </Link>
            . Até lá os planos ficam guardados, mas não aparecem para os
            clientes.
          </span>
        </div>
      )}
      <MetricStrip
        className="club-metrics"
        items={[
          {
            label: "Assinantes ativos",
            value: live.filter((item) => item.status === "active").length,
          },
          {
            label: "Receita mensal do clube",
            value: money(monthlyRecurring(memberships)),
            detail: "Assinaturas ativas e atrasadas",
          },
          { label: "Atendimentos pelo clube no mês", value: visits },
          {
            label: "Mensalidades atrasadas",
            value: live.filter((item) => item.status === "overdue").length,
          },
        ]}
      />
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <section className="club-section">
        <header>
          <h2>Planos</h2>
          {store.paymentAccount && plans.some((plan) => plan.active) && (
            <button
              type="button"
              className="club-link"
              onClick={() =>
                void navigator.clipboard
                  .writeText(clubUrl)
                  .then(() => toast("Link do clube copiado."))
                  .catch(() => toast(clubUrl))
              }
            >
              <Copy size={15} /> Copiar link do clube
            </button>
          )}
        </header>
        {plans.length === 0 ? (
          <Card className="club-empty">
            <EmptyState
              title="Nenhum plano ainda"
              description="Ex.: Clube do Corte, R$ 89,90 por mês, até 4 cortes. O cliente paga todo mês e agenda sem pagar na hora."
              action={
                canManage ? (
                  <Button onClick={() => setEditing("new")}>
                    <Plus size={16} /> Criar o primeiro plano
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="club-plans">
            {plans.map((plan, index) => (
              <Card
                key={plan.id}
                className={`club-plan ${plan.active ? "" : "is-archived"}`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="club-plan-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{plan.name}</h3>
                <p className="club-plan-price">
                  {money(plan.price)}
                  <small>/mês</small>
                </p>
                <ul>
                  {plan.serviceIds.map((id) => (
                    <li key={id}>
                      {store.services.find((service) => service.id === id)
                        ?.name || "Serviço removido"}
                    </li>
                  ))}
                </ul>
                <p className="club-plan-limit">
                  {plan.monthlyLimit
                    ? `Até ${plan.monthlyLimit} ${plan.monthlyLimit === 1 ? "atendimento" : "atendimentos"} por mês`
                    : "Atendimentos ilimitados no mês"}
                </p>
                <p className="club-plan-count">
                  {
                    live.filter((item) => item.planId === plan.id).length
                  }{" "}
                  assinantes
                </p>
                {canManage && (
                  <div className="club-plan-actions">
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(plan)}
                      disabled={!!busy}
                    >
                      <PencilSimple size={15} /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() =>
                        void act(`plan-${plan.id}`, async () => {
                          await send("/api/workspace/plans", "PATCH", {
                            id: plan.id,
                            active: !plan.active,
                          });
                          toast(
                            plan.active
                              ? "Plano arquivado. Quem já assina continua."
                              : "Plano reaberto.",
                          );
                        })
                      }
                    >
                      {plan.active ? (
                        <>
                          <Archive size={15} /> Arquivar
                        </>
                      ) : (
                        <>
                          <ArrowCounterClockwise size={15} /> Reabrir
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
      <section className="club-section">
        <header>
          <h2>Assinantes</h2>
        </header>
        {memberships.length === 0 ? (
          <p className="club-muted">
            Quando alguém assinar pelo link do clube, aparece aqui com a
            situação da mensalidade.
          </p>
        ) : (
          <Card className="club-members">
            {memberships.map((member) => {
              const plan = plans.find((item) => item.id === member.planId);
              const used = membershipUsage(
                store.appointments,
                member.id,
                new Date().toISOString(),
              );
              return (
                <div
                  key={member.id}
                  className={`club-member is-${member.status}`}
                >
                  <Avatar name={member.customerName} size={38} />
                  <div className="club-member-main">
                    <strong>{member.customerName}</strong>
                    <span>
                      {plan?.name || "Plano"} · {formatPhone(member.customerPhone)}
                    </span>
                  </div>
                  <span className={`club-status is-${member.status}`}>
                    {statusLabel[member.status]}
                  </span>
                  <dl className="club-member-facts">
                    <div>
                      <dt>No mês</dt>
                      <dd>
                        {used}
                        {plan?.monthlyLimit ? ` de ${plan.monthlyLimit}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Próxima cobrança</dt>
                      <dd>
                        {member.status === "cancelled"
                          ? "—"
                          : dueLabel(member.nextDueDate)}
                      </dd>
                    </div>
                  </dl>
                  {canManage && member.status !== "cancelled" && (
                    <div className="club-member-actions">
                      <Button
                        variant="secondary"
                        onClick={() => void sendAccess(member)}
                        disabled={!!busy}
                        title="Gera um link novo de acesso e abre o WhatsApp"
                      >
                        <WhatsAppIcon size={15} /> Enviar acesso
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setCancelling(member)}
                        disabled={!!busy}
                        aria-label={`Cancelar assinatura de ${member.customerName}`}
                      >
                        <X size={15} />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </section>
      <div className="management-info">
        <Seal size={16} /> No agendamento, quem assina agenda os serviços do
        plano sem pagar na hora, dentro do limite do mês. Se a mensalidade
        atrasar, o clube pausa até o pagamento.
      </div>
      {editing && (
        <PlanForm
          store={store}
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
            toast(editing === "new" ? "Plano criado." : "Plano atualizado.");
          }}
        />
      )}
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancelar assinatura?"
        description="As próximas cobranças param no Asaas. Mensalidades já pagas não são devolvidas automaticamente."
      >
        <div className="management-form-actions">
          <Button variant="secondary" onClick={() => setCancelling(null)}>
            Manter
          </Button>
          <Button
            disabled={!!busy}
            onClick={() =>
              cancelling &&
              void act("cancel", async () => {
                await send("/api/workspace/memberships", "PATCH", {
                  id: cancelling.id,
                  action: "cancel",
                });
                setCancelling(null);
                toast("Assinatura cancelada.");
              })
            }
          >
            {busy === "cancel" ? "Cancelando…" : "Cancelar assinatura"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PlanForm({
  store,
  plan,
  onClose,
  onSaved,
}: {
  store: Store;
  plan: MembershipPlan | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const services = store.services.filter(
    (service) => service.active || plan?.serviceIds.includes(service.id),
  );
  const [name, setName] = useState(plan?.name || "");
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [description, setDescription] = useState(plan?.description || "");
  const [serviceIds, setServiceIds] = useState<string[]>(
    plan?.serviceIds || [],
  );
  const [limited, setLimited] = useState(plan ? !!plan.monthlyLimit : true);
  const [limit, setLimit] = useState(String(plan?.monthlyLimit || 4));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = serviceIds.reduce(
    (sum, id) => sum + (services.find((item) => item.id === id)?.price || 0),
    0,
  );
  const fullValue = value * (limited ? Number(limit) || 0 : 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/api/workspace/plans", "POST", {
        ...(plan ? { id: plan.id } : {}),
        name,
        description,
        price: Number(price.replace(",", ".")),
        serviceIds,
        monthlyLimit: limited ? Number(limit) : null,
      });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={plan ? "Editar plano" : "Novo plano"}
      presentation="panel"
    >
      <form className="management-form" onSubmit={submit}>
        <FormField label="Nome do plano">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Clube do Corte"
            maxLength={60}
            required
          />
        </FormField>
        <FormField
          label="Mensalidade (R$)"
          hint={
            plan
              ? "O novo valor vale para quem assinar daqui em diante."
              : undefined
          }
        >
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder="89,90"
            required
          />
        </FormField>
        <fieldset className="club-services">
          <legend>Serviços inclusos</legend>
          {services.map((service) => (
            <label key={service.id}>
              <input
                type="checkbox"
                checked={serviceIds.includes(service.id)}
                onChange={(event) =>
                  setServiceIds((current) =>
                    event.target.checked
                      ? [...current, service.id]
                      : current.filter((id) => id !== service.id),
                  )
                }
              />
              <span>{service.name}</span>
              <small>{money(service.price)}</small>
            </label>
          ))}
        </fieldset>
        <div className="club-limit">
          <label>
            <input
              type="radio"
              checked={limited}
              onChange={() => setLimited(true)}
            />
            Limite por mês
          </label>
          <label>
            <input
              type="radio"
              checked={!limited}
              onChange={() => setLimited(false)}
            />
            Ilimitado
          </label>
          {limited && (
            <input
              type="number"
              min={1}
              max={31}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              aria-label="Atendimentos por mês"
            />
          )}
        </div>
        {limited && fullValue > 0 && Number(price.replace(",", ".")) > 0 && (
          <p className="club-muted">
            Avulso, {limit} {Number(limit) === 1 ? "visita custaria" : "visitas custariam"} até{" "}
            {money(fullValue)}. O cliente economiza até{" "}
            {money(Math.max(0, fullValue - Number(price.replace(",", "."))))} por
            mês.
          </p>
        )}
        <FormField label="Descrição (opcional)">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={240}
            rows={3}
            placeholder="Para quem mantém o corte sempre em dia."
          />
        </FormField>
        <FormError error={error} />
        <div className="management-form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : plan ? "Salvar plano" : "Criar plano"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
