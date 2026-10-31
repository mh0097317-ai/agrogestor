// node narracao/narrar.cjs <reel> [voiceId] [model]
// Gera cada fala pela rota temporária, encaixa no segundo certo sem
// sobrepor e junta no vídeo (out/<reel>-narrado.mp4).
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const [reel, voiceId, model = "eleven_multilingual_v2"] = process.argv.slice(2);
const TEMPO = Number(process.env.TEMPO || 1.08);
const token = fs.readFileSync(process.env.NARRATION_TOKEN_FILE, "utf8").trim();
const base = process.env.NARRATION_URL || "https://studioflowapp.tech";
const lines = JSON.parse(fs.readFileSync(path.join(__dirname, "falas.json"), "utf8"))[reel];
const dir = path.join(__dirname, "audio", `${reel}${voiceId ? "-" + voiceId : ""}`);
fs.mkdirSync(dir, { recursive: true });
const seconds = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
(async () => {
  const placed = [];
  let end = 0;
  for (const [i, [at, text]] of lines.entries()) {
    const file = path.join(dir, `${i}.mp3`);
    if (!fs.existsSync(file)) {
      const res = await fetch(`${base}/api/internal/narration`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-narration-token": token },
        body: JSON.stringify({ action: "speak", text, model, ...(voiceId ? { voiceId } : {}) }),
      });
      if (!res.ok) throw new Error(`fala ${i}: ${res.status} ${await res.text()}`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    const d = seconds(file) / TEMPO;
    const start = Math.max(at, end + 0.12);
    placed.push({ file, start, d, text });
    end = start + d;
  }
  let video = path.join(__dirname, "..", "out", `${reel}.mp4`);
  let vlen = seconds(video);
  // The closing card holds until the last line ends (plus a beat).
  if (end + 0.8 > vlen) {
    const longer = path.join(__dirname, "..", "out", `${reel}-longo.mp4`);
    execFileSync("node", [path.join(__dirname, "..", "engine", "render.cjs"), path.join(__dirname, "..", `${reel}.html`), longer], {
      env: { ...process.env, MIN_DURATION: String(Math.ceil((end + 0.8) * 10) / 10) },
      stdio: "inherit",
    });
    video = longer;
    vlen = seconds(video);
  }
  for (const p of placed) console.log(`${p.start.toFixed(2)}s +${p.d.toFixed(2)}s  ${p.text}`);
  console.log(`fim da fala ${end.toFixed(2)}s / vídeo ${vlen.toFixed(2)}s${end > vlen ? "  ⚠ PASSOU" : ""}`);
  const inputs = placed.flatMap((p) => ["-i", p.file]);
  const delays = placed.map((p, i) => `[${i + 1}:a]atempo=${TEMPO},adelay=${Math.round(p.start * 1000)}:all=1[a${i}]`).join(";");
  const mix = `${delays};${placed.map((_, i) => `[a${i}]`).join("")}amix=inputs=${placed.length}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=7,apad[a]`;
  const out = path.join(__dirname, "..", "out", `${reel}-narrado${voiceId ? "-" + voiceId : ""}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, ...inputs, "-filter_complex", mix,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out]);
  console.log(out);
})().catch((e) => { console.error(e.message); process.exit(1); });
