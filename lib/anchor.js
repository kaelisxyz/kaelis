// On-chain anchor: once a day Kaelis writes the heads of its hash chains (Ledger, Filings, Genome)
// into a Solana memo transaction. Anyone can then prove that no call or filing was edited after that day:
// recompute the chain from the public data and compare it with the memo on Solscan.
//
// No dependencies: the transaction (one Memo instruction, legacy format) is built and signed here with
// Node's ed25519. The wallet is Kaelis's own small hot wallet, KAELIS_LEDGER_KEY (base58, 64 bytes,
// Phantom-compatible). It only ever pays the ~0.000005 SOL fee per anchor.
const crypto = require("crypto");
const { b58decode, store } = require("./build.js");

const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DAY = 864e5, MIN_LAMPORTS = 10000;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58encode(buf) {
  let n = BigInt("0x" + (Buffer.from(buf).toString("hex") || "0")), s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of buf) { if (b === 0) s = "1" + s; else break; }
  return s;
}
const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
function newWallet() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const seed = Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url"), pub = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  return { secret: b58encode(Buffer.concat([seed, pub])), address: b58encode(pub) };
}
function loadWallet(secret) {
  const raw = b58decode(String(secret || "").trim());
  if (raw.length !== 64) throw new Error("KAELIS_LEDGER_KEY must be a 64-byte base58 secret key.");
  const key = crypto.createPrivateKey({ key: Buffer.concat([PKCS8, raw.subarray(0, 32)]), format: "der", type: "pkcs8" });
  const pub = raw.subarray(32);
  const check = Buffer.from(crypto.createPublicKey(key).export({ format: "jwk" }).x, "base64url");
  if (!check.equals(pub)) throw new Error("KAELIS_LEDGER_KEY: the public half does not match the secret.");
  return { key, pub, address: b58encode(pub) };
}
const cu16 = (n) => { const out = []; do { let b = n & 0x7f; n >>= 7; if (n) b |= 0x80; out.push(b); } while (n); return Buffer.from(out); };
// legacy message: payer (signer, writable) + memo program (read-only), one instruction with the memo bytes
function memoMessage(payer, blockhash, text) {
  const data = Buffer.from(text, "utf8");
  return Buffer.concat([
    Buffer.from([1, 0, 1]),                       // 1 signature, 0 read-only signed, 1 read-only unsigned
    cu16(2), payer, b58decode(MEMO_PROGRAM),      // account keys
    b58decode(blockhash),                         // recent blockhash
    cu16(1), Buffer.from([1]), cu16(0), cu16(data.length), data, // program index 1, no accounts, data
  ]);
}
function signedMemoTx(wallet, blockhash, text) {
  const msg = memoMessage(wallet.pub, blockhash, text), sig = crypto.sign(null, msg, wallet.key);
  return { tx: Buffer.concat([cu16(1), sig, msg]), signature: b58encode(sig), message: msg };
}
// what goes on chain: short, versioned, every head and length
function anchorText(s) {
  return `kaelis-anchor v1 ${s.day} ledger:${s.ledger.length}:${s.ledger.head} filings:${s.filings.length}:${s.filings.head} genome:G${s.genome.gen}:${s.genome.hash}`;
}

function makeAnchor({ rpc, secret = process.env.KAELIS_LEDGER_KEY, db = store(undefined, "anchors.json", () => ({ anchors: [] })), now = () => Date.now() } = {}) {
  const wallet = secret ? loadWallet(secret) : null;
  return {
    address: wallet ? wallet.address : null,
    async balance() { if (!wallet) return null; return (await rpc("getBalance", [wallet.address, { commitment: "confirmed" }])).value; },
    due() { const a = db.load().anchors; return !a.length || now() - Date.parse(a[a.length - 1].at) >= DAY; },
    // state = { ledger:{head,length}, filings:{head,length}, genome:{gen,hash} }
    async anchor(state) {
      if (!wallet) return { skipped: "no wallet (KAELIS_LEDGER_KEY)" };
      const lamports = await this.balance();
      if (lamports < MIN_LAMPORTS) return { skipped: `wallet ${wallet.address} needs SOL for fees (has ${lamports} lamports)` };
      const day = new Date(now()).toISOString().slice(0, 10), text = anchorText({ day, ...state });
      const { blockhash } = (await rpc("getLatestBlockhash", [{ commitment: "finalized" }])).value;
      const { tx, signature } = signedMemoTx(wallet, blockhash, text);
      const sent = await rpc("sendTransaction", [tx.toString("base64"), { encoding: "base64", preflightCommitment: "confirmed" }]);
      const rec = { at: new Date(now()).toISOString(), day, signature: sent || signature, memo: text, ...state };
      const d = db.load(); d.anchors.push(rec); d.anchors = d.anchors.slice(-400); db.save();
      return rec;
    },
    view() { const a = db.load().anchors; return { address: wallet ? wallet.address : null, on: !!wallet, count: a.length, latest: a[a.length - 1] || null, anchors: a.slice(-30).reverse() }; },
  };
}

module.exports = { makeAnchor, newWallet, loadWallet, memoMessage, signedMemoTx, anchorText, b58encode, MEMO_PROGRAM };
