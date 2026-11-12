// GET /api/scan?mint=<address>
// Server-side scan: same rules as the website, private RPC if configured, wallet-link
// deep scan, and an optional AI explanation that is checked against the score.
const { K, limited, send, query } = require("../lib/server.js");
const { scan } = require("../lib/scan.js");
const { ledger, genome, filings } = require("../lib/ledger-instance.js");
const { STOCK_MINTS } = require("../lib/markets.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const mint = (query(req).get("mint") || "").trim();
  if (!K.isAddress(mint)) return send(res, 400, { error: "That doesn't look like a Solana address.", userError: true });
  if (limited(req, Number(process.env.SCAN_RATE_PER_MIN || 20))) return send(res, 429, { error: "Too many scans from this address. Wait a minute and try again.", userError: true });
  try {
    const out = await scan(mint);
    let call = null;
    try { const fresh = ledger.record({ ...out, asset: STOCK_MINTS.has(mint) ? "stock" : "token" }, genome.current()); if (fresh && !STOCK_MINTS.has(mint)) filings.track(out); call = fresh || ledger.openCall(mint); } catch (e) { call = null; } // the Ledger never blocks a scan
    send(res, 200, { ...out, call: call ? { n: call.n, p: call.p, hash: call.hash, resolveAt: call.resolveAt } : null }, 30);
  } catch (e) {
    const msg = e && e.message || "Scan failed.";
    const user = /address|mint|account found/i.test(msg);
    send(res, user ? 400 : 502, { error: msg, userError: user });
  }
};
