// POST /mcp : Kaelis as an MCP server (Streamable HTTP, stateless, JSON responses).
// Lets AI agents and assistants (Claude, Cursor, Eliza, Solana Agent Kit) check a token
// before they buy it. Same rules and score as the website.
const { K, limited } = require("../lib/server.js");
const { scan, brief } = require("../lib/scan.js");

const PROTOCOL = "2025-06-18";
const TOOLS = [
  {
    name: "scan_token",
    title: "Scan a Solana token for scam risk",
    description: "Runs Kaelis' 8 fixed checks on a Solana token (sell test via Jupiter quotes, liquidity, top holders, LP lock, mint and freeze authority, Token-2022 extensions, pool age) plus a wallet-funding trace of the top holders. Returns a risk score from 0 (no known red flag) to 100, a band, and evidence for every check. Read-only: nothing is traded.",
    inputSchema: { type: "object", properties: { mint: { type: "string", description: "The token's mint address (base58, 32 to 44 characters)." } }, required: ["mint"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "check_before_buy",
    title: "Should an agent buy this token?",
    description: "A guard for trading agents. Scans the token and returns allow=false when the Kaelis score is above max_score (default 69, i.e. 'dangerous' is blocked) or when a hard flag such as a failed sell test is found. Use it right before executing a swap into an unknown token.",
    inputSchema: { type: "object", properties: { mint: { type: "string", description: "The token's mint address." }, max_score: { type: "integer", minimum: 0, maximum: 100, description: "Highest score you still accept. Default 69." } }, required: ["mint"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, mcp-protocol-version, mcp-session-id, authorization");
  res.end(body == null ? "" : JSON.stringify(body));
}
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id: id == null ? null : id, error: { code, message } });

async function callTool(name, args) {
  const mint = String((args && args.mint) || "").trim();
  if (!K.isAddress(mint)) return { isError: true, content: [{ type: "text", text: "That doesn't look like a Solana mint address (base58, 32 to 44 characters)." }] };
  let out;
  try { out = brief(await scan(mint)); }
  catch (e) { return { isError: true, content: [{ type: "text", text: "Scan failed: " + (e && e.message || "unknown error") }] }; }
  if (name === "check_before_buy") {
    const max = Number.isInteger(args.max_score) ? args.max_score : 69;
    const allow = !out.hardFlag && out.score <= max;
    const reasons = out.checks.filter((c) => c.points && c.points >= c.max / 2).map((c) => `${c.name}: ${c.evidence}`);
    const res = { allow, score: out.score, band: out.band, maxScore: max, hardFlag: out.hardFlag, reasons, summary: out.summary, links: out.links, disclaimer: out.disclaimer };
    return { content: [{ type: "text", text: JSON.stringify(res) }], structuredContent: res };
  }
  return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
}

async function handle(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg && msg.id, -32600, "Invalid request");
  const isNote = msg.id === undefined;
  switch (msg.method) {
    case "initialize":
      return ok(msg.id, { protocolVersion: (msg.params && msg.params.protocolVersion) || PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "kaelis", title: "Kaelis token scanner", version: K.RULES_VERSION }, instructions: "Call check_before_buy before buying an unknown Solana token, or scan_token for the full evidence. Scores: 0-39 low, 40-69 suspicious, 70-100 dangerous. A low score is not a promise of safety." });
    case "ping": return ok(msg.id, {});
    case "tools/list": return ok(msg.id, { tools: TOOLS });
    case "tools/call": {
      const p = msg.params || {};
      if (!TOOLS.some((t) => t.name === p.name)) return fail(msg.id, -32602, "Unknown tool: " + p.name);
      return ok(msg.id, await callTool(p.name, p.arguments || {}));
    }
    default:
      return isNote ? null : fail(msg.id, -32601, "Method not found: " + msg.method);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) return resolve(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on("end", () => resolve(b)); req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return reply(res, 204, null);
  if (req.method === "GET") return reply(res, 405, fail(null, -32000, "This server does not stream. POST JSON-RPC messages to /mcp."));
  if (req.method !== "POST") return reply(res, 405, null);
  if (limited(req, Number(process.env.MCP_RATE_PER_MIN || 30))) return reply(res, 429, fail(null, -32000, "Rate limit: wait a minute."));
  let msg;
  try { msg = JSON.parse(await readBody(req)); } catch (e) { return reply(res, 400, fail(null, -32700, "Parse error")); }
  if (Array.isArray(msg)) {
    const outs = (await Promise.all(msg.map(handle))).filter(Boolean);
    return outs.length ? reply(res, 200, outs) : reply(res, 202, null);
  }
  const out = await handle(msg);
  return out ? reply(res, 200, out) : reply(res, 202, null);
};
