// Narration for the videos: one WAV per line, made on this machine with Kokoro (open model, Apache-2.0).
// Nothing is sent to an outside service; the first run downloads the model from Hugging Face.
//
//   node audio/make_vo.mjs [voice=am_michael] [speed=0.94]
//
// Lines live in audio/lines.json. `say` is what the voice reads when the spelling would be mispronounced.
import { KokoroTTS } from "kokoro-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const voice = process.argv[2] || "am_michael", speed = +(process.argv[3] || 0.94);
const OUT = path.join(HERE, "work", "vo-" + voice);
fs.mkdirSync(OUT, { recursive: true });
const lines = JSON.parse(fs.readFileSync(path.join(HERE, "lines.json"), "utf8"));

const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
const meta = {};
for (const [id, l] of Object.entries(lines)) {
  const audio = await tts.generate(l.say || l.text, { voice, speed });
  await audio.save(path.join(OUT, id + ".wav"));
  meta[id] = { text: l.text, seconds: +(audio.audio.length / audio.sampling_rate).toFixed(3) };
  console.log(id, meta[id].seconds, l.text);
}
fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ voice, speed, lines: meta }, null, 1));
