"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Armchair,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CaretRight,
  Clock,
  CurrencyCircleDollar,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { WhatsAppIcon } from "@/components/brand-icons";
import { dateLabel, money } from "@/lib/utils";
import { hasModule } from "@/lib/modules";
import type { Appointment, PaymentMethod, Store } from "@/types";
import { balanceFor, reais } from "@/features/management/finance-helpers";
import { salonModel, type Chair, type ChairState } from "./salon-model";
import { Salon3D } from "./salon-3d";
import "./salon.css";

const looks: Record<ChairState, { label: string; tone: string }> = {
  busy: { label: "Atendendo", tone: "busy" },
  late: { label: "Atrasado", tone: "late" },
  due: { label: "Hora de começar", tone: "due" },
  free: { label: "Livre", tone: "free" },
  break: { label: "Intervalo", tone: "break" },
  off: { label: "Fora do expediente", tone: "off" },
};
const methods: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
];
const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const services = (a: Appointment, data: Store) =>
  a.serviceIds
    .map((id) => data.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
function whatsapp(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
}
function short(chair: Chair) {
  if (chair.state === "busy") return `${chair.minutesLeft} min`;
  if (chair.state === "late") return `+${-chair.minutesLeft} min`;
  if (chair.state === "due") return dateLabel(chair.current!.start, "HH:mm");
  if (chair.state === "break") return `até ${chair.freeUntil}`;
  if (chair.state === "free") return "Livre";
  return "Folga";
}

/** Today against yesterday, as a signed percentage; nothing when there is no base. */
function Trend({ today, before }: { today: number; before: number }) {
  if (!before) return null;
  const change = Math.round(((today - before) / before) * 100);
  const up = change >= 0;
  return (
    <em className={`sl-trend ${up ? "is-up" : "is-down"}`}>
      {up ? (
        <ArrowUpRight size={13} weight="bold" />
      ) : (
        <ArrowDownRight size={13} weight="bold" />
      )}
      {up ? "+" : ""}
      {change}%
    </em>
  );
}

/** Chairs on the two back walls of an isometric room (viewBox 900x600),
 * kept away from the back corner so their name tags never overlap. */
function layout(count: number) {
  const left = Math.ceil(count / 2);
  const right = count - left;
  const spread = (k: number, from: number, to: number) =>
    k === 1
      ? [(from + to) / 2]
      : Array.from({ length: k }, (_, i) => from + ((to - from) * i) / (k - 1));
  const spots: { x: number; y: number; wall: "l" | "r"; t: number }[] = [];
  for (const t of spread(left, 0.2, 0.62))
    spots.push({ x: 50 + 400 * t + 96, y: 390 - 200 * t + 48, wall: "l", t });
  for (const v of spread(right, 0.38, 0.8).reverse())
    spots.push({
      x: 450 + 400 * v - 96,
      y: 190 + 200 * v + 48,
      wall: "r",
      t: v,
    });
  return spots;
}
function mirror(spot: { wall: "l" | "r"; t: number }) {
  const a = spot.t - 0.07;
  const b = spot.t + 0.07;
  const base = (t: number) =>
    spot.wall === "l"
      ? [50 + 400 * t, 390 - 200 * t]
      : [450 + 400 * t, 190 + 200 * t];
  const [x1, y1] = base(a);
  const [x2, y2] = base(b);
  return `${x1},${y1 - 160} ${x2},${y2 - 160} ${x2},${y2 - 60} ${x1},${y1 - 60}`;
}

export function SalonLive({
  data,
  now,
  onOpen,
  onCreate,
}: {
  data: Store;
  now: number;
  onOpen: (a: Appointment) => void;
  onCreate?: () => void;
}) {
  const { refresh } = useWorkspace();
  const router = useRouter();
  const model = salonModel(data, now);
  const [selected, setSelected] = useState(
    model.chairs[0]?.professional.id || "",
  );
  // Keeps the salon current without anyone pressing refresh.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 45_000);
    return () => clearInterval(timer);
  }, [refresh]);
  const chair =
    model.chairs.find((c) => c.professional.id === selected) || model.chairs[0];
  const spots = layout(Math.min(model.chairs.length, 8));
  const assistant =
    hasModule(data.access?.modules, "recepcionista") &&
    data.settings.assistantEnabled;
  return (
    <section className="sl" aria-label="Salão ao vivo">
      <header className="sl-head">
        <div>
          <span className="sl-kicker">
            {data.business.name} ·{" "}
            {dateLabel(new Date(now).toISOString(), "EEEE, d 'de' MMMM")}
          </span>
          <h1>
            Salão <em>ao vivo</em>
          </h1>
        </div>
        <div className="sl-head-actions">
          <span className="sl-live">
            <i aria-hidden="true" />
            Ao vivo · {dateLabel(new Date(now).toISOString(), "HH:mm")}
          </span>
          {onCreate && (
            <button className="sl-btn sl-btn-dark" onClick={onCreate}>
              <Plus size={16} weight="bold" /> Novo agendamento
            </button>
          )}
          <Link
            className="sl-btn sl-btn-line"
            href={`/dashboard/agenda?date=${model.day}`}
          >
            Abrir agenda <CaretRight size={15} />
          </Link>
        </div>
      </header>

      <div className="sl-kpis">
        <div className="sl-kpi">
          <span className="sl-kpi-icon" aria-hidden="true">
            <CalendarCheck size={20} weight="duotone" />
          </span>
          <span className="sl-kpi-label">Agendamentos hoje</span>
          <span className="sl-kpi-value">
            <strong>{model.total}</strong>
            <Trend today={model.total} before={model.yesterday.total} />
          </span>
          <small>
            {model.done} {model.done === 1 ? "concluído" : "concluídos"} ·{" "}
            {Math.max(0, model.total - model.done)}{" "}
            {model.total - model.done === 1 ? "restante" : "restantes"}
          </small>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-icon" aria-hidden="true">
            <Armchair size={20} weight="duotone" />
          </span>
          <span className="sl-kpi-label">Cadeiras em uso</span>
          <span className="sl-kpi-value">
            <strong>
              {model.working
                ? `${Math.round((model.inUse / model.working) * 100)}%`
                : "—"}
            </strong>
          </span>
          <i
            className="sl-kpi-bar"
            style={{
              width: `${model.working ? Math.round((model.inUse / model.working) * 100) : 0}%`,
            }}
          />
          <small>
            {model.working
              ? `${model.inUse} de ${model.working} agora · agenda ${Math.round(model.occupancy * 100)}% cheia`
              : "Ninguém no expediente agora"}
          </small>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-icon" aria-hidden="true">
            <Clock size={20} weight="duotone" />
          </span>
          <span className="sl-kpi-label">Clientes na espera</span>
          <span className="sl-kpi-value">
            <strong>{model.waiting.length}</strong>
          </span>
          <small>
            {model.waiting.length
              ? `há ${model.waitMinutes} min em média`
              : "Ninguém esperando agora"}
          </small>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-icon" aria-hidden="true">
            <CurrencyCircleDollar size={20} weight="duotone" />
          </span>
          <span className="sl-kpi-label">Caixa de hoje</span>
          <span className="sl-kpi-value">
            <strong>{money(model.cash)}</strong>
            <Trend today={model.cash} before={model.yesterday.cash} />
          </span>
          <small>
            {model.yesterday.cash
              ? "Comparado a ontem até esta hora"
              : "Pagamentos registrados hoje"}
          </small>
        </div>
      </div>

      {model.chairs.length === 0 ? (
        <div className="sl-empty">
          <strong>Cadastre sua equipe para ver o salão.</strong>
          <p>
            Cada profissional vira uma cadeira aqui, com quem está atendendo
            agora.
          </p>
          <Link className="sl-btn sl-btn-dark" href="/dashboard/equipe">
            Abrir equipe
          </Link>
        </div>
      ) : (
        <div className="sl-main">
          <div className="sl-scene-card">
            <div className="sl-scene">
              <Salon3D
                chairs={model.chairs}
                waiting={model.waiting.length}
                shopName={data.business.name}
                category={data.business.category}
                selected={chair?.professional.id || ""}
                onSelect={setSelected}
                onArea={(area) => {
                  if (area === "reception")
                    router.push(`/dashboard/agenda?date=${model.day}`);
                  else if (model.waiting[0])
                    setSelected(model.waiting[0].professionalId);
                }}
                areas={{
                  reception: (
                    <span className="sl-area">
                      <CalendarCheck size={13} weight="bold" /> Recepção
                    </span>
                  ),
                  waiting: (
                    <span className="sl-area">
                      <Clock size={13} weight="bold" /> Espera ·{" "}
                      {model.waiting.length}
                    </span>
                  ),
                }}
                label={(c, i) => (
                  <ChairTag
                    chair={c}
                    index={i}
                    data={data}
                    on={chair?.professional.id === c.professional.id}
                    onClick={() => setSelected(c.professional.id)}
                  />
                )}
                fallback={
                  <>
                    <svg
                      viewBox="0 0 900 600"
                      aria-hidden="true"
                      className="sl-room"
                    >
                      <defs>
                        <pattern
                          id="sl-floor"
                          width="0.125"
                          height="0.125"
                          patternUnits="userSpaceOnUse"
                        >
                          <rect width="0.125" height="0.125" fill="#EBE2D2" />
                          <rect width="0.0625" height="0.0625" fill="#D3C4AB" />
                          <rect
                            x="0.0625"
                            y="0.0625"
                            width="0.0625"
                            height="0.0625"
                            fill="#D3C4AB"
                          />
                        </pattern>
                        <radialGradient id="sl-light">
                          <stop
                            offset="0"
                            stopColor="#FFF1CF"
                            stopOpacity="0.95"
                          />
                          <stop
                            offset="1"
                            stopColor="#FFF1CF"
                            stopOpacity="0"
                          />
                        </radialGradient>
                        <linearGradient
                          id="sl-glass"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0" stopColor="#E7ECE9" />
                          <stop offset="1" stopColor="#C9D3CF" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points="50,390 450,190 450,10 50,210"
                        fill="#EFE7D9"
                      />
                      <polygon
                        points="450,190 850,390 850,210 450,10"
                        fill="#E5DAC8"
                      />
                      <polygon
                        points="50,390 450,190 450,140 50,340"
                        fill="#D8CAB3"
                      />
                      <polygon
                        points="450,190 850,390 850,340 450,140"
                        fill="#CDBEA5"
                      />
                      <line
                        x1="450"
                        y1="10"
                        x2="450"
                        y2="190"
                        stroke="#C9B99E"
                        strokeWidth="2"
                      />
                      <g transform="matrix(400 -200 400 200 50 390)">
                        <rect width="1" height="1" fill="url(#sl-floor)" />
                      </g>
                      <polygon
                        points="50,390 450,190 850,390 450,590"
                        fill="none"
                        stroke="#BFAE92"
                        strokeWidth="2"
                      />
                      {spots.map((spot, i) => {
                        const x =
                          spot.wall === "l"
                            ? 50 + 400 * spot.t
                            : 450 + 400 * spot.t;
                        const y =
                          spot.wall === "l"
                            ? 390 - 200 * spot.t
                            : 190 + 200 * spot.t;
                        return (
                          <ellipse
                            key={`light-${i}`}
                            cx={x}
                            cy={y - 150}
                            rx="70"
                            ry="58"
                            fill="url(#sl-light)"
                          />
                        );
                      })}
                      {/* The shop's sign on the right wall, by the corner. */}
                      <g transform="matrix(1 0.5 0 1 0 0)">
                        <rect
                          x="472"
                          y="-196"
                          width="94"
                          height="62"
                          rx="4"
                          fill="#1F1A15"
                          stroke="#B08A4F"
                          strokeWidth="2"
                        />
                        <text
                          x="519"
                          y="-166"
                          textAnchor="middle"
                          fill="#D9B77A"
                          fontFamily="Fraunces, Georgia, serif"
                          fontSize={Math.min(
                            12,
                            120 / Math.max(6, data.business.name.length),
                          )}
                          textLength={
                            data.business.name.length > 11 ? 82 : undefined
                          }
                          lengthAdjust="spacingAndGlyphs"
                          letterSpacing="0.5"
                        >
                          {data.business.name.toUpperCase()}
                        </text>
                        <line
                          x1="492"
                          y1="-157"
                          x2="546"
                          y2="-157"
                          stroke="#B08A4F"
                          strokeWidth="1"
                        />
                        <text
                          x="519"
                          y="-145"
                          textAnchor="middle"
                          fill="#B8AD9C"
                          fontSize="6"
                          letterSpacing="1.5"
                        >
                          {(
                            data.business.category || "Barbearia"
                          ).toUpperCase()}
                        </text>
                      </g>
                      {spots.map((spot, i) => (
                        <polygon
                          key={i}
                          points={mirror(spot)}
                          fill="url(#sl-glass)"
                          stroke="#B08A4F"
                          strokeWidth="6"
                          strokeLinejoin="round"
                        />
                      ))}
                      <rect
                        x="441"
                        y="40"
                        width="18"
                        height="96"
                        rx="9"
                        fill="#FFFDF9"
                        stroke="#B08A4F"
                        strokeWidth="3"
                      />
                      <path
                        d="M444 52 L456 64 M444 70 L456 82 M444 88 L456 100 M444 106 L456 118"
                        stroke="#A8481C"
                        strokeWidth="5"
                      />
                      <circle cx="450" cy="36" r="8" fill="#B08A4F" />
                      <polygon
                        points="282,488 442,408 540,457 380,537"
                        fill="#3F332A"
                      />
                      <polygon
                        points="298,488 442,416 524,457 380,529"
                        fill="none"
                        stroke="#8A6430"
                        strokeWidth="1.5"
                        opacity="0.7"
                      />
                      <polygon
                        points="285,507 435,432 475,452 325,527"
                        fill="#5B4636"
                      />
                      <polygon
                        points="285,507 325,527 325,541 285,521"
                        fill="#3E2F24"
                      />
                      <polygon
                        points="325,527 475,452 475,466 325,541"
                        fill="#4A392C"
                      />
                      <polygon
                        points="285,507 435,432 435,398 285,473"
                        fill="#6B5442"
                      />
                      {model.waiting.slice(0, 3).map((a, i) => (
                        <g key={a.id}>
                          <circle
                            cx={335 + i * 45}
                            cy={452 - i * 22}
                            r="11"
                            fill="#7A5A44"
                          />
                          <path
                            d={`M${318 + i * 45} ${498 - i * 22} Q${335 + i * 45} ${462 - i * 22} ${352 + i * 45} ${490 - i * 22} Z`}
                            fill="#E9DFCF"
                          />
                        </g>
                      ))}
                      <polygon
                        points="600,470 700,420 730,435 630,485"
                        fill="#2A221B"
                      />
                      <polygon
                        points="600,470 630,485 630,520 600,505"
                        fill="#1E1813"
                      />
                      <polygon
                        points="630,485 730,435 730,470 630,520"
                        fill="#3A2E24"
                      />
                      <polygon
                        points="650,452 676,439 690,446 664,459"
                        fill="#D9B77A"
                      />
                      <polygon
                        points="690,431 712,420 712,398 690,409"
                        fill="#1E1813"
                      />
                      <polygon
                        points="693,428 709,420 709,402 693,410"
                        fill="#5F7480"
                      />
                      <rect
                        x="699"
                        y="428"
                        width="4"
                        height="8"
                        fill="#1E1813"
                      />
                      {[
                        [104, 393],
                        [796, 393],
                      ].map(([x, y]) => (
                        <g key={x}>
                          <path
                            d={`M${x} ${y - 30} q-26 -18 -20 -46 q16 14 20 40 q2 -34 20 -44 q4 30 -16 48 q24 -16 36 -6 q-14 16 -40 8 Z`}
                            fill="#5E7A4E"
                          />
                          <path
                            d={`M${x - 4} ${y - 28} q-30 -2 -38 -22 q22 -2 38 18 Z`}
                            fill="#7A9663"
                          />
                          <polygon
                            points={`${x - 14},${y - 26} ${x},${y - 33} ${x + 14},${y - 26} ${x},${y - 19}`}
                            fill="#C9B79A"
                          />
                          <polygon
                            points={`${x - 14},${y - 26} ${x},${y - 19} ${x},${y} ${x - 12},${y - 6}`}
                            fill="#A8957A"
                          />
                          <polygon
                            points={`${x},${y - 19} ${x + 14},${y - 26} ${x + 12},${y - 6} ${x},${y}`}
                            fill="#8F7D64"
                          />
                        </g>
                      ))}
                    </svg>
                    {model.chairs
                      .slice(0, 8)
                      .map((c, i) => ({ c, spot: spots[i] }))
                      // Back chairs first, so a front chair is drawn over them.
                      .sort((a, b) => a.spot.y - b.spot.y)
                      .map(({ c, spot }) => {
                        const look = looks[c.state];
                        const on = chair?.professional.id === c.professional.id;
                        const occupied =
                          c.state === "busy" || c.state === "late";
                        return (
                          <button
                            key={c.professional.id}
                            className={`sl-chair tone-${look.tone} ${on ? "is-on" : ""}`}
                            style={{
                              left: `${(spot.x - 58.5) / 9}%`,
                              top: `${(spot.y - 185) / 6}%`,
                            }}
                            onClick={() => setSelected(c.professional.id)}
                            aria-pressed={on}
                            aria-label={`${c.professional.name}: ${look.label}`}
                          >
                            <span className="sl-pill">
                              <Avatar
                                name={c.professional.name}
                                src={c.professional.photo}
                                size={22}
                              />
                              <i />
                              <strong>{first(c.professional.name)}</strong>
                              <b>{short(c)}</b>
                            </span>
                            <svg
                              viewBox="0 0 120 140"
                              aria-hidden="true"
                              style={{
                                transform:
                                  spot.wall === "r" ? "scaleX(-1)" : undefined,
                              }}
                            >
                              <ellipse
                                className="sl-glow"
                                cx="60"
                                cy="122"
                                rx="50"
                                ry="22"
                              />
                              {occupied && (
                                <g>
                                  <rect
                                    x="87"
                                    y="96"
                                    width="5"
                                    height="22"
                                    rx="2"
                                    fill="#1B1511"
                                  />
                                  <rect
                                    x="95"
                                    y="96"
                                    width="5"
                                    height="22"
                                    rx="2"
                                    fill="#1B1511"
                                  />
                                  <path
                                    d="M82 64 Q93 54 104 64 L102 100 L84 100 Z"
                                    fill="#2B211A"
                                  />
                                  <path
                                    d="M87 70 L99 70 L98 100 L88 100 Z"
                                    fill="#8A6430"
                                  />
                                  <path
                                    d="M84 68 L66 56"
                                    stroke="#2B211A"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                  />
                                  <circle
                                    cx="93"
                                    cy="49"
                                    r="9"
                                    fill="#8A6A52"
                                  />
                                  <path
                                    d="M84 47 Q93 36 102 47 Z"
                                    fill="#1B1511"
                                  />
                                </g>
                              )}
                              <ellipse
                                cx="60"
                                cy="120"
                                rx="22"
                                ry="8"
                                fill="#2B221B"
                              />
                              <rect
                                x="56"
                                y="96"
                                width="8"
                                height="24"
                                fill="#9A8F82"
                              />
                              <polygon
                                points="30,92 60,78 92,94 62,108"
                                fill="#2B211A"
                              />
                              <polygon
                                points="30,92 62,108 62,117 30,101"
                                fill="#1B1511"
                              />
                              <polygon
                                points="62,108 92,94 92,103 62,117"
                                fill="#3A2C22"
                              />
                              <polygon
                                points="34,88 60,76 60,30 34,42"
                                fill="#2B211A"
                              />
                              <polygon
                                points="34,42 60,30 60,34 34,46"
                                fill="#C9A465"
                              />
                              <polygon
                                points="40,32 56,24 56,12 40,20"
                                fill="#3A2C22"
                              />
                              <line
                                x1="30"
                                y1="84"
                                x2="62"
                                y2="100"
                                stroke="#C9A465"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                              <line
                                x1="60"
                                y1="72"
                                x2="92"
                                y2="88"
                                stroke="#C9A465"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                              <polygon
                                points="70,114 92,104 100,108 78,118"
                                fill="#9A8F82"
                              />
                              {occupied && (
                                <>
                                  <path
                                    d="M34 96 L70 108 L86 92 Q66 56 46 58 Z"
                                    fill="#F3ECE0"
                                    stroke="#D8CDBB"
                                    strokeWidth="1.5"
                                  />
                                  <circle
                                    cx="54"
                                    cy="48"
                                    r="11"
                                    fill="#7A5A44"
                                  />
                                  <path
                                    d="M44 44 Q54 32 64 44 Z"
                                    fill="#2B211A"
                                  />
                                </>
                              )}
                            </svg>
                          </button>
                        );
                      })}
                  </>
                }
              />
              {model.gap && (
                <Link
                  className="sl-gap-chip"
                  href={`/dashboard/agenda?date=${model.day}`}
                >
                  <span>Vaga sobrando</span>
                  <strong>
                    {model.gap.start} com {first(model.gap.professional.name)}
                  </strong>
                  <em>{model.gap.minutes} min</em>
                </Link>
              )}
              <div className="sl-waiting">
                <span>Na espera</span>
                {model.waiting.length ? (
                  model.waiting.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a.professionalId)}
                    >
                      {a.customerName.split(" ").slice(0, 2).join(" ")}
                    </button>
                  ))
                ) : (
                  <em>ninguém agora</em>
                )}
              </div>
              {assistant && (
                <span className="sl-ai">
                  <i aria-hidden="true" />
                  <strong>Recepcionista IA</strong> atendendo no WhatsApp
                </span>
              )}
            </div>
          </div>
          <aside className="sl-side">
            {chair && <ChairPanel chair={chair} data={data} onOpen={onOpen} />}
            <section className="sl-feed" aria-label="Agora no salão">
              <span className="sl-kicker">Agora no salão</span>
              {model.feed.length ? (
                <ul>
                  {model.feed.map((e, i) => (
                    <li key={i}>
                      <time>{e.time}</time>
                      <span>{e.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Nada novo ainda hoje. Check-ins, reservas e pagamentos
                  aparecem aqui.
                </p>
              )}
            </section>
          </aside>
        </div>
      )}

      {model.chairs.length > 0 && (
        <div className="sl-cards" aria-label="Cadeiras">
          {model.chairs.map((c) => (
            <ChairPanel
              key={c.professional.id}
              chair={c}
              data={data}
              onOpen={onOpen}
              compact
            />
          ))}
        </div>
      )}

      {model.chairs.length > 0 && (
        <div className="sl-mobile-wait">
          <span className="sl-kicker">Na espera · {model.waiting.length}</span>
          {model.waiting.length ? (
            <div>
              {model.waiting.map((a) => (
                <span key={a.id}>
                  {a.customerName.split(" ").slice(0, 2).join(" ")} ·{" "}
                  {dateLabel(a.start, "HH:mm")}
                </span>
              ))}
            </div>
          ) : (
            <p>Ninguém esperando agora.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** The numbered card over each chair in the 3D room. */
function ChairTag({
  chair: c,
  index,
  data,
  on,
  onClick,
}: {
  chair: Chair;
  index: number;
  data: Store;
  on: boolean;
  onClick: () => void;
}) {
  const look = looks[c.state];
  const a = c.current;
  const finishing = c.state === "busy" && c.minutesLeft <= 10;
  const title =
    a && (c.state === "busy" || c.state === "late" || c.state === "due")
      ? services(a, data)
      : c.state === "free"
        ? "Disponível"
        : look.label;
  const line =
    c.state === "busy"
      ? finishing
        ? `Finalizando · ${c.minutesLeft} min restantes`
        : `${dateLabel(a!.start, "HH:mm")} · Em atendimento`
      : c.state === "late"
        ? `${-c.minutesLeft} min além do horário`
        : c.state === "due"
          ? `${dateLabel(a!.start, "HH:mm")} · Hora de começar`
          : c.state === "free"
            ? c.next
              ? `Próximo: ${dateLabel(c.next.start, "HH:mm")}`
              : "Livre até o fim do dia"
            : c.state === "break"
              ? `Volta às ${c.freeUntil}`
              : "Fora do expediente";
  return (
    <button
      type="button"
      className={`sl-tag tone-${finishing ? "due" : look.tone} ${on ? "is-on" : ""}`}
      onClick={onClick}
      aria-pressed={on}
      aria-label={`Cadeira ${index + 1}, ${c.professional.name}: ${line}`}
    >
      <span className="sl-tag-head">
        <b>{index + 1}</b>
        <Avatar
          name={c.professional.name}
          src={c.professional.photo}
          size={22}
        />
        <strong>{first(c.professional.name)}</strong>
      </span>
      <span className="sl-tag-sub">{title}</span>
      <span className="sl-tag-line">
        <i />
        {line}
      </span>
    </button>
  );
}

function ChairPanel({
  chair,
  data,
  onOpen,
  compact = false,
}: {
  chair: Chair;
  data: Store;
  onOpen: (a: Appointment) => void;
  compact?: boolean;
}) {
  const { mutate } = useWorkspace();
  const { canMutate } = usePermissions();
  const { toast } = useToast();
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const look = looks[chair.state];
  const a = chair.current;
  const next = chair.next;
  const due = a ? reais(balanceFor(a, data)) : 0;
  const canEdit = canMutate("appointments");
  async function run(task: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await task();
      toast(done);
    } catch (failure) {
      toast(
        failure instanceof Error
          ? failure.message
          : "Não foi possível atualizar.",
      );
    } finally {
      setBusy(false);
      setPaying(false);
    }
  }
  const start = (appointment: Appointment) =>
    run(
      () =>
        mutate("appointments", "update", {
          id: appointment.id,
          status: "in_progress",
        }),
      `${first(appointment.customerName)} começou com ${first(chair.professional.name)}.`,
    );
  const finish = (method?: PaymentMethod) =>
    run(
      async () => {
        await mutate("appointments", "update", {
          id: a!.id,
          status: "completed",
        });
        if (method && due > 0 && canMutate("payments"))
          await mutate("payments", "create", {
            id: crypto.randomUUID(),
            businessId: data.business.id,
            appointmentId: a!.id,
            amount: due,
            method,
          });
      },
      method && due > 0
        ? `Concluído e ${money(due)} recebido.`
        : "Atendimento concluído.",
    );
  const ask = next
    ? whatsapp(
        next.customerPhone,
        `Oi, ${first(next.customerName)}! Aqui é da ${data.business.name}. Sua cadeira está quase livre, pode vir.`,
      )
    : "";
  return (
    <section
      className={`sl-panel tone-${look.tone} ${compact ? "is-compact" : ""}`}
    >
      <header>
        <span className="sl-avatar" aria-hidden="true">
          {chair.professional.photo ? (
            <img src={chair.professional.photo} alt="" />
          ) : (
            first(chair.professional.name)[0]
          )}
        </span>
        <div>
          <span className="sl-kicker">Cadeira</span>
          <strong>{first(chair.professional.name)}</strong>
        </div>
        <span className="sl-chip">{look.label}</span>
      </header>
      {a && (chair.state === "busy" || chair.state === "late") && (
        <>
          <button className="sl-now" onClick={() => onOpen(a)}>
            <span className="sl-kicker">Na cadeira</span>
            <span className="sl-now-row">
              <strong>{a.customerName}</strong>
              <b>{money(a.price)}</b>
            </span>
            <span className="sl-muted">
              {services(a, data)} · {dateLabel(a.start, "HH:mm")} às{" "}
              {dateLabel(a.end, "HH:mm")}
            </span>
            <span className="sl-bar">
              <i style={{ width: `${Math.round(chair.progress * 100)}%` }} />
            </span>
            <span className="sl-left">
              {chair.state === "late"
                ? `${-chair.minutesLeft} min além do previsto`
                : `Faltam ${chair.minutesLeft} min`}
            </span>
          </button>
          {canEdit &&
            (paying ? (
              <div
                className="sl-methods"
                role="group"
                aria-label="Forma de pagamento"
              >
                {methods.map((m) => (
                  <button
                    key={m.value}
                    disabled={busy}
                    onClick={() => void finish(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
                <button className="sl-link" onClick={() => setPaying(false)}>
                  Voltar
                </button>
              </div>
            ) : (
              <button
                className="sl-btn sl-btn-dark sl-wide"
                disabled={busy}
                onClick={() =>
                  due > 0 && canMutate("payments")
                    ? setPaying(true)
                    : void finish()
                }
              >
                {due > 0
                  ? `Concluir e cobrar ${money(due)}`
                  : "Concluir atendimento"}
              </button>
            ))}
        </>
      )}
      {a && chair.state === "due" && (
        <>
          <button className="sl-now" onClick={() => onOpen(a)}>
            <span className="sl-kicker">
              {a.checkedInAt ? "Já chegou" : "Marcado para agora"}
            </span>
            <span className="sl-now-row">
              <strong>{a.customerName}</strong>
              <b>{dateLabel(a.start, "HH:mm")}</b>
            </span>
            <span className="sl-muted">{services(a, data)}</span>
          </button>
          {canEdit && (
            <button
              className="sl-btn sl-btn-dark sl-wide"
              disabled={busy}
              onClick={() => void start(a)}
            >
              Começar atendimento
            </button>
          )}
        </>
      )}
      {chair.state === "free" && (
        <div className="sl-state">
          <strong>Livre até {chair.freeUntil}</strong>
          {chair.waiting.length > 0 && canEdit && (
            <div className="sl-wait-list">
              <span className="sl-kicker">Chamar da espera</span>
              {chair.waiting.map((w) => (
                <button
                  key={w.id}
                  disabled={busy}
                  onClick={() => void start(w)}
                >
                  <span>
                    <strong>{w.customerName}</strong> ·{" "}
                    {dateLabel(w.start, "HH:mm")}
                  </span>
                  <b>Começar</b>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {chair.state === "break" && (
        <div className="sl-state">
          <strong>Em intervalo · volta às {chair.freeUntil}</strong>
        </div>
      )}
      {chair.state === "off" && (
        <div className="sl-state">
          <strong>Fora do expediente agora</strong>
        </div>
      )}
      {next && (
        <div className="sl-next">
          <span>
            Próximo: <strong>{next.customerName}</strong> ·{" "}
            {dateLabel(next.start, "HH:mm")}
          </span>
          {ask && (chair.state === "busy" || chair.state === "late") && (
            <a href={ask} target="_blank" rel="noreferrer" className="sl-link">
              <WhatsAppIcon size={15} /> Avisar que pode vir
            </a>
          )}
        </div>
      )}
    </section>
  );
}
