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
import { ImageUpload } from "@/components/image-upload";
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
const steps = ["Negócio", "Identidade", "Serviços", "Equipe", "Horários"];
type DraftService = {
  id: string;
  name: string;
  duration: string;
  price: string;
};

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("Barbearia");
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");
  const [uploading, setUploading] = useState(false);
  const [services, setServices] = useState<DraftService[]>([
    { id: "first", name: "", duration: "40", price: "" },
  ]);
  const [professionals, setProfessionals] = useState<string[]>([""]);
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("19:00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);
  function continueStep() {
    setError("");
    if (
      step === 1 &&
      (name.trim().length < 3 || (cover && !storedImagePattern.test(cover)))
    ) {
      setError("Informe um nome com pelo menos 3 letras.");
      return;
    }
    if (
      step === 2 &&
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
    ) {
      setError(
        "Revise seus serviços. Nome obrigatório, duração de 5 a 480 minutos e preço a partir de R$ 0.",
      );
      return;
    }
    if (
      step === 3 &&
      professionals.some((professional) => professional.trim().length < 3)
    ) {
      setError(
        "Informe o nome de cada profissional, incluindo você se também realiza atendimentos.",
      );
      return;
    }
    if (
      step === 3 &&
      new Set(
        professionals.map((professional) => professional.trim().toLowerCase()),
      ).size !== professionals.length
    ) {
      setError("Os nomes dos profissionais não podem se repetir.");
      return;
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
          services: services.map((service) => ({
            name: service.name.trim(),
            duration: Number(service.duration),
            price: Number(service.price),
          })),
          professionalNames: professionals.map((professional) =>
            professional.trim(),
          ),
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
      setStep(5);
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
      <div className={`onboarding-layout ${step === 5 ? "is-complete" : ""}`}>
        <div className="onboarding-container">
          {step < 5 && (
            <>
              <div
                className="onboarding-progress"
                aria-label={`Etapa ${step + 1} de 5`}
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
              <div className="onboarding-step-label">ETAPA {step + 1} DE 5</div>
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
              <h1>Como se chama seu estabelecimento?</h1>
              <p className="onboarding-description">
                Sua capa é o primeiro convite. A logo pode vir depois.
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
                  <ImageUpload
                    label="Foto de capa (opcional)"
                    hint="Uma foto horizontal do seu espaço funciona muito bem. Dá para trocar depois."
                    preset="cover"
                    shape="wide"
                    value={cover}
                    onChange={setCover}
                    emptyTitle="Adicionar foto de capa"
                    emptyText="A fachada, a recepção ou as cadeiras do seu espaço"
                    onBusy={setUploading}
                  />
                </div>
              </Card>
            </>
          )}
          {step === 2 && (
            <>
              <h1>O que você faz de melhor?</h1>
              <p className="onboarding-description">
                Cadastre os primeiros serviços. Você pode ampliar o catálogo
                depois.
              </p>
              <div className="onboarding-draft-list">
                {services.map((service, index) => (
                  <Card className="onboarding-draft-card" key={service.id}>
                    <div className="onboarding-draft-header">
                      <span>Serviço {index + 1}</span>
                      {services.length > 1 && (
                        <button
                          className="management-icon-button danger"
                          onClick={() =>
                            setServices((current) =>
                              current.filter((item) => item.id !== service.id),
                            )
                          }
                          aria-label={`Remover serviço ${index + 1}`}
                        >
                          <Trash size={17} weight="duotone" />
                        </button>
                      )}
                    </div>
                    <div className="management-form">
                      <FormField label="Nome">
                        <input
                          value={service.name}
                          placeholder="Ex.: Corte masculino"
                          onChange={(event) =>
                            setServices((current) =>
                              current.map((item) =>
                                item.id === service.id
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            )
                          }
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
                            onChange={(event) =>
                              setServices((current) =>
                                current.map((item) =>
                                  item.id === service.id
                                    ? { ...item, duration: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </FormField>
                        <FormField label="Preço (R$)">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={service.price}
                            placeholder="45,00"
                            onChange={(event) =>
                              setServices((current) =>
                                current.map((item) =>
                                  item.id === service.id
                                    ? { ...item, price: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </FormField>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setServices((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      duration: "40",
                      price: "",
                    },
                  ])
                }
                disabled={services.length >= 30}
              >
                <Plus size={16} weight="bold" />
                Adicionar serviço
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <h1>Quem faz parte da equipe?</h1>
              <p className="onboarding-description">
                Se você trabalha sozinho, inclua apenas seu nome.
              </p>
              <Card className="onboarding-form-card">
                <div className="management-form">
                  {professionals.map((professional, index) => (
                    <div className="onboarding-team-row" key={index}>
                      <FormField label={`Profissional ${index + 1}`}>
                        <input
                          value={professional}
                          onChange={(event) =>
                            setProfessionals((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? event.target.value : item,
                              ),
                            )
                          }
                          placeholder="Nome completo"
                          maxLength={100}
                        />
                      </FormField>
                      {professionals.length > 1 && (
                        <button
                          className="management-icon-button danger"
                          onClick={() =>
                            setProfessionals((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          aria-label={`Remover profissional ${index + 1}`}
                        >
                          <Trash size={17} weight="duotone" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setProfessionals((current) => [...current, ""])
                    }
                    disabled={professionals.length >= 30}
                  >
                    <Plus size={16} weight="bold" />
                    Adicionar profissional
                  </Button>
                  <p className="management-info">
                    Inicialmente, todos poderão realizar os serviços
                    cadastrados. Especialidades, intervalos e comissões podem
                    ser ajustados no painel.
                  </p>
                </div>
              </Card>
            </>
          )}
          {step === 4 && (
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
                        {category} • {services.length} serviços •{" "}
                        {professionals.length} profissionais
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
          {step < 5 && (
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
              {step === 4 ? (
                <Button disabled={busy} onClick={() => void finish()}>
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
          {step === 5 && (
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
        {step < 5 && (
          <OnboardingPreview
            category={category}
            name={name}
            cover={cover}
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
