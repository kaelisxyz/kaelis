// Kaelis Genome tests. Run: node tests/genome.test.js
const assert = require("assert");
const K = require("../site/js/kaelis-core.js");
const { makeGenome, evolve, mutate, scoreOf, brier, GEN0, IDS, isHoldout } = require("../lib/genome.js");
const { makeLedger } = require("../lib/ledger.js");

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
function rng(s) { return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const mintOf = (i) => { const r = rng(i + 7); let s = ""; for (let k = 0; k < 43; k++) s += B58[Math.floor(r() * 58)]; return s; };

// synthetic world where holder concentration is what really predicts rugs (the hand-written weights underrate it)
function world(n, seed) {
  const r = rng(seed), calls = [];
  for (let i = 0; i < n; i++) {
    const f = {}; for (const id of IDS) f[id] = r() < 0.5 ? 0 : Math.round(r() * 1000) / 1000;
    const risk = 0.05 + 0.85 * f.holders * f.holders;
    calls.push({ mint: mintOf(i + seed * 1000), f, fh: false, resolvedAt: "x", rugged: r() < risk ? 1 : 0 });
  }
  return calls;
}

(async () => {
  await t("gen 0 replays the hand-written score exactly", () => {
    const f = { sell: 0, liquidity: 0.5, holders: 1, lp: 0.2, mint: 1, extensions: 0, age: 1, freeze: null };
    assert.strictEqual(scoreOf(GEN0, f, false), Math.round(15 * 0.5 + 15 + 15 * 0.2 + 10 + 5));
    assert.strictEqual(scoreOf(GEN0, { sell: 1 }, true), 85);
  });
  await t("evaluate() uses an evolved genome when given one", () => {
    const g = { gen: 3, weights: { ...K.WEIGHTS, mint: 30, sell: 15 }, hardFloor: 90 };
    const d = { mint: "x", pairs: [], mintInfo: { mintAuthority: "AbCd1111111111111111111111111111", freezeAuthority: null }, jup: { skipped: true }, rug: {} };
    const r0 = K.evaluate(d), r3 = K.evaluate(d, g);
    assert(r3.score > r0.score); assert.strictEqual(r3.gen, 3); assert.strictEqual(r0.gen, 0);
  });
  await t("mutations stay in bounds, weights sum to 100, sell test never bred out", () => {
    const r = rng(42); let g = GEN0;
    for (let i = 0; i < 2000; i++) {
      g = mutate(g, r);
      const sum = IDS.reduce((s, id) => s + g.weights[id], 0);
      assert(Math.abs(sum - 100) < 1, "sum " + sum);
      assert(g.weights.sell >= 15 - 0.05, "sell " + g.weights.sell);
      assert(g.hardFloor >= 70 && g.hardFloor <= 95);
    }
  });
  await t("holdout split is fixed per token (~30%)", () => {
    const ms = Array.from({ length: 2000 }, (_, i) => mintOf(i));
    const h = ms.filter(isHoldout).length / ms.length;
    assert(h > 0.25 && h < 0.35, "share " + h);
    assert.strictEqual(isHoldout(ms[5]), isHoldout(ms[5]));
  });
  await t("not enough data: no new generation", () => {
    const res = evolve(GEN0, world(20, 1));
    assert.strictEqual(res.adopted, false); assert(/Needs/.test(res.reason));
  });
  await t("learns what really predicts rugs and only adopts if the holdout improves", () => {
    const calls = world(900, 2);
    const res = evolve(GEN0, calls, { seed: 9, iterations: 800 });
    assert.strictEqual(res.adopted, true, res.reason);
    assert(res.after < res.before);
    assert(res.candidate.weights.holders > GEN0.weights.holders, "holders weight should rise");
  });
  await t("generations are recorded and hash-chained; a losing run changes nothing", () => {
    let d = null; const db = { load: () => d || (d = { gen: 0, genome: GEN0, history: [{ gen: 0, genome: GEN0, hash: "h0" }], runs: [] }), save: () => {} };
    const G = makeGenome({ db, now: () => Date.parse("2026-11-08T00:00:00Z") });
    const r1 = G.run(world(900, 2));
    assert.strictEqual(r1.adopted, true); assert.strictEqual(G.current().gen, 1);
    const v = G.view([]); assert.strictEqual(v.history[0].gen, 1); assert.strictEqual(v.history[0].parent, 0); assert.strictEqual(v.history[0].hash.length, 64);
    const r2 = G.run(world(10, 3));
    assert.strictEqual(r2.adopted, false); assert.strictEqual(G.current().gen, 1);
  });
  await t("Ledger calls carry sealed features for replay", () => {
    let d = { head: "0".repeat(64), calls: [] };
    const L = makeLedger({ db: { load: () => d, save: () => {} }, fetchFn: async () => ({ ok: true, json: async () => ({ pairs: [] }) }) });
    const mint = mintOf(1);
    const out = { data: { mint, pairs: [{ chainId: "solana", baseToken: { address: mint, symbol: "X" }, liquidity: { usd: 9000 }, priceUsd: "1" }] },
      result: { score: 40, hard: false, grade: "BB", rulesVersion: "t", checks: [{ id: "holders", sev: 0.8 }, { id: "sell", sev: null }] } };
    const c = L.record(out, { gen: 2, curve: GEN0.curve });
    assert.deepStrictEqual(c.f, { holders: 0.8, sell: null }); assert.strictEqual(c.gen, 2);
    assert.strictEqual(L.verify().ok, true);
    c.f.holders = 0.1; assert.strictEqual(L.verify().ok, false, "editing features must break the chain");
  });
  console.log(`\n${pass} genome tests passed`);
})();
