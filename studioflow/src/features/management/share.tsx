"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowSquareOut,
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
import "./share.css";

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

/** Story-sized image (1080x1920) with the QR code, for Instagram/WhatsApp. */
async function storyImage(store: Store, url: string, qr: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d")!;
  const fill = ctx.createLinearGradient(0, 0, 1080, 1920);
  fill.addColorStop(0, "#07111f");
  fill.addColorStop(0.55, "#0d2847");
  const brand = store.business.color ?? "";
  fill.addColorStop(1, /^#[0-9a-f]{6}$/i.test(brand) ? brand : "#123e69");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
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
  ctx.font = "800 76px Geist, system-ui, sans-serif";
  ctx.fillText(store.business.name.toUpperCase(), 540, y, 960);
  ctx.font = "600 30px Geist, system-ui, sans-serif";
  ctx.fillStyle = "#a9bdd4";
  ctx.fillText(
    store.business.category.toUpperCase().split("").join(" "),
    540,
    y + 64,
    960,
  );
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 64px Geist, system-ui, sans-serif";
  ctx.fillText("Agende seu horário", 540, 720);
  ctx.fillText("pelo celular", 540, 800);
  const card = 620;
  const top = 900;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(540 - card / 2, top, card, card, 48);
  ctx.fill();
  const code = await loadImage(qr);
  ctx.drawImage(code, 540 - 260, top + 50, 520, 520);
  ctx.fillStyle = "#d6e2f0";
  ctx.font = "500 38px Geist, system-ui, sans-serif";
  ctx.fillText("Aponte a câmera do celular", 540, 1640);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 34px Geist, system-ui, sans-serif";
  ctx.fillText(url.replace(/^https?:\/\//, ""), 540, 1710, 980);
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
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const url = `${origin}/${business.slug}`;
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(url, {
      width: 1024,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1220", light: "#ffffff" },
    }).then((value) => {
      if (alive) setQr(value);
    });
    return () => {
      alive = false;
    };
  }, [url]);

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

  return (
    <div className="share-page">
      <PageHeader
        title="Divulgar"
        description="Leve seus clientes para a agenda online."
      />
      <div className="share-grid">
        <Card className="share-card share-link">
          <h2>Seu link de agendamento</h2>
          <div className="share-url">
            <span>{url.replace(/^https?:\/\//, "")}</span>
          </div>
          <div className="share-actions">
            <Button onClick={() => void copy(url, "Link copiado.")}>
              <Copy size={16} /> Copiar link
            </Button>
            <Button variant="secondary" onClick={() => void share()}>
              <ShareNetwork size={16} /> Compartilhar
            </Button>
            <a
              className="share-open"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir página <ArrowSquareOut size={15} />
            </a>
          </div>
        </Card>

        <Card className="share-card share-qr">
          <div className="share-poster" id="share-poster">
            <div className="share-poster-brand">
              {business.logo ? (
                <img src={business.logo} alt="" className="share-poster-logo" />
              ) : (
                <span className="share-poster-mark">
                  <SegmentIcon
                    category={business.category}
                    size={30}
                    weight="light"
                  />
                </span>
              )}
              <strong>{business.name}</strong>
              <small>{business.category}</small>
            </div>
            <p className="share-poster-title">
              Agende seu horário pelo celular
            </p>
            <div className="share-poster-code">
              {qr ? (
                <img src={qr} alt={`QR Code para ${url}`} />
              ) : (
                <QrCode size={64} weight="thin" />
              )}
            </div>
            <p className="share-poster-hint">Aponte a câmera do celular</p>
            <p className="share-poster-url">
              {url.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <div className="share-actions">
            <Button onClick={() => window.print()} disabled={!qr}>
              <Printer size={16} /> Imprimir cartaz
            </Button>
            <Button
              variant="secondary"
              disabled={!qr}
              onClick={() => download(qr, `qrcode-${business.slug}.png`)}
            >
              <DownloadSimple size={16} /> Baixar QR Code
            </Button>
            <Button
              variant="secondary"
              disabled={!qr}
              onClick={() =>
                void storyImage(store, url, qr)
                  .then((image) =>
                    download(image, `stories-${business.slug}.png`),
                  )
                  .catch(() =>
                    toast("Não foi possível gerar a imagem. Tente de novo."),
                  )
              }
            >
              <InstagramLogo size={16} /> Imagem para Stories
            </Button>
          </div>
          <p className="share-tip">
            Cole o cartaz no espelho, no balcão ou na porta. Quem apontar a
            câmera cai direto na sua agenda.
          </p>
        </Card>

        <Card className="share-card share-texts">
          <h2>Textos prontos</h2>
          <ul role="list">
            {texts.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <div>
                  <Icon size={18} />
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
        </Card>
      </div>
    </div>
  );
}
