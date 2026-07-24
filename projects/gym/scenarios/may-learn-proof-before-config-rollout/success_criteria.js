const { scoreDecision } = require("../../benchmarks/may-alignment/score-decision.cjs");
console.log(JSON.stringify(scoreDecision(process.argv[2], __dirname)));

