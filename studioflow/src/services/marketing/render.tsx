import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { MarketingFormat, Slide } from "./content";

const colors = {
  paper: "#F4F0E8",
  paper2: "#ECE4D6",
  ink: "#16130F",
  brass: "#7A5626",
  gold: "#A47A3C",
  goldLight: "#D2AE74",
  muted: "#5E554B",
  soft: "#E9DFCF",
};

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600; style: "normal" | "italic" }[]> | null =
  null;
function loadFonts() {
  const dir = join(process.cwd(), "src/services/marketing/fonts");
  fonts ??= Promise.all([
    readFile(join(dir, "fraunces-450.ttf")).then((data) => ({ name: "Fraunces", data, weight: 400 as const, style: "normal" as const })),
    readFile(join(dir, "fraunces-italic-450.ttf")).then((data) => ({ name: "Fraunces", data, weight: 400 as const, style: "italic" as const })),
    readFile(join(dir, "hanken-400.ttf")).then((data) => ({ name: "Hanken", data, weight: 400 as const, style: "normal" as const })),
    readFile(join(dir, "hanken-650.ttf")).then((data) => ({ name: "Hanken", data, weight: 600 as const, style: "normal" as const })),
  ]);
  return fonts;
}

export function slideSize(format: MarketingFormat) {
  return format === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1350 };
}

type Tone = "ink" | "paper" | "paper2" | "brass";
function tone(format: MarketingFormat, index: number, total: number): Tone {
  if (format === "story") return "ink";
  if (total === 1) return "ink";
  if (index === 0) return "ink";
  if (index === total - 1) return "brass";
  return index % 2 ? "paper" : "paper2";
}

function Logo({ dark }: { dark: boolean }) {
  return (
    <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 36, color: dark ? colors.paper : colors.ink }}>
      Studio
      <span style={{ fontStyle: "italic", color: colors.gold }}>Flow</span>
    </div>
  );
}

/** Uma tela da publicação, no visual da marca. */
export function SlideArt({
  slide,
  index,
  total,
  format,
}: {
  slide: Slide;
  index: number;
  total: number;
  format: MarketingFormat;
}) {
  const t = tone(format, index, total);
  const dark = t === "ink" || t === "brass";
  const bg = { ink: colors.ink, paper: colors.paper, paper2: colors.paper2, brass: colors.brass }[t];
  const text = dark ? colors.paper : colors.ink;
  const sub = dark ? colors.soft : colors.muted;
  const cover = index === 0;
  const last = total > 1 && index === total - 1;
  const story = format === "story";
  const titleSize = slide.title.length > 52 ? 78 : slide.title.length > 34 ? 92 : 108;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: bg,
        color: text,
        padding: story ? "160px 90px" : "96px 90px",
        fontFamily: "Hanken",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: 7,
          textTransform: "uppercase",
          color: dark ? colors.goldLight : "#8A6430",
        }}
      >
        {cover ? "Para donos de barbearia" : last ? "StudioFlow" : `${index} / ${total - 2}`}
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      {!cover && !last && (
        <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 200, lineHeight: 0.8, color: colors.gold }}>
          {String(index)}
        </div>
      )}
      <div
        style={{
          display: "flex",
          marginTop: cover || last ? 0 : 36,
          fontFamily: "Fraunces",
          fontSize: titleSize,
          lineHeight: 1.05,
          letterSpacing: -0.5,
          wordSpacing: 6,
        }}
      >
        {slide.title}
      </div>
      <div style={{ display: "flex", width: 120, height: 4, background: colors.gold, margin: "40px 0" }} />
      {slide.body ? (
        <div style={{ display: "flex", fontSize: 40, lineHeight: 1.4, color: sub }}>{slide.body}</div>
      ) : null}
      <div style={{ display: "flex", flex: 1 }} />
      {last || story ? (
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              padding: "22px 42px",
              borderRadius: 60,
              background: colors.paper,
              color: colors.ink,
              fontSize: 36,
              fontWeight: 600,
            }}
          >
            Link na bio
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          bottom: story ? 110 : 64,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 26,
          color: dark ? "#B4A893" : "#8C8276",
        }}
      >
        <Logo dark={dark} />
        <div style={{ display: "flex" }}>{cover && total > 1 ? "Arraste →" : "studioflowapp.tech"}</div>
      </div>
    </div>
  );
}

/** JPEG da tela (o Instagram só aceita JPEG em fotos). */
export async function renderSlideJpeg(
  slides: Slide[],
  index: number,
  format: MarketingFormat,
) {
  const slide = slides[index];
  if (!slide) return null;
  const size = slideSize(format);
  const image = new ImageResponse(
    <SlideArt slide={slide} index={index} total={slides.length} format={format} />,
    { ...size, fonts: await loadFonts() },
  );
  const png = Buffer.from(await image.arrayBuffer());
  return sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
