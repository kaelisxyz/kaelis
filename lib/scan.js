// One scan, shared by /api/scan, the MCP tools and Patrol. Cached 60s per mint.
// Scores use the current Genome generation (gen 0 = the hand-written rules).
const { K, rpcUrls, cached } = require("./server.js");
const { explain } = require("./explain.js");

// chain: "solana" or an EVM chain (ethereum, bsc, base, robinhood); a 0x address with no chain is looked up
function scan(mint, { withExplain = true, withLinks = true, genome = null, chain = null } = {}) {
  const g = genome || require("./ledger-instance.js").genome.current();
  return cached("scan:" + (chain || "") + ":" + mint + ":" + g.gen + (withLinks ? "" : ":lite"), 60000, async () => {
    const opts = { rpcUrls: rpcUrls(), chain };
    const data = await K.gather(mint, opts);
    const result = K.evaluate(data, g);
    const evm = data.chain && data.chain !== "solana";
    const links = withLinks && !evm ? await K.linkWallets(data, opts).catch(() => null) : null; // wallet funding links: Solana only for now
    let text = null;
    if (withExplain) { try { text = await explain(data, result, links); } catch (e) { text = null; } }
    return { data, result, links, explain: text, source: "server" };
  });
}

// Compact answer for agents: no raw data, just what a bot needs to decide.
function brief(out) {
  const r = out.result, d = out.data, L = out.links;
  const p = (d.pairs || []).slice().sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
  const own = (a) => a === d.mint || (/^0x/i.test(d.mint) && String(a).toLowerCase() === d.mint.toLowerCase());
  const t = p ? (own(p.baseToken.address) ? p.baseToken : p.quoteToken) : null;
  const chain = d.chain || "solana", C = K.CHAINS[chain] || {};
  return {
    mint: d.mint,
    chain, chainName: C.name || chain,
    token: t ? { name: t.name, symbol: t.symbol } : null,
    score: r.score,
    band: r.band,
    grade: r.grade,
    generation: r.gen,
    hardFlag: r.hard,
    checks: r.checks.map((c) => ({ id: c.id, name: c.name, points: c.sev == null ? null : Math.round(c.weight * c.sev), max: c.weight, evidence: c.detail, ...(c.scope ? { scope: c.scope } : {}), ...(c.hard ? { hard: true } : {}), ...(c.warn ? { warn: true } : {}) })),
    unavailableChecks: r.unavailable,
    issuer: r.issuer || null, // official tokenized stock: the issuer's controls, reported apart from the score
    rugcheckFlags: r.rugcheckRisks,
    walletLinks: L ? { level: L.level, findings: L.lines } : null,
    summary: out.explain || K.summary(d, r),
    rulesVersion: r.rulesVersion,
    slot: d.slot,
    scannedAt: d.fetchedAt,
    links: chain === "solana" ? { solscan: "https://solscan.io/token/" + d.mint, dexscreener: "https://dexscreener.com/solana/" + d.mint, rugcheck: "https://rugcheck.xyz/tokens/" + d.mint }
      : { ...(C.explorer ? { explorer: C.explorer + d.mint } : {}), dexscreener: "https://dexscreener.com/" + C.dex + "/" + d.mint, goplus: "https://gopluslabs.io/token-security/" + C.goplus + "/" + d.mint },
    disclaimer: "A low score means no known red flag was found. It is not a promise of safety and not financial advice.",
  };
}

module.exports = { scan, brief };
