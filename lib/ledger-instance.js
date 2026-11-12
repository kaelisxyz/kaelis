// Shared singletons for the whole server: the Ledger (calls) and the Genome (evolving rules).
const { makeLedger } = require("./ledger.js");
const { makeGenome } = require("./genome.js");
const { makeMarkets } = require("./markets.js");
const { makeFilings, rpcClient } = require("./filings.js");
const { makeAnchor } = require("./anchor.js");
const { makeDeployers } = require("./deployers.js");
const rpc = (m, p) => rpcClient(require("./server.js").rpcUrls(), fetch)(m, p);
const json = async (url) => { const r = await fetch(url, { headers: { accept: "application/json" } }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
module.exports = { ledger: makeLedger(), genome: makeGenome(), markets: makeMarkets(), filings: makeFilings(), anchor: makeAnchor({ rpc }), deployers: makeDeployers({ rpc, json }) };
