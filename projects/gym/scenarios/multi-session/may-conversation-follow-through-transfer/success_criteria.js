const { scoreBehavior } = require("../../../benchmarks/may-conversation-follow-through/score-behavior.cjs");
console.log(JSON.stringify(scoreBehavior("transfer", process.argv[2])));
