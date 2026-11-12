// The Ledger: every server scan of a traded token becomes a public, timestamped call
// ("chance this token is rugged within 7 days"). After 7 days Kaelis checks what really
// happened and grades itself. The running grade is the Kaelis IQ (a calibration score).
//
// Calls are hash-chained: each call's hash covers the previous hash, so no call can be edited
// or removed later without breaking every hash after it. Anchoring the chain head on Solana
// (a memo transaction) starts once the Kaelis wallet is set; until then `anchored` stays null.
const crypto = require("crypto");
const { store } = require("./build.js");

const WINDOW_MS = 7 * 864e5;
const MIN_RESOLVED_FOR_IQ = 10;
const GENESIS = "0".repeat(64);

// rug probability from the rule score: a fixed, published curve (versioned with the rules)
function rugProbability(score, hard) {
  const p = 0.03 + 0.9 * Math.pow(Math.min(100, Math.max(0, score)) / 100, 1.6);
  return Math.round(Math.min(0.97, Math.max(hard ? 0.85 : 0.02, p)) * 100) / 100;
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
function callHash(c, prev) {
  const parts = ["kaelis-call", prev, c.mint, c.grade, c.score, c.p, c.openedAt, c.rulesVersion];
  if (c.f) parts.push(JSON.stringify(c.f), c.fh ? 1 : 0, c.gen || 0); // features are sealed too (calls from v1.2.1 on)
  return sha(parts.join("|"));
}
// what happened: rugged if the pools emptied, liquidity halved, or the price fell 90%+
function outcome(c, now) {
  if (!now) return null;
  if (now.pools === 0) return { rugged: 1, why: "No trading pool left." };
  if (c.liq0 >= 1000 && now.liq < c.liq0 * 0.5) return { rugged: 1, why: `Liquidity fell from $${Math.round(c.liq0)} to $${Math.round(now.liq)}.` };
  if (c.price0 > 0 && now.price > 0 && now.price < c.price0 * 0.1) return { rugged: 1, why: "Price fell more than 90%." };
  return { rugged: 0, why: "Pools and price held." };
}
function market(pairs, mint) {
  const ps = (pairs || []).filter((p) => p && p.chainId === "solana" && p.baseToken && p.baseToken.address === mint);
  const liq = ps.reduce((t, p) => t + ((p.liquidity && p.liquidity.usd) || 0), 0);
  const top = ps.slice().sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
  return { pools: ps.length, liq, price: top ? +top.priceUsd || 0 : 0, symbol: top ? top.baseToken.symbol : null, name: top ? top.baseToken.name : null };
}
function stats(calls) {
  const done = calls.filter((c) => c.resolvedAt);
  const brier = done.length ? done.reduce((t, c) => t + (c.p - c.rugged) ** 2, 0) / done.length : null;
  const hits = done.filter((c) => (c.p >= 0.5 ? 1 : 0) === c.rugged).length;
  return {
    calls: calls.length, open: calls.length - done.length, resolved: done.length,
    rugsCaught: done.filter((c) => c.rugged && c.p >= 0.5).length,
    rugsMissed: done.filter((c) => c.rugged && c.p < 0.5).length,     // said safe, it rugged
    falseAlarms: done.filter((c) => !c.rugged && c.p >= 0.5).length,  // said danger, it held
    accuracy: done.length ? Math.round((hits / done.length) * 100) : null,
    brier: brier == null ? null : Math.round(brier * 1000) / 1000,
    // 100 = perfect calls, 0 = no better than saying 50% every time
    iq: done.length >= MIN_RESOLVED_FOR_IQ ? Math.max(0, Math.round(100 * (1 - brier / 0.25))) : null,
    iqNeeds: Math.max(0, MIN_RESOLVED_FOR_IQ - done.length),
  };
}

function makeLedger({ fetchFn = fetch, db = store(undefined, "ledger.json", () => ({ head: GENESIS, calls: [] })), now = () => Date.now() } = {}) {
  async function dex(mint) {
    const r = await fetchFn("https://api.dexscreener.com/latest/dex/tokens/" + mint, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("DexScreener answered " + r.status);
    const j = await r.json();
    return market(j.pairs, mint);
  }
  async function resolveOne(c) {
    const m = await dex(c.mint);
    const o = outcome(c, m);
    Object.assign(c, { resolvedAt: new Date(now()).toISOString(), rugged: o.rugged, why: o.why, liq1: m.liq, price1: m.price });
    c.finalGrade = o.rugged ? "D" : c.grade; // the call itself (and its hash) never changes
  }
  return {
    // record a call from a finished scan (one open call per token)
    // genome (optional): the generation that made this call, for its rug-chance curve
    record(out, genome) {
      const d = out.data, r = out.result, m = market(d.pairs, d.mint);
      if (!m.pools || !(m.liq > 0)) return null;
      const L = db.load();
      if (L.calls.some((c) => c.mint === d.mint && !c.resolvedAt)) return null;
      const t = now();
      const f = {}; for (const k of r.checks || []) f[k.id] = k.sev == null ? null : Math.round(k.sev * 1000) / 1000;
      const cv = genome && genome.curve;
      const p = cv ? Math.round(Math.min(0.97, Math.max(r.hard ? cv.hardP : 0.02, cv.a + cv.b * Math.pow(r.score / 100, cv.k))) * 100) / 100 : rugProbability(r.score, r.hard);
      const c = { n: L.calls.length + 1, mint: d.mint, symbol: m.symbol, name: m.name, grade: r.grade, score: r.score, p, f, fh: !!r.hard, gen: (genome && genome.gen) || 0, by: out.by || "user", asset: out.asset || "token",
        liq0: Math.round(m.liq), price0: m.price, rulesVersion: r.rulesVersion, openedAt: new Date(t).toISOString(), resolveAt: new Date(t + WINDOW_MS).toISOString(), prev: L.head };
      c.hash = callHash(c, L.head); L.head = c.hash; c.anchored = null;
      L.calls.push(c); db.save();
      return c;
    },
    all() { return db.load().calls; },
    // compact rows for the specimen shelf in the Archive: [n, mint, symbol, grade, p, rugged, day]
    shelf(n = 320) { return db.load().calls.slice(-n).map((c) => [c.n, c.mint, c.symbol || null, c.finalGrade || c.grade, c.p, c.resolvedAt ? c.rugged : null, c.openedAt.slice(0, 10)]); },
    head() { const L = db.load(); return { head: L.head, length: L.calls.length }; },
    // used by Patrol: resolve up to `max` due calls, one DexScreener request each
    async resolveDue(max = 20) {
      const t = now(), due = db.load().calls.filter((c) => !c.resolvedAt && Date.parse(c.resolveAt) <= t).slice(0, max);
      let n = 0;
      for (const c of due) { try { await resolveOne(c); n++; } catch (e) { break; } }
      if (n) db.save();
      return n;
    },
    due() { const t = now(); return db.load().calls.filter((c) => !c.resolvedAt && Date.parse(c.resolveAt) <= t).length; },
    has(mint) { return db.load().calls.some((c) => c.mint === mint); },
    openCall(mint) { return db.load().calls.find((c) => c.mint === mint && !c.resolvedAt) || null; },
    // public view; quietly resolves up to 3 due calls per request so DexScreener limits hold
    async list() {
      const L = db.load(), t = now();
      const due = L.calls.filter((c) => !c.resolvedAt && Date.parse(c.resolveAt) <= t).slice(0, 3);
      let changed = false;
      for (const c of due) { try { await resolveOne(c); changed = true; } catch (e) { break; } }
      if (changed) db.save();
      return { status: 200, body: { head: L.head, stats: stats(L.calls), window: "7 days", anchoring: process.env.KAELIS_LEDGER_KEY ? "on" : "pending",
        calls: L.calls.slice(-60).reverse().map(({ prev, f, ...c }) => c),
        // every call Kaelis got wrong, newest first: the page that shows the score also shows the misses
        wrong: L.calls.filter((c) => c.resolvedAt && (c.p >= 0.5 ? 1 : 0) !== c.rugged).slice(-50).reverse().map(({ prev, f, ...c }) => c),
        firstOpenedAt: L.calls.length ? L.calls[0].openedAt : null,
        nextResolveAt: (L.calls.find((c) => !c.resolvedAt) || {}).resolveAt || null,
        rule: "Rugged = no pool left, liquidity down by half or more, or price down 90% or more, 7 days after the call." } };
    },
    verify() { // recompute the whole chain
      const L = db.load(); let prev = GENESIS;
      for (const c of L.calls) { if (c.prev !== prev || callHash(c, prev) !== c.hash) return { ok: false, at: c.n }; prev = c.hash; }
      return { ok: prev === L.head, length: L.calls.length };
    },
  };
}

module.exports = { makeLedger, rugProbability, outcome, stats, callHash, market, GENESIS };
