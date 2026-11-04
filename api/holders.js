// GET /api/holders?mint=<address>   (mint defaults to KAEL_MINT)
// Holder list for the holder tower. With a Helius key it reads every token account
// (DAS getTokenAccounts) and groups them by owner; without one it falls back to the
// 20 largest accounts from public RPC.
const { K, rpcUrls, cached, send, query } = require("../lib/server.js");

async function post(url, method, params) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "k", method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

async function allHolders(mint) {
  const helius = process.env.HELIUS_RPC_URL;
  const supplyRes = await post(rpcUrls()[0], "getTokenSupply", [mint]);
  const decimals = supplyRes.value.decimals, supply = +supplyRes.value.uiAmountString;
  if (helius) {
    const owners = new Map();
    for (let page = 1; page <= 20; page++) {
      const r = await post(helius, "getTokenAccounts", { mint, page, limit: 1000 });
      const list = (r && r.token_accounts) || [];
      list.forEach((a) => owners.set(a.owner, (owners.get(a.owner) || 0) + Number(a.amount) / 10 ** decimals));
      if (list.length < 1000) break;
    }
    const holders = [...owners].filter(([, v]) => v > 0).map(([owner, amount]) => ({ owner, amount, share: supply ? amount / supply : 0 })).sort((a, b) => b.amount - a.amount);
    return { mint, supply, count: holders.length, complete: true, holders: holders.slice(0, 1000), source: "helius" };
  }
  const largest = await post(rpcUrls()[0], "getTokenLargestAccounts", [mint]);
  const holders = largest.value.map((a) => ({ account: a.address, amount: +a.uiAmountString, share: supply ? +a.uiAmountString / supply : 0 }));
  return { mint, supply, count: null, complete: false, holders, source: "public-rpc" };
}

module.exports = async (req, res) => {
  const mint = (query(req).get("mint") || process.env.KAEL_MINT || "").trim();
  if (!mint) return send(res, 404, { error: "No mint configured yet. Set KAEL_MINT after launch." });
  if (!K.isAddress(mint)) return send(res, 400, { error: "Invalid mint address." });
  try { send(res, 200, await cached("holders:" + mint, 120000, () => allHolders(mint)), 120); }
  catch (e) { send(res, 502, { error: e.message || "Holder lookup failed." }); }
};
