const { scoreDecision } = require("../../score-decision.cjs");
console.log(JSON.stringify(scoreDecision(process.argv[2], __dirname)));
