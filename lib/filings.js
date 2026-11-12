// Kaelis Filings: an SEC-style disclosure feed for memecoins.
// When Kaelis makes a call it records the token's insiders: the 10 largest wallets that are not pools,
// with their balances. Each Patrol round it re-reads those balances (one RPC call per token) and files:
//   K-4  insider sale       an insider sold >= 20% of their bag and >= 0.5% of supply
//   K-8  liquidity pulled   the pools lost half their money (from >= $1k)
//   K-3  authority back on  mint or freeze authority switched back on after the call
// Filings are hash-chained like the Ledger. Tracking stops after 7 days (when the call is graded).
const crypto = require("crypto");
const { store } = require("./build.js");

const WINDOW_MS = 7 * 864e5, MAX_TRACKED = 80, MIN_SALE_OF_BAG = 0.2, MIN_SALE_OF_SUPPLY = 0.005;
const GENESIS = "0".repeat(64);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const pct = (x) => (x * 100).toFixed(x < 0.1 ? 1 : 0) + "%";
const usd = (n) => (n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "k" : "$" + Math.round(n));
const short = (a) => String(a).slice(0, 4) + "…" + String(a).slice(-4);
function filingHash(f, prev) { return sha(["kaelis-filing", prev, f.n, f.form, f.mint, f.at, f.detail].join("|")); }

function rpcClient(urls, fetchFn) {
  return async (method, params) => {
    let last;
    for (const u of urls) {
      try {
        const r = await fetchFn(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        if (!r.ok) { last = new Error("RPC " + r.status); continue; }
        const j = await r.json(); if (j.error) { last = new Error(j.error.message || "RPC error"); continue; }
        return j.result;
      } catch (e) { last = e; }
    }
    throw last || new Error("No RPC answered.");
  };
}

function makeFilings({ fetchFn = fetch, rpc = null, rpcUrls = () => require("./server.js").rpcUrls(), db = store(undefined, "filings.json", () => ({ head: GENESIS, filings: [], tracked: {} })), now = () => Date.now() } = {}) {
  const call = rpc || rpcClient(rpcUrls(), fetchFn);
  function file(d, f) {
    f.n = d.filings.length + 1; f.at = new Date(now()).toISOString(); f.prev = d.head;
    f.hash = filingHash(f, d.head); d.head = f.hash; d.filings.push(f);
    return f;
  }
  async function liquidity(mints) {
    const out = {};
    for (let i = 0; i < mints.length; i += 5) {
      const list = mints.slice(i, i + 5);
      try {
        const r = await fetchFn("https://api.dexscreener.com/latest/dex/tokens/" + list.join(","), { headers: { accept: "application/json" } });
        if (!r.ok) continue;
        for (const p of (await r.json()).pairs || []) if (p && p.chainId === "solana" && p.baseToken && list.includes(p.baseToken.address)) out[p.baseToken.address] = (out[p.baseToken.address] || 0) + ((p.liquidity && p.liquidity.usd) || 0);
      } catch (e) { /* try the next batch */ }
    }
    return out;
  }
  return {
    // start watching the insiders of a token Kaelis just called (out = a finished scan)
    track(out) {
      const dd = out && out.data; if (!dd || !Array.isArray(dd.holders) || !dd.supply) return false;
      const insiders = dd.holders.filter((h) => h && !h.pool && h.owner && h.amount > 0).slice(0, 10).map((h) => ({ owner: h.owner, account: h.address, amount: h.amount }));
      if (!insiders.length) return false;
      const d = db.load();
      if (d.tracked[dd.mint]) return false;
      const top = (dd.pairs || []).filter((p) => p.baseToken && p.baseToken.address === dd.mint).sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
      d.tracked[dd.mint] = { symbol: top ? top.baseToken.symbol : null, since: new Date(now()).toISOString(), supply: dd.supply, insiders,
        liq0: (dd.pairs || []).reduce((t, p) => t + ((p.liquidity && p.liquidity.usd) || 0), 0), mintAuth: dd.mintInfo.mintAuthority || null, freezeAuth: dd.mintInfo.freezeAuthority || null, checked: null, liqFiled: false };
      const keys = Object.keys(d.tracked); // keep the newest MAX_TRACKED
      if (keys.length > MAX_TRACKED) keys.sort((a, b) => Date.parse(d.tracked[a].since) - Date.parse(d.tracked[b].since)).slice(0, keys.length - MAX_TRACKED).forEach((k) => delete d.tracked[k]);
      db.save();
      return true;
    },
    isTracked(mint) { return !!db.load().tracked[mint]; },
    // re-read up to `max` tracked tokens (least recently checked first) and file what changed
    async check(max = 25) {
      const d = db.load(), t = now(), filed = [];
      for (const [m, tr] of Object.entries(d.tracked)) if (t - Date.parse(tr.since) > WINDOW_MS) delete d.tracked[m];
      const due = Object.entries(d.tracked).sort((a, b) => (a[1].checked ? Date.parse(a[1].checked) : 0) - (b[1].checked ? Date.parse(b[1].checked) : 0)).slice(0, max);
      const liq = await liquidity(due.map(([m]) => m));
      for (const [mint, tr] of due) {
        try {
          const accs = await call("getMultipleAccounts", [tr.insiders.map((i) => i.account).concat(mint), { encoding: "jsonParsed" }]);
          const vals = accs.value, mi = vals[vals.length - 1];
          tr.insiders.forEach((ins, k) => {
            const a = vals[k], now0 = a && a.data && a.data.parsed ? +a.data.parsed.info.tokenAmount.uiAmountString : 0;
            const sold = ins.amount - now0;
            if (sold > 0 && sold >= ins.amount * MIN_SALE_OF_BAG && sold >= tr.supply * MIN_SALE_OF_SUPPLY) {
              filed.push(file(d, { form: "K-4", title: "Insider sale", mint, symbol: tr.symbol, owner: ins.owner,
                detail: `Insider ${short(ins.owner)} sold ${pct(sold / tr.supply)} of supply (${pct(sold / ins.amount)} of their bag)${now0 <= 0 ? " and closed the position" : ""}.`, soldOfSupply: sold / tr.supply }));
              ins.amount = now0; // the next sale is a new filing
            }
          });
          const info = mi && mi.data && mi.data.parsed ? mi.data.parsed.info : null;
          if (info) {
            if (!tr.mintAuth && info.mintAuthority) { filed.push(file(d, { form: "K-3", title: "Mint authority back on", mint, symbol: tr.symbol, detail: `Mint authority was switched back on (${short(info.mintAuthority)}). New tokens can be created again.` })); tr.mintAuth = info.mintAuthority; }
            if (!tr.freezeAuth && info.freezeAuthority) { filed.push(file(d, { form: "K-3", title: "Freeze authority back on", mint, symbol: tr.symbol, detail: `Freeze authority was switched back on (${short(info.freezeAuthority)}). Holders can be frozen again.` })); tr.freezeAuth = info.freezeAuthority; }
          }
          if (!tr.liqFiled && tr.liq0 >= 1000 && mint in liq && liq[mint] < tr.liq0 * 0.5) {
            filed.push(file(d, { form: "K-8", title: "Liquidity pulled", mint, symbol: tr.symbol, detail: `Pools fell from ${usd(tr.liq0)} to ${usd(liq[mint])} (${pct(1 - liq[mint] / tr.liq0)} gone).` })); tr.liqFiled = true;
          }
          tr.checked = new Date(t).toISOString();
        } catch (e) { break; } // RPC trouble: try again next round
      }
      db.save();
      return filed;
    },
    view(limit = 100) {
      const d = db.load(), byForm = {};
      d.filings.forEach((f) => (byForm[f.form] = (byForm[f.form] || 0) + 1));
      return { head: d.head, tracked: Object.keys(d.tracked).length, filed: d.filings.length, byForm, filings: d.filings.slice(-limit).reverse().map(({ prev, ...f }) => f),
        forms: { "K-4": "Insider sale", "K-8": "Liquidity pulled", "K-3": "Authority back on" } };
    },
    verify() { const d = db.load(); let prev = GENESIS; for (const f of d.filings) { if (f.prev !== prev || filingHash(f, prev) !== f.hash) return { ok: false, at: f.n }; prev = f.hash; } return { ok: prev === d.head, length: d.filings.length }; },
  };
}

module.exports = { makeFilings, rpcClient };
