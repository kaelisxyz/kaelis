# Assets: sources and licenses

| Asset | Where | Source | License |
|---|---|---|---|
| Kaelis core model | `site/models/kaelis.glb` | Made for Kaelis, `tools/3d/kaelis_models.py` | Project-owned |
| Hammer of light model | `site/models/hammer.glb` | Made for Kaelis, `tools/3d/kaelis_models.py` | Project-owned |
| Studio HDRI (preview renders only, not shipped) | `tools/3d/assets/studio_small_09_1k.hdr` | https://polyhaven.com/a/studio_small_09 | CC0 |
| City env map + normal maps | `site/textures/` | Earlier work, listed as CC0 in DESIGN_NOTES | CC0 |
| Ghost sheet models (four characters) | `site/models/ghost-*.glb` | Made for Kaelis, `tools/3d/ghost_cloth.py` (Blender cloth solver) | Project-owned |
| Clean lab room | `site/models/lab.glb`, `site/media/lab_shell.webp`, `site/media/lab_furn.webp` | Made for Kaelis in Blender, light baked by `tools/3d/bake_lab.py` | Project-owned |
| Fire extinguisher (baked into `lab_furn.webp`) | Clean lab | Poly Haven, UM JOORIN, https://polyhaven.com/a/korean_fire_extinguisher_01 | CC0 |
| Notepads (baked into `lab_furn.webp`) | Clean lab | Poly Haven, Ulan Cabanilla, https://polyhaven.com/a/office_notepads | CC0 |
| Style studies (not shipped, not in git) | `tools/3d/work/` | Poly Haven textures and furniture | CC0 |
| Clean corridor | `site/models/hall.glb`, `site/media/hall_shell.webp` | Made for Kaelis in Blender, light baked by `tools/3d/bake_hall.py` | Project-owned |
| Staff characters (four) | `site/models/staff-*.glb` | Made for Kaelis, `tools/3d/suit_staff.py` (Blender cloth solver) | Project-owned |
| K camera shots for the videos (not in git) | `video/public/kshots/` | Made for Kaelis, `tools/3d/video_k.py` (Blender Cycles) | Project-owned |
| Video narration | `video/public/audio/*.wav` (not in git) | Kokoro-82M text-to-speech, voice `am_michael`, run locally by `video/audio/make_vo.mjs` | Apache-2.0 model; output is ours |
| Video score and sound effects | `video/public/audio/*.wav` (not in git) | Synthesised in code, `video/audio/make_mix.mjs` and `dsp.mjs`. No samples or loops | Project-owned |
