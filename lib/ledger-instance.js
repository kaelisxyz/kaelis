// Shared singletons for the whole server: the Ledger (calls) and the Genome (evolving rules).
const { makeLedger } = require("./ledger.js");
const { makeGenome } = require("./genome.js");
const { makeMarkets } = require("./markets.js");
const { makeFilings, rpcClient } = require("./filings.js");
const { makeAnchor } = require("./anchor.js");
const rpc = (m, p) => rpcClient(require("./server.js").rpcUrls(), fetch)(m, p);
module.exports = { ledger: makeLedger(), genome: makeGenome(), markets: makeMarkets(), filings: makeFilings(), anchor: makeAnchor({ rpc }) };
