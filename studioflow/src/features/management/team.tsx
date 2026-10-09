"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CalendarBlank,
  Camera,
  Clock,
  PencilSimple,
  Plus,
  Power,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { ImageUpload } from "@/components/image-upload";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  DetailPanel,
  FormSection,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { businessDay, dateLabel, formatPhone } from "@/lib/utils";
import type { Professional } from "@/types";
import { ProfessionalConnection } from "./professional-whatsapp";
import "./whatsapp-settings.css";
import { ProfessionalAccess } from "./professional-access";
import {
  ManagementBoundary,
  ManagementSummary,
  SearchField,
  FormField,
  FormError,
  SubmitButton,
  useFormAction,
  DayPicker,
  dayNames,
  brazilianPhone,
} from "./shared";

export default function TeamPage() {
  const { data, mutate, refresh } = useWorkspace();
  const { canMutate, canManage } = usePermissions();
  const editable = canMutate("professionals");
  const today = businessDay();
  const todayWeekday = new Date(today + "T12:00:00Z").getUTCDay();
  const now = new Date();
  const currentTime = dateLabel(now.toISOString(), "HH:mm");
  const todayAppointments =
    data?.appointments.filter(
      (item) =>
        businessDay(item.start) === today &&
        !["cancelled", "no_show"].includes(item.status),
    ) ?? [];
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Professional | null | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState<Professional | null>(null);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [pendingId, setPendingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const action = useFormAction();
  const removal = useFormAction();
  const professionals = (data?.professionals ?? []).filter((professional) =>
    professional.name
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const activeProfessionals =
    data?.professionals.filter((professional) => professional.active) ?? [];
  const assignedServices =
    data?.services.filter(
      (service) =>
        service.active &&
        activeProfessionals.some((professional) =>
          service.professionalIds.includes(professional.id),
        ),
    ) ?? [];
  function edit(professional: Professional | null) {
    if (!editable) return;
    action.setError("");
    setDays(professional?.days ?? [1, 2, 3, 4, 5, 6]);
    setEditing(professional);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || uploading) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const commission = Number(form.get("commission"));
    const start = String(form.get("start"));
    const end = String(form.get("end"));
    const breakStart = String(form.get("breakStart") ?? "");
    const breakEnd = String(form.get("breakEnd") ?? "");
    if (name.length < 3 || (phone && !brazilianPhone(phone))) {
      action.setError(
        "Informe o nome e um telefone brasileiro válido com DDD.",
      );
      return;
    }
    if (
      !days.length ||
      start >= end ||
      !Number.isFinite(commission) ||
      commission < 0 ||
      commission > 100
    ) {
      action.setError(
        "Selecione os dias, um expediente válido e uma comissão de 0% a 100%.",
      );
      return;
    }
    if (
      (breakStart || breakEnd) &&
      (!breakStart ||
        !breakEnd ||
        breakStart >= breakEnd ||
        breakStart < start ||
        breakEnd > end)
    ) {
      action.setError(
        "O intervalo deve começar e terminar dentro do expediente.",
      );
      return;
    }
    const serviceIds = form.getAll("serviceIds").map(String);
    const id = editing?.id ?? crypto.randomUUID();
    void action.run(async () => {
      const professional: Professional = {
        id,
        businessId: data!.business.id,
        name,
        phone,
        photo: String(form.get("photo") ?? "").trim(),
        specialties: String(form.get("specialties") ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        commission,
        active: form.get("active") === "on",
        days,
        start,
        end,
        breakStart,
        breakEnd,
      };
      await mutate("professionals", editing ? "update" : "create", {
        ...professional,
      });
      setEditing(professional);
      for (const service of data!.services) {
        const wasAssigned = service.professionalIds.includes(id);
        const isAssigned = serviceIds.includes(service.id);
        if (wasAssigned !== isAssigned)
          await mutate("services", "update", {
            ...service,
            professionalIds: isAssigned
              ? [...service.professionalIds, id]
              : service.professionalIds.filter(
                  (professionalId) => professionalId !== id,
                ),
          });
      }
      toast(
        editing
          ? "Profissional e agenda atualizados."
          : "Profissional adicionado à equipe.",
      );
      setEditing(undefined);
    });
  }
  async function toggle(professional: Professional) {
    if (!editable) return;
    setPendingId(professional.id);
    try {
      await mutate("professionals", "update", {
        ...professional,
        active: !professional.active,
      });
      toast(
        professional.active
          ? "Profissional pausado para novos agendamentos."
          : "Profissional ativado.",
      );
    } catch (failure) {
      toast(
        failure instanceof Error
          ? failure.message
          : "Não foi possível atualizar.",
      );
    } finally {
      setPendingId("");
    }
  }
  function remove() {
    if (!deleting || !editable) return;
    void removal.run(async () => {
      await mutate("professionals", "delete", { id: deleting.id });
      toast("Profissional arquivado. O histórico foi preservado.");
      setDeleting(null);
    });
  }

  return (
    <ManagementBoundary>
      <PageHeader
        title="Equipe"
        description="Profissionais, especialidades e horários em um só lugar."
        actions={
          editable ? (
            <Button onClick={() => edit(null)}>
              <Plus size={16} weight="bold" />
              Novo profissional
            </Button>
          ) : undefined
        }
      />
      <ManagementSummary
        items={[
          {
            label: "Profissionais ativos",
            value: activeProfessionals.length,
            detail: `de ${data?.professionals.length ?? 0} na equipe`,
          },
          {
            label: "Serviços habilitados",
            value: assignedServices.length,
            detail: "disponíveis com a equipe",
          },
          {
            label: "Agendamentos hoje",
            value: todayAppointments.length,
            detail: "sem cancelamentos e faltas",
          },
        ]}
      />
      <div className="management-toolbar">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar profissional..."
        />
        <span className="management-muted">
          {professionals.length}{" "}
          {professionals.length === 1
            ? "profissional encontrado"
            : "profissionais encontrados"}
        </span>
      </div>
      {professionals.length ? (
        <div className="team-grid">
          {professionals.map((professional) => {
            const appointments = todayAppointments.filter(
              (item) => item.professionalId === professional.id,
            );
            const nextAppointment = appointments
              .filter(
                (item) =>
                  !["completed"].includes(item.status) &&
                  new Date(item.end) > now,
              )
              .sort((a, b) => a.start.localeCompare(b.start))[0];
            const working =
              professional.active &&
              professional.days.includes(todayWeekday) &&
              Boolean(data?.settings.openDays.includes(todayWeekday));
            const starts =
              professional.start > String(data?.settings.openStart)
                ? professional.start
                : String(data?.settings.openStart);
            const ends =
              professional.end < String(data?.settings.openEnd)
                ? professional.end
                : String(data?.settings.openEnd);
            const inShift =
              working &&
              starts < ends &&
              currentTime >= starts &&
              currentTime < ends;
            const onBreak =
              inShift &&
              professional.breakStart &&
              currentTime >= professional.breakStart &&
              currentTime < professional.breakEnd;
            const inAppointment = appointments.some(
              (item) =>
                item.status === "in_progress" ||
                (["confirmed", "pending"].includes(item.status) &&
                  new Date(item.start) <= now &&
                  new Date(item.end) > now),
            );
            const label = !professional.active
              ? "Inativo"
              : !working
                ? "Folga hoje"
                : !inShift
                  ? "Fora do expediente"
                  : onBreak
                    ? "Em intervalo"
                    : inAppointment
                      ? "Em atendimento"
                      : "Em expediente";
            const assigned =
              data?.services.filter((service) =>
                service.professionalIds.includes(professional.id),
              ) ?? [];
            const blocks =
              data?.blockedTimes.filter(
                (block) =>
                  (!block.professionalId ||
                    block.professionalId === professional.id) &&
                  businessDay(block.start) === today,
              ) ?? [];
            return (
              <Card
                key={professional.id}
                className={`team-card ${!professional.active ? "management-inactive" : ""}`}
              >
                <div className="team-identity">
                  <Avatar
                    name={professional.name}
                    src={professional.photo || undefined}
                    size={52}
                  />
                  <div>
                    <h3>{professional.name}</h3>
                    <p>
                      {professional.specialties.join(" · ") ||
                        "Profissional de beleza"}
                    </p>
                  </div>
                  <span
                    className={`management-pill ${inShift && !onBreak ? "success" : ""}`}
                  >
                    {label}
                  </span>
                </div>
                <div className="team-today">
                  <div>
                    <span>Expediente de hoje</span>
                    <strong>
                      {working && starts < ends
                        ? starts + " — " + ends
                        : "Sem expediente"}
                    </strong>
                    {working && professional.breakStart && (
                      <small>
                        Intervalo {professional.breakStart}–
                        {professional.breakEnd}
                      </small>
                    )}
                  </div>
                  <div>
                    <span>Agenda hoje</span>
                    <strong>
                      {appointments.length}
                      <small>agendamentos</small>
                    </strong>
                    {blocks.length > 0 && (
                      <small>
                        {blocks.length}{" "}
                        {blocks.length === 1 ? "bloqueio" : "bloqueios"}
                      </small>
                    )}
                  </div>
                </div>
                <div className="team-week" aria-label="Dias de trabalho">
                  {dayNames.map((day, index) => (
                    <span
                      key={day}
                      className={
                        professional.days.includes(index) ? "working" : ""
                      }
                      aria-label={
                        day +
                        (professional.days.includes(index)
                          ? " trabalha"
                          : " folga")
                      }
                    >
                      {day}
                    </span>
                  ))}
                </div>
                <div className="team-services">
                  <span className="management-eyebrow">
                    Serviços habilitados
                  </span>
                  <div className="management-skill-list">
                    {assigned.length ? (
                      assigned.map((service) => (
                        <span key={service.id}>{service.name}</span>
                      ))
                    ) : (
                      <span>Nenhum serviço atribuído</span>
                    )}
                  </div>
                </div>
                <div className="team-next">
                  {nextAppointment ? (
                    <>
                      <Clock size={16} weight="duotone" />
                      <div>
                        <small>Próximo atendimento</small>
                        <strong>
                          {dateLabel(nextAppointment.start, "HH:mm")} ·{" "}
                          {nextAppointment.customerName}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <CalendarBlank size={16} weight="duotone" />
                      <span>Sem próximos atendimentos hoje</span>
                    </>
                  )}
                  {canManage && (
                    <small className="team-commission">
                      Comissão {professional.commission}%
                    </small>
                  )}
                </div>
                <div className="team-actions">
                  <Link
                    className="management-link-button"
                    href={
                      "/dashboard/agenda?professional=" +
                      encodeURIComponent(professional.id)
                    }
                  >
                    Ver agenda
                    <ArrowUpRight size={15} weight="bold" />
                  </Link>
                  {editable && (
                    <div className="management-row-actions">
                      <button
                        className="management-icon-button"
                        title="Editar profissional"
                        aria-label={"Editar " + professional.name}
                        onClick={() => edit(professional)}
                      >
                        <PencilSimple size={17} weight="duotone" />
                      </button>
                      <button
                        className="management-icon-button"
                        disabled={pendingId === professional.id}
                        title={
                          professional.active
                            ? "Pausar profissional"
                            : "Ativar profissional"
                        }
                        aria-label={`${professional.active ? "Pausar" : "Ativar"} ${professional.name}`}
                        onClick={() => void toggle(professional)}
                      >
                        <Power size={17} weight="bold" />
                      </button>
                      <button
                        className="management-icon-button danger"
                        title="Arquivar profissional"
                        aria-label={"Arquivar " + professional.name}
                        onClick={() => {
                          removal.setError("");
                          setDeleting(professional);
                        }}
                      >
                        <Trash size={17} weight="duotone" />
                      </button>
                    </div>
                  )}
                </div>
                {professional.active && data && (
                  <details className="team-connection">
                    <summary>
                      <span>WhatsApp do profissional</span>
                      <b
                        className={
                          data.professionalWhatsAppLinks?.find(
                            (link) => link.professionalId === professional.id,
                          )?.status === "open"
                            ? "is-connected"
                            : ""
                        }
                      >
                        {data.professionalWhatsAppLinks?.find(
                          (link) => link.professionalId === professional.id,
                        )?.status === "open"
                          ? "Conectado"
                          : "Configurar"}
                      </b>
                    </summary>
                    <ProfessionalConnection
                      id={professional.id}
                      name={professional.name}
                      link={data.professionalWhatsAppLinks?.find(
                        (link) => link.professionalId === professional.id,
                      )}
                      canManage={
                        canManage ||
                        data.viewer?.professionalId === professional.id
                      }
                      onSaved={refresh}
                      demo={data.mode === "demo"}
                      ready={data.evolutionReady !== false}
                    />
                  </details>
                )}
                {canManage && (
                  <details className="team-connection team-access">
                    <summary>
                      <span>Acesso à própria agenda</span>
                      <b>{professional.userId ? "Vinculado" : "Convidar"}</b>
                    </summary>
                    <ProfessionalAccess
                      id={professional.id}
                      name={professional.name}
                      linked={!!professional.userId}
                      demo={data?.mode === "demo"}
                    />
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nenhum profissional encontrado"
          description="Adicione sua equipe ou ajuste a busca."
        />
      )}
      <DetailPanel
        open={editing !== undefined}
        onClose={() => {
          if (!action.busy) setEditing(undefined);
        }}
        title={editing ? "Editar profissional" : "Novo profissional"}
        description="Mantenha o perfil e a agenda de cada profissional atualizados."
      >
        <form className="management-form" onSubmit={save}>
          <FormSection title="Perfil">
            <ImageUpload
              label="Foto do profissional (opcional)"
              hint="Rosto bem iluminado, de frente. Aparece na escolha do profissional."
              name="photo"
              preset="person"
              shape="round"
              defaultValue={editing?.photo ?? ""}
              fallback={
                <span className="team-photo-fallback">
                  <Camera size={26} weight="duotone" />
                </span>
              }
              disabled={action.busy}
              onBusy={setUploading}
            />
            <FormField label="Nome completo">
              <input
                name="name"
                defaultValue={editing?.name}
                minLength={3}
                maxLength={100}
                required
              />
            </FormField>
            <FormField label="Telefone (opcional)">
              <input
                name="phone"
                type="tel"
                defaultValue={editing?.phone ? formatPhone(editing.phone) : ""}
                placeholder="(11) 99999-9999"
              />
            </FormField>
            <FormField label="Especialidades" hint="Separe por vírgula.">
              <input
                name="specialties"
                defaultValue={editing?.specialties.join(", ")}
                placeholder="Cortes, barba, visagismo"
              />
            </FormField>
          </FormSection>
          <FormSection
            title="Serviços realizados"
            description="Escolha os serviços que este profissional pode executar."
          >
            <div className="management-checkbox-grid">
              {data?.services.map((service) => (
                <label className="management-check" key={service.id}>
                  <input
                    name="serviceIds"
                    type="checkbox"
                    value={service.id}
                    defaultChecked={
                      editing
                        ? service.professionalIds.includes(editing.id)
                        : false
                    }
                  />
                  {service.name}
                  {!service.active && " (pausado)"}
                </label>
              ))}
            </div>
            {!data?.services.length && (
              <p className="management-top-description">
                Os serviços podem ser atribuídos após o cadastro.
              </p>
            )}
          </FormSection>
          <FormSection
            title="Expediente"
            description="Dias desmarcados são folgas recorrentes. Bloqueios pontuais ficam na agenda."
          >
            <DayPicker value={days} onChange={setDays} />
            <div className="management-form-grid">
              <FormField label="Início">
                <input
                  name="start"
                  type="time"
                  defaultValue={editing?.start ?? "09:00"}
                  required
                />
              </FormField>
              <FormField label="Fim">
                <input
                  name="end"
                  type="time"
                  defaultValue={editing?.end ?? "19:00"}
                  required
                />
              </FormField>
            </div>
            <div className="management-form-grid">
              <FormField label="Início do intervalo">
                <input
                  name="breakStart"
                  type="time"
                  defaultValue={editing ? editing.breakStart : "12:00"}
                />
              </FormField>
              <FormField label="Fim do intervalo">
                <input
                  name="breakEnd"
                  type="time"
                  defaultValue={editing ? editing.breakEnd : "13:00"}
                />
              </FormField>
            </div>
          </FormSection>
          <FormSection title="Comissão e disponibilidade">
            <FormField
              label="Comissão (%)"
              hint="Percentual usado nas estimativas sobre valores recebidos."
            >
              <input
                name="commission"
                type="number"
                min={0}
                max={100}
                step="0.1"
                defaultValue={editing?.commission ?? 40}
                required
              />
            </FormField>
            <label className="management-check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />
              Disponível para novos agendamentos
            </label>
          </FormSection>
          <FormError error={action.error} />
          <div className="management-form-actions">
            <Button
              variant="secondary"
              type="button"
              disabled={action.busy}
              onClick={() => setEditing(undefined)}
            >
              Cancelar
            </Button>
            <SubmitButton busy={action.busy}>Salvar profissional</SubmitButton>
          </div>
        </form>
      </DetailPanel>
      <Modal
        open={Boolean(deleting)}
        onClose={() => {
          if (!removal.busy) setDeleting(null);
        }}
        title="Arquivar profissional?"
      >
        <p className="management-delete-description">
          <strong>{deleting?.name}</strong> ficará inativo para novos
          agendamentos. O histórico será preservado e o profissional poderá ser
          reativado depois.
        </p>
        <FormError error={removal.error} />
        <div className="management-form-actions">
          <Button
            variant="secondary"
            disabled={removal.busy}
            onClick={() => setDeleting(null)}
          >
            Voltar
          </Button>
          <Button disabled={removal.busy} onClick={remove}>
            {removal.busy ? "Arquivando..." : "Arquivar profissional"}
          </Button>
        </div>
      </Modal>
    </ManagementBoundary>
  );
}
