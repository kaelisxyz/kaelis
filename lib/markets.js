// Kaelis Markets: memecoins measured with Wall Street's yardstick.
//  - rates tokenized stocks on Solana (xStocks) with the same rules as memecoins (Patrol seals one call a week);
//    since rules 1.4.0 the issuer's controls are read apart from the score. A daily reading (`current`) shows the
//    grade under today's rules next to the sealed call, which never changes.
//  - K-20: an equal-weight index of the 20 best-rated memecoins Kaelis has called, rebalanced every ISO week,
//    tracked every Patrol round next to SPYx (the S&P 500 xStock), both indexed to 100
//  - KIQ: Kaelis's own "ticker", its calibration score over time
//  - look-alikes: tokens that copy a stock's ticker but are not the official mint
// A benchmark only, never an investable product. Prices from DexScreener.
const { store, isoWeek } = require("./build.js");
const K = require("../site/js/kaelis-core.js");

const STOCKS = [
  { sym: "SPYx", name: "S&P 500", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", bench: true },
  { sym: "QQQx", name: "Nasdaq 100", mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ" },
  { sym: "NVDAx", name: "NVIDIA", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" },
  { sym: "TSLAx", name: "Tesla", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB" },
  { sym: "AAPLx", name: "Apple", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" },
];
const STOCK_MINTS = new Set(STOCKS.map((s) => s.mint));
const GOOD = ["AAA", "AA", "A", "BBB"];
const BASKET = 20, MIN_BASKET = 5, MIN_LIQ = 20000, MAX_POINTS = 2000, LOOKALIKE_EVERY = 864e5, READING_EVERY = 864e5;

// best Solana price per mint from DexScreener pairs (deepest pool wins)
function bestPrices(pairs, mints) {
  const want = new Set(mints), best = {};
  for (const p of pairs || []) {
    if (!p || p.chainId !== "solana" || !p.baseToken || !want.has(p.baseToken.address)) continue;
    const m = p.baseToken.address, liq = (p.liquidity && p.liquidity.usd) || 0, price = +p.priceUsd;
    if (!(price > 0)) continue;
    if (!best[m] || liq > best[m].liq) best[m] = { price, liq };
  }
  return Object.fromEntries(Object.entries(best).map(([m, v]) => [m, v.price]));
}
// equal-weight return of a basket since its base prices; a token with no price left counts as -100%
function basketReturn(base, now) {
  const ms = Object.keys(base).filter((m) => base[m] > 0);
  if (!ms.length) return 1;
  return ms.reduce((t, m) => t + Math.min(10, (now[m] || 0) / base[m]), 0) / ms.length;
}
// the K-20: latest call per memecoin (not stocks), graded AAA..BBB, pool >= MIN_LIQ, not rugged, deepest first
function pickBasket(calls) {
  const latest = {};
  for (const c of calls) if (c.asset !== "stock" && !STOCK_MINTS.has(c.mint)) latest[c.mint] = c;
  return Object.values(latest)
    .filter((c) => GOOD.includes(c.finalGrade || c.grade) && !c.rugged && (c.liq0 || 0) >= MIN_LIQ)
    .sort((a, b) => GOOD.indexOf(a.finalGrade || a.grade) - GOOD.indexOf(b.finalGrade || b.grade) || b.liq0 - a.liq0)
    .slice(0, BASKET);
}

function makeMarkets({ fetchFn = fetch, db = store(undefined, "markets.json", () => ({ series: [], basket: null, level: 100, spyBase: null, lookalikes: [], lookalikesAt: null })), now = () => Date.now() } = {}) {
  // DexScreener returns at most ~30 pairs per request, so busy tokens (SPYx has 28 pools) crowd others out:
  // ask in small batches, then once more for each mint that is still missing
  async function prices(mints) {
    const out = {};
    const ask = async (list) => {
      const r = await fetchFn("https://api.dexscreener.com/latest/dex/tokens/" + list.join(","), { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("DexScreener answered " + r.status);
      Object.assign(out, bestPrices((await r.json()).pairs, list));
    };
    for (let i = 0; i < mints.length; i += 5) await ask(mints.slice(i, i + 5));
    for (const m of mints.filter((m) => !(m in out)).slice(0, 12)) { try { await ask([m]); } catch (e) { break; } }
    return out;
  }
  async function findLookalikes() {
    const found = [];
    for (const s of STOCKS) {
      try {
        const r = await fetchFn("https://api.dexscreener.com/latest/dex/search?q=" + encodeURIComponent(s.sym), { headers: { accept: "application/json" } });
        if (!r.ok) continue;
        const seen = new Set();
        for (const p of (await r.json()).pairs || []) {
          const t = p && p.baseToken;
          if (!t || p.chainId !== "solana" || t.address === s.mint || seen.has(t.address)) continue;
          if (String(t.symbol).toUpperCase() !== s.sym.toUpperCase()) continue;
          seen.add(t.address);
          found.push({ copies: s.sym, mint: t.address, name: String(t.name || "").slice(0, 40), liq: Math.round((p.liquidity && p.liquidity.usd) || 0), dex: p.dexId });
        }
      } catch (e) { /* skip this ticker */ }
    }
    // names of companies with no official token (rules 1.5.0): a warning each, deepest pools first
    for (const u of K.UNLISTED) {
      try {
        const r = await fetchFn("https://api.dexscreener.com/latest/dex/search?q=" + encodeURIComponent(u.name), { headers: { accept: "application/json" } });
        if (!r.ok) continue;
        const seen = new Set(), hits = [];
        for (const p of (await r.json()).pairs || []) {
          const t = p && p.baseToken;
          if (!t || p.chainId !== "solana" || seen.has(t.address) || !u.re.test(`${t.name} ${t.symbol}`)) continue;
          seen.add(t.address);
          hits.push({ copies: u.name, kind: "unlisted", mint: t.address, name: String(t.name || "").slice(0, 40), liq: Math.round((p.liquidity && p.liquidity.usd) || 0), dex: p.dexId });
        }
        found.push(...hits.sort((a, b) => b.liq - a.liq).slice(0, 8));
      } catch (e) { /* skip this name */ }
    }
    return found;
  }
  return {
    STOCKS,
    // the daily reading of each stock under the current rules (Patrol, between its weekly sealed calls)
    readingDue(mint, rulesVersion) { const r = (db.load().current || {})[mint]; return !r || r.rulesVersion !== rulesVersion || now() - Date.parse(r.at) >= READING_EVERY; },
    setReading(mint, b) {
      const d = db.load(); d.current = d.current || {};
      d.current[mint] = { grade: b.grade, score: b.score, hard: !!b.hardFlag, rulesVersion: b.rulesVersion, at: new Date(now()).toISOString(),
        issuer: b.issuer ? b.issuer.controls.map((c) => c.id) : null };
      db.save();
    },
    // one data point: called by Patrol each round. `calls` = all Ledger calls, `iq` / `gen` = current Kaelis IQ and generation
    async tick(calls, { iq = null, gen = 0 } = {}) {
      const d = db.load(), t = now(), week = isoWeek(new Date(t)), spy = STOCKS[0].mint;
      if (!d.basket || d.basket.week !== week) {
        const picks = pickBasket(calls);
        if (picks.length >= MIN_BASKET) {
          const base = await prices(picks.map((c) => c.mint));
          if (d.basket) { const p = { ...(d.last || {}), ...(await prices(Object.keys(d.basket.base))) }; d.level = d.basket.level0 * basketReturn(d.basket.base, p); }
          d.basket = { week, level0: d.level, base, members: picks.filter((c) => base[c.mint]).map((c) => ({ mint: c.mint, symbol: c.symbol, grade: c.finalGrade || c.grade })) };
        }
      }
      const want = [spy].concat(d.basket ? Object.keys(d.basket.base) : []);
      const p = { ...(d.last || {}), ...(await prices(want)) };
      d.last = Object.fromEntries(want.filter((m) => p[m]).map((m) => [m, p[m]]));
      if (p[spy] && !d.spyBase) d.spyBase = p[spy];
      const k20 = d.basket ? Math.round(d.basket.level0 * basketReturn(d.basket.base, p) * 100) / 100 : null;
      const point = { t: new Date(t).toISOString(), k20, spy: p[spy] && d.spyBase ? Math.round((100 * p[spy]) / d.spyBase * 100) / 100 : null, spyUsd: p[spy] || null, iq, gen };
      d.series = d.series.concat(point).slice(-MAX_POINTS);
      if (!d.lookalikesAt || t - Date.parse(d.lookalikesAt) >= LOOKALIKE_EVERY) { d.lookalikes = await findLookalikes(); d.lookalikesAt = new Date(t).toISOString(); }
      db.save();
      return point;
    },
    view(calls) {
      const d = db.load();
      const stocks = STOCKS.map((s) => {
        const mine = calls.filter((c) => c.mint === s.mint), c = mine[mine.length - 1];
        return { ...s, now: (d.current || {})[s.mint] || null,
          call: c ? { n: c.n, grade: c.finalGrade || c.grade, score: c.score, p: c.p, rulesVersion: c.rulesVersion, openedAt: c.openedAt, resolveAt: c.resolveAt, resolvedAt: c.resolvedAt || null, rugged: c.rugged ?? null, hash: c.hash, f: c.f || null } : null };
      });
      return { stocks, series: d.series, basket: d.basket ? { week: d.basket.week, members: d.basket.members } : null, lookalikes: d.lookalikes || [], lookalikesAt: d.lookalikesAt,
        note: "K-20 is a benchmark of the best-rated memecoins Kaelis has called, equal weight, rebalanced weekly. It is not an investable product. Nothing here is financial advice.",
        stocksNote: "Official tokenized stocks: the issuer's controls (mint, freeze, permanent delegate) are listed apart and do not add to the score (rules 1.4.0). Stock calls are kept out of the Ledger's accuracy numbers." };
    },
  };
}

module.exports = { makeMarkets, STOCKS, STOCK_MINTS, pickBasket, basketReturn, bestPrices };
