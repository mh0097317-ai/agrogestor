"use client";

import { ArrowRight, Check, Clock } from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Appointment, Slot } from "@/types";
import type { PublicCatalog } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
import {
  BookingHeader,
  BusyButton,
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
import { BookingSummary } from "./booking-summary";
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
  "Dados",
  "Pronto",
];
export function BookingProgress({
  step,
  onBack,
}: {
  step: number;
  onBack?: (step: number) => void;
}) {
  return (
    <nav className="booking-progress" aria-label="Etapas do agendamento">
      <ol>
        {bookingSteps.map((label, index) => (
          <li
            key={label}
            className={`${index + 1 === step ? "is-current" : ""} ${index + 1 < step ? "is-done" : ""}`}
          >
            <button
              onClick={() => onBack?.(index + 1)}
              disabled={!onBack || index + 1 >= step}
              aria-current={index + 1 === step ? "step" : undefined}
            >
              <span>
                {index + 1 < step ? (
                  <Check weight="bold" size={12} />
                ) : (
                  index + 1
                )}
              </span>
              <small>{label}</small>
            </button>
          </li>
        ))}
      </ol>
    </nav>
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
  function selectService(id: string) {
    haptic();
    if (id !== serviceId) {
      setServiceId(id);
      setSlot(undefined);
      setDate("");
      if (
        !services
          .find((item) => item.id === id)
          ?.professionalIds.includes(professionalId)
      )
        setProfessionalId("any");
    }
  }
  function selectProfessional(id: string) {
    haptic();
    if (id !== professionalId) {
      setProfessionalId(id);
      setSlot(undefined);
      setDate("");
    }
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
  const canContinue =
    step === 1
      ? !!service
      : step === 2
        ? !!service &&
          professionals.some(
            (person) =>
              person.active && service.professionalIds.includes(person.id),
          )
        : !!slot;
  return (
    <div className="booking-site">
      <BookingHeader
        slug={business.slug}
        businessName={business.name}
        photo={business.logo || business.cover}
        category={business.category}
        canBack={step > 1}
        busy={busy}
        onBack={() => changeStep(step - 1)}
      />
      <div className="booking-layout">
        <main className="booking-main">
          <BookingProgress step={step} onBack={busy ? undefined : changeStep} />
          <div
            key={step}
            className={`booking-screen is-${direction}`}
            ref={stepHeading}
          >
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
              />
            )}
            {error && step !== 4 && (
              <div className="booking-error" role="alert">
                {error}
              </div>
            )}
          </div>
        </main>
        <aside className="booking-aside">
          <BookingSummary
            service={service}
            professional={professional}
            slot={slot}
          />
        </aside>
      </div>
      {step < 4 && (
        <footer className="booking-bottom-bar">
          <div className="booking-bottom-inner">
            <div
              className="booking-bottom-selection"
              key={`${service?.id}-${step >= 3 ? professionalId : ""}-${slot?.start}`}
            >
              {service && (
                <PublicImage
                  src={service.image}
                  alt=""
                  className="booking-bottom-photo"
                />
              )}
              <div>
                <strong>{service?.name || "Escolha seu serviço"}</strong>
                <span>
                  {service && slot ? (
                    <>
                      {professional?.name.split(" ")[0]} <i>·</i>{" "}
                      {bookingDateLabel(slot.start, true).split(",")[0]},{" "}
                      {bookingTime(slot.start)}
                    </>
                  ) : service && step >= 3 && professional ? (
                    <>
                      com {professional.name.split(" ")[0]} <i>·</i>{" "}
                      {money(service.price)}
                    </>
                  ) : service ? (
                    <>
                      {durationLabel(service.duration)} <i>·</i>{" "}
                      {money(service.price)}
                    </>
                  ) : (
                    <>
                      <Clock weight="duotone" size={12} /> Escolha um serviço
                      para continuar
                    </>
                  )}
                </span>
              </div>
            </div>
            <BusyButton
              disabled={!canContinue}
              onClick={() => changeStep(step + 1)}
            >
              Continuar <ArrowRight weight="bold" size={17} />
            </BusyButton>
          </div>
        </footer>
      )}
    </div>
  );
}
