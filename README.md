# Kaelis ($KAEL)

> Forged by builders. Awakened by the chain.

Kaelis is an AI agent born from the blockchain. Developers ("Forgers") build a neon on-chain city, and Kaelis guards it: it rewards real builders and checks tokens for scams.

## What's here

| Path | What it is |
| --- | --- |
| `site/index.html` | Home page: 3D scroll story (particle KAELIS logo → first block → chain → city → Kaelis with hologram panels → join), then token info |
| `site/city.html` | Forge City: neon plaza with four towers (Scanner, Holders, Builders, Watch). Step inside a tower to see Kaelis at its desk; the Scanner tower runs real scans |
| `site/scan.html` | **Live** token scanner: sell test, 8 checks, wallet links, watch mode |
| `site/tower.html` | **Live** holder tower: one window per $KAEL holder (switches on with `kaelMint`) |
| `site/guide.html` | How to use Kaelis, plus the full tech details |
| `site/js/kaelis-core.js` | The rules engine. One file used by the site and the API |
| `site/js/kaelis-config.js` | The one file to edit at launch (`kaelMint`) |
| `api/` | API handlers: `/api/scan`, `/api/holders`, `/api/health`, `/api/builders` (Proof-of-Build: leaderboard, register, refresh) and `/mcp` (MCP server for AI agents) |
| `server.js` | Node server that serves `site/` and the API (Railway runs it) |
| `tests/` | `npm test`, runs offline with mocked data |
| `site/clay-alt.html` | Alternative minimal clay-style design (not chosen) |
| `site/models/` | Drop `kaelis.glb` / `hammer.glb` here to replace the simple shapes on the home page |
| `docs/brief.md` | Project brief: name, lore, product concept (Forge City), decisions |
| `docs/asset-prompts.md` | Prompts for Scenario, Meshy, Luma, Kaedim and Spline |

The scanner and the holder tower read real Solana data. Forge City and Proof-of-Build still use example data.

## Run locally

Serve the `site/` folder (needed for `.glb` models and the links between pages):

```bash
cd site
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Put it online (Railway)

`server.js` serves `site/` and the API (`/api/scan`, `/api/holders`, `/api/health`) from one Node process. No extra packages besides the Anthropic SDK.

1. railway.com > New Project > Deploy from GitHub repo > `kaelisxyz/kaelis`. Railway runs `npm install` and `npm start` (see `railway.json`).
2. Variables tab, all optional (see `.env.example`):
   - `HELIUS_RPC_URL`: private Solana RPC from helius.dev (free tier). Faster scans and the full holder list.
   - `ANTHROPIC_API_KEY`: turns on the AI explanation. `KAELIS_MODEL` picks the model.
   - `KAEL_MINT`: the $KAEL mint after launch.
   - `SCAN_RATE_PER_MIN`: scans per minute per visitor (default 20).
3. Settings > Networking > Generate Domain (or add your own domain).
4. Open `/api/health` to see which parts are on. Every push to `main` redeploys.
5. AI agents connect to `https://<your domain>/mcp` (MCP over HTTP). Tools: `check_before_buy`, `scan_token`.

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
