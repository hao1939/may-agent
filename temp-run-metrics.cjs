const metrics = require('./agents/evaluator/skills/delegation-metrics.cjs');

async function run() {
  try {
    const result = await metrics({ limit: 50 });
    console.log(result);
  } catch (e) {
    console.error(e);
  }
}

run();