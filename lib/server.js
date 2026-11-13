// Shared helpers for the Kaelis API (server.js on Railway, Node 18+).
const K = require("../site/js/kaelis-core.js");

const PUBLIC_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
function rpcUrls() {
  const own = (process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || "").trim();
  return own ? [own].concat(PUBLIC_RPCS) : PUBLIC_RPCS;
}

// Small in-memory cache and rate limit. Each serverless instance has its own copy,
// which is enough to absorb bursts on one token; it is not a global quota.
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = Promise.resolve().then(fn);
  cache.set(key, { until: Date.now() + ttlMs, value });
  value.catch(() => cache.delete(key));
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}
const hits = new Map();
function limited(req, perMinute) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket && req.socket.remoteAddress || "?").split(",")[0].trim();
  const now = Date.now(), w = (hits.get(ip) || []).filter((t) => now - t < 60000);
  w.push(now); hits.set(ip, w);
  if (hits.size > 5000) hits.clear();
  return w.length > perMinute;
}
function send(res, status, body, maxAge) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", maxAge ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}` : "no-store");
  res.end(JSON.stringify(body));
}
function query(req) { return new URL(req.url, "http://x").searchParams; }

// a token address on a chain Kaelis reads: base58 on Solana, 0x on the EVM chains. chain may be empty (auto).
function tokenAddress(mint, chain) {
  mint = String(mint || "").trim(); chain = String(chain || "").trim().toLowerCase() || null;
  if (chain && !K.CHAINS[chain]) return { error: "Unknown chain. Use solana, ethereum, bsc, base or robinhood." };
  if (K.isAddress(mint) && (!chain || chain === "solana")) return { mint, chain: "solana" };
  if (K.isEvmAddress(mint) && chain !== "solana") return { mint: mint.toLowerCase(), chain };
  if (K.isEvmAddress(mint)) return { error: "That is a 0x address, and Solana addresses are base58. Pick Ethereum, BNB Chain, Base or Robinhood Chain, or leave the chain empty." };
  if (K.isAddress(mint)) return { error: `That is a Solana address, not a ${K.CHAINS[chain].name} one.` };
  return { error: "That doesn't look like a token address (Solana: base58, 32 to 44 characters; Ethereum, BNB Chain, Base, Robinhood Chain: 0x and 40 hex characters)." };
}
module.exports = { K, rpcUrls, cached, limited, send, query , tokenAddress };
