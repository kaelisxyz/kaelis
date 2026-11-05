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
  rules: require("../site/js/kaelis-core.js").RULES_VERSION,
});
