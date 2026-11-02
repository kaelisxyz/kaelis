---
name: crypto-web-pro
description: Build crypto coin / token / DeFi / meme / AI-narrative / 3D-tech websites that look hand-designed by a top studio, not AI-generated, with brand-level UI, UX, motion, and a secure backend. Use this skill whenever the user mentions a coin, token, memecoin, DeFi, launchpad, tokenomics, landing page for a crypto project, Web3 site, 3D or animated crypto website, GSAP, Three.js, scroll animation, wallet connect, or asks to "make it look premium / catchy / like a big brand", even if they never say "crypto skill". Also use for the backend side of these sites: database, API keys, price feeds, rate limiting, deploy.
---

# Crypto Web Pro

Goal: every site feels like a specific brand with one memorable idea, runs smoothly on a phone, converts visitors (buy / join / connect), and is safe on the backend.

Default stack unless the brief says otherwise: Node.js + React + Vite, GSAP (+ ScrollTrigger), Lenis, Three.js or React Three Fiber for 3D, Tailwind or CSS variables for tokens. Read `knowledge.md` and `brief.md` in the project first if they exist; the brief's words always win over this file.

---

## 1. Workflow (always follow in order)

1. **Capture the brief**: coin name, ticker, chain, narrative (meme / AI / DeFi / gaming / RWA / infra / privacy), audience, primary action (buy, join community, connect wallet, mint), links (X, Telegram, DEX, contract address). If something is missing, propose an assumption in one line and continue.
2. **Design plan before code** (keep it short):
   - Color: 4–6 named hex values (base, surface, text, one accent, one support, one warning/positive).
   - Type: 1–2 families and their roles, plus a type scale.
   - Layout concept: one sentence + a small ASCII wireframe of the hero and one other section.
   - The one memorable thing: the single hero idea (an interactive 3D object, a giant type treatment, a live chart, a mascot, a scroll-driven story).
3. **Self-review the plan**: if any choice is what you would pick for *any* crypto site, change it and say what changed.
4. **Build in layers**: layout and type first, then content, then UI states, then motion, then 3D, then backend. Never all at once.
5. **Critique**: check against sections 2 and 12. Cut one decoration before finishing.

---

## 2. Anti-AI checklist (the tells to avoid)

Avoid unless the brief explicitly asks:
- Purple-to-blue gradient on near-black with glassmorphism cards. This is the #1 "AI crypto site" look.
- Neon glow on everything, grid/dot background by default, floating random coins and 3D blobs with no meaning.
- Identical rounded cards in a 3-column grid with the same shadow for every feature.
- Fade-and-slide-up on every section and hover-lift on every card.
- All-caps tracked eyebrow label above every heading, numbered 01/02/03 when content is not a sequence, `→` on every button.
- Accenting one word of every headline in a gradient or italic.
- Font defaults: Inter, Roboto, Space Grotesk, Poppins on everything.
- Copy like "Revolutionizing the future of decentralized finance", "Join the revolution", "Next-gen", "Seamless".
- Stock 3D icons, generic emoji bullets, fake stats ("10,000+ holders") that are not real.

Instead: one strong concept, restrained palette, specific copy, real assets, and one orchestrated motion moment.

---

## 3. Art direction by narrative type

Pick direction from the coin's world, not from a template.

| Type | Direction ideas |
|---|---|
| Meme | Character-led, loud and playful, custom illustration or mascot, chunky type, sticker/collage energy, sound or easter eggs. Humor in the copy. Still clean, not messy. |
| AI / agent | Calm and precise: lots of space, fine type, data-viz or terminal-like moments, subtle generative visuals (shader, particles reacting to cursor). Avoid sci-fi cliché glowing brain. |
| DeFi / finance | Trust first: clear numbers, readable tables, sober palette, strong hierarchy, real-time stats, audit and security badges. Motion minimal and informative. |
| Tech / infra / L2 | Technical editorial feel: diagrams, architecture visuals, code snippets, benchmark charts, monospace used with purpose. |
| Gaming / metaverse | Cinematic: full-bleed art, 3D scenes, trailer-style hero, character or world lore. |
| RWA / institutional | Brand-finance feel: serif or refined sans, muted palette, photography, documents and partners. |
| Privacy / dark | Stark contrast, minimal UI, cipher/redaction motifs, restrained motion. |

Always define: mood in 3 words, 2 references (existing sites or art), and what to deliberately *not* do.

---

## 4. Typography

- Type carries the personality. Use one family or two clearly distinct ones. Choose deliberately (examples to explore: Satoshi, General Sans, Clash Display, Cabinet Grotesk, Instrument Serif, Fraunces, Syne, Geist, JetBrains Mono for data). Self-host or use Fontsource; keep to 2 weights per family where possible.
- Set a real scale (e.g. 1.25 or 1.333 ratio), headline `clamp()` sizing, tight tracking on big display type, line-height ~1.05–1.15 for display, 1.5–1.7 for body.
- Hero type can be the visual: oversized, cropped, masked, outlined, or animated per line. Make it an active part of the design.
- Line length under ~70–80 characters. Left-align body text; center only short statements.
- Numbers (price, market cap, supply) use tabular figures (`font-variant-numeric: tabular-nums`).

---

## 5. Layout, color, and visual structure

- Use a deliberate grid and break it on purpose in one or two places. Vary section rhythm: full-bleed, split, sticky, horizontal scroll, oversized type. No stack of identical sections.
- Space is a feature: generous padding, consistent spacing scale (4/8 base).
- Color: one dominant base, one accent used sparingly for action and focus, neutrals with slight tint from the palette. Check contrast (WCAG AA for text).
- Radius, border, and shadow follow hierarchy, not one value for everything. Avoid decoration that encodes nothing; borders, dividers, and labels should carry information.
- Backgrounds: texture, grain, photography, or a single shader field beat generic gradients. Keep text areas calm.

---

## 6. Motion and interaction

Principle: motion explains or rewards. Spend it in one place.

- **One orchestrated moment**: a page-load sequence, a hero reveal, or a scroll-driven story. Everything else stays quiet.
- Tools: GSAP + ScrollTrigger for scroll and timelines, Lenis for smooth scroll (sync with ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)` and the GSAP ticker), SplitText-style line/word reveals, Framer Motion for React component transitions.
- Use custom easing (e.g. `power3.out`, `expo.out`, custom cubic-bezier), consistent durations (0.4–0.9s), and stagger with intent.
- Interactions that answer the user: magnetic buttons, cursor states over interactive items, expanding panels, copy-to-clipboard confirmation, number tick-up on live stats.
- Always: `prefers-reduced-motion` fallback, kill/cleanup tweens and ScrollTriggers on unmount, animate `transform` and `opacity` only, avoid layout thrash.
- Preloader only if assets are heavy; make it short, branded, and skippable by fast load.

---

## 7. 3D and shaders (Three.js / R3F)

- 3D must serve the narrative (the coin, mascot, device, world). No random floating shapes.
- Models: glTF/GLB compressed (Draco/Meshopt, KTX2 textures), under ~2–3 MB for the hero. Source from Blender or Spline; bake lighting where possible.
- Performance: cap DPR (`Math.min(devicePixelRatio, 2)`), lazy-load the canvas, pause rendering when off-screen, reuse geometries/materials, limit lights and post-processing.
- Post-processing used lightly (bloom, grain, chromatic aberration) and disabled on low-end/mobile.
- Provide a **static fallback image/video** for mobile, low power, no-WebGL, and reduced-motion.
- Scroll-linked 3D: tie camera or model state to scroll progress with GSAP; keep the scene readable at every scroll position.
- Shaders: start with simple GLSL (noise, gradient flow, distortion, particles). Document uniforms; expose cursor and time.
- **After Effects, Blender, Lottie, pre-rendered video, GLB export and compression**: read `references/motion-3d-pipeline.md` before planning or specifying any such asset. Rule of thumb: pre-render what does not need to be interactive, keep real-time only what must react to the user.

---

## 8. UI components specific to crypto sites

Design each as a branded component, not a default card.

- **Hero**: coin name/ticker, one-line hook, primary CTA (Buy / Chart), secondary CTA (Community), contract address with copy button, chain badge.
- **Contract address (CA)**: truncated display, one-click copy with clear confirmation, link to explorer. Never hide it.
- **Buy button/flow**: direct links to the DEX (Jupiter, Raydium, Uniswap, etc.) with a short "how to buy" in 3 steps.
- **Live stats**: price, market cap, 24h volume, holders from a real API; skeleton loading; "last updated" time; graceful failure state.
- **Tokenomics**: simple chart or visual (donut, bar, or custom), exact numbers, vesting and lock details, burn/tax info if any.
- **Roadmap**: only as a sequence if it is truly a sequence; otherwise phases with outcomes.
- **Community**: X, Telegram, Discord, with real activity (latest posts or counts via backend), memes gallery, or holder wall.
- **Wallet connect**: wagmi/viem (EVM) or Solana wallet adapter; clear connected, wrong-network, and error states.
- **Trust section**: audits, contract verified, liquidity lock, team (if public), disclaimers.
- **Footer**: legal disclaimer ("not financial advice"), links, copyright.

States to design for every interactive element: default, hover, focus-visible, active, loading, empty, error, success, disabled.

---

## 9. UX principles

- One primary action per screen. The user should know within 5 seconds what the coin is, why it is interesting, and how to buy or join.
- Hierarchy: headline → proof → action. Put the key CTA in the hero and repeat at the end and in a sticky nav on scroll.
- **Mobile first**: most crypto traffic comes from phones and in-app browsers (X, Telegram). Test at 360–430px width, thumb-reachable CTAs, no horizontal scroll, no hover-only features.
- Speed is UX: target LCP under ~2.5s, lazy-load below-the-fold media, optimize images (AVIF/WebP), subset fonts.
- Feedback for every action (copy, connect, submit). Errors say what happened and how to fix it.
- Navigation: short, anchor-based for one-pagers; clear active state.
- Accessibility floor: keyboard focus visible, semantic HTML, alt text, sufficient contrast, reduced-motion respected.
- Trust and honesty: no fake numbers or fake "live" data; label placeholders clearly during development.

---

## 10. Copywriting

- Specific over clever. Say what the coin is, what it does or stands for, and what to do next.
- Voice matches the narrative (meme = playful and short, DeFi = precise and calm, AI = clear and confident).
- Sentence case, active voice, plain verbs. CTAs name the action ("Buy $TICKER", "Open chart", "Join Telegram").
- Cut filler words and buzzwords. Every element does one job.
- Keep the same names for the same things across the whole site.

---

## 11. Backend, database, and security

**Secrets and API keys**
- Never put keys in frontend code or git. Use `.env` locally (in `.gitignore`) and environment variables in production. Provide `.env.example` with placeholder names only.
- Any call that uses a secret key goes through the backend or a serverless function. Frontend only calls your own endpoints.
- Separate dev/prod keys, restrict by domain/IP/permissions where supported, rotate if exposed.
- Never store or request private keys or seed phrases. Wallet actions are signed in the user's wallet.

**API design**
- Node.js with Express/Fastify or Next.js/Vercel/Cloudflare functions. Validate all input (Zod), return consistent error shapes, use proper status codes.
- Add **rate limiting** and bot protection (Cloudflare Turnstile or similar) on public endpoints and forms (whitelist, airdrop, contact).
- CORS: allow only your own origins.
- Cache third-party data (Redis/Upstash, in-memory TTL, or edge cache) so price/market calls do not exceed provider limits; serve stale data with a timestamp if the provider fails.

**Database**
- Default to Postgres (Supabase or Neon) with Prisma or Drizzle; NoSQL only if the data shape needs it.
- Design tables with primary keys, foreign keys, indexes on lookup columns, `created_at`/`updated_at`.
- Enable Row Level Security (Supabase) and write explicit policies. Use the service role key only on the server.
- Migrations tracked in the repo; seed script for dev; backups enabled in production.

**Crypto data sources**
- Prices/markets: CoinGecko, DexScreener, Birdeye, Jupiter; on-chain/RPC: Helius, Alchemy, QuickNode. Prefer polling with caching; use WebSocket only if truly needed.
- Verify wallet ownership with signed messages (SIWE / Solana sign-in), never trust client-supplied addresses.

**Ops**
- Deploy on Vercel/Netlify/Railway/Cloudflare with preview deployments; CDN for assets; Cloudflare for DNS and basic DDoS protection.
- Error tracking (Sentry), uptime check, and structured logs without secrets.
- Security headers (CSP, HSTS), dependency audit (`npm audit`), lockfile committed.

---

## 12. Quality gate before delivering

Run through this list and fix failures:

- [ ] Hero shows the one memorable idea and the primary CTA without scrolling (mobile and desktop).
- [ ] No item from the Anti-AI checklist remains unless requested.
- [ ] Palette ≤ 6 colors, one accent, AA contrast.
- [ ] Fonts chosen deliberately, scale consistent, no layout shift from font loading.
- [ ] Only one major orchestrated motion; reduced-motion supported; no jank (60fps target).
- [ ] 3D has a fallback and is capped for performance.
- [ ] CA copy, buy links, socials all work; every interactive state designed.
- [ ] No secrets in the client bundle or repo; endpoints validated and rate-limited; RLS on.
- [ ] Responsive 360px to 1920px, no horizontal scroll, keyboard navigable.
- [ ] Lighthouse: performance and accessibility in the 90s where feasible.
- [ ] Copy is specific, consistent, and free of buzzwords; disclaimer present.

---

## 13. How to work with the user

- Ask for or propose references (links, screenshots) early; visual input beats adjectives.
- State assumptions in one line, then build; do not interrogate.
- Deliver in layers and name what you will do next, so the user can steer before heavy work (3D, backend).
- When updating an existing project, change only what was asked and keep the established design tokens.
- Keep a short `DESIGN_NOTES.md` in the project: tokens, fonts, motion rules, decisions, so later sessions stay consistent and prompts stay short.
