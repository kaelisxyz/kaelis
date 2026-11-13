# Kaelis

> The trust layer for onchain tokens: verifiable ratings for the wallets that launch tokens, and a pre-trade safety check for AI agents, on Solana, Ethereum, BNB Chain, Base and Robinhood Chain. Proof, not vibes.

Kaelis tests new Solana tokens around the clock, records who launched each one and who funded that wallet, and seals every call in a hash-chained ledger that is written to Solana once a day and graded 7 days later, misses included. Agents and apps read it through an MCP server and a small REST API. Live at https://kaelis.si.

$KAEL is not launched. The track record comes first.

## What's here

| Path | What it is |
| --- | --- |
| `site/index.html` | Home: a white lab tower in a night city. Inside, a corridor and four rooms: the Assay Room (test a token), the Archive (the Ledger as a shelf), the Gate (the agent check, live) and the Workshop (Proof-of-Build) |
| `site/deployer.html` | Deployer reputation: look up a wallet or a token, see its tested tokens, outcomes, funder and cluster |
| `site/ledger.html` | The Ledger: every call, the chain check, and accuracy with every wrong call listed |
| `site/filings.html` | Filings: insider sales, liquidity pulled, authority switched back on |
| `site/docs.html` | Docs: how it works, deployer reputation, the agent safety API |
| `site/scan.html` | The full token check: sell test, 8 checks, wallet links, watch mode |
| `site/markets.html`, `site/evolution.html` | Supporting pages: tokenized stocks and the K-20 benchmark, and the nightly rule evolution |
| `site/js/kaelis-core.js` | The rules engine. One file used by the site and the API. **MIT licensed** |
| `lib/` | Ledger, deployers, filings, anchor, genome, markets, Patrol (the autonomous loop) |
| `api/` | Handlers: `/api/scan`, `/api/deployer`, `/api/deployers`, `/api/ledger`, `/api/filings`, `/api/anchors`, `/api/health`, `/api/builders`, and `/mcp` |
| `server.js` | Node server that serves `site/` and the API (Railway runs it) |
| `tests/` | `npm test`, runs offline with mocked data |
| `tools/3d/` | Blender scripts that build the lab, the corridor, the staff and the logo |

## For agents

`POST /mcp` (MCP over HTTP, JSON-RPC). Tools: `check_before_buy` (decision `allow`, `warn` or `block`, with reasons, the deployer's record and the hash of the sealed Ledger call), `deployer_reputation`, `scan_token`. Free while in beta, 30 calls a minute per IP, no key. Details: https://kaelis.si/docs.html#api

## Licence

The rules engine, `site/js/kaelis-core.js`, is open source under the MIT licence (`site/js/LICENSE`), so anyone can reproduce a score. The rest of this repository is public to read but is not licensed for reuse.

## Run locally

Serve the `site/` folder (needed for `.glb` models and the links between pages):

```bash
cd site
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Put it online (Railway)

`server.js` serves `site/` and the API from one Node process. No extra packages besides the Anthropic SDK.

1. railway.com > New Project > Deploy from GitHub repo > `kaelisxyz/kaelis`. Railway runs `npm install` and `npm start` (see `railway.json`).
2. Variables tab, all optional (see `.env.example`):
   - `HELIUS_RPC_URL`: private Solana RPC from helius.dev (free tier). Faster scans and the full holder list.
   - `ANTHROPIC_API_KEY`: turns on the AI explanation. `KAELIS_MODEL` picks the model.
   - `KAEL_MINT`: the $KAEL mint after launch.
   - `SCAN_RATE_PER_MIN`: scans per minute per visitor (default 20).
3. Settings > Networking > Generate Domain (or add your own domain).
4. Open `/api/health` to see which parts are on. Every push to `main` redeploys.
5. AI agents connect to `https://<your domain>/mcp` (MCP over HTTP). Tools: `check_before_buy`, `deployer_reputation`, `scan_token`.

Run the same server locally: `npm install && npm start`, then open http://localhost:3000.

Without any key the site still works: the scanner runs in the visitor's browser on free public data. After launch, also put the mint in `site/js/kaelis-config.js` (`kaelMint`). `vercel.json` is kept in case you ever move to Vercel.

## Test

```bash
npm install
npm test
```

## Work from any device

```bash
git clone https://github.com/kaelisxyz/kaelis.git   # once per device
git pull                                           # before you start
git add . && git commit -m "what changed" && git push   # when you finish
```
