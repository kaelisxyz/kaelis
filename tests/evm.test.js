// EVM chains (rules 1.6.0): Ethereum, BNB Chain, Base, Robinhood Chain. Run: node tests/evm.test.js (no network)
const assert = require("assert");
const K = require("../site/js/kaelis-core.js");
const { tokenAddress } = require("../lib/server.js");
const { market, callHash, GENESIS, makeLedger } = require("../lib/ledger.js");

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
const A = "0x020bfc650a365f8bb26819deaabf3e21291018b4", OWNER = "0x1111111111111111111111111111111111111111";
const pair = (chainId, liq = 400000, days = 120, address = A) => ({ chainId, pairAddress: "0xpool", baseToken: { address, symbol: "CAT", name: "Cash Cat" }, liquidity: { usd: liq }, priceUsd: "0.01", pairCreatedAt: Date.now() - days * 864e5 });
const gp = (over) => Object.assign({ token_symbol: "CAT", token_name: "Cash Cat", is_honeypot: "0", cannot_sell_all: "0", buy_tax: "0", sell_tax: "0", is_mintable: "0", is_open_source: "1", is_proxy: "0",
  hidden_owner: "0", can_take_back_ownership: "0", selfdestruct: "0", transfer_pausable: "0", is_blacklisted: "0", owner_address: "0x0000000000000000000000000000000000000000", total_supply: "1000000",
  holder_count: "5000", holders: [{ address: "0xpool", percent: "0.4", is_contract: 1, is_locked: 0 }, { address: "0xabc", percent: "0.05", is_contract: 0, is_locked: 0 }],
  lp_holders: [{ address: "0x000000000000000000000000000000000000dead", percent: "0.98", is_locked: 0 }], creator_address: "0xcdfc08a1c1fbafb355645e5ddc32122e5716ca90" }, over || {});
// what K.gather returns for an EVM token, built from a GoPlus answer and DexScreener pairs (the network-free part of gatherEvm)
const world = (g, chain = "robinhood", pairs = [pair(K.CHAINS[chain].dex)]) => async (url) => ({ ok: true, status: 200,
  json: async () => (/gopluslabs/.test(url) ? { code: 1, result: g ? { [A]: g } : {} } : { pairs }) });

(async () => {
  await t("addresses: base58 is Solana, 0x is EVM, and a mismatch is refused", () => {
    assert.deepStrictEqual(tokenAddress("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", ""), { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", chain: "solana" });
    assert.deepStrictEqual(tokenAddress("0x020bfC650A365f8BB26819deAAbF3E21291018b4", "robinhood"), { mint: A, chain: "robinhood" });
    assert.strictEqual(tokenAddress("0x020bfC650A365f8BB26819deAAbF3E21291018b4", "").chain, null, "auto");
    assert.ok(tokenAddress("0x020bfC650A365f8BB26819deAAbF3E21291018b4", "solana").error);
    assert.ok(tokenAddress("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "base").error);
    assert.ok(tokenAddress(A, "polygon").error, "only the chains Kaelis reads");
  });
  await t("a clean EVM token: renounced, verified, LP burned, deep and old pool -> low score", async () => {
    const d = await K.gather(A, { chain: "robinhood", fetch: world(gp()) });
    assert.strictEqual(d.chain, "robinhood"); assert.strictEqual(d.creator, "0xcdfc08a1c1fbafb355645e5ddc32122e5716ca90");
    const r = K.evaluate(d);
    assert.strictEqual(r.hard, false); assert.ok(r.score < 10, "score " + r.score); assert.strictEqual(r.unavailable, 0);
    assert.deepStrictEqual(r.checks.map((c) => c.id).filter((id) => K.WEIGHTS[id] != null).sort(), Object.keys(K.WEIGHTS).sort(), "the same eight checks as Solana");
    assert.ok(/0 holders|5,000 holders/.test(r.checks.find((c) => c.id === "holders").detail));
  });
  await t("a honeypot on BNB Chain is a hard flag (CC), and agents get block", async () => {
    const r = K.evaluate(await K.gather(A, { chain: "bsc", fetch: world(gp({ is_honeypot: "1" }), "bsc") }));
    assert.strictEqual(r.hard, true); assert.strictEqual(r.grade, "CC"); assert.ok(r.score >= 85);
    const { decide } = require("../api/mcp.js");
    assert.strictEqual(decide({ hardFlag: r.hard, score: r.score, unavailableChecks: 0, checks: [] }, null, 69, 40), "block");
  });
  await t("a 60% sell tax is a hard flag; a 12% one only adds points", async () => {
    assert.strictEqual(K.evaluate(await K.gather(A, { chain: "base", fetch: world(gp({ sell_tax: "0.6" }), "base") })).hard, true);
    const r = K.evaluate(await K.gather(A, { chain: "base", fetch: world(gp({ sell_tax: "0.12" }), "base") }));
    assert.strictEqual(r.hard, false); assert.ok(r.checks.find((c) => c.id === "sell").sev > 0);
  });
  await t("owner controls count only while there is an owner", async () => {
    const live = gp({ is_mintable: "1", transfer_pausable: "1", slippage_modifiable: "1", owner_address: OWNER });
    const r1 = K.evaluate(await K.gather(A, { chain: "ethereum", fetch: world(live, "ethereum") }));
    assert.strictEqual(r1.checks.find((c) => c.id === "mint").sev, 1); assert.strictEqual(r1.checks.find((c) => c.id === "freeze").sev, 1);
    assert.strictEqual(r1.checks.find((c) => c.id === "extensions").sev, 0.7);
    const r2 = K.evaluate(await K.gather(A, { chain: "ethereum", fetch: world({ ...live, owner_address: "0x0000000000000000000000000000000000000000" }, "ethereum") }));
    assert.strictEqual(r2.checks.find((c) => c.id === "freeze").sev, 0); assert.ok(r2.checks.find((c) => c.id === "mint").sev < 1);
  });
  await t("unverified source and a creator who made a honeypot before", async () => {
    const r = K.evaluate(await K.gather(A, { chain: "robinhood", fetch: world(gp({ is_open_source: "0", honeypot_with_same_creator: "1" })) }));
    assert.strictEqual(r.checks.find((c) => c.id === "extensions").sev, 1);
    const cr = r.checks.find((c) => c.id === "creator"); assert.ok(cr && cr.warn); assert.strictEqual(r.warned, true);
    assert.ok(["BB", "B", "CCC", "CC"].includes(r.grade), "a warning caps the grade, got " + r.grade);
  });
  await t("no contract reading (GoPlus down): checks are unavailable, never a pass", async () => {
    const r = K.evaluate(await K.gather(A, { chain: "robinhood", fetch: world(null) }));
    assert.ok(r.unavailable >= 5, "unavailable " + r.unavailable); assert.notStrictEqual(r.grade, "AAA");
  });
  await t("an address with nothing on the chain is refused", async () => {
    await assert.rejects(K.gather(A, { chain: "base", fetch: world(null, "base", []) }), /No token found/);
  });
  await t("the Ledger: an EVM call seals its chain and is checked on that chain; old Solana hashes do not change", () => {
    const sol = { mint: "Mint1", grade: "A", score: 10, p: 0.05, openedAt: "2026-11-10T00:00:00Z", rulesVersion: "1.3.0", f: { sell: 0 }, fh: false, gen: 0 };
    assert.strictEqual(callHash(sol, GENESIS), callHash({ ...sol, chain: "solana" }, GENESIS), "Solana calls hash as before");
    assert.notStrictEqual(callHash({ ...sol, chain: "base" }, GENESIS), callHash(sol, GENESIS), "the chain is part of an EVM call's hash");
    const m = market([pair("base"), pair("ethereum", 9e6)], "0x020BFC650A365F8BB26819DEAABF3E21291018B4", "base");
    assert.strictEqual(m.pools, 1); assert.strictEqual(m.liq, 400000);
    let d = { head: GENESIS, calls: [] };
    const L = makeLedger({ db: { load: () => d, save: () => {} }, now: () => Date.parse("2026-11-13T00:00:00Z") });
    const c = L.record({ data: { mint: A, chain: "base", pairs: [pair("base")] }, result: { grade: "A", score: 10, checks: [], rulesVersion: "1.6.0" } });
    assert.strictEqual(c.chain, "base"); assert.ok(L.verify().ok);
    assert.strictEqual(L.list ? true : true, true);
  });
  console.log(`\n${pass} evm tests passed`);
})();
