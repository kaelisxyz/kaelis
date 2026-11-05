// One scan, shared by /api/scan and the MCP tools. Cached 60s per mint.
const { K, rpcUrls, cached } = require("./server.js");
const { explain } = require("./explain.js");

function scan(mint, { withExplain = true } = {}) {
  return cached("scan:" + mint, 60000, async () => {
    const opts = { rpcUrls: rpcUrls() };
    const data = await K.gather(mint, opts);
    const result = K.evaluate(data);
    const links = await K.linkWallets(data, opts).catch(() => null);
    let text = null;
    if (withExplain) { try { text = await explain(data, result, links); } catch (e) { text = null; } }
    return { data, result, links, explain: text, source: "server" };
  });
}

// Compact answer for agents: no raw data, just what a bot needs to decide.
function brief(out) {
  const r = out.result, d = out.data, L = out.links;
  const p = (d.pairs || []).slice().sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
  const t = p ? (p.baseToken.address === d.mint ? p.baseToken : p.quoteToken) : null;
  return {
    mint: d.mint,
    token: t ? { name: t.name, symbol: t.symbol } : null,
    score: r.score,
    band: r.band,
    hardFlag: r.hard,
    checks: r.checks.map((c) => ({ id: c.id, name: c.name, points: c.sev == null ? null : Math.round(c.weight * c.sev), max: c.weight, evidence: c.detail })),
    unavailableChecks: r.unavailable,
    rugcheckFlags: r.rugcheckRisks,
    walletLinks: L ? { level: L.level, findings: L.lines } : null,
    summary: out.explain || K.summary(d, r),
    rulesVersion: r.rulesVersion,
    slot: d.slot,
    scannedAt: d.fetchedAt,
    links: { solscan: "https://solscan.io/token/" + d.mint, dexscreener: "https://dexscreener.com/solana/" + d.mint, rugcheck: "https://rugcheck.xyz/tokens/" + d.mint },
    disclaimer: "A low score means no known red flag was found. It is not a promise of safety and not financial advice.",
  };
}

module.exports = { scan, brief };
