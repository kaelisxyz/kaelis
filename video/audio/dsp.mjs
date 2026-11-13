// A small synth and mixing kit for the video scores. Everything is rendered offline from numbers:
// no samples, no loops, nothing licensed from anyone. 48 kHz, stereo.
export const SR = 48000;
export const N = (sec) => Math.max(1, Math.ceil(sec * SR));
export const stereo = (sec) => ({ L: new Float32Array(N(sec)), R: new Float32Array(N(sec)) });

export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function hz(name) { // "D2", "Bb1", "C#4"
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const semi = NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (+m[3] + 1) * 12;
  return 440 * 2 ** ((semi - 69) / 12);
}
const val = (v, i) => (typeof v === "number" ? v : v[i]);

// ---- sources
export function noise(n, r) { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = r() * 2 - 1; return y; }
export function sine(f, n, ph = 0) { const y = new Float32Array(n); for (let i = 0; i < n; i++) { y[i] = Math.sin(ph); ph += 2 * Math.PI * val(f, i) / SR; } return y; }
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
export function saw(f, n, ph = 0) { const y = new Float32Array(n); let p = ph % 1; for (let i = 0; i < n; i++) { const dt = val(f, i) / SR; y[i] = 2 * p - 1 - blep(p, dt); p += dt; if (p >= 1) p -= 1; } return y; }
export function square(f, n, ph = 0) { const y = new Float32Array(n); let p = ph % 1; for (let i = 0; i < n; i++) { const dt = val(f, i) / SR; y[i] = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep((p + 0.5) % 1, dt); p += dt; if (p >= 1) p -= 1; } return y; }
// several detuned saws spread across the stereo field
export function supersaw(f, n, r, { voices = 7, cents = 16 } = {}) {
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let v = 0; v < voices; v++) {
    const d = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1, ratio = 2 ** ((d * cents) / 1200), pan = 0.5 + d * 0.42 * (v % 2 ? 1 : -1);
    const fr = typeof f === "number" ? f * ratio : Float32Array.from(f, (x) => x * ratio), s = saw(fr, n, r());
    const gl = Math.cos(pan * Math.PI / 2), gr = Math.sin(pan * Math.PI / 2);
    for (let i = 0; i < n; i++) { L[i] += s[i] * gl; R[i] += s[i] * gr; }
  }
  const g = 1 / Math.sqrt(voices); for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  return { L, R };
}

// ---- shaping
export function mul(x, fn) { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR, i); return x; }
export function gain(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
export function drive(x, d, out = 1) { for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * d) * out; return x; }
export function ramp(n, fn) { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = fn(i / SR, i / n); return y; }
export function fadeEdges(x, a = 0.004, b = 0.01) { const na = Math.min(x.length, N(a)), nb = Math.min(x.length, N(b)); for (let i = 0; i < na; i++) x[i] *= i / na; for (let i = 0; i < nb; i++) x[x.length - 1 - i] *= i / nb; return x; }
export function reverse(x) { return Float32Array.from(x).reverse(); }

// state variable filter (stable when the cutoff moves). type: "lp" | "bp" | "hp"
export function svf(x, cutoff, q = 0.707, type = "lp") {
  const y = new Float32Array(x.length); let ic1 = 0, ic2 = 0, g = 0, k = 1 / q, a1 = 0, a2 = 0, a3 = 0, last = -1;
  for (let i = 0; i < x.length; i++) {
    const fc = Math.max(12, Math.min(val(cutoff, i), SR * 0.45));
    if (fc !== last) { g = Math.tan(Math.PI * fc / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; last = fc; }
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    y[i] = type === "lp" ? v2 : type === "bp" ? v1 : x[i] - k * v1 - v2;
  }
  return y;
}
export const both = (s, fn) => ({ L: fn(s.L, 0), R: fn(s.R, 1) });

// ---- buses
export function place(bus, x, t, g = 1, pan = 0.5) { // mono into a stereo bus, equal power pan
  const o = Math.round(t * SR), gl = Math.cos(pan * Math.PI / 2) * g * Math.SQRT2, gr = Math.sin(pan * Math.PI / 2) * g * Math.SQRT2;
  for (let i = Math.max(0, -o); i < x.length && i + o < bus.L.length; i++) { bus.L[i + o] += x[i] * gl; bus.R[i + o] += x[i] * gr; }
}
export function placeSt(bus, s, t, g = 1) {
  const o = Math.round(t * SR);
  for (let i = Math.max(0, -o); i < s.L.length && i + o < bus.L.length; i++) { bus.L[i + o] += s.L[i] * g; bus.R[i + o] += s.R[i] * g; }
}
export function add(dst, src, g = 1) { const n = Math.min(dst.L.length, src.L.length); for (let i = 0; i < n; i++) { dst.L[i] += src.L[i] * g; dst.R[i] += src.R[i] * g; } return dst; }
export function applyGain(bus, env) { const n = bus.L.length; for (let i = 0; i < n; i++) { const g = typeof env === "number" ? env : env[i]; bus.L[i] *= g; bus.R[i] *= g; } return bus; }
export function stats(bus) { let p = 0, s = 0; const n = bus.L.length; for (let i = 0; i < n; i++) { p = Math.max(p, Math.abs(bus.L[i]), Math.abs(bus.R[i])); s += bus.L[i] ** 2 + bus.R[i] ** 2; } return { peak: +(20 * Math.log10(p + 1e-9)).toFixed(1), rms: +(10 * Math.log10(s / n / 2 + 1e-12)).toFixed(1) }; }

// ---- space
class Comb { constructor(n) { this.b = new Float32Array(n); this.i = 0; this.s = 0; } run(x, fb, damp) { const y = this.b[this.i]; this.s = y * (1 - damp) + this.s * damp; this.b[this.i] = x + this.s * fb; if (++this.i >= this.b.length) this.i = 0; return y; } }
class Allpass { constructor(n) { this.b = new Float32Array(n); this.i = 0; } run(x) { const b = this.b[this.i], y = b - x; this.b[this.i] = x + b * 0.5; if (++this.i >= this.b.length) this.i = 0; return y; } }
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], ALLS = [556, 441, 341, 225];
// returns the wet signal only, with its tail. The low end is cut so the reverb never muddies the bass.
export function reverb(src, { room = 0.86, damp = 0.35, pre = 0.02, tail = 3, lowcut = 220, highcut = 8500 } = {}) {
  const k = SR / 44100, n = src.L.length + N(tail), p = N(pre), out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const [c, spread] of [["L", 0], ["R", 23]]) {
    const combs = COMBS.map((x) => new Comb(Math.round((x + spread) * k))), alls = ALLS.map((x) => new Allpass(Math.round((x + spread) * k))), y = out[c];
    for (let i = 0; i < n; i++) {
      const j = i - p, x = j >= 0 && j < src.L.length ? (src.L[j] + src.R[j]) * 0.015 : 0; let s = 0;
      for (const cb of combs) s += cb.run(x, room, damp);
      for (const ap of alls) s = ap.run(s);
      y[i] = s * 3;
    }
    out[c] = svf(svf(y, lowcut, 0.707, "hp"), highcut, 0.707, "lp");
  }
  return out;
}
// echoes that bounce left and right, each one duller than the last
export function pingpong(x, time, fb = 0.4, cut = 3200, tail = 3) {
  const d = Math.round(time * SR), n = x.length + N(tail), L = new Float32Array(n), R = new Float32Array(n), a = Math.exp(-2 * Math.PI * cut / SR); let sL = 0, sR = 0;
  for (let i = d; i < n; i++) {
    const dry = i - d < x.length ? x[i - d] : 0;
    sL = (dry + R[i - d] * fb) * (1 - a) + sL * a; L[i] = sL;
    sR = L[i - d] * 0.8 * (1 - a) + sR * a; R[i] = sR;
  }
  return { L, R };
}

// ---- dynamics
// a gain curve that dips at every time in `hits` and recovers: the pump you hear when the kick pushes the pads down
export function duck(n, hits, depth = 0.6, release = 0.22, attack = 0.004) {
  const g = new Float32Array(n).fill(1);
  for (const t of hits) { const o = Math.round(t * SR), na = N(attack), len = N(release * 5);
    for (let i = 0; i < len && o + i < n; i++) { if (o + i < 0) continue; const a = i < na ? i / na : 1, v = 1 - depth * a * Math.exp(-Math.max(0, i - na) / SR / release); g[o + i] = Math.min(g[o + i], v); } }
  return g;
}
// how loud a signal is over time (0..1), for ducking the music under the voice
export function follow(bus, attack = 0.03, release = 0.28, ref = 0.08) {
  const n = bus.L.length, e = new Float32Array(n), a = Math.exp(-1 / (attack * SR)), r = Math.exp(-1 / (release * SR)); let s = 0;
  for (let i = 0; i < n; i++) { const x = Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i])); s = x > s ? x + (s - x) * a : x + (s - x) * r; e[i] = Math.min(1, s / ref); }
  return e;
}
export function compress(bus, { thresh = -16, ratio = 3, att = 0.008, rel = 0.16, makeup = 0 } = {}) {
  const n = bus.L.length, a = Math.exp(-1 / (att * SR)), r = Math.exp(-1 / (rel * SR)), mk = 10 ** (makeup / 20); let env = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i])); env = x > env ? x + (env - x) * a : x + (env - x) * r;
    const db = 20 * Math.log10(env + 1e-9), over = db - thresh, g = over > 0 ? 10 ** ((-over * (1 - 1 / ratio)) / 20) : 1;
    bus.L[i] *= g * mk; bus.R[i] *= g * mk;
  }
  return bus;
}
// look-ahead limiter: nothing leaves above `ceil` (linear)
export function limit(bus, ceil = 0.89, look = 0.004, rel = 0.09) {
  const n = bus.L.length, la = N(look), want = new Float32Array(n), r = 1 - Math.exp(-1 / (rel * SR));
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i])); want[i] = p > ceil ? ceil / p : 1; }
  let g = 1;
  for (let i = 0; i < n; i++) {
    let m = 1; for (let j = i; j < i + la && j < n; j++) if (want[j] < m) m = want[j];
    g = m < g ? m : g + (1 - g) * r; if (g > m) g = m;
    bus.L[i] *= g; bus.R[i] *= g;
  }
  return bus;
}
