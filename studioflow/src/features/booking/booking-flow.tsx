"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Appointment, Slot } from "@/types";
import type { PublicCatalog } from "@/features/public/types";
import { durationLabel, money } from "@/lib/utils";
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
import { bookingTime } from "./date-format";
import { haptic } from "@/lib/haptic";

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
  const teamFor = (id: string) => {
    const chosen = services.find((item) => item.id === id);
    return professionals.filter(
      (person) => person.active && chosen?.professionalIds.includes(person.id),
    );
  };
  function selectService(id: string) {
    haptic();
    if (id === serviceId) return;
    const chosen = services.find((item) => item.id === id);
    setServiceId(id);
    setSlot(undefined);
    setDate("");
    if (!chosen?.professionalIds.includes(professionalId))
      setProfessionalId("any");
  }
  function selectProfessional(id: string) {
    haptic();
    if (id === professionalId) return;
    setProfessionalId(id);
    setSlot(undefined);
    setDate("");
  }
  function next() {
    if (step === 1) {
      // A single professional needs no choice: go straight to the times.
      const team = teamFor(serviceId);
      if (team.length === 1) {
        if (professionalId !== team[0].id) {
          setProfessionalId(team[0].id);
          setSlot(undefined);
          setDate("");
        }
        changeStep(3);
      } else changeStep(2);
    } else changeStep(step + 1);
  }
  function back() {
    if (step === 3 && teamFor(serviceId).length === 1) changeStep(1);
    else changeStep(step - 1);
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
    (step === 1 && !!service) || (step === 2 && !!service) || !!slot;
  const showBar = step <= 3 && !!service;
  const slotDay = slot
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(slot.start))
    : "";
  return (
    <BookingChrome
      business={business}
      step={step}
      onBack={step > 1 ? back : undefined}
      onStep={busy ? undefined : changeStep}
      backDisabled={busy}
      after={
        <div
          className={`bk-bar ${showBar ? "is-visible" : ""}`}
          aria-hidden={!showBar}
        >
          {service && (
            <div className="bk-bar-inner">
              <PublicImage
                src={service.image}
                alt=""
                className="bk-bar-photo"
                segment={service.category}
              />
              <div className="bk-bar-text" key={`${service.id}-${slot?.start}`}>
                <strong>{service.name}</strong>
                <span>
                  {step === 3 && slot
                    ? `${slotDay.charAt(0).toUpperCase()}${slotDay.slice(1).replace(".", "")} às ${bookingTime(slot.start)}`
                    : `${durationLabel(service.duration)} • ${money(service.price)}`}
                </span>
              </div>
              <button
                type="button"
                className="bk-bar-button sf-sheen"
                disabled={!canContinue || busy}
                tabIndex={showBar ? 0 : -1}
                onClick={next}
              >
                Continuar <ArrowRight weight="bold" size={17} />
              </button>
            </div>
          )}
        </div>
      }
    >
      <div
        key={step}
        className={`bk-screen is-${direction}`}
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
            onEdit={changeStep}
          />
        )}
        {error && step !== 4 && (
          <div className="bk-alert" role="alert">
            <p>{error}</p>
          </div>
        )}
      </div>
    </BookingChrome>
  );
}
