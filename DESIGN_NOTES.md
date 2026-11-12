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

## Kaelis Labs: one tower, an old laboratory in oil paint (2026-11-12)
- The user's direction: scanners are common, so nothing on the surface says "scan". Kaelis is a laboratory; a token is a specimen that gets tested. Dark only (reference: "Old Laboratory" clip for the look, the virtual-lab walkthrough clip only for the corridor and camera glide).
- City: one amber-lit masonry tower (Kaelis Labs) on the central plinth, Kaelis floating above the crown. The five job towers are gone. Card: "Something is being tested inside." + Enter + CA. No room names outside.
- Inside (all in site/index.html): corridor scene `hall` with four doors (I The Assay Room = scanner, II The Archive = watch + filings, III The Exchange = markets, IV The Workshop = builders). Holders become the tower's windows (not built yet).
- Assay Room: robot at the desk, specimen tank (liquid level rises during a test, colour = verdict, holo ring readout), shelf of sealed specimens. Greeting: first visit the robot works ~2 s, turns, says "You brought something?", then the panel opens; click skips; later visits are short (localStorage `kaelis.met`).
- Oil paint = Kuwahara ShaderPass (`paint`) + canvas weave, enabled only inside; pixel ratio drops to 1 inside to pay for it. HTML text stays crisp.
- Colour rule inside: amber and brass only; mint is Kaelis's eye; green / yellow / red appear only as a verdict.
- Rooms II–IV still use the old desk-and-monitors content with the new names; they get their own interiors next.

## Ghost staff and the lit intro (2026-11-12)
- The robot is gone. Each room has its own sheet ghost (`GHOSTS`, `dressGhost`, `swayGhost` in site/index.html): The Assayer (bone white, mint eyes, brass goggles), The Archivist (parchment, hood, hand lantern, floats by the shelf), The Broker (top hat, monocle, bow tie, floats by the board), The Smith (soot and ember, leather apron, visor). Same rig as before (`robot` object), so typing, cheer, alarm and greeting still work. No chair.
- Ghosts outside the Assay Room turn to the visitor and say one line.
- Intro: camera arcs in over the skyline (never top-down); the tower lights up via `fx.glow`; brass plaza rings and two searchlights from the crown.

## Cloth ghosts, warm transitions, the walk in (2026-11-12, later)
- Ghost sheet = real cloth: tools/3d/ghost_cloth.py drapes a round sheet over a mannequin with the Blender cloth solver, bakes AO into vertex colours, exports site/models/ghost.glb (meshopt, 0.5 MB, 83k tris). The model is quantized, so the shader converts to metres with `uQ`/`uS`.
- In the shader (`sheet.onBeforeCompile`): eyes and mouth are cut per pixel, the hem frays through `alphaHash` using the flat-cloth UVs, a rim light in the room colour, sway on the hanging part only. Arms no longer animate; the whole sheet turns, bobs and rises on a cheer.
- No black between places: `.fade` is a warm light wash. Corridor doors hinge (`doorPiv`), open into the room with a bright slab behind, the camera walks up, steps through, and walks into the room with a footstep bob (`hc.walk`).
- Corridor is first person (`walk`, `updateHall`): W/S or arrows, mouse wheel, or the on-screen pad move along the hall; the mouse looks left and right; the door you stand at and look at lights up and opens with a click or E. Leaving a room puts you back at its door.

## Clean lab (2026-11-12, direction change)
- The user picked a bright, clean modern lab (style 7 of ten Blender studies) over the old dark laboratory. Everything is to be brought to this tone; characters stay non-robot and realistic.
- Room = `site/models/lab.glb` + `site/media/lab_shell.webp`, `lab_furn.webp`: built in Blender through the Blender MCP (`tools/3d/work/clean_lab.blend`, not in git), lighting baked with Cycles by `tools/3d/bake_lab.py` (combined bake, 4K atlas per group, stored at 0.6x, `LAB_GAIN` restores it). Drawn with MeshBasicMaterial; hemisphere + key light only for moving things.
- Site coordinates kept: bench top y 0.845 (x -1.5..1.5, z -1.55..-0.5), tank bay at (-2.15, 0, -1.55), specimen shelf boards at y 3.26 - row*0.56, z -3.18, back wall z -3.3, side walls x +-5.5, front wall z 5.2.
- The old hand-built stage, desk and plank wall are hidden (not deleted) after the legacy block. Oil-paint pass is now only on in the corridor.
- Still in the old style: corridor, tank, slate board, ghost costumes (hood, top hat). Tower version A (old brick) is cancelled.
- Later the same day everything was brought to the clean tone: corridor = `site/models/hall.glb` + `site/media/hall_shell.webp` (baked by `tools/3d/bake_hall.py`; the old plank shell, pipes and lamps are hidden after the hall block, doors/windows/signs recoloured to white and steel), tank in white enamel and steel with a cool-blue idle colour (#7fd6ff) and an ink readout, Exchange board with a dark bezel, tower and plaza in cool white light, scene changes pass through white light, oil-paint pass off everywhere.
- Open: ghost costumes are still the old ones (hood, top hat); the user wants distinct realistic characters, possibly from Sketchfab (needs their API token in the BlenderMCP panel).
- Four ghost characters, each its own cloth simulation (`tools/3d/ghost_cloth.py -- assayer|archivist|broker|smith`, models `site/models/ghost-*.glb`, loaded when the room is first entered): Assayer tall and thin with safety goggles and an ID badge; Archivist short and hunched with reading glasses and a clipboard; Broker with one arm raised, a headset and a tie; Smith broad, dark cloth, welding goggles pushed up. Head centre, head scale and cloth radius per character live in `GHOSTS` (`uHead`, `uEdge`).
- Bug pass (2026-11-12, evening): everything indoors is preloaded (`waitFor`, `preload`, `warm`: textures uploaded with `renderer.initTexture`, shaders compiled with `compileAsync`) and the transitions wait for `warm` behind the white wash, so no black frame or stutter on entering. Indoor lens is fixed at 54 deg in `setScene` (it used to depend on the path taken). The room camera is bounded by the walls (controls `change` clamp) instead of `maxDistance`, which had been pulling the camera into the bench. Archivist and Broker float in the aisle behind the bench. Tank readout ring is single sided; the ghost hem is a ragged cut, not a dithered fade.
- Staff replace the ghosts (user asked for realistic non-robot characters, face covered, built without Sketchfab): `tools/3d/suit_staff.py -- assayer|archivist|broker|smith` makes a body from simple masses, a larger suit simulated as cloth over it, hard gear on top, AO in vertex colours, exported as `site/models/staff-*.glb`. Assayer = white hazmat with a dark dome and back blower; Archivist = slim blue cleanroom suit, goggles, mask, clipboard; Broker = dark suit, collar and tie, glass bubble helmet; Smith = broad tan coat, welding helmet, tool belt. They stand (`GHOSTS[id].at`, `.h`), breathe and turn; no limb animation. Ghost sheets and their code stay as a fallback (`robot.head` hidden). `room.environment` (RoomEnvironment) gives the glass its reflections.
- Tower is now a white lab block (white piers and slabs, one ribbon window per floor lit cool white via `mat`/`fx.glow`, mint lines, mint crown, KAELIS LABS signs on the podium, pale plinth). The city stays dark.
- Black box on the home view (reported on live, 2026-11-12): two causes. (1) The tower group still started at scale.y 0.001 from the old rise intro, and the intro waited for the API; on a slow API the flattened tower rendered as a black block. Now the tower is always full height and `intro()` starts before any fetch. (2) `pow()` of a slightly negative interpolated uv in the beam and searchlight shaders gave NaN pixels, which the bloom blur smeared into flickering black rectangles (34 of 70 sampled frames on a phone viewport). Every `pow` base in a shader is clamped now. Rule: never write `pow(x, n)` in a shader without clamping x to >= 0.
- The name KAELIS LABS is off the tower, the tag (now just Enter) and the blimp, at the user request. Roof beam is a thin mint thread.
