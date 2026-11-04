# Kaelis ($KAEL)

> Forged by builders. Awakened by the chain.

Kaelis is an AI agent born from the blockchain. Developers ("Forgers") build a neon on-chain city, and Kaelis guards it: it rewards real builders and checks tokens for scams.

## What's here

| Path | What it is |
| --- | --- |
| `site/index.html` | Home page: 3D scroll story (particle KAELIS logo → first block → chain → city → Kaelis with hologram panels → join), then token info |
| `site/city.html` | Forge City app: builder towers, token scam scanner, holders' tower. Linked from the home page |
| `site/scan.html` | **Live** token scanner: sell test, 8 checks, wallet links, watch mode |
| `site/tower.html` | **Live** holder tower: one window per $KAEL holder (switches on with `kaelMint`) |
| `site/guide.html` | How to use Kaelis, plus the full tech details |
| `site/js/kaelis-core.js` | The rules engine. One file used by the site and the API |
| `site/js/kaelis-config.js` | The one file to edit at launch (`kaelMint`) |
| `api/` | Vercel functions: `/api/scan`, `/api/holders`, `/api/health` |
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

## Put it online (Vercel, free)

1. Import this repo on vercel.com. Framework: Other. Leave build settings empty; `vercel.json` already serves `site/` and the `api/` functions.
2. Optional keys in Project > Settings > Environment Variables (see `.env.example`):
   - `HELIUS_RPC_URL`: private Solana RPC from helius.dev (free tier). Faster scans and the full holder list.
   - `ANTHROPIC_API_KEY`: turns on the AI explanation (console.anthropic.com). `KAELIS_MODEL` picks the model.
   - `KAEL_MINT`: the $KAEL mint after launch.
3. Open `/api/health` to see which parts are on.

Without any key the site still works: the scanner runs in the visitor's browser on free public data. After launch, also put the mint in `site/js/kaelis-config.js` (`kaelMint`).

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
