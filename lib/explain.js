// AI explanation of a scan. The rules engine decides the score; the model only explains it.
// Every number in the model's text must already appear in the facts we gave it, otherwise
// the explanation is thrown away and the site falls back to the rule-written summary.
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.KAELIS_MODEL || "claude-opus-5-5";
let client = null;

const SYSTEM = `You explain token risk scans for Kaelis, a token scanner for Solana, Ethereum, BNB Chain, Base and Robinhood Chain.
You get a JSON object with the score (0 = no known red flag, 100 = very risky), the band, every check with its points and evidence, extra RugCheck flags, and wallet-link findings.
Write 3 to 5 short sentences in plain English for a normal person:
- Start with the overall picture in one sentence using the score and band.
- Then explain the 2 or 3 checks that added the most points, in everyday words, and what they could mean for someone holding the token.
- If wallet links were found, say what that suggests.
- If checks were unavailable, say the score may be lower than the real risk.
Rules: only use facts and numbers that appear in the JSON, copied exactly as written there. Do not invent numbers, names, prices or predictions. Never tell the reader to buy, sell or hold, and never promise safety. No markdown, no lists, no headings.`;

function facts(d, r, links) {
  return {
    token: d.mint,
    score: r.score,
    scoreScale: "0 to 100",
    band: r.band,
    rulesVersion: r.rulesVersion,
    checks: r.checks.map((c) => ({ name: c.name, points: c.sev == null ? "unavailable" : Math.round(c.weight * c.sev), maxPoints: c.weight, evidence: c.detail })),
    rugcheckFlags: (r.rugcheckRisks || []).map((k) => `${k.level || "info"}: ${k.name}`),
    walletLinks: links ? links.lines : [],
  };
}

// numbers in the answer must be present in the facts (ignores 0-10 used as plain words like "3 checks")
function grounded(text, source) {
  const norm = (s) => s.replace(/,/g, "");
  const src = norm(source);
  const nums = norm(text).match(/\d+(?:\.\d+)?/g) || [];
  return nums.every((n) => +n <= 10 || src.includes(n));
}

async function explain(d, r, links) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  const f = JSON.stringify(facts(d, r, links));
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: f }],
  });
  if (msg.stop_reason === "refusal") return null;
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  if (!text || !grounded(text, f)) return null;
  return text;
}

module.exports = { explain, grounded, facts, MODEL };
