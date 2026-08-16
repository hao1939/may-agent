const { scoreDecision } = require("../../benchmarks/may-app-outcome-management/score-disposition.cjs"); console.log(JSON.stringify(scoreDecision(process.argv[2], __dirname)));
