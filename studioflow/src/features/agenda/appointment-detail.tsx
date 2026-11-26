"use client";
import { useEffect, useState } from "react";
import {
  CalendarDots,
  Check,
  Checks,
  Gift,
  Play,
  Seal,
  ShoppingBagOpen,
  Wallet,
  UserMinus,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/toast";
import {
  DetailPanel,
  Avatar,
  StatusBadge,
  Button,
  Spinner,
} from "@/components/ui";
import { money, dateLabel, formatPhone } from "@/lib/utils";
import type { Appointment, AppointmentStatus, PaymentMethod } from "@/types";
import { amountDue, finishAppointment, paymentMethods } from "./finish";
import { AppointmentForm } from "./appointment-form";
import { appointmentServices } from "./agenda-helpers";
import { completedVisits, loyaltyProgress } from "@/lib/loyalty";
import { SaleSheet } from "@/features/management/sale-sheet";
import { ArrivedTag } from "@/features/agenda/arrived-tag";
import { hasModule } from "@/lib/modules";
import { dayAfter, suggestedReturnDays } from "@/lib/recurrence";
import { reviewRequestMessage } from "@/lib/crm";

export function AppointmentDetail({
  appointment,
  onClose,
}: {
  appointment: Appointment | null;
  onClose: () => void;
}) {
  const { data, mutate } = useWorkspace();
  const { canMutate } = usePermissions();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selling, setSelling] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirm, setConfirm] = useState<AppointmentStatus | null>(null);
  const [paying, setPaying] = useState(false);
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const [error, setError] = useState("");
  useEffect(() => {
    queueMicrotask(() => {
      setConfirm(null);
      setEditing(false);
      setSelling(false);
      setBooking(false);
      setPaying(false);
      setOpenedAt(Date.now());
      setError("");
    });
  }, [appointment?.id]);
  if (!appointment || !data) return null;
  const current =
    data.appointments.find((entry) => entry.id === appointment.id) ||
    appointment;
  const professional = data.professionals.find(
    (entry) => entry.id === current.professionalId,
  );
  const canEdit = canMutate("appointments");
  const terminal = ["cancelled", "completed", "no_show"].includes(
    current.status,
  );
  const duration = Math.round(
    (new Date(current.end).getTime() - new Date(current.start).getTime()) /
      60000,
  );
  // Horário que já passou e ficou "confirmado": o próximo passo é concluir,
  // não iniciar (vem do "Finalizar" do Início).
  const past = new Date(current.end).getTime() < openedAt;
  const due = amountDue(current, data);
  const charge = due > 0 && canMutate("payments");
  const nextAction =
    current.status === "confirmed" && past
      ? {
          status: "completed" as const,
          label: charge
            ? `Concluir e cobrar ${money(due)}`
            : "Concluir atendimento",
          Icon: Checks,
        }
      : current.status === "pending"
        ? {
            status: "confirmed" as const,
            label: "Confirmar agendamento",
            Icon: Check,
          }
        : current.status === "confirmed"
          ? {
              status: "in_progress" as const,
              label: "Iniciar atendimento",
              Icon: Play,
            }
          : current.status === "in_progress"
            ? {
                status: "completed" as const,
                label: "Concluir atendimento",
                Icon: Checks,
              }
            : null;
  async function finish(method?: PaymentMethod) {
    if (!appointment || !canEdit || !data) return;
    setBusy(true);
    setError("");
    try {
      const paid = await finishAppointment(mutate, data, current, method);
      toast(
        paid
          ? `Concluído e ${money(paid)} recebido.`
          : charge
            ? "Atendimento concluído. O valor ficou em aberto no financeiro."
            : "Atendimento concluído.",
      );
      setPaying(false);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível concluir o atendimento.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function update(status: AppointmentStatus) {
    if (!appointment || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      await mutate("appointments", "update", { id: appointment.id, status });
      toast(
        status === "completed"
          ? "Atendimento concluído. Registre o pagamento no financeiro."
          : "Status atualizado.",
      );
      setConfirm(null);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível atualizar o atendimento.",
      );
    } finally {
      setBusy(false);
    }
  }
  const loyalty =
    data?.settings.loyaltyEnabled &&
    ["pending", "confirmed", "in_progress"].includes(current.status)
      ? loyaltyProgress(
          completedVisits(data.appointments, current.customerId),
          data.settings.loyaltyGoal,
        )
      : null;
  const deposit = Number(current.depositAmount || 0);
  const sold = (data.productSales || []).filter(
    (sale) => sale.appointmentId === current.id && sale.status === "paid",
  );
  const canSell =
    canEdit &&
    hasModule(data.access?.modules, "produtos") &&
    !["cancelled", "no_show"].includes(current.status) &&
    (data.products || []).some(
      (product) => product.active && product.stock > 0,
    );
  const planName = current.membershipId
    ? data?.plans?.find(
        (plan) =>
          plan.id ===
          data.memberships?.find((item) => item.id === current.membershipId)
            ?.planId,
      )?.name || "clube"
    : "";
  const paymentNote = current.membershipId
    ? { tone: "", text: `Pelo ${planName}: sem cobrança neste atendimento.` }
    : current.depositStatus === "pending" && current.status === "pending"
      ? {
          tone: "is-waiting",
          text: `Aguardando o sinal de ${money(deposit)} no Pix até ${dateLabel(current.depositExpiresAt || current.start, "HH:mm")}.`,
        }
      : current.depositStatus === "paid" && current.status === "cancelled"
        ? {
            tone: "is-alert",
            text: `Sinal de ${money(deposit)} pago depois do prazo, com o horário já ocupado. Devolva o valor pelo Asaas.`,
          }
        : current.depositStatus === "paid"
          ? {
              tone: "",
              text: `Sinal de ${money(deposit)} pago no Pix. Falta ${money(Math.max(0, current.price - deposit))} no dia.`,
            }
          : current.depositStatus === "expired"
            ? {
                tone: "",
                text: "O sinal não foi pago no prazo e o horário foi liberado.",
              }
            : null;
  return (
    <>
      <DetailPanel
        open={!editing && !selling}
        onClose={() => !busy && onClose()}
        title="Agendamento"
        description={dateLabel(current.start, "EEEE, dd 'de' MMMM")}
      >
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="appointment-detail-identity">
          <Avatar name={current.customerName} size={56} />
          <div>
            <h3>{current.customerName}</h3>
            <p>{formatPhone(current.customerPhone)}</p>
            <ArrivedTag appointment={current} />
          </div>
        </div>
        {loyalty && (
          <div
            className={`appointment-loyalty ${loyalty.rewardReady ? "is-ready" : ""}`}
          >
            <Gift size={18} weight={loyalty.rewardReady ? "fill" : "duotone"} />
            <span>
              {loyalty.rewardReady ? (
                <>
                  <strong>Ganha o prêmio neste atendimento:</strong>{" "}
                  {data?.settings.loyaltyReward}
                </>
              ) : (
                <>
                  Cartão fidelidade:{" "}
                  <strong>
                    {loyalty.stamps} de {loyalty.goal}
                  </strong>
                </>
              )}
            </span>
          </div>
        )}
        {paymentNote && (
          <div
            className={`appointment-loyalty appointment-payment ${paymentNote.tone}`}
          >
            {current.membershipId ? (
              <Seal size={18} weight="duotone" />
            ) : (
              <Wallet size={18} weight="duotone" />
            )}
            <span>{paymentNote.text}</span>
          </div>
        )}
        <div className="appointment-detail-main">
          <StatusBadge status={current.status} />
          <strong>{appointmentServices(data, current)}</strong>
          <span>
            {duration} minutos · {money(current.price)}
          </span>
        </div>
        <dl className="appointment-detail-lines">
          <div>
            <dt>Profissional</dt>
            <dd className="appointment-detail-professional">
              <Avatar
                name={professional?.name || "Profissional"}
                src={professional?.photo}
                size={26}
              />
              {professional?.name}
            </dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>{dateLabel(current.start, "dd 'de' MMMM yyyy")}</dd>
          </div>
          <div>
            <dt>Horário</dt>
            <dd>
              {dateLabel(current.start, "HH:mm")}–
              {dateLabel(current.end, "HH:mm")}
            </dd>
          </div>
          <div>
            <dt>Valor do atendimento</dt>
            <dd>{money(current.price)}</dd>
          </div>
          {sold.length > 0 && (
            <div>
              <dt>Produtos</dt>
              <dd>
                {sold
                  .flatMap((sale) => sale.items)
                  .map((item) => `${item.quantity}× ${item.name}`)
                  .join(", ")}{" "}
                · {money(sold.reduce((sum, sale) => sum + sale.total, 0))}
              </dd>
            </div>
          )}
        </dl>
        {confirm && canEdit ? (
          <div className="calendar-confirm-box">
            <p>
              {confirm === "cancelled"
                ? "Cancelar este agendamento? O horário será liberado na agenda."
                : "Registrar que o cliente não compareceu a este atendimento?"}
            </p>
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                Voltar
              </Button>
              <Button onClick={() => update(confirm)} disabled={busy}>
                {busy && <Spinner />}{" "}
                {confirm === "cancelled"
                  ? "Confirmar cancelamento"
                  : "Confirmar falta"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {canEdit && nextAction && paying && (
              <div className="appointment-detail-action">
                <div
                  className="appointment-methods"
                  role="group"
                  aria-label={`Como ${current.customerName.split(" ")[0]} pagou ${money(due)}?`}
                >
                  <p>
                    Como pagou <strong>{money(due)}</strong>?
                  </p>
                  {paymentMethods.map((m) => (
                    <Button
                      key={m.value}
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void finish(m.value)}
                    >
                      {m.label}
                    </Button>
                  ))}
                  <button
                    type="button"
                    className="appointment-methods-skip"
                    disabled={busy}
                    onClick={() => void finish()}
                  >
                    Concluir sem registrar pagamento
                  </button>
                  <button
                    type="button"
                    className="appointment-methods-skip"
                    disabled={busy}
                    onClick={() => setPaying(false)}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
            {canEdit && nextAction && !paying && (
              <div className="appointment-detail-action">
                <Button
                  onClick={() =>
                    nextAction.status !== "completed"
                      ? update(nextAction.status)
                      : charge
                        ? setPaying(true)
                        : void finish()
                  }
                  disabled={busy}
                >
                  {busy ? <Spinner /> : <nextAction.Icon size={17} />}
                  {nextAction.label}
                </Button>
              </div>
            )}
            <div className="appointment-detail-secondary">
              {canEdit && !terminal && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setEditing(true)}
                    disabled={busy}
                  >
                    <CalendarDots size={17} />
                    Editar ou reagendar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirm("no_show")}
                    disabled={busy}
                  >
                    <UserMinus size={17} />
                    Marcar falta
                  </Button>
                  <Button
                    variant="ghost"
                    className="appointment-detail-danger"
                    onClick={() => setConfirm("cancelled")}
                    disabled={busy}
                  >
                    <X size={17} />
                    Cancelar horário
                  </Button>
                </>
              )}
              {canEdit && current.status === "completed" && (
                <Button
                  variant="secondary"
                  onClick={() => setBooking(true)}
                  disabled={busy}
                >
                  <CalendarDots size={17} />
                  Agendar o próximo
                </Button>
              )}
              {canSell && (
                <Button
                  variant="secondary"
                  onClick={() => setSelling(true)}
                  disabled={busy}
                >
                  <ShoppingBagOpen size={17} />
                  Vender produto
                </Button>
              )}
              {current.status === "completed" && (
                // Pedido neutro: mesmo texto para todo atendimento concluído,
                // sem filtrar por satisfação antes de mandar o link público.
                <a
                  className="btn btn-ghost"
                  href={`https://wa.me/55${current.customerPhone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}?text=${encodeURIComponent(
                    reviewRequestMessage({
                      customerName: current.customerName,
                      businessName: data.business.name,
                      reviewUrl: data.business.mapsUrl || undefined,
                    }),
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Pedir avaliação
                </a>
              )}
              <a
                className="btn btn-secondary"
                href={`https://wa.me/55${current.customerPhone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon size={18} />
                Conversar no WhatsApp
              </a>
            </div>
          </>
        )}
        <p className="appointment-detail-code">
          ID · {current.id.slice(0, 8).toUpperCase()}
        </p>
      </DetailPanel>
      <SaleSheet
        store={data}
        open={selling}
        onClose={() => setSelling(false)}
        appointment={current}
      />
      <AppointmentForm
        open={editing}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
        appointment={current}
      />
      {booking && (
        <AppointmentForm
          open
          onClose={() => {
            setBooking(false);
            onClose();
          }}
          // Sugestão: o intervalo que este cliente costuma levar entre visitas.
          date={dayAfter(
            current.start,
            suggestedReturnDays(
              data.appointments
                .filter(
                  (entry) =>
                    entry.status === "completed" &&
                    entry.customerPhone === current.customerPhone,
                )
                .map((entry) => entry.start),
            ),
          )}
          time={dateLabel(current.start, "HH:mm")}
          professionalId={current.professionalId}
          initialServiceId={current.serviceIds[0]}
          initialCustomer={{
            name: current.customerName,
            phone: current.customerPhone,
          }}
        />
      )}
    </>
  );
}
