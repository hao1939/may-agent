const { scoreDecision } = require("../../benchmarks/may-learning-transfer/evaluator/score-decision.cjs");
console.log(JSON.stringify(scoreDecision(process.argv[2], __dirname)));
