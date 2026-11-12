// Kaelis server for Railway (or any Node host): serves site/ and the /api functions.
// Railway runs `npm start` and gives the port in $PORT. No extra packages needed.
const http = require("http");
const fs = require("fs");
const path = require("path");
try { process.loadEnvFile?.(path.join(__dirname, ".env")); } catch {} // local .env only; on Railway the file is absent and Variables win

const ROOT = path.join(__dirname, "site");
const PORT = Number(process.env.PORT || 3000);
const API = {
  "/api/scan": require("./api/scan.js"),
  "/api/holders": require("./api/holders.js"),
  "/api/health": require("./api/health.js"),
  "/mcp": require("./api/mcp.js"),
  "/api/builders": require("./api/builders.js"),
  "/api/builders/register": require("./api/builders.js"),
  "/api/builders/refresh": require("./api/builders.js"),
  "/api/ledger": require("./api/ledger.js"),
  "/api/genome": require("./api/genome.js"),
  "/api/markets": require("./api/markets.js"),
  "/api/filings": require("./api/filings.js"),
};
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm",
  ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

function serveFile(req, res, pathname) {
  let file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) { file = path.join(file, "index.html"); st = fs.existsSync(file) && fs.statSync(file); err = st ? null : true; }
    if (err || !st) {
      // /scan works like /scan.html
      const alt = file + ".html";
      if (!path.extname(file) && fs.existsSync(alt)) return serveFile(req, res, pathname + ".html");
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("Not found");
    }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const headers = { "content-type": type, "x-content-type-options": "nosniff", "cache-control": /\.(html)$/.test(file) ? "no-cache" : "public, max-age=3600" };
    // video needs range requests for seeking on phones
    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [a, b] = range.slice(6).split("-");
      const start = a ? +a : Math.max(0, st.size - +b), end = a && b ? Math.min(+b, st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { "content-range": `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, Object.assign(headers, { "content-range": `bytes ${start}-${end}/${st.size}`, "accept-ranges": "bytes", "content-length": end - start + 1 }));
      return req.method === "HEAD" ? res.end() : fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign(headers, { "content-length": st.size, "accept-ranges": "bytes" }));
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  const fn = API[pathname.replace(/\/$/, "")];
  if (fn) {
    try { await fn(req, res); }
    catch (e) { if (!res.headersSent) { res.writeHead(500, { "content-type": "application/json" }); } res.end(JSON.stringify({ error: "Server error" })); }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveFile(req, res, pathname);
});

if (require.main === module) server.listen(PORT, () => {
  console.log(`Kaelis running on port ${PORT}`);
  const p = require("./lib/patrol.js").start(); // autonomous scans + nightly evolution (PATROL=off to stop)
  console.log(p.on ? `Patrol on, first round ${p.nextRound}` : "Patrol off");
});
module.exports = server;
