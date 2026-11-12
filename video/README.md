# Kaelis videos (Remotion)

Short videos for X, built with Remotion from the project's own 3D assets. Not part of the site build.

| Composition | Length | What it is |
| --- | --- | --- |
| `Intro` | 15 s | The K mark swaying, the one-liner, the two products |
| `Live` | 30 s | "Kaelis is live": the K, the corridor, the Assay Room, the Archive, the Gate, the close |

1920x1080, 30 fps, no sound (X plays muted, so every message is on screen). No web address in the picture.

## Assets (`public/`, not in git)

- `lab.glb`, `hall.glb`, `staff-*.glb` and the baked atlases `lab_shell.webp`, `lab_furn.webp`, `hall_shell.webp`:
  copy them from `site/models` and `site/media`.
- `k/k0000.jpg` ... `k0095.jpg`: the swaying K, rendered in Blender Cycles:
  `blender -b -P tools/3d/logo_k_spin.py -- video/public/k 96 1920 1080`

## Render

```bash
cd video
npm install
npx remotion render src/index.jsx Intro out/kaelis-intro-15s.mp4 --gl=angle --crf=17
npx remotion render src/index.jsx Live  out/kaelis-live-30s.mp4  --gl=angle --crf=17 --concurrency=4
npx remotion studio src/index.jsx   # to preview and edit
```

One rule that cost a debugging round: do not wrap the 3D children in your own `<Suspense>`. `ThreeCanvas`
already holds the render until models and textures are loaded; a second boundary swallows that and frames come out empty.

Remotion is free for individuals and small teams; check its licence if the team grows.
