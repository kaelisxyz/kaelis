// GET /api/scan?mint=<address>
// Server-side scan: same rules as the website, private RPC if configured, wallet-link
// deep scan, and an optional AI explanation that is checked against the score.
const { K, limited, send, query } = require("../lib/server.js");
const { scan } = require("../lib/scan.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const mint = (query(req).get("mint") || "").trim();
  if (!K.isAddress(mint)) return send(res, 400, { error: "That doesn't look like a Solana address.", userError: true });
  if (limited(req, Number(process.env.SCAN_RATE_PER_MIN || 20))) return send(res, 429, { error: "Too many scans from this address. Wait a minute and try again.", userError: true });
  try {
    send(res, 200, await scan(mint), 30);
  } catch (e) {
    const msg = e && e.message || "Scan failed.";
    const user = /address|mint|account found/i.test(msg);
    send(res, user ? 400 : 502, { error: msg, userError: user });
  }
};
