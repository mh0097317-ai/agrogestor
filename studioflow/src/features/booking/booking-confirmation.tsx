"use client";

import Link from "next/link";
import {
  CalendarBlank,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  X,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { MapPinIcon, WhatsAppIcon } from "@/components/brand-icons";
import { SuccessCheck } from "./celebration";
import { useState } from "react";
import type { Appointment, Slot } from "@/types";
import type { CustomerReview, ManagedBooking } from "@/features/public/types";
import {
  BusyButton,
  PublicError,
  PublicImage,
  PublicLoading,
  PublicRefreshNotice,
} from "@/features/public/public-ui";
import { PublicModal } from "@/features/public/public-modal";
import {
  publicRequest,
  usePublicCatalog,
  usePublicData,
} from "@/features/public/use-public-catalog";
import { BookingRecap } from "./booking-summary";
import { ReviewCard } from "./review-card";
import { LoyaltyCard } from "./loyalty-card";
import { StepHead } from "./selection-steps";
import { BookingChrome } from "./booking-chrome";
import { DateStep } from "./date-step";
import { downloadCalendar } from "./calendar-export";
import { bookingDate, bookingDateShort, bookingTime } from "./date-format";

export function BookingConfirmation({ token }: { token: string }) {
  const { data, loading, error, reload } = usePublicData<ManagedBooking>(
    `/api/booking/${encodeURIComponent(token)}`,
  );
  const [updated, setUpdated] = useState<{
    token: string;
    appointment: Appointment;
  }>();
  const booking = data && {
    ...data,
    appointment:
      updated?.token === token ? updated.appointment : data.appointment,
  };
  if (loading && !booking) return <PublicLoading />;
  if (!booking)
    return (
      <PublicError
        message={error || "Agendamento não encontrado."}
        retry={reload}
      />
    );
  return (
    <>
      <PublicRefreshNotice error={error} refreshing={loading} retry={reload} />
      <ConfirmationContent
        key={token}
        booking={booking}
        token={token}
        onUpdate={(appointment) => setUpdated({ token, appointment })}
      />
    </>
  );
}

function ConfirmationContent({
  booking,
  token,
  onUpdate,
}: {
  booking: ManagedBooking;
  token: string;
  onUpdate: (appointment: Appointment) => void;
}) {
  const { appointment, business, services, professional } = booking;
  const {
    catalog,
    error: catalogError,
    reload,
  } = usePublicCatalog(business.slug);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(bookingDate(appointment.start));
  const [slot, setSlot] = useState<Slot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [savedReview, setSavedReview] = useState<CustomerReview>();
  // Celebrate only a booking made a moment ago, not every later visit.
  const [celebrate] = useState(
    () => Date.now() - Date.parse(appointment.createdAt) < 10 * 60 * 1000,
  );
  const service = services.find((item) =>
    appointment.serviceIds.includes(item.id),
  );
  const cancelled = appointment.status === "cancelled";
  const isPending = appointment.status === "pending";
  const upcoming = ["confirmed", "pending", "in_progress"].includes(
    appointment.status,
  );
  const canManage = ["confirmed", "pending"].includes(appointment.status);
  const title = {
    confirmed: "Horário confirmado!",
    pending: "Agendamento recebido",
    in_progress: "Seu atendimento começou",
    completed: "Atendimento concluído",
    cancelled: "Agendamento cancelado",
    no_show: "Atendimento não realizado",
  }[appointment.status];
  const message = {
    confirmed: `Tudo certo, ${appointment.customerName.split(" ")[0]}. Esperamos você em breve.`,
    pending:
      "Seu pedido está salvo e aguarda a confirmação do estabelecimento.",
    in_progress: "Você já está sendo atendido.",
    completed: "Obrigado pela visita! Quando quiser, é só agendar de novo.",
    cancelled:
      "Seu horário foi liberado. Você pode agendar outro quando quiser.",
    no_show: "Fale com o estabelecimento para combinar um novo horário.",
  }[appointment.status];
  const whatsapp = `https://wa.me/55${business.phone.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "")}`;
  const location = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
  const bookedSlot = {
    start: appointment.start,
    end: appointment.end,
    professionalId: appointment.professionalId,
    time: bookingTime(appointment.start),
  };
  async function update(action: "cancel" | "reschedule") {
    setBusy(true);
    setError("");
    try {
      const updated = await publicRequest<Appointment>(
        `/api/booking/${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action,
            ...(action === "reschedule" && slot
              ? { start: slot.start, professionalId: slot.professionalId }
              : {}),
          }),
        },
      );
      onUpdate(updated);
      setDate(bookingDate(updated.start));
      setCancelOpen(false);
      setRescheduling(false);
      setSlot(undefined);
      setToast(
        action === "cancel"
          ? "Seu horário foi cancelado."
          : "Seu novo horário está confirmado!",
      );
      setTimeout(() => setToast(""), 4500);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar seu horário.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast(
        "Link do agendamento copiado. Guarde para gerenciar seu horário.",
      );
      setTimeout(() => setToast(""), 4500);
    } catch {
      setError(
        "Não foi possível copiar. Você pode guardar o link que aparece no seu navegador.",
      );
    }
  }
  const placeName = business.name;
  const review =
    appointment.status === "completed" ? (
      <ReviewCard
        token={token}
        businessName={business.name}
        professionalName={professional?.name}
        review={savedReview ?? booking.review}
        onSaved={setSavedReview}
      />
    ) : null;
  return (
    <BookingChrome
      business={business}
      step={6}
      onBack={
        rescheduling
          ? () => {
              setRescheduling(false);
              setError("");
            }
          : undefined
      }
      backDisabled={busy}
    >
      <div className="bk-done">
        {rescheduling && service ? (
          <section className="bk-step">
            <StepHead
              title="Escolha o novo horário"
              text={`Seu horário atual é ${bookingDateShort(appointment.start)} às ${bookingTime(appointment.start)}.`}
            />
            {catalog ? (
              <DateStep
                slug={business.slug}
                serviceId={service.id}
                professionalId={appointment.professionalId}
                settings={catalog.settings}
                selectedDate={date}
                selectedSlot={slot}
                onDate={setDate}
                onSlot={setSlot}
                embedded
              />
            ) : catalogError ? (
              <div className="bk-alert" role="alert">
                <p>{catalogError}</p>
                <button type="button" onClick={reload}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              <div className="bk-times" aria-busy="true">
                <span className="bk-skeleton bk-skeleton-title" />
              </div>
            )}
            {error && (
              <div className="bk-alert" role="alert">
                <p>{error}</p>
              </div>
            )}
            <div className="bk-actions">
              <BusyButton
                disabled={!slot}
                busy={busy}
                className="bk-primary"
                onClick={() => void update("reschedule")}
              >
                <Check weight="bold" size={17} /> Confirmar novo horário
              </BusyButton>
              <button
                type="button"
                className="bk-secondary"
                disabled={busy}
                onClick={() => {
                  setRescheduling(false);
                  setError("");
                }}
              >
                Manter o horário atual
              </button>
            </div>
          </section>
        ) : (
          <>
            <div
              className={`bk-mark ${cancelled ? "is-cancelled" : ""} ${isPending || cancelled || appointment.status === "no_show" ? "" : "is-success"}`}
            >
              {celebrate && !cancelled && (
                <span className="bk-mark-sparks" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => (
                    <i key={index} />
                  ))}
                </span>
              )}
              <span className="bk-mark-circle">
                {cancelled ? (
                  <X weight="bold" size={34} />
                ) : isPending ? (
                  <Clock weight="duotone" size={34} />
                ) : appointment.status === "no_show" ? (
                  <XCircle weight="duotone" size={34} />
                ) : (
                  <SuccessCheck celebrate={celebrate} />
                )}
              </span>
            </div>
            <header className="bk-done-head">
              <h1 tabIndex={-1}>{title}</h1>
              <p>{message}</p>
            </header>
            {review}
            {service && (
              <BookingRecap
                service={service}
                professional={professional}
                slot={bookedSlot}
                totalPrice={appointment.price}
              />
            )}
            {catalog?.settings.loyaltyEnabled &&
              catalog.settings.loyaltyReward && (
                <LoyaltyCard
                  visits={booking.loyaltyVisits ?? 0}
                  goal={catalog.settings.loyaltyGoal}
                  reward={catalog.settings.loyaltyReward}
                />
              )}
            {upcoming ? (
              <div className="bk-actions">
                <button
                  type="button"
                  className="bk-primary"
                  onClick={() =>
                    downloadCalendar(appointment, business, services)
                  }
                >
                  <CalendarPlus weight="duotone" size={18} /> Adicionar ao
                  calendário
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="bk-secondary"
                      onClick={() => {
                        setRescheduling(true);
                        setError("");
                      }}
                    >
                      Reagendar horário
                    </button>
                    <button
                      type="button"
                      className="bk-secondary is-quiet"
                      onClick={() => {
                        setCancelOpen(true);
                        setError("");
                      }}
                    >
                      Cancelar horário
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bk-actions">
                <Link
                  className="bk-primary"
                  href={`/${business.slug}/agendar${service ? `?service=${service.id}` : ""}`}
                >
                  <CalendarPlus weight="duotone" size={18} />{" "}
                  {cancelled ? "Agendar um novo horário" : "Agendar de novo"}
                </Link>
              </div>
            )}
            {error && !cancelOpen && (
              <div className="bk-alert" role="alert">
                <p>{error}</p>
              </div>
            )}
            <div className="bk-signoff">
              <p>
                {cancelled
                  ? "Quando quiser, estamos aqui."
                  : "Nos vemos em breve!"}
              </p>
              <Link href={`/${business.slug}`} className="bk-signoff-brand">
                <PublicImage
                  src={business.logo}
                  alt=""
                  className={`bk-signoff-logo ${business.logo ? "has-logo" : ""}`}
                  segment={business.category}
                />
                <strong>{placeName}</strong>
                <small>{business.category}</small>
              </Link>
            </div>
            <div className="bk-contact">
              {business.address.trim() && (
                <a href={location} target="_blank" rel="noreferrer">
                  <MapPinIcon size={20} />
                  <strong>Ver localização</strong>
                </a>
              )}
              {business.phone.replace(/\D/g, "").length >= 10 && (
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <WhatsAppIcon size={20} />
                  <strong>Falar no WhatsApp</strong>
                </a>
              )}
            </div>
            <div className="bk-code">
              <span>
                Agendamento #{appointment.id.slice(0, 8).toUpperCase()}
              </span>
              <button type="button" onClick={copyLink}>
                <Copy weight="duotone" size={15} /> Copiar link
              </button>
            </div>
            <p className="bk-footnote">
              {cancelled
                ? "Seu horário foi liberado."
                : "Guarde este link para remarcar ou cancelar quando precisar."}
            </p>
          </>
        )}
      </div>
      {cancelOpen && (
        <PublicModal
          labelId="cancel-title"
          onClose={() => setCancelOpen(false)}
          busy={busy}
        >
          <button
            className="public-icon-button public-modal-close"
            onClick={() => setCancelOpen(false)}
            disabled={busy}
            aria-label="Fechar"
          >
            <X weight="bold" size={18} />
          </button>
          <span className="bk-modal-icon">
            <CalendarBlank weight="duotone" size={28} />
          </span>
          <h2 id="cancel-title">Cancelar seu horário?</h2>
          <p>
            Seu horário de {bookingDateShort(appointment.start)} às{" "}
            {bookingTime(appointment.start)} será liberado para outra pessoa.
          </p>
          {catalog && (
            <p className="bk-modal-policy">
              Cancelamentos podem ser realizados até{" "}
              {catalog.settings.cancellationHours} horas antes do atendimento.
            </p>
          )}
          {error && (
            <div className="bk-alert" role="alert">
              <p>{error}</p>
            </div>
          )}
          <BusyButton busy={busy} onClick={() => void update("cancel")}>
            Sim, cancelar agendamento
          </BusyButton>
          <button
            className="public-button public-button-outline"
            disabled={busy}
            onClick={() => setCancelOpen(false)}
          >
            Manter meu horário
          </button>
        </PublicModal>
      )}
      {toast && (
        <div className="public-toast" role="status">
          <Check weight="bold" size={18} />
          {toast}
        </div>
      )}
    </BookingChrome>
  );
}
