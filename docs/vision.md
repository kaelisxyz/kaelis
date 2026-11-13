# Kaelis vision: the market intelligence that evolves in public

Update 2026-11-08 (v2): the centre is no longer the scanner. Kaelis is a loop that runs by itself:
**SEE** (Patrol + Filings) → **JUDGE** (Rating + Ledger) → **EVOLVE** (Genome) → back to SEE with better rules.
Tagline: "Every generation smarter. Every upgrade proven."

## Genome (live)
- DNA = 8 check weights (sum 100, each 2–40, sell test locked ≥ 15), the hard-flag floor (70–95) and the rug-chance curve (a, b, k, hardP).
- Once a day (Patrol) the engine hill-climbs 600 mutants on the training calls (70% of tokens), then compares the best one with the current generation on the holdout calls (fixed 30% by sha256 of the mint). It adopts only if the holdout Brier drops by ≥ 0.002 and there are ≥ 60 resolved calls with features (`EVOLVE_MIN_RESOLVED`).
- Every generation records parent, changes, IQ before/after, data size, and a hash chained to the previous generation. Stored in `genome.json` (KAELIS_DATA_DIR).
- Ledger calls (from rules 1.2.1) seal every check severity, so any generation can replay any old call exactly.
- Code: `lib/genome.js`, `lib/patrol.js`, `/api/genome`, `site/evolution.html`, tests in `tests/genome.test.js`.

## Patrol (live)
- Every 30 min (`PATROL_EVERY_MIN`): resolve due Ledger calls, then scan up to 6 (`PATROL_BATCH`) new Solana tokens from DexScreener latest profiles + boosts, 15 s apart, no AI calls. `PATROL=off` stops it.
- Needs an always-on server (Railway) to keep collecting. Needs HELIUS_RPC_URL for holder data.

## Next
- Filings: insider-sale reports (Form K-4) for tokens with an open call (needs Helius).
- On-chain anchor of the Ledger head and the generation hashes.

---

# Earlier (v1): the AI rating agency for memecoins

Decided 2026-11-08. Scanning alone is easy to copy, so Kaelis takes the stock-market narrative
and brings it to memecoins, run by one AI that has to prove itself in public.

## The idea
Stocks get credit ratings (Moody's, S&P), reports (prospectus, earnings) and an index (S&P 500).
Memecoins get nothing. Kaelis gives memecoins all three, and unlike a human agency every call is
recorded and graded in public.

Narrative line: **"Superintelligence isn't claimed. It's scored."** Kaelis never claims to *be* a
superintelligence. Its intelligence is a public number (Kaelis IQ) that anyone can check.

Moat: the track record. Code can be copied overnight, but a copy starts with zero calls.

## Pieces
| Piece | Stock-market twin | Status |
|---|---|---|
| Kaelis Rating AAA to CC (D = confirmed rug; missing data caps at A) | Credit rating | Live (rules 1.2.1, `K.grade`) |
| The Ledger: hash-chained calls, graded after 7 days, Kaelis IQ | Analyst track record | Live (`lib/ledger.js`, `/api/ledger`, `ledger.html`) |
| On-chain anchor: Ledger head as a Solana memo | Audit trail | Next, needs a Kaelis wallet (`KAELIS_LEDGER_KEY`) |
| Listing reports for graduating tokens | IPO prospectus | Next, needs `ANTHROPIC_API_KEY` |
| K-20 Index: 20 best-rated memecoins, weekly | S&P 500 | Planned, benchmark only, never investable |
| Tokenized stocks rated with the same rules | Bridge to Wall Street | Planned (phase 2) |
| Forge City as the trading floor (tower height = market cap, colour = rating, rug = collapse) | Exchange floor | Planned visual |

## Ledger rules (v1)
- A call is made on every server scan of a token with a trading pool. One open call per token.
- Rug chance p = 0.03 + 0.9 × (score/100)^1.6, clamped to 0.02–0.97; a failed sell test is at least 0.85.
- After 7 days: rugged if no pool is left, liquidity fell by half or more (from ≥ $1k), or price fell 90%+.
- Kaelis IQ = 100 × (1 − Brier / 0.25), shown after 10 resolved calls.
- Each call hash = sha256 of the previous hash + the call fields. The chain is verified on every `/api/ledger` read.
- Storage: `ledger.json` in `KAELIS_DATA_DIR` (mount a Railway Volume or it resets on deploy).

## Guardrails
- Grades and calls are risk estimates, never buy or sell advice. No BUY/SELL labels, ever.
- The K-20 is a benchmark, not a product anyone can buy into.
- Never say Kaelis *is* a superintelligence. Point to the score.

## Markets (live, 2026-11-11)
- Tokenized stocks on Solana (xStocks by Backed): SPYx, QQQx, NVDAx, TSLAx, AAPLx. Official mints are in `lib/markets.js` and `KNOWN_ASSETS` in kaelis-core (rules 1.3.0). Patrol keeps one open call per stock (renewed every 7 days).
- Impersonation check (rules 1.3.0): a token using one of those tickers on a non-official mint gets a hard flag (CC). Official ones show "Official asset"; their issuer controls (mint, freeze, permanent delegate) still count as risk, by design.
- Rules 1.4.0 (2026-11-13): on an official xStock the issuer checks (mint, freeze, extensions, holder concentration, LP lock) stop scoring and are reported as `issuer`; market checks (sell test, liquidity, pool age) still score and the grade is capped at A. The ticker is also read from Jupiter's token list, so a copy whose pool is gone is still caught (CC, check_before_buy = block).
- Rules 1.5.0 (2026-11-13): a token that uses the full name of a company with no official token on Solana (`UNLISTED` in kaelis-core: Anthropic, OpenAI) gets a warning check `unlisted` (weight 0, never a hard flag, grade capped at BB, check_before_buy = warn). Matching is on the full name, not the ticker: "ANT" is also AntMiner, AntFun, The Ants. "Pre-IPO" wrappers (e.g. PreStocks) are included; both companies have said such tokens are not their equity. When an official tokenized version appears (Anthropic reportedly lists on Nasdaq as ANT on 2026-11-19), its mint moves to KNOWN_ASSETS and copies become a hard flag. Markets also searches these names daily and lists them as warnings.
- Stock calls are kept out of the Ledger's accuracy numbers and out of Genome training (`stats().stocks` reports them apart). Patrol keeps sealing one call a week and adds a daily unsealed reading under the current rules (`markets.json` -> `current`), shown on the Markets page next to the sealed call.
- Look-alikes: a daily DexScreener search per ticker lists the copies (found on day one: two fake NVDAx, one "AppleDex" AAPLx).
- K-20: equal-weight index of the 20 best-rated memecoins Kaelis has called (AAA..BBB, pool >= $20k, not rugged), rebalanced each ISO week without a jump, one point per Patrol round next to SPYx; both indexed to 100. A token with no price left counts as -100%; a token DexScreener simply did not answer for keeps its last price. Benchmark only, never investable.
- KIQ: the Kaelis IQ charted per point, with the generation.
- Code: `lib/markets.js`, `/api/markets`, `site/markets.html`, tests in `tests/markets.test.js`. Data in `markets.json` (KAELIS_DATA_DIR).
- Forge City tower 04 "Markets" (blue #5b8def, angle -1.38): board screen with K-20, S&P, KIQ and the five stock grades, a K-20 vs S&P screen, a fake-ticker screen; the panel links to markets.html. Refreshes every 5 minutes.

## Filings (live, 2026-11-11)
- SEC-style disclosures. When Kaelis makes a call (Patrol or a user scan) it records the 10 largest non-pool wallets as insiders. Each Patrol round re-reads their token accounts plus the mint (one getMultipleAccounts per token) and files: K-4 insider sale (>= 20% of the bag and >= 0.5% of supply), K-8 liquidity pulled (pools down >= 50% from >= $1k), K-3 mint/freeze authority back on. Hash-chained; tracking ends after 7 days. Spare Patrol slots backfill insiders for open calls made before the Helius key.
- Code: `lib/filings.js`, `/api/filings`, `site/filings.html`, Watch tower shows the feed when the visitor has no scan of their own. Tests in `tests/filings.test.js`. Needs HELIUS_RPC_URL (set in .env on 2026-11-11).
