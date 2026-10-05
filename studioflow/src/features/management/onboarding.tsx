"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CalendarBlank,
  Check,
  CircleNotch,
  Copy,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { Button, Card } from "@/components/ui";
import { Brand } from "@/components/brand";
import { SegmentIcon } from "@/lib/segments";
import { FormField, FormError, DayPicker, dayNames } from "./shared";
import { OnboardingPreview } from "./onboarding-preview";
import { GalleryUpload, ImageUpload } from "@/components/image-upload";
import { formatPhone } from "@/lib/utils";
import { storedImagePattern } from "@/lib/image";
import "./onboarding.css";
import "./onboarding-preview.css";

const categories = [
  { name: "Barbearia", description: "Corte, barba e sobrancelha" },
  {
    name: "Salão de beleza",
    description: "Cabelo, unhas e maquiagem",
  },
  {
    name: "Cabeleireiro",
    description: "Corte, cor e escova",
  },
  {
    name: "Nail designer",
    description: "Gel, fibra e esmaltação",
  },
  { name: "Lash designer", description: "Extensão e lifting de cílios" },
  { name: "Estética", description: "Limpeza de pele e massagem" },
  {
    name: "Profissional autônomo",
    description: "Atende sozinho, com agenda própria",
  },
  { name: "Outro", description: "Outro serviço com hora marcada" },
];
const steps = ["Negócio", "Contato", "Identidade", "Serviços", "Equipe", "Horários"];
const last = steps.length - 1;
const done = steps.length;
type DraftService = {
  id: string;
  name: string;
  duration: string;
  price: string;
  image: string;
  description: string;
};
type DraftMember = { name: string; phone: string; photo: string };
// Empty value keeps the StudioFlow ink.
const colorPresets = [
  { label: "Tinta", value: "", swatch: "#16130F" },
  { label: "Marinho", value: "#1b2f4a", swatch: "#1b2f4a" },
  { label: "Grafite", value: "#374151", swatch: "#374151" },
  { label: "Vinho", value: "#6b1f2e", swatch: "#6b1f2e" },
  { label: "Verde-escuro", value: "#1f4d3a", swatch: "#1f4d3a" },
  { label: "Café", value: "#5b3a29", swatch: "#5b3a29" },
];
const amenityOptions = [
  "Wi-Fi",
  "Estacionamento",
  "Café",
  "Bebidas",
  "Ar-condicionado",
  "Acessível",
  "TV",
  "Música ao vivo",
  "Atende crianças",
  "Cartão e Pix",
];
const phoneOk = (value: string) => /^[1-9][0-9]{9,10}$/.test(value.replace(/\D/g, ""));

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("Barbearia");
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");
  const [logo, setLogo] = useState("");
  const [color, setColor] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [uploads, setUploads] = useState(0);
  const uploading = uploads > 0;
  const onBusy = (busy: boolean) => setUploads((count) => Math.max(0, count + (busy ? 1 : -1)));
  const [services, setServices] = useState<DraftService[]>([
    { id: "first", name: "", duration: "40", price: "", image: "", description: "" },
  ]);
  const [team, setTeam] = useState<DraftMember[]>([{ name: "", phone: "", photo: "" }]);
  const professionals = team.map((member) => member.name);
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("19:00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);
  function continueStep() {
    setError("");
    if (step === 1) {
      if (name.trim().length < 3) return setError("Informe o nome do estabelecimento, com pelo menos 3 letras.");
      if (!phoneOk(phone)) return setError("Informe o WhatsApp da loja com DDD. É por ele que os clientes falam com você.");
      if (address.trim().length < 8) return setError("Informe o endereço completo: rua, número, bairro e cidade.");
    }
    if (step === 2) {
      if (!cover || !storedImagePattern.test(cover))
        return setError("Coloque uma foto de capa. Ela é a primeira coisa que o cliente vê.");
      if ((logo && !storedImagePattern.test(logo)) || photos.some((photo) => !storedImagePattern.test(photo)))
        return setError("Uma das fotos não foi salva. Tente enviar de novo.");
    }
    if (
      step === 3 &&
      services.some(
        (service) =>
          service.name.trim().length < 3 ||
          !Number.isInteger(Number(service.duration)) ||
          Number(service.duration) < 5 ||
          Number(service.duration) > 480 ||
          !service.price ||
          Number(service.price) < 0 ||
          !Number.isFinite(Number(service.price)),
      )
    )
      return setError(
        "Revise seus serviços. Nome obrigatório, duração de 5 a 480 minutos e preço a partir de R$ 0.",
      );
    if (step === 4) {
      if (team.some((member) => member.name.trim().length < 3))
        return setError("Informe o nome de cada profissional, incluindo você se também atende.");
      if (new Set(team.map((member) => member.name.trim().toLowerCase())).size !== team.length)
        return setError("Os nomes dos profissionais não podem se repetir.");
      if (team.some((member) => member.phone && !phoneOk(member.phone)))
        return setError("Confira o WhatsApp dos profissionais (com DDD) ou deixe em branco.");
    }
    setStep((previous) => previous + 1);
  }
  async function finish() {
    setError("");
    if (!days.length || !start || !end || start >= end) {
      setError("Escolha ao menos um dia e um expediente válido.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name: name.trim(),
          cover: cover.trim(),
          logo,
          color,
          photos,
          description: description.trim(),
          phone: phone.replace(/\D/g, ""),
          address: address.trim(),
          instagram: instagram.trim(),
          amenities,
          services: services.map((service) => ({
            name: service.name.trim(),
            duration: Number(service.duration),
            price: Number(service.price),
            image: service.image,
            description: service.description.trim(),
          })),
          professionalNames: team.map((member) => member.name.trim()),
          team: team.map((member) => ({
            name: member.name.trim(),
            phone: member.phone.replace(/\D/g, ""),
            photo: member.photo,
          })),
          openDays: days,
          openStart: start,
          openEnd: end,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Não foi possível criar o estabelecimento.",
        );
      if (!result.slug)
        throw new Error("O link público não foi retornado. Tente novamente.");
      setSlug(result.slug);
      setStep(done);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
      setCopied(true);
    } catch {
      setError("Abra o link público e copie o endereço pelo navegador.");
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link href="/" className="onboarding-brand" aria-label="StudioFlow">
          <Brand size={34} animated />
        </Link>
        <span className="onboarding-header-note">
          Cada detalhe, do seu jeito.
        </span>
      </header>
      <div className={`onboarding-layout ${step === done ? "is-complete" : ""}`}>
        <div className="onboarding-container">
          {step < done && (
            <>
              <div
                className="onboarding-progress"
                aria-label={`Etapa ${step + 1} de ${steps.length}`}
              >
                {steps.map((label, index) => (
                  <div key={label} className={index <= step ? "active" : ""}>
                    <span>
                      {index < step ? (
                        <Check size={13} weight="bold" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <div className="onboarding-step-label">
                ETAPA {step + 1} DE {steps.length}
              </div>
            </>
          )}
          {step === 0 && (
            <>
              <h1>Qual é o seu negócio?</h1>
              <p className="onboarding-description">
                Usamos isso para montar sua página de agendamento.
              </p>
              <div className="onboarding-category-grid">
                {categories.map((item) => (
                  <button
                    key={item.name}
                    className={`onboarding-category ${category === item.name ? "selected" : ""}`}
                    onClick={() => setCategory(item.name)}
                    aria-pressed={category === item.name}
                  >
                    <span className="onboarding-category-icon">
                      <SegmentIcon category={item.name} size={26} />
                    </span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    {category === item.name && (
                      <Check
                        size={15}
                        weight="bold"
                        className="onboarding-category-check"
                      />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1>Como os clientes encontram você?</h1>
              <p className="onboarding-description">
                Nome, WhatsApp e endereço aparecem na sua página e no comprovante de cada agendamento.
              </p>
              <Card className="onboarding-form-card">
                <div className="management-form">
                  <FormField label="Nome do estabelecimento">
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Como seus clientes conhecem você?"
                      maxLength={100}
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Frase de apresentação" hint="Uma linha que diga o seu jeito. Aparece embaixo do nome.">
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Ex.: Corte, barba e cuidado sem pressa."
                      maxLength={140}
                    />
                  </FormField>
                  <div className="management-form-grid">
                    <FormField label="WhatsApp da loja">
                      <input
                        value={phone}
                        onChange={(event) => setPhone(formatPhone(event.target.value))}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(11) 99999-9999"
                      />
                    </FormField>
                    <FormField label="Instagram (opcional)">
                      <input
                        value={instagram}
                        onChange={(event) => setInstagram(event.target.value)}
                        placeholder="@suabarbearia"
                        maxLength={100}
                      />
                    </FormField>
                  </div>
                  <FormField label="Endereço completo" hint="Rua, número, bairro e cidade. Vira o mapa e a rota da sua página.">
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      autoComplete="street-address"
                      placeholder="Rua Augusta, 1420 · Consolação, São Paulo - SP"
                      maxLength={250}
                    />
                  </FormField>
                </div>
              </Card>
            </>
          )}
          {step === 2 && (
            <>
              <h1>A cara do seu espaço</h1>
              <p className="onboarding-description">
                Fotos reais vendem mais que qualquer texto. Capa, logo, cor e os trabalhos da casa.
              </p>
              <Card className="onboarding-form-card">
                <div className="management-form">
                  <ImageUpload
                    label="Foto de capa"
                    hint="Uma foto horizontal do seu espaço: fachada, recepção ou as cadeiras."
                    preset="cover"
                    shape="wide"
                    value={cover}
                    onChange={setCover}
                    emptyTitle="Adicionar foto de capa"
                    emptyText="Toque para escolher ou arraste uma foto"
                    onBusy={onBusy}
                  />
                  <ImageUpload
                    label="Logo (opcional)"
                    hint="PNG com fundo transparente fica ainda melhor."
                    preset="logo"
                    shape="square"
                    value={logo}
                    onChange={setLogo}
                    onBusy={onBusy}
                  />
                  <div className="onboarding-field">
                    <span className="onboarding-field-label">Cor dos botões</span>
                    <div className="onboarding-swatches" role="radiogroup" aria-label="Cor dos botões">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          role="radio"
                          aria-checked={color === preset.value}
                          className={color === preset.value ? "is-selected" : ""}
                          onClick={() => setColor(preset.value)}
                        >
                          <i style={{ background: preset.swatch }} />
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <GalleryUpload
                    label="Fotos dos trabalhos (opcional)"
                    hint="Cortes, barbas e o ambiente. Até 12 fotos; a primeira abre a galeria."
                    value={photos}
                    onChange={setPhotos}
                    max={12}
                    onBusy={onBusy}
                  />
                  <div className="onboarding-field">
                    <span className="onboarding-field-label">O que a casa oferece</span>
                    <div className="onboarding-chips">
                      {amenityOptions.map((item) => {
                        const on = amenities.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={on}
                            className={on ? "is-on" : ""}
                            onClick={() =>
                              setAmenities((current) =>
                                on ? current.filter((value) => value !== item) : [...current, item],
                              )
                            }
                          >
                            {on && <Check size={13} weight="bold" />}
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
          {step === 3 && (
            <>
              <h1>O que você faz de melhor?</h1>
              <p className="onboarding-description">
                Cadastre os serviços com foto e preço. Dá para colocar mais fotos e ampliar o catálogo depois.
              </p>
              <div className="onboarding-draft-list">
                {services.map((service, index) => {
                  const update = (patch: Partial<DraftService>) =>
                    setServices((current) =>
                      current.map((item) => (item.id === service.id ? { ...item, ...patch } : item)),
                    );
                  return (
                    <Card className="onboarding-draft-card" key={service.id}>
                      <div className="onboarding-draft-header">
                        <span>Serviço {index + 1}</span>
                        {services.length > 1 && (
                          <button
                            className="management-icon-button danger"
                            onClick={() =>
                              setServices((current) => current.filter((item) => item.id !== service.id))
                            }
                            aria-label={`Remover serviço ${index + 1}`}
                          >
                            <Trash size={17} weight="duotone" />
                          </button>
                        )}
                      </div>
                      <div className="onboarding-service-row">
                        <ImageUpload
                          label="Foto"
                          preset="service"
                          shape="square"
                          value={service.image}
                          onChange={(image) => update({ image })}
                          onBusy={onBusy}
                        />
                        <div className="management-form">
                          <FormField label="Nome">
                            <input
                              value={service.name}
                              placeholder="Ex.: Corte masculino"
                              onChange={(event) => update({ name: event.target.value })}
                              maxLength={100}
                            />
                          </FormField>
                          <div className="management-form-grid">
                            <FormField label="Duração (min)">
                              <input
                                type="number"
                                min={5}
                                max={480}
                                step={5}
                                value={service.duration}
                                onChange={(event) => update({ duration: event.target.value })}
                              />
                            </FormField>
                            <FormField label="Preço (R$)">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={service.price}
                                placeholder="45,00"
                                onChange={(event) => update({ price: event.target.value })}
                              />
                            </FormField>
                          </div>
                          <FormField label="Descrição (opcional)">
                            <input
                              value={service.description}
                              placeholder="Ex.: Máquina e tesoura, com lavagem e finalização."
                              onChange={(event) => update({ description: event.target.value })}
                              maxLength={200}
                            />
                          </FormField>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setServices((current) => [
                    ...current,
                    { id: crypto.randomUUID(), name: "", duration: "40", price: "", image: "", description: "" },
                  ])
                }
                disabled={services.length >= 30}
              >
                <Plus size={16} weight="bold" />
                Adicionar serviço
              </Button>
            </>
          )}
          {step === 4 && (
            <>
              <h1>Quem faz parte da equipe?</h1>
              <p className="onboarding-description">
                Com o WhatsApp de cada um, quem vai atender recebe um aviso a cada agendamento.
              </p>
              <Card className="onboarding-form-card">
                <div className="management-form">
                  {team.map((member, index) => {
                    const update = (patch: Partial<DraftMember>) =>
                      setTeam((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
                      );
                    return (
                      <div className="onboarding-member" key={index}>
                        <ImageUpload
                          label="Foto"
                          preset="person"
                          shape="round"
                          value={member.photo}
                          onChange={(photo) => update({ photo })}
                          onBusy={onBusy}
                        />
                        <div className="management-form-grid">
                          <FormField label={`Profissional ${index + 1}`}>
                            <input
                              value={member.name}
                              onChange={(event) => update({ name: event.target.value })}
                              placeholder="Nome completo"
                              maxLength={100}
                            />
                          </FormField>
                          <FormField label="WhatsApp (opcional)">
                            <input
                              value={member.phone}
                              onChange={(event) => update({ phone: formatPhone(event.target.value) })}
                              type="tel"
                              inputMode="tel"
                              placeholder="(11) 99999-9999"
                            />
                          </FormField>
                        </div>
                        {team.length > 1 && (
                          <button
                            className="management-icon-button danger"
                            onClick={() => setTeam((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            aria-label={`Remover profissional ${index + 1}`}
                          >
                            <Trash size={17} weight="duotone" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <Button
                    variant="secondary"
                    onClick={() => setTeam((current) => [...current, { name: "", phone: "", photo: "" }])}
                    disabled={team.length >= 30}
                  >
                    <Plus size={16} weight="bold" />
                    Adicionar profissional
                  </Button>
                  <p className="management-info">
                    Todos começam fazendo os serviços cadastrados. Especialidades, intervalos e comissões
                    se ajustam no painel.
                  </p>
                </div>
              </Card>
            </>
          )}
          {step === 5 && (
            <>
              <h1>Quando as portas estão abertas?</h1>
              <p className="onboarding-description">
                O expediente inicial vale para toda a equipe. Cada agenda pode
                ser personalizada depois.
              </p>
              <Card className="onboarding-form-card">
                <div className="management-form">
                  <div>
                    <h2 className="management-section-title">
                      Dias de funcionamento
                    </h2>
                    <DayPicker value={days} onChange={setDays} />
                  </div>
                  <div className="management-form-grid">
                    <FormField label="Abre às">
                      <input
                        type="time"
                        value={start}
                        onChange={(event) => setStart(event.target.value)}
                      />
                    </FormField>
                    <FormField label="Fecha às">
                      <input
                        type="time"
                        value={end}
                        onChange={(event) => setEnd(event.target.value)}
                      />
                    </FormField>
                  </div>
                  <div className="onboarding-summary">
                    <span>
                      <CalendarBlank size={19} weight="duotone" />
                    </span>
                    <div>
                      <strong>{name}</strong>
                      <p>
                        {category} • {services.length} {services.length === 1 ? "serviço" : "serviços"} •{" "}
                        {team.length} {team.length === 1 ? "profissional" : "profissionais"}
                      </p>
                      <p>
                        {days.map((day) => dayNames[day]).join(", ")} • {start}{" "}
                        às {end}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
          <FormError error={error} />
          {step < done && (
            <div className="onboarding-actions">
              {step > 0 ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setStep((previous) => previous - 1);
                    setError("");
                  }}
                >
                  <ArrowLeft size={16} weight="bold" />
                  Voltar
                </Button>
              ) : (
                <span />
              )}
              {step === last ? (
                <Button disabled={busy || uploading} onClick={() => void finish()}>
                  {busy ? (
                    <CircleNotch
                      size={16}
                      weight="bold"
                      className="management-spin"
                    />
                  ) : (
                    <Check size={16} weight="bold" />
                  )}
                  {busy ? "Preparando seu espaço..." : "Concluir configuração"}
                </Button>
              ) : (
                <Button onClick={continueStep} disabled={uploading}>
                  Continuar
                  <ArrowRight size={16} weight="bold" />
                </Button>
              )}
            </div>
          )}
          {step === done && (
            <div className="onboarding-success">
              <div className="onboarding-success-icon">
                <Check size={36} weight="bold" />
              </div>
              <span className="onboarding-step-label">
                BEM-VINDO AO SEU PRÓXIMO CAPÍTULO
              </span>
              <h1>Tudo pronto para receber seus primeiros agendamentos.</h1>
              <p className="onboarding-description">
                Compartilhe o link de {name} com seus clientes.
              </p>
              <Card className="onboarding-public-link">
                <span>SEU LINK PÚBLICO</span>
                <strong>/{slug}</strong>
                <button
                  onClick={() => void copy()}
                  className="management-link-button"
                >
                  <Copy size={16} weight="duotone" />
                  {copied ? "Copiado!" : "Copiar link"}
                </button>
              </Card>
              <div className="onboarding-success-actions">
                <Link href={`/${slug}`} className="management-link-button">
                  <ArrowSquareOut size={16} weight="bold" />
                  Ver página pública
                </Link>
                <Link href="/dashboard" className="onboarding-dashboard-link">
                  Ir para meu painel
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            </div>
          )}
          <footer className="onboarding-footer">
            StudioFlow · agenda online para barbearias e salões
          </footer>
        </div>
        {step < done && (
          <OnboardingPreview
            category={category}
            name={name}
            cover={cover}
            logo={logo}
            color={color}
            description={description}
            photos={photos}
            address={address}
            phone={phone}
            services={services}
            professionals={professionals}
            days={days}
            start={start}
            end={end}
          />
        )}
      </div>
    </main>
  );
}
