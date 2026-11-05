# Kaelis technology (v0.4 spec)

Status: the scanner (rules v1.1.0) and the holder tower are built and run on real Solana data. Proof-of-Build and Forge City still run on example data. Nothing here is financial advice. Kaelis reports risk. It never predicts or promises profit.

## 1. Principles

- **Two public sources.** Kaelis reads the Solana chain and GitHub. It never asks for private data, custody or trading permissions.
- **Rules decide, the model explains.** Every score comes from deterministic, open-source rules. A language model receives the evidence and writes a plain-language summary. It cannot change a number.
- **Replayable.** Every input is stored with its block height and timestamp. Anyone can re-run a score with the published rule version and must get the same result.
- **Evidence first.** Every flag links to the transactions or accounts that prove it.

## 2. Kaelis Core pipeline

```
Solana RPC / indexer ─┐
                      ├─> 01 Ingest ─> 02 Signals ─> 03 Score ─> 04 Explain ─┬─> Forge City
GitHub API / webhooks ┘                                                     ├─> Watch-mode alerts on the site
                                                                            └─> On-chain attestation
```

| Stage | Job | Notes |
|---|---|---|
| 01 Ingest | Webhooks and an indexer turn chain and GitHub activity into events | Events are processed in the order they happened and stored in an append-only Postgres log |
| 02 Signals | Deterministic checks return a severity from 0 to 1 plus evidence | Pure functions of the stored inputs |
| 03 Score | Weighted sum of signals, plus hard flags | Rule set is versioned; every score records the version |
| 04 Explain | LLM writes the summary from the evidence | Read-only; output is checked to contain no numbers that differ from the score |

## 3. Scam scanner (live, rules v1.1.0)

Code: `site/js/kaelis-core.js`. The same file runs in the browser (`scan.html`) and in the API (`api/scan.js`), so both always give the same score.

Input: a token mint address. Output: a score from 0 to 100, a band, evidence per check, extra RugCheck flags, wallet links and a summary.

| Check | Weight | Severity rule |
|---|---|---|
| Sell test | 25, hard flag | Jupiter quote: buy with 0.1 SOL, then quote selling it all back. No sell route, or a loss of 50% or more, is a hard flag. Severity is linear from 10% to 50% loss. With no route at all, 24h trade history is used (20+ buys and 0 sells is a hard flag). |
| Liquidity depth | 15 | Full risk under $5k in pools, none above $250k, log scale (DexScreener) |
| Top 10 holders | 15 | Share of supply in the 10 largest wallets, pool vaults excluded. Linear from 30% to 80% |
| LP locked or burned | 15 | Share of pool tokens not locked (RugCheck) |
| Mint authority | 10 | 1 if set |
| Token extensions | 10 | Token-2022: permanent delegate, non-transferable or frozen-by-default 1; transfer hook 0.7; transfer fee 1 at 5%+, 0.5 at 1%+, else 0.2 |
| Pool age | 5 | Full risk under 1 day, none after 30 days |
| Freeze authority | 5 | 1 if set |

- Score = sum of weight × severity, capped at 100. Weights add up to 100. A check that can't be read counts as unavailable and adds nothing; the summary says so.
- Hard flag: a failed or very lossy sell forces the score to at least 85.
- Bands: 0–39 low risk, 40–69 suspicious, 70–100 dangerous.
- A low score means no known red flag was found. It is not a promise of safety.

**Wallet links (deep scan, evidence only).** For the 10 largest non-pool wallets, Kaelis reads each wallet's oldest transaction and the SOL transfer that funded it. Wallets with the same funder form a cluster. 20%+ of supply in clusters, or a cluster of 4+ wallets, is flagged as danger; 5%+ or brand-new wallets (under 7 days, under 50 transactions) holding 20%+ is a warning. Every wallet links to its funding transaction. Not scored yet; planned for rules v1.2 after real-token testing.

**Watch mode.** On the scan page, "Watch this token" re-scans every 60 seconds while the tab is open and alerts when liquidity drops over 50%, when mint or freeze authority is turned back on, or when the score moves 10+ points.

**AI explanation.** With `ANTHROPIC_API_KEY` set, the API sends the checks to Claude, which writes 3–5 plain sentences. Every number in the answer must already appear in the evidence; otherwise the answer is dropped and the rule-written summary is shown.

## 4. Proof-of-Build

1. **Link.** Read-only GitHub OAuth plus a wallet-signed message. One GitHub account maps to one wallet.
2. **Verify.** Only commits in public repos count, and only once they reach the default branch or a merged pull request. Forks, generated files, vendored code and copy-paste commits are filtered.
3. **Score the weekly epoch.** Build points come from merged changes (with a diff-size cap), review activity and outside usage of the repo, such as other contributors and dependents. A daily cap blocks farming with tiny commits.
4. **Attest and reward.** A hash of the epoch results is posted on-chain. Builders claim their share of the Proof-of-Build pool with a Merkle proof. Each verified epoch adds a floor to their tower.

Anti-cheat: minimum account age, repos with outside contributors, rate limits, anomaly checks on commit patterns, and manual review for the top earners of each epoch.

## 5. Holder light

- An indexer snapshots every $KAEL token account every few minutes.
- Wallets under a minimum balance are ignored, so empty wallets cannot light windows.
- Window position: holders are ordered by wallet address, so each wallet keeps its spot while the holder set is stable (live in `tower.html`). It stays stable between visits.
- Selling everything turns the window off at the next snapshot.
- Planned: big holders get a house in the holder district, shown by size tier, never by name.

## 6. Interfaces

- **Forge City:** a Three.js view of the public state (builders, scanned tokens, holders).
- **Scanner page:** `scan.html`, works without any account or key.
- **Holder tower:** `tower.html`, one window per $KAEL holder, plus a wallet lookup.
- **API (server.js on Railway):** `GET /api/scan?mint=` (score, checks, evidence, wallet links, AI explanation, rule version, slot), `GET /api/holders?mint=` (holder list), `GET /api/health` (which keys are switched on).

## 7. Roadmap (no dates promised)

| Phase | Scope |
|---|---|
| Now | Scanner beta live on the site: sell test, wallet links, watch mode, AI explanation (with key) |
| 1 | Real-token testing, wallet links added to the score (rules v1.2) |
| 2 | Proof-of-Build beta: linking, weekly epochs, towers from real commits |
| 3 | $KAEL launch: live holder windows, reward pool, on-chain attestations |
| 4 | Open risk API and SDK for wallets and apps |

## 8. Open questions

- The chain is assumed to be Solana because the scanner checks mint and freeze authorities. Confirm before building.
- The sell simulation needs a funded simulation wallet or an RPC with transaction simulation. Pick a provider.
- Proof-of-Build reward size per epoch depends on final tokenomics. The current numbers are examples.
