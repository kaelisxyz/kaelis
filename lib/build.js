// Proof-of-Build: builders prove a GitHub account and a Solana wallet, Kaelis counts their
// merged pull requests every week and keeps a points ledger (converted to $KAEL at launch).
//
// Proofs (no OAuth app needed):
//   wallet  -> the builder signs a short message with the wallet (ed25519, checked here)
//   GitHub  -> the builder puts a code ("kaelis-<first 10 chars of wallet>") in their GitHub bio
//              or in the description of one of their public gists
//
// Anti-cheat rules for a pull request to count:
//   merged in the last 7 days, into a repo the builder does NOT own, merged by someone else,
//   repo has >= MIN_STARS stars, at least MIN_LINES lines changed. GitHub account >= 30 days old.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MIN_STARS = 5, MIN_LINES = 10, MAX_PRS = 20, MIN_ACCOUNT_DAYS = 30;
const SIGN_WINDOW_MS = 10 * 60 * 1000;
const REFRESH_EVERY_MS = 15 * 60 * 1000;

// ---------- base58 + signature ----------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s) {
  let n = 0n;
  for (const c of String(s)) { const i = B58.indexOf(c); if (i < 0) throw new Error("bad base58"); n = n * 58n + BigInt(i); }
  const out = [];
  while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of String(s)) { if (c === "1") out.unshift(0); else break; }
  return Buffer.from(out);
}
const ED25519_SPKI = Buffer.from("302a300506032b6570032100", "hex");
function verifyWalletSignature(wallet, message, signatureB64) {
  try {
    const pub = b58decode(wallet);
    if (pub.length !== 32) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI, pub]), format: "der", type: "spki" });
    const sig = Buffer.from(String(signatureB64), "base64");
    if (sig.length !== 64) return false;
    return crypto.verify(null, Buffer.from(message, "utf8"), key, sig);
  } catch (e) { return false; }
}
const proofCode = (wallet) => "kaelis-" + String(wallet).slice(0, 10);
function signMessage(github, wallet, iso) {
  return `Kaelis Proof-of-Build\nGitHub: ${github}\nWallet: ${wallet}\nTime: ${iso}`;
}
// parse + check the message the wallet signed
function checkMessage(message, github, wallet, now = Date.now()) {
  const m = /^Kaelis Proof-of-Build\nGitHub: (.+)\nWallet: (.+)\nTime: (.+)$/.exec(String(message || ""));
  if (!m) return "The signed message is not in the expected format.";
  if (m[1].toLowerCase() !== github.toLowerCase() || m[2] !== wallet) return "The signed message is for a different GitHub account or wallet.";
  const t = Date.parse(m[3]);
  if (!t || Math.abs(now - t) > SIGN_WINDOW_MS) return "The signature is older than 10 minutes. Sign again.";
  return null;
}

// ---------- GitHub ----------
function gh(fetchFn) {
  const headers = { "user-agent": "kaelis-proof-of-build", accept: "application/vnd.github+json" };
  if (process.env.GITHUB_API_TOKEN) headers.authorization = "Bearer " + process.env.GITHUB_API_TOKEN;
  return async (url) => {
    const r = await fetchFn("https://api.github.com" + url, { headers });
    if (r.status === 404) return null;
    if (r.status === 403 || r.status === 429) throw new Error("GitHub rate limit reached. Try again in a few minutes.");
    if (!r.ok) throw new Error("GitHub answered " + r.status + ".");
    return r.json();
  };
}
async function githubProof(get, github, wallet, now = Date.now()) {
  const user = await get("/users/" + encodeURIComponent(github));
  if (!user) return { ok: false, error: "That GitHub account doesn't exist." };
  const ageDays = (now - Date.parse(user.created_at)) / 864e5;
  if (ageDays < MIN_ACCOUNT_DAYS) return { ok: false, error: `GitHub accounts must be at least ${MIN_ACCOUNT_DAYS} days old.` };
  const code = proofCode(wallet);
  if (String(user.bio || "").includes(code)) return { ok: true, login: user.login, via: "bio" };
  const gists = (await get("/users/" + encodeURIComponent(github) + "/gists?per_page=30")) || [];
  if (gists.some((g) => String(g.description || "").includes(code))) return { ok: true, login: user.login, via: "gist" };
  return { ok: false, error: `Put ${code} in your GitHub bio (or a public gist description), then try again.` };
}
const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, "0")}`;
};
function prPoints(lines, stars) {
  return Math.round((10 + Math.min(20, Math.log2(1 + lines) * 2.5)) * (stars >= 1000 ? 2 : stars >= 100 ? 1.5 : 1));
}
// merged PRs of the last 7 days that pass the anti-cheat rules
async function weeklyWork(get, login, now = Date.now()) {
  const since = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
  const q = `is:pr author:${login} is:merged merged:>=${since} -user:${login}`;
  const found = await get("/search/issues?per_page=50&q=" + encodeURIComponent(q));
  const items = ((found && found.items) || []).slice(0, MAX_PRS);
  const prs = [], skipped = [];
  for (const it of items) {
    const pr = await get(new URL(it.pull_request.url).pathname);
    if (!pr) continue;
    const repo = pr.base && pr.base.repo, lines = (pr.additions || 0) + (pr.deletions || 0);
    const why = !pr.merged_at ? "not merged"
      : repo.owner.login.toLowerCase() === login.toLowerCase() ? "own repo"
      : pr.merged_by && pr.merged_by.login.toLowerCase() === login.toLowerCase() ? "merged by the author"
      : repo.stargazers_count < MIN_STARS ? `repo under ${MIN_STARS} stars`
      : lines < MIN_LINES ? `under ${MIN_LINES} lines` : null;
    const row = { repo: repo.full_name, title: String(pr.title).slice(0, 120), url: pr.html_url, lines, stars: repo.stargazers_count, mergedAt: pr.merged_at };
    if (why) skipped.push({ ...row, why });
    else prs.push({ ...row, points: prPoints(lines, repo.stargazers_count) });
  }
  return { prs, skipped, points: prs.reduce((t, p) => t + p.points, 0) };
}

// ---------- storage (one JSON file; mount a volume at KAELIS_DATA_DIR on Railway) ----------
function store(dir = process.env.KAELIS_DATA_DIR || path.join(__dirname, "..", "data"), name = "builders.json", empty = () => ({ builders: {} })) {
  const file = path.join(dir, name);
  let db = null;
  const load = () => {
    if (db) return db;
    try { db = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { db = empty(); }
    return db;
  };
  const save = () => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1)); fs.renameSync(tmp, file);
  };
  return { load, save, file };
}

// ---------- public operations ----------
function publicBuilder(b, week) {
  const w = (b.weeks && b.weeks[week]) || { points: 0, prs: [] };
  const allTime = Object.values(b.weeks || {}).reduce((t, x) => t + (x.points || 0), 0);
  return { github: b.github, wallet: b.wallet.slice(0, 4) + "…" + b.wallet.slice(-4), joinedAt: b.joinedAt, checkedAt: b.checkedAt,
    weekPoints: w.points, allTimePoints: allTime, prs: w.prs, skipped: (w.skipped || []).slice(0, 10) };
}
function makeBuild({ fetchFn = fetch, db = store(), now = () => Date.now() } = {}) {
  const get = gh(fetchFn);
  async function refresh(b) {
    const t = now(), work = await weeklyWork(get, b.github, t), week = isoWeek(new Date(t));
    b.weeks = b.weeks || {}; b.weeks[week] = { points: work.points, prs: work.prs, skipped: work.skipped };
    b.checkedAt = new Date(t).toISOString();
    db.save();
    return b;
  }
  return {
    proofCode, signMessage,
    async register({ github, wallet, message, signature }) {
      github = String(github || "").trim().replace(/^@/, ""); wallet = String(wallet || "").trim();
      if (!/^[A-Za-z0-9-]{1,39}$/.test(github)) return { status: 400, body: { error: "That doesn't look like a GitHub username." } };
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) return { status: 400, body: { error: "That doesn't look like a Solana wallet address." } };
      const bad = checkMessage(message, github, wallet, now());
      if (bad) return { status: 400, body: { error: bad } };
      if (!verifyWalletSignature(wallet, message, signature)) return { status: 400, body: { error: "The wallet signature doesn't match. Sign again with the same wallet." } };
      const d = db.load(), key = github.toLowerCase();
      const taken = Object.values(d.builders).find((b) => b.wallet === wallet && b.github.toLowerCase() !== key);
      if (taken) return { status: 409, body: { error: "This wallet is already linked to another GitHub account." } };
      if (d.builders[key] && d.builders[key].wallet !== wallet) return { status: 409, body: { error: "This GitHub account is already linked to another wallet." } };
      const proof = await githubProof(get, github, wallet, now());
      if (!proof.ok) return { status: 400, body: { error: proof.error, code: proofCode(wallet) } };
      const b = d.builders[key] || { github: proof.login, wallet, joinedAt: new Date(now()).toISOString(), weeks: {} };
      b.proof = proof.via; d.builders[key] = b; db.save();
      await refresh(b);
      return { status: 200, body: { ok: true, builder: publicBuilder(b, isoWeek(new Date(now()))) } };
    },
    async refreshOne(github) {
      const d = db.load(), b = d.builders[String(github || "").toLowerCase()];
      if (!b) return { status: 404, body: { error: "No builder with that GitHub account yet." } };
      if (b.checkedAt && now() - Date.parse(b.checkedAt) < REFRESH_EVERY_MS) return { status: 200, body: { ok: true, fresh: true, builder: publicBuilder(b, isoWeek(new Date(now()))) } };
      await refresh(b);
      return { status: 200, body: { ok: true, builder: publicBuilder(b, isoWeek(new Date(now()))) } };
    },
    // leaderboard; quietly refreshes up to 2 stale builders per call so GitHub limits hold
    async list() {
      const d = db.load(), week = isoWeek(new Date(now()));
      const stale = Object.values(d.builders).filter((b) => !b.checkedAt || now() - Date.parse(b.checkedAt) > 60 * 60 * 1000).slice(0, 2);
      for (const b of stale) { try { await refresh(b); } catch (e) { break; } }
      const builders = Object.values(d.builders).map((b) => publicBuilder(b, week)).sort((a, b) => b.weekPoints - a.weekPoints || b.allTimePoints - a.allTimePoints);
      return { status: 200, body: { week, count: builders.length, rules: { minStars: MIN_STARS, minLines: MIN_LINES, minAccountDays: MIN_ACCOUNT_DAYS }, builders, payout: "Points convert to $KAEL at launch. Nothing is paid before that." } };
    },
  };
}

module.exports = { makeBuild, weeklyWork, gh, verifyWalletSignature, checkMessage, signMessage, proofCode, prPoints, isoWeek, b58decode, store };
