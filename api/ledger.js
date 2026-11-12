// GET /api/ledger: Kaelis's public calls, outcomes and IQ (calibration score).
const { limited, send, query } = require("../lib/server.js");
const { ledger } = require("../lib/ledger-instance.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  if (limited(req, 60)) return send(res, 429, { error: "Too many requests. Wait a minute." });
  if (query(req).get("shelf")) return send(res, 200, { shelf: ledger.shelf(320) }, 120);
  try { const r = await ledger.list(); send(res, r.status, { ...r.body, chain: ledger.verify() }); }
  catch (e) { send(res, 500, { error: "Ledger unavailable right now." }); }
};
