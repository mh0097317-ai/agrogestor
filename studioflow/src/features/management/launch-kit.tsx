"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, DownloadSimple, Megaphone } from "@phosphor-icons/react/dist/ssr";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Store } from "@/types";

type Piece = "post" | "story" | "sticker";

const pieces: { id: Piece; label: string; hint: string; size: [number, number] }[] = [
  { id: "post", label: "Post do feed", hint: "1080 × 1350, para o feed do Instagram", size: [1080, 1350] },
  { id: "story", label: "Story", hint: "1080 × 1920, com QR Code para agendar", size: [1080, 1920] },
  { id: "sticker", label: "Adesivo de espelho", hint: "Quadrado, imprima com 10 cm", size: [1200, 1200] },
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/** Cor da casa, se for escura o bastante para texto claro; senão, a tinta padrão. */
function accentOf(store: Store) {
  const color = store.business.color || "";
  if (!/^#[0-9a-f]{6}$/i.test(color)) return "#16130f";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 150 ? color : "#16130f";
}

/** Quebra o texto em linhas que cabem na largura. */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function coverFill(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) {
  const ratio = Math.max(w / image.width, h / image.height);
  const iw = image.width * ratio;
  const ih = image.height * ratio;
  ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

async function render(piece: Piece, store: Store, url: string) {
  const spec = pieces.find((p) => p.id === piece)!;
  const [w, h] = spec.size;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const css = getComputedStyle(document.body);
  const display = `${css.getPropertyValue("--font-display") || "Georgia"}, Georgia, serif`;
  const ui = `${css.getPropertyValue("--font-ui") || "system-ui"}, system-ui, sans-serif`;
  await document.fonts.ready;
  const { business } = store;
  const accent = accentOf(store);
  const qr = await QRCode.toDataURL(url, { width: 720, margin: 1, color: { dark: "#16130f", light: "#ffffff" } });
  const photo = business.cover || business.photos?.[0] || "";

  if (piece === "sticker") {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    const card = 640;
    ctx.beginPath();
    ctx.roundRect((w - card) / 2, 300, card, card, 40);
    ctx.fill();
    ctx.drawImage(await loadImage(qr), (w - 560) / 2, 340, 560, 560);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4f0e8";
    ctx.font = `italic 400 76px ${display}`;
    ctx.fillText("Seu próximo horário?", w / 2, 170);
    ctx.font = `600 40px ${ui}`;
    ctx.fillStyle = "rgba(244,240,232,0.8)";
    ctx.fillText("Aponte a câmera e agende", w / 2, 240);
    ctx.font = `600 54px ${display}`;
    ctx.fillStyle = "#f4f0e8";
    ctx.fillText(business.name, w / 2, 1060, w - 120);
    ctx.font = `500 30px ${ui}`;
    ctx.fillStyle = "rgba(244,240,232,0.7)";
    ctx.fillText("Agendamento online 24 horas", w / 2, 1120);
    return canvas.toDataURL("image/png");
  }

  // Foto da casa ao fundo, escurecida para o texto.
  ctx.fillStyle = "#16130f";
  ctx.fillRect(0, 0, w, h);
  if (photo) {
    try {
      coverFill(ctx, await loadImage(photo), w, h);
    } catch {
      // Sem a foto, fica o fundo escuro.
    }
  }
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(22,19,15,0.35)");
  shade.addColorStop(0.45, "rgba(22,19,15,0.55)");
  shade.addColorStop(1, "rgba(22,19,15,0.96)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  const pad = 90;
  ctx.textAlign = "left";
  ctx.fillStyle = "#d9b77a";
  ctx.font = `700 30px ${ui}`;
  ctx.fillText("NOVIDADE NA " + business.name.toUpperCase(), pad, piece === "story" ? 190 : 140, w - pad * 2);

  if (business.logo) {
    try {
      const logo = await loadImage(business.logo);
      const size = 120;
      const ratio = Math.min(size / logo.width, size / logo.height);
      ctx.drawImage(logo, w - pad - logo.width * ratio, piece === "story" ? 120 : 70, logo.width * ratio, logo.height * ratio);
    } catch {
      // Logo opcional.
    }
  }

  const title = "Agora você agenda online.";
  const body = "Escolha o serviço, o profissional e o horário pelo celular, a qualquer hora. Sem ligar e sem esperar resposta.";
  ctx.fillStyle = "#ffffff";
  ctx.font = `450 ${piece === "story" ? 104 : 112}px ${display}`;
  const titleLines = lines(ctx, title, w - pad * 2);
  ctx.font = `400 40px ${ui}`;
  const bodyLines = lines(ctx, body, w - pad * 2);

  if (piece === "post") {
    let y = h - 140 - bodyLines.length * 56 - 50 - titleLines.length * 112;
    ctx.font = `450 112px ${display}`;
    ctx.fillStyle = "#ffffff";
    for (const line of titleLines) {
      ctx.fillText(line, pad, y);
      y += 112;
    }
    ctx.fillStyle = "#d9b77a";
    ctx.fillRect(pad, y - 40, 120, 5);
    y += 40;
    ctx.font = `400 40px ${ui}`;
    ctx.fillStyle = "#e9dfcf";
    for (const line of bodyLines) {
      ctx.fillText(line, pad, y);
      y += 56;
    }
    ctx.font = `700 34px ${ui}`;
    ctx.fillStyle = "#16130f";
    const label = "Link na bio";
    const lw = ctx.measureText(label).width + 80;
    ctx.fillStyle = "#f4f0e8";
    ctx.beginPath();
    ctx.roundRect(pad, h - 120, lw, 76, 38);
    ctx.fill();
    ctx.fillStyle = "#16130f";
    ctx.fillText(label, pad + 40, h - 70);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  // Story: título no alto, QR Code no centro, endereço embaixo.
  let y = 420;
  ctx.font = `450 104px ${display}`;
  ctx.fillStyle = "#ffffff";
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += 108;
  }
  ctx.font = `400 40px ${ui}`;
  ctx.fillStyle = "#e9dfcf";
  y += 10;
  for (const line of bodyLines) {
    ctx.fillText(line, pad, y);
    y += 56;
  }
  const card = 560;
  const top = Math.max(y + 60, 1020);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect((w - card) / 2, top, card, card, 36);
  ctx.fill();
  ctx.drawImage(await loadImage(qr), (w - 480) / 2, top + 40, 480, 480);
  ctx.textAlign = "center";
  ctx.font = `600 36px ${ui}`;
  ctx.fillStyle = "#f4f0e8";
  ctx.fillText("Aponte a câmera ou toque no link", w / 2, top + card + 80);
  ctx.font = `700 34px ${ui}`;
  ctx.fillStyle = "#d9b77a";
  ctx.fillText(url.replace(/^https?:\/\//, ""), w / 2, top + card + 136, w - 120);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Kit para a casa avisar os clientes que agora agenda online. */
export function LaunchKit({ store, url }: { store: Store; url: string }) {
  const { toast } = useToast();
  const [piece, setPiece] = useState<Piece>("post");
  const [preview, setPreview] = useState<{ piece: Piece; src: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void render(piece, store, url)
      .then((src) => alive && setPreview({ piece, src }))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [piece, store, url]);
  const name = store.business.name;
  const caption = `Novidade na ${name}! ✂️\n\nAgora você agenda seu horário online: escolhe o serviço, o profissional e o horário pelo celular, a qualquer hora. Sem ligar e sem esperar resposta.\n\nO link está na bio. Te esperamos! 💈`;
  const message = `Oi! Aqui é da ${name}. 😊\n\nAgora você pode agendar seu horário pelo celular, a qualquer hora: ${url}\n\nSalva esse link e, se quiser, adiciona na tela de início do celular para marcar o próximo em segundos.`;
  async function save() {
    setBusy(true);
    try {
      const src = preview?.piece === piece ? preview.src : await render(piece, store, url);
      const link = document.createElement("a");
      link.href = src;
      link.download = `${store.business.slug}-${piece === "post" ? "post" : piece === "story" ? "story" : "adesivo"}.${piece === "sticker" ? "png" : "jpg"}`;
      link.click();
    } catch {
      toast("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copiada.`);
    } catch {
      toast("Não foi possível copiar. Selecione o texto e copie.");
    }
  }
  const current = pieces.find((p) => p.id === piece)!;
  return (
    <Card className="share-card share-launch">
      <h2>
        <Megaphone size={20} /> Kit de lançamento
      </h2>
      <p>Avise seus clientes que agora a {name} agenda online. As artes já saem com a foto, o nome e o QR Code da casa.</p>
      <div className="share-switch" role="tablist" aria-label="Peça do kit">
        {pieces.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={piece === p.id} className={piece === p.id ? "is-on" : ""} onClick={() => setPiece(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className={`share-launch-preview is-${piece}`}>
        {preview?.piece === piece ? <img src={preview.src} alt={`${current.label} da ${name}`} /> : <span>Gerando…</span>}
      </div>
      <p className="share-tip">{current.hint}</p>
      <div className="share-actions">
        <Button onClick={() => void save()} disabled={busy}>
          <DownloadSimple size={16} /> Baixar {current.label.toLowerCase()}
        </Button>
        <Button variant="secondary" onClick={() => void copy(caption, "Legenda do post")}>
          <Copy size={15} /> Copiar legenda
        </Button>
        <Button variant="secondary" onClick={() => void copy(message, "Mensagem para os clientes")}>
          <Copy size={15} /> Mensagem para clientes
        </Button>
      </div>
    </Card>
  );
}
