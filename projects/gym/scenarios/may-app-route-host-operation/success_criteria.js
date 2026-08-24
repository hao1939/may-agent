const { scoreTaskResult } = require("../../benchmarks/may-app-outcome-management/score-task-result.cjs"); console.log(JSON.stringify(scoreTaskResult(process.argv[2], __dirname)));
