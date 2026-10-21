# Kaelis ($KAEL)

> Forged by builders. Awakened by the chain.

Kaelis is an AI agent born from the blockchain. Developers ("Forgers") build a neon on-chain city, and Kaelis guards it: it rewards real builders and checks tokens for scams.

## What's here

| Path | What it is |
| --- | --- |
| `demos/forge-scroll.html` | Main 3D scroll-story website (6 scenes: chaos → first block → chain → city → Kaelis → join) |
| `demos/forge-city.html` | Interactive 3D "Forge City" product demo: builder towers, token scam scanner, holders' tower |
| `demos/clay-alt.html` | Alternative minimal clay-style design (not chosen) |
| `demos/models/` | Drop `kaelis.glb` / `hammer.glb` here to replace the simple shapes in `forge-scroll.html` |
| `docs/brief.md` | Project brief: name, lore, product concept (Forge City), decisions |
| `docs/asset-prompts.md` | Prompts for Scenario, Meshy, Luma, Kaedim and Spline |

All demo data is example data. Nothing is connected to a real blockchain or GitHub yet.

## Run locally

Open any file in `demos/` in a browser, or serve the folder so `.glb` models can load:

```bash
cd demos
python3 -m http.server 8000
# then open http://localhost:8000/forge-scroll.html
```

## Work from any device

```bash
git clone https://github.com/reppurn/kaelis.git   # once per device
git pull                                           # before you start
git add . && git commit -m "what changed" && git push   # when you finish
```
