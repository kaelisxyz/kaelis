// Kaelis Markets tests. Run: node tests/markets.test.js
const assert = require("assert");
const { makeMarkets, STOCKS, pickBasket, basketReturn, bestPrices } = require("../lib/markets.js");

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
const SPY = STOCKS[0].mint;
const mint = (i) => "Meme" + String(i).padStart(3, "0") + "1111111111111111111111111111111111".slice(0, 36);
const call = (i, grade, liq0, extra = {}) => ({ mint: mint(i), symbol: "M" + i, grade, liq0, p: 0.1, ...extra });
const pair = (m, price, liq = 50000) => ({ chainId: "solana", baseToken: { address: m, symbol: "X" }, priceUsd: String(price), liquidity: { usd: liq } });

(async () => {
  await t("best price comes from the deepest Solana pool", () => {
    const p = bestPrices([pair("a", 1, 10), pair("a", 2, 900), { ...pair("a", 9, 5000), chainId: "eth" }], ["a"]);
    assert.strictEqual(p.a, 2);
  });
  await t("basket return is equal weight; a vanished token counts as -100%", () => {
    assert.strictEqual(basketReturn({ a: 1, b: 2 }, { a: 2, b: 2 }), 1.5);
    assert.strictEqual(basketReturn({ a: 1, b: 1 }, { a: 1 }), 0.5);
  });
  await t("K-20 keeps only good grades, real pools, no rugs, no stocks, latest call per token", () => {
    const calls = [call(1, "A", 90000), call(2, "BB", 90000), call(3, "AA", 5000), call(4, "A", 60000, { rugged: 1 }),
      { mint: SPY, grade: "A", liq0: 9e6, asset: "stock" }, call(5, "CC", 80000), call(5, "AAA", 80000)];
    const b = pickBasket(calls).map((c) => c.mint);
    assert.deepStrictEqual(b, [mint(5), mint(1)]);
  });
  await t("index points: K-20 and SPYx both start at 100, then move with prices", async () => {
    let tm = Date.parse("2026-11-09T00:00:00Z"), prices = {};
    const calls = Array.from({ length: 6 }, (_, i) => call(i, "A", 50000));
    let d = null; const db = { load: () => d || (d = { series: [], basket: null, level: 100, spyBase: null, lookalikes: [], lookalikesAt: null }), save: () => {} };
    const fetchFn = async (url) => ({ ok: true, json: async () => url.includes("/search") ? { pairs: [] } : { pairs: Object.entries(prices).map(([m, p]) => pair(m, p)) } });
    const M = makeMarkets({ db, fetchFn, now: () => tm });
    calls.forEach((c) => (prices[c.mint] = 1)); prices[SPY] = 500;
    const p0 = await M.tick(calls, { iq: null, gen: 0 });
    assert.strictEqual(p0.k20, 100); assert.strictEqual(p0.spy, 100);
    calls.forEach((c) => (prices[c.mint] = 1.2)); prices[SPY] = 510; tm += 1800e3;
    const p1 = await M.tick(calls, { iq: 61, gen: 1 });
    assert.strictEqual(p1.k20, 120); assert.strictEqual(p1.spy, 102); assert.strictEqual(p1.iq, 61);
    assert.strictEqual(M.view(calls).series.length, 2);
  });
  await t("a new week rebalances without a jump in the index", async () => {
    let tm = Date.parse("2026-11-09T00:00:00Z"), prices = {};
    let d = null; const db = { load: () => d || (d = { series: [], basket: null, level: 100, spyBase: null, lookalikes: [], lookalikesAt: "2026-11-09T00:00:00Z" }), save: () => {} };
    const fetchFn = async () => ({ ok: true, json: async () => ({ pairs: Object.entries(prices).map(([m, p]) => pair(m, p)) }) });
    const M = makeMarkets({ db, fetchFn, now: () => tm });
    const week1 = Array.from({ length: 5 }, (_, i) => call(i, "A", 50000));
    week1.forEach((c) => (prices[c.mint] = 1)); prices[SPY] = 100;
    await M.tick(week1);
    week1.forEach((c) => (prices[c.mint] = 2)); tm += 7 * 864e5;
    const week2 = Array.from({ length: 5 }, (_, i) => call(10 + i, "A", 50000)); week2.forEach((c) => (prices[c.mint] = 5));
    const p = await M.tick(week1.concat(week2));
    assert.strictEqual(p.k20, 200, "carries the old basket's gain into the new basket");
  });
  await t("ticker look-alikes: same symbol, not the official mint", async () => {
    let d = null; const db = { load: () => d || (d = { series: [], basket: null, level: 100, spyBase: null, lookalikes: [], lookalikesAt: null }), save: () => {} };
    const fake = "Fake1111111111111111111111111111111111pump";
    const fetchFn = async (url) => ({ ok: true, json: async () => url.includes("q=NVDAx")
      ? { pairs: [{ chainId: "solana", baseToken: { address: fake, symbol: "NVDAx", name: "NVIDIA xStock" }, liquidity: { usd: 0 }, dexId: "pumpfun" }, { chainId: "solana", baseToken: { address: STOCKS[2].mint, symbol: "NVDAx" }, liquidity: { usd: 9e6 } }] }
      : { pairs: [] } });
    const M = makeMarkets({ db, fetchFn });
    await M.tick([]);
    const L = M.view([]).lookalikes;
    assert.strictEqual(L.length, 1); assert.strictEqual(L[0].mint, fake); assert.strictEqual(L[0].copies, "NVDAx");
  });
  await t("a mint missing from a crowded DexScreener answer is asked again, then keeps its last price", async () => {
    let tm = Date.parse("2026-11-09T00:00:00Z"), drop = new Set(), prices = {};
    let d = null; const db = { load: () => d || (d = { series: [], basket: null, level: 100, spyBase: null, lookalikes: [], lookalikesAt: "2026-11-09T00:00:00Z" }), save: () => {} };
    const fetchFn = async (url) => { const asked = url.split("/tokens/")[1].split(","); const crowded = asked.length > 1;
      return { ok: true, json: async () => ({ pairs: Object.entries(prices).filter(([m]) => asked.includes(m) && !drop.has(m) && !(crowded && m === mint(3))).map(([m, p]) => pair(m, p)) }) }; };
    const M = makeMarkets({ db, fetchFn, now: () => tm });
    const calls = Array.from({ length: 6 }, (_, i) => call(i, "A", 50000)); calls.forEach((c) => (prices[c.mint] = 1)); prices[SPY] = 100;
    assert.strictEqual((await M.tick(calls)).k20, 100, "retried alone, so no fake -100%");
    drop.add(mint(2)); tm += 1800e3;
    assert.strictEqual((await M.tick(calls)).k20, 100, "no answer keeps the last known price");
  });
  await t("a token copying a stock ticker is a hard flag (CC); the official mint is not", () => {
    const K = require("../site/js/kaelis-core.js");
    const base = (m) => ({ mint: m, pairs: [{ chainId: "solana", baseToken: { address: m, symbol: "NVDAx" }, liquidity: { usd: 100000 }, priceUsd: "1", txns: { h24: { buys: 5, sells: 5 } } }], mintInfo: { mintAuthority: null, freezeAuthority: null }, jup: { skipped: true }, rug: {} });
    const fake = K.evaluate(base("Fake1111111111111111111111111111111111pump"));
    assert.strictEqual(fake.hard, true); assert.strictEqual(fake.grade, "CC"); assert(fake.score >= 85);
    assert(fake.checks.some((c) => c.id === "impersonation" && c.sev === 1));
    const real = K.evaluate(base(K.KNOWN_ASSETS.NVDAX.mint));
    assert.strictEqual(real.hard, false); assert(real.checks.some((c) => c.id === "impersonation" && c.sev === 0));
  });
  console.log(`\n${pass} markets tests passed`);
})();
