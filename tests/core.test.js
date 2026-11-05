// Offline tests for the rules engine, the AI grounding check and the API handler.
// Run: npm test   (no network needed: fetch is mocked)
const assert = require("assert");
const K = require("../site/js/kaelis-core.js");
const { grounded } = require("../lib/explain.js");

const MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const now = Date.now();
function world(kind) {
  const risky = kind !== "safe";
  return async (url, init) => {
    const ok = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (/jup\.ag/.test(url)) {
      const sell = new URL(url).searchParams.get("outputMint").startsWith("So111");
      if (kind === "honeypot" && sell) return ok({ errorCode: "COULD_NOT_FIND_ANY_ROUTE" }, 400);
      return ok({ outAmount: sell ? (risky ? "60000000" : "99000000") : "5000", priceImpactPct: "0.01" });
    }
    if (/dexscreener/.test(url)) return ok({ pairs: [{ chainId: "solana", pairAddress: "pair1", baseToken: { address: MINT, name: "T", symbol: "T" }, quoteToken: {}, liquidity: { usd: risky ? 3200 : 4.2e6 }, txns: { h24: { buys: 140, sells: risky ? 0 : 90 } }, pairCreatedAt: risky ? now - 5 * 3600e3 : now - 600 * 864e5 }] });
    if (/rugcheck/.test(url)) return ok(risky ? { lpLockedPct: 0, risks: [{ name: "x", level: "danger" }] } : { lpLockedPct: 100 });
    const { method, params } = JSON.parse(init.body);
    const R = (result) => ok({ result });
    if (method === "getAccountInfo") return R({ value: { owner: risky ? "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" : "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", data: { parsed: { type: "mint", info: { decimals: 6, mintAuthority: risky ? "AAAA1111" : null, freezeAuthority: null, extensions: risky ? [{ extension: "permanentDelegate", state: { delegate: "D" } }] : [] } } } } });
    if (method === "getTokenSupply") return R({ context: { slot: 1 }, value: { uiAmountString: "1000000000", decimals: 6 } });
    if (method === "getTokenLargestAccounts") return R({ value: Array.from({ length: 12 }, (_, i) => ({ address: "acc" + i, uiAmountString: String(i === 0 ? 3e8 : risky ? 4e7 : 5e6) })) });
    if (method === "getMultipleAccounts") return R({ value: params[0][0] === "acc0" ? params[0].map((_, i) => ({ data: { parsed: { info: { owner: i === 0 ? "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1" : "wallet" + i } } } })) : params[0].map(() => ({ owner: "11111111111111111111111111111111" })) });
    if (method === "getSignaturesForAddress") return R(Array.from({ length: risky ? 2 : 1000 }, (_, i) => ({ signature: "s_" + params[0] + "_" + i, blockTime: Math.floor(now / 1000) })));
    if (method === "getTransaction") { const w = params[0].split("_")[1]; return R({ transaction: { message: { instructions: [{ program: "system", parsed: { type: "transfer", info: { source: +w.slice(6) <= 6 ? "FUNDER" : "x" + w, destination: w } } }], accountKeys: [] } }, meta: {} }); }
    throw new Error("unmocked " + method);
  };
}

(async () => {
  let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

  await t("weights add up to 100", () => assert.strictEqual(Object.values(K.WEIGHTS).reduce((a, b) => a + b), 100));
  await t("rejects bad address", () => assert.rejects(K.gather("hello", { fetch: world("safe") })));

  await t("safe token scores 0", async () => {
    const d = await K.gather(MINT, { fetch: world("safe") });
    const r = K.evaluate(d);
    assert.strictEqual(r.score, 0); assert.strictEqual(r.band, "low"); assert.strictEqual(r.unavailable, 0);
  });
  await t("risky token: extensions, sell loss, linked wallets", async () => {
    const d = await K.gather(MINT, { fetch: world("risky") });
    const r = K.evaluate(d);
    assert.ok(r.hard); assert.ok(r.score >= 85, "score " + r.score);
    assert.strictEqual(r.checks.find((c) => c.id === "extensions").sev, 1);
    const L = await K.linkWallets(d, { fetch: world("risky") });
    assert.strictEqual(L.level, "danger"); assert.strictEqual(L.clusters[0].funder, "FUNDER"); assert.strictEqual(L.clusters[0].wallets.length, 6);
  });
  await t("honeypot: buy route but no sell route forces 85+", async () => {
    const d = await K.gather(MINT, { fetch: world("honeypot") });
    const r = K.evaluate(d);
    assert.strictEqual(r.checks[0].detail.includes("selling back fails"), true); assert.ok(r.score >= 85);
  });
  await t("watch mode flags pulled liquidity and re-enabled mint", () => {
    const a = K.compare({ liq: 50000, mintAuthority: null, freezeAuthority: null }, { liq: 4000, mintAuthority: "X", freezeAuthority: null });
    assert.strictEqual(a.length, 2);
  });
  await t("AI grounding rejects invented numbers", () => {
    const src = JSON.stringify({ score: 72, evidence: "$3.2k in 1 pool. 40% of supply" });
    assert.ok(grounded("Score 72. Only $3.2k of liquidity and 40% held by top wallets.", src));
    assert.ok(!grounded("Score 72 and it could drop 95% tomorrow.", src));
  });
  await t("API /api/scan returns server scan without keys", async () => {
    global.fetch = world("risky"); delete process.env.ANTHROPIC_API_KEY;
    const handler = require("../api/scan.js");
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } };
    await handler({ method: "GET", url: "/api/scan?mint=" + MINT, headers: {} }, res);
    assert.strictEqual(res.statusCode, 200); assert.strictEqual(res.body.source, "server");
    assert.ok(res.body.result.score >= 85); assert.strictEqual(res.body.explain, null); assert.ok(res.body.links);
    const bad = { headers: {}, setHeader() {}, end(b) { this.body = JSON.parse(b); } };
    await handler({ method: "GET", url: "/api/scan?mint=nope", headers: {} }, bad);
    assert.strictEqual(bad.statusCode, 400);
  });
  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });

// server.js: static files + API routes on one port (what Railway runs)
(async () => {
  await new Promise((r) => setTimeout(r, 300));
  const server = require("../server.js");
  await new Promise((r) => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;
  const get = (u) => new Promise((res, rej) => require("http").get(base + u, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res({ status: r.statusCode, type: r.headers["content-type"], body: b })); }).on("error", rej));
  const home = await get("/"); assert.strictEqual(home.status, 200); assert.ok(home.type.startsWith("text/html"));
  assert.strictEqual((await get("/scan")).status, 200);
  assert.strictEqual((await get("/api/health")).status, 200);
  assert.strictEqual((await get("/api/scan?mint=nope")).status, 400);
  assert.strictEqual((await get("/../package.json")).status, 404);
  server.close();
  console.log("ok - server.js serves the site and the API");
})().catch((e) => { console.error(e); process.exit(1); });
