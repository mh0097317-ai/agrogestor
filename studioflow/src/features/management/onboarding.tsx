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
  Gift,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import { Button, Card } from "@/components/ui";
import { Brand } from "@/components/brand";
import { FormField, FormError, DayPicker, dayNames } from "./shared";
import { OnboardingPreview } from "./onboarding-preview";
import { formatPhone } from "@/lib/utils";
import "./onboarding.css";
import "./onboarding-preview.css";

/*
 * Cadastro curto: só o que a página de agendamento precisa para abrir.
 * Foto de capa, logo, cor, galeria e o resto ficam em Configurações,
 * com a loja já no ar.
 */
const categories = [
  "Barbearia",
  "Salão de beleza",
  "Cabeleireiro",
  "Nail designer",
  "Lash designer",
  "Estética",
  "Profissional autônomo",
  "Outro",
];
type Suggestion = [name: string, duration: number];
const suggestions: Record<string, Suggestion[]> = {
  Barbearia: [
    ["Corte", 40],
    ["Barba", 30],
    ["Corte + barba", 60],
  ],
  "Salão de beleza": [
    ["Corte feminino", 60],
    ["Escova", 45],
    ["Manicure", 40],
  ],
  Cabeleireiro: [
    ["Corte", 45],
    ["Escova", 45],
    ["Coloração", 120],
  ],
  "Nail designer": [
    ["Alongamento em gel", 120],
    ["Manutenção", 90],
    ["Esmaltação em gel", 60],
  ],
  "Lash designer": [
    ["Extensão de cílios", 120],
    ["Manutenção", 75],
    ["Lash lifting", 60],
  ],
  Estética: [
    ["Limpeza de pele", 60],
    ["Massagem relaxante", 60],
    ["Design de sobrancelha", 30],
  ],
};
const steps = ["Sua loja", "Serviços", "Equipe e horário"];
const last = steps.length - 1;
const done = steps.length;
type DraftService = {
  id: string;
  name: string;
  duration: string;
  price: string;
};
type DraftMember = { name: string; phone: string };
const phoneOk = (value: string) =>
  /^[1-9][0-9]{9,10}$/.test(value.replace(/\D/g, ""));
const priceOf = (value: string) => Number(value.replace(",", "."));
const suggested = (category: string): DraftService[] =>
  (suggestions[category] || [["", 40] as Suggestion]).map(
    ([name, duration], index) => ({
      id: `${category}-${index}`,
      name,
      duration: String(duration),
      price: "",
    }),
  );

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("Barbearia");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [services, setServices] = useState<DraftService[]>(() =>
    suggested("Barbearia"),
  );
  // Trocar o tipo de negócio troca as sugestões, até o dono mexer nelas.
  const [servicesTouched, setServicesTouched] = useState(false);
  const [team, setTeam] = useState<DraftMember[]>([{ name: "", phone: "" }]);
  const professionals = team.map((member) => member.name);
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("19:00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [trialUntil, setTrialUntil] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function chooseCategory(next: string) {
    setCategory(next);
    if (!servicesTouched) setServices(suggested(next));
  }
  function editServices(change: (current: DraftService[]) => DraftService[]) {
    setServicesTouched(true);
    setError("");
    setServices(change);
  }
  function continueStep() {
    setError("");
    if (step === 0) {
      if (name.trim().length < 3)
        return setError("Informe o nome da loja, com pelo menos 3 letras.");
      if (!phoneOk(phone))
        return setError(
          "Informe o WhatsApp da loja com DDD. É por ele que os clientes falam com você.",
        );
      if (address.trim().length < 8)
        return setError("Informe o endereço: rua, número, bairro e cidade.");
    }
    if (step === 1) {
      if (!services.length) return setError("Cadastre pelo menos um serviço.");
      const wrong = services.find(
        (service) =>
          service.name.trim().length < 2 ||
          !Number.isInteger(Number(service.duration)) ||
          Number(service.duration) < 5 ||
          Number(service.duration) > 480 ||
          service.price === "" ||
          !Number.isFinite(priceOf(service.price)) ||
          priceOf(service.price) < 0,
      );
      if (wrong)
        return setError(
          wrong.name.trim().length >= 2 && wrong.price === ""
            ? `Coloque o preço de "${wrong.name.trim()}".`
            : "Confira os serviços: nome, duração de 5 a 480 minutos e preço.",
        );
      if (
        new Set(services.map((service) => service.name.trim().toLowerCase()))
          .size !== services.length
      )
        return setError("Os nomes dos serviços não podem se repetir.");
    }
    setStep((previous) => previous + 1);
  }
  async function finish() {
    setError("");
    if (team.some((member) => member.name.trim().length < 2))
      return setError(
        "Informe o nome de cada profissional, incluindo você se também atende.",
      );
    if (
      new Set(team.map((member) => member.name.trim().toLowerCase())).size !==
      team.length
    )
      return setError("Os nomes dos profissionais não podem se repetir.");
    if (team.some((member) => member.phone && !phoneOk(member.phone)))
      return setError(
        "Confira o WhatsApp dos profissionais (com DDD) ou deixe em branco.",
      );
    if (!days.length || !start || !end || start >= end)
      return setError("Escolha ao menos um dia e um horário válido.");
    setBusy(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
          address: address.trim(),
          services: services.map((service) => ({
            name: service.name.trim(),
            duration: Number(service.duration),
            price: priceOf(service.price),
          })),
          professionalNames: team.map((member) => member.name.trim()),
          team: team.map((member) => ({
            name: member.name.trim(),
            phone: member.phone.replace(/\D/g, ""),
            photo: "",
          })),
          openDays: days,
          openStart: start,
          openEnd: end,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error ?? "Não foi possível criar sua loja.");
      if (!result.slug)
        throw new Error("O link da loja não voltou. Tente novamente.");
      setSlug(result.slug);
      setTrialUntil(result.trialUntil ?? null);
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
      setError("Abra a página da loja e copie o endereço pelo navegador.");
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link href="/" className="onboarding-brand" aria-label="StudioFlow">
          <Brand size={34} animated />
        </Link>
        <span className="onboarding-header-note">Leva uns 2 minutos.</span>
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
                      {index < step ? <Check size={13} weight="bold" /> : index + 1}
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
              <h1>Vamos colocar sua loja no ar</h1>
              <p className="onboarding-description">
                Nome, WhatsApp e endereço aparecem na sua página de agendamento e
                no comprovante do cliente.
              </p>
              <Card className="onboarding-form-card">
                <div className="management-form">
                  <div className="onboarding-field">
                    <span className="onboarding-field-label">Tipo de negócio</span>
                    <div
                      className="onboarding-chips"
                      role="radiogroup"
                      aria-label="Tipo de negócio"
                    >
                      {categories.map((item) => (
                        <button
                          key={item}
                          type="button"
                          role="radio"
                          aria-checked={category === item}
                          className={category === item ? "is-on" : ""}
                          onClick={() => chooseCategory(item)}
                        >
                          {category === item && <Check size={13} weight="bold" />}
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FormField label="Nome da loja">
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ex.: Barbearia do Zé"
                      maxLength={100}
                      autoFocus
                    />
                  </FormField>
                  <FormField
                    label="WhatsApp da loja"
                    hint="O número que seus clientes já usam para marcar."
                  >
                    <input
                      value={phone}
                      onChange={(event) => setPhone(formatPhone(event.target.value))}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(11) 99999-9999"
                    />
                  </FormField>
                  <FormField
                    label="Endereço"
                    hint="Rua, número, bairro e cidade. Vira o mapa da sua página."
                  >
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
          {step === 1 && (
            <>
              <h1>O que você faz e quanto cobra?</h1>
              <p className="onboarding-description">
                Já deixamos os mais comuns. Ajuste o nome e o tempo e coloque o
                preço. Fotos e descrição você põe depois.
              </p>
              <Card className="onboarding-form-card">
                <div className="onboarding-quick-list">
                  {services.map((service, index) => {
                    const update = (patch: Partial<DraftService>) =>
                      editServices((current) =>
                        current.map((item) =>
                          item.id === service.id ? { ...item, ...patch } : item,
                        ),
                      );
                    return (
                      <div className="onboarding-quick-row" key={service.id}>
                        <input
                          value={service.name}
                          placeholder="Ex.: Corte"
                          aria-label={`Nome do serviço ${index + 1}`}
                          onChange={(event) => update({ name: event.target.value })}
                          maxLength={100}
                        />
                        <span className="onboarding-quick-cell is-suffix" data-unit="min">
                          <input
                            type="number"
                            min={5}
                            max={480}
                            step={5}
                            inputMode="numeric"
                            aria-label={`Minutos do serviço ${index + 1}`}
                            value={service.duration}
                            onChange={(event) => update({ duration: event.target.value })}
                          />
                        </span>
                        <span className="onboarding-quick-cell is-prefix" data-unit="R$">
                          <input
                            inputMode="decimal"
                            aria-label={`Preço do serviço ${index + 1}`}
                            value={service.price}
                            placeholder="0,00"
                            onChange={(event) =>
                              update({
                                price: event.target.value.replace(/[^0-9.,]/g, ""),
                              })
                            }
                          />
                        </span>
                        <button
                          type="button"
                          className="management-icon-button danger"
                          disabled={services.length === 1}
                          onClick={() =>
                            editServices((current) =>
                              current.filter((item) => item.id !== service.id),
                            )
                          }
                          aria-label={`Remover serviço ${index + 1}`}
                        >
                          <Trash size={17} weight="duotone" />
                        </button>
                      </div>
                    );
                  })}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      editServices((current) => [
                        ...current,
                        { id: crypto.randomUUID(), name: "", duration: "40", price: "" },
                      ])
                    }
                    disabled={services.length >= 30}
                  >
                    <Plus size={16} weight="bold" />
                    Adicionar serviço
                  </Button>
                </div>
              </Card>
            </>
          )}
          {step === 2 && (
            <>
              <h1>Quem atende e quando?</h1>
              <p className="onboarding-description">
                Coloque você e quem trabalha com você. Com o WhatsApp, cada um
                recebe aviso dos próprios horários.
              </p>
              <Card className="onboarding-form-card">
                <div className="management-form">
                  <div className="onboarding-quick-list">
                    {team.map((member, index) => {
                      const update = (patch: Partial<DraftMember>) =>
                        setTeam((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, ...patch } : item,
                          ),
                        );
                      return (
                        <div className="onboarding-quick-row is-member" key={index}>
                          <input
                            value={member.name}
                            onChange={(event) => update({ name: event.target.value })}
                            placeholder={index ? "Nome do profissional" : "Seu nome"}
                            aria-label={`Nome do profissional ${index + 1}`}
                            maxLength={100}
                          />
                          <input
                            value={member.phone}
                            onChange={(event) =>
                              update({ phone: formatPhone(event.target.value) })
                            }
                            type="tel"
                            inputMode="tel"
                            placeholder="WhatsApp (opcional)"
                            aria-label={`WhatsApp do profissional ${index + 1}`}
                          />
                          <button
                            type="button"
                            className="management-icon-button danger"
                            disabled={team.length === 1}
                            onClick={() =>
                              setTeam((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                            aria-label={`Remover profissional ${index + 1}`}
                          >
                            <Trash size={17} weight="duotone" />
                          </button>
                        </div>
                      );
                    })}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setTeam((current) => [...current, { name: "", phone: "" }])
                      }
                      disabled={team.length >= 30}
                    >
                      <Plus size={16} weight="bold" />
                      Adicionar profissional
                    </Button>
                  </div>
                  <div>
                    <h2 className="management-section-title">Dias abertos</h2>
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
                        {category} • {services.length}{" "}
                        {services.length === 1 ? "serviço" : "serviços"} •{" "}
                        {team.length}{" "}
                        {team.length === 1 ? "profissional" : "profissionais"}
                      </p>
                      <p>
                        {days.map((day) => dayNames[day]).join(", ")} • {start} às{" "}
                        {end}
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
                <Button disabled={busy} onClick={() => void finish()}>
                  {busy ? (
                    <CircleNotch size={16} weight="bold" className="management-spin" />
                  ) : (
                    <Check size={16} weight="bold" />
                  )}
                  {busy ? "Criando sua loja..." : "Criar minha loja"}
                </Button>
              ) : (
                <Button onClick={continueStep}>
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
              <span className="onboarding-step-label">SUA LOJA ESTÁ NO AR</span>
              <h1>Pronto para receber os primeiros agendamentos.</h1>
              {trialUntil ? (
                <p className="onboarding-trial">
                  <Gift size={18} weight="duotone" />
                  Teste grátis liberado até{" "}
                  {format(new Date(trialUntil), "dd/MM/yyyy")}.
                </p>
              ) : (
                <p className="onboarding-description">
                  Compartilhe o link de {name} com seus clientes.
                </p>
              )}
              <Card className="onboarding-public-link">
                <span>SEU LINK DE AGENDAMENTO</span>
                <strong>/{slug}</strong>
                <button onClick={() => void copy()} className="management-link-button">
                  <Copy size={16} weight="duotone" />
                  {copied ? "Copiado!" : "Copiar link"}
                </button>
              </Card>
              <ol className="onboarding-next">
                <li>
                  <strong>Deixe a página com a sua cara</strong>
                  <span>Foto de capa, logo e fotos dos cortes em Configurações.</span>
                </li>
                <li>
                  <strong>Conecte o WhatsApp da loja</strong>
                  <span>
                    Lembretes automáticos e a recepcionista respondendo por você.
                  </span>
                </li>
                <li>
                  <strong>Mande o link para os clientes</strong>
                  <span>No status, na bio do Instagram e nas conversas.</span>
                </li>
              </ol>
              <div className="onboarding-success-actions">
                <Link href={`/${slug}`} className="management-link-button">
                  <ArrowSquareOut size={16} weight="bold" />
                  Ver minha página
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
            quick
            category={category}
            name={name}
            cover=""
            address={address}
            phone={phone}
            services={services.map((service) => ({
              ...service,
              price: service.price === "" ? "" : String(priceOf(service.price)),
            }))}
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
