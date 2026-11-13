// Kaelis Genome: the rule set as DNA (8 check weights, the hard-flag floor and the rug-chance curve).
// Every night Kaelis mutates it, tests the mutants against resolved Ledger calls it did NOT train on,
// and adopts a new generation only if it is measurably better calibrated. Every generation is
// published with its parent, its diff and its before/after score, hash-chained like the Ledger.
const crypto = require("crypto");
const K = require("../site/js/kaelis-core.js");
const { store } = require("./build.js");

const IDS = ["sell", "liquidity", "holders", "lp", "mint", "extensions", "age", "freeze"];
const BOUNDS = { weight: [2, 40], sellMin: 15, hardFloor: [70, 95], a: [0.01, 0.15], b: [0.5, 0.95], k: [0.8, 3], hardP: [0.7, 0.97] };
const GEN0 = { weights: { ...K.WEIGHTS }, hardFloor: 85, curve: { a: 0.03, b: 0.9, k: 1.6, hardP: 0.85 } };
const MIN_RESOLVED = Number(process.env.EVOLVE_MIN_RESOLVED || 60);
const MIN_GAIN = 0.002; // holdout Brier must drop at least this much
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// score and rug chance of one stored call under a genome (exact replay: severities don't depend on weights)
function scoreOf(g, f, hard) {
  let s = 0; for (const id of IDS) if (f[id] != null) s += g.weights[id] * f[id];
  if (hard) s = Math.max(g.hardFloor, s);
  return Math.round(Math.min(100, s));
}
function pOf(g, score, hard) {
  const c = g.curve, p = c.a + c.b * Math.pow(Math.min(100, Math.max(0, score)) / 100, c.k);
  return Math.min(0.97, Math.max(hard ? c.hardP : 0.02, p));
}
function brier(g, calls) {
  if (!calls.length) return null;
  return calls.reduce((t, c) => { const p = pOf(g, scoreOf(g, c.f, c.fh), c.fh); return t + (p - c.rugged) ** 2; }, 0) / calls.length;
}
const iq = (b) => (b == null ? null : Math.max(0, Math.round(100 * (1 - b / 0.25))));

function normalize(g) {
  const w = g.weights;
  for (const id of IDS) w[id] = clamp(w[id], BOUNDS.weight);
  // weights sum to 100 and the sell test can never be bred out below sellMin
  let sum = IDS.reduce((t, id) => t + w[id], 0);
  w.sell = Math.max(BOUNDS.sellMin, (w.sell * 100) / sum);
  const rest = IDS.filter((id) => id !== "sell"), other = rest.reduce((t, id) => t + w[id], 0);
  for (const id of rest) w[id] = Math.floor(((w[id] * (100 - w.sell)) / other) * 10) / 10;
  w.sell = Math.round((100 - rest.reduce((t, id) => t + w[id], 0)) * 10) / 10;
  g.hardFloor = Math.round(clamp(g.hardFloor, BOUNDS.hardFloor));
  for (const k of ["a", "b", "k", "hardP"]) g.curve[k] = Math.round(clamp(g.curve[k], BOUNDS[k]) * 1000) / 1000;
  return g;
}
function mutate(g, r) {
  const m = JSON.parse(JSON.stringify(g)), n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const pick = r(), f = 1 + (r() - 0.5) * 0.5; // ±25%
    if (pick < 0.6) { const id = IDS[Math.floor(r() * IDS.length)]; m.weights[id] *= f; }
    else if (pick < 0.7) m.hardFloor += (r() - 0.5) * 10;
    else { const k = ["a", "b", "k", "hardP"][Math.floor(r() * 4)]; m.curve[k] *= f; }
  }
  return normalize(m);
}
function diff(a, b) {
  const out = [];
  for (const id of IDS) if (a.weights[id] !== b.weights[id]) out.push(`${id} weight ${a.weights[id]} → ${b.weights[id]}`);
  if (a.hardFloor !== b.hardFloor) out.push(`hard-flag floor ${a.hardFloor} → ${b.hardFloor}`);
  for (const k of ["a", "b", "k", "hardP"]) if (a.curve[k] !== b.curve[k]) out.push(`curve ${k} ${a.curve[k]} → ${b.curve[k]}`);
  return out;
}
// 70/30 split by token, fixed forever, so a generation is always judged on calls it never trained on
const isHoldout = (mint) => parseInt(sha("split|" + mint).slice(0, 8), 16) % 10 < 3;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// resolved Ledger calls that carry features
// (tokenized stocks are left out: their issuer checks do not score since rules 1.4.0, so they would teach the wrong weights)
const usable = (calls) => calls.filter((c) => c.resolvedAt && c.f && c.asset !== "stock" && (c.rugged === 0 || c.rugged === 1));

function evolve(current, calls, { seed = Date.now(), iterations = 600 } = {}) {
  const data = usable(calls), train = data.filter((c) => !isHoldout(c.mint)), hold = data.filter((c) => isHoldout(c.mint));
  if (data.length < MIN_RESOLVED || hold.length < 10) return { adopted: false, reason: `Needs ${MIN_RESOLVED} resolved calls with features (has ${data.length}).`, n: data.length };
  const r = rng(seed);
  let best = current, bestB = brier(current, train);
  for (let i = 0; i < iterations; i++) { const m = mutate(best, r), b = brier(m, train); if (b < bestB) { best = m; bestB = b; } }
  const before = brier(current, hold), after = brier(best, hold);
  const adopted = best !== current && after <= before - MIN_GAIN;
  return { adopted, candidate: best, before, after, iqBefore: iq(before), iqAfter: iq(after), n: data.length, train: train.length, holdout: hold.length,
    changes: diff(current, best), reason: adopted ? "Better on calls it never trained on." : "No mutant beat the current generation on the holdout calls." };
}

function makeGenome({ db = store(undefined, "genome.json", () => ({ gen: 0, genome: GEN0, history: [{ gen: 0, genome: GEN0, at: null, note: "Hand-written rules v" + K.RULES_VERSION, hash: sha("kaelis-gen|0|" + JSON.stringify(GEN0)) }], runs: [] })), now = () => Date.now() } = {}) {
  return {
    current() { const d = db.load(); return { gen: d.gen, ...d.genome }; },
    // run one evolution step on the Ledger calls; adopts and records a new generation if it wins
    run(calls) {
      const d = db.load(), t = now(), res = evolve(d.genome, calls, { seed: t });
      const run = { at: new Date(t).toISOString(), n: res.n || 0, adopted: res.adopted, reason: res.reason, iqBefore: res.iqBefore ?? null, iqAfter: res.iqAfter ?? null };
      d.runs = (d.runs || []).concat(run).slice(-30);
      if (res.adopted) {
        const prev = d.history[d.history.length - 1];
        const gen = d.gen + 1, rec = { gen, parent: prev.gen, genome: res.candidate, at: run.at, changes: res.changes, iqBefore: res.iqBefore, iqAfter: res.iqAfter, n: res.n, holdout: res.holdout };
        rec.hash = sha(["kaelis-gen", prev.hash, gen, JSON.stringify(res.candidate), res.iqBefore, res.iqAfter, run.at].join("|"));
        d.history.push(rec); d.gen = gen; d.genome = res.candidate;
      }
      db.save();
      return { ...run, gen: d.gen };
    },
    view(calls) {
      const d = db.load(), data = usable(calls);
      return { gen: d.gen, genome: d.genome, history: d.history.slice().reverse(), runs: (d.runs || []).slice().reverse().slice(0, 10),
        data: { usable: data.length, needed: MIN_RESOLVED, holdout: data.filter((c) => isHoldout(c.mint)).length },
        bounds: { weights: BOUNDS.weight, sellMin: BOUNDS.sellMin, hardFloor: BOUNDS.hardFloor } };
    },
  };
}

module.exports = { makeGenome, evolve, mutate, scoreOf, pOf, brier, iq, GEN0, IDS, isHoldout, normalize };
