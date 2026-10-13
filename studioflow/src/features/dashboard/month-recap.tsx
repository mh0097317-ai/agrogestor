"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CaretRight,
  DownloadSimple,
  Play,
  Sparkle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { monogram, money } from "@/lib/utils";
import type { Store } from "@/types";
import { monthRecap, recapMonth, type MonthRecap } from "./month-recap-model";
import "./month-recap.css";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up from zero when its slide opens. */
function Count({ value, format = (n: number) => n.toLocaleString("pt-BR") }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(() => (reduced() ? value : 0));
  useEffect(() => {
    if (reduced()) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start - 250) / 1100);
      if (t > 0) setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(shown)}</>;
}

type Slide = {
  id: string;
  tone: "ink" | "brass" | "green" | "wine";
  kicker: string;
  big?: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  photo?: string;
};

function slidesFor(recap: MonthRecap, store: Store): Slide[] {
  const list: Slide[] = [];
  const month = recap.name;
  list.push({
    id: "intro",
    tone: "ink",
    kicker: store.business.name,
    title: (
      <>
        Seu {month}
        <br />
        <em>em retrospectiva.</em>
      </>
    ),
    text: "Toque para avançar.",
  });
  list.push({
    id: "completed",
    tone: "brass",
    kicker: "Cadeira ocupada",
    big: <Count value={recap.completed} />,
    title: recap.completed === 1 ? "atendimento concluído" : "atendimentos concluídos",
    text:
      recap.growth === null
        ? recap.completed
          ? "Cada um deles registrado na agenda."
          : "O mês está só começando."
        : recap.growth >= 0
          ? `${recap.growth}% a mais que no mês anterior.`
          : `${Math.abs(recap.growth)}% a menos que no mês anterior. Bora virar esse jogo.`,
  });
  if (recap.revenue > 0)
    list.push({
      id: "revenue",
      tone: "green",
      kicker: "No caixa",
      big: <Count value={Math.round(recap.revenue)} format={(n) => money(n).replace(/,00$/, "")} />,
      title: "recebidos no mês",
      text: recap.ticket ? `Ticket médio de ${money(recap.ticket)} por atendimento.` : undefined,
    });
  if (recap.online > 0)
    list.push({
      id: "online",
      tone: "ink",
      kicker: "Agenda online",
      big: <Count value={recap.online} />,
      title: recap.online === 1 ? "horário marcado sem você pegar no telefone" : "horários marcados sem você pegar no telefone",
      text: recap.afterHours
        ? recap.online === 1
          ? "E ele chegou com a barbearia fechada."
          : `${recap.afterHours} ${recap.afterHours === 1 ? "deles chegou" : "deles chegaram"} com a barbearia fechada.`
        : "Pela página da barbearia, a qualquer hora.",
    });
  if (recap.assistant > 0)
    list.push({
      id: "assistant",
      tone: "wine",
      kicker: "Recepcionista com IA",
      big: <Count value={recap.assistant} />,
      title: recap.assistant === 1 ? "horário marcado pela recepcionista" : "horários marcados pela recepcionista",
      text: "Conversou, mostrou os horários livres e marcou com a confirmação do cliente.",
    });
  if (recap.reminded > 0 || recap.attendance !== null)
    list.push({
      id: "attendance",
      tone: "brass",
      kicker: "Compromisso",
      big: recap.attendance !== null ? <Count value={recap.attendance} format={(n) => `${n}%`} /> : <Count value={recap.reminded} />,
      title: recap.attendance !== null ? "dos clientes vieram no horário marcado" : "lembretes enviados",
      text:
        recap.reminded > 0 && recap.attendance !== null
          ? `${recap.reminded} ${recap.reminded === 1 ? "cliente recebeu" : "clientes receberam"} lembrete antes do horário.`
          : recap.noShows
            ? `${recap.noShows} ${recap.noShows === 1 ? "falta" : "faltas"} no mês.`
            : undefined,
    });
  if (recap.topService || recap.topProfessional)
    list.push({
      id: "stars",
      tone: "ink",
      kicker: "Os destaques",
      photo: recap.topProfessional?.photo,
      title: recap.topProfessional ? (
        <>
          {recap.topProfessional.name.split(" ")[0]} fez <em>{recap.topProfessional.count}</em>{" "}
          {recap.topProfessional.count === 1 ? "atendimento" : "atendimentos"}.
        </>
      ) : (
        "O que mais saiu no mês."
      ),
      text: (
        <>
          {recap.topService && (
            <span className="recap-chip">
              Mais pedido: <b>{recap.topService.name}</b> ({recap.topService.count}x)
            </span>
          )}
          {recap.regular && (
            <span className="recap-chip">
              Cliente mais fiel: <b>{recap.regular.name}</b>, {recap.regular.count} visitas
            </span>
          )}
          {recap.newCustomers > 0 && (
            <span className="recap-chip">
              <b>{recap.newCustomers}</b> {recap.newCustomers === 1 ? "cliente novo" : "clientes novos"}
            </span>
          )}
        </>
      ),
    });
  if (recap.rating)
    list.push({
      id: "rating",
      tone: "green",
      kicker: "Quem veio, avaliou",
      big: recap.rating.average.toFixed(1).replace(".", ","),
      title: <span className="recap-stars" aria-label="estrelas">★★★★★</span>,
      text: `Em ${recap.rating.count} ${recap.rating.count === 1 ? "avaliação" : "avaliações"} no mês.`,
    });
  list.push({
    id: "end",
    tone: "ink",
    kicker: "Bora pro próximo",
    title: (
      <>
        Obrigado por mais
        <br />
        <em>um mês de corte.</em>
      </>
    ),
    text: "Baixe o resumo e poste no story da barbearia. O faturamento não aparece na imagem.",
  });
  return list;
}

/** Story image for Instagram: counts only, never revenue or customer names. */
async function storyImage(recap: MonthRecap, store: Store) {
  const w = 1080;
  const h = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const css = getComputedStyle(document.body);
  const display = `${css.getPropertyValue("--font-display") || "Georgia"}, Georgia, serif`;
  const ui = `${css.getPropertyValue("--font-ui") || "system-ui"}, system-ui, sans-serif`;
  await document.fonts.ready;
  ctx.fillStyle = "#16130f";
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.85, 260, 40, w * 0.85, 260, 900);
  glow.addColorStop(0, "rgba(201,163,93,0.45)");
  glow.addColorStop(1, "rgba(201,163,93,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "left";
  ctx.fillStyle = "#c9a35d";
  ctx.font = `700 34px ${ui}`;
  ctx.fillText(store.business.name.toUpperCase(), 96, 220);
  ctx.fillStyle = "#f4f0e8";
  ctx.font = `450 132px ${display}`;
  ctx.fillText(`Nosso ${recap.name}`, 96, 380);
  ctx.font = `italic 450 132px ${display}`;
  ctx.fillStyle = "#d9b77a";
  ctx.fillText("em números.", 96, 520);
  const rows: [string, string][] = [[String(recap.completed), recap.completed === 1 ? "atendimento" : "atendimentos"]];
  if (recap.online) rows.push([String(recap.online), recap.online === 1 ? "horário marcado online" : "horários marcados online"]);
  if (recap.rating) rows.push([recap.rating.average.toFixed(1).replace(".", ","), `estrelas em ${recap.rating.count} avaliações`]);
  if (recap.newCustomers) rows.push([String(recap.newCustomers), recap.newCustomers === 1 ? "cliente novo" : "clientes novos"]);
  let y = 760;
  for (const [value, label] of rows.slice(0, 4)) {
    ctx.strokeStyle = "rgba(244,240,232,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(96, y - 150);
    ctx.lineTo(w - 96, y - 150);
    ctx.stroke();
    ctx.fillStyle = "#f4f0e8";
    ctx.font = `450 150px ${display}`;
    ctx.fillText(value, 96, y);
    const valueWidth = ctx.measureText(value).width;
    ctx.fillStyle = "#c9bfae";
    ctx.font = `500 42px ${ui}`;
    ctx.fillText(label, 96 + valueWidth + 36, y - 14);
    y += 230;
  }
  if (recap.topService?.name) {
    ctx.fillStyle = "#c9bfae";
    ctx.font = `500 40px ${ui}`;
    ctx.fillText("O mais pedido:", 96, y - 40);
    ctx.fillStyle = "#f4f0e8";
    ctx.font = `italic 450 84px ${display}`;
    ctx.fillText(recap.topService.name, 96, y + 60);
  }
  ctx.fillStyle = "#d9b77a";
  ctx.fillRect(96, h - 250, 120, 4);
  ctx.fillStyle = "#f4f0e8";
  ctx.font = `600 44px ${ui}`;
  ctx.fillText("Obrigado a todos que passaram por aqui ✂️", 96, h - 170);
  ctx.fillStyle = "#8f8577";
  ctx.font = `500 30px ${ui}`;
  ctx.fillText("Agenda online pela StudioFlow", 96, h - 110);
  return canvas.toDataURL("image/jpeg", 0.92);
}

const DURATION = 5200;

function RecapPlayer({ store, recap, onClose }: { store: Store; recap: MonthRecap; onClose: () => void }) {
  const slides = slidesFor(recap, store);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const last = index === slides.length - 1;
  const go = useCallback(
    (step: number) => setIndex((value) => Math.min(slides.length - 1, Math.max(0, value + step))),
    [slides.length],
  );
  useEffect(() => {
    if (paused || last || reduced()) return;
    const timer = window.setTimeout(() => go(1), DURATION);
    return () => window.clearTimeout(timer);
  }, [index, paused, last, go]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === " ") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);
  const pressed = useRef(0);
  const slide = slides[index];
  async function save() {
    setSaving(true);
    try {
      const src = await storyImage(recap, store);
      const link = document.createElement("a");
      link.href = src;
      link.download = `${store.business.slug}-retrospectiva-${recap.month}.jpg`;
      link.click();
    } finally {
      setSaving(false);
    }
  }
  return createPortal(
    <div className="recap" role="dialog" aria-modal="true" aria-label={`Retrospectiva de ${recap.name}`}>
      <div className={`recap-card is-${slide.tone}`}>
        <div className="recap-bars" aria-hidden="true">
          {slides.map((item, position) => (
            <span key={item.id} className={position < index ? "is-done" : position === index ? "is-now" : ""}>
              <i
                key={position === index ? `now-${index}` : item.id}
                style={{ animationDuration: `${DURATION}ms`, animationPlayState: paused ? "paused" : "running" }}
              />
            </span>
          ))}
        </div>
        <header className="recap-head">
          <span className="recap-logo">
            {store.business.logo ? <img src={store.business.logo} alt="" /> : monogram(store.business.name)}
          </span>
          <span>
            <b>Retrospectiva</b>
            <small>{recap.name}</small>
          </span>
          <button type="button" className="recap-close" onClick={onClose} aria-label="Fechar retrospectiva">
            <X size={20} weight="bold" />
          </button>
        </header>
        <span className="recap-glow" aria-hidden="true" />
        <div className="recap-slide" key={slide.id} aria-live="polite">
          {slide.photo && <img className="recap-photo" src={slide.photo} alt="" />}
          <small className="recap-kicker">{slide.kicker}</small>
          {slide.big !== undefined && <strong className="recap-big">{slide.big}</strong>}
          <h2>{slide.title}</h2>
          {slide.text && <p>{slide.text}</p>}
          {last && (
            <div className="recap-actions">
              <button type="button" className="recap-save" onClick={() => void save()} disabled={saving}>
                <DownloadSimple size={18} weight="bold" /> {saving ? "Gerando..." : "Baixar para o story"}
              </button>
              <button type="button" className="recap-again" onClick={() => setIndex(0)}>
                Ver de novo
              </button>
            </div>
          )}
        </div>
        {!last && (
          <>
            <button
              type="button"
              className="recap-zone is-back"
              aria-label="Voltar"
              onClick={() => go(-1)}
              onPointerDown={() => (pressed.current = Date.now())}
            />
            <button
              type="button"
              className="recap-zone is-next"
              aria-label="Avançar"
              onPointerDown={() => {
                pressed.current = Date.now();
                setPaused(true);
              }}
              onPointerUp={() => setPaused(false)}
              onPointerLeave={() => setPaused(false)}
              onClick={() => {
                // A long press only pauses.
                if (Date.now() - pressed.current < 350) go(1);
              }}
            >
              <CaretRight size={22} weight="bold" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Card on the home screen that opens the month in review. */
export function MonthRecapCard({ data, now }: { data: Store; now: number }) {
  const [open, setOpen] = useState(false);
  const { month, closed } = recapMonth(new Date(now));
  const recap = monthRecap(data, month);
  if (!recap.completed && !recap.online) return null;
  return (
    <>
      <button type="button" className="recap-teaser" onClick={() => setOpen(true)}>
        <span className="recap-teaser-icon">
          <Sparkle size={20} weight="fill" />
        </span>
        <span className="recap-teaser-text">
          <small>{closed ? "Seu mês fechou" : "Seu mês até agora"}</small>
          <b>Retrospectiva de {recap.name}</b>
          <span>
            {recap.completed} atendimentos
            {recap.online ? ` · ${recap.online} marcados online` : ""}
          </span>
        </span>
        <span className="recap-teaser-play">
          <Play size={16} weight="fill" /> Assistir
        </span>
      </button>
      {open && <RecapPlayer store={data} recap={recap} onClose={() => setOpen(false)} />}
    </>
  );
}
