// Kaelis Rating + Ledger tests. Run: node tests/ledger.test.js
const assert = require("assert");
const K = require("../site/js/kaelis-core.js");
const { makeLedger, rugProbability, stats } = require("../lib/ledger.js");

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
const memDb = () => { let d = { head: "0".repeat(64), calls: [] }; return { load: () => d, save: () => {} }; };
const MINT = "So11111111111111111111111111111111111111112".replace(/2$/, "3");
const pair = (liq, price) => ({ chainId: "solana", baseToken: { address: MINT, symbol: "DEMO", name: "Demo" }, liquidity: { usd: liq }, priceUsd: String(price) });
const scanOut = (score, hard, liq = 20000, price = 1) => ({ data: { mint: MINT, pairs: [pair(liq, price)] }, result: { score, hard, grade: K.grade(score, hard), rulesVersion: K.RULES_VERSION } });
const dexReturns = (pairs) => async () => ({ ok: true, json: async () => ({ pairs }) });

(async () => {
  await t("grades follow the score bands", () => {
    assert.deepStrictEqual([0, 9, 10, 25, 39, 40, 60, 70, 84, 85, 100].map((s) => K.grade(s, false)), ["AAA", "AAA", "AA", "A", "BBB", "BB", "B", "CCC", "CCC", "CC", "CC"]);
    assert.strictEqual(K.grade(5, true), "CC");
    assert.strictEqual(K.grade(3, false, 1), "A"); // missing data never gets AAA or AA
    assert.strictEqual(K.grade(45, false, 1), "BB");
  });
  await t("rug probability rises with the score and respects the hard flag", () => {
    assert(rugProbability(0) < rugProbability(50) && rugProbability(50) < rugProbability(100));
    assert(rugProbability(10, true) >= 0.85);
  });
  await t("one open call per token, hash-chained", () => {
    let now = Date.parse("2026-11-01T00:00:00Z");
    const L = makeLedger({ db: memDb(), now: () => now, fetchFn: dexReturns([]) });
    const a = L.record(scanOut(30, false));
    assert(a && a.hash.length === 64);
    assert.strictEqual(L.record(scanOut(30, false)), null);
    assert.deepStrictEqual(L.verify(), { ok: true, length: 1 });
  });
  await t("no call without a trading pool", () => {
    const L = makeLedger({ db: memDb(), fetchFn: dexReturns([]) });
    assert.strictEqual(L.record({ data: { mint: MINT, pairs: [] }, result: { score: 90, hard: true, grade: "CC", rulesVersion: "x" } }), null);
  });
  await t("after 7 days a drained pool resolves as rugged, grade D, chain intact", async () => {
    let now = Date.parse("2026-11-01T00:00:00Z");
    const L = makeLedger({ db: memDb(), now: () => now, fetchFn: dexReturns([pair(500, 0.5)]) });
    L.record(scanOut(90, true));
    now += 8 * 864e5;
    const r = await L.list();
    const c = r.body.calls[0];
    assert.strictEqual(c.rugged, 1); assert.strictEqual(c.finalGrade, "D"); assert.strictEqual(c.grade, "CC");
    assert.strictEqual(L.verify().ok, true);
  });
  await t("a healthy token resolves as not rugged", async () => {
    let now = Date.parse("2026-11-01T00:00:00Z");
    const L = makeLedger({ db: memDb(), now: () => now, fetchFn: dexReturns([pair(25000, 1.2)]) });
    L.record(scanOut(12, false));
    now += 8 * 864e5;
    assert.strictEqual((await L.list()).body.calls[0].rugged, 0);
  });
  await t("IQ needs 10 resolved calls and rewards good calibration", () => {
    const good = Array.from({ length: 10 }, (_, i) => ({ resolvedAt: "x", p: i < 5 ? 0.9 : 0.1, rugged: i < 5 ? 1 : 0 }));
    assert(stats(good).iq >= 90);
    assert.strictEqual(stats(good.slice(0, 9)).iq, null);
  });
  console.log(`\n${pass} passed`);
})();
