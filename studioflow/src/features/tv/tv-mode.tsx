"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowsOut, DoorOpen, Scissors, X } from "@phosphor-icons/react/dist/ssr";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { AccessGate } from "@/features/dashboard/access-gate";
import { dateLabel, money, monogram } from "@/lib/utils";
import type { Store } from "@/types";
import { tvBoard, tvName } from "./tv-model";
import "./tv.css";

export function TvMode() {
  return (
    <WorkspaceProvider>
      <TvGate />
    </WorkspaceProvider>
  );
}

function TvGate() {
  const { data, blocked, error, refresh } = useWorkspace();
  // The reception screen stays current on its own.
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  if (blocked) return <AccessGate access={blocked} onRetry={refresh} />;
  if (!data)
    return (
      <main className="tv tv-loading">
        {error ? <p>{error}</p> : <span className="tv-loader" aria-label="Carregando" />}
      </main>
    );
  return <TvScreen store={data} />;
}

function useQr(url: string) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!url) return;
    let alive = true;
    void QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#16130f", light: "#fffdf9" },
    }).then((value) => alive && setQr(value));
    return () => {
      alive = false;
    };
  }, [url]);
  return qr;
}

type Slide =
  | { kind: "photo"; src: string }
  | { kind: "products"; items: { name: string; price: number; image: string }[] }
  | { kind: "club"; items: { name: string; price: number }[] }
  | { kind: "loyalty"; goal: number; reward: string };

function TvScreen({ store }: { store: Store }) {
  const [now, setNow] = useState(() => new Date());
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [slide, setSlide] = useState(0);
  const [announce, setAnnounce] = useState<{ id: string; name: string; who: string } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const [full, setFull] = useState(false);
  const { business, settings } = store;
  // The board moves every 30 seconds; the clock every second.
  const tick = Math.floor(now.getTime() / 30_000);
  const board = useMemo(() => tvBoard(store, new Date(tick * 30_000)), [store, tick]);
  const bookQr = useQr(origin ? `${origin}/${business.slug}` : "");
  const checkinQr = useQr(origin ? `${origin}/${business.slug}/checkin` : "");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep the TV awake while this screen is open.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    const take = () =>
      nav.wakeLock
        ?.request("screen")
        .then((value) => (lock = value))
        .catch(() => undefined);
    void take();
    const again = () => document.visibilityState === "visible" && void take();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // A new check-in gets the whole screen for a moment.
  useEffect(() => {
    const ids = board.arrivals.map((item) => item.id);
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = board.arrivals.find((item) => !seen.current!.has(item.id));
    ids.forEach((id) => seen.current!.add(id));
    if (!fresh) return;
    const who = store.professionals.find((person) => person.id === fresh.professionalId);
    queueMicrotask(() =>
      setAnnounce({
        id: fresh.id,
        name: tvName(fresh.customerName),
        who: who?.name.split(" ")[0] || "",
      }),
    );
  }, [board.arrivals, store.professionals]);
  useEffect(() => {
    if (!announce) return;
    const timer = window.setTimeout(() => setAnnounce(null), 9000);
    return () => window.clearTimeout(timer);
  }, [announce]);

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = (business.photos || [])
      .filter(Boolean)
      .slice(0, 6)
      .map((src) => ({ kind: "photo" as const, src }));
    const products = (store.products || []).filter(
      (item) => item.active && item.showPublic && item.stock > 0,
    );
    if (products.length)
      list.splice(1, 0, {
        kind: "products",
        items: products.slice(0, 4).map(({ name, price, image }) => ({ name, price, image })),
      });
    const plans = (store.plans || []).filter((plan) => plan.active);
    if (plans.length && store.paymentAccount)
      list.splice(3, 0, {
        kind: "club",
        items: plans.slice(0, 3).map(({ name, price }) => ({ name, price })),
      });
    if (settings.loyaltyEnabled && settings.loyaltyReward)
      list.push({ kind: "loyalty", goal: settings.loyaltyGoal, reward: settings.loyaltyReward });
    if (!list.length && business.cover) list.push({ kind: "photo", src: business.cover });
    return list;
  }, [business, settings, store.products, store.plans, store.paymentAccount]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % slides.length), 9000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFull(!!document.fullscreenElement);
    } catch {
      // Some TV browsers do not allow it; the page still fills the screen.
    }
  }

  const iso = now.toISOString();
  const current = slides.length ? slides[slide % slides.length] : null;

  return (
    <main className="tv">
      <section className="tv-main">
        <header className="tv-head">
          <div className="tv-brand">
            {business.logo ? (
              <img src={business.logo} alt="" />
            ) : (
              <span className="tv-monogram">{monogram(business.name)}</span>
            )}
            <div>
              <strong>{business.name}</strong>
              <small>{dateLabel(iso, "EEEE, d 'de' MMMM")}</small>
            </div>
          </div>
          <time className="tv-clock" dateTime={iso}>
            {dateLabel(iso, "HH")}
            <span className="tv-colon">:</span>
            {dateLabel(iso, "mm")}
          </time>
        </header>

        <div className="tv-team">
          {board.team.length === 0 ? (
            <p className="tv-quiet">Equipe de folga hoje.</p>
          ) : (
            board.team.slice(0, 6).map((seat) => (
              <article key={seat.professional.id} className={`tv-seat is-${seat.state}`}>
                <span className="tv-photo">
                  {seat.professional.photo ? (
                    <img src={seat.professional.photo} alt="" />
                  ) : (
                    monogram(seat.professional.name)
                  )}
                </span>
                <div>
                  <strong>{seat.professional.name.split(" ")[0]}</strong>
                  {seat.state === "busy" && seat.current ? (
                    <span>
                      <Scissors size={16} weight="fill" /> Atendendo {tvName(seat.current.customerName)}
                      <small> · até {dateLabel(seat.current.end, "HH:mm")}</small>
                    </span>
                  ) : seat.state === "next" && seat.next ? (
                    <span>
                      Próximo: {tvName(seat.next.customerName)}
                      <small> · {dateLabel(seat.next.start, "HH:mm")}</small>
                    </span>
                  ) : (
                    <span className="tv-free">Livre agora</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        <div className="tv-list">
          <h2>Próximos horários</h2>
          {board.upcoming.length === 0 ? (
            <p className="tv-quiet">Sem mais horários marcados hoje. Agende pelo QR Code ao lado.</p>
          ) : (
            <ol>
              {board.upcoming.map((item) => {
                const person = store.professionals.find((p) => p.id === item.professionalId);
                return (
                  <li key={item.id} className={item.checkedInAt ? "is-here" : ""}>
                    <time>{dateLabel(item.start, "HH:mm")}</time>
                    <strong>{tvName(item.customerName)}</strong>
                    <span>{person?.name.split(" ")[0]}</span>
                    {item.checkedInAt ? (
                      <em>
                        <DoorOpen size={16} weight="fill" /> Chegou
                      </em>
                    ) : (
                      <i />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <aside className="tv-side">
        <div className="tv-qrs">
          <figure>
            {checkinQr && <img src={checkinQr} alt="QR Code de check-in" />}
            <figcaption>
              <strong>Chegou?</strong> Faça seu check-in
            </figcaption>
          </figure>
          <figure>
            {bookQr && <img src={bookQr} alt="QR Code de agendamento" />}
            <figcaption>
              <strong>Próximo corte?</strong> Agende pelo celular
            </figcaption>
          </figure>
        </div>
        <div className="tv-slide" key={slide}>
          {current?.kind === "photo" && <img className="tv-slide-photo" src={current.src} alt="" />}
          {current?.kind === "products" && (
            <div className="tv-slide-card">
              <small>Na casa você encontra</small>
              <ul>
                {current.items.map((item) => (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    <b>{money(item.price)}</b>
                  </li>
                ))}
              </ul>
              <p>Peça no seu atendimento.</p>
            </div>
          )}
          {current?.kind === "club" && (
            <div className="tv-slide-card">
              <small>Clube de assinatura</small>
              <ul>
                {current.items.map((item) => (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    <b>{money(item.price)}/mês</b>
                  </li>
                ))}
              </ul>
              <p>Assine pela página e agende sem pagar na hora.</p>
            </div>
          )}
          {current?.kind === "loyalty" && (
            <div className="tv-slide-card">
              <small>Cartão fidelidade</small>
              <p className="tv-big">
                A cada {current.goal} atendimentos, <em>{current.reward}</em>.
              </p>
            </div>
          )}
        </div>
        <footer className="tv-foot">
          <span>
            Agenda por <b>StudioFlow</b>
          </span>
          <span className="tv-controls">
            {!full && (
              <button type="button" onClick={() => void toggleFull()} aria-label="Tela cheia">
                <ArrowsOut size={18} />
              </button>
            )}
            <Link href="/dashboard" aria-label="Sair do modo TV">
              <X size={18} />
            </Link>
          </span>
        </footer>
      </aside>

      {announce && (
        <div className="tv-announce" role="status" key={announce.id}>
          <span className="tv-announce-icon">
            <DoorOpen size={46} weight="fill" />
          </span>
          <div>
            <strong>{announce.name} chegou</strong>
            <span>{announce.who ? `${announce.who} já foi avisado.` : "A equipe já foi avisada."}</span>
          </div>
        </div>
      )}
    </main>
  );
}
