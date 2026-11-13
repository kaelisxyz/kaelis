// GET /api/scan?mint=<address>[&chain=solana|ethereum|bsc|base|robinhood]  (a 0x address with no chain is looked up)
// Server-side scan: same rules as the website, private RPC if configured, wallet-link
// deep scan, and an optional AI explanation that is checked against the score.
const { K, limited, send, query, tokenAddress } = require("../lib/server.js");
const { scan } = require("../lib/scan.js");
const { ledger, genome, filings, deployers } = require("../lib/ledger-instance.js");
const { STOCK_MINTS } = require("../lib/markets.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const q = query(req), t = tokenAddress(q.get("mint"), q.get("chain"));
  if (t.error) return send(res, 400, { error: t.error, userError: true });
  const mint = t.mint;
  if (limited(req, Number(process.env.SCAN_RATE_PER_MIN || 20))) return send(res, 429, { error: "Too many scans from this address. Wait a minute and try again.", userError: true });
  try {
    const out = await scan(mint, { chain: t.chain === "solana" ? null : t.chain });
    const sol = !out.data.chain || out.data.chain === "solana";
    let call = null;
    if (!sol && out.data.creator) deployers.note(out.data.mint, out.data.creator, "goplus", out.data.chain); // EVM: the creator comes with the contract reading
    try { const fresh = ledger.record({ ...out, asset: STOCK_MINTS.has(mint) ? "stock" : "token" }, genome.current()); if (fresh && sol && !STOCK_MINTS.has(mint)) filings.track(out); call = fresh || ledger.openCall(out.data.mint); } catch (e) { call = null; } // the Ledger never blocks a scan
    send(res, 200, { ...out, call: call ? { n: call.n, p: call.p, hash: call.hash, resolveAt: call.resolveAt } : null }, 30);
  } catch (e) {
    const msg = e && e.message || "Scan failed.";
    const user = /address|mint|account found|chain/i.test(msg);
    send(res, user ? 400 : 502, { error: msg, userError: user });
  }
};
