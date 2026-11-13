// Checks the narration by machine, since nobody listens during the build: the spoken length of each line,
// its pitch, and what a speech recogniser (Whisper, run locally) hears back.
//   node audio/check_vo.mjs [voice=am_michael]
import { pipeline } from "@huggingface/transformers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWav, resample, bounds } from "./wav.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const voice = process.argv[2] || "am_michael", DIR = path.join(HERE, "work", "vo-" + voice);
const meta = JSON.parse(fs.readFileSync(path.join(DIR, "meta.json"), "utf8"));
const asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base.en", { dtype: "fp32" });

function pitch(x, rate) { // median of the autocorrelation peak over voiced frames
  const out = [], W = Math.floor(rate * 0.04);
  for (let s = 0; s + W * 2 < x.length; s += W) {
    let e = 0; for (let i = 0; i < W; i++) e += x[s + i] ** 2;
    if (e / W < 1e-4) continue;
    let best = 0, lag = 0;
    for (let l = Math.floor(rate / 320); l < Math.floor(rate / 60); l++) { let c = 0; for (let i = 0; i < W; i++) c += x[s + i] * x[s + i + l]; if (c > best) { best = c; lag = l; } }
    if (lag) out.push(rate / lag);
  }
  out.sort((a, b) => a - b); return out[out.length >> 1] || 0;
}

let total = 0;
for (const [id, l] of Object.entries(meta.lines)) {
  const w = readWav(path.join(DIR, id + ".wav")), x = w.ch[0], [a, b] = bounds(x);
  const spoken = (b - a) / w.rate; total += spoken;
  const heard = (await asr(resample(x, w.rate, 16000))).text.trim();
  l.lead = +(a / w.rate).toFixed(3); l.spoken = +spoken.toFixed(3); l.heard = heard; l.hz = Math.round(pitch(x, w.rate));
  console.log(id.padEnd(4), String(l.spoken).padEnd(6), String(l.hz).padEnd(4), "|", l.text, "=>", heard);
}
fs.writeFileSync(path.join(DIR, "meta.json"), JSON.stringify(meta, null, 1));
console.log("spoken total", total.toFixed(2));
