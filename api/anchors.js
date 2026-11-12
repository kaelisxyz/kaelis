// GET /api/anchors: the daily on-chain anchors (Solana memo transactions) of Kaelis's hash chains.
const { limited, send } = require("../lib/server.js");
const { anchor } = require("../lib/ledger-instance.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  if (limited(req, 60)) return send(res, 429, { error: "Too many requests. Wait a minute." });
  try { send(res, 200, { ...anchor.view(), memoProgram: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", how: "Each anchor is a Solana memo listing the head hash and length of the Ledger and Filings chains and the latest Genome generation hash. Recompute the chains from /api/ledger and /api/filings and compare." }, 60); }
  catch (e) { send(res, 500, { error: "Anchors unavailable right now." }); }
};
