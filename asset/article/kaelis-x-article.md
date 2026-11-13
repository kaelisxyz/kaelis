# A token scanner is easy to copy. A track record is not.

Every week a new token scanner launches on Solana. They all run the same checks: can you sell, how deep is the pool, who holds the supply, is the liquidity locked. The checks are public knowledge, so the answers come out the same.

We built one of those too. Then we stopped calling Kaelis a scanner.

This is why, and what it is now.

## What a scanner cannot tell you

A scanner answers one question: does this token look risky right now?

It has two blind spots.

**It has no memory.** Every token is new, so every check starts from zero. The wallet that launched the token is often not new. Neither is the wallet that paid for that wallet.

**Nobody checks the scanner.** It says "safe" or "danger", you move on, and a week later no one goes back to see if it was right.

Both problems have the same fix. Keep a record.

## 1. Every call is on the record

Each time Kaelis tests a token, it makes a call: the chance that this token is rugged within 7 days.

- The call is sealed in a hash chain. Change one old call and every hash after it breaks.
- Once a day, the head of that chain is written to Solana as a memo. Anyone can compare.
- Seven days later, Kaelis checks what happened and marks the call: held, or rugged.

Then it publishes the result. Hits, misses and false alarms, with every wrong call listed by name.

Here is the honest state of it as I write this, on 13 November 2026: **468 calls on the record, and not one has reached its 7-day check yet.** The first results are due on 15 November. Until then our accuracy page is empty, and it says so.

We would rather show you an empty page than a number we cannot back.

## 2. The wallet behind the token

For every token it tests, Kaelis now records who launched it and who first funded that wallet.

Look up a wallet and you see the tokens it launched, how each one ended, and a risk figure built from those outcomes. Deployers whose first funds came from the same source are grouped as a cluster. Exchanges and bridges are left out, because thousands of unrelated people share them.

Two limits, stated up front:

- It counts only tokens Kaelis has tested. A wallet may have launched others we never saw.
- On pump.fun most launches come from a fresh wallet, so one wallet often shows one token. Repeat launchers show up in the cluster, and clusters take time to appear. We started tracing on 12 November. The map is small today and grows every half hour.

## 3. One call before the trade

More and more buying is done by bots and AI agents. They cannot read a dashboard.

So Kaelis runs as an MCP server. An agent calls `check_before_buy` right before a swap and gets one word back: **allow**, **warn** or **block**. With it come the reasons, the deployer's record, and the hash of the sealed call as proof.

It is free while in beta. No API key.

## What we will not do

- **Sell ratings.** Nobody can pay to change a record.
- **Hide the rules.** The engine that produces every score is open source under MIT. Run it yourself and you get the same number.
- **Call it advice.** A rating is a risk estimate from public data. "Allow" means no known red flag was found. It is not a promise.
- **Launch a token before the record exists.** $KAEL is not live. The track record comes first. Anything sold as $KAEL today is not us.

## See it

Go to **kaelis.si** and step inside the building. Four rooms: test a token, read the record, run the agent check, see the builders.

If you build bots, wallets or launchpads, the API docs are at **kaelis.si/docs.html#api**.

Proof, not vibes.
