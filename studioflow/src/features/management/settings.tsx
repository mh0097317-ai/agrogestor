"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  Bell,
  ChatCircleText,
  CalendarBlank,
  Check,
  CircleNotch,
  Copy,
  CreditCard,
  Gift,
  ImageSquare,
  LockSimple,
  ShieldCheck,
  Storefront,
  Users,
  Wallet,
  Robot,
} from "@phosphor-icons/react/dist/ssr";
import { PaymentSettings } from "./payment-settings";
import { AssistantSettings } from "./assistant-settings";
import { InstagramFeedSettings } from "./instagram-feed-settings";
import { WhatsAppSettings } from "./whatsapp-settings";
import { FeePayment } from "@/features/dashboard/fee-payment";
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
import {
  allModules,
  enabledModules,
  hasModule,
  moduleCatalog,
  planCatalog,
} from "@/lib/modules";
import type { Store } from "@/types";
import { GalleryUpload, ImageUpload } from "@/components/image-upload";
import { storedImagePattern } from "@/lib/image";
import { formatPhone, initials } from "@/lib/utils";
import {
  ManagementBoundary,
  FormField,
  FormError,
  useFormAction,
  DayPicker,
  brazilianPhone,
} from "./shared";

type EditableTab =
  "business" | "identity" | "agenda" | "loyalty" | "notifications";
type Tab =
  | EditableTab
  | "professionals"
  | "payments"
  | "assistant"
  | "whatsapp"
  | "plan";
type FieldEvent = ChangeEvent<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
>;
type BusinessDraft = {
  name: string;
  category: string;
  cnpj: string;
  description: string;
  address: string;
  mapsUrl: string;
  phone: string;
  instagram: string;
  amenities: string;
};
type IdentityDraft = {
  cover: string;
  logo: string;
  color: string;
  photos: string[];
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
  loyalty: LoyaltyDraft | null;
  notifications: { notifications: boolean } | null;
};
type LoyaltyDraft = {
  loyaltyEnabled: boolean;
  loyaltyGoal: string;
  loyaltyReward: string;
};
const tabs = [
  { id: "business" as const, label: "Empresa", icon: Storefront },
  { id: "identity" as const, label: "Identidade", icon: ImageSquare },
  { id: "agenda" as const, label: "Agenda", icon: CalendarBlank },
  { id: "loyalty" as const, label: "Fidelidade", icon: Gift },
  { id: "payments" as const, label: "Pagamentos", icon: Wallet },
  { id: "whatsapp" as const, label: "WhatsApp", icon: ChatCircleText },
  { id: "assistant" as const, label: "Recepcionista", icon: Robot },
  { id: "professionals" as const, label: "Profissionais", icon: Users },
  { id: "notifications" as const, label: "Notificações", icon: Bell },
  { id: "plan" as const, label: "Plano", icon: CreditCard },
];
// Empty value keeps the StudioFlow ink.
const colorPresets = [
  {
    label: "Tinta",
    value: "",
    swatch: "#16130F",
  },
  { label: "Marinho", value: "#1b2f4a", swatch: "#1b2f4a" },
  { label: "Grafite", value: "#374151", swatch: "#374151" },
  { label: "Vinho", value: "#6b1f2e", swatch: "#6b1f2e" },
  { label: "Verde-escuro", value: "#1f4d3a", swatch: "#1f4d3a" },
  { label: "Café", value: "#5b3a29", swatch: "#5b3a29" },
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
      mapsUrl: business.mapsUrl ?? "",
      phone: formatPhone(business.phone),
      instagram: business.instagram,
      amenities: business.amenities.join(", "),
    },
    identity: {
      cover: business.cover,
      logo: business.logo ?? "",
      color: business.color ?? "",
      photos: business.photos ?? [],
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
    loyalty: {
      loyaltyEnabled: settings.loyaltyEnabled,
      loyaltyGoal: String(settings.loyaltyGoal),
      loyaltyReward: settings.loyaltyReward,
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
          {busy && <CircleNotch size={15} className="management-spin" />}
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
  const { mutate, refresh } = useWorkspace();
  const { canManage } = usePermissions();
  const { toast } = useToast();
  const action = useFormAction();
  const [tab, setTab] = useState<Tab>("business");
  const [drafts, setDrafts] = useState<Drafts>({
    business: null,
    identity: null,
    agenda: null,
    loyalty: null,
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
  const loyalty = drafts.loyalty ?? saved.loyalty;
  const editable =
    tab !== "professionals" &&
    tab !== "plan" &&
    tab !== "payments" &&
    tab !== "assistant" &&
    tab !== "whatsapp";
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
  function identityField(field: Exclude<keyof IdentityDraft, "photos">) {
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
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !editable || busy || !dirty) return;
    const section = tab;
    if (section === "loyalty") {
      const goal = Number(loyalty.loyaltyGoal);
      const reward = loyalty.loyaltyReward.trim();
      if (!Number.isInteger(goal) || goal < 2 || goal > 50) {
        action.setError(
          "Escolha de 2 a 50 atendimentos para completar o cartão.",
        );
        return;
      }
      if (loyalty.loyaltyEnabled && !reward) {
        action.setError("Diga qual é o prêmio, por exemplo: 1 corte grátis.");
        return;
      }
      void action.run(async () => {
        const response = await fetch("/api/workspace/loyalty", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loyaltyEnabled: loyalty.loyaltyEnabled,
            loyaltyGoal: goal,
            loyaltyReward: reward,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.error || "Não foi possível salvar a fidelidade.",
          );
        await refresh();
        setDrafts((current) => ({ ...current, loyalty: null }));
        toast(
          loyalty.loyaltyEnabled
            ? "Cartão fidelidade ativo na sua página."
            : "Cartão fidelidade desligado.",
        );
      });
      return;
    }
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
        phone: phone.replace(/\D/g, ""),
        description: company.description.trim(),
        address: company.address.trim(),
        mapsUrl: company.mapsUrl.trim(),
        instagram: company.instagram.trim(),
        cnpj: company.cnpj.trim(),
        amenities: company.amenities
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      };
    } else if (section === "identity") {
      const color = identity.color.trim();
      const photos = identity.photos.filter(Boolean);
      const cover = identity.cover.trim();
      const logo = identity.logo.trim();
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        action.setError("A cor deve usar o formato hexadecimal, como #2C251E.");
        return;
      }
      if (
        photos.length > 12 ||
        [...photos, cover, logo].some(
          (value) => value && !storedImagePattern.test(value),
        )
      ) {
        action.setError("Revise as fotos: use até 12 imagens na galeria.");
        return;
      }
      entity = "business";
      values = {
        ...store.business,
        cover,
        logo,
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
    loyalty: "Cartão fidelidade",
    professionals: "Agendas dos profissionais",
    notifications: "Notificações",
    payments: "Pagamentos online",
    assistant: "Recepcionista com IA",
    whatsapp: "WhatsApp da loja",
    plan: "Seu espaço de gestão",
  }[tab];
  const sectionDescription = {
    business: "As informações que apresentam seu estabelecimento aos clientes.",
    identity: "Capa, logo, galeria de fotos e cor da sua página.",
    agenda: "Defina os limites que deixam sua rotina organizada.",
    payments:
      "Sinal via Pix no agendamento e cobrança do clube, direto na sua conta.",
    assistant: "Atendente virtual no chat da página e no WhatsApp, 24 horas.",
    whatsapp: "Conecte com QR Code e deixe os avisos saírem sozinhos.",
    loyalty:
      "Recompense quem volta. O cliente acompanha os carimbos no comprovante.",
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
        description="Dados, aparência e regras do seu estabelecimento."
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
          {tabs
            .filter((item) => {
              const needs = {
                loyalty: "fidelidade",
                payments: "pagamentos",
                assistant: "recepcionista",
              } as const;
              return (
                !(item.id in needs) ||
                hasModule(
                  store.access?.modules,
                  needs[item.id as keyof typeof needs],
                )
              );
            })
            .map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={tab === item.id ? "page" : undefined}
                className={`management-tab ${tab === item.id ? "selected" : ""}`}
                disabled={busy}
                onClick={() => switchTab(item.id)}
              >
                <item.icon
                  size={17}
                  weight={tab === item.id ? "fill" : "regular"}
                />
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
                        placeholder="Ex.: Corte, barba e sobrancelha com hora marcada."
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
                          onChange={(event) =>
                            updateDraft("business", {
                              phone: formatPhone(event.target.value),
                            })
                          }
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
                      label="Link do Google Maps (opcional)"
                      hint="Abra sua barbearia no Google Maps, toque em Compartilhar e cole o link. Assim o cliente vê suas fotos e avaliações do Google."
                    >
                      <input
                        {...businessField("mapsUrl")}
                        type="url"
                        inputMode="url"
                        placeholder="https://maps.app.goo.gl/..."
                        maxLength={500}
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
          {tab === "business" && (
            <InstagramFeedSettings
              store={store}
              canManage={canManage}
              onSaved={refresh}
            />
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
                      background: "#16130F",
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
                      <ImageSquare size={32} aria-hidden="true" />
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
                        "Descrição do seu estabelecimento."}
                    </p>
                    {identity.photos.length > 0 && (
                      <div className="settings-preview-gallery">
                        {identity.photos.slice(0, 4).map((photo, index) => (
                          <img
                            key={`${index}-${photo.slice(-16)}`}
                            src={photo}
                            alt=""
                          />
                        ))}
                      </div>
                    )}
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
                  title="Capa e logo"
                  description="A capa é a primeira coisa que o cliente vê. Use uma foto real do seu espaço."
                >
                  <div className="management-form">
                    <ImageUpload
                      label="Foto de capa"
                      hint="Foto horizontal, de preferência com boa luz. Ajustamos o tamanho para carregar rápido."
                      preset="cover"
                      shape="wide"
                      value={identity.cover}
                      onChange={(cover) => updateDraft("identity", { cover })}
                      emptyTitle="Adicionar foto de capa"
                      emptyText="A fachada, a recepção ou as cadeiras do seu espaço"
                      disabled={!canManage || action.busy}
                      onBusy={setUploading}
                    />
                    <ImageUpload
                      label="Logo (opcional)"
                      hint="Sem logo, mostramos as iniciais do estabelecimento."
                      preset="logo"
                      shape="square"
                      value={identity.logo}
                      onChange={(logo) => updateDraft("identity", { logo })}
                      fallback={
                        <span className="settings-logo-fallback">
                          {initials(company.name.trim() || "Seu espaço")}
                        </span>
                      }
                      disabled={!canManage || action.busy}
                      onBusy={setUploading}
                    />
                  </div>
                </FormSection>
                <FormSection
                  title="Galeria de fotos"
                  description="Cortes, trabalhos feitos e o ambiente. É o que convence o cliente a marcar."
                >
                  <GalleryUpload
                    label="Fotos da galeria"
                    hint="A primeira foto aparece em destaque. Use as setas para mudar a ordem."
                    value={identity.photos}
                    onChange={(photos) => updateDraft("identity", { photos })}
                    disabled={!canManage || action.busy}
                    onBusy={setUploading}
                  />
                </FormSection>
                <FormSection
                  title="Cor dos botões"
                  description="Usada nos botões e destaques da sua página."
                >
                  <div
                    className="settings-swatches"
                    role="group"
                    aria-label="Cores prontas"
                  >
                    {colorPresets.map((preset) => {
                      const selected =
                        identity.color.trim().toLowerCase() === preset.value;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          aria-pressed={selected}
                          className={selected ? "is-selected" : ""}
                          onClick={() =>
                            updateDraft("identity", { color: preset.value })
                          }
                        >
                          <i style={{ background: preset.swatch }} />
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <FormField
                    label="Outra cor (opcional)"
                    hint="Prefira uma cor escura para manter contraste nos botões."
                  >
                    <span className="settings-color">
                      <input
                        type="color"
                        aria-label="Escolher cor"
                        value={
                          /^#[0-9a-fA-F]{6}$/.test(identity.color)
                            ? identity.color
                            : "#2c251e"
                        }
                        onChange={(event) =>
                          updateDraft("identity", { color: event.target.value })
                        }
                      />
                      <input
                        {...identityField("color")}
                        placeholder="#2C251E"
                        pattern="#[0-9a-fA-F]{6}"
                        maxLength={7}
                      />
                    </span>
                  </FormField>
                </FormSection>
              </fieldset>
              <Link
                href={`/${store.business.slug}`}
                className="management-link-button"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowSquareOut size={14} />
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
                    <CalendarBlank size={15} />
                    Abrir agenda
                  </Link>
                </div>
              </FormSection>
            </div>
          )}
          {tab === "loyalty" && (
            <form className="management-form" onSubmit={save}>
              <fieldset
                className="management-form settings-fields"
                disabled={!canManage || busy}
              >
                <FormSection
                  title="Como funciona"
                  description="Cada atendimento concluído vale um carimbo. Com o cartão completo, o próximo atendimento ganha o prêmio."
                >
                  <label className="management-check">
                    <input
                      type="checkbox"
                      checked={loyalty.loyaltyEnabled}
                      onChange={(event) =>
                        updateDraft("loyalty", {
                          loyaltyEnabled: event.target.checked,
                        })
                      }
                    />
                    Ativar cartão fidelidade
                  </label>
                  <div className="management-form-grid">
                    <FormField
                      label="Atendimentos para completar"
                      hint="De 2 a 50."
                    >
                      <input
                        type="number"
                        inputMode="numeric"
                        min={2}
                        max={50}
                        value={loyalty.loyaltyGoal}
                        onChange={(event) =>
                          updateDraft("loyalty", {
                            loyaltyGoal: event.target.value,
                          })
                        }
                      />
                    </FormField>
                    <FormField
                      label="Prêmio"
                      hint="Aparece na sua página e no comprovante."
                    >
                      <input
                        maxLength={80}
                        placeholder="Ex.: 1 corte grátis"
                        value={loyalty.loyaltyReward}
                        onChange={(event) =>
                          updateDraft("loyalty", {
                            loyaltyReward: event.target.value,
                          })
                        }
                      />
                    </FormField>
                  </div>
                </FormSection>
              </fieldset>
              <div className="management-info">
                Os carimbos contam os atendimentos marcados como concluídos na
                agenda. No dia do prêmio, o agendamento mostra o selo
                &ldquo;Ganha o prêmio&rdquo; para você lembrar de aplicar.
              </div>
              <FormError error={action.error} />
              {saveBar}
            </form>
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
          {tab === "payments" && (
            <PaymentSettings
              store={store}
              canManage={canManage}
              onSaved={refresh}
            />
          )}
          {tab === "assistant" && (
            <AssistantSettings
              store={store}
              canManage={canManage}
              onSaved={refresh}
            />
          )}
          {tab === "whatsapp" && (
            <WhatsAppSettings
              store={store}
              canManage={canManage}
              onSaved={refresh}
            />
          )}
          {tab === "plan" && (
            <>
              <PlanSection store={store} />
              <FeePayment
                showHistory
                demo={store.mode === "demo"}
                onPaid={refresh}
              />
            </>
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
                  loyalty: null,
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

const support = (process.env.NEXT_PUBLIC_STUDIOFLOW_WHATSAPP || "").replace(
  /\D/g,
  "",
);

/** Configurações → Plano: o que o estabelecimento contratou com a StudioFlow. */
function PlanSection({ store }: { store: Store }) {
  const access = store.access;
  const on = enabledModules(access?.modules);
  const planName =
    access?.plan ||
    (access?.modules
      ? Object.values(planCatalog).find(
          (plan) =>
            plan.modules.slice().sort().join() === on.slice().sort().join(),
        )?.label
      : "") ||
    (store.mode === "demo" ? "Demonstração" : "Completo");
  const ask = `Olá! Quero mudar o plano do ${store.business.name} no StudioFlow.`;
  return (
    <div className="management-form">
      <span className="management-pill">Plano {planName}</span>
      {access?.until && (
        <p className="management-info">
          Acesso até{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }).format(new Date(access.until))}
          .
        </p>
      )}
      <FormSection title="Sempre incluso">
        <ul className="management-plan-list">
          {[
            "Página e agendamento online",
            "Agenda da equipe, clientes e histórico",
            "Serviços, profissionais e financeiro",
            "Relatórios, divulgação e story das vagas",
          ].map((item) => (
            <li key={item}>
              <Check size={16} />
              {item}
            </li>
          ))}
        </ul>
      </FormSection>
      <FormSection title="Módulos">
        <ul className="management-plan-list plan-modules">
          {allModules.map((key) => (
            <li key={key} className={on.includes(key) ? "" : "is-off"}>
              {on.includes(key) ? (
                <Check size={16} />
              ) : (
                <LockSimple size={16} />
              )}
              <span>
                <strong>{moduleCatalog[key].label}</strong>
                <small>
                  {on.includes(key)
                    ? moduleCatalog[key].detail
                    : "Não incluído no seu plano"}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </FormSection>
      {support && (
        <a
          className="btn btn-secondary plan-change"
          href={`https://wa.me/${support}?text=${encodeURIComponent(ask)}`}
          target="_blank"
          rel="noreferrer"
        >
          Mudar de plano com a equipe StudioFlow
        </a>
      )}
    </div>
  );
}
