"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Clock,
  PencilSimple,
  Plus,
  Power,
  Scissors,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
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
import { usePermissions } from "@/hooks/use-permissions";
import { GalleryUpload } from "@/components/image-upload";
import { servicePhotos } from "@/lib/service-photos";
import { PhotoScrub } from "@/components/photo-scrub";
import { money } from "@/lib/utils";
import type { Service } from "@/types";
import {
  ManagementBoundary,
  ManagementSummary,
  SearchField,
  FormField,
  FormError,
  SubmitButton,
  useFormAction,
} from "./shared";

export default function ServicesPage() {
  const { data, mutate } = useWorkspace();
  const { canMutate } = usePermissions();
  const editable = canMutate("services");
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [pendingId, setPendingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const action = useFormAction();
  const removal = useFormAction();
  const categories = [
    "Todos",
    ...new Set(data?.services.map((service) => service.category) ?? []),
  ];
  const services = useMemo(
    () =>
      (data?.services ?? []).filter(
        (service) =>
          (category === "Todos" || category === service.category) &&
          service.name
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR")),
      ),
    [data, category, search],
  );
  const activeServices =
    data?.services.filter((service) => service.active) ?? [];
  const averageDuration = activeServices.length
    ? Math.round(
        activeServices.reduce((total, service) => total + service.duration, 0) /
          activeServices.length,
      )
    : 0;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || uploading) return;
    const form = new FormData(event.currentTarget);
    const photos = JSON.parse(String(form.get("photos") || "[]")) as string[];
    const name = String(form.get("name")).trim();
    const serviceCategory = String(form.get("category")).trim();
    const duration = Number(form.get("duration"));
    const price = Number(form.get("price"));
    const professionalIds = form.getAll("professionalIds").map(String);
    if (name.length < 3 || serviceCategory.length < 2) {
      action.setError("Informe um nome e uma categoria para o serviço.");
      return;
    }
    if (
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 480 ||
      price < 0 ||
      !Number.isFinite(price)
    ) {
      action.setError(
        "Duração: 5 a 480 minutos. O preço deve ser maior ou igual a zero.",
      );
      return;
    }
    if (
      form.get("active") === "on" &&
      !data?.professionals.some(
        (professional) =>
          professional.active && professionalIds.includes(professional.id),
      )
    ) {
      action.setError(
        "Selecione ao menos um profissional ativo para publicar o serviço.",
      );
      return;
    }
    void action.run(async () => {
      await mutate("services", editing ? "update" : "create", {
        id: editing?.id ?? crypto.randomUUID(),
        businessId: data!.business.id,
        name,
        category: serviceCategory,
        description: String(form.get("description") ?? "").trim(),
        duration,
        price,
        image: photos[0] || "",
        photos: photos.slice(1),
        active: form.get("active") === "on",
        professionalIds,
      });
      toast(editing ? "Serviço atualizado." : "Serviço criado.");
      setEditing(undefined);
    });
  }
  async function toggle(service: Service) {
    if (!editable) return;
    if (
      !service.active &&
      !data?.professionals.some(
        (professional) =>
          professional.active &&
          service.professionalIds.includes(professional.id),
      )
    ) {
      toast("Atribua um profissional ativo antes de publicar o serviço.");
      return;
    }
    setPendingId(service.id);
    try {
      await mutate("services", "update", {
        ...service,
        active: !service.active,
      });
      toast(
        service.active
          ? "Serviço pausado no link público."
          : "Serviço publicado.",
      );
    } catch (failure) {
      toast(
        failure instanceof Error
          ? failure.message
          : "Não foi possível atualizar o serviço.",
      );
    } finally {
      setPendingId("");
    }
  }
  function remove() {
    if (!deleting || !editable) return;
    void removal.run(async () => {
      await mutate("services", "delete", { id: deleting.id });
      toast("Serviço arquivado. O histórico foi preservado.");
      setDeleting(null);
    });
  }

  return (
    <ManagementBoundary>
      <PageHeader
        title="Serviços"
        description="Preço, duração, foto e quem faz cada serviço."
        actions={
          editable ? (
            <Button
              onClick={() => {
                action.setError("");
                setEditing(null);
              }}
            >
              <Plus size={16} weight="bold" />
              Novo serviço
            </Button>
          ) : undefined
        }
      />
      <ManagementSummary
        items={[
          {
            label: "Serviços publicados",
            value: activeServices.length,
            detail: `de ${data?.services.length ?? 0} cadastrados`,
          },
          {
            label: "Categorias",
            value: categories.length - 1,
            detail: "no catálogo",
          },
          {
            label: "Duração média",
            value: `${averageDuration} min`,
            detail: "dos serviços publicados",
          },
        ]}
      />
      <div className="management-toolbar">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar serviço..."
        />
        <div className="management-filters">
          {categories.map((item) => (
            <button
              key={item}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={category === item ? "selected" : ""}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {services.length ? (
        <div className="catalog-groups">
          {[...new Set(services.map((service) => service.category))].map(
            (group) => (
              <section key={group} className="catalog-group">
                <div className="catalog-group-heading">
                  <h2>{group}</h2>
                  <span>
                    {
                      services.filter((service) => service.category === group)
                        .length
                    }{" "}
                    serviços
                  </span>
                </div>
                <Card className="catalog-list">
                  {services
                    .filter((service) => service.category === group)
                    .map((service) => {
                      const assigned =
                        data?.professionals.filter((person) =>
                          service.professionalIds.includes(person.id),
                        ) ?? [];
                      return (
                        <article
                          key={service.id}
                          className={`catalog-row ${!service.active ? "management-inactive" : ""}`}
                        >
                          <div className="catalog-image">
                            <Scissors size={24} weight="light" />
                            {service.image && (
                              <PhotoScrub
                                photos={servicePhotos(service)}
                                alt=""
                                label={`Fotos de ${service.name}`}
                                className="catalog-scrub"
                              />
                            )}
                          </div>
                          <div className="catalog-service">
                            <div>
                              <h3>{service.name}</h3>
                              <span
                                className={`management-pill ${service.active ? "success" : ""}`}
                              >
                                {service.active ? "Publicado" : "Pausado"}
                              </span>
                            </div>
                            <p>
                              {service.description ||
                                "Sem descrição cadastrada."}
                            </p>
                            <div className="catalog-assigned">
                              <div className="management-avatar-stack">
                                {assigned.slice(0, 3).map((person) => (
                                  <Avatar
                                    key={person.id}
                                    name={person.name}
                                    src={person.photo}
                                    size={25}
                                  />
                                ))}
                              </div>
                              <span>
                                {assigned.length
                                  ? assigned
                                      .slice(0, 2)
                                      .map(
                                        (person) => person.name.split(" ")[0],
                                      )
                                      .join(", ") +
                                    (assigned.length > 2
                                      ? ` +${assigned.length - 2}`
                                      : "")
                                  : "Sem profissional atribuído"}
                              </span>
                            </div>
                          </div>
                          <div className="catalog-duration">
                            <Clock size={15} weight="duotone" />
                            {service.duration} min
                          </div>
                          <strong className="catalog-price">
                            {money(service.price)}
                          </strong>
                          {editable && (
                            <div className="catalog-actions">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  action.setError("");
                                  setEditing(service);
                                }}
                              >
                                <PencilSimple size={15} weight="duotone" />
                                Editar
                              </Button>
                              <button
                                className="management-icon-button"
                                disabled={pendingId === service.id}
                                title={
                                  service.active
                                    ? "Pausar serviço"
                                    : "Publicar serviço"
                                }
                                aria-label={`${service.active ? "Pausar" : "Publicar"} ${service.name}`}
                                onClick={() => void toggle(service)}
                              >
                                <Power size={17} weight="bold" />
                              </button>
                              <button
                                className="management-icon-button danger"
                                title="Arquivar serviço"
                                aria-label={`Arquivar ${service.name}`}
                                onClick={() => {
                                  removal.setError("");
                                  setDeleting(service);
                                }}
                              >
                                <Trash size={17} weight="duotone" />
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                </Card>
              </section>
            ),
          )}
        </div>
      ) : (
        <EmptyState
          title="Nenhum serviço encontrado"
          description="Cadastre um serviço ou ajuste a busca."
        />
      )}
      <DetailPanel
        open={editing !== undefined}
        onClose={() => {
          if (!action.busy) setEditing(undefined);
        }}
        title={editing ? "Editar serviço" : "Novo serviço"}
        description="Defina os detalhes que o cliente verá no agendamento."
      >
        <form className="management-form" onSubmit={save}>
          <FormSection title="Informações do serviço">
            <ServicePhotosField
              key={editing?.id ?? "new"}
              initial={editing ? servicePhotos(editing) : []}
              disabled={action.busy}
              onBusy={setUploading}
            />
            <FormField label="Nome do serviço">
              <input
                name="name"
                defaultValue={editing?.name}
                placeholder="Ex.: Corte masculino"
                required
                minLength={3}
                maxLength={100}
              />
            </FormField>
            <FormField label="Categoria">
              <input
                name="category"
                defaultValue={editing?.category}
                placeholder="Ex.: Cabelo"
                list="service-categories"
                required
                minLength={2}
              />
              <datalist id="service-categories">
                {categories
                  .filter((item) => item !== "Todos")
                  .map((item) => (
                    <option key={item} value={item} />
                  ))}
              </datalist>
            </FormField>
            <FormField label="Descrição">
              <textarea
                name="description"
                defaultValue={editing?.description}
                placeholder="Conte ao cliente o que está incluído."
                maxLength={500}
              />
            </FormField>
          </FormSection>
          <FormSection
            title="Duração e preço"
            description="O agendamento reserva toda a duração deste serviço."
          >
            <div className="management-form-grid">
              <FormField label="Duração (minutos)">
                <input
                  name="duration"
                  type="number"
                  defaultValue={editing?.duration ?? 40}
                  required
                  min={5}
                  max={480}
                  step={1}
                />
              </FormField>
              <FormField label="Preço (R$)">
                <input
                  name="price"
                  type="number"
                  defaultValue={editing?.price ?? ""}
                  required
                  min={0}
                  max={100000}
                  step="0.01"
                  placeholder="45,00"
                />
              </FormField>
            </div>
          </FormSection>
          <FormSection
            title="Profissionais habilitados"
            description="Selecione quem pode realizar este serviço."
          >
            <div className="management-checkbox-grid">
              {data?.professionals
                .filter(
                  (person) =>
                    person.active ||
                    editing?.professionalIds.includes(person.id),
                )
                .map((person) => (
                  <label className="management-check" key={person.id}>
                    <input
                      type="checkbox"
                      name="professionalIds"
                      value={person.id}
                      defaultChecked={editing?.professionalIds.includes(
                        person.id,
                      )}
                    />
                    {person.name}
                    {!person.active && " (inativo)"}
                  </label>
                ))}
            </div>
            {!data?.professionals.length && (
              <p className="management-top-description">
                Cadastre um profissional em Equipe antes de publicar o serviço.
              </p>
            )}
          </FormSection>
          <FormSection title="Publicação">
            <label className="management-check">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active ?? true}
              />
              Disponível para agendamento público
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
            <SubmitButton busy={action.busy}>Salvar serviço</SubmitButton>
          </div>
        </form>
      </DetailPanel>
      <Modal
        open={Boolean(deleting)}
        onClose={() => {
          if (!removal.busy) setDeleting(null);
        }}
        title="Arquivar serviço?"
      >
        <p className="management-delete-description">
          Você está arquivando <strong>{deleting?.name}</strong>. O serviço será
          pausado para novos agendamentos e seu histórico será preservado. Você
          poderá reativá-lo depois.
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
            {removal.busy ? "Arquivando..." : "Arquivar serviço"}
          </Button>
        </div>
      </Modal>
    </ManagementBoundary>
  );
}

/** Até 3 fotos do serviço; a primeira é a principal. */
function ServicePhotosField({
  initial,
  disabled,
  onBusy,
}: {
  initial: string[];
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState(initial);
  return (
    <>
      <GalleryUpload
        label="Fotos do serviço (opcional)"
        hint="Até 3 fotos reais do resultado, como o corte de frente, de lado e de trás. A primeira é a principal; no agendamento o cliente passa o dedo ou o mouse para ver as outras."
        value={photos}
        onChange={setPhotos}
        max={3}
        preset="service"
        firstLabel="Principal"
        disabled={disabled}
        onBusy={onBusy}
      />
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
    </>
  );
}
