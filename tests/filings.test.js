// Kaelis Filings tests. Run: node tests/filings.test.js
const assert = require("assert");
const { makeFilings } = require("../lib/filings.js");

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
const MINT = "Mint111111111111111111111111111111111pump";
const memDb = () => { let d = { head: "0".repeat(64), filings: [], tracked: {} }; return { load: () => d, save: () => {} }; };
const scanOut = (liq = 50000) => ({ data: { mint: MINT, supply: 1_000_000, mintInfo: { mintAuthority: null, freezeAuthority: null },
  pairs: [{ chainId: "solana", baseToken: { address: MINT, symbol: "DEMO" }, liquidity: { usd: liq } }],
  holders: [{ address: "pool", owner: "AMM", amount: 400000, pool: true }, { address: "accA", owner: "OwnerA111", amount: 100000, pool: false }, { address: "accB", owner: "OwnerB111", amount: 50000, pool: false }] } });

function world() {
  const bal = { accA: 100000, accB: 50000 }, mint = { mintAuthority: null, freezeAuthority: null }, liq = { v: 50000 };
  const rpc = async (method, [keys]) => ({ value: keys.map((k) => k === MINT ? { data: { parsed: { info: mint } } } : bal[k] == null ? null : { data: { parsed: { info: { tokenAmount: { uiAmountString: String(bal[k]) } } } } }) });
  const fetchFn = async () => ({ ok: true, json: async () => ({ pairs: [{ chainId: "solana", baseToken: { address: MINT }, liquidity: { usd: liq.v } }] }) });
  return { bal, mint, liq, rpc, fetchFn };
}

(async () => {
  await t("tracks the non-pool holders as insiders, once per token", () => {
    const w = world(), F = makeFilings({ rpc: w.rpc, fetchFn: w.fetchFn, db: memDb() });
    assert.strictEqual(F.track(scanOut()), true); assert.strictEqual(F.track(scanOut()), false);
    assert.strictEqual(F.view().tracked, 1);
  });
  await t("nothing changed, nothing filed", async () => {
    const w = world(), F = makeFilings({ rpc: w.rpc, fetchFn: w.fetchFn, db: memDb() }); F.track(scanOut());
    assert.strictEqual((await F.check()).length, 0);
  });
  await t("an insider dumping files a K-4; a small trim does not", async () => {
    const w = world(), F = makeFilings({ rpc: w.rpc, fetchFn: w.fetchFn, db: memDb() }); F.track(scanOut());
    w.bal.accB = 47000; // -6% of the bag: below the bar
    assert.strictEqual((await F.check()).length, 0);
    w.bal.accA = 0; // sold everything: 10% of supply
    const f = await F.check();
    assert.strictEqual(f.length, 1); assert.strictEqual(f[0].form, "K-4"); assert(/10% of supply/.test(f[0].detail) && /closed the position/.test(f[0].detail));
    assert.strictEqual((await F.check()).length, 0, "the same sale is never filed twice");
  });
  await t("liquidity pulled files one K-8; authority back on files a K-3", async () => {
    const w = world(), F = makeFilings({ rpc: w.rpc, fetchFn: w.fetchFn, db: memDb() }); F.track(scanOut());
    w.liq.v = 9000; w.mint.mintAuthority = "Auth1111111111111111111111111111";
    const forms = (await F.check()).map((f) => f.form).sort();
    assert.deepStrictEqual(forms, ["K-3", "K-8"]);
    assert.strictEqual((await F.check()).length, 0);
  });
  await t("filings are hash-chained and tamper-evident", async () => {
    const w = world(), db = memDb(), F = makeFilings({ rpc: w.rpc, fetchFn: w.fetchFn, db }); F.track(scanOut());
    w.bal.accA = 0; w.liq.v = 100; await F.check();
    assert.deepStrictEqual(F.verify(), { ok: true, length: 2 });
    db.load().filings[0].detail = "edited"; assert.strictEqual(F.verify().ok, false);
  });
  await t("tracking ends after 7 days", async () => {
    let tm = Date.parse("2026-11-01T00:00:00Z"); const w = world(), F = makeFilings({ rpc: w.rpc, fetchFn: w.fetchFn, db: memDb(), now: () => tm }); F.track(scanOut());
    tm += 8 * 864e5; await F.check(); assert.strictEqual(F.view().tracked, 0);
  });
  console.log(`\n${pass} filings tests passed`);
})();
