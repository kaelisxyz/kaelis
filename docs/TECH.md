# Kaelis technology (v0.3 spec)

Status: plan plus demo. The website and Forge City run on example data. Nothing here is live yet, and nothing here is financial advice. Kaelis reports risk. It never predicts or promises profit.

## 1. Principles

- **Two public sources.** Kaelis reads the Solana chain and GitHub. It never asks for private data, custody or trading permissions.
- **Rules decide, the model explains.** Every score comes from deterministic, open-source rules. A language model receives the evidence and writes a plain-language summary. It cannot change a number.
- **Replayable.** Every input is stored with its block height and timestamp. Anyone can re-run a score with the published rule version and must get the same result.
- **Evidence first.** Every flag links to the transactions or accounts that prove it.

## 2. Kaelis Core pipeline

```
Solana RPC / indexer ─┐
                      ├─> 01 Ingest ─> 02 Signals ─> 03 Score ─> 04 Explain ─┬─> Forge City
GitHub API / webhooks ┘                                                     ├─> Alerts (Telegram, X)
                                                                            └─> On-chain attestation
```

| Stage | Job | Notes |
|---|---|---|
| 01 Ingest | Webhooks and an indexer turn chain and GitHub activity into events | Events are processed in the order they happened and stored in an append-only Postgres log |
| 02 Signals | Deterministic checks return a severity from 0 to 1 plus evidence | Pure functions of the stored inputs |
| 03 Score | Weighted sum of signals, plus hard flags | Rule set is versioned; every score records the version |
| 04 Explain | LLM writes the summary from the evidence | Read-only; output is checked to contain no numbers that differ from the score |

## 3. Scam scanner

Input: a token mint address or ticker. Output: a score from 0 to 100, a band, evidence per flag and a summary.

| Check | Weight | Severity rule |
|---|---|---|
| Sell simulation fails (honeypot) | 25, hard flag | Simulated sell of a small amount reverts or loses over 50% to tax |
| Liquidity not locked or burned | 20 | Share of LP tokens not in a lock or burn address |
| Developer holds over 20% of supply | 15 | Linear from 10% to 40% of supply in creator-linked wallets |
| Developer launched rugged tokens before | 15 | Prior tokens from the creator wallet or its funders that lost over 90% of liquidity in one transaction |
| Mint authority active | 10 | 1 if the mint authority is set, else 0 |
| Holders funded from one wallet | 10 | Share of top-100 holders whose first SOL came from the same source within a short window |
| Freeze authority active | 5 | 1 if the freeze authority is set, else 0 |

- Score = sum of weight × severity, capped at 100. Weights add up to 100.
- Hard flag: a failed sell forces the score to at least 85.
- Bands: 0–39 low risk, 40–69 suspicious, 70–100 dangerous.
- A low score means no known red flag was found. It is not a promise of safety.

**Watch mode.** Scanned tokens are re-checked on new events. A rug is declared when over half of the pool liquidity leaves in one transaction, or when creator-linked wallets sell over half their balance within an hour. In Forge City the building collapses into the Scam Graveyard.

## 4. Proof-of-Build

1. **Link.** Read-only GitHub OAuth plus a wallet-signed message. One GitHub account maps to one wallet.
2. **Verify.** Only commits in public repos count, and only once they reach the default branch or a merged pull request. Forks, generated files, vendored code and copy-paste commits are filtered.
3. **Score the weekly epoch.** Build points come from merged changes (with a diff-size cap), review activity and outside usage of the repo, such as other contributors and dependents. A daily cap blocks farming with tiny commits.
4. **Attest and reward.** A hash of the epoch results is posted on-chain. Builders claim their share of the Proof-of-Build pool with a Merkle proof. Each verified epoch adds a floor to their tower.

Anti-cheat: minimum account age, repos with outside contributors, rate limits, anomaly checks on commit patterns, and manual review for the top earners of each epoch.

## 5. Holder light

- An indexer snapshots every $KAEL token account every few minutes.
- Wallets under a minimum balance are ignored, so empty wallets cannot light windows.
- Window position = hash(wallet address) mod window count, with linear probing on collisions. It stays stable between visits.
- Selling everything turns the window off at the next snapshot.
- Planned: big holders get a house in the holder district, shown by size tier, never by name.

## 6. Interfaces

- **Forge City:** a Three.js view of the public state (builders, scanned tokens, holders).
- **Bot:** Telegram and X. Reply with a token address and get the score, band and evidence.
- **Public API:** `GET /v1/score/{mint}` returns score, band, flags, evidence links, rule version and block height.

## 7. Roadmap (no dates promised)

| Phase | Scope |
|---|---|
| Now | Story site and Forge City demo with example data |
| 1 | Scanner beta: free bot for 20–50 testers, rules published on GitHub |
| 2 | Proof-of-Build beta: linking, weekly epochs, towers from real commits |
| 3 | $KAEL launch: live holder windows, reward pool, on-chain attestations |
| 4 | Open risk API and SDK for wallets and apps |

## 8. Open questions

- The chain is assumed to be Solana because the scanner checks mint and freeze authorities. Confirm before building.
- The sell simulation needs a funded simulation wallet or an RPC with transaction simulation. Pick a provider.
- Proof-of-Build reward size per epoch depends on final tokenomics. The current numbers are examples.
