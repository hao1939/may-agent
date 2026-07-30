const { scoreBehavior } = require("../../../benchmarks/may-conversation-follow-through/score-behavior.cjs");
console.log(JSON.stringify(scoreBehavior("core", process.argv[2])));
