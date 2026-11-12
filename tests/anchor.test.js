// On-chain anchor tests. Run: node tests/anchor.test.js
const assert = require("assert");
const crypto = require("crypto");
const { newWallet, loadWallet, memoMessage, signedMemoTx, anchorText, b58encode, makeAnchor, MEMO_PROGRAM } = require("../lib/anchor.js");
const { b58decode } = require("../lib/build.js");

let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("ok  ", name); } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
const BH = "11111111111111111111111111111111"; // 32 zero bytes, a valid base58 blockhash shape
const memDb = () => { let d = { anchors: [] }; return { load: () => d, save: () => {} }; };
const state = { ledger: { head: "a".repeat(64), length: 418 }, filings: { head: "b".repeat(64), length: 407 }, genome: { gen: 0, hash: "c".repeat(64) } };

(async () => {
  await t("base58 round trip, including leading zeros", () => {
    for (const hex of ["00", "0000ff", "ff", "0102030405"]) { const b = Buffer.from(hex, "hex"); assert.ok(b58decode(b58encode(b)).equals(b)); }
    assert.strictEqual(b58decode(MEMO_PROGRAM).length, 32);
  });
  await t("a new wallet is a Phantom-style 64-byte secret whose public half matches", () => {
    const w = newWallet(), l = loadWallet(w.secret);
    assert.strictEqual(b58decode(w.secret).length, 64); assert.strictEqual(l.address, w.address);
    assert.throws(() => loadWallet(b58encode(Buffer.alloc(64, 7))), /does not match/);
  });
  await t("memo transaction: correct layout and a valid ed25519 signature", () => {
    const w = loadWallet(newWallet().secret), text = anchorText({ day: "2026-11-12", ...state });
    const { tx, message } = signedMemoTx(w, BH, text);
    assert.deepStrictEqual([...message.subarray(0, 4)], [1, 0, 1, 2]);              // header + 2 keys
    assert.ok(message.subarray(4, 36).equals(w.pub));                              // payer first
    assert.ok(message.subarray(36, 68).equals(b58decode(MEMO_PROGRAM)));          // memo program
    assert.ok(message.toString("utf8").endsWith(text));                            // memo at the end
    assert.strictEqual(tx[0], 1);                                                  // one signature
    const pub = crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), w.pub]), format: "der", type: "spki" });
    assert.ok(crypto.verify(null, message, pub, tx.subarray(1, 65)));
    assert.ok(tx.length < 1232, "fits in one Solana packet");
  });
  await t("the memo carries every head and length", () => {
    const s = anchorText({ day: "2026-11-12", ...state });
    assert.ok(s.includes("ledger:418:" + "a".repeat(64)) && s.includes("filings:407:") && s.includes("genome:G0:"));
  });
  await t("no wallet or no SOL: skipped, nothing sent", async () => {
    const off = makeAnchor({ secret: "", db: memDb(), rpc: async () => { throw new Error("must not call"); } });
    assert.match((await off.anchor(state)).skipped, /no wallet/);
    const poor = makeAnchor({ secret: newWallet().secret, db: memDb(), rpc: async (m) => (m === "getBalance" ? { value: 0 } : null) });
    assert.match((await poor.anchor(state)).skipped, /needs SOL/);
  });
  await t("sends once a day and records the signature", async () => {
    let tm = Date.parse("2026-11-12T00:00:00Z"); const sent = [];
    const rpc = async (m, p) => m === "getBalance" ? { value: 5e6 } : m === "getLatestBlockhash" ? { value: { blockhash: BH } } : (sent.push(p[0]), "sig" + sent.length);
    const A = makeAnchor({ secret: newWallet().secret, db: memDb(), rpc, now: () => tm });
    assert.strictEqual(A.due(), true);
    const r = await A.anchor(state); assert.strictEqual(r.signature, "sig1"); assert.strictEqual(A.due(), false);
    tm += 864e5; assert.strictEqual(A.due(), true);
    assert.strictEqual(A.view().count, 1);
  });
  console.log(`\n${pass} anchor tests passed`);
})();
