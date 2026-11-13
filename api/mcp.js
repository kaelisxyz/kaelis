// POST /mcp : Kaelis as an MCP server (Streamable HTTP, stateless, JSON responses).
// The agent safety layer: a pre-trade check (allow / warn / block) and deployer reputation for AI agents
// and trading bots (Claude, Cursor, Eliza, Solana Agent Kit). Same rules and score as the website.
const { K, limited } = require("../lib/server.js");
const { scan, brief } = require("../lib/scan.js");
const { ledger, filings, deployers } = require("../lib/ledger-instance.js");

const PROTOCOL = "2025-06-18";
const MINT = { type: "string", description: "The token's mint address (base58, 32 to 44 characters)." };
const TOOLS = [
  {
    name: "check_before_buy",
    title: "Pre-trade safety check: allow, warn or block",
    description: "Call this before an agent or bot buys a Solana token. Runs Kaelis' fixed checks (sell test via Jupiter quotes, liquidity, top holders, LP lock, mint and freeze authority, Token-2022 extensions, pool age) and returns decision = 'block' (a hard flag such as a failed sell test, or a score above max_score), 'warn' (score at or above warn_score, a check that could not run, or a deployer with confirmed rugs) or 'allow'. Also returns the score, the reasons, the deployer's record if Kaelis knows it, and proof: the hash of Kaelis' sealed Ledger call for this token and links to the on-chain evidence. A decision is a risk estimate from public data, not financial advice.",
    inputSchema: { type: "object", properties: { mint: MINT,
      max_score: { type: "integer", minimum: 0, maximum: 100, description: "Block above this score. Default 69 (the 'dangerous' band is blocked)." },
      warn_score: { type: "integer", minimum: 0, maximum: 100, description: "Warn at or above this score. Default 40." } }, required: ["mint"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "deployer_reputation",
    title: "Reputation of the wallet that launched a token",
    description: "Returns what Kaelis knows about a deployer wallet: the tokens it launched that Kaelis tested, how each ended after 7 days (held or rugged), a risk figure from 0 to 100, who first funded the wallet, and its cluster (other deployers funded by the same non-exchange source). Pass a wallet address, or a token mint to look up its deployer. Counts only tokens Kaelis has tested.",
    inputSchema: { type: "object", properties: { address: { type: "string", description: "The deployer's wallet address." }, mint: { type: "string", description: "A token mint; Kaelis looks up who launched it." } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "scan_token",
    title: "Full check results for a Solana token",
    description: "The full result behind check_before_buy: every check with its points and evidence, the grade, wallet-funding findings for the top holders, and a plain-language summary. Use it when you need the detail, not just a decision.",
    inputSchema: { type: "object", properties: { mint: MINT }, required: ["mint"], additionalProperties: false },
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

const text = (o) => ({ content: [{ type: "text", text: JSON.stringify(o) }], structuredContent: o });
const oops = (m) => ({ isError: true, content: [{ type: "text", text: m }] });
function deployerBrief(address) {
  const p = deployers.profile(address, ledger.all());
  return { address, level: p.level, risk: p.risk, tested: p.tested, rugged: p.rugged, held: p.held, open: p.open,
    funder: p.funder ? { address: p.funder.address, hub: p.funder.hub } : null, cluster: p.cluster ? { wallets: p.cluster.wallets, rugged: p.cluster.rugged, tested: p.cluster.tested } : null,
    link: "https://kaelis.si/deployer.html?address=" + address };
}
// block: a hard flag or a score above max. warn: a middling score, a check that could not run, or a deployer with confirmed rugs.
function decide(out, dep, max, warn) {
  if (out.hardFlag || out.score > max) return "block";
  if (out.score >= warn || out.unavailableChecks > 0 || (out.checks || []).some((c) => c.warn) || (dep && (dep.level === "serial" || dep.level === "flagged"))) return "warn";
  return "allow";
}
async function callTool(name, args) {
  args = args || {};
  if (name === "deployer_reputation") {
    let address = String(args.address || "").trim();
    const mint = String(args.mint || "").trim();
    if (!address && !mint) return oops("Pass a wallet address or a token mint.");
    if (mint) {
      if (!K.isAddress(mint)) return oops("That doesn't look like a Solana mint address.");
      let t = deployers.ofMint(mint);
      if (!t && ledger.has(mint)) { try { t = await deployers.learn(mint); } catch (e) { t = null; } }
      if (!t || !t.deployer) return text({ mint, known: false, note: ledger.has(mint) ? "The deployer of this token could not be identified yet." : "Kaelis has not tested this token. Call check_before_buy first." });
      address = t.deployer;
    }
    if (!K.isAddress(address)) return oops("That doesn't look like a Solana wallet address.");
    const p = deployers.profile(address, ledger.all(), filings.view(100000).filings);
    return text(p);
  }
  const mint = String(args.mint || "").trim();
  if (!K.isAddress(mint)) return oops("That doesn't look like a Solana mint address (base58, 32 to 44 characters).");
  let out;
  try { out = brief(await scan(mint)); }
  catch (e) { return oops("Scan failed: " + (e && e.message || "unknown error")); }
  if (name === "check_before_buy") {
    const max = Number.isInteger(args.max_score) ? args.max_score : 69, warn = Number.isInteger(args.warn_score) ? args.warn_score : 40;
    const t = deployers.ofMint(mint), dep = t ? deployerBrief(t.deployer) : null;
    if (!t && ledger.has(mint)) deployers.learn(mint).catch(() => {}); // trace it for the next caller; never make an agent wait for it
    const decision = decide(out, dep, max, warn);
    const reasons = out.checks.filter((c) => c.hard || c.warn || (c.points && c.points >= c.max / 2)).map((c) => `${c.name}: ${c.evidence}`); // a hard flag is always a reason, even at 0 points (impersonation)
    if (dep && dep.rugged) reasons.push(`Deployer: ${dep.rugged} of ${dep.tested} tested tokens from this wallet rugged.`);
    if (out.unavailableChecks) reasons.push(`${out.unavailableChecks} check(s) could not run; treat the score as incomplete.`);
    if (out.issuer) reasons.push(`Official ${out.issuer.asset}: the issuer keeps legal controls${out.issuer.controls.length ? " (" + out.issuer.controls.map((c) => c.name.toLowerCase()).join(", ") + ")" : ""}. Not scored; you are trusting the issuer.`);
    const c = ledger.all().filter((x) => x.mint === mint).pop();
    const res = { decision, allow: decision !== "block", score: out.score, grade: out.grade, band: out.band, maxScore: max, warnScore: warn, hardFlag: out.hardFlag, reasons, issuer: out.issuer || null,
      deployer: dep, proof: c ? { ledgerCall: c.n, hash: c.hash, openedAt: c.openedAt, anchoredTx: c.anchored || null, ledger: "https://kaelis.si/ledger.html" } : null,
      summary: out.summary, rulesVersion: out.rulesVersion, slot: out.slot, links: out.links, disclaimer: out.disclaimer };
    return text(res);
  }
  return text(out);
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
module.exports.decide = decide; // for tests
