"use client";

import {
  ArrowRight,
  PencilSimple,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Appointment, Slot } from "@/types";
import type { PublicCatalog } from "@/features/public/types";
import { money } from "@/lib/utils";
import {
  PublicError,
  PublicImage,
  PublicLoading,
  PublicRefreshNotice,
} from "@/features/public/public-ui";
import {
  publicRequest,
  usePublicCatalog,
} from "@/features/public/use-public-catalog";
import { ServiceStep, ProfessionalStep } from "./selection-steps";
import { DateStep } from "./date-step";
import { BookingChrome } from "./booking-chrome";
import { CustomerStep, type CustomerFields } from "./customer-step";
import { bookingDateLabel, bookingTime } from "./date-format";
import { haptic } from "@/lib/haptic";
import "@/features/public/public.css";
import "./booking-layout.css";
import "./booking-selection.css";
import "./booking-scheduling.css";
import "./booking-summary.css";
import "./booking-confirmation.css";
import "./booking-responsive.css";
import "./booking-v2.css";

const rememberKey = "studioflow:customer";
type RememberedCustomer = Omit<CustomerFields, "reminder"> & {
  reminder?: boolean;
};
function readRememberedCustomer(): RememberedCustomer | null {
  try {
    const value = JSON.parse(localStorage.getItem(rememberKey) || "null");
    return value && typeof value.name === "string" && value.name ? value : null;
  } catch {
    return null;
  }
}

export const bookingSteps = [
  "Serviço",
  "Profissional",
  "Horário",
  "Seus dados",
];
export function BookingProgress({ step }: { step: number; onBack?: unknown }) {
  const current = Math.min(step, bookingSteps.length);
  const done = step > bookingSteps.length;
  return (
    <div
      className={`bk-progress ${done ? "is-done" : ""}`}
      role="progressbar"
      aria-label="Etapas do agendamento"
      aria-valuemin={1}
      aria-valuemax={bookingSteps.length}
      aria-valuenow={current}
    >
      <div className="bk-progress-bars">
        {bookingSteps.map((label, index) => (
          <span
            key={label}
            className={
              index + 1 < step || done
                ? "is-done"
                : index + 1 === step
                  ? "is-current"
                  : ""
            }
          />
        ))}
      </div>
      <p>
        <span>
          {done ? "Tudo certo" : `Etapa ${current} de ${bookingSteps.length}`}
        </span>
        <strong>
          {done ? "Horário reservado" : bookingSteps[current - 1]}
        </strong>
      </p>
    </div>
  );
}

export function BookingFlow({ slug }: { slug: string }) {
  const { catalog, loading, error, reload } = usePublicCatalog(slug);
  const query = useSearchParams();
  if (loading && !catalog) return <PublicLoading />;
  if (!catalog)
    return (
      <PublicError
        message={error || "Estabelecimento indisponível."}
        retry={reload}
      />
    );
  return (
    <>
      <PublicRefreshNotice error={error} refreshing={loading} retry={reload} />
      <BookingWizard
        catalog={catalog}
        initialService={query.get("service") || ""}
        initialProfessional={query.get("professional") || "any"}
      />
    </>
  );
}

function BookingWizard({
  catalog,
  initialService,
  initialProfessional,
}: {
  catalog: PublicCatalog;
  initialService: string;
  initialProfessional: string;
}) {
  const router = useRouter();
  const { business, services, professionals, settings } = catalog;
  const validInitialService = services.find(
    (service) => service.id === initialService && service.active,
  );
  const [step, setStep] = useState(validInitialService ? 2 : 1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [serviceId, setServiceId] = useState(validInitialService?.id || "");
  const [professionalId, setProfessionalId] = useState(
    professionals.some(
      (person) =>
        person.id === initialProfessional &&
        person.active &&
        (!validInitialService ||
          validInitialService.professionalIds.includes(person.id)),
    )
      ? initialProfessional
      : "any",
  );
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<Slot>();
  // The wizard only renders on the client (after the catalog loads), so
  // reading the device-stored customer here is safe.
  const [remembered, setRemembered] = useState(readRememberedCustomer);
  const [customer, setCustomer] = useState<CustomerFields>({
    name: remembered?.name || "",
    phone: remembered?.phone || "",
    email: remembered?.email || "",
    reminder: remembered?.reminder ?? false,
  });
  function forgetCustomer() {
    try {
      localStorage.removeItem(rememberKey);
    } catch {
      // Storage unavailable: nothing to forget.
    }
    setRemembered(null);
    setCustomer({ name: "", phone: "", email: "", reminder: false });
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stepHeading = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step)
      stepHeading.current
        ?.querySelector<HTMLHeadingElement>("h1")
        ?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step]);
  const service = services.find((item) => item.id === serviceId);
  const professional = professionals.find(
    (person) => person.id === (slot?.professionalId || professionalId),
  );
  function changeStep(next: number) {
    setDirection(next > step ? "forward" : "back");
    setStep(next);
    setError("");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const advance = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(advance.current), []);
  /** Let the selection animation play, then move on. */
  function advanceTo(next: number) {
    window.clearTimeout(advance.current);
    advance.current = window.setTimeout(() => changeStep(next), 280);
  }
  function selectService(id: string) {
    haptic();
    const chosen = services.find((item) => item.id === id);
    const team = professionals.filter(
      (person) => person.active && chosen?.professionalIds.includes(person.id),
    );
    if (id !== serviceId) {
      setServiceId(id);
      setSlot(undefined);
      setDate("");
      if (!chosen?.professionalIds.includes(professionalId))
        setProfessionalId("any");
    }
    // A single professional needs no choice: go straight to the times.
    if (team.length === 1) {
      setProfessionalId(team[0].id);
      advanceTo(3);
    } else advanceTo(2);
  }
  function selectProfessional(id: string) {
    haptic();
    if (id !== professionalId) {
      setProfessionalId(id);
      setSlot(undefined);
      setDate("");
    }
    advanceTo(3);
  }
  async function submit(values: CustomerFields) {
    if (!service || !slot) return;
    setCustomer(values);
    setBusy(true);
    setError("");
    try {
      const appointment = await publicRequest<Appointment>(
        `/api/public/${business.slug}/book`,
        {
          method: "POST",
          body: JSON.stringify({
            serviceIds: [service.id],
            professionalId: slot.professionalId,
            start: slot.start,
            ...values,
          }),
        },
      );
      if (!appointment.token)
        throw new Error(
          "Seu agendamento foi recebido, mas o link de confirmação não está disponível. Entre em contato com o estabelecimento.",
        );
      try {
        localStorage.setItem(
          rememberKey,
          JSON.stringify({
            name: values.name,
            phone: values.phone,
            email: values.email,
            reminder: values.reminder,
          }),
        );
      } catch {
        // Remembering is optional.
      }
      router.replace(`/booking/${appointment.token}`);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Não foi possível confirmar seu horário.";
      setError(message);
      if (/dispon|ocupado|conflito|reservad/i.test(message)) {
        setSlot(undefined);
        changeStep(3);
        setError(
          /escolha outro horário/i.test(message)
            ? message
            : `${message} Escolha outro horário.`,
        );
      }
      setBusy(false);
    }
  }
  const team = service
    ? professionals.filter(
        (person) =>
          person.active && service.professionalIds.includes(person.id),
      )
    : [];
  const chosenPerson = professionals.find(
    (person) => person.id === professionalId,
  );
  return (
    <BookingChrome
      business={business}
      onBack={step > 1 ? () => changeStep(step - 1) : undefined}
      backDisabled={busy}
      after={
        <div
          className={`bk-cta ${step === 3 && slot ? "is-visible" : ""}`}
          aria-hidden={!(step === 3 && slot)}
        >
          {slot && service && (
            <div className="bk-cta-inner" key={slot.start}>
              <div>
                <strong>
                  {bookingDateLabel(slot.start, true).split(",")[0]},{" "}
                  {bookingTime(slot.start)}
                </strong>
                <span>
                  {professional?.name.split(" ")[0]} · {money(service.price)}
                </span>
              </div>
              <button
                type="button"
                className="public-button sf-sheen"
                tabIndex={step === 3 ? 0 : -1}
                onClick={() => changeStep(4)}
              >
                Continuar <ArrowRight weight="bold" size={17} />
              </button>
            </div>
          )}
        </div>
      }
    >
      <BookingProgress step={step} />
      {step > 1 && step < 4 && service && (
        <nav className="bk-picks" aria-label="Suas escolhas">
          <button type="button" onClick={() => changeStep(1)} disabled={busy}>
            <PublicImage
              src={service.image}
              alt=""
              className="bk-pick-photo"
              segment={service.category}
            />
            <span>
              <small>Serviço</small>
              <strong>{service.name}</strong>
            </span>
            <PencilSimple weight="bold" size={13} />
          </button>
          {step === 3 && team.length > 1 && (
            <button type="button" onClick={() => changeStep(2)} disabled={busy}>
              {chosenPerson ? (
                <PublicImage
                  src={chosenPerson.photo}
                  alt=""
                  className="bk-pick-photo is-round"
                  fallbackName={chosenPerson.name}
                />
              ) : (
                <span className="bk-pick-icon">
                  <Sparkle weight="fill" size={14} />
                </span>
              )}
              <span>
                <small>Profissional</small>
                <strong>
                  {chosenPerson?.name.split(" ")[0] || "Sem preferência"}
                </strong>
              </span>
              <PencilSimple weight="bold" size={13} />
            </button>
          )}
        </nav>
      )}
      <div key={step} className={`bk-screen is-${direction}`} ref={stepHeading}>
        {step === 1 && (
          <ServiceStep
            services={services}
            selectedId={serviceId}
            onSelect={selectService}
          />
        )}
        {step === 2 && service && (
          <ProfessionalStep
            slug={business.slug}
            professionals={professionals}
            service={service}
            selectedId={professionalId}
            onSelect={selectProfessional}
          />
        )}
        {step === 3 && service && (
          <DateStep
            slug={business.slug}
            serviceId={service.id}
            professionalId={professionalId}
            settings={settings}
            selectedDate={date}
            selectedSlot={slot}
            onDate={setDate}
            onSlot={(value) => {
              if (value) haptic();
              setSlot(value);
            }}
          />
        )}
        {step === 4 && service && slot && (
          <CustomerStep
            key={remembered ? "remembered" : "new"}
            welcomeName={remembered?.name.split(" ")[0]}
            onForget={forgetCustomer}
            service={service}
            professional={professional}
            slot={slot}
            defaults={customer}
            busy={busy}
            error={error}
            onSubmit={submit}
            onChange={setCustomer}
            onEdit={changeStep}
          />
        )}
        {error && step !== 4 && (
          <div className="booking-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </BookingChrome>
  );
}
