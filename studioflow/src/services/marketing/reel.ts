import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { Slide } from "./content";
import { renderSlideJpeg } from "./render";

const run = promisify(execFile);

/** Segundos de cada tela e da transição entre elas. */
const SCENE = 3.2;
const BLEND = 0.5;
const FPS = 30;
const transitions = ["slideleft", "fade", "smoothup", "slideleft", "fade"];

export const reelSeconds = (scenes: number) =>
  +(scenes * SCENE - (scenes - 1) * BLEND).toFixed(1);

/** Monta o comando: zoom lento em cada tela e transições entre elas, áudio mudo. */
export function reelArgs(frames: string[], out: string) {
  const n = frames.length;
  const inputs = frames.flatMap((file) => ["-i", file]);
  const scene = Math.round(SCENE * FPS);
  const filters = frames.map(
    (_, i) =>
      `[${i}:v]scale=1188:2112,zoompan=z='min(zoom+0.0009,1.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${scene}:s=1080x1920:fps=${FPS},setsar=1,format=yuv420p[s${i}]`,
  );
  let last = "s0";
  for (let i = 1; i < n; i++) {
    const offset = (i * (SCENE - BLEND)).toFixed(2);
    const next = i === n - 1 ? "v" : `x${i}`;
    filters.push(
      `[${last}][s${i}]xfade=transition=${transitions[(i - 1) % transitions.length]}:duration=${BLEND}:offset=${offset}[${next}]`,
    );
    last = next;
  }
  const video = n === 1 ? "s0" : "v";
  return [
    "-y",
    ...inputs,
    "-f",
    "lavfi",
    "-t",
    String(reelSeconds(n)),
    "-i",
    "anullsrc=r=44100:cl=stereo",
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${video}]`,
    "-map",
    `${n}:a`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-shortest",
    "-movflags",
    "+faststart",
    out,
  ];
}

/**
 * Transforma as telas que a IA já escreveu num Reel vertical de 9:16, sem
 * nova chamada à IA: cada tela vira uma cena com zoom lento e transição.
 */
export async function renderReelMp4(slides: Slide[]) {
  if (!ffmpegPath) throw new Error("ffmpeg indisponível no servidor.");
  const scenes = slides.slice(0, 7);
  const dir = await mkdtemp(join(tmpdir(), "sf-reel-"));
  try {
    const frames: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const jpeg = await renderSlideJpeg(scenes, i, "reel");
      if (!jpeg) continue;
      const file = join(dir, `${i}.jpg`);
      await writeFile(file, jpeg);
      frames.push(file);
    }
    if (!frames.length) throw new Error("Post sem telas para o vídeo.");
    const out = join(dir, "reel.mp4");
    await run(ffmpegPath, reelArgs(frames, out), {
      timeout: 240_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
