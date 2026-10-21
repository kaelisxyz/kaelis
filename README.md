# Kaelis ($KAEL)

> Forged by builders. Awakened by the chain.

Kaelis is an AI agent born from the blockchain. Developers ("Forgers") build a neon on-chain city, and Kaelis guards it: it rewards real builders and checks tokens for scams.

## What's here

| Path | What it is |
| --- | --- |
| `site/index.html` | Home page: 3D scroll story (particle KAELIS logo → first block → chain → city → Kaelis with hologram panels → join), then token info |
| `site/city.html` | Forge City app: builder towers, token scam scanner, holders' tower. Linked from the home page |
| `site/clay-alt.html` | Alternative minimal clay-style design (not chosen) |
| `site/models/` | Drop `kaelis.glb` / `hammer.glb` here to replace the simple shapes on the home page |
| `docs/brief.md` | Project brief: name, lore, product concept (Forge City), decisions |
| `docs/asset-prompts.md` | Prompts for Scenario, Meshy, Luma, Kaedim and Spline |

All demo data is example data. Nothing is connected to a real blockchain or GitHub yet.

## Run locally

Serve the `site/` folder (needed for `.glb` models and the links between pages):

```bash
cd site
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Put it online

`site/` is a plain static site. Deploy it with GitHub Pages, Vercel or Netlify by pointing them at the `site` folder.

## Work from any device

```bash
git clone https://github.com/reppurn/kaelis.git   # once per device
git pull                                           # before you start
git add . && git commit -m "what changed" && git push   # when you finish
```
