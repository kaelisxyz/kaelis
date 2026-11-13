// Can the narration be understood over the music? A speech recogniser (Whisper, local) listens to the finished mixes.
//   node audio/check_mix.mjs
import { pipeline } from "@huggingface/transformers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWav, resample } from "./wav.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base.en", { dtype: "fp32" });
for (const name of ["intro", "live"]) {
  const w = readWav(path.join(HERE, "..", "public", "audio", `kaelis-${name}.wav`)), m = new Float32Array(w.ch[0].length);
  for (let i = 0; i < m.length; i++) m[i] = (w.ch[0][i] + w.ch[1][i]) / 2;
  const out = await asr(resample(m, w.rate, 16000), { chunk_length_s: 30 });
  console.log(name + ":", out.text.trim());
}
