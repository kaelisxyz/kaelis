// Shared singletons for the whole server: the Ledger (calls) and the Genome (evolving rules).
const { makeLedger } = require("./ledger.js");
const { makeGenome } = require("./genome.js");
const { makeMarkets } = require("./markets.js");
const { makeFilings } = require("./filings.js");
module.exports = { ledger: makeLedger(), genome: makeGenome(), markets: makeMarkets(), filings: makeFilings() };
