# Kaelis design notes

Short reference so later sessions stay consistent. The brief in `docs/brief.md` wins over this file.
Guideline skill: `docs/skills/crypto-web-pro/SKILL.md`.

## Tokens
- Base `#0b0a10`, surface `#15131a`, text `#f2eef0`, muted `#9a94a3`
- Accent (ember) `#ff8a3d`, support (signal) `#8fe3ff`, warn `#ffc24a`, danger `#ff4d5e`
- Type: Space Mono for UI labels and numbers (tabular), Syne / system sans for headings

## Forge City (site/city.html)
- Look: twilight CGI city. Sky gradient navy to teal with a warm horizon band; environment map dimmed to 29% so it never lights the scene.
- Lights: one key light (moon, blue-white, low and lateral) with shadows, weak hemisphere fill, Kaelis point light with a tight 12-unit falloff. Street lamps are sprites and ground pools, not real lights.
- Post: SSAO (desktop only) -> UnrealBloom (threshold 0.86) -> manual ACES + sRGB pass. The composer renders off-screen, so tone mapping must be done in that last pass.
- Buildings: plain textured walls (concrete / brick / curtain wall) with real geometry: hollow extruded window frames, dark reflective panes, lit panes (MeshBasicMaterial, per-instance colour), sills, pilasters, floor ledges. All instanced per building. `dressFacade(...).update(h)` hides floors above the current height.
- Street level: glowing shopfront, sign, awning, light spill, fire escape, trees, benches, bins, hydrants, cars (looping), people (strolling).
- One orchestrated motion each: build = crane + scaffold + floors rising with sparks; demolition = shudder, dust, debris, red flash, sink.
- Textures (site/textures, all CC0): blue-hour graded HDRI used ONLY as envMap on glass (lighting the whole scene with it washes the city out); normal maps on concrete/brick/glass walls and asphalt.
- Mobile: no SSAO, wider FOV, panels stack. Everything is demo data; never promise profits.

## Rules
- Do not add a distant skyline ring (user removed it on purpose).
- Keep the city dark; brightness comes from windows, shops and lamps, not from ambient light.
- Push only to `reppurn/kaelis`. Never touch `reppurn/repurrn`.
