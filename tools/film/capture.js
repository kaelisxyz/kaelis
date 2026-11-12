// Renders site/film.html frame by frame into an MP4 (the guide video).
// Needs: the Kaelis server on :5173, Chrome, and `npm i playwright-core ffmpeg-static` somewhere on NODE_PATH.
// usage: node tools/film/capture.js <framesDir> <out.mp4> [fps=30] [width=1920] [height=1080]
const { chromium } = require("playwright-core");
const ffmpeg = require("ffmpeg-static");
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
(async () => {
  const [dir, out, fps = 30, W = 1920, H = 1080] = process.argv.slice(2);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto((process.env.FILM_URL || "http://localhost:5173/film.html") + "?capture", { waitUntil: "networkidle" });
  const dur = await page.evaluate(() => window.__ready);
  const n = Math.round(dur * fps);
  for (let i = 0; i <= n; i++) {
    await page.evaluate((t) => window.__seek(t), i / fps);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 94 });
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  await browser.close();
  execFileSync(ffmpeg, ["-y", "-framerate", String(fps), "-i", path.join(dir, "f%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "21",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: "inherit" });
  console.log("wrote", out);
})();
