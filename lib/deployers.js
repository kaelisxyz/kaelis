// Kaelis Deployers: who launched each token Kaelis has tested, who first funded that wallet,
// and how that wallet's tokens turned out. This is the data behind deployer reputation and clusters.
//
// What it is: a join of three public facts.
//   1. creator of a token   = RugCheck's report (`creator`), or else the fee payer of the oldest
//                             transaction on the mint account (only if the history is short enough to reach it).
//   2. funder of a wallet   = the source of the system transfer in the wallet's first transaction.
//                             A funder with 1000+ transactions is a hub (an exchange, a bridge, a bot service):
//                             thousands of unrelated people share it, so it never forms a cluster.
//   3. outcome of a token   = the Ledger's own 7-day result (held or rugged) for the calls Kaelis made.
// What it is not: a list of every token a wallet ever launched. Only tokens Kaelis has tested count,
// and every number says so. The store is a plain JSON file (not hash-chained); the outcomes it reads are.
const { store } = require("./build.js");

const HUB_TX = 1000, MAX_TRIES = 3, PRIOR = 0.3;
const isAddr = (s) => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

function makeDeployers({ db = store(undefined, "deployers.json", () => ({ tokens: {}, wallets: {} })), rpc, json, now = () => Date.now() } = {}) {
  const iso = () => new Date(now()).toISOString();

  // ---- 1. who created this token
  async function creatorOf(mint) {
    try {
      const r = await json("https://api.rugcheck.xyz/v1/tokens/" + mint + "/report");
      if (r && isAddr(r.creator)) return { deployer: r.creator, via: "rugcheck", platform: (r.launchpad && r.launchpad.name) || r.deployPlatform || null };
    } catch (e) { /* fall through to the chain */ }
    let before = null, last = null, reached = false;
    for (let page = 0; page < 3 && !reached; page++) { // at most 3000 signatures back
      const sigs = await rpc("getSignaturesForAddress", [mint, before ? { limit: 1000, before } : { limit: 1000 }]);
      if (!sigs || !sigs.length) { reached = !!last; break; }
      last = sigs[sigs.length - 1]; before = last.signature; reached = sigs.length < 1000;
    }
    if (!reached || !last) return null; // too busy a token: its first transaction is out of reach
    const tx = await rpc("getTransaction", [last.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    const keys = (tx && tx.transaction && tx.transaction.message.accountKeys) || [];
    const fp = keys.find((k) => k.signer);
    const who = fp && (fp.pubkey || fp);
    return isAddr(who) ? { deployer: who, via: "first-tx", platform: null, tx: last.signature } : null;
  }

  // ---- 2. who first funded this wallet
  async function trace(wallet) {
    const w = { funder: null, fundTx: null, firstAt: null, txCount: null, hub: false, tracedAt: iso() };
    const sigs = await rpc("getSignaturesForAddress", [wallet, { limit: 1000 }]);
    w.txCount = sigs.length;
    if (sigs.length >= HUB_TX) { w.hub = true; return w; } // the wallet itself is very busy: its origin is too far back
    if (!sigs.length) return w;
    const first = sigs[sigs.length - 1];
    w.fundTx = first.signature; w.firstAt = first.blockTime ? new Date(first.blockTime * 1000).toISOString() : null;
    const tx = await rpc("getTransaction", [first.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    const ixs = [];
    if (tx && tx.transaction) {
      ixs.push(...(tx.transaction.message.instructions || []));
      for (const g of (tx.meta && tx.meta.innerInstructions) || []) ixs.push(...(g.instructions || []));
    }
    const fund = ixs.find((ix) => ix.parsed && ix.program === "system" && /transfer|createAccount/.test(ix.parsed.type) && ix.parsed.info && (ix.parsed.info.destination === wallet || ix.parsed.info.newAccount === wallet));
    if (fund && isAddr(fund.parsed.info.source)) w.funder = fund.parsed.info.source;
    else { const fp = ((tx && tx.transaction && tx.transaction.message.accountKeys) || []).find((k) => k.signer); const who = fp && (fp.pubkey || fp); if (isAddr(who) && who !== wallet) w.funder = who; }
    return w;
  }
  async function isHub(funder) { // cached per funder
    const D = db.load(), known = D.wallets[funder];
    if (known && known.txCount != null) return known.txCount >= HUB_TX;
    const sigs = await rpc("getSignaturesForAddress", [funder, { limit: 1000 }]);
    D.wallets[funder] = Object.assign(D.wallets[funder] || {}, { txCount: sigs.length, hub: sigs.length >= HUB_TX, seenAt: iso() });
    return sigs.length >= HUB_TX;
  }

  // ---- learn one token: creator, then the creator's funder. Safe to call again; gives up after MAX_TRIES.
  async function learn(mint) {
    const D = db.load(), have = D.tokens[mint];
    if (have && !have.deployer && (have.tries || 0) >= MAX_TRIES) return have;
    let rec = have;
    if (!have || !have.deployer) {
      let c = null;
      try { c = await creatorOf(mint); } catch (e) { c = null; }
      rec = c ? { deployer: c.deployer, via: c.via, platform: c.platform, at: iso() } : { deployer: null, tries: ((have && have.tries) || 0) + 1, at: iso() };
      if (c && c.tx) rec.tx = c.tx;
      D.tokens[mint] = rec;
    }
    if (rec.deployer && needsTrace(rec.deployer)) {
      const w0 = D.wallets[rec.deployer] = D.wallets[rec.deployer] || {};
      try {
        Object.assign(w0, await trace(rec.deployer));
        if (w0.funder) w0.funderHub = await isHub(w0.funder);
      } catch (e) { w0.traceTries = (w0.traceTries || 0) + 1; } // an RPC hiccup: try again on a later round, three times at most
    }
    db.save();
    return rec;
  }
  const needsTrace = (a) => { const w = db.load().wallets[a]; return !(w && w.tracedAt) && ((w && w.traceTries) || 0) < MAX_TRIES; };
  // mints from the Ledger that still need learning (creator unknown, or its wallet not traced yet), newest first
  function pending(calls, n = 10) {
    const D = db.load(), seen = new Set(), out = [];
    for (let i = calls.length - 1; i >= 0 && out.length < n; i--) {
      const c = calls[i]; if (c.asset === "stock" || seen.has(c.mint)) continue; seen.add(c.mint);
      const t = D.tokens[c.mint];
      if (!t || (!t.deployer && (t.tries || 0) < MAX_TRIES) || (t.deployer && needsTrace(t.deployer))) out.push(c.mint);
    }
    return out;
  }

  // ---- reading
  const tokenRow = (c) => ({ mint: c.mint, symbol: c.symbol || null, grade: c.finalGrade || c.grade, score: c.score, p: c.p,
    state: c.resolvedAt ? (c.rugged ? "rugged" : "held") : "open", openedAt: c.openedAt, call: c.n, hash: c.hash });
  function byDeployer(calls) { // deployer -> latest call per mint
    const D = db.load(), map = {};
    for (const c of calls) { const t = D.tokens[c.mint]; if (!t || !t.deployer) continue; (map[t.deployer] = map[t.deployer] || {})[c.mint] = c; }
    return map;
  }
  // Risk 0-100 = the share of this wallet's tested tokens expected to end as rugs:
  // confirmed rugs count 1, held tokens 0, open calls their published rug chance, plus a weak prior so one token is not a verdict.
  function rate(rows) {
    const rugged = rows.filter((r) => r.state === "rugged").length, held = rows.filter((r) => r.state === "held").length, open = rows.filter((r) => r.state === "open");
    const expected = rugged + open.reduce((t, r) => t + (r.p || 0), 0);
    const risk = Math.round(100 * (PRIOR + expected) / (1 + rows.length));
    const level = rugged >= 3 || (rugged >= 2 && rugged / Math.max(1, rugged + held) >= 0.5) ? "serial" : rugged >= 1 ? "flagged" : held >= 2 ? "clean" : rows.length ? (risk >= 50 ? "watch" : "new") : "unknown";
    return { tested: rows.length, rugged, held, open: open.length, risk, level };
  }
  function clusterOf(funder, map) {
    const D = db.load();
    return Object.keys(map).filter((a) => { const w = D.wallets[a]; return w && w.funder === funder && !w.funderHub; });
  }
  function profile(address, calls, filings = []) {
    const D = db.load(), map = byDeployer(calls), mine = Object.values(map[address] || {}).map(tokenRow).sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
    const w = D.wallets[address] || null, mints = new Set(mine.map((r) => r.mint));
    const out = { address, known: mine.length > 0, ...rate(mine), tokens: mine, filings: filings.filter((f) => mints.has(f.mint)).length,
      wallet: w ? { firstAt: w.firstAt, txCount: w.txCount, busy: !!w.hub } : null, funder: null, cluster: null,
      links: { solscan: "https://solscan.io/account/" + address }, note: "Counts only tokens Kaelis has tested, not every token this wallet ever launched." };
    if (w && w.funder) {
      out.funder = { address: w.funder, tx: w.fundTx, hub: !!w.funderHub, link: w.fundTx ? "https://solscan.io/tx/" + w.fundTx : null };
      if (!w.funderHub) {
        const sib = clusterOf(w.funder, map).filter((a) => a !== address);
        if (sib.length) { const rows = sib.map((a) => ({ address: a, ...rate(Object.values(map[a]).map(tokenRow)) }));
          out.cluster = { funder: w.funder, wallets: rows.length + 1, others: rows.slice(0, 50), rugged: rows.reduce((t, r) => t + r.rugged, 0) + out.rugged, tested: rows.reduce((t, r) => t + r.tested, 0) + out.tested }; }
      }
    }
    return out;
  }
  function ofMint(mint) { const t = db.load().tokens[mint]; return t && t.deployer ? t : null; }
  // the whole map: totals, the busiest deployers, and every cluster (two or more deployers with one non-hub funder)
  function board(calls, top = 50) {
    const D = db.load(), map = byDeployer(calls), rows = Object.keys(map).map((a) => ({ address: a, ...rate(Object.values(map[a]).map(tokenRow)) }));
    const groups = {};
    for (const r of rows) { const w = D.wallets[r.address]; if (w && w.funder && !w.funderHub) (groups[w.funder] = groups[w.funder] || []).push(r); }
    const clusters = Object.keys(groups).filter((f) => groups[f].length >= 2).map((f) => ({ funder: f, wallets: groups[f].length, tested: groups[f].reduce((t, r) => t + r.tested, 0),
      rugged: groups[f].reduce((t, r) => t + r.rugged, 0), members: groups[f].map((r) => r.address) })).sort((a, b) => b.wallets - a.wallets);
    const known = Object.values(D.tokens).filter((t) => t.deployer).length;
    return { totals: { tokensWithDeployer: known, tokensTried: Object.keys(D.tokens).length, deployers: rows.length, traced: rows.filter((r) => D.wallets[r.address] && D.wallets[r.address].tracedAt).length, clusters: clusters.length },
      deployers: rows.sort((a, b) => b.tested - a.tested || b.risk - a.risk).slice(0, top), clusters: clusters.slice(0, top) };
  }
  return { learn, pending, profile, ofMint, board, rate, creatorOf, trace };
}

module.exports = { makeDeployers, isAddr, HUB_TX };
