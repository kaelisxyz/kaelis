// GET /api/filings: Kaelis's SEC-style disclosures (insider sales, liquidity pulled, authority back on).
const { limited, send } = require("../lib/server.js");
const { filings } = require("../lib/ledger-instance.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  if (limited(req, 60)) return send(res, 429, { error: "Too many requests. Wait a minute." });
  try { send(res, 200, { ...filings.view(100), chain: filings.verify() }, 30); }
  catch (e) { send(res, 500, { error: "Filings unavailable right now." }); }
};
