// Kaelis Deployers tests. Run: node tests/deployers.test.js
const assert = require("assert");
const { makeDeployers } = require("../lib/deployers.js");

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
const A = (n) => ("Wa11et" + n).padEnd(40, "1"); // valid base58, 40 chars
const M = (n) => ("Mint" + n).padEnd(40, "1");
const memDb = () => { const d = { tokens: {}, wallets: {} }; return { load: () => d, save: () => {} }; };
const call = (n, mint, over = {}) => Object.assign({ n, mint, symbol: "T" + n, grade: "BB", score: 40, p: 0.3, openedAt: "2026-11-0" + n + "T00:00:00.000Z", hash: "h" + n }, over);

// a small world: creators by mint, first transactions by wallet, signature counts by address
function world({ creators = {}, funders = {}, counts = {}, rugcheckDown = false, mintSigs = {} } = {}) {
  const calls = [];
  const json = async (url) => { calls.push(url); if (rugcheckDown) throw new Error("down"); const m = url.split("/tokens/")[1].split("/")[0]; return { creator: creators[m] || null, launchpad: { name: "pump.fun" } }; };
  const rpc = async (method, [addr]) => {
    calls.push(method + ":" + addr);
    if (method === "getSignaturesForAddress") {
      if (mintSigs[addr]) return mintSigs[addr];
      const n = counts[addr] == null ? 3 : counts[addr];
      return Array.from({ length: Math.min(n, 1000) }, (_, i) => ({ signature: "sig-" + addr + "-" + i, blockTime: 1760000000 + i }));
    }
    if (method === "getTransaction") { // addr is the signature here
      const w = Object.keys(funders).find((k) => addr.startsWith("sig-" + k + "-"));
      if (w) return { transaction: { message: { accountKeys: [{ pubkey: funders[w], signer: true }], instructions: [{ program: "system", parsed: { type: "transfer", info: { source: funders[w], destination: w } } }] } }, meta: {} };
      return { transaction: { message: { accountKeys: [{ pubkey: A("payer"), signer: true }], instructions: [] } }, meta: {} };
    }
    throw new Error("unexpected " + method);
  };
  return { json, rpc, calls };
}

(async () => {
  await t("learns the creator from the report and traces who funded it", async () => {
    const w = world({ creators: { [M(1)]: A("dev") }, funders: { [A("dev")]: A("bank") } });
    const D = makeDeployers({ db: memDb(), rpc: w.rpc, json: w.json });
    const rec = await D.learn(M(1));
    assert.strictEqual(rec.deployer, A("dev")); assert.strictEqual(rec.via, "rugcheck"); assert.strictEqual(rec.platform, "pump.fun");
    const p = D.profile(A("dev"), [call(1, M(1))]);
    assert.strictEqual(p.funder.address, A("bank")); assert.strictEqual(p.funder.hub, false); assert.strictEqual(p.tested, 1);
  });

  await t("falls back to the first transaction on the mint when the report is down", async () => {
    const w = world({ rugcheckDown: true, mintSigs: { [M(2)]: [{ signature: "s2", blockTime: 2 }, { signature: "s1", blockTime: 1 }] } });
    const D = makeDeployers({ db: memDb(), rpc: w.rpc, json: w.json });
    const rec = await D.learn(M(2));
    assert.strictEqual(rec.deployer, A("payer")); assert.strictEqual(rec.via, "first-tx"); assert.strictEqual(rec.tx, "s1");
  });

  await t("a token too busy to reach its first transaction stays unknown and is retried only three times", async () => {
    const busy = Array.from({ length: 1000 }, (_, i) => ({ signature: "b" + i, blockTime: i }));
    const w = world({ rugcheckDown: true, mintSigs: { [M(3)]: busy } });
    const D = makeDeployers({ db: memDb(), rpc: w.rpc, json: w.json });
    for (let i = 0; i < 5; i++) await D.learn(M(3));
    assert.strictEqual(D.ofMint(M(3)), null);
    assert.deepStrictEqual(D.pending([call(1, M(3))]), [], "given up after three tries");
    assert.strictEqual(w.calls.filter((c) => c.includes("/report")).length, 3);
  });

  await t("does not learn the same token twice", async () => {
    const w = world({ creators: { [M(1)]: A("dev") } });
    const D = makeDeployers({ db: memDb(), rpc: w.rpc, json: w.json });
    await D.learn(M(1)); const n = w.calls.length; await D.learn(M(1));
    assert.strictEqual(w.calls.length, n);
  });

  await t("two deployers with the same funder form a cluster", async () => {
    const w = world({ creators: { [M(1)]: A("dev1"), [M(2)]: A("dev2"), [M(3)]: A("solo") }, funders: { [A("dev1")]: A("boss"), [A("dev2")]: A("boss"), [A("solo")]: A("other") } });
    const D = makeDeployers({ db: memDb(), rpc: w.rpc, json: w.json });
    for (const m of [M(1), M(2), M(3)]) await D.learn(m);
    const calls = [call(1, M(1), { resolvedAt: "x", rugged: 1 }), call(2, M(2)), call(3, M(3))];
    const p = D.profile(A("dev2"), calls);
    assert.strictEqual(p.cluster.wallets, 2); assert.strictEqual(p.cluster.others[0].address, A("dev1")); assert.strictEqual(p.cluster.rugged, 1);
    const b = D.board(calls);
    assert.strictEqual(b.clusters.length, 1); assert.strictEqual(b.clusters[0].funder, A("boss")); assert.strictEqual(b.totals.deployers, 3);
    assert.strictEqual(D.profile(A("solo"), calls).cluster, null);
  });

  await t("an exchange-like funder (1000+ transactions) is a hub, never a cluster", async () => {
    const w = world({ creators: { [M(1)]: A("dev1"), [M(2)]: A("dev2") }, funders: { [A("dev1")]: A("cex"), [A("dev2")]: A("cex") }, counts: { [A("cex")]: 1000 } });
    const D = makeDeployers({ db: memDb(), rpc: w.rpc, json: w.json });
    await D.learn(M(1)); await D.learn(M(2));
    const calls = [call(1, M(1)), call(2, M(2))], p = D.profile(A("dev1"), calls);
    assert.strictEqual(p.funder.hub, true); assert.strictEqual(p.cluster, null); assert.strictEqual(D.board(calls).clusters.length, 0);
  });

  await t("rating: rugs, held tokens and open calls; one token is not a verdict", async () => {
    const D = makeDeployers({ db: memDb(), rpc: async () => [], json: async () => ({}) });
    const row = (state, p = 0.3) => ({ state, p });
    assert.strictEqual(D.rate([]).level, "unknown");
    assert.strictEqual(D.rate([row("open", 0.2)]).level, "new");
    assert.strictEqual(D.rate([row("open", 0.9)]).level, "watch");
    assert.strictEqual(D.rate([row("held"), row("held")]).level, "clean");
    assert.strictEqual(D.rate([row("rugged"), row("held"), row("held")]).level, "flagged");
    assert.strictEqual(D.rate([row("rugged"), row("rugged"), row("rugged")]).level, "serial");
    assert.strictEqual(D.rate([row("rugged"), row("rugged"), row("held")]).level, "serial");
    assert.strictEqual(D.rate([row("held")]).risk, 15, "(0.3 prior + 0) / (1 + 1)");
    assert.strictEqual(D.rate([row("rugged")]).risk, 65);
    assert.ok(D.rate([row("rugged"), row("rugged"), row("rugged")]).risk > D.rate([row("rugged")]).risk);
  });

  await t("the profile counts each mint once (latest call) and only filings on its own tokens", async () => {
    const w = world({ creators: { [M(1)]: A("dev") } });
    const D = makeDeployers({ db: memDb(), rpc: w.rpc, json: w.json });
    await D.learn(M(1));
    const calls = [call(1, M(1), { resolvedAt: "x", rugged: 0 }), call(2, M(1))];
    const p = D.profile(A("dev"), calls, [{ mint: M(1) }, { mint: M(9) }]);
    assert.strictEqual(p.tested, 1); assert.strictEqual(p.tokens[0].call, 2); assert.strictEqual(p.filings, 1);
    assert.ok(/only tokens Kaelis has tested/.test(p.note));
  });

  await t("pending lists untested mints newest first and skips stocks", async () => {
    const D = makeDeployers({ db: memDb(), rpc: async () => [], json: async () => ({}) });
    const calls = [call(1, M(1)), call(2, M(2), { asset: "stock" }), call(3, M(3)), call(4, M(1))];
    assert.deepStrictEqual(D.pending(calls, 5), [M(1), M(3)]);
  });

  await t("a failed funder trace is retried on a later round, three times at most", async () => {
    let fail = 2;
    const w = world({ creators: { [M(1)]: A("dev") }, funders: { [A("dev")]: A("bank") } });
    const rpc = async (m, p) => { if (m === "getSignaturesForAddress" && p[0] === A("dev") && fail-- > 0) throw new Error("429"); return w.rpc(m, p); };
    const D = makeDeployers({ db: memDb(), rpc, json: w.json });
    const calls = [call(1, M(1))];
    await D.learn(M(1));
    assert.strictEqual(D.profile(A("dev"), calls).funder, null, "creator known, funder not yet");
    assert.deepStrictEqual(D.pending(calls), [M(1)], "still on the list");
    await D.learn(M(1)); await D.learn(M(1));
    assert.strictEqual(D.profile(A("dev"), calls).funder.address, A("bank"));
    assert.deepStrictEqual(D.pending(calls), []);
    assert.strictEqual(w.calls.filter((c) => c.includes("/report")).length, 1, "the creator is looked up once");
  });

  await t("agent decision: block beats warn beats allow", () => {
    const { decide } = require("../api/mcp.js");
    const o = (score, hardFlag = false, unavailableChecks = 0) => ({ score, hardFlag, unavailableChecks });
    assert.strictEqual(decide(o(10), null, 69, 40), "allow");
    assert.strictEqual(decide(o(40), null, 69, 40), "warn", "at the warn score");
    assert.strictEqual(decide(o(69), null, 69, 40), "warn", "at the max score is still not blocked");
    assert.strictEqual(decide(o(70), null, 69, 40), "block");
    assert.strictEqual(decide(o(5, true), null, 69, 40), "block", "a hard flag blocks at any score");
    assert.strictEqual(decide(o(5, false, 1), null, 69, 40), "warn", "a check that could not run is never a clean allow");
    assert.strictEqual(decide(o(5), { level: "serial" }, 69, 40), "warn");
    assert.strictEqual(decide(o(5), { level: "flagged" }, 69, 40), "warn");
    assert.strictEqual(decide(o(5), { level: "clean" }, 69, 40), "allow");
    assert.strictEqual(decide(o(5), { level: "new" }, 69, 40), "allow", "an unknown deployer alone is not a warning");
  });

  console.log(`\n${pass} deployers tests passed`);
})();
