"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CalendarCheck, DoorOpen } from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { DrawCheck } from "@/features/booking/draw-check";
import { bookingTime } from "@/features/booking/date-format";
import { haptic } from "@/lib/haptic";
import { monogram } from "@/lib/utils";
import { PublicError, PublicLoading } from "./public-ui";
import { publicRequest, usePublicCatalog } from "./use-public-catalog";
import { CheckInButton } from "./check-in-button";
import { checkInOpen, readVisit, type SavedVisit } from "./visit";
import "./checkin.css";

interface Result {
  customer: string;
  professional: string;
  start: string;
  checkedInAt: string;
}

/** Página do QR Code da recepção: o cliente avisa que chegou. */
export function CheckInPage({ slug }: { slug: string }) {
  const { catalog, loading, error, reload } = usePublicCatalog(slug);
  const [visit, setVisit] = useState<SavedVisit | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [done, setDone] = useState<Result | null>(null);
  const [usePhone, setUsePhone] = useState(false);

  // The receipt saved this visit on the customer's phone.
  useEffect(() => {
    queueMicrotask(() => {
      const saved = readVisit(slug);
      setVisit(saved && checkInOpen(saved) ? saved : null);
    });
  }, [slug]);

  if (loading && !catalog) return <PublicLoading />;
  if (!catalog)
    return <PublicError message={error || "Estabelecimento não encontrado."} retry={reload} />;
  const { business } = catalog;
  if (catalog.features?.checkin === false)
    return <PublicError message="O check-in pelo celular não está disponível aqui. Avise na recepção." retry={reload} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFail("");
    try {
      const result = await publicRequest<Result>(
        `/api/public/${encodeURIComponent(slug)}/checkin`,
        { method: "POST", body: JSON.stringify({ phone }) },
      );
      haptic();
      setDone(result);
    } catch (cause) {
      setFail(cause instanceof Error ? cause.message : "Não foi possível avisar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ci-page">
      <header className="ci-brand">
        {business.logo ? (
          <img src={business.logo} alt="" />
        ) : (
          <span className="ci-monogram" aria-hidden="true">
            {monogram(business.name)}
          </span>
        )}
        <strong>{business.name}</strong>
      </header>
      <section className="ci-card">
        {done ? (
          <div className="ci-success" role="status">
            <span className="ci-success-mark">
              <DrawCheck size={34} />
            </span>
            <h1>Pronto, {done.customer}!</h1>
            <p>
              {done.professional ? `${done.professional} já sabe` : "A equipe já sabe"} que você
              chegou. Seu horário é às <b>{bookingTime(done.start)}</b>.
            </p>
            {!!business.amenities?.length && (
              <p className="ci-amenities">Enquanto espera: {business.amenities.join(" · ")}</p>
            )}
          </div>
        ) : (
          <>
            <span className="ci-eyebrow">
              <DoorOpen size={16} weight="duotone" /> Recepção
            </span>
            <h1>Chegou? Avise a equipe.</h1>
            {visit && !usePhone ? (
              <>
                <p>
                  Encontramos seu horário de hoje às <b>{bookingTime(visit.start)}</b>.
                </p>
                <CheckInButton slug={slug} token={visit.token} />
                <button type="button" className="ci-alt" onClick={() => setUsePhone(true)}>
                  Não é você? Usar outro WhatsApp
                </button>
              </>
            ) : (
              <form onSubmit={submit} className="ci-form">
                <p>Digite o WhatsApp que você usou para agendar.</p>
                <label className="ci-input">
                  <WhatsAppIcon size={18} />
                  <input
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-label="Seu WhatsApp"
                    required
                  />
                </label>
                <button type="submit" className="ci-button" disabled={busy || phone.replace(/\D/g, "").length < 10}>
                  <DoorOpen size={20} weight="duotone" />
                  {busy ? "Avisando…" : "Avisar que cheguei"}
                </button>
                {fail && (
                  <p className="ci-error" role="alert">
                    {fail}
                  </p>
                )}
              </form>
            )}
          </>
        )}
      </section>
      <Link className="ci-book" href={`/${slug}/agendar`}>
        <CalendarCheck size={17} /> Sem horário marcado? Agende aqui
      </Link>
    </main>
  );
}
