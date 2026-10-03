"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Building2,
  ImageIcon,
  CalendarDays,
  Users,
  Bell,
  CreditCard,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  FormSection,
  MetricStrip,
  Modal,
  PageHeader,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import type { Store } from "@/types";
import {
  ManagementBoundary,
  FormField,
  FormError,
  useFormAction,
  DayPicker,
  brazilianPhone,
} from "./shared";

type EditableTab = "business" | "identity" | "agenda" | "notifications";
type Tab = EditableTab | "professionals" | "plan";
type FieldEvent = ChangeEvent<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
>;
type BusinessDraft = {
  name: string;
  category: string;
  cnpj: string;
  description: string;
  address: string;
  phone: string;
  instagram: string;
  amenities: string;
};
type IdentityDraft = {
  cover: string;
  logo: string;
  color: string;
  photos: string;
};
type AgendaDraft = {
  openDays: number[];
  openStart: string;
  openEnd: string;
  minNotice: string;
  maxDays: string;
  buffer: string;
  cancellationHours: string;
};
type Drafts = {
  business: BusinessDraft | null;
  identity: IdentityDraft | null;
  agenda: AgendaDraft | null;
  notifications: { notifications: boolean } | null;
};
const tabs = [
  { id: "business" as const, label: "Empresa", icon: Building2 },
  { id: "identity" as const, label: "Identidade", icon: ImageIcon },
  { id: "agenda" as const, label: "Agenda", icon: CalendarDays },
  { id: "professionals" as const, label: "Profissionais", icon: Users },
  { id: "notifications" as const, label: "Notificações", icon: Bell },
  { id: "plan" as const, label: "Plano", icon: CreditCard },
];
const segments = [
  "Barbearia",
  "Salão de beleza",
  "Cabeleireiro",
  "Nail designer",
  "Lash designer",
  "Design de sobrancelhas",
  "Estética",
  "Profissional autônomo",
  "Outro",
];

function persistedDrafts(store: Store) {
  const { business, settings } = store;
  return {
    business: {
      name: business.name,
      category: business.category,
      cnpj: business.cnpj ?? "",
      description: business.description,
      address: business.address,
      phone: business.phone,
      instagram: business.instagram,
      amenities: business.amenities.join(", "),
    },
    identity: {
      cover: business.cover,
      logo: business.logo ?? "",
      color: business.color ?? "",
      photos: business.photos?.join("\n") ?? "",
    },
    agenda: {
      openDays: settings.openDays,
      openStart: settings.openStart,
      openEnd: settings.openEnd,
      minNotice: String(settings.minNotice),
      maxDays: String(settings.maxDays),
      buffer: String(settings.buffer),
      cancellationHours: String(settings.cancellationHours),
    },
    notifications: { notifications: settings.notifications },
  };
}

function SaveBar({
  dirty,
  busy,
  canManage,
  onDiscard,
}: {
  dirty: boolean;
  busy: boolean;
  canManage: boolean;
  onDiscard: () => void;
}) {
  return (
    <div className="settings-savebar">
      <span className="management-muted" role="status" aria-live="polite">
        {!canManage
          ? "Acesso somente para consulta"
          : busy
            ? "Salvando alterações..."
            : dirty
              ? "Alterações não salvas"
              : "Todas as alterações salvas"}
      </span>
      <div className="management-form-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={!dirty || busy || !canManage}
          onClick={onDiscard}
        >
          Descartar
        </Button>
        <Button type="submit" disabled={!dirty || busy || !canManage}>
          {busy && <Loader2 size={15} className="management-spin" />}
          {busy ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data } = useWorkspace();
  return (
    <ManagementBoundary>
      {data && <SettingsContent key={data.business.id} store={data} />}
    </ManagementBoundary>
  );
}

function SettingsContent({ store }: { store: Store }) {
  const router = useRouter();
  const { mutate } = useWorkspace();
  const { canManage } = usePermissions();
  const { toast } = useToast();
  const action = useFormAction();
  const [tab, setTab] = useState<Tab>("business");
  const [drafts, setDrafts] = useState<Drafts>({
    business: null,
    identity: null,
    agenda: null,
    notifications: null,
  });
  const [pendingTab, setPendingTab] = useState<Tab | "discard" | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const saved = persistedDrafts(store);
  const company = drafts.business ?? saved.business;
  const identity = drafts.identity ?? saved.identity;
  const agenda = drafts.agenda ?? saved.agenda;
  const notifications = drafts.notifications ?? saved.notifications;
  const editable = tab !== "professionals" && tab !== "plan";
  const dirty =
    editable &&
    drafts[tab] !== null &&
    JSON.stringify(drafts[tab]) !== JSON.stringify(saved[tab]);
  const anyDirty = (Object.keys(saved) as EditableTab[]).some(
    (section) =>
      drafts[section] !== null &&
      JSON.stringify(drafts[section]) !== JSON.stringify(saved[section]),
  );
  const busy = action.busy || uploading;

  useEffect(() => {
    if (!anyDirty) return;
    function protectDraft(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function protectNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy)
        setPendingNavigation(
          destination.pathname + destination.search + destination.hash,
        );
    }
    window.addEventListener("beforeunload", protectDraft);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", protectDraft);
      document.removeEventListener("click", protectNavigation, true);
    };
  }, [anyDirty, busy]);

  function updateDraft<K extends EditableTab>(
    section: K,
    values: Partial<NonNullable<Drafts[K]>>,
  ) {
    action.setError("");
    setDrafts((current) => ({
      ...current,
      [section]: { ...(current[section] ?? saved[section]), ...values },
    }));
  }
  function businessField(field: keyof BusinessDraft) {
    return {
      name: field,
      value: company[field],
      onChange: (event: FieldEvent) =>
        updateDraft("business", { [field]: event.target.value }),
    };
  }
  function identityField(field: keyof IdentityDraft) {
    return {
      name: field,
      value: identity[field],
      onChange: (event: FieldEvent) =>
        updateDraft("identity", { [field]: event.target.value }),
    };
  }
  function agendaField(field: Exclude<keyof AgendaDraft, "openDays">) {
    return {
      name: field,
      value: agenda[field],
      onChange: (event: FieldEvent) =>
        updateDraft("agenda", { [field]: event.target.value }),
    };
  }
  function switchTab(next: Tab) {
    if (next === tab || busy) return;
    if (dirty) setPendingTab(next);
    else {
      setTab(next);
      action.setError("");
    }
  }
  function discard() {
    if (!editable || busy) return;
    setDrafts((current) => ({ ...current, [tab]: null }));
    if (pendingTab && pendingTab !== "discard") setTab(pendingTab);
    setPendingTab(null);
    action.setError("");
  }
  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    target: "cover" | "logo",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canManage) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      action.setError("Use uma imagem JPG, PNG ou WebP com até 2 MB.");
      return;
    }
    setUploading(true);
    action.setError("");
    try {
      const value = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Não foi possível ler esta imagem."));
        reader.readAsDataURL(file);
      });
      updateDraft("identity", { [target]: value });
    } catch (failure) {
      action.setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível ler esta imagem.",
      );
    } finally {
      setUploading(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !editable || busy || !dirty) return;
    const section = tab;
    let entity: "business" | "settings";
    let values: Record<string, unknown>;
    if (section === "business") {
      const name = company.name.trim();
      const phone = company.phone.trim();
      if (name.length < 3 || name.length > 100 || !brazilianPhone(phone)) {
        action.setError(
          "Informe o nome do estabelecimento e um telefone brasileiro válido com DDD.",
        );
        return;
      }
      entity = "business";
      values = {
        ...store.business,
        ...company,
        name,
        phone,
        description: company.description.trim(),
        address: company.address.trim(),
        instagram: company.instagram.trim(),
        cnpj: company.cnpj.trim(),
        amenities: company.amenities
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      };
    } else if (section === "identity") {
      const color = identity.color.trim();
      const photos = identity.photos
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        action.setError("A cor deve usar o formato hexadecimal, como #123E69.");
        return;
      }
      if (
        photos.length > 12 ||
        photos.some((value) => !/^(https?:\/\/|\/[^/])/.test(value))
      ) {
        action.setError(
          "Adicione até 12 fotos, com uma URL que começa com https:// por linha.",
        );
        return;
      }
      entity = "business";
      values = {
        ...store.business,
        cover: identity.cover.trim(),
        logo: identity.logo.trim(),
        color,
        photos,
      };
    } else if (section === "agenda") {
      const minNotice = Number(agenda.minNotice);
      const maxDays = Number(agenda.maxDays);
      const buffer = Number(agenda.buffer);
      const cancellationHours = Number(agenda.cancellationHours);
      if (
        !agenda.openDays.length ||
        !/^\d{2}:\d{2}$/.test(agenda.openStart) ||
        !/^\d{2}:\d{2}$/.test(agenda.openEnd) ||
        agenda.openStart >= agenda.openEnd ||
        [minNotice, maxDays, buffer, cancellationHours].some(
          (value) => !Number.isInteger(value),
        ) ||
        minNotice < 0 ||
        minNotice > 10080 ||
        maxDays < 1 ||
        maxDays > 365 ||
        buffer < 0 ||
        buffer > 120 ||
        cancellationHours < 0 ||
        cancellationHours > 168
      ) {
        action.setError("Revise o expediente e os limites de agendamento.");
        return;
      }
      entity = "settings";
      values = {
        ...store.settings,
        ...agenda,
        minNotice,
        maxDays,
        buffer,
        cancellationHours,
      };
    } else {
      entity = "settings";
      values = { ...store.settings, ...notifications };
    }
    void action.run(async () => {
      await mutate(entity, "update", values);
      setDrafts((current) => ({ ...current, [section]: null }));
      toast(
        section === "identity"
          ? "Identidade visual salva no seu link público."
          : section === "agenda"
            ? "Regras da agenda atualizadas."
            : section === "notifications"
              ? "Preferências de lembretes salvas."
              : "Dados da empresa atualizados.",
      );
    });
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${store.business.slug}`,
      );
      toast("Link público copiado.");
    } catch {
      toast("Abra o link público e copie o endereço do navegador.");
    }
  }
  const sectionTitle = {
    business: "Dados da empresa",
    identity: "Identidade visual",
    agenda: "Regras da agenda",
    professionals: "Agendas dos profissionais",
    notifications: "Notificações",
    plan: "Seu espaço de gestão",
  }[tab];
  const sectionDescription = {
    business: "As informações que apresentam seu estabelecimento aos clientes.",
    identity: "Uma capa que conta sua história e uma marca na medida certa.",
    agenda: "Defina os limites que deixam sua rotina organizada.",
    professionals:
      "Cada integrante da equipe tem uma disponibilidade independente.",
    notifications: "Preferências de contato com o consentimento do cliente.",
    plan: "Recursos e situação do seu ambiente de gestão.",
  }[tab];
  const saveBar = (
    <SaveBar
      dirty={dirty}
      busy={busy}
      canManage={canManage}
      onDiscard={() => setPendingTab("discard")}
    />
  );

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Seu estabelecimento, com a sua personalidade."
        actions={
          <Button variant="secondary" onClick={() => void copyLink()}>
            <Copy size={14} />
            Copiar link público
          </Button>
        }
      />
      <div className="management-settings settings-layout">
        <nav
          className="management-tabs settings-section-nav"
          aria-label="Seções das configurações"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              className={`management-tab ${tab === item.id ? "selected" : ""}`}
              disabled={busy}
              onClick={() => switchTab(item.id)}
            >
              <item.icon size={16} />
              {item.label}
              {tab === item.id && dirty && (
                <span aria-label="Alterações não salvas">•</span>
              )}
            </button>
          ))}
        </nav>
        <Card className="management-settings-card">
          <div className="settings-section-heading">
            <div>
              <h2>{sectionTitle}</h2>
              <p className="management-top-description">{sectionDescription}</p>
            </div>
            {dirty && <span className="management-pill">Rascunho</span>}
          </div>
          {!canManage && (
            <p className="management-info">
              Seu perfil permite consultar estas informações. Solicite
              alterações ao responsável pelo estabelecimento.
            </p>
          )}
          {tab === "business" && (
            <form className="management-form" onSubmit={save}>
              <fieldset
                className="management-form settings-fields"
                disabled={!canManage || busy}
              >
                <FormSection
                  title="Informações básicas"
                  description="Nome, segmento e apresentação na sua página pública."
                >
                  <div className="management-form">
                    <FormField label="Nome do estabelecimento">
                      <input
                        {...businessField("name")}
                        minLength={3}
                        maxLength={100}
                        required
                      />
                    </FormField>
                    <div className="management-form-grid">
                      <FormField label="Segmento">
                        <select {...businessField("category")}>
                          {[
                            ...new Set([...segments, store.business.category]),
                          ].map((segment) => (
                            <option key={segment}>{segment}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="CNPJ (opcional)">
                        <input
                          {...businessField("cnpj")}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                        />
                      </FormField>
                    </div>
                    <FormField label="Descrição">
                      <textarea
                        {...businessField("description")}
                        maxLength={1000}
                        placeholder="Conte o que torna sua experiência especial."
                      />
                    </FormField>
                  </div>
                </FormSection>
                <FormSection
                  title="Contato e localização"
                  description="Facilite o contato e a chegada ao estabelecimento."
                >
                  <div className="management-form">
                    <div className="management-form-grid">
                      <FormField label="Telefone / WhatsApp">
                        <input
                          {...businessField("phone")}
                          type="tel"
                          autoComplete="tel"
                          required
                        />
                      </FormField>
                      <FormField label="Instagram">
                        <input
                          {...businessField("instagram")}
                          placeholder="@seuestabelecimento"
                        />
                      </FormField>
                    </div>
                    <FormField label="Endereço completo">
                      <input
                        {...businessField("address")}
                        autoComplete="street-address"
                        required
                        maxLength={250}
                      />
                    </FormField>
                    <FormField
                      label="Comodidades"
                      hint="Separe por vírgula: Wi-Fi, estacionamento, bebidas, ambiente climatizado."
                    >
                      <input {...businessField("amenities")} />
                    </FormField>
                  </div>
                </FormSection>
              </fieldset>
              <FormError error={action.error} />
              {saveBar}
            </form>
          )}
          {tab === "identity" && (
            <form className="management-form" onSubmit={save}>
              <FormSection
                title="Prévia da página pública"
                description="As alterações aparecem aqui antes de salvar."
              >
                <div className="settings-preview">
                  <div
                    className="settings-preview-cover"
                    style={{
                      background:
                        "linear-gradient(135deg, #07111F 0%, #0D2847 55%, #123E69 100%)",
                    }}
                  >
                    {identity.cover ? (
                      <img
                        key={identity.cover}
                        src={identity.cover}
                        alt="Prévia da capa do estabelecimento"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageIcon size={32} aria-hidden="true" />
                    )}
                    <span>{company.category || "Seu estabelecimento"}</span>
                  </div>
                  <div className="settings-preview-body">
                    <div className="management-person">
                      <span className="settings-preview-logo">
                        <Avatar
                          key={identity.logo}
                          name={company.name.trim() || "Seu estabelecimento"}
                          src={identity.logo || undefined}
                          size={40}
                        />
                      </span>
                      <div>
                        <strong>
                          {company.name.trim() || "Seu estabelecimento"}
                        </strong>
                        <small>{company.category}</small>
                      </div>
                    </div>
                    <p className="management-top-description">
                      {company.description.trim() ||
                        "Seu próximo momento de cuidado começa aqui."}
                    </p>
                    <span
                      className="settings-preview-cta"
                      style={
                        /^#[0-9a-fA-F]{6}$/.test(identity.color)
                          ? { background: identity.color }
                          : undefined
                      }
                    >
                      Agendar horário
                      <ArrowRight size={15} />
                    </span>
                  </div>
                </div>
              </FormSection>
              <fieldset
                className="management-form settings-fields"
                disabled={!canManage || busy}
              >
                <FormSection
                  title="Capa e marca"
                  description="A foto do ambiente é o destaque. A logo aparece pequena e discreta."
                >
                  <div className="management-form">
                    <FormField
                      label="Foto de capa"
                      hint="Prefira uma foto horizontal. JPG, PNG ou WebP, até 2 MB."
                    >
                      <input
                        className="management-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => void upload(event, "cover")}
                      />
                      <input
                        {...identityField("cover")}
                        aria-label="URL da capa"
                        placeholder="Ou cole o endereço https:// da imagem"
                      />
                    </FormField>
                    <FormField
                      label="Logo (opcional)"
                      hint="Sem logo, usamos as iniciais do seu estabelecimento. JPG, PNG ou WebP, até 2 MB."
                    >
                      <input
                        className="management-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => void upload(event, "logo")}
                      />
                      <input
                        {...identityField("logo")}
                        aria-label="URL da logo"
                        placeholder="https://..."
                      />
                    </FormField>
                  </div>
                </FormSection>
                <FormSection
                  title="Detalhes da identidade"
                  description="Personalização discreta para uma experiência consistente."
                >
                  <div className="management-form">
                    <FormField
                      label="Cor personalizada (opcional)"
                      hint="Prefira uma cor escura para manter contraste nos botões."
                    >
                      <input
                        {...identityField("color")}
                        placeholder="#123E69"
                        pattern="#[0-9a-fA-F]{6}"
                        maxLength={7}
                      />
                    </FormField>
                    <FormField
                      label="Fotos do estabelecimento (opcional)"
                      hint="Cole uma URL de imagem por linha, até 12 fotos."
                    >
                      <textarea
                        {...identityField("photos")}
                        placeholder="https://..."
                      />
                    </FormField>
                  </div>
                </FormSection>
              </fieldset>
              <Link
                href={`/${store.business.slug}`}
                className="management-link-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} />
                Ver página pública salva
              </Link>
              <FormError error={action.error} />
              {saveBar}
            </form>
          )}
          {tab === "agenda" && (
            <form className="management-form" onSubmit={save}>
              <fieldset
                className="management-form settings-fields"
                disabled={!canManage || busy}
              >
                <FormSection
                  title="Expediente do estabelecimento"
                  description="A disponibilidade também considera o horário de cada profissional."
                >
                  <div className="management-form">
                    <div>
                      <p className="management-section-title">
                        Dias de funcionamento
                      </p>
                      <DayPicker
                        value={agenda.openDays}
                        onChange={(openDays) =>
                          updateDraft("agenda", { openDays })
                        }
                      />
                    </div>
                    <div className="management-form-grid">
                      <FormField label="Abre às">
                        <input
                          {...agendaField("openStart")}
                          type="time"
                          required
                        />
                      </FormField>
                      <FormField label="Fecha às">
                        <input
                          {...agendaField("openEnd")}
                          type="time"
                          required
                        />
                      </FormField>
                    </div>
                  </div>
                </FormSection>
                <FormSection
                  title="Limites de agendamento"
                  description="Antecedência e tempo de preparação entre os atendimentos."
                >
                  <div className="management-form">
                    <div className="management-form-grid">
                      <FormField label="Antecedência mínima (minutos)">
                        <input
                          {...agendaField("minNotice")}
                          type="number"
                          required
                          min={0}
                          max={10080}
                        />
                      </FormField>
                      <FormField label="Antecedência máxima (dias)">
                        <input
                          {...agendaField("maxDays")}
                          type="number"
                          required
                          min={1}
                          max={365}
                        />
                      </FormField>
                    </div>
                    <div className="management-form-grid">
                      <FormField label="Tempo entre atendimentos (minutos)">
                        <input
                          {...agendaField("buffer")}
                          type="number"
                          required
                          min={0}
                          max={120}
                        />
                      </FormField>
                      <FormField label="Cancelamento permitido até (horas antes)">
                        <input
                          {...agendaField("cancellationHours")}
                          type="number"
                          required
                          min={0}
                          max={168}
                        />
                      </FormField>
                    </div>
                  </div>
                </FormSection>
              </fieldset>
              <div className="management-info">
                <ShieldCheck size={16} /> A disponibilidade considera o
                expediente, os intervalos e as folgas do profissional, os
                bloqueios e toda a duração do serviço.
              </div>
              <FormError error={action.error} />
              {saveBar}
            </form>
          )}
          {tab === "professionals" && (
            <div className="management-form">
              <MetricStrip
                items={[
                  {
                    label: "Profissionais ativos",
                    value: store.professionals.filter(
                      (professional) => professional.active,
                    ).length,
                  },
                  {
                    label: "Serviços disponíveis",
                    value: store.services.filter((service) => service.active)
                      .length,
                  },
                ]}
              />
              <FormSection
                title="Disponibilidade individual"
                description="Configure serviços, dias de trabalho, intervalos, folgas e comissão no perfil do profissional."
              >
                <div className="management-form-actions">
                  <Link
                    href="/dashboard/equipe"
                    className="management-link-button"
                  >
                    <Users size={15} />
                    {canManage ? "Gerenciar equipe" : "Ver equipe"}
                  </Link>
                  <Link
                    href="/dashboard/agenda"
                    className="management-link-button"
                  >
                    <CalendarDays size={15} />
                    Abrir agenda
                  </Link>
                </div>
              </FormSection>
            </div>
          )}
          {tab === "notifications" && (
            <form className="management-form" onSubmit={save}>
              <fieldset
                className="management-form settings-fields"
                disabled={!canManage || busy}
              >
                <FormSection
                  title="Consentimento para lembretes"
                  description="O cliente decide se deseja receber mensagens ao agendar."
                >
                  <label className="management-check">
                    <input
                      type="checkbox"
                      name="notifications"
                      checked={notifications.notifications}
                      onChange={(event) =>
                        updateDraft("notifications", {
                          notifications: event.target.checked,
                        })
                      }
                    />
                    Habilitar consentimento para lembretes pelo WhatsApp
                  </label>
                </FormSection>
              </fieldset>
              <FormSection
                title="Envio de mensagens"
                description="O envio automático ainda depende de um provedor conectado."
              >
                <div className="management-info">
                  O consentimento fica registrado no agendamento. Esta
                  preferência não ativa o envio automático pelo WhatsApp. Até a
                  conexão de um provedor ao servidor, use o botão de contato no
                  perfil do cliente.
                </div>
              </FormSection>
              <FormError error={action.error} />
              {saveBar}
            </form>
          )}
          {tab === "plan" && (
            <div className="management-form">
              <span className="management-pill">
                {store.mode === "demo"
                  ? "Ambiente de demonstração"
                  : "Versão inicial"}
              </span>
              <FormSection title="Recursos disponíveis">
                <ul className="management-plan-list">
                  {[
                    "Link público de agendamento",
                    "Agenda individual da equipe",
                    "Cadastro de clientes e histórico",
                    "Serviços e profissionais",
                    "Financeiro e comissões",
                    "Relatórios e instalação no celular",
                  ].map((item) => (
                    <li key={item}>
                      <Check size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              </FormSection>
              <div className="management-info">
                {store.mode === "demo" &&
                  "Este ambiente utiliza dados fictícios para demonstração. "}
                A contratação, a cobrança e os limites comerciais ainda não
                estão conectados. Nenhuma cobrança é realizada neste ambiente.
              </div>
            </div>
          )}
        </Card>
      </div>
      <Modal
        open={pendingTab !== null || pendingNavigation !== null}
        onClose={() => {
          setPendingTab(null);
          setPendingNavigation(null);
        }}
        title={
          pendingTab === "discard"
            ? "Descartar alterações?"
            : "Alterações não salvas"
        }
        description="Esta seção tem alterações que ainda não foram salvas."
      >
        <p className="management-delete-description">
          {pendingNavigation
            ? "Você tem rascunhos não salvos. Ao sair sem salvar, as alterações serão descartadas."
            : "Ao descartar, esta seção volta para os últimos dados salvos. Você pode continuar editando e salvar quando estiver pronto."}
        </p>
        <div className="management-form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPendingTab(null);
              setPendingNavigation(null);
            }}
          >
            Continuar editando
          </Button>
          {pendingTab && pendingTab !== "discard" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTab(pendingTab);
                setPendingTab(null);
                action.setError("");
              }}
            >
              Manter rascunho
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              if (pendingNavigation) {
                const destination = pendingNavigation;
                setDrafts({
                  business: null,
                  identity: null,
                  agenda: null,
                  notifications: null,
                });
                setPendingNavigation(null);
                router.push(destination);
              } else discard();
            }}
          >
            {pendingNavigation ? "Sair sem salvar" : "Descartar alterações"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
