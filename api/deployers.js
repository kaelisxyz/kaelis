// Deployer reputation.
//   GET /api/deployers                 the map: totals, the busiest deployers, every funding cluster
//   GET /api/deployer?address=<wallet> one wallet: its tested tokens and their outcomes, who funded it, its cluster
//   GET /api/deployer?mint=<token>     the same, for whoever launched that token
// Every number counts only tokens Kaelis has tested. Outcomes come from the hash-chained Ledger.
const { limited, send, query } = require("../lib/server.js");
const { ledger, filings, deployers } = require("../lib/ledger-instance.js");
const { isAddr } = require("../lib/deployers.js");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  if (limited(req, 60)) return send(res, 429, { error: "Too many requests. Wait a minute." });
  const q = query(req), path = req.url.split("?")[0];
  try {
    if (path.endsWith("/deployers")) return send(res, 200, deployers.board(ledger.all()), 60);
    let address = (q.get("address") || "").trim();
    const mint = (q.get("mint") || "").trim();
    if (mint) {
      if (!isAddr(mint)) return send(res, 400, { error: "That is not a token address." });
      let t = deployers.ofMint(mint);
      if (!t && ledger.has(mint) && !/^0x/i.test(mint)) t = await deployers.learn(mint); // a tested token whose deployer was not traced yet
      if (!t || !t.deployer) return send(res, 404, { error: ledger.has(mint) ? "The deployer of this token could not be identified yet." : "Kaelis has not tested this token. Test it first, then ask again.", mint });
      address = t.deployer;
    }
    if (!isAddr(address)) return send(res, 400, { error: "Pass ?address=<wallet> or ?mint=<token>." });
    if (/^0x/i.test(address)) address = address.toLowerCase();
    const p = deployers.profile(address, ledger.all(), filings.view(100000).filings);
    if (mint) { const t = deployers.ofMint(mint); p.asked = { mint, via: t.via, platform: t.platform || null }; }
    send(res, 200, p, 30);
  } catch (e) { send(res, 500, { error: "Deployer data unavailable right now." }); }
};
