"use client";
import { useEffect, useState } from "react";
import {
  CalendarDots,
  Check,
  Checks,
  Gift,
  Play,
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
import type { Appointment, AppointmentStatus } from "@/types";
import { AppointmentForm } from "./appointment-form";
import { appointmentServices } from "./agenda-helpers";
import { completedVisits, loyaltyProgress } from "@/lib/loyalty";

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
  const [confirm, setConfirm] = useState<AppointmentStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    queueMicrotask(() => {
      setConfirm(null);
      setEditing(false);
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
  const nextAction =
    current.status === "pending"
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
  return (
    <>
      <DetailPanel
        open={!editing}
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
            {canEdit && nextAction && (
              <div className="appointment-detail-action">
                <Button
                  onClick={() => update(nextAction.status)}
                  disabled={busy}
                >
                  {busy ? <Spinner /> : <nextAction.Icon size={17} />}
                  {nextAction.label}
                </Button>
                {current.status === "in_progress" && (
                  <p>Após concluir, registre o recebimento no financeiro.</p>
                )}
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
              <a
                className="btn btn-secondary"
                href={`https://wa.me/55${current.customerPhone.replace(/\D/g, "")}`}
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
      <AppointmentForm
        open={editing}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
        appointment={current}
      />
    </>
  );
}
