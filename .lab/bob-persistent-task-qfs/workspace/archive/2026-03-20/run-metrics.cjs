const runMetrics = require('../../evaluator/skills/delegation-metrics.cjs');
runMetrics({ limit: 100 }).then(console.log).catch(console.error);
