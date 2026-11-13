/*
 * Kaelis wallet gate: connect a Solana wallet before using the tools (the rooms, the scanner, the Gate, deployer lookups).
 * The public record (Ledger, Filings, Markets, Docs) and the API for agents stay open without a wallet.
 *
 * Connecting only reads the wallet's public address. Kaelis never asks for a signature, a transaction or a private key.
 * The address stays in this browser (localStorage); nothing is sent to the Kaelis server.
 *
 * Wallets are found through the Wallet Standard (Phantom, Solflare, Backpack and others register themselves),
 * with the older injected providers as a fallback. On a phone with no wallet in the browser, the dialog offers to open
 * this page inside the Phantom or Solflare app instead.
 *
 *   await KaelisWallet.require()   -> the address, or null if the person closed the dialog
 *   KaelisWallet.address           -> the connected address or null
 *   KaelisWallet.mountChip(el)     -> a "Connect wallet" / "8bft…s7j" button in a header
 *   KaelisWallet.onChange(fn)
 */
(function () {
  "use strict";
  const KEY = "kaelis.wallet";
  const found = [];          // { name, icon, connect(), disconnect() }
  const listeners = [];
  let state = load(), pending = null, ui = null;

  function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v.address === "string" ? v : null; } catch (e) { return null; } }
  function save(v) { state = v; try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} listeners.forEach((f) => { try { f(v ? v.address : null); } catch (e) {} }); }
  const short = (a) => a.slice(0, 4) + "…" + a.slice(-4);
  const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  // ---- discovery: Wallet Standard
  function addStandard(w) {
    try {
      if (!w || !w.features || !w.features["standard:connect"] || !(w.chains || []).some((c) => String(c).startsWith("solana:"))) return;
      if (found.some((x) => x.name === w.name)) return;
      found.push({
        name: w.name, icon: /^data:image\//.test(w.icon || "") ? w.icon : null,
        async connect() { const r = await w.features["standard:connect"].connect(); const a = (r && r.accounts && r.accounts[0]) || (w.accounts && w.accounts[0]); return a && a.address; },
        async disconnect() { const d = w.features["standard:disconnect"]; if (d) await d.disconnect(); },
      });
      if (ui) renderList();
    } catch (e) {}
  }
  const api = { register: (...ws) => { ws.forEach(addStandard); return () => {}; } };
  try { window.addEventListener("wallet-standard:register-wallet", (e) => { try { e.detail(api); } catch (x) {} }); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api })); } catch (e) {}

  // ---- discovery: older injected providers, only when the standard found nothing under that name
  function addLegacy() {
    const legacy = [["Phantom", window.phantom && window.phantom.solana], ["Solflare", window.solflare], ["Backpack", window.backpack]];
    for (const [name, p] of legacy) {
      if (!p || typeof p.connect !== "function" || found.some((x) => x.name === name)) continue;
      found.push({ name, icon: null,
        async connect() { const r = await p.connect(); const k = (r && r.publicKey) || p.publicKey; return k && k.toString(); },
        async disconnect() { if (typeof p.disconnect === "function") await p.disconnect(); } });
    }
  }

  // ---- the dialog
  const CSS = `
.kw-back{position:fixed;inset:0;z-index:1000;background:rgba(8,10,12,.55);backdrop-filter:blur(3px);display:grid;place-items:center;padding:16px}
.kw{width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#f2f0ea;color:#0b0b0c;border:1px solid #0b0b0c;box-shadow:0 30px 90px rgba(0,0,0,.35);padding:22px 22px 20px;display:grid;gap:14px;font:16px/1.45 "Inter Tight","Helvetica Neue",Arial,system-ui,sans-serif}
.kw .t{font:500 11px "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#5f5f5f;margin:0}
.kw h2{font-size:30px;line-height:1;letter-spacing:-.03em;font-weight:500;margin:0}
.kw p{margin:0;font-size:15px}
.kw .safe{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;font-size:14px;border-top:1px dashed #bdbab0;border-bottom:1px dashed #bdbab0;padding:10px 0}
.kw .safe i{font-style:normal;color:#2f8f5b;font-weight:700}
.kw .list{display:grid;gap:8px}
.kw .w{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:#fff;color:#0b0b0c;border:1px solid #0b0b0c;padding:12px 14px;font:500 16px "Inter Tight",Arial,sans-serif;cursor:pointer;text-decoration:none}
.kw .w:hover{background:#0b0b0c;color:#f2f0ea}
.kw .w:disabled{opacity:.6;cursor:wait}
.kw .w img,.kw .w .ph{width:28px;height:28px;flex:none;border-radius:6px;background:#e6e3da}
.kw .w small{margin-left:auto;font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;opacity:.65}
.kw .err{color:#c4452c;font-size:14px;min-height:0}
.kw .foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px;color:#5f5f5f}
.kw .foot a{color:inherit}
.kw .no{background:none;border:0;padding:6px 0;font:500 11px "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#0b0b0c;cursor:pointer;text-decoration:underline}
.kw button:focus-visible,.kw a:focus-visible{outline:2px solid #59e7ca;outline-offset:2px}
@media (prefers-reduced-motion:no-preference){.kw{animation:kwIn .22s cubic-bezier(.16,1,.3,1)}@keyframes kwIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}}`;
  const mobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

  function open() {
    if (ui) return;
    addLegacy();
    if (!document.getElementById("kw-css")) { const s = document.createElement("style"); s.id = "kw-css"; s.textContent = CSS; document.head.appendChild(s); }
    const back = document.createElement("div"); back.className = "kw-back";
    back.innerHTML = `<div class="kw" role="dialog" aria-modal="true" aria-labelledby="kw-h">
      <p class="t">Connect to try Kaelis</p>
      <h2 id="kw-h">Connect a Solana wallet.</h2>
      <p>The rooms, the scanner, the Gate and deployer lookups open once a wallet is connected.</p>
      <div class="safe"><i>✓</i><span>Kaelis only reads your public address.</span><i>✓</i><span>It never asks you to sign a transaction or move funds.</span><i>✓</i><span>The address stays in this browser.</span></div>
      <div class="list" id="kw-list"></div>
      <p class="err" id="kw-err" role="alert"></p>
      <div class="foot"><span>The <a href="ledger.html">Ledger</a> and the <a href="docs.html#api">API</a> stay open without a wallet.</span><button class="no" id="kw-no" type="button">Not now</button></div>
    </div>`;
    const prev = document.activeElement;
    ui = { back, prev };
    document.body.appendChild(back);
    back.addEventListener("click", (e) => { if (e.target === back) close(null); });
    back.querySelector("#kw-no").addEventListener("click", () => close(null));
    back.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(null); } });
    renderList();
    setTimeout(() => { if (ui) { addLegacy(); renderList(); } }, 600); // extensions that register a little late
  }
  function renderList() {
    if (!ui) return;
    const list = ui.back.querySelector("#kw-list");
    if (found.length) {
      list.innerHTML = found.map((w, i) => `<button class="w" type="button" data-i="${i}">${w.icon ? `<img alt="" src="${w.icon}">` : '<span class="ph"></span>'}<span>${esc(w.name)}</span><small>Detected</small></button>`).join("");
      list.querySelectorAll("button.w").forEach((b) => b.addEventListener("click", () => pick(found[+b.dataset.i], b)));
    } else if (mobile()) {
      const here = encodeURIComponent(location.href), ref = encodeURIComponent(location.origin);
      list.innerHTML = `<p>No wallet in this browser. Open Kaelis inside your wallet app:</p>
        <a class="w" href="https://phantom.app/ul/browse/${here}?ref=${ref}"><span class="ph"></span><span>Open in Phantom</span><small>App</small></a>
        <a class="w" href="https://solflare.com/ul/v1/browse/${here}?ref=${ref}"><span class="ph"></span><span>Open in Solflare</span><small>App</small></a>`;
    } else {
      list.innerHTML = `<p>No Solana wallet found in this browser. Install one, then reload this page:</p>
        <a class="w" href="https://phantom.com" target="_blank" rel="noopener"><span class="ph"></span><span>Phantom</span><small>Install ↗</small></a>
        <a class="w" href="https://solflare.com" target="_blank" rel="noopener"><span class="ph"></span><span>Solflare</span><small>Install ↗</small></a>
        <a class="w" href="https://backpack.app" target="_blank" rel="noopener"><span class="ph"></span><span>Backpack</span><small>Install ↗</small></a>`;
    }
    const first = list.querySelector(".w") || ui.back.querySelector("#kw-no");
    if (first && !ui.focused) { ui.focused = true; first.focus(); }
  }
  async function pick(w, btn) {
    const err = ui.back.querySelector("#kw-err"), label = btn.querySelector("span:not(.ph)");
    err.textContent = ""; btn.disabled = true; const was = label.textContent; label.textContent = "Connecting…";
    try {
      const address = await w.connect();
      if (!address || !B58.test(String(address))) throw new Error("no address");
      save({ address: String(address), wallet: w.name, at: new Date().toISOString() });
      close(String(address));
    } catch (e) {
      if (!ui) return;
      btn.disabled = false; label.textContent = was;
      err.textContent = `${w.name} did not connect. You may have closed it, or it is locked. Open the wallet and try again.`;
    }
  }
  function close(address) {
    if (!ui) return;
    const { back, prev } = ui; ui = null; back.remove();
    try { if (prev && prev.focus) prev.focus(); } catch (e) {}
    const p = pending; pending = null; if (p) p(address);
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- the header button
  function mountChip(el) {
    if (!el) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "pill kw-chip";
    const paint = () => { b.textContent = state ? "◉ " + short(state.address) : "Connect wallet"; b.title = state ? `Connected with ${state.wallet || "a wallet"}. Click to disconnect.` : "Connect a Solana wallet"; b.setAttribute("aria-label", state ? "Wallet " + state.address + ", click to disconnect" : "Connect wallet"); };
    b.addEventListener("click", async () => {
      if (!state) return window.KaelisWallet.require();
      if (!confirm("Disconnect " + short(state.address) + " from Kaelis on this browser?")) return;
      window.KaelisWallet.disconnect();
    });
    listeners.push(paint); paint(); el.appendChild(b);
  }

  window.KaelisWallet = {
    get address() { return state ? state.address : null; },
    require() {
      if (state) return Promise.resolve(state.address);
      if (pending) return new Promise((r) => { const p = pending; pending = (a) => { p(a); r(a); }; });
      return new Promise((r) => { pending = r; open(); });
    },
    disconnect() { const w = state && found.find((x) => x.name === state.wallet); if (w) w.disconnect().catch(() => {}); save(null); },
    mountChip,
    onChange(fn) { listeners.push(fn); },
  };
})();
