/*
 * SPDX-License-Identifier: MIT  (see LICENSE next to this file; the licence covers this file only)
 *
 * Kaelis Core: data gathering + rules engine for the token scanner (Solana, and since rules 1.6.0 Ethereum, BNB Chain,
 * Base and Robinhood Chain).
 * Pure JavaScript with fetch, so the same file runs in the browser (window.KaelisCore)
 * and in Node 18+ (require), which lets the website and the API share one rule set.
 *
 * Rules decide, text explains: evaluate() is deterministic for a given data snapshot,
 * summary() only describes what evaluate() found and never changes the score.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KaelisCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RULES_VERSION = "1.6.0";
  // Official mints of tokenized stocks Kaelis knows (xStocks by Backed). A token that uses one of these
  // tickers but is not the official mint is an impersonation: a hard flag, whatever else it looks like.
  // The official ones are read differently (rules 1.4.0): see ISSUER_CHECKS.
  const KNOWN_ASSETS = {
    SPYX: { mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", name: "S&P 500 xStock" },
    QQQX: { mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", name: "Nasdaq 100 xStock" },
    NVDAX: { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", name: "NVIDIA xStock" },
    TSLAX: { mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", name: "Tesla xStock" },
    AAPLX: { mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", name: "Apple xStock" },
  };
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const SYSTEM = "11111111111111111111111111111111";
  const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  const DEFAULT_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
  // owners whose token accounts are pool liquidity, not holders
  const POOL_OWNERS = new Set([
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Raydium AMM v4 authority
    "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL", // Raydium CPMM authority
    "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg", // pump.fun AMM global
  ]);
  const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  // An official tokenized stock is a claim on a share held by a regulated issuer. What the rug checks measure
  // there is the issuer's legal control and its custody, not a deployer who can run: mint and freeze authority,
  // Token-2022 extensions (a permanent delegate, for court orders), holder concentration (the custody wallets)
  // and LP lock (pools run by market makers; pulling one does not touch the backing). For those tokens these checks
  // are reported apart, as `issuer`, and do not add to the score. The market checks (sell test, liquidity, pool age)
  // still score, and the grade is capped at A: issuer control is a known flag of its own kind. (rules 1.4.0)
  const ISSUER_CHECKS = ["mint", "freeze", "extensions", "holders", "lp"];

  // Companies with no official token on Solana (not listed, or listed with no tokenized version yet). A token that uses
  // one of these names is not that company's stock, whatever it is: a meme, or a "pre-IPO" wrapper the company does not
  // recognise. That is a warning, not a hard flag: names and short tickers collide with unrelated tokens ("ANT" is also
  // AntMiner and The Ants), so the match is on the full company name and only caps the grade at BB. When an official
  // tokenized version appears, its mint goes into KNOWN_ASSETS and copies become a hard flag like any other. (rules 1.5.0)
  const UNLISTED = [
    { re: /\banthropic\b/i, name: "Anthropic", says: "Anthropic says transfers of its shares without board approval are void." },
    { re: /\bopen\s?ai\b/i, name: "OpenAI", says: "OpenAI has said tokens like these are not OpenAI equity." },
  ];

  // weights add up to 100 (see docs/TECH.md)
  const WEIGHTS = { sell: 25, liquidity: 15, holders: 15, lp: 15, mint: 10, extensions: 10, age: 5, freeze: 5 };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const usd = (n) => n == null || isNaN(n) ? "–" : n >= 1e9 ? "$" + (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "k" : "$" + n.toFixed(0);
  const pct = (x) => (x * 100).toFixed(x < 0.1 ? 1 : 0) + "%";

  function isAddress(s) { return B58.test(String(s || "").trim()); }

  function makeClient(opts) {
    opts = opts || {};
    const f = opts.fetch || (typeof fetch !== "undefined" ? fetch.bind(typeof self !== "undefined" ? self : globalThis) : null);
    if (!f) throw new Error("fetch is not available");
    const rpcs = opts.rpcUrls && opts.rpcUrls.length ? opts.rpcUrls : DEFAULT_RPCS;
    const timeout = opts.timeoutMs || 12000;
    async function withTimeout(url, init) {
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
      try { return await f(url, Object.assign({}, init, ctl ? { signal: ctl.signal } : {})); }
      finally { if (t) clearTimeout(t); }
    }
    async function rpc(method, params) {
      let last;
      for (const url of rpcs) {
        try {
          const r = await withTimeout(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
          if (!r.ok) throw new Error("HTTP " + r.status);
          const j = await r.json();
          if (j.error) throw new Error(j.error.message || "RPC error");
          return j.result;
        } catch (e) { last = e; }
      }
      throw last || new Error("RPC unavailable");
    }
    async function json(url) {
      const r = await withTimeout(url);
      const body = await r.json().catch(() => null);
      if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; e.body = body; throw e; }
      return body;
    }
    return { rpc, json };
  }

  // Jupiter round trip: buy with 0.1 SOL, then quote selling everything back.
  async function sellTest(c, mint) {
    if (mint === SOL_MINT) return { skipped: true };
    const base = "https://lite-api.jup.ag/swap/v1/quote?slippageBps=1000&restrictIntermediateTokens=true";
    const lamports = 1e8;
    let buy;
    try { buy = await c.json(`${base}&inputMint=${SOL_MINT}&outputMint=${mint}&amount=${lamports}`); }
    catch (e) { return { buyRoute: false, error: e.body && (e.body.errorCode || e.body.error) }; }
    if (!buy || !buy.outAmount || buy.outAmount === "0") return { buyRoute: false };
    // Only a definite answer from Jupiter counts as "can't sell". Timeouts, rate limits (429) and
    // server errors (5xx) are retried once, then reported as unknown so a busy API never brands a token a honeypot.
    const transient = (e) => !e.status || e.status === 429 || e.status >= 500;
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const sell = await c.json(`${base}&inputMint=${mint}&outputMint=${SOL_MINT}&amount=${buy.outAmount}`);
        const back = +sell.outAmount;
        return { buyRoute: true, sellRoute: back > 0, loss: 1 - back / lamports, buyImpact: +buy.priceImpactPct || 0, sellImpact: +sell.priceImpactPct || 0 };
      } catch (e) {
        last = e;
        if (!transient(e)) return { buyRoute: true, sellRoute: false, error: e.body && (e.body.errorCode || e.body.error) };
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
    return { buyRoute: true, sellRoute: null, unsure: true, error: last && (last.status ? "HTTP " + last.status : "network") };
  }


  // ---- EVM chains (rules 1.6.0): Ethereum, BNB Chain, Base, Robinhood Chain.
  // The same eight checks with the same weights as on Solana, read the EVM way: the sell test and the contract reading
  // come from GoPlus Security (it simulates a buy and a sell and reads the contract), pools and prices from DexScreener.
  // Same weights means a score means the same thing on every chain, and the Ledger grades every chain the same way.
  const CHAINS = {
    solana: { name: "Solana", dex: "solana" },
    ethereum: { name: "Ethereum", dex: "ethereum", goplus: "1", explorer: "https://etherscan.io/token/" },
    bsc: { name: "BNB Chain", dex: "bsc", goplus: "56", explorer: "https://bscscan.com/token/" },
    base: { name: "Base", dex: "base", goplus: "8453", explorer: "https://basescan.org/token/" },
    robinhood: { name: "Robinhood Chain", dex: "robinhood", goplus: "4663", explorer: null },
  };
  const EVM_CHAINS = Object.keys(CHAINS).filter((k) => CHAINS[k].goplus);
  const EVM = /^0x[0-9a-fA-F]{40}$/;
  const BURN = /^0x(0{40}|0{36}dead)$/i;
  function isEvmAddress(s) { return EVM.test(String(s || "").trim()); }

  // which EVM chain a 0x token trades on: the one with the deepest pools on DexScreener (null if none)
  async function detectChain(addr, opts) {
    const c = makeClient(opts), j = await c.json("https://api.dexscreener.com/latest/dex/tokens/" + String(addr).trim());
    const liq = {};
    for (const p of (j && j.pairs) || []) { const k = EVM_CHAINS.find((x) => CHAINS[x].dex === p.chainId); if (k) liq[k] = (liq[k] || 0) + ((p.liquidity && p.liquidity.usd) || 0); }
    const best = Object.keys(liq).sort((a, b) => liq[b] - liq[a])[0];
    return best || null;
  }

  async function gatherEvm(addr, chain, c) {
    const C = CHAINS[chain];
    const [gp, dex] = await Promise.allSettled([
      c.json(`https://api.gopluslabs.io/api/v1/token_security/${C.goplus}?contract_addresses=${addr}`),
      c.json("https://api.dexscreener.com/latest/dex/tokens/" + addr),
    ]);
    const res = gp.status === "fulfilled" && gp.value && gp.value.result;
    const g = res ? (res[addr] || Object.values(res)[0] || null) : null;
    const ok = g && Object.keys(g).length ? g : null;
    const pairs = dex.status === "fulfilled" ? ((dex.value && dex.value.pairs) || []).filter((p) => p.chainId === C.dex) : null;
    if (!ok && !(pairs && pairs.length)) throw new Error(`No token found at this address on ${C.name}. Check the address and the chain.`);
    const on = (k) => ok && ok[k] === "1";
    const owner = ok && ok.owner_address && !BURN.test(ok.owner_address) ? ok.owner_address : null;
    const supply = ok && ok.total_supply != null ? +ok.total_supply : null;
    const pools = new Set((pairs || []).map((p) => String(p.pairAddress || "").toLowerCase()));
    return {
      chain, mint: addr, program: "evm:" + chain, fetchedAt: new Date().toISOString(), slot: null, jup: null, rug: null, gp: ok, pairs, supply,
      meta: ok ? { symbol: ok.token_symbol || null, name: ok.token_name || null } : null,
      // the same shape the Solana pages read: who can still mint, who can still freeze (pause or blacklist)
      mintInfo: { decimals: null, mintAuthority: on("is_mintable") && owner ? owner : null, freezeAuthority: (on("transfer_pausable") || on("is_blacklisted")) && owner ? owner : null },
      holders: ok && Array.isArray(ok.holders) ? ok.holders.map((h) => ({ owner: h.address, account: h.address, amount: supply ? (+h.percent || 0) * supply : 0, share: +h.percent || 0,
        pool: pools.has(String(h.address).toLowerCase()) || BURN.test(h.address) || h.is_locked == 1 || (h.is_contract == 1 && !!h.tag), tag: h.tag || null })) : null,
      creator: ok && ok.creator_address ? ok.creator_address : null,
    };
  }

  function evaluateEvm(d, genome) {
    const W = (genome && genome.weights) || WEIGHTS, checks = [];
    const FLOOR = (genome && genome.hardFloor) || 85;
    const add = (id, name, weight, sev, detail, extra) => checks.push(Object.assign({ id, name, weight, sev, detail }, extra || {}));
    const g = d.gp, pairs = d.pairs, on = (k) => !!g && g[k] === "1", C = CHAINS[d.chain] || { name: d.chain };
    const owner = g && g.owner_address && !BURN.test(g.owner_address) ? g.owner_address : null;
    const sh = (a) => a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
    const none = (id, name, w, why) => add(id, name, w, null, why);

    // 1 sell test: GoPlus simulates a buy and a sell
    if (!g) none("sell", "Sell test", W.sell, "The contract check (GoPlus) did not answer, so selling can't be tested right now.");
    else if (on("is_honeypot")) add("sell", "Sell test", W.sell, 1, "A simulated sell fails. This is how a honeypot behaves (GoPlus).", { hard: true });
    else if (on("cannot_sell_all")) add("sell", "Sell test", W.sell, 1, "The contract stops holders from selling all of their tokens (GoPlus).", { hard: true });
    else if (g.sell_tax == null || g.sell_tax === "") none("sell", "Sell test", W.sell, "The sell could not be simulated, so the sell tax is unknown.");
    else { const st = Math.max(0, +g.sell_tax || 0), bt = Math.max(0, +g.buy_tax || 0);
      add("sell", "Sell test", W.sell, clamp((st - 0.1) / 0.4, 0, 1), `Simulated trade: ${pct(bt)} buy tax, ${pct(st)} sell tax (GoPlus).`, { hard: st >= 0.5 }); }

    // 2 liquidity
    if (pairs && pairs.length) {
      const liq = pairs.reduce((t, p) => t + ((p.liquidity && p.liquidity.usd) || 0), 0);
      const sev = liq <= 0 ? 1 : clamp(1 - (Math.log10(liq) - Math.log10(5e3)) / (Math.log10(2.5e5) - Math.log10(5e3)), 0, 1);
      add("liquidity", "Liquidity depth", W.liquidity, sev, `${usd(liq)} in ${pairs.length} pool${pairs.length > 1 ? "s" : ""} on ${C.name}.`, { value: liq });
    } else none("liquidity", "Liquidity depth", W.liquidity, `No trading pool found on ${C.name}.`);

    // 3 top holders (pools, burned and locked tokens and labelled contracts left out)
    if (d.holders && d.holders.length) {
      const ws = d.holders.filter((h) => !h.pool).slice(0, 10), share = ws.reduce((t, h) => t + h.share, 0);
      add("holders", "Top 10 holders", W.holders, clamp((share - 0.3) / 0.5, 0, 1), `The 10 largest wallets hold ${pct(share)} of supply (pools, burned and locked tokens left out${g && g.holder_count ? "; " + Number(g.holder_count).toLocaleString("en-US") + " holders" : ""}).`, { value: share });
    } else none("holders", "Top 10 holders", W.holders, "Holder list unavailable right now.");

    // 4 LP locked or burned
    const lps = g && Array.isArray(g.lp_holders) ? g.lp_holders : [];
    if (lps.length) {
      const locked = Math.min(1, lps.reduce((t, h) => t + (h.is_locked == 1 || BURN.test(h.address) ? (+h.percent || 0) : 0), 0));
      add("lp", "LP locked or burned", W.lp, clamp(1 - locked, 0, 1), `${pct(locked)} of the pool tokens are locked or burned (GoPlus).`, { value: locked * 100 });
    } else none("lp", "LP locked or burned", W.lp, g ? "No LP tokens to read: the pools hold positions (Uniswap v3/v4 style), not LP tokens." : "The contract check (GoPlus) did not answer.");

    // 5 mint function
    if (!g) none("mint", "Mint function", W.mint, "The contract check (GoPlus) did not answer.");
    else add("mint", "Mint function", W.mint, on("is_mintable") ? (owner ? 1 : 0.4) : 0,
      on("is_mintable") ? (owner ? `The contract can create new tokens and has an owner (${sh(owner)}).` : "The contract has a mint function, but ownership is renounced.") : "No mint function. The supply is fixed.");

    // 6 contract controls (the EVM counterpart of Token-2022 extensions)
    if (!g) none("extensions", "Contract controls", W.extensions, "The contract check (GoPlus) did not answer.");
    else {
      const f = []; let sev = 0; const hit = (k, s, text) => { if (on(k)) { sev = Math.max(sev, s); f.push(text); } };
      if (g.is_open_source === "0") { sev = 1; f.push("source code that is not verified"); }
      hit("hidden_owner", 1, "a hidden owner"); hit("can_take_back_ownership", 1, "ownership that can be taken back"); hit("selfdestruct", 1, "a self-destruct switch");
      hit("is_proxy", 0.7, "an upgradeable proxy (the code can be swapped)");
      if (owner) { hit("slippage_modifiable", 0.7, "a tax the owner can change"); hit("personal_slippage_modifiable", 0.7, "a tax set per wallet"); hit("external_call", 0.4, "calls out to other contracts"); }
      add("extensions", "Contract controls", W.extensions, sev, f.length ? "The contract has " + f.join(", ") + " (GoPlus)." : "Verified source, no hidden owner, no proxy, no tax switch (GoPlus).");
    }

    // 7 pool age
    if (pairs && pairs.length) {
      const created = Math.min.apply(null, pairs.map((p) => p.pairCreatedAt || Infinity));
      if (isFinite(created)) { const days = (Date.now() - created) / 864e5;
        add("age", "Pool age", W.age, clamp(1 - (days - 1) / 29, 0, 1), `Oldest pool is ${days < 1 ? Math.max(1, Math.round(days * 24)) + " hours" : Math.floor(days) + " days"} old.`, { value: days }); }
      else none("age", "Pool age", W.age, "Pool creation time unknown.");
    } else none("age", "Pool age", W.age, "No trading pool found.");

    // the creator's record, as GoPlus sees it (a warning, not a score: Kaelis keeps its own deployer record)
    if (on("honeypot_with_same_creator")) add("creator", "Creator's record", 0, 1, `The wallet that created this token (${sh(g.creator_address)}) created a honeypot before (GoPlus).`, { warn: true });
    // a company with no official token (see UNLISTED): a warning, never a hard flag
    const said = [d.meta && d.meta.name, d.meta && d.meta.symbol].concat((pairs || []).filter((p) => p.baseToken && String(p.baseToken.address).toLowerCase() === d.mint).slice(0, 1).map((p) => p.baseToken.name)).filter(Boolean).join(" ");
    const co = UNLISTED.find((u) => u.re.test(said));
    if (co) add("unlisted", "Not company stock", 0, 1, `Uses the name of ${co.name}, which has no official token. This is not ${co.name} stock and gives no claim on its shares. ${co.says}`, { warn: true });

    // 8 pause or blacklist (the EVM counterpart of freeze authority)
    if (!g) none("freeze", "Pause or blacklist", W.freeze, "The contract check (GoPlus) did not answer.");
    else { const p = on("transfer_pausable"), b = on("is_blacklisted"), what = [p && "pause all transfers", b && "blacklist wallets"].filter(Boolean).join(" and ");
      add("freeze", "Pause or blacklist", W.freeze, (p || b) && owner ? 1 : 0, what ? (owner ? `The owner can ${what}.` : `The contract can ${what}, but ownership is renounced.`) : "No pause switch and no blacklist."); }

    let score = checks.reduce((t, c) => t + (c.sev == null ? 0 : c.weight * c.sev), 0);
    const hard = checks.some((c) => c.hard);
    if (hard) score = Math.max(FLOOR, score);
    score = Math.round(Math.min(100, score));
    const band = score >= 70 ? "dangerous" : score >= 40 ? "suspicious" : "low";
    const unavailable = checks.filter((c) => c.sev == null).length, warned = checks.some((c) => c.warn);
    return { score, band, grade: grade(score, hard, unavailable, false, warned), hard, warned, gen: (genome && genome.gen) || 0, checks, unavailable, issuer: null, rugcheckRisks: [], chain: d.chain, rulesVersion: RULES_VERSION };
  }

  // opts.chain: "solana" (default for base58 addresses) or an EVM chain; a 0x address with no chain is looked up
  async function gather(mint, opts) {
    mint = String(mint || "").trim();
    const want = opts && opts.chain;
    if (isEvmAddress(mint)) {
      const chain = want && want !== "solana" ? want : await detectChain(mint, opts).catch(() => null);
      if (!chain || !CHAINS[chain] || !CHAINS[chain].goplus) throw new Error("This 0x address has no trading pool on Ethereum, BNB Chain, Base or Robinhood Chain. Pick the chain, or check the address.");
      return gatherEvm(mint.toLowerCase(), chain, makeClient(opts));
    }
    if (want && want !== "solana") throw new Error(`That is a Solana address, not a ${CHAINS[want] ? CHAINS[want].name : want} one.`);
    if (!isAddress(mint)) throw new Error("That doesn't look like a Solana address. Paste the token's mint address (32 to 44 characters).");
    const c = makeClient(opts);
    const [acc, supply, largest, dex, rug, jup, tok] = await Promise.allSettled([
      c.rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]),
      c.rpc("getTokenSupply", [mint]),
      c.rpc("getTokenLargestAccounts", [mint]),
      c.json("https://api.dexscreener.com/latest/dex/tokens/" + mint),
      c.json("https://api.rugcheck.xyz/v1/tokens/" + mint + "/report/summary"),
      sellTest(c, mint),
      // name and ticker from Jupiter's token list: known even when a token has no pool left (rules 1.4.0)
      c.json("https://lite-api.jup.ag/tokens/v2/search?query=" + mint),
    ]);
    if (acc.status === "rejected") throw new Error("Could not reach the Solana network. Try again in a moment.");
    const info = acc.value && acc.value.value;
    if (!info) throw new Error("No account found at this address.");
    const parsed = info.data && info.data.parsed;
    if (!parsed || parsed.type !== "mint") throw new Error("This address is not a token mint. Paste the token's mint address.");
    const d = { mint, program: info.owner, mintInfo: parsed.info, fetchedAt: new Date().toISOString() };
    d.supply = supply.status === "fulfilled" ? +supply.value.value.uiAmountString : null;
    d.slot = supply.status === "fulfilled" && supply.value.context ? supply.value.context.slot : null;
    d.largest = largest.status === "fulfilled" ? largest.value.value : null;
    d.pairs = dex.status === "fulfilled" ? ((dex.value && dex.value.pairs) || []).filter((p) => p.chainId === "solana") : null;
    d.rug = rug.status === "fulfilled" ? rug.value : null;
    d.jup = jup.status === "fulfilled" ? jup.value : null;
    const meta = tok.status === "fulfilled" && Array.isArray(tok.value) ? tok.value.find((x) => x && x.id === mint) : null;
    d.meta = meta ? { symbol: meta.symbol || null, name: meta.name || null } : null;
    if (d.largest && d.largest.length) {
      try {
        const top = d.largest.slice(0, 20);
        const accs = await c.rpc("getMultipleAccounts", [top.map((a) => a.address), { encoding: "jsonParsed" }]);
        const owners = accs.value.map((a) => a && a.data && a.data.parsed ? a.data.parsed.info.owner : null);
        const ownerAccs = await c.rpc("getMultipleAccounts", [owners.map((o) => o || SYSTEM), { encoding: "base64", dataSlice: { offset: 0, length: 0 } }]);
        const pairAddrs = new Set((d.pairs || []).map((p) => p.pairAddress));
        d.holders = top.map((a, i) => {
          const o = owners[i], oa = ownerAccs.value[i];
          // pool vaults belong to a known AMM authority, to the pair itself, or to a program-owned account (not a wallet)
          const pool = !o || POOL_OWNERS.has(o) || pairAddrs.has(o) || !!(oa && oa.owner !== SYSTEM);
          return { address: a.address, owner: o, amount: +a.uiAmountString, pool };
        });
      } catch (e) { d.holders = null; }
    }
    return d;
  }

  function extensionRisk(mintInfo) {
    const ext = mintInfo.extensions || [];
    const found = [];
    let sev = 0;
    ext.forEach((x) => {
      const s = x.state || {};
      switch (x.extension) {
        case "permanentDelegate": if (s.delegate) { sev = 1; found.push("a permanent delegate that can move or burn anyone's tokens"); } break;
        case "nonTransferable": sev = 1; found.push("tokens that cannot be transferred"); break;
        case "defaultAccountState": if (s.accountState === "frozen") { sev = 1; found.push("new accounts start frozen"); } break;
        case "transferHook": if (s.programId) { sev = Math.max(sev, 0.7); found.push("a transfer hook program that runs on every transfer"); } break;
        case "transferFeeConfig": {
          const bps = +((s.newerTransferFee && s.newerTransferFee.transferFeeBasisPoints) || (s.olderTransferFee && s.olderTransferFee.transferFeeBasisPoints) || 0);
          if (bps > 0) { sev = Math.max(sev, bps >= 500 ? 1 : bps >= 100 ? 0.5 : 0.2); found.push(`a ${(bps / 100).toFixed(2)}% fee on every transfer`); }
          break;
        }
        default: break;
      }
    });
    return { sev, found };
  }

  // genome (optional): the evolved rule set from the server, { gen, weights, hardFloor }. Gen 0 = WEIGHTS + 85.
  function evaluate(d, genome) {
    if (d.chain && d.chain !== "solana") return evaluateEvm(d, genome);
    const W = (genome && genome.weights) || WEIGHTS, checks = [];
    const FLOOR = (genome && genome.hardFloor) || 85;
    const add = (id, name, weight, sev, detail, extra) => checks.push(Object.assign({ id, name, weight, sev, detail }, extra || {}));
    const pairs = d.pairs;

    // 1 sell test (honeypot): Jupiter round trip first, trade history as backup
    const j = d.jup;
    let buys = null, sells = null;
    if (pairs && pairs.length) {
      buys = pairs.reduce((s, p) => s + ((p.txns && p.txns.h24 && p.txns.h24.buys) || 0), 0);
      sells = pairs.reduce((t, p) => t + ((p.txns && p.txns.h24 && p.txns.h24.sells) || 0), 0);
    }
    const noSellsHistory = buys != null && buys >= 20 && sells === 0;
    if (j && j.skipped) add("sell", "Sell test", W.sell, 0, "Native SOL, nothing to test.");
    else if (j && j.buyRoute && j.sellRoute === false) add("sell", "Sell test", W.sell, 1, "A buy route exists but selling back fails. This is how a honeypot behaves.", { hard: true });
    else if (j && j.buyRoute && j.sellRoute) {
      const loss = Math.max(0, j.loss);
      const sev = clamp((loss - 0.1) / 0.4, 0, 1);
      add("sell", "Sell test", W.sell, Math.max(sev, noSellsHistory ? 1 : 0), `Buying with 0.1 SOL and selling straight back returns ${pct(1 - loss)} of it (${pct(loss)} lost to fees, tax and price impact).` + (noSellsHistory ? ` Also ${buys} buys and 0 sells in 24h.` : ""), { hard: loss >= 0.5 || noSellsHistory });
    } else if (buys != null) {
      const why = j && j.unsure ? "Jupiter didn't answer the sell quote in time" : "No swap route to test";
      add("sell", "Sell test", W.sell, noSellsHistory ? 1 : 0, `${why}, so we used trade history: ${buys} buys and ${sells} sells in 24h.`, { hard: noSellsHistory });
    } else if (j && j.unsure) {
      add("sell", "Sell test", W.sell, null, "Jupiter didn't answer the sell quote in time and there is no trade history, so selling can't be tested right now.");
    } else add("sell", "Sell test", W.sell, null, "No swap route and no trading pool found, so selling can't be tested.");

    // 2 liquidity
    if (pairs && pairs.length) {
      const liq = pairs.reduce((t, p) => t + ((p.liquidity && p.liquidity.usd) || 0), 0);
      const sev = liq <= 0 ? 1 : clamp(1 - (Math.log10(liq) - Math.log10(5e3)) / (Math.log10(2.5e5) - Math.log10(5e3)), 0, 1);
      add("liquidity", "Liquidity depth", W.liquidity, sev, `${usd(liq)} in ${pairs.length} pool${pairs.length > 1 ? "s" : ""}.`, { value: liq });
    } else add("liquidity", "Liquidity depth", W.liquidity, null, "No trading pool found on DexScreener.");

    // 3 top holders
    if (d.holders && d.supply) {
      const wallets = d.holders.filter((h) => !h.pool).slice(0, 10);
      const share = wallets.reduce((t, h) => t + h.amount, 0) / d.supply;
      const nPool = d.holders.filter((h) => h.pool).length;
      add("holders", "Top 10 holders", W.holders, clamp((share - 0.3) / 0.5, 0, 1), `The 10 largest wallets hold ${pct(share)} of supply (${nPool} pool account${nPool === 1 ? "" : "s"} excluded).`, { value: share });
    } else add("holders", "Top 10 holders", W.holders, null, "Holder list unavailable right now.");

    // 4 LP lock (RugCheck)
    const r = d.rug || {};
    const lp = r.lpLockedPct != null ? +r.lpLockedPct : null;
    if (lp != null && !isNaN(lp)) add("lp", "LP locked or burned", W.lp, clamp(1 - lp / 100, 0, 1), `${lp.toFixed(0)}% of pool tokens are locked or burned (RugCheck).`, { value: lp });
    else add("lp", "LP locked or burned", W.lp, null, "RugCheck data unavailable right now.");

    // 5 mint authority
    const ma = d.mintInfo.mintAuthority;
    add("mint", "Mint authority", W.mint, ma ? 1 : 0, ma ? `Still set to ${ma.slice(0, 4)}…${ma.slice(-4)}, so new tokens can be created.` : "Revoked. No one can mint new tokens.");

    // 6 token-2022 extensions
    if (d.program === TOKEN_2022) {
      const x = extensionRisk(d.mintInfo);
      add("extensions", "Token extensions", W.extensions, x.sev, x.found.length ? "Token-2022 with " + x.found.join(", ") + "." : "Token-2022 with no risky extensions.");
    } else add("extensions", "Token extensions", W.extensions, 0, "Standard SPL token, no extensions.");

    // 7 pool age
    if (pairs && pairs.length) {
      const created = Math.min.apply(null, pairs.map((p) => p.pairCreatedAt || Infinity));
      if (isFinite(created)) {
        const days = (Date.now() - created) / 864e5;
        add("age", "Pool age", W.age, clamp(1 - (days - 1) / 29, 0, 1), `Oldest pool is ${days < 1 ? Math.max(1, Math.round(days * 24)) + " hours" : Math.floor(days) + " days"} old.`, { value: days });
      } else add("age", "Pool age", W.age, null, "Pool creation time unknown.");
    } else add("age", "Pool age", W.age, null, "No trading pool found.");

    // impersonation: a known stock ticker on a mint that is not the official one (weight 0, hard flag)
    const own = (pairs || []).filter((p) => p && p.baseToken && p.baseToken.address === d.mint).sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0))[0];
    // the ticker from the deepest pool, or from the token list when no pool is left (a copy whose pool was pulled is still a copy)
    const shown = own ? own.baseToken.symbol : d.meta && d.meta.symbol, tick = String(shown || "").toUpperCase();
    const known = KNOWN_ASSETS[tick];
    if (known && known.mint !== d.mint) add("impersonation", "Impersonation", 0, 1, `Uses the ${shown} ticker but is not the official ${known.name} (official mint ${known.mint.slice(0, 4)}…${known.mint.slice(-4)}). Treat it as a copy.`, { hard: true });
    // a company with no official token here (see UNLISTED): a warning, never a hard flag
    const said = [own && own.baseToken.name, own && own.baseToken.symbol, d.meta && d.meta.name, d.meta && d.meta.symbol].filter(Boolean).join(" ");
    const co = known ? null : UNLISTED.find((u) => u.re.test(said));
    if (co) add("unlisted", "Not company stock", 0, 1, `Uses the name of ${co.name}, which has no official token on Solana. This is not ${co.name} stock and gives no claim on its shares. ${co.says}`, { warn: true });
    if (known && known.mint === d.mint) add("impersonation", "Official asset", 0, 0, `The official ${known.name}. Issuer controls (mint, freeze, permanent delegate) are part of a regulated tokenized stock, and still a risk to know.`);

    // 8 freeze authority
    const fa = d.mintInfo.freezeAuthority;
    add("freeze", "Freeze authority", W.freeze, fa ? 1 : 0, fa ? "Set. The authority can freeze holders' tokens." : "Revoked. No one can freeze your tokens.");

    // official tokenized stock: issuer controls are reported apart and do not score (see ISSUER_CHECKS)
    const official = !!(known && known.mint === d.mint);
    if (official) for (const c of checks) if (ISSUER_CHECKS.includes(c.id)) { c.scope = "issuer"; c.weight = 0; }
    // the controls an issuer holds (LP lock and holder concentration stop scoring too, but they are not controls)
    const issuer = official ? { asset: known.name, controls: checks.filter((c) => ["mint", "freeze", "extensions"].includes(c.id) && c.sev > 0).map((c) => ({ id: c.id, name: c.name, detail: c.detail })),
      note: "Issued by a regulated issuer that keeps legal controls over the token. You are trusting the issuer, not the code. These controls are shown apart and do not add to the score." } : null;

    let score = checks.reduce((t, c) => t + (c.sev == null ? 0 : c.weight * c.sev), 0);
    const hard = checks.some((c) => c.hard);
    if (hard) score = Math.max(FLOOR, score);
    score = Math.round(Math.min(100, score));
    const band = score >= 70 ? "dangerous" : score >= 40 ? "suspicious" : "low";
    const extra = Array.isArray(r.risks) ? r.risks.map((k) => ({ name: k.name, level: k.level, description: k.description })) : [];
    const unavailable = checks.filter((c) => c.sev == null && c.scope !== "issuer").length;
    const warned = checks.some((c) => c.warn);
    return { score, band, grade: grade(score, hard, unavailable, official, warned), hard, warned, gen: (genome && genome.gen) || 0, checks, unavailable, issuer, rugcheckRisks: extra, rulesVersion: RULES_VERSION };
  }

  // Kaelis Rating: the score as a letter grade, like a credit rating. It grades risk, it is not buy or sell advice.
  // D is never given by a scan: it is only set when the Ledger confirms a rug after the fact.
  const GRADES = [[10, "AAA"], [20, "AA"], [30, "A"], [40, "BBB"], [55, "BB"], [70, "B"], [85, "CCC"], [101, "CC"]];
  const GRADE_TEXT = { AAA: "No known red flags", AA: "Very low risk flags", A: "Low risk flags", BBB: "Some flags, still low", BB: "Speculative", B: "Highly speculative", CCC: "High risk", CC: "Very high risk", D: "Rugged (confirmed)" };
  // a check we could not read caps the grade at A: the top grades need complete data.
  // An official tokenized stock is capped at A too: its issuer controls are a known flag (see ISSUER_CHECKS).
  // A warning (a token using the name of a company with no official token) caps it at BB.
  function grade(score, hard, unavailable, official, warned) {
    if (hard) return "CC";
    let g = "CC";
    for (const [lim, x] of GRADES) if (score < lim) { g = x; break; }
    if ((unavailable || official) && (g === "AAA" || g === "AA")) g = "A";
    if (warned && ["AAA", "AA", "A", "BBB"].includes(g)) g = "BB";
    return g;
  }

  const SAY = {
    sell: "Selling back is blocked or costs most of the money, which is how honeypots work.",
    impersonation: "It copies the ticker of a real tokenized stock but is not the official token.",
    unlisted: "It uses the name of a company that has no official token, so it is not that company's stock.",
    creator: "The wallet that launched it launched a honeypot before.",
    liquidity: "There is very little money in the pools, so prices can swing hard and exits can be costly.",
    holders: "A few wallets hold a large share of the supply.",
    lp: "Most pool tokens are not locked, so liquidity can be pulled.",
    mint: "Someone can still create new tokens.",
    extensions: "The token has built-in controls that can take, block or tax your tokens.",
    age: "The pool is very new.",
    freeze: "Someone can still freeze holders' tokens.",
  };
  function summary(d, r) {
    const hits = r.checks.filter((c) => c.sev != null && c.sev >= 0.5 && c.scope !== "issuer").sort((a, b) => b.weight * b.sev - a.weight * a.sev);
    const parts = hits.map((c) => SAY[c.id]).filter(Boolean);
    if (r.issuer) parts.unshift(`This is the official ${r.issuer.asset}. Its issuer keeps legal controls${r.issuer.controls.length ? " (" + r.issuer.controls.map((c) => c.name.toLowerCase()).join(", ") + ")" : ""}; they are listed apart and do not add to the score.`);
    if (!parts.length) parts.push("None of our checks found a known red flag.");
    parts.push(r.band === "low" ? "That is not a promise of safety." : r.band === "suspicious" ? "Read the evidence before you do anything." : "Treat this as high risk.");
    if (r.unavailable) parts.push(`${r.unavailable} check${r.unavailable > 1 ? "s were" : " was"} unavailable, so the score may be lower than the real risk.`);
    return parts.join(" ");
  }

  // Compact snapshot used by watch mode to spot a rug between two scans.
  function pulse(d) {
    const liq = (d.pairs || []).reduce((t, p) => t + ((p.liquidity && p.liquidity.usd) || 0), 0);
    return { liq, mintAuthority: d.mintInfo.mintAuthority || null, freezeAuthority: d.mintInfo.freezeAuthority || null, at: Date.now() };
  }
  function compare(before, now) {
    const alerts = [];
    if (before.liq > 1000 && now.liq < before.liq * 0.5) alerts.push(`Liquidity fell ${pct(1 - now.liq / before.liq)} (${usd(before.liq)} → ${usd(now.liq)}). This can be a rug pull.`);
    if (!before.mintAuthority && now.mintAuthority) alerts.push("Mint authority was turned back on.");
    if (!before.freezeAuthority && now.freezeAuthority) alerts.push("Freeze authority was turned back on.");
    return alerts;
  }

  // Deep scan: find who first funded each top wallet. Wallets funded by the same source
  // are likely one person (bundled or sniper buys). Fresh wallets (few txs, days old) add weight.
  // Costs about 2 RPC calls per wallet, so it runs after the main scan and is shown as evidence.
  async function linkWallets(d, opts) {
    const c = makeClient(opts);
    const wallets = (d.holders || []).filter((h) => !h.pool && h.owner).slice(0, opts && opts.max || 10);
    const supply = d.supply || 0;
    const out = await Promise.all(wallets.map(async (h) => {
      const w = { owner: h.owner, amount: h.amount, share: supply ? h.amount / supply : 0, funder: null, firstTx: null, firstAt: null, txCount: null, fresh: false };
      try {
        const sigs = await c.rpc("getSignaturesForAddress", [h.owner, { limit: 1000 }]);
        w.txCount = sigs.length;
        if (!sigs.length || sigs.length >= 1000) return w; // very active wallet, origin too far back
        const first = sigs[sigs.length - 1];
        w.firstTx = first.signature; w.firstAt = first.blockTime ? first.blockTime * 1000 : null;
        w.fresh = sigs.length < 50 && w.firstAt != null && Date.now() - w.firstAt < 7 * 864e5;
        const tx = await c.rpc("getTransaction", [first.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        const ixs = [];
        if (tx && tx.transaction) {
          ixs.push.apply(ixs, tx.transaction.message.instructions || []);
          (tx.meta && tx.meta.innerInstructions || []).forEach((g) => ixs.push.apply(ixs, g.instructions || []));
        }
        const fund = ixs.find((ix) => ix.parsed && ix.program === "system" && /transfer|createAccount/.test(ix.parsed.type) && ix.parsed.info && (ix.parsed.info.destination === h.owner || ix.parsed.info.newAccount === h.owner));
        if (fund) w.funder = fund.parsed.info.source;
        else if (tx && tx.transaction) { const keys = tx.transaction.message.accountKeys || []; const fp = keys.find((k) => k.signer); if (fp && (fp.pubkey || fp) !== h.owner) w.funder = fp.pubkey || fp; }
      } catch (e) { w.error = true; }
      return w;
    }));
    const groups = {};
    out.forEach((w) => { if (w.funder) (groups[w.funder] = groups[w.funder] || []).push(w); });
    const clusters = Object.keys(groups).filter((f) => groups[f].length >= 2).map((f) => ({ funder: f, wallets: groups[f], share: groups[f].reduce((t, w) => t + w.share, 0) })).sort((a, b) => b.share - a.share);
    const fresh = out.filter((w) => w.fresh);
    const linkedShare = clusters.reduce((t, k) => t + k.share, 0);
    const freshShare = fresh.reduce((t, w) => t + w.share, 0);
    const checked = out.filter((w) => !w.error).length;
    let level = "ok";
    if (linkedShare >= 0.2 || (clusters[0] && clusters[0].wallets.length >= 4)) level = "danger";
    else if (linkedShare >= 0.05 || freshShare >= 0.2) level = "warn";
    const lines = [];
    clusters.forEach((k) => lines.push(`${k.wallets.length} top wallets were first funded by ${k.funder.slice(0, 4)}…${k.funder.slice(-4)} and hold ${pct(k.share)} together.`));
    if (fresh.length) lines.push(`${fresh.length} top wallet${fresh.length > 1 ? "s are" : " is"} brand new (under 7 days, few transactions), holding ${pct(freshShare)}.`);
    if (!lines.length) lines.push(checked ? `No shared funding source found among ${checked} top wallets.` : "Wallet history unavailable right now.");
    return { wallets: out, clusters, fresh: fresh.length, linkedShare, freshShare, checked, level, lines };
  }

  return { RULES_VERSION, WEIGHTS, KNOWN_ASSETS, ISSUER_CHECKS, UNLISTED, CHAINS, EVM_CHAINS, isEvmAddress, detectChain, GRADE_TEXT, grade, isAddress, gather, evaluate, summary, pulse, compare, linkWallets, usd, pct };
});
