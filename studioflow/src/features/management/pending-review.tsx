"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/toast";
import { Button, Card, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { pastOpenAppointments } from "@/lib/owner-alerts";
import { dateLabel, money } from "@/lib/utils";
import { appointmentServices } from "@/features/agenda/agenda-helpers";
import {
  amountDue,
  finishAppointment,
  paymentMethods,
} from "@/features/agenda/finish";
import type { Appointment, PaymentMethod } from "@/types";
import "./pending-review.css";

type Outcome = "completed" | "no_show" | "cancelled";
const outcomeLabel: Record<Outcome, string> = {
  completed: "atendidos (sem registrar pagamento)",
  no_show: "falta",
  cancelled: "cancelados",
};

/**
 * Pendências: atendimentos que já passaram e ninguém fechou. O dono diz o
 * que aconteceu em cada um. Nada é finalizado sozinho e nenhum pagamento é
 * criado sem a forma de pagamento escolhida por alguém.
 */
export default function PendingReview() {
  const { data, mutate } = useWorkspace();
  const { canMutate } = usePermissions();
  const { toast } = useToast();
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    id: string;
    outcome: Outcome;
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<Outcome | null>(null);
  const [done, setDone] = useState(0);
  const list = useMemo(
    () => (data ? pastOpenAppointments(data, now) : []),
    [data, now],
  );
  if (!data) return null;
  const canEdit = canMutate("appointments");
  const canCharge = canMutate("payments");
  const professional = (id: string) =>
    data.professionals.find((p) => p.id === id)?.name.split(" ")[0] || "—";
  const expected = list.reduce((sum, a) => sum + amountDue(a, data), 0);
  const days = list.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = a.start.slice(0, 10);
    (acc[key] ||= []).push(a);
    return acc;
  }, {});

  async function settle(a: Appointment, outcome: Outcome, method?: PaymentMethod) {
    setBusy(a.id);
    try {
      if (outcome === "completed")
        await finishAppointment(mutate, data!, a, canCharge ? method : undefined);
      else await mutate("appointments", "update", { id: a.id, status: outcome });
      setDone((n) => n + 1);
      setSelected((s) => {
        const next = new Set(s);
        next.delete(a.id);
        return next;
      });
      toast(
        outcome === "completed"
          ? method
            ? `${a.customerName.split(" ")[0]}: atendido e ${money(amountDue(a, data!))} recebido.`
            : `${a.customerName.split(" ")[0]}: atendido.`
          : outcome === "no_show"
            ? `${a.customerName.split(" ")[0]}: falta registrada.`
            : `${a.customerName.split(" ")[0]}: cancelado.`,
      );
    } catch (failure) {
      toast(
        failure instanceof Error ? failure.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(null);
      setPaying(null);
      setConfirming(null);
    }
  }

  async function settleSelected(outcome: Outcome) {
    const items = list.filter((a) => selected.has(a.id));
    setBulk(null);
    let ok = 0;
    for (const a of items) {
      setBusy(a.id);
      try {
        if (outcome === "completed")
          await mutate("appointments", "update", { id: a.id, status: "completed" });
        else await mutate("appointments", "update", { id: a.id, status: outcome });
        ok++;
      } catch {
        // Keeps going: the failed ones stay in the list for another try.
      }
    }
    setBusy(null);
    setSelected(new Set());
    setDone((n) => n + ok);
    toast(
      ok === items.length
        ? `${ok} ${ok === 1 ? "atendimento atualizado" : "atendimentos atualizados"}.`
        : `${ok} de ${items.length} atualizados. Os outros continuam na lista.`,
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="pending">
      <PageHeader
        title="Pendências"
        description="Atendimentos que já passaram e ainda não foram fechados. Diga o que aconteceu em cada um: nada é finalizado sozinho."
        actions={
          <Link className="btn btn-secondary" href="/dashboard/agenda">
            Abrir agenda
          </Link>
        }
      />
      {list.length === 0 ? (
        <Card className="pending-clear">
          <CheckCircle size={40} weight="duotone" aria-hidden="true" />
          <h2>Tudo em dia.</h2>
          <p>
            {done
              ? `Você regularizou ${done} ${done === 1 ? "atendimento" : "atendimentos"}. O caixa e os relatórios já contam com isso.`
              : "Nenhum atendimento passado está esperando fechamento."}
          </p>
          <Link className="btn btn-primary" href="/dashboard">
            Voltar ao Início
          </Link>
        </Card>
      ) : (
        <>
          <div className="pending-summary">
            <div>
              <strong>{list.length}</strong>
              <span>{list.length === 1 ? "atendimento aberto" : "atendimentos abertos"}</span>
            </div>
            <div>
              <strong>{money(expected)}</strong>
              <span>a confirmar se foi recebido</span>
            </div>
            <p>
              Enquanto ficam abertos, esses horários não entram no recebido,
              no ticket médio nem nas comissões.
            </p>
          </div>
          {canEdit && selected.size > 0 && (
            <div className="pending-bulk" role="region" aria-label="Ações em lote">
              <span>
                {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
              </span>
              <Button variant="secondary" onClick={() => setBulk("completed")}>
                Atendidos, sem pagamento
              </Button>
              <Button variant="secondary" onClick={() => setBulk("no_show")}>
                Faltaram
              </Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                Limpar
              </Button>
            </div>
          )}
          {Object.entries(days).map(([day, items]) => (
            <section key={day} className="pending-day" aria-label={dateLabel(day, "EEEE, dd/MM")}>
              <header>
                <h2>{dateLabel(`${day}T12:00:00Z`, "EEEE, dd 'de' MMMM")}</h2>
                {canEdit && (
                  <button
                    type="button"
                    className="pending-select-day"
                    onClick={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        const all = items.every((a) => next.has(a.id));
                        items.forEach((a) => (all ? next.delete(a.id) : next.add(a.id)));
                        return next;
                      })
                    }
                  >
                    {items.every((a) => selected.has(a.id)) ? "Desmarcar o dia" : "Selecionar o dia"}
                  </button>
                )}
              </header>
              <ul role="list">
                {items.map((a) => {
                  const due = amountDue(a, data);
                  return (
                    <li key={a.id} className={busy === a.id ? "is-busy" : ""}>
                      {canEdit && (
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${a.customerName}`}
                          checked={selected.has(a.id)}
                          onChange={() => toggle(a.id)}
                        />
                      )}
                      <div className="pending-what">
                        <time>{dateLabel(a.start, "HH:mm")}</time>
                        <strong>{a.customerName}</strong>
                        <span>
                          {appointmentServices(data, a)} · {professional(a.professionalId)} · {money(a.price)}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                      {canEdit && (
                        <div className="pending-actions">
                          {paying === a.id ? (
                            <div className="pending-methods" role="group" aria-label={`Como ${a.customerName.split(" ")[0]} pagou ${money(due)}?`}>
                              <span>Como pagou {money(due)}?</span>
                              {paymentMethods.map((m) => (
                                <Button
                                  key={m.value}
                                  variant="secondary"
                                  disabled={!!busy}
                                  onClick={() => void settle(a, "completed", m.value)}
                                >
                                  {m.label}
                                </Button>
                              ))}
                              <Button variant="ghost" disabled={!!busy} onClick={() => void settle(a, "completed")}>
                                Sem registrar pagamento
                              </Button>
                              <Button variant="ghost" disabled={!!busy} onClick={() => setPaying(null)}>
                                Voltar
                              </Button>
                            </div>
                          ) : confirming?.id === a.id ? (
                            <div className="pending-methods" role="group">
                              <span>
                                {confirming.outcome === "no_show"
                                  ? "Registrar que o cliente faltou?"
                                  : "Cancelar este horário?"}
                              </span>
                              <Button disabled={!!busy} onClick={() => void settle(a, confirming.outcome)}>
                                Confirmar
                              </Button>
                              <Button variant="ghost" onClick={() => setConfirming(null)}>
                                Voltar
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                disabled={!!busy}
                                onClick={() =>
                                  due > 0 && canCharge ? setPaying(a.id) : void settle(a, "completed")
                                }
                              >
                                Atendido
                              </Button>
                              <Button variant="secondary" disabled={!!busy} onClick={() => setConfirming({ id: a.id, outcome: "no_show" })}>
                                Faltou
                              </Button>
                              <Button variant="ghost" disabled={!!busy} onClick={() => setConfirming({ id: a.id, outcome: "cancelled" })}>
                                Cancelado
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
      <Modal
        open={!!bulk}
        onClose={() => setBulk(null)}
        title="Confirmar em lote"
        description={
          bulk
            ? `Marcar ${selected.size} ${selected.size === 1 ? "atendimento" : "atendimentos"} como ${outcomeLabel[bulk]}? Nenhum pagamento será criado.`
            : ""
        }
      >
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setBulk(null)}>
            Voltar
          </Button>
          <Button onClick={() => bulk && void settleSelected(bulk)}>Confirmar</Button>
        </div>
      </Modal>
    </div>
  );
}
