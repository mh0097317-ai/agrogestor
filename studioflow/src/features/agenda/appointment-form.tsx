"use client";
import { useEffect, useState } from "react";
import { CalendarPlus, LockKeyhole } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { DetailPanel, Button, Spinner, FormSection } from "@/components/ui";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/toast";
import { money, localDay, businessDay, formatPhone } from "@/lib/utils";
import type { Appointment } from "@/types";
import { normalizePhone } from "@/lib/availability";
import { minuteOf, timeOf } from "./agenda-helpers";
export function AppointmentForm({
  open,
  onClose,
  date,
  time,
  professionalId,
  appointment,
}: {
  open: boolean;
  onClose: () => void;
  date?: string;
  time?: string;
  professionalId?: string;
  appointment?: Appointment;
}) {
  const { data, mutate } = useWorkspace();
  const { canMutate } = usePermissions();
  const { toast } = useToast();
  const [kind, setKind] = useState<"appointment" | "block">("appointment");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [proId, setProId] = useState("");
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setKind("appointment");
        setError("");
        setServiceId(appointment?.serviceIds[0] || "");
        setProId(appointment?.professionalId || professionalId || "");
      });
    }
  }, [open, appointment, professionalId]);
  if (!data) return null;
  const service = data.services.find((s) => s.id === serviceId);
  const professionals = data.professionals.filter(
    (p) =>
      p.active &&
      (kind === "block" || !service || service.professionalIds.includes(p.id)),
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data || !canMutate(kind === "block" ? "blockedTimes" : "appointments"))
      return;
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const start = new Date(
        `${form.get("date")}T${form.get("time")}:00-03:00`,
      ).toISOString();
      if (kind === "block") {
        const end = new Date(
          `${form.get("date")}T${form.get("endTime")}:00-03:00`,
        ).toISOString();
        await mutate("blockedTimes", "create", {
          professionalId: form.get("professionalId"),
          start,
          end,
          reason: form.get("reason"),
        });
        toast("Horário bloqueado.");
      } else {
        await mutate("appointments", appointment ? "update" : "create", {
          ...(appointment ? { id: appointment.id } : {}),
          serviceIds: [serviceId],
          professionalId: form.get("professionalId"),
          start,
          customerName: form.get("name"),
          customerPhone: normalizePhone(String(form.get("phone") || "")),
          reminder: form.get("reminder") === "on",
          status: appointment?.status || "confirmed",
        });
        toast(
          appointment
            ? "Agendamento atualizado."
            : "Agendamento criado com sucesso.",
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <DetailPanel
      open={open}
      onClose={() => !busy && onClose()}
      title={appointment ? "Editar agendamento" : "Novo agendamento"}
      description={
        appointment
          ? "Revise os dados e confirme a alteração do horário."
          : "Organize um atendimento ou reserve um período na agenda."
      }
    >
      {!appointment && (
        <div className="segmented" style={{ marginBottom: 22 }}>
          <button
            className={kind === "appointment" ? "selected" : ""}
            onClick={() => setKind("appointment")}
          >
            <CalendarPlus
              size={13}
              style={{ display: "inline", marginRight: 6 }}
            />{" "}
            Atendimento
          </button>
          <button
            className={kind === "block" ? "selected" : ""}
            onClick={() => setKind("block")}
          >
            <LockKeyhole
              size={13}
              style={{ display: "inline", marginRight: 6 }}
            />{" "}
            Bloquear horário
          </button>
        </div>
      )}
      <form onSubmit={submit} className="appointment-editor">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {kind === "appointment" && (
          <FormSection
            title={
              kind === "appointment"
                ? "01 · Cliente e serviço"
                : "01 · Período reservado"
            }
            description={
              kind === "appointment"
                ? "Quem será atendido e qual cuidado deseja realizar?"
                : "O período será removido da disponibilidade pública."
            }
          >
            <div className="form-grid">
              {kind === "appointment" && (
                <>
                  <label className="full">
                    Cliente
                    <input
                      name="name"
                      placeholder="Nome completo"
                      required
                      minLength={2}
                      defaultValue={appointment?.customerName}
                      list="existing-customers"
                    />
                    <datalist id="existing-customers">
                      {data.customers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {formatPhone(c.phone)}
                        </option>
                      ))}
                    </datalist>
                  </label>
                  <label className="full">
                    WhatsApp
                    <input
                      type="tel"
                      name="phone"
                      placeholder="(11) 99999-9999"
                      required
                      defaultValue={appointment?.customerPhone}
                    />
                  </label>
                  <label className="full">
                    Serviço
                    <select
                      required
                      value={serviceId}
                      onChange={(e) => {
                        setServiceId(e.target.value);
                        setProId("");
                      }}
                    >
                      <option value="">Selecione um serviço</option>
                      {data.services
                        .filter((s) => s.active)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {s.duration} min · {money(s.price)}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          </FormSection>
        )}
        <FormSection
          title={kind === "block" ? "01 · Período reservado" : "02 · Na agenda"}
          description="A disponibilidade será conferida novamente ao confirmar."
        >
          <div className="form-grid">
            <label className="full">
              Profissional
              <select
                required
                name="professionalId"
                value={proId}
                onChange={(e) => setProId(e.target.value)}
              >
                <option value="">Selecione o profissional</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input
                type="date"
                name="date"
                required
                defaultValue={
                  appointment
                    ? businessDay(appointment.start)
                    : date || localDay()
                }
              />
            </label>
            <label>
              Horário
              <input
                type="time"
                name="time"
                required
                defaultValue={
                  appointment
                    ? new Date(appointment.start).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      })
                    : time || "09:00"
                }
              />
            </label>
            {kind === "block" ? (
              <>
                <label>
                  Até
                  <input
                    type="time"
                    name="endTime"
                    required
                    defaultValue={timeOf(
                      Math.min(1439, minuteOf(time || "09:00") + 60),
                    )}
                  />
                </label>
                <label className="full">
                  Motivo
                  <input
                    name="reason"
                    required
                    placeholder="Ex.: compromisso pessoal"
                  />
                </label>
              </>
            ) : (
              <label className="checkbox-label full">
                <input
                  type="checkbox"
                  name="reminder"
                  defaultChecked={appointment?.reminder || false}
                />{" "}
                Cliente autoriza lembretes por WhatsApp
              </label>
            )}
          </div>
        </FormSection>
        {kind === "appointment" && service && (
          <div className="appointment-editor-summary">
            <div>
              <strong>{service.name}</strong>
              <small>{service.duration} minutos</small>
            </div>
            <strong>{money(service.price)}</strong>
          </div>
        )}
        <div className="form-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !canMutate(kind === "block" ? "blockedTimes" : "appointments")
            }
            type="submit"
          >
            {busy && <Spinner />}
            {kind === "block"
              ? "Bloquear horário"
              : appointment
                ? "Salvar alterações"
                : "Confirmar agendamento"}
          </Button>
        </div>
      </form>
    </DetailPanel>
  );
}
