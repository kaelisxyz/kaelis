// Minimal WAV in and out (mono or stereo, 16-bit PCM or 32-bit float).
import fs from "node:fs";

export function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === "data") data = b.subarray(p + 8, Math.min(b.length, p + 8 + size));
    p += 8 + size + (size & 1);
  }
  const bytes = fmt.bits / 8, n = Math.floor(data.length / bytes / fmt.ch), ch = Array.from({ length: fmt.ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) {
    const o = (i * fmt.ch + c) * bytes;
    ch[c][i] = fmt.tag === 3 ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : data.readInt32LE(o) / 2147483648;
  }
  return { rate: fmt.rate, ch };
}

export function writeWav(file, ch, rate) {
  const n = ch[0].length, c = ch.length, b = Buffer.alloc(44 + n * c * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * c * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(c, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * c * 2, 28); b.writeUInt16LE(c * 2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * c * 2, 40);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[k][i])) * 32767), 44 + (i * c + k) * 2);
  fs.writeFileSync(file, b);
}

// linear resample of one channel
export function resample(x, from, to) {
  if (from === to) return x;
  const n = Math.floor(x.length * to / from), y = new Float32Array(n), r = from / to;
  for (let i = 0; i < n; i++) { const p = i * r, a = Math.floor(p), f = p - a; y[i] = x[a] * (1 - f) + (x[Math.min(a + 1, x.length - 1)] || 0) * f; }
  return y;
}

// first and last sample louder than `db` below the clip's own peak
export function bounds(x, db = -38) {
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const th = peak * 10 ** (db / 20); let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < th) a++;
  while (b > a && Math.abs(x[b]) < th) b--;
  return [a, b, peak];
}
