# Kaelis design notes

Short reference so later sessions stay consistent. The brief in `docs/brief.md` wins over this file.
Guideline skill: `docs/skills/crypto-web-pro/SKILL.md`.

## Tokens
- Base `#0b0a10`, surface `#15131a`, text `#f2eef0`, muted `#9a94a3`
- Accent (ember) `#ff8a3d`, support (signal) `#8fe3ff`, warn `#ffc24a`, danger `#ff4d5e`
- Type: Space Mono for UI labels and numbers (tabular), Syne / system sans for headings

## Home page (site/index.html), since 2026-11-04
- Look modelled on sutera.ch (user asked for it): white paper, faint 4-column drafting grid with + crosshairs, black ink type.
- Fonts: Inter Tight (big statements, uppercase hero), JetBrains Mono (tiny uppercase labels), Bitter 300 + Bruno Ace in blueprint mode.
- Cards are "windows": black title bar with label and close box, 1px border, chamfered bottom-right corner. Buttons are outline pills.
- "Change reality" toggle in the header flips html[data-reality] between real (ink on paper, realistic 3D) and blueprint (cobalt #344DBB, 3D eases to blue line art and a blue ground grid). Remembered in localStorage.
- Accents: ember #E88150, mint #59E7CA. The 3D story keeps its beats; additive glow is gone (it vanishes on white).
- Forge City (embedded at the end) stays the dark twilight city.

## Forge City (site/city.html), v2 since 2026-11-08
- Rebuilt from a reference video the user picked (neon plaza with towers, step inside to see a robot at a desk). The old twilight city is in `archive/city-v1.html`.
- three r170 modules + bloom (UnrealBloom, separate settings for plaza and room) + ACES tone mapping. The paper rule only applies to the home page.
- Plaza: indigo-to-violet sky, stars, grid floor, light rings, outer rail with running lights, grid wall arc, scattered low blocks. Centre: ribbed glowing dome, Kaelis core (kaelis.glb) floating above, eye follows the pointer.
- Four towers = four Kaelis jobs, each with its own colour, light beam, crown ring and a floating HTML label:
  Scanner #59e7ca (live), Holders #ffc24a (live after launch), Builders #ff8a4d (example data, labelled), Watch #9d8bff (re-checks the last scanned token every 60s).
- Tap a tower or a dock button: the camera flies in, fades, and you are inside a room: grid stage, panoramic night-skyline window, wall clock (real time), desk, three canvas monitors with live data, keyboard, red action button, mug, gaming chair with a light strip, and the robot.
- Robot = Kaelis at work: white shell, dark visor with one mint eye ring, glowing ear rings, antenna with an ember tip. It types, scans between monitors, slams the red button when an action runs and raises its arms on a result.
- The red button / panel action is real: Scanner runs the real scan (server if /api/health answers, else in the browser), and the result feeds the monitors, the tower label and Watch.
- `?tower=scanner|holders|builders|watch` opens a tower directly. Esc or "Back to city" leaves.
- Phones: bottom-sheet panel, wider camera, room camera aims low so the robot sits above the sheet.
- Motion layer (`FX` section in city.html, all off with prefers-reduced-motion):
  plaza: intro swoop + towers rising one by one + beams igniting; shockwave ring from the core every 6s (risk colour after a scan);
  data packets arcing tower <-> Kaelis; Kaelis orbit rings + sweeping scanner cone with a floor spot; shooting stars;
  a $KAEL blimp circling with a scrolling neon banner; window flicker; hover lifts a tower; warp (FOV) on the fly-in.
  room: keyboard data particles, mug steam, monitor glitch while scanning, antenna blink, spinning holo coin with symbol + score;
  safe result -> robot spins 360 in the chair and cheers; dangerous (>= 70) -> red siren cone + alarm light + robot panics.
- Home page: hammer strikes throw a burst of ember sparks (gravity), blue in blueprint mode.
- Proof-of-Build is live (lib/build.js, api/builders.js): wallet signature (ed25519) + code in GitHub bio/gist, weekly merged PRs with anti-cheat rules, points ledger in KAELIS_DATA_DIR.

## Rules
- Home page: keep the white paper look (no tone mapping there).
- Push only with the Kaelis account from `.env.personal` via `scripts/push.sh`. Never use the reppurn account or any global login.

## Real 3D models (since 2026-11-08)
- `site/models/kaelis.glb` (Kaelis core) and `site/models/hammer.glb` (hammer of light) replace the simple shapes on the home page.
- Built by script, not by hand: `tools/3d/kaelis_models.py` (Blender 4.0, headless). Edit the script, then rebuild:
  `blender -b -P tools/3d/kaelis_models.py` then `gltf-transform quantize tools/3d/<name>.src.glb site/models/<name>.glb`.
- Kaelis: gunmetal sphere split into face plate + body, mint glow seam, one eye (steel bezel, dark glass lens, mint iris, pupil, 6 hex screws). Eye faces +Z (site expects it).
- Hammer: forged steel head with chamfers, polished striking faces, ember glow grooves, dark lacquered shaft, leather grip wraps.
- Glowing parts have a near-black base colour so the emission stays pure colour; the site caps emissiveIntensity at 1.15 (no tone mapping).
- Metals carry a tileable wear map (roughness noise + smudges) as a 512px metallicRoughness texture (`wear_map()` in the script).
- Lighting for the models: a generated studio env map (softbox panels, no file) in `studioEnv()`; glowing parts get envMapIntensity 0.15.
- Blueprint mode: model materials lerp to cobalt and switch to wireframe (`tintModel`). Hammer fades with the scroll like before.
- Compression: `gltf-transform webp` then `gltf-transform meshopt` (decoder wired in the loader). kaelis.glb ~330 KB, hammer.glb ~100 KB.
- Kaelis is fitted to 3.1 units; when the model loads the wireframe cage drops to 13% and the ring to 40%.

## three.js r170 on the home page (since 2026-11-08)
- `site/index.html` loads three 0.170.0 as ES modules (importmap). `city.html` and `clay-alt.html` are still r128.
- Colour management on, output sRGB, NO tone mapping (paper must stay white). Canvas colour maps are tagged sRGB (`srgb()`).
- Lights are physical: r128 values x PI (`LK`); point lights use decay 0.5 and `LKP = PI * 1.6` to approximate the old 40-unit linear falloff.
- Fog density 0.009 (was 0.016): fog now mixes in linear light and whitened the ink letters at the old value.
- Block emission is glow * 0.1 (was 0.25), glass envMapIntensity 0.55 (was 1.4): the sRGB output lifts small values.
- The RGBE env PNG is unpacked by hand into a float DataTexture (three removed RGBEEncoding).
- Before/after screenshots of all six beats matched closely after these calibrations.

## Guide film (site/film.html → site/media/kaelis-agent.mp4)
- 48 s real-time three.js film, same look as Forge City (ACES + bloom, kaelis.glb, hammer.glb). Story: Read → 8 checks (real weights) → score 85 with hard flag → AI explains, score locked → builders (hammer, tower grows) → holders (windows light) → "Scan before you ape."
- Every frame is a pure function of `t` (`window.__seek(t)`), so it renders frame-perfect. Example token only, address is random base58.
- Re-render: run the server on :5173, then `node tools/film/capture.js <framesDir> out.mp4` (needs playwright-core + ffmpeg-static on NODE_PATH), then re-encode with `-crf 26 -maxrate 3M` into site/media/. Poster = frame at 27 s.
- No audio track yet.

## Home = Forge City, one screen (2026-11-11)
- The home page (site/index.html) is Forge City itself: no scroll. Everything a degen needs is on the first screen: the paper sheet (name, one line, Generation / Calls / By patrol / IQ, a one-line ticker of real Ledger calls, Scan a token, Buy at launch, links to Evolution / Ledger / Docs) and the building directory at the bottom (the four towers with live status).
- Old scroll story kept at archive/index-story.html. city.html and guide.html redirect to index.html and docs.html.
- All explanations of the tech live in site/docs.html (overview, video, use it, evolution, rating + ledger, under the hood, MCP, full details, $KAEL).
- Look: a real night city, not a neon render. Black-blue sky with a low warm sodium haze, few stars, warm tungsten + cool office windows with whole floors on or off, concrete and glass towers, stone paving, traffic lights on the ring (white heads, red tails), red aviation lights on the tower tops. Tower colours only as a thin LED crown band, a faint beam and the 3 px bar on its tag. Bloom is low (0.34).
- UI: paper (#f2f0ea) and ink (#0b0b0c), hard edges, folded corner on the sheet, no glass blur, no glow, no accent-coloured headline words. Text on paper uses ink-dark versions of the tower colours.
- Colour only means something: risk colour appears after a scan, the idle pulse is faint warm white.
- Pro pass (2026-11-11): procedural PBR facades in three kinds (glass curtain wall, concrete office, residential with balconies), each one canvas pass for albedo + lit windows + roughness, world-space UVs so every building shares 8 materials and the skyline is merged into ~12 draw calls. Street grid rotated 0.32 rad: low-rise ring where the camera orbits (max 6 units tall inside r 74/84), tall skyline beyond. Podiums with shop fronts, setbacks, parapets, rooftop tanks and HVAC, red aviation lights blinking together. Wet asphalt with puddle roughness map, granite plaza tiles, ring road with lane paint, sodium street lamps with soft pools, cars as head/tail lights in two lanes. Sky shader with slow fbm clouds lit from below. City reflections: a CubeCamera bake (bakeCityEnv) after build. AgX tone mapping (exposure 1.15), MSAA in the composer, vignette + fine grain pass. Old file kept in the scratchpad as index.before-pro.html.
