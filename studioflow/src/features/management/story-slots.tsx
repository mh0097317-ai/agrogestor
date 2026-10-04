"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { DownloadSimple, InstagramLogo, ShareNetwork } from "@phosphor-icons/react/dist/ssr";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { availableSlots, localDate } from "@/lib/availability";
import { dateLabel, money } from "@/lib/utils";
import type { Store } from "@/types";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/** Photo cropped to cover the box, like CSS object-fit: cover. */
function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale,
    sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, w, h);
}

export interface StoryInput {
  store: Store;
  url: string;
  title: string;
  dayLabel: string;
  times: string[];
  service?: { name: string; price: number };
}

/** Story 1080x1920: foto da casa, horários livres em etiquetas, link e QR. */
export async function slotsStoryImage({ store, url, title, dayLabel, times, service }: StoryInput) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d")!;
  const css = getComputedStyle(document.body);
  const display = `${css.getPropertyValue("--font-display") || "Georgia"}, Georgia, serif`;
  const ui = `${css.getPropertyValue("--font-ui") || "system-ui"}, system-ui, sans-serif`;
  await document.fonts.ready;
  ctx.fillStyle = "#f4f0e8";
  ctx.fillRect(0, 0, 1080, 1920);

  // Photo band with the name over a flat ink veil.
  const band = 640;
  const photo = store.business.cover || store.business.photos?.[0];
  if (photo) {
    try {
      cover(ctx, await loadImage(photo), 1080, band);
    } catch {
      ctx.fillStyle = "#16130f";
      ctx.fillRect(0, 0, 1080, band);
    }
  } else {
    ctx.fillStyle = "#16130f";
    ctx.fillRect(0, 0, 1080, band);
  }
  ctx.fillStyle = "rgba(22, 19, 15, 0.55)";
  ctx.fillRect(0, 0, 1080, band);
  ctx.textAlign = "center";
  ctx.fillStyle = "#d9b77a";
  ctx.font = `700 30px ${ui}`;
  ctx.fillText(store.business.category.toUpperCase().split("").join(" "), 540, 300, 960);
  ctx.fillStyle = "#f4f0e8";
  ctx.font = `500 104px ${display}`;
  ctx.fillText(store.business.name, 540, 410, 960);
  ctx.fillStyle = "#d9b77a";
  ctx.fillRect(470, 460, 140, 3);

  // Title and day.
  ctx.fillStyle = "#16130f";
  ctx.font = `italic 400 92px ${display}`;
  ctx.fillText(title, 540, band + 150, 960);
  ctx.fillStyle = "#6e655b";
  ctx.font = `500 38px ${ui}`;
  ctx.fillText(dayLabel, 540, band + 214, 960);

  // Times as printed tags, 3 per row.
  const shown = times.slice(0, 12);
  const columns = 3,
    tagW = 280,
    tagH = 112,
    gap = 30;
  const left = (1080 - (columns * tagW + (columns - 1) * gap)) / 2;
  const top = band + 290;
  shown.forEach((time, index) => {
    const x = left + (index % columns) * (tagW + gap);
    const y = top + Math.floor(index / columns) * (tagH + gap);
    ctx.fillStyle = "#fffdf9";
    ctx.fillRect(x, y, tagW, tagH);
    ctx.strokeStyle = "#16130f";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, tagW, tagH);
    ctx.fillStyle = "#16130f";
    ctx.font = `500 64px ${display}`;
    ctx.fillText(time, x + tagW / 2, y + 80);
  });
  const rows = Math.ceil(shown.length / columns);
  let y = top + rows * (tagH + gap) + 30;
  ctx.fillStyle = "#8a6430";
  ctx.font = `600 34px ${ui}`;
  if (times.length > shown.length) {
    ctx.fillText(`e mais ${times.length - shown.length} horários`, 540, y);
    y += 56;
  }
  if (service) {
    ctx.fillStyle = "#433a31";
    ctx.font = `500 36px ${ui}`;
    ctx.fillText(`${service.name} · ${money(service.price)}`, 540, y, 960);
  }

  // Footer: QR and link.
  const qr = await QRCode.toDataURL(url, {
    width: 400,
    margin: 1,
    color: { dark: "#16130f", light: "#fffdf9" },
  });
  const code = await loadImage(qr);
  ctx.fillStyle = "#16130f";
  ctx.fillRect(0, 1600, 1080, 320);
  ctx.drawImage(code, 80, 1650, 220, 220);
  ctx.textAlign = "left";
  ctx.fillStyle = "#d9b77a";
  ctx.font = `italic 400 58px ${display}`;
  ctx.fillText("Garanta o seu", 350, 1730, 680);
  ctx.fillStyle = "#f4f0e8";
  ctx.font = `600 32px ${ui}`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), 350, 1795, 680);
  ctx.fillStyle = "#c9bfae";
  ctx.font = `500 28px ${ui}`;
  ctx.fillText("Toque no link ou aponte a câmera", 350, 1845, 680);
  return canvas.toDataURL("image/png");
}

export function SlotsStory({ store, url }: { store: Store; url: string }) {
  const { toast } = useToast();
  const services = store.services.filter((service) => service.active);
  const [day, setDay] = useState<0 | 1>(0);
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [image, setImage] = useState("");
  const [now] = useState(() => new Date());
  const date = localDate(new Date(now.getTime() + day * 86_400_000));
  const times = useMemo(() => {
    if (!serviceId) return [];
    try {
      return availableSlots(store, [serviceId], "any", date, now).map((slot) => slot.time);
    } catch {
      return [];
    }
  }, [store, serviceId, date, now]);
  const service = services.find((item) => item.id === serviceId);

  useEffect(() => {
    if (!times.length || !url) return;
    let alive = true;
    void slotsStoryImage({
      store,
      url,
      title: day === 0 ? "Vagas de hoje" : "Vagas para amanhã",
      dayLabel: dateLabel(`${date}T12:00:00`, "EEEE, d 'de' MMMM"),
      times,
      service: service && { name: service.name, price: service.price },
    })
      .then((value) => alive && setImage(value))
      .catch(() => alive && setImage(""));
    return () => {
      alive = false;
    };
  }, [store, url, day, date, times, service]);

  const name = `vagas-${date}-${store.business.slug}.png`;
  async function share() {
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else {
        download();
        toast("Imagem baixada. Poste nos Stories ou no status.");
      }
    } catch {
      // The person closed the share sheet.
    }
  }
  function download() {
    const link = document.createElement("a");
    link.href = image;
    link.download = name;
    link.click();
  }

  return (
    <Card className="share-card share-story">
      <h2>
        <InstagramLogo size={20} /> Story das vagas
      </h2>
      <p>
        Os horários livres de verdade, direto da agenda, numa imagem pronta para os Stories e o
        status do WhatsApp.
      </p>
      <div className="story-controls">
        <div className="share-switch" role="tablist" aria-label="Dia">
          {(["Hoje", "Amanhã"] as const).map((label, index) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={day === index}
              className={day === index ? "is-on" : ""}
              onClick={() => setDay(index as 0 | 1)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          aria-label="Serviço"
        >
          {services.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {times.length === 0 ? (
        <p className="story-empty">
          {day === 0
            ? "Hoje não tem mais horário livre para este serviço. Tente amanhã."
            : "Amanhã não tem horário livre para este serviço."}
        </p>
      ) : (
        <div className="story-preview">
          {image ? <img src={image} alt="Prévia do story com os horários livres" /> : <span />}
          <div className="story-side">
            <strong>{times.length} horários livres</strong>
            <span>{times.slice(0, 12).join(" · ")}</span>
            <div className="share-actions">
              <Button onClick={() => void share()} disabled={!image}>
                <ShareNetwork size={16} /> Compartilhar
              </Button>
              <Button variant="secondary" onClick={download} disabled={!image}>
                <DownloadSimple size={16} /> Baixar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
