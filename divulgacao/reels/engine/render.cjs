// node render.cjs reel.html out.mp4 [fps]
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
(async () => {
  const [src, out, fps = "30", only] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto("file://" + path.resolve(src));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const duration = await page.evaluate(() => window.DURATION);
  if (only) {
    // Stills for review: comma-separated seconds.
    for (const s of only.split(",")) {
      await page.evaluate((t) => window.render(t), Number(s));
      await page.screenshot({ path: `${out}-${s}.jpg`, type: "jpeg", quality: 85 });
    }
    await browser.close();
    return;
  }
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", fps, "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "medium", "-r", fps, "-movflags", "+faststart", out],
    { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(duration * Number(fps));
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.render(t), f / Number(fps));
    const buf = await page.screenshot({ type: "jpeg", quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log(`${out}: ${frames} frames, ${duration}s`);
})();
