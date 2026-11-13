// Render a handful of frames to check framing: node stills.mjs <Composition> <out_dir> <frame,frame,...>
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
const [id, out, list] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.jsx") });
const chromiumOptions = { gl: "angle" }, browser = await openBrowser("chrome", { chromiumOptions });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions });
for (const f of list.split(",").map(Number)) {
  await renderStill({ composition, serveUrl, frame: f, output: path.join(out, `${id.toLowerCase()}_${String(f).padStart(4, "0")}.jpg`), imageFormat: "jpeg", jpegQuality: 88, puppeteerInstance: browser, chromiumOptions });
  console.log("still", f);
}
await browser.close({ silent: true });
