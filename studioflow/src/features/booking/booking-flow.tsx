"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Appointment, Slot } from "@/types";
import type { PublicCatalog } from "@/features/public/types";
import { durationLabel } from "@/lib/utils";
import {
  PublicError,
  PublicImage,
  PublicRefreshNotice,
} from "@/features/public/public-ui";
import {
  BookingIntro,
  BookingLoader,
  markIntroSeen,
  shouldPlayIntro,
  type IntroPhase,
} from "./booking-intro";
import {
  publicRequest,
  usePublicCatalog,
} from "@/features/public/use-public-catalog";
import { ServiceStep, ProfessionalStep } from "./selection-steps";
import { DateStep } from "./date-step";
import { BookingChrome } from "./booking-chrome";
import { CustomerStep, type CustomerFields } from "./customer-step";
import { bookingTime } from "./date-format";
import { servicesSummary } from "./booking-summary";
import { flyTo, RollingMoney } from "./motion";
import { BarberCut, markCutSeen, shouldPlayCut } from "./barber-cut";
import { haptic } from "@/lib/haptic";
import { saveLastBooking } from "@/lib/last-booking";
import { depositFor } from "@/lib/payments";
import {
  clubCoverage,
  useClubToken,
  useMembership,
} from "@/features/public/club";

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
  // Decided once in the browser (the flow only renders client-side).
  const [intro, setIntro] = useState<IntroPhase>(() =>
    shouldPlayIntro(slug) ? "on" : "off",
  );
  useEffect(() => {
    if (intro !== "off") markIntroSeen(slug);
  }, [intro, slug]);
  if (loading && !catalog) return <BookingLoader />;
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
        initialServices={(query.get("service") || "")
          .split(",")
          .filter(Boolean)}
        initialProfessional={query.get("professional") || "any"}
        revealed={intro !== "on"}
      />
      <BookingIntro
        business={catalog.business}
        phase={intro}
        onPhase={setIntro}
      />
    </>
  );
}

function BookingWizard({
  catalog,
  initialServices,
  initialProfessional,
  revealed,
}: {
  catalog: PublicCatalog;
  initialServices: string[];
  initialProfessional: string;
  /** False while the opening covers the screen. */
  revealed: boolean;
}) {
  const router = useRouter();
  const { business, services, professionals, settings } = catalog;
  const teamFor = (ids: string[]) =>
    professionals.filter(
      (person) =>
        person.active &&
        ids.every((id) =>
          services
            .find((item) => item.id === id)
            ?.professionalIds.includes(person.id),
        ),
    );
  // Services from a link (?service=a,b) that exist and can be done together.
  const validInitial = (() => {
    const ids = initialServices
      .filter((id) =>
        services.some((service) => service.id === id && service.active),
      )
      .slice(0, 8);
    return ids.length && teamFor(ids).length ? ids : [];
  })();
  const [step, setStep] = useState(validInitial.length ? 2 : 1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [serviceIds, setServiceIds] = useState<string[]>(validInitial);
  const [professionalId, setProfessionalId] = useState(
    professionals.some(
      (person) =>
        person.id === initialProfessional &&
        teamFor(validInitial).some((member) => member.id === person.id),
    )
      ? initialProfessional
      : "any",
  );
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<Slot>();
  const [notice, setNotice] = useState("");
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
  // The barber clip plays on the first trip to the times of this visit; it
  // stays mounted (and preloaded) only until then.
  const [cutPending, setCutPending] = useState(() =>
    shouldPlayCut(business.slug),
  );
  const [cut, setCut] = useState(false);
  const [clubToken] = useClubToken(business.slug);
  const { member } = useMembership(business.slug, clubToken);
  const stepHeading = useRef<HTMLDivElement>(null);
  const barPhoto = useRef<HTMLSpanElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step)
      stepHeading.current
        ?.querySelector<HTMLHeadingElement>("h1")
        ?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step]);
  const chosen = serviceIds
    .map((id) => services.find((item) => item.id === id))
    .filter((item): item is (typeof services)[number] => !!item);
  const summary = servicesSummary(chosen);
  const serviceKey = serviceIds.join(",");
  const professional = professionals.find(
    (person) => person.id === (slot?.professionalId || professionalId),
  );
  function changeStep(next: number) {
    if (next === 3 && step < 3 && cutPending && shouldPlayCut(business.slug)) {
      markCutSeen(business.slug);
      setCut(true);
    }
    setDirection(next > step ? "forward" : "back");
    setStep(next);
    setError("");
    setNotice("");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function toggleService(id: string, photo: HTMLElement | null) {
    haptic();
    setNotice("");
    const adding = !serviceIds.includes(id);
    const next = adding
      ? [...serviceIds, id]
      : serviceIds.filter((item) => item !== id);
    if (adding && next.length > 8) {
      setNotice("Você pode juntar até 8 serviços no mesmo horário.");
      return;
    }
    const team = teamFor(next);
    if (adding && next.length > 1 && team.length === 0) {
      const name = services.find((item) => item.id === id)?.name;
      setNotice(
        `Ninguém da equipe faz ${name} junto com ${summary.name}. Agende em outro horário.`,
      );
      return;
    }
    if (adding && serviceIds.length > 0) flyTo(photo, barPhoto.current);
    setServiceIds(next);
    setSlot(undefined);
    setDate("");
    if (
      professionalId !== "any" &&
      !team.some((person) => person.id === professionalId)
    )
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
      const team = teamFor(serviceIds);
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
    if (step === 3 && teamFor(serviceIds).length === 1) changeStep(1);
    else changeStep(step - 1);
  }
  const coverage =
    chosen.length && slot
      ? clubCoverage(member, serviceIds, slot.start, customer.phone)
      : null;
  const covered = coverage?.result === "covered";
  const deposit =
    catalog.onlinePayments && chosen.length && !covered
      ? depositFor(settings, summary.price)
      : 0;
  async function submit(values: CustomerFields) {
    if (!chosen.length || !slot) return;
    setCustomer(values);
    setBusy(true);
    setError("");
    try {
      const appointment = await publicRequest<Appointment>(
        `/api/public/${business.slug}/book`,
        {
          method: "POST",
          body: JSON.stringify({
            serviceIds,
            professionalId: slot.professionalId,
            start: slot.start,
            name: values.name,
            phone: values.phone,
            email: values.email,
            reminder: values.reminder,
            ...(deposit > 0 && values.cpf ? { cpf: values.cpf } : {}),
            ...(member?.status === "active"
              ? { membershipToken: clubToken }
              : {}),
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
      saveLastBooking(business.slug, {
        serviceId: serviceKey,
        serviceName: summary.name,
        professionalId: professionalId === "any" ? "any" : slot.professionalId,
        professionalName:
          professionalId === "any"
            ? ""
            : professionals.find((p) => p.id === slot.professionalId)?.name ||
              "",
      });
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
    ((step === 1 || step === 2) && chosen.length > 0) || !!slot;
  const showBar = step <= 3 && chosen.length > 0;
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
      onBack={step > 1 && !busy ? back : undefined}
      onStep={busy ? undefined : changeStep}
      backDisabled={busy}
      after={
        <>
          {cutPending && (
            <BarberCut
              active={cut}
              name={business.name}
              onDone={() => {
                setCut(false);
                setCutPending(false);
              }}
            />
          )}
          <div
            className={`bk-bar ${showBar ? "is-visible" : ""} ${step === 3 && slot ? "is-ready" : ""}`}
            aria-hidden={!showBar}
          >
            {chosen.length > 0 && (
              <div className="bk-bar-inner">
                <span
                  ref={barPhoto}
                  className={`bk-bar-photos ${chosen.length > 1 ? "is-stack" : ""}`}
                >
                  {chosen.slice(-3).map((item) => (
                    <PublicImage
                      key={item.id}
                      src={item.image}
                      alt=""
                      className="bk-bar-photo"
                      segment={item.category}
                    />
                  ))}
                  {chosen.length > 1 && (
                    <b className="bk-bar-count" key={chosen.length}>
                      {chosen.length}
                    </b>
                  )}
                </span>
                <div className="bk-bar-text">
                  <strong key={`${serviceKey}-${slot?.start}`}>
                    {step === 3 && slot
                      ? `${slotDay.charAt(0).toUpperCase()}${slotDay.slice(1).replace(".", "")} · ${bookingTime(slot.start)}`
                      : chosen.length > 1
                        ? `${chosen.length} serviços`
                        : chosen[0].name}
                  </strong>
                  <span>
                    {durationLabel(summary.duration)} •{" "}
                    <RollingMoney value={summary.price} />
                  </span>
                </div>
                <button
                  type="button"
                  className="bk-bar-button"
                  disabled={!canContinue || busy}
                  tabIndex={showBar ? 0 : -1}
                  onClick={next}
                >
                  Continuar <ArrowRight weight="bold" size={17} />
                </button>
              </div>
            )}
          </div>
        </>
      }
    >
      <div
        // Remounting after the opening replays the entrance below it.
        key={`${step}-${revealed}`}
        className={`bk-screen is-${direction}`}
        ref={stepHeading}
      >
        {step === 1 && (
          <ServiceStep
            services={services}
            selectedIds={serviceIds}
            onToggle={toggleService}
            slug={business.slug}
            professionals={professionals}
            popularId={catalog.popularServiceId}
            notice={notice}
          />
        )}
        {step === 2 && chosen.length > 0 && (
          <ProfessionalStep
            slug={business.slug}
            professionals={professionals}
            services={chosen}
            selectedId={professionalId}
            onSelect={selectProfessional}
          />
        )}
        {step === 3 && chosen.length > 0 && (
          <DateStep
            slug={business.slug}
            serviceId={serviceKey}
            professionalId={professionalId}
            settings={settings}
            selectedDate={date}
            selectedSlot={slot}
            onDate={setDate}
            onSlot={(value) => {
              if (value) haptic();
              setSlot(value);
            }}
            professionals={professionals}
            waitlist={catalog.features?.waitlist !== false}
          />
        )}
        {step === 4 && chosen.length > 0 && slot && (
          <CustomerStep
            key={remembered ? "remembered" : "new"}
            welcomeName={remembered?.name.split(" ")[0]}
            onForget={forgetCustomer}
            services={chosen}
            professional={professional}
            slot={slot}
            defaults={customer}
            busy={busy}
            error={error}
            onSubmit={submit}
            onChange={setCustomer}
            onEdit={changeStep}
            deposit={deposit}
            holdMinutes={settings.depositHold}
            club={
              coverage?.member.plan
                ? {
                    planName: coverage.member.plan.name,
                    result: coverage.result,
                  }
                : null
            }
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
