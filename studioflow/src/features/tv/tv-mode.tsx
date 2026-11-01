"use client";
import { onlineBookingEnabled } from "@/lib/online-booking";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "qrcode";
import {
  ArrowsOut,
  Clock,
  DoorOpen,
  Scissors,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { AccessGate } from "@/features/dashboard/access-gate";
import { ModuleGate } from "@/features/dashboard/module-lock";
import { hasModule } from "@/lib/modules";
import { dateLabel, money, monogram } from "@/lib/utils";
import type { Store } from "@/types";
import { availableSlots, localDate } from "@/lib/availability";
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
  if (data && !hasModule(data.access?.modules, "recepcao"))
    return (
      <main className="tv tv-loading">
        <ModuleGate module="recepcao">{null}</ModuleGate>
      </main>
    );
  if (!data)
    return (
      <main className="tv tv-loading">
        {error ? (
          <p>{error}</p>
        ) : (
          <span className="tv-loader" aria-label="Carregando" />
        )}
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
  | { kind: "photo"; src: string; caption: string }
  | {
      kind: "service";
      name: string;
      price: number;
      duration: number;
      image: string;
      popular: boolean;
    }
  | { kind: "free"; times: { time: string; who: string }[]; service: string }
  | {
      kind: "reviews";
      average: number;
      count: number;
      quote: string;
      who: string;
    }
  | { kind: "instagram"; handle: string; photos: string[] }
  | {
      kind: "products";
      items: { name: string; price: number; image: string }[];
    }
  | { kind: "club"; items: { name: string; price: number }[] }
  | { kind: "loyalty"; goal: number; reward: string };

function TvScreen({ store }: { store: Store }) {
  const [now, setNow] = useState(() => new Date());
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const [slide, setSlide] = useState(0);
  const [queuePage, setQueuePage] = useState(0);
  const [queueSize, setQueueSize] = useState(6);
  const queueRef = useRef<HTMLOListElement>(null);
  const [announce, setAnnounce] = useState<{
    id: string;
    name: string;
    who: string;
    photo: string;
    start: string;
  } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const [full, setFull] = useState(false);
  const { business, settings } = store;
  // The board moves every 30 seconds; the clock every second.
  const tick = Math.floor(now.getTime() / 30_000);
  const board = useMemo(
    () => tvBoard(store, new Date(tick * 30_000)),
    [store, tick],
  );
  const queuePages = Math.max(1, Math.ceil(board.upcoming.length / queueSize));
  const visibleQueue = board.upcoming.slice(
    (queuePage % queuePages) * queueSize,
    ((queuePage % queuePages) + 1) * queueSize,
  );
  useEffect(() => {
    const list = queueRef.current;
    if (!list) return;
    const fit = () => {
      if (
        window.matchMedia("(max-width: 900px), (orientation: portrait)").matches
      ) {
        setQueueSize(6);
        return;
      }
      const rowHeight =
        list.firstElementChild?.getBoundingClientRect().height || 0;
      if (rowHeight && list.clientHeight)
        setQueueSize(
          // Folga de alguns pixels: a última borda pode encostar no fim.
          Math.max(1, Math.min(6, Math.floor((list.clientHeight + 8) / rowHeight))),
        );
    };
    const frame = requestAnimationFrame(fit);
    const observer =
      "ResizeObserver" in window ? new ResizeObserver(fit) : null;
    observer?.observe(list);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [board.upcoming.length]);
  useEffect(() => {
    if (queuePages < 2) return;
    const timer = window.setInterval(
      () => setQueuePage((page) => page + 1),
      15000,
    );
    return () => window.clearInterval(timer);
  }, [queuePages]);
  const online = onlineBookingEnabled(settings);
  const bookQr = useQr(online && origin ? `${origin}/${business.slug}` : "");
  const checkinQr = useQr(origin ? `${origin}/${business.slug}/checkin` : "");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep the TV awake while this screen is open.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
      };
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
    const who = store.professionals.find(
      (person) => person.id === fresh.professionalId,
    );
    queueMicrotask(() =>
      setAnnounce({
        id: fresh.id,
        name: tvName(fresh.customerName).split(" ")[0],
        who: who?.name.split(" ")[0] || "",
        photo: who?.photo || "",
        start: fresh.start,
      }),
    );
  }, [board.arrivals, store.professionals]);
  useEffect(() => {
    if (!announce) return;
    const timer = window.setTimeout(() => setAnnounce(null), 9000);
    return () => window.clearTimeout(timer);
  }, [announce]);

  const slides = useMemo<Slide[]>(() => {
    const clock = new Date(tick * 30_000);
    const photos = (business.photos || []).filter(Boolean);
    const caption =
      business.description?.split(/(?<=[.!?])\s/)[0]?.slice(0, 90) ||
      "Seu próximo momento começa aqui.";
    const list: Slide[] = photos
      .slice(0, 3)
      .map((src) => ({ kind: "photo" as const, src, caption }));
    // Vitrine: os serviços com foto, do mais pedido para o menos.
    const since = clock.getTime() - 90 * 86_400_000;
    const counts = new Map<string, number>();
    for (const item of store.appointments)
      if (
        item.status !== "cancelled" &&
        new Date(item.start).getTime() >= since
      )
        for (const id of item.serviceIds)
          counts.set(id, (counts.get(id) || 0) + 1);
    const ranked = store.services
      .filter((service) => service.active)
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
    ranked
      .filter((service) => service.image)
      .slice(0, 4)
      .forEach((service, index) =>
        list.splice(Math.min(list.length, index * 2 + 1), 0, {
          kind: "service",
          name: service.name,
          price: service.price,
          duration: service.duration,
          image: service.image,
          popular: index === 0 && (counts.get(service.id) || 0) >= 3,
        }),
      );
    // Vagas que ainda dá para pegar hoje, com o serviço mais pedido.
    if (online && ranked[0]) {
      const today = localDate(clock);
      const seen = new Set<string>();
      const times = availableSlots(store, [ranked[0].id], "any", today, clock)
        .filter((slot) => !seen.has(slot.time) && seen.add(slot.time))
        .slice(0, 4)
        .map((slot) => ({
          time: slot.time,
          who:
            store.professionals
              .find((p) => p.id === slot.professionalId)
              ?.name.split(" ")[0] || "",
        }));
      if (times.length)
        list.splice(1, 0, { kind: "free", times, service: ranked[0].name });
    }
    const good = (store.reviews || []).filter((review) => review.rating >= 1);
    if (good.length >= 3) {
      const average = good.reduce((sum, r) => sum + r.rating, 0) / good.length;
      const quote = good
        .filter(
          (r) =>
            r.rating === 5 &&
            r.comment.trim().length >= 12 &&
            r.comment.length <= 140,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      list.splice(Math.min(list.length, 3), 0, {
        kind: "reviews",
        average,
        count: good.length,
        quote: quote?.comment.trim() || "",
        who: quote ? tvName(quote.customerName) : "",
      });
    }
    const handle = business.instagram
      .trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .split(/[/?#]/)[0];
    if (handle)
      list.push({
        kind: "instagram",
        handle,
        photos: [...photos, ...ranked.map((s) => s.image)]
          .filter(Boolean)
          .slice(0, 3),
      });
    const products = (store.products || []).filter(
      (item) =>
        hasModule(store.access?.modules, "produtos") &&
        item.active &&
        item.showPublic &&
        item.stock > 0,
    );
    if (products.length)
      list.splice(1, 0, {
        kind: "products",
        items: products
          .slice(0, 4)
          .map(({ name, price, image }) => ({ name, price, image })),
      });
    const plans = (store.plans || []).filter(
      (plan) => hasModule(store.access?.modules, "clube") && plan.active,
    );
    if (plans.length && store.paymentAccount)
      list.splice(3, 0, {
        kind: "club",
        items: plans.slice(0, 3).map(({ name, price }) => ({ name, price })),
      });
    if (
      hasModule(store.access?.modules, "fidelidade") &&
      settings.loyaltyEnabled &&
      settings.loyaltyReward
    )
      list.push({
        kind: "loyalty",
        goal: settings.loyaltyGoal,
        reward: settings.loyaltyReward,
      });
    if (!list.length && business.cover)
      list.push({ kind: "photo", src: business.cover, caption });
    return list;
  }, [business, settings, store, online, tick]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(
      () => setSlide((value) => (value + 1) % slides.length),
      9000,
    );
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

  // Faixa que corre embaixo: o que vende sem ninguém perguntar.
  const ticker = (() => {
    const items: string[] = [];
    const free = slides.find((item) => item.kind === "free");
    if (free?.kind === "free") {
      // "16:00 e 16:30 com Lucas · 17:00 com Ana": um nome por grupo.
      const groups = new Map<string, string[]>();
      for (const item of free.times)
        groups.set(item.who, [...(groups.get(item.who) || []), item.time]);
      const join = (list: string[]) =>
        list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list.at(-1)}` : list[0];
      items.push(
        `Tem vaga hoje para ${free.service}: ${[...groups]
          .map(([who, times]) => `${join(times)}${who ? ` com ${who}` : ""}`)
          .join(" · ")}`,
      );
    }
    if (online) items.push("Agende o próximo pelo QR Code, leva 20 segundos");
    const reviews = slides.find((item) => item.kind === "reviews");
    if (reviews?.kind === "reviews")
      items.push(
        `Nota ${reviews.average.toFixed(1).replace(".", ",")} de 5 em ${reviews.count} avaliações`,
      );
    const insta = slides.find((item) => item.kind === "instagram");
    if (insta?.kind === "instagram") items.push(`Siga @${insta.handle}`);
    const loyalty = slides.find((item) => item.kind === "loyalty");
    if (loyalty?.kind === "loyalty")
      items.push(`Fidelidade: a cada ${loyalty.goal} atendimentos, ${loyalty.reward}`);
    if (!items.length) items.push(`Boas-vindas à ${business.name}`);
    return items;
  })();
  const compactTeam = board.team.length > 4;
  const teamShown = board.team.slice(0, compactTeam ? 6 : 4);

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
            <strong>{business.name}</strong>
          </div>
          <div className="tv-clock-wrap">
            <small>{dateLabel(iso, "EEEE, d 'de' MMMM")}</small>
            <time className="tv-clock" dateTime={iso}>
              {dateLabel(iso, "HH")}
              <span className="tv-colon">:</span>
              {dateLabel(iso, "mm")}
            </time>
          </div>
        </header>

        <section className="tv-team-section" aria-label="Equipe agora">
          <h2 className="tv-section-label">
            <span className="tv-live-dot" aria-hidden="true" /> Na cadeira agora
          </h2>
          {teamShown.length === 0 ? (
            <div className="tv-closed">
              <strong>Nenhum profissional em expediente agora.</strong>
              <span>
                {online
                  ? "Agende pelo QR Code ao lado e garanta seu horário."
                  : "Fale com a equipe para agendar."}
              </span>
            </div>
          ) : (
            <div
              className={`tv-team ${compactTeam ? "is-compact" : ""}`}
              style={{ "--tv-cols": compactTeam ? 3 : teamShown.length } as CSSProperties}
            >
              {teamShown.map((seat) => (
                <article
                  key={seat.professional.id}
                  className={`tv-seat is-${seat.state}`}
                >
                  <span className="tv-photo">
                    {seat.professional.photo ? (
                      <img src={seat.professional.photo} alt="" />
                    ) : (
                      monogram(seat.professional.name)
                    )}
                  </span>
                  <div className="tv-seat-info">
                    <strong>{seat.professional.name.split(" ")[0]}</strong>
                    {seat.state === "busy" && seat.current ? (
                      <span className="tv-status">
                        <i aria-hidden="true" />
                        <span>
                          <b>Até {dateLabel(seat.current.end, "HH:mm")}</b>
                          <small>Atendendo {tvName(seat.current.customerName)}</small>
                        </span>
                      </span>
                    ) : seat.state === "next" && seat.next ? (
                      <span className="tv-status">
                        <i aria-hidden="true" />
                        <span>
                          <b>Às {dateLabel(seat.next.start, "HH:mm")}</b>
                          <small>Próximo: {tvName(seat.next.customerName)}</small>
                        </span>
                      </span>
                    ) : (
                      <span className="tv-status">
                        <i aria-hidden="true" />
                        <span>
                          <b>Livre agora</b>
                          <small>{online ? "Encaixe na hora" : "Fale com a recepção"}</small>
                        </span>
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="tv-list" aria-label="A seguir">
          <h2 className="tv-section-label">
            A seguir
            {queuePages > 1 && (
              <small>
                {(queuePage % queuePages) + 1} / {queuePages}
              </small>
            )}
          </h2>
          {board.upcoming.length === 0 ? (
            <div className="tv-empty">
              <Clock size={30} weight="light" />
              <span>
                <strong>Agenda em dia.</strong>{" "}
                {online
                  ? "Quer o próximo horário? Use o QR Code."
                  : "Fale com a equipe para agendar."}
              </span>
            </div>
          ) : (
            <ol ref={queueRef}>
              {visibleQueue.map((item) => {
                const person = store.professionals.find(
                  (p) => p.id === item.professionalId,
                );
                const late = new Date(item.start).getTime() < now.getTime();
                return (
                  <li key={item.id} className={item.checkedInAt ? "is-here" : ""}>
                    <time>{dateLabel(item.start, "HH:mm")}</time>
                    <strong>{tvName(item.customerName)}</strong>
                    <span>{person ? `com ${person.name.split(" ")[0]}` : ""}</span>
                    {item.checkedInAt ? (
                      <em className="is-here">
                        <DoorOpen size={18} weight="fill" /> Chegou
                      </em>
                    ) : (
                      <em className={late ? "is-late" : ""}>
                        {late
                          ? "Horário passou"
                          : item.status === "pending"
                            ? "A confirmar"
                            : "Esperado"}
                      </em>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </section>

      <aside className="tv-side">
        <div className="tv-slide" key={slide}>
          {!current && (
            <div className="tv-slide-card tv-brand-card">
              <small>Um tempo para você</small>
              <p className="tv-big">
                Sinta-se
                <br />
                em casa.
              </p>
              <p>É um prazer receber você na {business.name}.</p>
            </div>
          )}
          {current?.kind === "photo" && (
            <div className="tv-ad">
              <img className="tv-slide-photo" src={current.src} alt="" />
              <div className="tv-ad-text">
                <small>{business.name}</small>
                <strong>{current.caption}</strong>
              </div>
            </div>
          )}
          {current?.kind === "service" && (
            <div className="tv-ad">
              <img className="tv-slide-photo" src={current.image} alt="" />
              <div className="tv-ad-text">
                {current.popular && (
                  <span className="tv-ad-tag">O mais pedido</span>
                )}
                <strong>{current.name}</strong>
                <span className="tv-ad-price">
                  {money(current.price)} <em>· {current.duration} min</em>
                </span>
              </div>
            </div>
          )}
          {current?.kind === "free" && (
            <div className="tv-slide-card tv-free-card">
              <small>Ainda hoje</small>
              <p className="tv-big">
                Tem vaga para <em>{current.service}</em>
              </p>
              <ul className="tv-times">
                {current.times.map((item) => (
                  <li key={item.time + item.who}>
                    <b>{item.time}</b>
                    <span>{item.who}</span>
                  </li>
                ))}
              </ul>
              <p>Aponte a câmera para o QR Code e garanta o seu.</p>
            </div>
          )}
          {current?.kind === "reviews" && (
            <div className="tv-slide-card tv-reviews">
              <small>Quem vem, recomenda</small>
              <p className="tv-score">
                {current.average.toFixed(1).replace(".", ",")}
                <span aria-hidden="true">★★★★★</span>
              </p>
              <p>{current.count} avaliações de clientes atendidos</p>
              {current.quote && (
                <blockquote>
                  “{current.quote}”<cite>{current.who}</cite>
                </blockquote>
              )}
            </div>
          )}
          {current?.kind === "instagram" && (
            <div className="tv-slide-card tv-insta">
              <small>Siga a casa</small>
              <p className="tv-big">@{current.handle}</p>
              <div className="tv-insta-grid">
                {current.photos.map((src) => (
                  <img key={src} src={src} alt="" />
                ))}
              </div>
              <p>Inspirações e novidades no nosso Instagram.</p>
            </div>
          )}
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
          {slides.length > 1 && <span className="tv-progress" aria-hidden="true" />}
        </div>
        <div className={`tv-qrs ${online ? "" : "is-single"}`}>
          {online && (
            <figure className="is-main">
              {bookQr && <img src={bookQr} alt="QR Code de agendamento" />}
              <figcaption>
                <strong>Agende o próximo</strong>
                <span>Aponte a câmera</span>
              </figcaption>
            </figure>
          )}
          <figure>
            {checkinQr && <img src={checkinQr} alt="QR Code de check-in" />}
            <figcaption>
              <strong>Chegou?</strong>
              <span>Faça seu check-in aqui</span>
            </figcaption>
          </figure>
        </div>
      </aside>

      <footer className="tv-ticker" aria-label="Avisos">
        <div className="tv-ticker-track">
          {[0, 1].map((copy) => (
            <span key={copy} aria-hidden={copy === 1}>
              {ticker.map((item, index) => (
                <span key={index} className="tv-ticker-item">
                  <Scissors size={18} weight="fill" /> {item}
                </span>
              ))}
            </span>
          ))}
        </div>
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

      {announce && (
        <TvWelcome
          key={announce.id}
          {...announce}
          business={business.name}
          logo={business.logo}
          barber={/barb/i.test(business.category)}
          accent={business.color}
          now={now}
        />
      )}
    </main>
  );
}

/**
 * Someone just checked in: the screen is theirs for a few seconds. A
 * curtain sweeps in, the name rises letter by letter, a blade draws the
 * line under it and their barber appears.
 */
function TvWelcome({
  name,
  who,
  photo,
  start,
  business,
  logo,
  barber,
  accent,
  now,
}: {
  name: string;
  who: string;
  photo: string;
  start: string;
  business: string;
  logo?: string;
  barber: boolean;
  accent?: string;
  now: Date;
}) {
  const [arrived] = useState(() => now.getTime());
  const minutes = Math.round((new Date(start).getTime() - arrived) / 60_000);
  const when =
    minutes > 2
      ? `Seu horário é às ${dateLabel(start, "HH:mm")}`
      : "Já vai te chamar";
  return (
    <div
      className="tv-welcome"
      role="status"
      style={{ "--tv-accent": accent || "#a47a3c" } as CSSProperties}
    >
      <span className="tv-welcome-curtain" aria-hidden="true" />
      <div className="tv-welcome-body">
        <span className="tv-welcome-brand">
          {logo ? <img src={logo} alt="" /> : monogram(business)}
        </span>
        <small>Boas-vindas à {business}</small>
        <strong className="tv-welcome-name" aria-label={name}>
          {Array.from(name).map((letter, index) => (
            <span
              key={index}
              aria-hidden="true"
              style={{ animationDelay: `${700 + index * 70}ms` }}
            >
              {letter}
            </span>
          ))}
        </strong>
        <span className="tv-welcome-cut" aria-hidden="true">
          <Scissors size={50} weight="fill" />
        </span>
        <div className="tv-welcome-who">
          {who && (
            <span className="tv-welcome-photo">
              {photo ? <img src={photo} alt="" /> : monogram(who)}
            </span>
          )}
          <span>
            {who ? (
              <span>
                {barber ? "Seu barbeiro: " : "Atendimento com "}
                <b>{who}</b>
              </span>
            ) : (
              "A equipe já sabe que você chegou"
            )}
            <em>{when}</em>
          </span>
        </div>
      </div>
    </div>
  );
}
