// The sound of the two videos: a score written in code, the narration, and the mix.
//
//   node audio/make_mix.mjs [intro|live|all] [voice=am_michael]
//
// Tempo 120 (one beat = 15 frames, one bar = 2 s), key of D minor, half-time drums: Dm, Bb, Gm, A.
// Every hit sits on a frame the picture cuts or moves on (audio/timeline.json holds the narration times).
// Out: public/audio/kaelis-intro.wav, public/audio/kaelis-live.wav and src/vo.json (when each line is spoken, for the type).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWav, writeWav, resample, bounds } from "./wav.mjs";
import { SR, N, stereo, rng, hz, noise, sine, saw, square, supersaw, mul, gain, drive, ramp, fadeEdges, reverse, svf, both, place, placeSt, add, applyGain, stats, reverb, pingpong, duck, follow, compress, limit } from "./dsp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WHICH = process.argv[2] || "all", VOICE = process.argv[3] || "am_michael";
const TL = JSON.parse(fs.readFileSync(path.join(HERE, "timeline.json"), "utf8"));
const LINES = JSON.parse(fs.readFileSync(path.join(HERE, "lines.json"), "utf8"));
const r = rng(5), TAU = Math.PI * 2, exp = Math.exp, sin = Math.sin;

// ------------------------------------------------------------------ instruments
function kick() {
  const n = N(0.7), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (46 + 175 * exp(-t / 0.011) + 36 * exp(-t / 0.07)) / SR; y[i] = sin(ph) * exp(-t / 0.24) + (r() * 2 - 1) * exp(-t / 0.0018) * 0.3; }
  return fadeEdges(drive(y, 1.7, 0.85), 0.0005, 0.05);
}
function bass808(f, dur) { // a sine that drops onto its note, driven hard enough to be heard on a phone
  const n = N(dur + 0.12), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + 0.55 * exp(-t / 0.028)) / SR;
    y[i] = (sin(ph) + 0.12 * sin(2 * ph)) * Math.min(1, t / 0.004) * (t < dur ? exp(-t / 1.1) : exp(-dur / 1.1) * exp(-(t - dur) / 0.035)); }
  return svf(drive(y, 2.4, 0.7), 1400, 0.7, "lp");
}
function clap() {
  const n = N(0.6), nz = noise(n, r), bp = svf(nz, 1700, 0.8, "bp"), hi = svf(nz, 5200, 0.7, "hp"), y = new Float32Array(n), b = (x) => (x >= 0 ? exp(-x / 0.004) : 0);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = bp[i] * 1.6 * (b(t) + b(t - 0.011) + b(t - 0.023) + (t > 0.03 ? exp(-(t - 0.03) / 0.1) : 0)) + hi[i] * exp(-t / 0.045) * 0.35 + sin(TAU * 188 * t) * exp(-t / 0.05) * 0.5; }
  return fadeEdges(y, 0.0003, 0.05);
}
function hat(open = false) { const n = N(open ? 0.4 : 0.09), y = svf(noise(n, r), 7600, 0.8, "hp"); return fadeEdges(mul(y, (t) => exp(-t / (open ? 0.11 : 0.017))), 0.0003, 0.01); }
function tom(f = 82) { const n = N(0.5), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + 0.8 * exp(-t / 0.03)) / SR; y[i] = sin(ph) * exp(-t / 0.16); } return fadeEdges(drive(y, 1.6, 0.8), 0.0005, 0.03); }
function pluck(f, bright = 1, len = 0.55, decay = 0.15) {
  const n = N(len), a = saw(f, n, r()), b = saw(f * 1.006, n, r()), c = square(f / 2, n, r()), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = a[i] + b[i] * 0.8 + c[i] * 0.5;
  const y = svf(x, ramp(n, (t) => 240 + 4200 * bright * exp(-t / 0.065)), 2.4, "lp");
  return fadeEdges(gain(mul(y, (t) => Math.min(1, t / 0.002) * exp(-t / decay)), 0.4), 0.0005, 0.02);
}
function bell(f, len = 1.8) {
  const n = N(len), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = sin(TAU * f * t + 2.4 * exp(-t / 0.22) * sin(TAU * f * 3.5 * t)) * exp(-t / 0.45) + 0.25 * sin(TAU * 2 * f * t) * exp(-t / 0.18); }
  return fadeEdges(y, 0.002, 0.05);
}
function padChord(notes, dur, { c0 = 500, c1 = 1700, att = 0.2, rel = 0.6 } = {}) {
  const n = N(dur + rel), out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const f of notes) { const s = supersaw(f, n, r, { voices: 5, cents: 14 }); for (let i = 0; i < n; i++) { out.L[i] += s.L[i]; out.R[i] += s.R[i]; } }
  const cut = ramp(n, (t, u) => (c0 + (c1 - c0) * u) * (1 + 0.15 * sin(TAU * 0.35 * t)));
  const f = both(out, (x) => svf(x, cut, 0.9, "lp")), g = 1 / Math.sqrt(notes.length);
  for (const c of [f.L, f.R]) mul(c, (t) => g * Math.min(1, t / att) * (t < dur ? 1 : exp(-(t - dur) / (rel / 3))));
  return f;
}
function braam(f, dur) { // the low brass wall of a trailer: detuned saws that growl up to pitch, pushed into distortion
  const n = N(dur + 1.3), fr = ramp(n, (t) => f * 2 ** ((-45 * exp(-t / 0.09)) / 1200)), a = supersaw(fr, n, r, { voices: 7, cents: 24 }), b = supersaw(Float32Array.from(fr, (x) => x * 2), n, r, { voices: 5, cents: 18 });
  const cut = ramp(n, (t) => (t < 0.14 ? 180 + 2200 * (t / 0.14) : 600 + 1780 * exp(-(t - 0.14) / (dur * 0.6)))), sub = sine(f / 2, n);
  const env = (t) => Math.min(1, t / 0.025) * (t < dur ? 1 : exp(-(t - dur) / 0.4));
  return both({ L: a.L, R: a.R }, (x, c) => { const o = c ? b.R : b.L, m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = x[i] + o[i] * 0.6;
    const y = drive(svf(m, cut, 1.4, "lp"), 2.6, 0.6); for (let i = 0; i < n; i++) y[i] = (y[i] + sub[i] * 0.5) * env(i / SR); return y; });
}
function impact() {
  const n = N(2.6), nz = noise(n, r), thud = svf(nz, ramp(n, (t) => 120 + 900 * exp(-t / 0.05)), 0.7, "lp"), crack = svf(nz, 2800, 0.7, "hp"), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (30 + 70 * exp(-t / 0.06)) / SR; y[i] = sin(ph) * exp(-t / 0.75) + thud[i] * exp(-t / 0.3) * 0.9 + crack[i] * exp(-t / 0.02) * 0.35; }
  return fadeEdges(drive(y, 1.5, 0.8), 0.0005, 0.2);
}
function subdrop() { const n = N(2.2), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (30 + 50 * exp(-t / 0.35)) / SR; y[i] = sin(ph) * Math.min(1, t / 0.01) * exp(-t / 0.9); } return fadeEdges(drive(y, 1.3, 0.8), 0.001, 0.2); }
function riser(dur, top = 9000) {
  const n = N(dur), tone = saw(ramp(n, (t, u) => 110 * 2 ** (2 * u)), n); let ph = 0;
  const trem = ramp(n, (t, u) => { ph += TAU * (5 + 21 * u * u) / SR; return 0.5 + 0.5 * sin(ph); }), tl = svf(tone, 2500, 0.8, "lp"), cut = ramp(n, (t, u) => 350 * (top / 350) ** (u ** 1.4));
  return both({ L: noise(n, r), R: noise(n, r) }, (x) => { const y = svf(x, cut, 1.6, "bp"); for (let i = 0; i < n; i++) { const u = i / n; y[i] = y[i] * u ** 2.3 + tl[i] * trem[i] * u * u * 0.3; } return fadeEdges(y, 0.01, 0.008); });
}
function revSwell(dur) { // a cymbal's reverb tail played backwards: the air being sucked out before a hit
  const c = mul(svf(noise(N(0.9), r), 5200, 0.7, "hp"), (t) => exp(-t / 0.3)), wet = reverb({ L: c, R: c }, { room: 0.92, tail: dur, lowcut: 500 }), n = N(dur);
  return both(wet, (x) => fadeEdges(mul(reverse(x.subarray(0, n)), (t) => (t / dur) ** 1.5), 0.02, 0.005));
}
function whoosh(dur = 0.5, dir = 1) {
  const n = N(dur), cut = ramp(n, (t, u) => 400 + 3800 * sin(Math.PI * u) ** 2), s = both({ L: noise(n, r), R: noise(n, r) }, (x) => svf(x, cut, 1.2, "bp"));
  for (let i = 0; i < n; i++) { const u = i / n, a = sin(Math.PI * u) ** 2, p = dir > 0 ? u : 1 - u; s.L[i] *= a * Math.cos(p * Math.PI / 2); s.R[i] *= a * sin(p * Math.PI / 2); }
  return s;
}
function drone(dur) {
  const n = N(dur), d1 = hz("D1"), d2 = hz("D2");
  return both({ L: noise(n, r), R: noise(n, r) }, (nz, c) => { const p = c * 1.7, a = sine(d1, n), b = sine(d2, n), s1 = saw(d2, n, r()), s2 = saw(d2 * 1.004, n, r()), m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = s1[i] + s2[i];
    const lo = svf(m, ramp(n, (t) => 150 + 90 * sin(TAU * 0.09 * t + p)), 1.2, "lp"), air = svf(nz, 6500, 0.7, "hp"), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] = a[i] * 0.55 + b[i] * 0.3 * (0.8 + 0.2 * sin(TAU * 0.13 * t + p)) + lo[i] * 0.22 + air[i] * 0.012 * (0.6 + 0.4 * sin(TAU * 0.21 * t + p)); }
    return y; });
}
function tick() { return fadeEdges(mul(svf(noise(N(0.03), r), 3000, 0.7, "hp"), (t) => exp(-t / 0.003)), 0.0002, 0.005); }
function servo() { const n = N(0.24), y = svf(saw(ramp(n, (t, u) => 170 + 390 * u * u), n), 900, 3, "bp"); return fadeEdges(mul(y, (t, i) => sin(Math.PI * i / n) * 0.5), 0.005, 0.01); }
function clank() { const n = N(0.5), y = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; y[i] = sin(TAU * 520 * t + 3 * exp(-t / 0.05) * sin(TAU * 520 * 2.76 * t)) * exp(-t / 0.09) * 0.6 + sin(TAU * 70 * t) * exp(-t / 0.12); } return fadeEdges(y, 0.0005, 0.05); }
function buzz(f, dur) { const n = N(dur + 0.1), a = saw(f, n), b = square(f / 2, n), y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = a[i] + b[i] * 0.7; return fadeEdges(mul(svf(drive(y, 5, 0.5), 1800, 1, "lp"), (t) => (t < dur ? 1 : exp(-(t - dur) / 0.02))), 0.002, 0.02); }

const KICK = kick(), CLAP = clap(), HAT = hat(), OHAT = hat(true), TOM = tom(), TICK = tick(), IMPACT = impact(), SUBDROP = subdrop();

// ------------------------------------------------------------------ the narration
function voice(id) { // trimmed, pitched a little lower, cleaned up. Returns the samples and how long the words last
  const w = readWav(path.join(HERE, "work", "vo-" + VOICE, id + ".wav")), src = w.ch[0], [a, b] = bounds(src, -52);
  let x = resample(src.slice(Math.max(0, a - Math.round(0.02 * w.rate)), Math.min(src.length, b + Math.round(0.22 * w.rate))), w.rate * TL.pitch, SR);
  x = svf(x, 85, 0.707, "hp");
  const air = svf(x, 3200, 0.7, "hp"), body = svf(x, 230, 0.7, "lp");
  for (let i = 0; i < x.length; i++) x[i] = x[i] + air[i] * 0.4 + body[i] * 0.15;
  let s = 0, c = 0; for (const v of x) if (Math.abs(v) > 0.01) { s += v * v; c++; }
  gain(x, 0.15 / Math.sqrt(s / Math.max(1, c)));                       // every line at the same loudness
  const bus = { L: x, R: Float32Array.from(x) }; compress(bus, { thresh: -26, ratio: 4.5, att: 0.003, rel: 0.1, makeup: 9 });   // squeezed hard: the quiet last syllables must survive the music
  return { x: fadeEdges(drive(bus.L, 1.15, 0.92), 0.004, 0.03), spoken: (b - a) / w.rate / TL.pitch };
}

// ------------------------------------------------------------------ the band
const CH = {
  Dm: { bass: "D2", pad: ["D3", "A3", "D4", "F4", "A4"], pl: ["D4", "A4", "D5", "F5", "A4", "D5"], mel: [["A5", 0], ["F5", 6], ["D5", 12]] },
  Bb: { bass: "Bb1", pad: ["Bb2", "F3", "Bb3", "D4", "F4"], pl: ["D4", "Bb4", "D5", "F5", "Bb4", "D5"], mel: [["F5", 0], ["D5", 6], ["Bb4", 12]] },
  Gm: { bass: "G1", pad: ["G2", "D3", "G3", "Bb3", "D4"], pl: ["D4", "G4", "Bb4", "D5", "G4", "Bb4"], mel: [["G5", 0], ["D5", 6], ["Bb4", 12]] },
  A: { bass: "A1", pad: ["A2", "E3", "A3", "C#4", "E4"], pl: ["C#4", "E4", "A4", "C#5", "E4", "A4"], mel: [["E5", 0], ["C#5", 6], ["A4", 10], ["E5", 14]] },
};
const S16 = 0.125; // a sixteenth note
const BED = 0.8;   // the music sits this far under the narration (measured: voice about -15 LUFS, music about -21 under it)
function session(sec) { const B = { kicks: [] }; for (const k of ["kick", "bass", "drums", "pluck", "pad", "bell", "fx", "ui", "vo", "drone"]) B[k] = stereo(sec); return B; }
function hitKick(B, t, g = 0.8) { place(B.kick, KICK, t, g); B.kicks.push(t); }
function groove(B, t0, name, { kicks = [0, 10], clapOn = true, hats = 1, plk = 1, mel = 1, pad = 1, roll = false, bright = 1 } = {}) {
  const c = CH[name];
  for (const k of kicks) { hitKick(B, t0 + k * S16); place(B.bass, bass808(hz(c.bass), k === 0 ? 1.0 : 0.6), t0 + k * S16, 0.38); }
  if (clapOn) place(B.drums, CLAP, t0 + 8 * S16, 0.64, 0.52);
  if (hats) for (let s = 0; s < 16; s++) {
    if (roll && s >= 14) { for (let j = 0; j < 3; j++) place(B.drums, HAT, t0 + (s + j / 3) * S16, hats * (0.17 + 0.06 * ((s - 14) * 3 + j)), 0.62); continue; }
    if (s % 2 === 0) place(B.drums, HAT, t0 + s * S16, hats * (s % 4 === 0 ? 0.34 : 0.22), 0.6);
    else if (s === 7 || s === 13) place(B.drums, HAT, t0 + s * S16, hats * 0.14, 0.64);
    if (s === 6 && !roll) place(B.drums, OHAT, t0 + s * S16, hats * 0.15, 0.4);
  }
  if (plk) [0, 3, 6, 8, 11, 14].forEach((s, j) => place(B.pluck, pluck(hz(c.pl[j]), bright * (j % 3 === 0 ? 1 : 0.7)), t0 + s * S16, 0.8 * plk * (j % 3 === 0 ? 1 : 0.75), j % 2 ? 0.68 : 0.32));
  if (mel) for (const [nn, s] of c.mel) place(B.bell, bell(hz(nn)), t0 + s * S16, 0.15 * mel, 0.5 + (s % 4 ? 0.12 : -0.12));
  if (pad) placeSt(B.pad, padChord(c.pad.map(hz), 2.0, { c0: 600 * bright, c1: 2200 * bright }), t0, 0.22 * pad);
}
function drop(B, t, big = 1) { place(B.fx, IMPACT, t, 0.7 * big); place(B.fx, SUBDROP, t, 0.38 * big); }

// ------------------------------------------------------------------ mixdown
function mixdown(B, sec, name) {
  const n = N(sec), pump = duck(n, B.kicks, 0.55, 0.2), light = duck(n, B.kicks, 0.3, 0.12);
  applyGain(B.pad, pump); applyGain(B.pluck, light); applyGain(B.bell, light); applyGain(B.drone, pump); applyGain(B.bass, duck(n, B.kicks, 0.5, 0.03));
  // sends: one long hall, one dotted-eighth echo
  const send = stereo(sec); add(send, B.drums, 0.3); add(send, B.bell, 0.6); add(send, B.pad, 0.3); add(send, B.fx, 0.32); add(send, B.ui, 0.6); add(send, B.pluck, 0.18);
  const hall = reverb(send, { room: 0.89, damp: 0.38, pre: 0.025, tail: 0.1 });
  const echoIn = new Float32Array(n); for (let i = 0; i < n; i++) echoIn[i] = (B.pluck.L[i] + B.pluck.R[i]) * 0.3 + (B.ui.L[i] + B.ui.R[i]) * 0.35 + (B.bell.L[i] + B.bell.R[i]) * 0.25;
  const echo = pingpong(echoIn, 0.375, 0.42, 2800, 0.1);
  const room = reverb(B.vo, { room: 0.62, damp: 0.5, pre: 0.012, tail: 0.1, lowcut: 350, highcut: 6000 });

  const music = stereo(sec);
  for (const k of ["pluck", "pad", "bell", "ui", "drone"]) add(music, B[k]);
  add(music, hall, 1.0); add(music, echo, 0.9);
  // the voice comes first: while it speaks the music steps back, most of all in the range speech lives in
  const said = follow(B.vo, 0.05, 0.5, 0.05);
  for (const c of ["L", "R"]) { const mid = svf(music[c], 2100, 0.55, "bp"); for (let i = 0; i < n; i++) music[c][i] = (music[c][i] - mid[i] * 0.6 * said[i]) * (1 - 0.66 * said[i]); }
  const fxg = new Float32Array(n), drg = new Float32Array(n), lowg = new Float32Array(n); for (let i = 0; i < n; i++) { fxg[i] = 1 - 0.6 * said[i]; drg[i] = 1 - 0.45 * said[i]; lowg[i] = 1 - 0.48 * said[i]; }
  applyGain(B.fx, fxg); applyGain(B.drums, drg); applyGain(B.kick, lowg); applyGain(B.bass, lowg);

  const bed = stereo(sec); add(bed, music); add(bed, B.fx); add(bed, B.drums); add(bed, B.kick); add(bed, B.bass);
  const talk = stereo(sec); add(talk, B.vo, 1.0); add(talk, room, 0.5);
  if (process.env.STEMS) { writeWav(path.join(HERE, "work", `${name}-bed.wav`), [bed.L, bed.R], SR); writeWav(path.join(HERE, "work", `${name}-talk.wav`), [talk.L, talk.R], SR); }
  const out = stereo(sec); add(out, bed, BED); add(out, talk, 1.12);
  for (const c of ["L", "R"]) out[c] = svf(out[c], 32, 0.707, "hp");
  const pre = stats(out);
  compress(out, { thresh: -9, ratio: 1.7, att: 0.02, rel: 0.2, makeup: 1.5 });
  limit(out, 0.89);
  const fo = N(0.35); for (let i = 0; i < fo; i++) { const g = i / fo; out.L[n - 1 - i] *= g; out.R[n - 1 - i] *= g; }
  for (let i = 0; i < 96; i++) { out.L[i] *= i / 96; out.R[i] *= i / 96; }
  fs.mkdirSync(path.join(HERE, "..", "public", "audio"), { recursive: true });
  const file = path.join(HERE, "..", "public", "audio", `kaelis-${name}.wav`);
  writeWav(file, [out.L, out.R], SR);
  const parts = {}; for (const k of ["kick", "bass", "drums", "pluck", "pad", "bell", "fx", "ui", "drone", "vo"]) parts[k] = stats(B[k]);
  console.log(name, "premaster", pre, "final", stats(out), "\n ", JSON.stringify(parts));
  return file;
}
function narrate(B, which) { const out = {}; for (const [id, t] of Object.entries(TL[which].vo)) { const v = voice(id); place(B.vo, v.x, t - 0.02, 1.0); out[id] = { at: t, spoken: +v.spoken.toFixed(3), text: LINES[id].text }; } return out; }
const bellAt = (B, note, t, g = 0.14, pan = 0.5, len = 1.8) => place(B.ui, bell(hz(note), len), t, g, pan);

// ------------------------------------------------------------------ intro, 10 s
// bar 1 the floors switch on · bar 2 the eye opens, then silence · bar 3 the drop · bar 4 the line · bar 5 the last hit
function intro() {
  const T = TL.intro.seconds, B = session(T), vo = narrate(B, "intro");
  placeSt(B.drone, drone(T), 0, 0.26); applyGain(B.drone, ramp(N(T), (t) => Math.min(1, t / 0.25) * (t > 3.55 && t < 4 ? 0.05 : t < 4 ? 0.4 : t < 8 ? 0.3 : 0.4)));
  place(B.fx, IMPACT, 0, 0.3);
  ["D4", "E4", "F4", "G4", "A4", "Bb4", "C5", "D5", "E5"].forEach((nn, i) => { const t = (2 + i * 5.4) / 30; bellAt(B, nn, t, 0.1 + i * 0.008, 0.3 + i * 0.05, 1.3); place(B.ui, TICK, t, 0.3, 0.3 + i * 0.05); }); // one note per floor
  for (const [t, g] of [[0.5, 0.35], [1.0, 0.4], [1.5, 0.45], [2.0, 0.55], [2.5, 0.6], [3.0, 0.7], [3.25, 0.6], [3.5, 0.75]]) place(B.fx, TOM, t, g, 0.5);
  placeSt(B.fx, riser(1.6), 2.0, 0.24);
  const eye = (60 + 32) / 30; place(B.ui, servo(), eye - 0.12, 0.3, 0.6); bellAt(B, "A5", eye, 0.2, 0.6, 2.2); bellAt(B, "D6", eye + 0.06, 0.1, 0.4, 2.0); place(B.fx, TOM, eye, 0.5);
  placeSt(B.fx, revSwell(0.7), 3.3, 0.5); placeSt(B.fx, whoosh(0.4), 3.62, 0.35);
  drop(B, 4.0); placeSt(B.fx, braam(hz("D2"), 1.3), 4.0, 0.36);
  groove(B, 4, "Dm"); groove(B, 6, "Bb", { roll: true });
  placeSt(B.fx, riser(1.0, 7000), 7.0, 0.22); placeSt(B.fx, revSwell(0.6), 7.4, 0.35);
  drop(B, 8.0, 0.72); hitKick(B, 8.0); place(B.bass, bass808(hz("D2"), 1.4), 8.0, 0.45); placeSt(B.fx, braam(hz("D2"), 1.0), 8.0, 0.3);
  placeSt(B.pad, padChord(CH.Dm.pad.map(hz), 1.5, { c0: 1400, c1: 500, rel: 1.2 }), 8.0, 0.18);
  [["A5", 8.0], ["F5", 8.375], ["D5", 8.75], ["A4", 9.125]].forEach(([nn, t], j) => place(B.bell, bell(hz(nn)), t, 0.12 - j * 0.02, j % 2 ? 0.62 : 0.38));
  return { file: mixdown(B, T, "intro"), vo };
}

// ------------------------------------------------------------------ live, 30 s
// 0 the K · 2 the corridor · 4 the Assay Room (drop) · 8 the ledger · 12 the Archive · 16 the wallet behind the token (drums out)
// 20 the Gate (second drop) · 24.5 allow, warn, block · 26.5 the close
function live() {
  const T = TL.live.seconds, B = session(T), vo = narrate(B, "live");
  placeSt(B.drone, drone(T), 0, 0.26);
  applyGain(B.drone, ramp(N(T), (t) => Math.min(1, t / 0.2) * (t < 4 ? 0.55 : t < 16 ? 0.22 : t < 20 ? 0.6 : t < 24 ? 0.22 : t < 26.5 ? 0.12 : 0.4)));
  drop(B, 0, 0.9); placeSt(B.fx, braam(hz("D2"), 1.3), 0, 0.34);
  for (const [t, g] of [[2.0, 0.45], [2.5, 0.5], [3.0, 0.6], [3.25, 0.55], [3.5, 0.65], [3.625, 0.6], [3.75, 0.7], [3.875, 0.75]]) place(B.fx, TOM, t, g, 0.5);
  placeSt(B.fx, revSwell(0.6), 1.4, 0.4);
  for (let k = 0; k < 16; k++) place(B.pluck, pluck(hz(["D4", "A4", "D5", "A4"][k % 4]), 0.35 + k * 0.07), 2 + k * S16, 0.45 + k * 0.035, k % 2 ? 0.66 : 0.34); // the corridor: a pulse that opens up
  for (const t of [2.0, 2.5, 3.0, 3.5]) hitKick(B, t, 0.7);
  place(B.bass, bass808(hz("D2"), 1.7), 2.0, 0.32);
  placeSt(B.fx, riser(2.0), 2.0, 0.3); place(B.ui, servo(), 3.25, 0.3, 0.35); placeSt(B.fx, revSwell(0.7), 3.3, 0.5);
  drop(B, 4.0);
  groove(B, 4, "Dm"); groove(B, 6, "Bb", { roll: true }); groove(B, 8, "Gm"); groove(B, 10, "A", { roll: true });
  place(B.ui, clank(), 9.5, 0.4, 0.55);                                           // the seal comes down
  placeSt(B.fx, whoosh(0.45), 11.6, 0.3);
  groove(B, 12, "Dm", { plk: 0.6, mel: 1.3, clapOn: false, bright: 0.8 }); groove(B, 14, "Bb", { plk: 0.6, mel: 1.3, bright: 0.8, roll: true });
  const pr = rng(9); for (let i = 0; i < 14; i++) bellAt(B, ["D6", "F6", "A6", "C7", "A5"][Math.floor(pr() * 5)], 12.3 + i * 0.25 + pr() * 0.1, 0.035 + pr() * 0.03, pr(), 1.2); // tubes turning colour
  placeSt(B.fx, revSwell(0.6), 15.4, 0.35);
  place(B.fx, IMPACT, 16.0, 0.5); placeSt(B.fx, braam(hz("G1"), 1.2), 16.0, 0.22);
  placeSt(B.pad, padChord(CH.Gm.pad.map(hz), 2.3, { c0: 350, c1: 700 }), 16, 0.2); placeSt(B.pad, padChord(CH.A.pad.map(hz), 1.5, { c0: 600, c1: 1500 }), 18.5, 0.2);
  for (const t of [16, 17]) { hitKick(B, t, 0.8); hitKick(B, t + 0.28, 0.5); } hitKick(B, 18.5, 0.7); // nothing lands on the word "wallet"                                   // a heartbeat
  place(B.bass, bass808(hz("G1"), 1.7), 16, 0.4); place(B.bass, bass808(hz("A1"), 1.3), 18.5, 0.4);
  for (const [t, g] of [[19.0, 0.5], [19.25, 0.5], [19.5, 0.6], [19.625, 0.6], [19.75, 0.7], [19.875, 0.75]]) place(B.fx, TOM, t, g, 0.5);
  placeSt(B.fx, riser(1.3), 18.7, 0.2); placeSt(B.fx, revSwell(0.7), 19.3, 0.5);
  drop(B, 20.0);
  groove(B, 20, "Dm", { bright: 1.15 }); groove(B, 22, "Bb", { bright: 1.15, roll: true });
  hitKick(B, 24.0); place(B.bass, bass808(hz("D2"), 0.3), 24.0, 0.45); placeSt(B.fx, revSwell(0.4), 24.1, 0.3);
  // three answers, three sounds: a bright fifth, an uneasy tritone, a low buzz
  for (const nn of ["D5", "A5", "D6"]) place(B.ui, pluck(hz(nn), 1.3, 0.9, 0.3), 24.5, 0.42, 0.5); bellAt(B, "A6", 24.5, 0.1, 0.5, 1.2);
  for (const nn of ["F4", "B4", "F5"]) place(B.ui, pluck(hz(nn), 1.0, 0.9, 0.28), 25.0, 0.42, 0.5); place(B.fx, TOM, 25.0, 0.5);
  place(B.fx, buzz(hz("D2"), 0.42), 25.5, 0.5); place(B.fx, IMPACT, 25.5, 0.8); placeSt(B.fx, braam(hz("D1"), 0.5), 25.5, 0.3);
  placeSt(B.fx, revSwell(0.5), 26.0, 0.4);
  drop(B, 26.5, 0.72); hitKick(B, 26.5); place(B.bass, bass808(hz("D2"), 1.6), 26.5, 0.45); placeSt(B.fx, braam(hz("D2"), 1.1), 26.5, 0.3);
  placeSt(B.pad, padChord(CH.Dm.pad.map(hz), 2.6, { c0: 1500, c1: 500, rel: 1.4 }), 26.5, 0.18);
  [["A5", 26.5], ["F5", 26.875], ["D5", 27.25], ["A4", 27.625], ["D5", 28.375]].forEach(([nn, t], j) => place(B.bell, bell(hz(nn)), t, 0.12 - j * 0.015, j % 2 ? 0.62 : 0.38));
  return { file: mixdown(B, T, "live"), vo };
}

const res = {};
if (WHICH !== "live") res.intro = intro();
if (WHICH !== "intro") res.live = live();
const voFile = path.join(HERE, "..", "src", "vo.json"), old = fs.existsSync(voFile) ? JSON.parse(fs.readFileSync(voFile, "utf8")) : {};
for (const [k, v] of Object.entries(res)) old[k] = v.vo;
fs.writeFileSync(voFile, JSON.stringify(old, null, 1) + "\n");
console.log("wrote", Object.values(res).map((x) => x.file).join(", "));
