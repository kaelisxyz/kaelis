// GET /api/health: which parts are switched on. Never returns the keys themselves.
const { send } = require("../lib/server.js");
const { MODEL } = require("../lib/explain.js");
module.exports = (req, res) => send(res, 200, {
  ok: true,
  privateRpc: !!(process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL),
  aiExplain: !!process.env.ANTHROPIC_API_KEY,
  aiModel: process.env.ANTHROPIC_API_KEY ? MODEL : null,
  mcp: "/mcp",
  kaelMint: process.env.KAEL_MINT || null,
  proofOfBuild: { live: true, githubToken: !!process.env.GITHUB_API_TOKEN, persistentStorage: !!process.env.KAELIS_DATA_DIR },
  ledger: { live: true, anchoring: process.env.KAELIS_LEDGER_KEY ? "on" : "pending" },
  generation: require("../lib/ledger-instance.js").genome.current().gen,
  patrol: require("../lib/patrol.js").status.on,
  rules: require("../site/js/kaelis-core.js").RULES_VERSION,
});
