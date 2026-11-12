// Offline tests for Proof-of-Build: wallet signatures, GitHub proof, anti-cheat rules, points ledger.
const assert = require("assert");
const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");
const B = require("../lib/build.js");

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58encode(buf) {
  let n = BigInt("0x" + (buf.toString("hex") || "0")), s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const x of buf) { if (x === 0) s = "1" + s; else break; }
  return s;
}
function wallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(12);
  return { address: b58encode(raw), sign: (msg) => crypto.sign(null, Buffer.from(msg, "utf8"), privateKey).toString("base64") };
}

const NOW = Date.parse("2026-11-08T12:00:00Z");
function github({ bio = "", gistDesc = "", created = "2024-01-01T00:00:00Z" } = {}) {
  const pr = (n, o) => Object.assign({ merged_at: "2026-11-06T10:00:00Z", additions: 120, deletions: 30, title: "PR " + n, html_url: "https://github.com/x/pull/" + n,
    merged_by: { login: "maintainer" }, base: { repo: { full_name: "solana-labs/thing", owner: { login: "solana-labs" }, stargazers_count: 4200 } } }, o);
  const PRS = {
    1: pr(1),
    2: pr(2, { base: { repo: { full_name: "dev/own", owner: { login: "dev" }, stargazers_count: 50 } } }),          // own repo
    3: pr(3, { merged_by: { login: "dev" } }),                                                                    // self-merged
    4: pr(4, { base: { repo: { full_name: "tiny/repo", owner: { login: "tiny" }, stargazers_count: 1 } } }),      // too few stars
    5: pr(5, { additions: 2, deletions: 1 }),                                                                     // too small
  };
  return async (url) => {
    const u = new URL(url), ok = (b) => ({ ok: true, status: 200, json: async () => b });
    if (u.pathname === "/users/dev") return ok({ login: "dev", bio, created_at: created });
    if (u.pathname === "/users/dev/gists") return ok(gistDesc ? [{ description: gistDesc }] : []);
    if (u.pathname === "/search/issues") return ok({ items: Object.keys(PRS).map((n) => ({ pull_request: { url: "https://api.github.com/repos/x/pulls/" + n } })) });
    const m = /\/repos\/x\/pulls\/(\d+)$/.exec(u.pathname);
    if (m) return ok(PRS[m[1]]);
    return { ok: false, status: 404, json: async () => ({}) };
  };
}
const tmpDb = () => B.store(fs.mkdtempSync(path.join(os.tmpdir(), "kaelis-pob-")));

(async () => {
  let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
  const w = wallet(), iso = new Date(NOW).toISOString(), msg = B.signMessage("dev", w.address, iso);

  await t("verifies a real ed25519 wallet signature", () => {
    assert.strictEqual(B.verifyWalletSignature(w.address, msg, w.sign(msg)), true);
    assert.strictEqual(B.verifyWalletSignature(w.address, msg + "x", w.sign(msg)), false);
    assert.strictEqual(B.verifyWalletSignature(wallet().address, msg, w.sign(msg)), false);
  });
  await t("rejects stale or mismatched messages", () => {
    assert.strictEqual(B.checkMessage(msg, "dev", w.address, NOW), null);
    assert.ok(B.checkMessage(msg, "dev", w.address, NOW + 11 * 60000));
    assert.ok(B.checkMessage(msg, "someone", w.address, NOW));
  });
  await t("register needs the proof code on GitHub", async () => {
    const build = B.makeBuild({ fetchFn: github(), db: tmpDb(), now: () => NOW });
    const r = await build.register({ github: "dev", wallet: w.address, message: msg, signature: w.sign(msg) });
    assert.strictEqual(r.status, 400); assert.strictEqual(r.body.code, B.proofCode(w.address));
  });
  await t("register with code in bio counts only fair PRs", async () => {
    const build = B.makeBuild({ fetchFn: github({ bio: "I build " + B.proofCode(w.address) }), db: tmpDb(), now: () => NOW });
    const r = await build.register({ github: "dev", wallet: w.address, message: msg, signature: w.sign(msg) });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const b = r.body.builder;
    assert.strictEqual(b.prs.length, 1); assert.strictEqual(b.prs[0].repo, "solana-labs/thing");
    assert.deepStrictEqual(b.skipped.map((s) => s.why).sort(), ["merged by the author", "own repo", "repo under 5 stars", "under 10 lines"].sort());
    assert.strictEqual(b.weekPoints, B.prPoints(150, 4200));
    const list = await build.list();
    assert.strictEqual(list.body.count, 1); assert.strictEqual(list.body.builders[0].github, "dev");
  });
  await t("gist description also proves the account", async () => {
    const build = B.makeBuild({ fetchFn: github({ gistDesc: "proof " + B.proofCode(w.address) }), db: tmpDb(), now: () => NOW });
    const r = await build.register({ github: "dev", wallet: w.address, message: msg, signature: w.sign(msg) });
    assert.strictEqual(r.status, 200);
  });
  await t("new GitHub accounts are refused", async () => {
    const build = B.makeBuild({ fetchFn: github({ bio: B.proofCode(w.address), created: "2026-11-01T00:00:00Z" }), db: tmpDb(), now: () => NOW });
    const r = await build.register({ github: "dev", wallet: w.address, message: msg, signature: w.sign(msg) });
    assert.strictEqual(r.status, 400); assert.ok(/30 days/.test(r.body.error));
  });
  await t("one wallet per GitHub account", async () => {
    const db = tmpDb(), fetchFn = github({ bio: B.proofCode(w.address) });
    const build = B.makeBuild({ fetchFn, db, now: () => NOW });
    await build.register({ github: "dev", wallet: w.address, message: msg, signature: w.sign(msg) });
    const w2 = wallet(), msg2 = B.signMessage("dev", w2.address, iso);
    const r = await build.register({ github: "dev", wallet: w2.address, message: msg2, signature: w2.sign(msg2) });
    assert.strictEqual(r.status, 409);
  });
  await t("ISO week label", () => assert.strictEqual(B.isoWeek(new Date(NOW)), "2026-W45"));

  console.log(`\n${n} build tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
