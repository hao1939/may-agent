/**
 * Tests for extractReflection module — unit tests for lesson extraction,
 * appending, pruning, and the full pipeline.
 */

const {
  extractReflection,
  appendLesson,
  pruneLessons,
  truncateTranscript,
  reflectAndLearn,
} = require('./extract-reflection.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.log(`  ✗ ${message}`); failed++; }
}

// ── truncateTranscript tests ───────────────────────────────────────────

console.log('\ntruncateTranscript:');
assert(truncateTranscript('short', 100) === 'short', 'short text unchanged');
assert(truncateTranscript('a'.repeat(200), 100).length < 200, 'long text truncated');
assert(truncateTranscript('a'.repeat(200), 100).includes('[... middle truncated ...]'), 'has truncation marker');

// ── appendLesson tests ─────────────────────────────────────────────────

console.log('\nappendLesson:');

// Mock fs
function mockFs(initialContent = '') {
  let content = initialContent;
  return {
    readFile: async () => content,
    writeFile: async (_, c) => { content = c; },
    getContent: () => content,
  };
}

(async () => {
  // Test: creates section when none exists
  const fs1 = mockFs('# Agent Context\n\nSome existing content.\n');
  await appendLesson({
    contextPath: 'test.md',
    lesson: 'Use node_modules/.bin/ instead of npx because npx is unavailable.',
    sessionId: 's_123',
    date: '2026-04-19',
    fs: fs1,
  });
  assert(fs1.getContent().includes('## Learned from experience'), 'creates section header');
  assert(fs1.getContent().includes('Use node_modules/.bin/'), 'includes lesson text');
  assert(fs1.getContent().includes('(source: s_123, 2026-04-19)'), 'includes attribution');

  // Test: appends to existing section
  await appendLesson({
    contextPath: 'test.md',
    lesson: 'Read files before editing.',
    sessionId: 's_456',
    date: '2026-04-19',
    fs: fs1,
  });
  const content = fs1.getContent();
  const lessonLines = content.split('\n').filter(l => l.startsWith('- '));
  assert(lessonLines.length === 2, 'has two lessons after append');

  // ── pruneLessons tests ──────────────────────────────────────────────

  console.log('\npruneLessons:');

  // Create fs with 15 lessons
  let lines = '# Context\n\n## Learned from experience\n';
  for (let i = 0; i < 15; i++) {
    lines += `- Lesson ${i} (source: s_${i}, 2026-04-19)\n`;
  }
  const fs2 = mockFs(lines);
  await pruneLessons({ contextPath: 'test.md', maxLessons: 10, fs: fs2 });
  const pruned = fs2.getContent().split('\n').filter(l => l.startsWith('- '));
  assert(pruned.length === 10, `pruned to 10 (got ${pruned.length})`);
  assert(pruned[0].includes('Lesson 5'), 'kept newest (oldest removed)');
  assert(pruned[9].includes('Lesson 14'), 'last lesson is the newest');

  // Test: no pruning needed
  const fs3 = mockFs('## Learned from experience\n- Lesson 1\n- Lesson 2\n');
  await pruneLessons({ contextPath: 'test.md', maxLessons: 10, fs: fs3 });
  assert(fs3.getContent().includes('Lesson 1'), 'no pruning when under limit');

  // ── extractReflection tests ─────────────────────────────────────────

  console.log('\nextractReflection:');

  // Mock LLM that returns a lesson
  const mockLlmLesson = async () => 'When running CLI tools, use node_modules/.bin/ directly instead of npx, because npx is not available in this environment.';
  const lesson1 = await extractReflection({
    transcript: 'bash: npx prettier → error: npx not found\nbash: ./node_modules/.bin/prettier → success',
    outcome: 'PASS (recovered after error)',
    llmCall: mockLlmLesson,
  });
  assert(lesson1.includes('node_modules'), 'extracted lesson about node_modules');
  assert(lesson1 !== 'NO_LESSON', 'not NO_LESSON');

  // Mock LLM that returns NO_LESSON
  const mockLlmNoLesson = async () => 'NO_LESSON';
  const lesson2 = await extractReflection({
    transcript: 'read: utils.js → content\nedit: utils.js → success\nbash: node test.js → all pass',
    outcome: 'PASS (clean session)',
    llmCall: mockLlmNoLesson,
  });
  assert(lesson2 === 'NO_LESSON', 'clean session returns NO_LESSON');

  // ── reflectAndLearn integration ─────────────────────────────────────

  console.log('\nreflectAndLearn:');

  const fs4 = mockFs('');
  const result1 = await reflectAndLearn({
    agentName: 'coder',
    transcript: 'npx failed',
    outcome: 'FAIL',
    sessionId: 's_test',
    llmCall: mockLlmLesson,
    fs: fs4,
    contextDir: 'agents',
  });
  assert(result1.persisted === true, 'lesson was persisted');
  assert(fs4.getContent().includes('Learned from experience'), 'context.md has section');

  const fs5 = mockFs('');
  const result2 = await reflectAndLearn({
    agentName: 'coder',
    transcript: 'clean run',
    outcome: 'PASS',
    sessionId: 's_test2',
    llmCall: mockLlmNoLesson,
    fs: fs5,
    contextDir: 'agents',
  });
  assert(result2.persisted === false, 'NO_LESSON not persisted');

  // ── Summary ─────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
