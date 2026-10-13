"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  Robot,
  Scissors,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

/** A number that rolls to its new value instead of jumping. */
function Rolling({ value, format = brl }: { value: number; format?: (value: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced()) {
      from.current = value;
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - t) ** 3;
      const current = Math.round(origin + (value - origin) * eased);
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(shown)}</>;
}

/* ------------------------------------------------------------------
   Hero: o celular mostrando o produto funcionando sozinho, em loop
   ------------------------------------------------------------------ */

const demoServices = [
  ["Corte", "40 min", 45],
  ["Corte + barba", "1 h", 65],
  ["Barba", "30 min", 30],
] as const;
const demoTimes = ["13:00", "14:30", "16:00"];
// How long each beat stays on screen.
const beats = [1300, 1100, 1300, 1500, 1900, 2600];

export function LiveDemo() {
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced()) {
      const frame = requestAnimationFrame(() => setStep(3));
      return () => cancelAnimationFrame(frame);
    }
    let timer = 0;
    let visible = true;
    let current = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        current = (current + 1) % beats.length;
        if (visible) setStep(current);
        next();
      }, beats[current]);
    };
    next();
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    if (root.current) observer.observe(root.current);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);
  const screen = step <= 2 ? "book" : step <= 4 ? "done" : "agenda";
  return (
    <div className="lp-phone lp-live-phone" ref={root}>
      <div className={`lp-live is-${screen}`} data-step={step}>
        <div className="lp-live-screen is-book">
          <header>
            <span className="lp-live-logo">N</span>
            <span>
              <b>Barbearia Navalha</b>
              <small>Agendamento online</small>
            </span>
          </header>
          <p className="lp-live-label">Escolha o serviço</p>
          <ul className="lp-live-services">
            {demoServices.map(([name, time, price], index) => (
              <li key={name} className={index === 1 && step >= 1 ? "is-on" : ""}>
                <span>
                  <b>{name}</b>
                  <small>{time}</small>
                </span>
                <em>{brl(price)}</em>
              </li>
            ))}
          </ul>
          <div className={`lp-live-times ${step >= 2 ? "is-shown" : ""}`}>
            <p className="lp-live-label">Amanhã com Lucas</p>
            <div>
              {demoTimes.map((time) => (
                <span key={time} className={time === "14:30" && step >= 2 ? "is-on" : ""}>
                  {time}
                </span>
              ))}
            </div>
          </div>
          <div className={`lp-live-bar ${step >= 1 ? "is-shown" : ""} ${step === 2 ? "is-pressed" : ""}`}>
            <span>
              <small>{step >= 2 ? "Amanhã · 14:30" : "1 serviço"}</small>
              <b>Corte + barba · {brl(65)}</b>
            </span>
            <em>{step >= 2 ? "Confirmar" : "Continuar"}</em>
          </div>
          <span className={`lp-live-tap is-${step}`} aria-hidden="true" />
        </div>

        <div className="lp-live-screen is-done">
          <span className="lp-live-check">
            <Check size={30} weight="bold" />
          </span>
          <b>Horário confirmado!</b>
          <p>Corte + barba · amanhã às 14:30 com Lucas</p>
          <div className={`lp-live-push ${step >= 4 ? "is-shown" : ""}`}>
            <WhatsAppIcon size={18} />
            <span>
              <small>WhatsApp · agora</small>
              <b>Lembrete: amanhã às 14:30 na Navalha ✂️</b>
            </span>
          </div>
        </div>

        <div className="lp-live-screen is-agenda">
          <header>
            <span>
              <small>Painel do dono</small>
              <b>Agenda de amanhã</b>
            </span>
            <em className={step === 5 ? "is-up" : ""}>+ R$ 65</em>
          </header>
          <ul>
            <li>
              <time>09:00</time>
              <span>Carlos A. · Corte</span>
            </li>
            <li>
              <time>10:00</time>
              <span>Marcos T. · Barba</span>
            </li>
            <li>
              <time>11:30</time>
              <span>Diego R. · Corte + barba</span>
            </li>
            <li>
              <time>13:00</time>
              <span>João M. · Corte</span>
            </li>
            <li className={step === 5 ? "is-new" : ""}>
              <time>14:30</time>
              <span>Pedro L. · Corte + barba</span>
              <i>novo</i>
            </li>
            <li className="is-free">
              <time>16:00</time>
              <span>Livre</span>
            </li>
            <li>
              <time>17:00</time>
              <span>Rafa S. · Barba</span>
            </li>
            <li>
              <time>18:00</time>
              <span>Thiago P. · Corte</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Um dia com o StudioFlow: a agenda enche conforme a página rola
   ------------------------------------------------------------------ */

type Booking = {
  time: string;
  name: string;
  price: number;
  /** Chapter in which this time gets booked. */
  at: number;
  tag?: "ia" | "lembrete" | "espera";
};

const day: Booking[] = [
  { time: "09:00", name: "Carlos · Corte", price: 45, at: 0 },
  { time: "10:00", name: "Marcos · Corte + barba", price: 65, at: 0 },
  { time: "11:00", name: "Diego · Barba", price: 30, at: 1, tag: "lembrete" },
  { time: "13:00", name: "João · Corte", price: 45, at: 1, tag: "lembrete" },
  { time: "14:00", name: "Pedro · Corte + barba", price: 65, at: 2, tag: "ia" },
  { time: "15:00", name: "Rafa · Corte", price: 45, at: 2, tag: "ia" },
  { time: "16:00", name: "André · Corte", price: 45, at: 2, tag: "ia" },
  { time: "17:00", name: "Lucas · Corte + barba", price: 65, at: 3, tag: "espera" },
  { time: "18:00", name: "Thiago · Corte", price: 45, at: 3 },
  { time: "19:00", name: "", price: 0, at: 9 },
];

const chapters = [
  {
    kicker: "Antes de abrir",
    title: "A página agenda enquanto a porta está fechada.",
    text: "O cliente vê os horários livres de verdade e marca sozinho, sem ligar e sem criar senha.",
  },
  {
    kicker: "Durante o dia",
    title: "O lembrete sai sozinho no WhatsApp.",
    text: "Quem marcou recebe o aviso antes do horário. Você não precisa mandar mensagem para ninguém.",
  },
  {
    kicker: "02:13 da manhã",
    title: "A recepcionista com IA responde e marca.",
    text: "Ela mostra os horários livres e só grava quando o cliente confirma. O barbeiro recebe o aviso no WhatsApp dele.",
  },
  {
    kicker: "Fim do dia",
    title: "Agenda cheia e caixa fechado na mesma tela.",
    text: "Cliente sem horário entra na lista de espera. Quando abre uma vaga, você já sabe para quem ligar.",
  },
];

const tagLabel = {
  ia: { icon: Robot, text: "IA" },
  lembrete: { icon: Bell, text: "Lembrete" },
  espera: { icon: Scissors, text: "Lista de espera" },
};

export function DayStory() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setActive(Number((entry.target as HTMLElement).dataset.chapter));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);
  const booked = day.filter((item) => item.at <= active);
  const total = booked.reduce((sum, item) => sum + item.price, 0);
  return (
    <section className="lp-day" aria-label="Um dia com o StudioFlow">
      <div className="lp-day-head">
        <p className="lp-eyebrow">Um dia com o StudioFlow</p>
        <h2>Role a página e veja a agenda encher.</h2>
      </div>
      <div className="lp-day-body">
        <div className="lp-day-sticky">
          <div className="lp-day-card">
            <header>
              <span>
                <small>Agenda de hoje</small>
                <b>
                  {booked.length} de {day.length} horários
                </b>
              </span>
              <em>
                <Rolling value={total} />
              </em>
            </header>
            <span className="lp-day-bar">
              <i style={{ transform: `scaleX(${booked.length / day.length})` }} />
            </span>
            <ul>
              {day.map((item) => {
                const on = item.at <= active;
                const tag = item.tag && tagLabel[item.tag];
                return (
                  <li key={item.time} className={on ? "is-on" : ""}>
                    <time>{item.time}</time>
                    <span>{on ? item.name : "Livre"}</span>
                    {on && tag && (
                      <i className={`is-${item.tag}`}>
                        <tag.icon size={12} weight="bold" /> {tag.text}
                      </i>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <ol className="lp-day-steps">
          {chapters.map((chapter, index) => (
            <li
              key={chapter.title}
              data-chapter={index}
              ref={(element) => {
                refs.current[index] = element;
              }}
              className={index === active ? "is-active" : ""}
            >
              <small>{chapter.kicker}</small>
              <h3>{chapter.title}</h3>
              <p>{chapter.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Calculadora: quanto as faltas levam embora por mês
   ------------------------------------------------------------------ */

export function NoShowCalculator() {
  const [price, setPrice] = useState(45);
  const [missed, setMissed] = useState(4);
  const monthly = price * missed * 4;
  return (
    <section className="lp-calc" aria-label="Calculadora de faltas">
      <div className="lp-calc-text">
        <p className="lp-eyebrow">Faça a conta</p>
        <h2>Quanto as faltas levam da sua barbearia?</h2>
        <label>
          <span>
            Preço médio do corte <b>{brl(price)}</b>
          </span>
          <input
            type="range"
            min={20}
            max={150}
            step={5}
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
          />
        </label>
        <label>
          <span>
            Faltas por semana <b>{missed}</b>
          </span>
          <input
            type="range"
            min={1}
            max={20}
            value={missed}
            onChange={(event) => setMissed(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="lp-calc-result" aria-live="polite">
        <small>Saindo pela porta todo mês</small>
        <strong>
          <Rolling value={monthly} />
        </strong>
        <p>
          Cada falta evitada é <b>{brl(price)}</b> que fica no caixa. Lembrete no WhatsApp e sinal por Pix
          seguram o horário para você.
        </p>
        <small className="lp-calc-note">Conta: preço × faltas por semana × 4 semanas.</small>
      </div>
    </section>
  );
}
