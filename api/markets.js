// GET /api/markets: tokenized stocks rated by Kaelis, the K-20 vs S&P 500 series, KIQ and ticker look-alikes.
const { limited, send } = require("../lib/server.js");
const { ledger, markets } = require("../lib/ledger-instance.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  if (limited(req, 60)) return send(res, 429, { error: "Too many requests. Wait a minute." });
  try { send(res, 200, markets.view(ledger.all()), 60); }
  catch (e) { send(res, 500, { error: "Markets unavailable right now." }); }
};
