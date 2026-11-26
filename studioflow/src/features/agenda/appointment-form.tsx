"use client";
import { useEffect, useState } from "react";
import { CalendarPlus, LockKey } from "@phosphor-icons/react/dist/ssr";
import { useWorkspace } from "@/hooks/use-workspace";
import { DetailPanel, Button, Spinner, FormSection } from "@/components/ui";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/toast";
import { money, localDay, businessDay, formatPhone } from "@/lib/utils";
import type { Appointment } from "@/types";
import { normalizePhone } from "@/lib/availability";
import { minuteOf, timeOf } from "./agenda-helpers";
import { recurrenceStarts } from "@/lib/recurrence";
export function AppointmentForm({
  open,
  onClose,
  date,
  time,
  professionalId,
  initialServiceId,
  appointment,
  initialCustomer,
}: {
  open: boolean;
  onClose: () => void;
  date?: string;
  time?: string;
  professionalId?: string;
  initialServiceId?: string;
  appointment?: Appointment;
  /** "Agendar o próximo": mesmo cliente já preenchido. */
  initialCustomer?: { name: string; phone: string };
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
        setServiceId(appointment?.serviceIds[0] || initialServiceId || "");
        setProId(appointment?.professionalId || professionalId || "");
      });
    }
  }, [open, appointment, professionalId, initialServiceId]);
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
        // "Até o dia": férias e indisponibilidades de vários dias num bloqueio só.
        const endDay = String(form.get("endDate") || "") || String(form.get("date"));
        const end = new Date(
          `${endDay}T${form.get("endTime")}:00-03:00`,
        ).toISOString();
        if (Date.parse(end) <= Date.parse(start))
          throw new Error("O fim do bloqueio precisa ser depois do início.");
        await mutate("blockedTimes", "create", {
          professionalId: form.get("professionalId"),
          start,
          end,
          reason: form.get("reason"),
        });
        toast("Horário bloqueado.");
      } else {
        const payload = {
          serviceIds: [serviceId],
          professionalId: form.get("professionalId"),
          customerName: form.get("name"),
          customerPhone: normalizePhone(String(form.get("phone") || "")),
          reminder: form.get("reminder") === "on",
          status: appointment?.status || "confirmed",
        };
        await mutate("appointments", appointment ? "update" : "create", {
          ...(appointment ? { id: appointment.id } : {}),
          ...payload,
          start,
        });
        // Recorrência: cada repetição passa pela mesma trava do banco. Data
        // ocupada não impede as outras; o dono vê quais ficaram de fora.
        const every = Number(form.get("repeatEvery") || 0);
        const times = Number(form.get("repeatCount") || 1);
        if (!appointment && every > 0 && times > 1) {
          const failed: string[] = [];
          let made = 1;
          for (const next of recurrenceStarts(start, every, times)) {
            try {
              await mutate("appointments", "create", { ...payload, start: next });
              made++;
            } catch {
              failed.push(
                new Intl.DateTimeFormat("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  day: "2-digit",
                  month: "2-digit",
                }).format(new Date(next)),
              );
            }
          }
          toast(
            failed.length
              ? `${made} horários criados. Ocupado em ${failed.join(", ")}: marque essas datas em outro horário.`
              : `${made} horários criados, um a cada ${every === 1 ? "semana" : `${every} semanas`}.`,
          );
        } else
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
        <div
          className="segmented appointment-kind"
          style={{ marginBottom: 22 }}
        >
          <button
            type="button"
            className={kind === "appointment" ? "selected" : ""}
            onClick={() => setKind("appointment")}
          >
            <CalendarPlus size={16} weight="duotone" />
            Atendimento
          </button>
          <button
            type="button"
            className={kind === "block" ? "selected" : ""}
            onClick={() => setKind("block")}
          >
            <LockKey size={16} weight="duotone" />
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
                ? "Quem será atendido e qual serviço será feito?"
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
                      defaultValue={appointment?.customerName || initialCustomer?.name}
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
                      defaultValue={
                        appointment
                          ? formatPhone(appointment.customerPhone)
                          : initialCustomer
                            ? formatPhone(initialCustomer.phone)
                            : ""
                      }
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
                <label>
                  Até o dia (opcional)
                  <input type="date" name="endDate" />
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
              <>
                <label className="checkbox-label full">
                  <input
                    type="checkbox"
                    name="reminder"
                    defaultChecked={appointment?.reminder || false}
                  />{" "}
                  Cliente autoriza lembretes por WhatsApp
                </label>
                {!appointment && (
                  <>
                    <label>
                      Repetir
                      <select name="repeatEvery" defaultValue="0">
                        <option value="0">Não repete</option>
                        <option value="1">Toda semana</option>
                        <option value="2">A cada 2 semanas</option>
                        <option value="3">A cada 3 semanas</option>
                        <option value="4">A cada 4 semanas</option>
                      </select>
                    </label>
                    <label>
                      Quantas vezes
                      <input
                        type="number"
                        name="repeatCount"
                        min={2}
                        max={12}
                        defaultValue={4}
                      />
                    </label>
                  </>
                )}
              </>
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
