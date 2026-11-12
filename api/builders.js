// Proof-of-Build API
//   GET  /api/builders                 leaderboard for this week (+ all-time points)
//   POST /api/builders/register        { github, wallet, message, signature(base64) }
//   POST /api/builders/refresh         { github }   re-count this week's merged PRs
const { limited, send } = require("../lib/server.js");
const { makeBuild } = require("../lib/build.js");

let build = null;
const get = () => (build = build || makeBuild());

function readJson(req, max = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on("data", (c) => { size += c.length; if (size > max) { reject(new Error("Body too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const route = new URL(req.url, "http://x").pathname.replace(/\/$/, "");
  try {
    if (req.method === "GET" && route === "/api/builders") {
      if (limited(req, 60)) return send(res, 429, { error: "Too many requests. Wait a minute." });
      const r = await get().list(); return send(res, r.status, r.body);
    }
    if (req.method === "POST" && route === "/api/builders/register") {
      if (limited(req, 6)) return send(res, 429, { error: "Too many attempts. Wait a minute." });
      const r = await get().register(await readJson(req)); return send(res, r.status, r.body);
    }
    if (req.method === "POST" && route === "/api/builders/refresh") {
      if (limited(req, 10)) return send(res, 429, { error: "Too many refreshes. Wait a minute." });
      const { github } = await readJson(req); const r = await get().refreshOne(github); return send(res, r.status, r.body);
    }
    return send(res, 404, { error: "Unknown builders route." });
  } catch (e) {
    send(res, 502, { error: e.message || "Proof-of-Build failed." });
  }
};
