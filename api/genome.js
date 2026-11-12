// GET /api/genome: the current generation, its DNA, the family tree and the Patrol status.
const { limited, send } = require("../lib/server.js");
const { ledger, genome } = require("../lib/ledger-instance.js");
const patrol = require("../lib/patrol.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  if (limited(req, 60)) return send(res, 429, { error: "Too many requests. Wait a minute." });
  const calls = ledger.all();
  const { lastError, ...p } = patrol.status;
  send(res, 200, { ...genome.view(calls), patrol: { ...p, everyMin: Number(process.env.PATROL_EVERY_MIN || 30) },
    ledger: { calls: calls.length, byPatrol: calls.filter((c) => c.by === "patrol").length, open: calls.filter((c) => !c.resolvedAt).length } });
};
