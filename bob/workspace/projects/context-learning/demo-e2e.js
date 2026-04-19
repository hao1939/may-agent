#!/usr/bin/env node
/**
 * End-to-end demo of the context-learning pipeline.
 * Simulates a failed session → lesson extraction → context.md update → verification.
 * 
 * Uses a mock LLM to avoid external dependencies. In production, swap with real LLM call.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { reflectAndLearn, pruneLessons, appendLesson } = require('./extract-reflection.js');

const DEMO_DIR = path.join(__dirname, '_demo_workspace');

// Clean up any previous demo
if (fs.existsSync(DEMO_DIR)) fs.rmSync(DEMO_DIR, { recursive: true });
fs.mkdirSync(DEMO_DIR, { recursive: true });

// --- Scenario 1: Agent failed because it used npx (which doesn't exist) ---
const transcript1 = `
User: Format the code in src/ using prettier.
Agent: I'll use npx to run prettier.
bash: npx prettier --write src/
Result: Error: npx: command not found
Agent: Let me try again with npx.
bash: npx prettier src/ugly.js
Result: Error: npx: command not found
Agent: I'm stuck. npx is not available.
finish: status=failure, summary="Could not run prettier - npx not found"
`;

// --- Scenario 2: Agent failed because it tried edit() without reading first ---
const transcript2 = `
User: Fix the calculateTotal function in utils.js to handle empty arrays.
Agent: I'll edit the function to add an empty array check.
edit: oldText="function calculateTotal(items) {" newText="function calculateTotal(items) { if (!items.length) return 0;"
Result: Error: oldText not found in file. The file contains different whitespace.
Agent: Let me try a different match.
edit: oldText="function calculateTotal(items){" newText="function calculateTotal(items){ if(!items.length) return 0;"
Result: Error: oldText not found in file.
Agent: I need to read the file first to see the actual content.
read: utils.js
Result: function calculateTotal( items ) {\n  let total = 0;\n...
Agent: Now I see the actual formatting. Let me edit with the correct text.
edit: oldText="function calculateTotal( items ) {" newText="function calculateTotal( items ) {\n  if (!items.length) return 0;"
Result: Success
finish: status=success, summary="Fixed calculateTotal", errors_encountered=2
`;

// --- Scenario 3: Clean session (should produce NO lesson) ---
const transcript3 = `
User: Add a README.md file.
Agent: I'll create the file.
write: README.md content="# Project\nA simple project."
Result: Success
finish: status=success, summary="Created README.md"
`;

// Mock LLM that returns realistic lessons based on transcript content
function mockLlmCall(prompt) {
  if (prompt.includes('npx: command not found')) {
    return Promise.resolve(
      'When npx is not available, use node_modules/.bin/<tool> directly instead of npx — because npx is a convenience wrapper and the binary is always available at node_modules/.bin/'
    );
  }
  if (prompt.includes('oldText not found')) {
    return Promise.resolve(
      'When editing a file, always read() it first to see exact content — because whitespace and formatting may differ from what you expect, causing edit() to fail'
    );
  }
  // Clean session → no lesson
  return Promise.resolve('NO_LESSON');
}

async function main() {
  console.log('=== Context-Learning E2E Demo ===\n');

  // Process three sessions sequentially
  const sessions = [
    { name: 'npx-failure', transcript: transcript1, outcome: 'failure: Could not run prettier - npx not found', agent: 'demo-agent' },
    { name: 'edit-without-read', transcript: transcript2, outcome: 'success: Fixed calculateTotal (2 errors)', agent: 'demo-agent' },
    { name: 'clean-session', transcript: transcript3, outcome: 'success: Created README.md', agent: 'demo-agent' },
  ];

  const agentDir = path.join(DEMO_DIR, 'demo-agent');
  fs.mkdirSync(agentDir, { recursive: true });
  const contextPath = path.join(agentDir, 'context.md');
  // Create initial context.md
  fs.writeFileSync(contextPath, '# Demo Agent Context\n\nThis agent handles code tasks.\n');

  for (const session of sessions) {
    console.log(`--- Session: ${session.name} ---`);
    
    const result = await reflectAndLearn({
      agentName: session.agent,
      transcript: session.transcript,
      outcome: session.outcome,
      sessionId: `demo-${session.name}`,
      llmCall: mockLlmCall,
      fs: { 
        readFile: (p) => Promise.resolve(fs.readFileSync(p, 'utf8')),
        writeFile: (p, c) => Promise.resolve(fs.writeFileSync(p, c)),
        existsSync: (p) => fs.existsSync(p),
        readFileSync: (p, enc) => fs.readFileSync(p, enc),
        writeFileSync: (p, c) => fs.writeFileSync(p, c),
      },
      contextDir: DEMO_DIR,
    });

    console.log(`  Lesson: ${result.lesson || '(none)'}`);
    console.log(`  Persisted: ${result.persisted}`);
    console.log();
  }

  // Show final context.md
  const finalContext = fs.readFileSync(contextPath, 'utf8');
  console.log('=== Final context.md ===');
  console.log(finalContext);

  // Verify
  assert(finalContext.includes('npx'), 'Should contain npx lesson');
  assert(finalContext.includes('read()'), 'Should contain read-before-edit lesson');
  assert(!finalContext.includes('NO_LESSON'), 'Should not contain NO_LESSON');
  assert(finalContext.includes('Learned from experience'), 'Should have section header');

  // Count lessons (should be exactly 2)
  const lessonLines = finalContext.split('\n').filter(l => l.startsWith('- When '));
  assert(lessonLines.length === 2, `Expected 2 lessons, got ${lessonLines.length}`);

  console.log('\n✅ All assertions passed! Pipeline works end-to-end.');
  console.log(`  - 2 failed sessions → 2 lessons extracted`);
  console.log(`  - 1 clean session → no lesson (correctly skipped)`);
  console.log(`  - Lessons persisted to context.md with attribution`);

  // Cleanup
  fs.rmSync(DEMO_DIR, { recursive: true });
}

main().catch(err => {
  console.error('❌ Demo failed:', err.message);
  // Cleanup on failure too
  if (fs.existsSync(DEMO_DIR)) fs.rmSync(DEMO_DIR, { recursive: true });
  process.exit(1);
});
