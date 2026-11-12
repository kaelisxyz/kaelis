// Kaelis Patrol: the autonomous loop. Nobody has to ask.
//   every PATROL_EVERY_MIN minutes: resolve due Ledger calls, then scan new Solana tokens that
//   DexScreener just listed (latest profiles + boosts) and record a call for each one.
//   once a day: run one Genome evolution step on the resolved calls.
// Turn it off with PATROL=off. It stays light: a few scans per round, 15 s apart, no AI calls.
const { scan } = require("./scan.js");
const { ledger, genome, markets, filings, anchor, deployers } = require("./ledger-instance.js");

const EVERY_MIN = Number(process.env.PATROL_EVERY_MIN || 30);
const BATCH = Number(process.env.PATROL_BATCH || 6);
const GAP_MS = 15000, DAY = 864e5;
const DEPLOYER_BATCH = Number(process.env.PATROL_DEPLOYERS || 25); // tokens whose deployer and funder are traced per round (about 3 RPC calls each)
const status = { on: false, startedAt: null, lastRound: null, nextRound: null, scanned: 0, scannedToday: 0, day: null, lastError: null, lastEvolve: null, nextEvolve: null };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function candidates() {
  const urls = ["https://api.dexscreener.com/token-profiles/latest/v1", "https://api.dexscreener.com/token-boosts/latest/v1"];
  const seen = new Set(), out = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { accept: "application/json" } });
      if (!r.ok) continue;
      for (const x of await r.json()) if (x && x.chainId === "solana" && x.tokenAddress && !seen.has(x.tokenAddress)) { seen.add(x.tokenAddress); out.push(x.tokenAddress); }
    } catch (e) { /* try the other list */ }
  }
  return out.filter((m) => !ledger.has(m));
}

async function round() {
  const today = new Date().toISOString().slice(0, 10);
  if (status.day !== today) { status.day = today; status.scannedToday = 0; }
  status.lastRound = new Date().toISOString(); status.running = true;
  try {
    await ledger.resolveDue(30);
    try { const f = await filings.check(25); status.filed = (status.filed || 0) + f.length; } catch (e) { status.lastError = "filings: " + String(e && e.message || e).slice(0, 120); }
    const list = (await candidates()).slice(0, BATCH);
    let made = 0; // new calls this round (tokens without a pool make no call)
    for (const mint of list) {
      try {
        const g = genome.current();
        const out = await scan(mint, { withExplain: false, withLinks: false, genome: g });
        if (ledger.record({ ...out, by: "patrol" }, g)) { status.scanned++; status.scannedToday++; made++; filings.track(out); }
      } catch (e) { status.lastError = String(e && e.message || e).slice(0, 160); }
      await sleep(GAP_MS);
    }
    // backfill: spare slots re-scan open calls made before insiders were recorded (newest first, under 5 days old)
    const spare = Math.max(0, BATCH - made);
    if (spare) {
      const t5 = Date.now() - 5 * 864e5;
      const todo = ledger.all().filter((c) => !c.resolvedAt && c.asset !== "stock" && Date.parse(c.openedAt) > t5 && !filings.isTracked(c.mint)).slice(-spare).reverse();
      for (const c of todo) {
        try { const out = await scan(c.mint, { withExplain: false, withLinks: false, genome: genome.current() }); if (filings.track(out)) status.backfilled = (status.backfilled || 0) + 1; }
        catch (e) { /* next one */ }
        await sleep(GAP_MS);
      }
    }
    // deployers: who launched each tested token and who funded that wallet (newest calls first, then back through the Ledger)
    for (const mint of deployers.pending(ledger.all(), DEPLOYER_BATCH)) {
      try { const t = await deployers.learn(mint); if (t && t.deployer) status.deployersTraced = (status.deployersTraced || 0) + 1; }
      catch (e) { status.lastError = "deployers: " + String(e && e.message || e).slice(0, 120); }
      await sleep(1500);
    }
    // tokenized stocks: one open call each, renewed every 7 days, same rules as memecoins
    for (const s of markets.STOCKS) {
      if (ledger.openCall(s.mint)) continue;
      try { const g = genome.current(); const out = await scan(s.mint, { withExplain: false, withLinks: false, genome: g }); if (ledger.record({ ...out, by: "patrol", asset: "stock" }, g)) status.scanned++; }
      catch (e) { status.lastError = "stock " + s.sym + ": " + String(e && e.message || e).slice(0, 120); }
      await sleep(GAP_MS);
    }
    // one index point per round: K-20 vs SPYx, plus Kaelis IQ
    try { const st = (await ledger.list()).body.stats; await markets.tick(ledger.all(), { iq: st.iq, gen: genome.current().gen }); }
    catch (e) { status.lastError = "markets: " + String(e && e.message || e).slice(0, 120); }
  } catch (e) { status.lastError = String(e && e.message || e).slice(0, 160); }
  // one evolution step a day
  const last = status.lastEvolve ? Date.parse(status.lastEvolve) : 0;
  if (Date.now() - last >= DAY) {
    try { const r = genome.run(ledger.all()); status.lastEvolve = r.at; status.lastEvolveResult = r; } catch (e) { status.lastError = "evolve: " + e.message; }
    status.nextEvolve = new Date(Date.parse(status.lastEvolve || new Date().toISOString()) + DAY).toISOString();
  }
  // once a day: write the chain heads to Solana (only if both chains verify)
  if (anchor.address && anchor.due()) {
    try {
      const lv = ledger.verify(), fv = filings.verify(), gv = genome.view([]);
      if (lv.ok && fv.ok) {
        const fl = filings.view(1), g0 = gv.history[0];
        const r = await anchor.anchor({ ledger: ledger.head(), filings: { head: fl.head, length: fl.filed }, genome: { gen: gv.gen, hash: g0.hash } });
        status.lastAnchor = r.signature || r.skipped;
      } else status.lastAnchor = "skipped: a chain did not verify";
    } catch (e) { status.lastError = "anchor: " + String(e && e.message || e).slice(0, 120); }
  }
  status.nextRound = new Date(Date.now() + EVERY_MIN * 60000).toISOString();
  status.running = false;
}

function start() {
  if (status.on || /^(off|0|false)$/i.test(process.env.PATROL || "")) return status;
  status.on = true; status.startedAt = new Date().toISOString();
  status.nextRound = new Date(Date.now() + 20000).toISOString();
  const runs = genome.view([]).runs; if (runs.length) status.lastEvolve = runs[0].at; // survive restarts
  status.nextEvolve = status.lastEvolve ? new Date(Date.parse(status.lastEvolve) + DAY).toISOString() : status.nextRound;
  setTimeout(function loop() { round().finally(() => setTimeout(loop, EVERY_MIN * 60000)); }, 20000).unref?.();
  return status;
}

module.exports = { start, status, candidates };
