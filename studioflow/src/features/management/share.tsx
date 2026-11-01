"use client";
import { onlineBookingEnabled } from "@/lib/online-booking";
import { bookingChannelLinks } from "@/lib/booking-channel-links";
import { OnlineBookingNotice } from "./online-booking-settings";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowSquareOut,
  CalendarCheck,
  Camera,
  Megaphone,
  Copy,
  DownloadSimple,
  InstagramLogo,
  Printer,
  QrCode,
  ShareNetwork,
} from "@phosphor-icons/react/dist/ssr";
import { WhatsAppIcon } from "@/components/brand-icons";
import { Button, Card, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { SegmentIcon } from "@/lib/segments";
import type { Store } from "@/types";
import { ManagementBoundary } from "./shared";
import { hasModule } from "@/lib/modules";
import { SlotsStory } from "./story-slots";
import { LaunchKit } from "./launch-kit";
import { InstagramConnectCard } from "./instagram-publish";
import "./share.css";
import { WorkPhotoStudio } from "./work-photo-studio";

export default function SharePage() {
  const { data } = useWorkspace();
  return (
    <ManagementBoundary>
      {data && <ShareContent store={data} />}
    </ManagementBoundary>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
const displayAddress = (url: string) =>
  url.replace(/^https?:\/\//, "").split(/[?#]/)[0];

/** Story-sized image (1080x1920) with the QR code, for Instagram/WhatsApp. */
async function storyImage(
  store: Store,
  url: string,
  qr: string,
  whatsapp = false,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d")!;
  // The app's own fonts, by the family names the page registered.
  const css = getComputedStyle(document.body);
  const display = `${css.getPropertyValue("--font-display") || "Georgia"}, Georgia, serif`;
  const ui = `${css.getPropertyValue("--font-ui") || "system-ui"}, system-ui, sans-serif`;
  await document.fonts.ready;
  // Paper poster with a double ink frame, like a printed price board.
  ctx.fillStyle = "#f4f0e8";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.strokeStyle = "#16130f";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, 984, 1824);
  ctx.lineWidth = 2;
  ctx.strokeRect(66, 66, 948, 1788);
  ctx.textAlign = "center";
  ctx.fillStyle = "#16130f";
  let y = 330;
  if (store.business.logo) {
    try {
      const logo = await loadImage(store.business.logo);
      const ratio = Math.min(200 / logo.width, 200 / logo.height);
      const width = logo.width * ratio;
      const height = logo.height * ratio;
      ctx.drawImage(
        logo,
        540 - width / 2,
        180 + (200 - height) / 2,
        width,
        height,
      );
      y = 470;
    } catch {
      // A logo the browser cannot read is simply left out.
    }
  }
  ctx.font = `600 92px ${display}`;
  ctx.fillText(store.business.name, 540, y, 900);
  ctx.font = `600 30px ${ui}`;
  ctx.fillStyle = "#8a6430";
  ctx.fillText(
    store.business.category.toUpperCase().split("").join(" "),
    540,
    y + 64,
    960,
  );
  ctx.fillStyle = "#16130f";
  ctx.font = `italic 400 68px ${display}`;
  ctx.fillText("Agende seu horário", 540, 720);
  ctx.fillText(whatsapp ? "pelo WhatsApp" : "pelo celular", 540, 800);
  const card = 620;
  const top = 900;
  ctx.fillStyle = "#fffdf9";
  ctx.fillRect(540 - card / 2, top, card, card);
  ctx.strokeStyle = "#dcd2c2";
  ctx.lineWidth = 2;
  ctx.strokeRect(540 - card / 2, top, card, card);
  const code = await loadImage(qr);
  ctx.drawImage(code, 540 - 260, top + 50, 520, 520);
  ctx.fillStyle = "#6e655b";
  ctx.font = `500 38px ${ui}`;
  ctx.fillText("Aponte a câmera do celular", 540, 1640);
  ctx.fillStyle = "#16130f";
  ctx.font = `600 34px ${ui}`;
  ctx.fillText(displayAddress(url), 540, 1710, 980);
  return canvas.toDataURL("image/png");
}

function download(dataUrl: string, name: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name;
  link.click();
}

function ShareContent({ store }: { store: Store }) {
  const { toast } = useToast();
  const { business } = store;
  const [mode, setMode] = useState<"slots" | "photo" | "poster" | "launch" | null>(null);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const url = `${origin}/${business.slug}`;
  const channels = bookingChannelLinks(store, origin);
  // The poster has two jobs: book online, or check in at the counter.
  const online = onlineBookingEnabled(store.settings);
  const [selectedPoster, setPoster] = useState<"book" | "checkin" | "whatsapp">(
    online ? "book" : channels.whatsapp ? "whatsapp" : "checkin",
  );
  const reception = hasModule(store.access?.modules, "recepcao");
  const poster =
    selectedPoster === "book" && !online
      ? channels.whatsapp
        ? "whatsapp"
        : "checkin"
      : selectedPoster === "whatsapp" && !channels.whatsapp
        ? online
          ? "book"
          : "checkin"
        : selectedPoster === "checkin" && !reception
          ? online
            ? "book"
            : "whatsapp"
          : selectedPoster;
  const posterUrl =
    poster === "checkin" && reception
      ? `${url}/checkin`
      : poster === "whatsapp"
        ? channels.whatsapp
        : channels.online;
  const [qrValue, setQr] = useState({ url: "", image: "" });
  const qr = qrValue.url === posterUrl ? qrValue.image : "";
  useEffect(() => {
    if (!posterUrl) return;
    let alive = true;
    void QRCode.toDataURL(posterUrl, {
      width: 1024,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#16130f", light: "#ffffff" },
    }).then((value) => {
      if (alive) setQr({ url: posterUrl, image: value });
    });
    return () => {
      alive = false;
    };
  }, [posterUrl]);

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("Não foi possível copiar. Selecione o texto e copie.");
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: business.name,
          text: `Agende seu horário na ${business.name}:`,
          url,
        });
      else await copy(url, "Link copiado.");
    } catch {
      // The person closed the share sheet.
    }
  }
  const texts = [
    {
      icon: InstagramLogo,
      title: "Bio do Instagram",
      text: `Agende seu horário online: ${url}`,
    },
    {
      icon: WhatsAppIcon,
      title: "Status do WhatsApp",
      text: `Agora você agenda seu horário na ${business.name} pelo celular, sem esperar resposta. É só escolher o serviço, o profissional e o horário: ${url}`,
    },
    {
      icon: ShareNetwork,
      title: "Mensagem para clientes",
      text: `Oi! Aqui é da ${business.name}. Agora dá para marcar seu horário direto por este link, a qualquer hora: ${url}`,
    },
  ];
  const marketingTexts = online
    ? texts
    : channels.whatsapp
      ? [
          {
            icon: InstagramLogo,
            title: "Bio do Instagram",
            text: `Agende seu horário pelo WhatsApp da ${business.name}: ${channels.whatsapp}`,
          },
          {
            icon: WhatsAppIcon,
            title: "Status do WhatsApp",
            text: `Precisa de um horário na ${business.name}? Fale com a gente pelo WhatsApp e escolha o melhor horário: ${channels.whatsapp}`,
          },
          {
            icon: ShareNetwork,
            title: "Mensagem para clientes",
            text: `Oi! Aqui é da ${business.name}. Para marcar seu próximo atendimento, é só falar com a gente por aqui: ${channels.whatsapp}`,
          },
        ]
      : [];

  // O link principal: o de agendar, ou o WhatsApp quando o link está desligado.
  const mainLink = online ? url : channels.whatsapp;
  const mainMessage = online
    ? `Agende seu horário na ${business.name} pelo celular, a qualquer hora: ${url}`
    : `Marque seu horário na ${business.name} pelo WhatsApp: ${channels.whatsapp}`;
  const modes = (
    [
      online && {
        id: "slots",
        title: "Vagas de hoje",
        hint: "Story com os horários livres",
        icon: CalendarCheck,
      },
      {
        id: "photo",
        title: "Foto do trabalho",
        hint: "Seu corte com a sua marca",
        icon: Camera,
      },
      (online || reception || channels.whatsapp) && {
        id: "poster",
        title: "Cartaz com QR",
        hint: "Para o espelho e o balcão",
        icon: QrCode,
      },
      online && {
        id: "launch",
        title: "Aviso de lançamento",
        hint: "Conte que agora agenda online",
        icon: Megaphone,
      },
    ] as const
  ).filter(Boolean) as {
    id: "slots" | "photo" | "poster" | "launch";
    title: string;
    hint: string;
    icon: typeof Camera;
  }[];
  const current = mode && modes.some((item) => item.id === mode) ? mode : modes[0].id;

  return (
    <div className="share-page">
      <PageHeader
        title="Divulgar"
        description="Seu link, as vagas do dia e o seu trabalho, prontos para postar."
      />
      {!online && <OnlineBookingNotice />}

      {mainLink ? (
        <Card className="share-hero">
          <div className="share-hero-head">
            <span className="share-eyebrow">
              {online ? "Seu link de agendamento" : "Seu link do WhatsApp"}
            </span>
            <a
              className="share-open"
              href={mainLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir <ArrowSquareOut size={15} />
            </a>
          </div>
          <div className="share-url">
            <span>{displayAddress(mainLink)}</span>
          </div>
          <div className="share-actions">
            <Button onClick={() => void copy(mainLink, "Link copiado.")}>
              <Copy size={16} /> Copiar link
            </Button>
            <a
              className="btn btn-secondary share-wa-button"
              href={`https://wa.me/?text=${encodeURIComponent(mainMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={16} /> Mandar no WhatsApp
            </a>
            <Button variant="secondary" onClick={() => void share()}>
              <ShareNetwork size={16} /> Compartilhar
            </Button>
          </div>
          {online && channels.whatsapp && (
            <p className="share-hero-note">
              Prefere conversar antes?{" "}
              <button
                type="button"
                onClick={() =>
                  void copy(channels.whatsapp, "Link do WhatsApp copiado.")
                }
              >
                Copiar o link do WhatsApp da loja
              </button>
            </p>
          )}
          {marketingTexts.length > 0 && (
            <details className="share-ready-texts">
              <summary>Mensagens prontas para copiar</summary>
              <ul role="list">
                {marketingTexts.map(({ icon: Icon, title, text }) => (
                  <li key={title}>
                    <div>
                      <Icon size={17} />
                      <strong>{title}</strong>
                    </div>
                    <p>{text}</p>
                    <Button
                      variant="secondary"
                      onClick={() => void copy(text, `${title}: texto copiado.`)}
                    >
                      <Copy size={15} /> Copiar
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      ) : null}

      <h2 className="share-section-title">Criar post</h2>
      <nav
        className="share-mode-nav"
        style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
        aria-label="O que você quer postar?"
      >
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={current === item.id}
            aria-controls="share-workspace"
            onClick={() => setMode(item.id)}
            className={current === item.id ? "is-selected" : ""}
          >
            <span className="share-mode-icon">
              <item.icon size={22} weight={current === item.id ? "duotone" : "regular"} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </nav>
      <section id="share-workspace" aria-label="Criar post">
        {current === "slots" && <SlotsStory store={store} url={url} />}
        {current === "launch" && <LaunchKit store={store} url={url} />}
        {current === "photo" && (
          <>
            <WorkPhotoStudio
              store={store}
              bookingUrl={channels.online || channels.whatsapp || url}
            />
            <details className="share-instagram-disclosure">
              <summary>
                <InstagramLogo size={20} />
                <span>
                  Publicar direto no Instagram
                  <small>
                    {store.instagramFeed
                      ? "Sua conta está conectada"
                      : "Conecte sua conta profissional"}
                  </small>
                </span>
                <span aria-hidden="true">+</span>
              </summary>
              <InstagramConnectCard store={store} />
            </details>
          </>
        )}
        {current === "poster" && (
          <Card className="share-card share-qr">
            {Number(online) + Number(reception) + Number(!!channels.whatsapp) > 1 && (
              <div className="share-switch" role="tablist" aria-label="Tipo de cartaz">
                {online && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={poster === "book"}
                    className={poster === "book" ? "is-on" : ""}
                    onClick={() => setPoster("book")}
                  >
                    Agendar
                  </button>
                )}
                {channels.whatsapp && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={poster === "whatsapp"}
                    className={poster === "whatsapp" ? "is-on" : ""}
                    onClick={() => setPoster("whatsapp")}
                  >
                    WhatsApp
                  </button>
                )}
                {reception && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={poster === "checkin"}
                    className={poster === "checkin" ? "is-on" : ""}
                    onClick={() => setPoster("checkin")}
                  >
                    Check-in na recepção
                  </button>
                )}
              </div>
            )}
            <div className="share-qr-layout">
              <div className="share-poster" id="share-poster">
                <div className="share-poster-brand">
                  {business.logo ? (
                    <img src={business.logo} alt="" className="share-poster-logo" />
                  ) : (
                    <span className="share-poster-mark">
                      <SegmentIcon category={business.category} size={30} weight="light" />
                    </span>
                  )}
                  <strong>{business.name}</strong>
                  <small>{business.category}</small>
                </div>
                <p className="share-poster-title">
                  {poster === "checkin"
                    ? "Chegou? Avise a equipe por aqui"
                    : poster === "whatsapp"
                      ? "Marque seu horário pelo WhatsApp"
                      : "Agende seu horário pelo celular"}
                </p>
                <div className="share-poster-code">
                  {qr ? (
                    <img src={qr} alt={`QR Code para ${posterUrl}`} />
                  ) : (
                    <QrCode size={64} weight="thin" />
                  )}
                </div>
                <p className="share-poster-hint">Aponte a câmera do celular</p>
                <p className="share-poster-url">{displayAddress(posterUrl)}</p>
              </div>
              <div className="share-qr-side">
                <p className="share-tip">
                  {poster === "checkin"
                    ? 'Deixe no balcão da recepção. O cliente avisa que chegou e aparece "Chegou" na sua agenda e na TV.'
                    : poster === "whatsapp"
                      ? "Quem apontar a câmera abre uma conversa com o WhatsApp da loja."
                      : "Cole no espelho, no balcão ou na porta. Quem apontar a câmera cai direto na sua agenda."}
                </p>
                <div className="share-actions is-stacked">
                  <Button onClick={() => window.print()} disabled={!qr}>
                    <Printer size={16} /> Imprimir cartaz
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!qr}
                    onClick={() =>
                      download(
                        qr,
                        `qrcode-${poster === "checkin" ? "checkin-" : ""}${business.slug}.png`,
                      )
                    }
                  >
                    <DownloadSimple size={16} /> Baixar só o QR Code
                  </Button>
                  {poster !== "checkin" && (
                    <Button
                      variant="secondary"
                      disabled={!qr}
                      onClick={() =>
                        void storyImage(store, posterUrl, qr, poster === "whatsapp")
                          .then((image) => download(image, `stories-${business.slug}.png`))
                          .catch(() => toast("Não foi possível gerar a imagem. Tente de novo."))
                      }
                    >
                      <InstagramLogo size={16} /> Imagem para Stories
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
