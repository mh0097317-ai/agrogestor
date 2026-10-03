"use client";

import Link from "next/link";
import {
  ArrowsClockwise,
  CalendarBlank,
  CaretLeft,
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
import type { ManagedBooking } from "@/features/public/types";
import {
  BookingHeader,
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
import { BookingProgress } from "./booking-flow";
import { BookingSummary } from "./booking-summary";
import { DateStep } from "./date-step";
import { downloadCalendar } from "./calendar-export";
import { bookingDate, bookingDateShort, bookingTime } from "./date-format";
import "@/features/public/public.css";

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
  // Celebrate only a booking made a moment ago, not every later visit.
  const [celebrate] = useState(
    () => Date.now() - Date.parse(appointment.createdAt) < 10 * 60 * 1000,
  );
  const service = services.find((item) =>
    appointment.serviceIds.includes(item.id),
  );
  const cancelled = appointment.status === "cancelled";
  const isPending = appointment.status === "pending";
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
  return (
    <div className="booking-site">
      <BookingHeader
        slug={business.slug}
        businessName={business.name}
        photo={business.logo || business.cover}
        category={business.category}
      />
      <main className="booking-confirmation-main">
        <BookingProgress step={5} />
        {rescheduling && service ? (
          <div className="booking-reschedule">
            <button
              className="public-text-link"
              disabled={busy}
              onClick={() => {
                setRescheduling(false);
                setError("");
              }}
            >
              <CaretLeft weight="bold" size={15} /> Voltar ao agendamento
            </button>
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
              />
            ) : catalogError ? (
              <div className="booking-error">
                <p>{catalogError}</p>
                <button className="public-text-link" onClick={reload}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              <p className="booking-subtitle">Carregando horários…</p>
            )}
            {error && (
              <div className="booking-error" role="alert">
                {error}
              </div>
            )}
            <BusyButton
              disabled={!slot}
              busy={busy}
              onClick={() => void update("reschedule")}
            >
              Confirmar novo horário <Check weight="bold" size={16} />
            </BusyButton>
          </div>
        ) : (
          <>
            <div
              className={`booking-success-mark ${cancelled ? "is-cancelled" : ""} ${isPending || cancelled || appointment.status === "no_show" ? "" : "is-success"}`}
            >
              {cancelled ? (
                <X weight="bold" size={32} />
              ) : isPending ? (
                <Clock weight="duotone" size={32} />
              ) : appointment.status === "no_show" ? (
                <XCircle weight="duotone" size={32} />
              ) : (
                <SuccessCheck celebrate={celebrate} />
              )}
            </div>
            <h1>{title}</h1>
            <p className="booking-subtitle">{message}</p>
            <div className="booking-confirmation-receipt">
              <BookingSummary
                service={service}
                professional={professional}
                slot={bookedSlot}
                compact
                totalPrice={appointment.price}
              />
              <div className="booking-confirmation-place">
                <PublicImage
                  src={business.logo || business.cover}
                  alt=""
                  className="booking-confirmation-place-photo"
                  segment={business.category}
                />
                <div>
                  <strong>{business.name}</strong>
                  <span>{business.address}</span>
                </div>
              </div>
              <div className="booking-confirmation-code">
                <span>
                  Agendamento #{appointment.id.slice(0, 8).toUpperCase()}
                </span>
                <button
                  className="public-icon-button"
                  onClick={copyLink}
                  aria-label="Copiar link do agendamento"
                >
                  <Copy weight="duotone" size={15} />
                </button>
              </div>
            </div>
            {!cancelled && (
              <div className="booking-confirmation-actions">
                <button
                  className="public-button"
                  onClick={() =>
                    downloadCalendar(appointment, business, services)
                  }
                >
                  <CalendarBlank weight="duotone" size={18} /> Adicionar ao
                  calendário
                </button>
                {canManage && (
                  <>
                    <button
                      className="public-button public-button-outline"
                      onClick={() => {
                        setRescheduling(true);
                        setError("");
                      }}
                    >
                      <ArrowsClockwise weight="duotone" size={16} /> Reagendar
                      horário
                    </button>
                    <button
                      className="public-button public-button-outline booking-cancel-button"
                      onClick={() => {
                        setCancelOpen(true);
                        setError("");
                      }}
                    >
                      <XCircle weight="duotone" size={16} /> Cancelar horário
                    </button>
                  </>
                )}
              </div>
            )}
            {cancelled && (
              <Link
                className="public-button"
                href={`/${business.slug}/agendar${service ? `?service=${service.id}` : ""}`}
              >
                Agendar um novo horário{" "}
                <CalendarBlank weight="duotone" size={17} />
              </Link>
            )}
            {error && !cancelOpen && (
              <div className="booking-error" role="alert">
                {error}
              </div>
            )}
            <div className="booking-confirmation-social">
              {business.address.trim() && (
                <a href={location} target="_blank" rel="noreferrer">
                  <MapPinIcon size={18} /> Ver localização
                </a>
              )}
              {business.phone.replace(/\D/g, "").length >= 10 && (
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <WhatsAppIcon size={18} /> Falar no WhatsApp
                </a>
              )}
            </div>
            <p className="booking-confirmation-footnote">
              {cancelled
                ? "Quando quiser, é só marcar um novo horário."
                : "Guarde este link para remarcar ou cancelar quando precisar."}
            </p>
          </>
        )}
      </main>
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
          <span className="booking-cancel-icon">
            <CalendarBlank weight="duotone" size={28} />
          </span>
          <h2 id="cancel-title">Cancelar seu horário?</h2>
          <p>
            Seu horário de {bookingDateShort(appointment.start)} às{" "}
            {bookingTime(appointment.start)} será liberado para outra pessoa.
          </p>
          {catalog && (
            <p className="booking-modal-policy">
              Cancelamentos podem ser realizados até{" "}
              {catalog.settings.cancellationHours} horas antes do atendimento.
            </p>
          )}
          {error && (
            <div className="booking-error" role="alert">
              {error}
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
    </div>
  );
}
