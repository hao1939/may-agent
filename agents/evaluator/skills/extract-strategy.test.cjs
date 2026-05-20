// agents/evaluator/skills/extract-strategy.test.cjs
// Regression harness for modern-session positive strategy extraction.
// Usage: node agents/evaluator/skills/extract-strategy.test.cjs

const path = require('path');
const extractStrategy = require('./extract-strategy.cjs');

let passed = 0;
let failed = 0;

function assert(condition, label, details = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.log(`❌ ${label}${details ? ` — ${details}` : ''}`);
  }
}

function appPath(...parts) {
  return path.resolve(__dirname, '..', '..', '..', ...parts);
}

async function runCase(label, logPath) {
  const result = await extractStrategy({ logPath, type: 'strategy' });
  if (result.error) {
    throw new Error(`${label} failed: ${result.error}`);
  }

  const strategyLessons = result.lessons.filter(lesson => lesson.type === 'strategy');
  return {
    result,
    strategyLessons,
    strategyTriggers: strategyLessons.map(lesson => lesson.trigger)
  };
}

(async () => {
  const fixturePath = appPath(
    'projects',
    'agent-system-evolution',
    'outputs',
    'evaluator',
    'strategy-extractor',
    'fixtures',
    'strategy-positive-modern-session',
    'session.jsonl'
  );
  const mayLivePath = appPath('.state', 'sessions', 'history', 's_1778701694150_268', 'session.jsonl');
  const devLivePath = appPath('.state', 'sessions', 'history', 's_1778701694563_272', 'session.jsonl');
  const compactScoutPath = appPath('.state', 'sessions', 'history', 's_1778701694460_271', 'session.jsonl');

  console.log('Modern-session strategy extraction regression harness\n');

  const fixture = await runCase('fixture', fixturePath);
  assert(fixture.strategyLessons.length >= 1, 'fixture emits at least one strategy lesson', `got ${fixture.strategyLessons.length}`);
  assert(
    fixture.strategyTriggers.includes('Starts with an explicit GOAL/PLAN/DONE WHEN frame before tool use'),
    'fixture preserves planning-frame strategy trigger',
    JSON.stringify(fixture.strategyTriggers)
  );
  assert(
    fixture.strategyTriggers.includes('Uses DB schema/error hints to recover into a successful follow-up query'),
    'fixture preserves schema-hint recovery trigger',
    JSON.stringify(fixture.strategyTriggers)
  );
  assert(
    fixture.strategyTriggers.includes('Turns evidence gathering into one concrete action before finishing'),
    'fixture preserves evidence-to-action trigger',
    JSON.stringify(fixture.strategyTriggers)
  );
  assert(
    fixture.result.lessons.every(lesson => lesson.type === 'strategy'),
    'fixture stays focused on positive strategy lessons',
    JSON.stringify(fixture.result.lessons.map(lesson => lesson.type))
  );

  const mayLive = await runCase('may live sample', mayLivePath);
  assert(mayLive.strategyLessons.length >= 1, 'fresh May good session still emits strategy lessons', `got ${mayLive.strategyLessons.length}`);

  const devLive = await runCase('dev live sample', devLivePath);
  assert(devLive.strategyLessons.length >= 1, 'fresh Dev good session still emits strategy lessons', `got ${devLive.strategyLessons.length}`);
  assert(
    devLive.strategyTriggers.some(trigger => trigger.includes('read-before and read-after verification')),
    'fresh Dev sample still exposes verification-loop strategy',
    JSON.stringify(devLive.strategyTriggers)
  );

  const compactScout = await runCase('compact scout sample', compactScoutPath);
  console.log(`ℹ️ compact scout sample currently yields ${compactScout.strategyLessons.length} strategy lessons (known gap, not a failure)`);

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
})();
