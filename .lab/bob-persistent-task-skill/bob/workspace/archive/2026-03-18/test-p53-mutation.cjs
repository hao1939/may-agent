#!/usr/bin/env node
/**
 * P53 Mutation Test — Identity Protection in bash tool
 *
 * Verifies that the bash tool blocks commands that would modify
 * SOUL.md, DOMAIN.md, TOOLS.md, or LESSONS.md via shell write operations.
 *
 * This is a regression test for the P53 fix added to src/lib/tools/bash.ts.
 * It directly imports createBashTool and asserts that violations throw.
 *
 * Run: node agents/bob/workspace/test-p53-mutation.cjs
 */

// We need to load the compiled JS from dist/
const path = require('path');
const fs = require('fs');

// Verify the compiled bash tool exists
const bashToolPath = path.join(__dirname, '../../../dist/lib/tools/bash.js');
if (!fs.existsSync(bashToolPath)) {
  console.error('ERROR: dist/lib/tools/bash.js not found. Run `npx tsc` first.');
  process.exit(1);
}

async function main() {
  // Dynamic import for ESM module
  const { createBashTool } = await import(bashToolPath);

  const tool = createBashTool(process.cwd());
  const execute = tool.execute.bind(tool);

  let passed = 0;
  let failed = 0;
  const results = [];

  async function expectP53Violation(label, command) {
    try {
      await execute('test-call', { command }, undefined, undefined);
      // If we get here, the command was NOT blocked — FAIL
      failed++;
      results.push({ label, status: 'FAIL', reason: 'Command was not blocked (no error thrown)' });
      console.log(`  ✗ ${label} — FAIL (command was not blocked)`);
    } catch (err) {
      if (err.message && err.message.includes('P53 Violation')) {
        passed++;
        results.push({ label, status: 'PASS', reason: 'P53 Violation thrown as expected' });
        console.log(`  ✓ ${label} — PASS`);
      } else {
        failed++;
        results.push({ label, status: 'FAIL', reason: `Wrong error: ${err.message}` });
        console.log(`  ✗ ${label} — FAIL (wrong error: ${err.message.slice(0, 80)})`);
      }
    }
  }

  async function expectAllowed(label, command) {
    try {
      await execute('test-call', { command }, undefined, undefined);
      passed++;
      results.push({ label, status: 'PASS', reason: 'Command allowed as expected' });
      console.log(`  ✓ ${label} — PASS`);
    } catch (err) {
      if (err.message && err.message.includes('P53 Violation')) {
        failed++;
        results.push({ label, status: 'FAIL', reason: 'False positive — P53 blocked a safe command' });
        console.log(`  ✗ ${label} — FAIL (false positive P53 block)`);
      } else {
        // Non-P53 errors are fine (e.g., command not found) — the point is P53 didn't block it
        passed++;
        results.push({ label, status: 'PASS', reason: `Allowed (non-P53 error: ${err.message.slice(0, 60)})` });
        console.log(`  ✓ ${label} — PASS (non-P53 error is fine)`);
      }
    }
  }

  console.log('\n═══ P53 Mutation Test: Identity Protection in bash tool ═══\n');

  // ── Positive tests: these MUST be blocked ────────────────────────

  console.log('── Should BLOCK (P53 Violation expected) ──');

  await expectP53Violation(
    'echo redirect to SOUL.md',
    "echo 'hacked' > SOUL.md"
  );

  await expectP53Violation(
    'echo append to SOUL.md',
    "echo 'hacked' >> SOUL.md"
  );

  await expectP53Violation(
    'sed -i on SOUL.md',
    "sed -i 's/old/new/' SOUL.md"
  );

  await expectP53Violation(
    'mv to SOUL.md',
    'mv /tmp/evil.md SOUL.md'
  );

  await expectP53Violation(
    'cp to SOUL.md',
    'cp /tmp/evil.md SOUL.md'
  );

  await expectP53Violation(
    'redirect to DOMAIN.md',
    "echo 'hacked' > DOMAIN.md"
  );

  await expectP53Violation(
    'sed -i on TOOLS.md',
    "sed -i 's/old/new/' TOOLS.md"
  );

  await expectP53Violation(
    'redirect to LESSONS.md',
    "echo 'hacked' > LESSONS.md"
  );

  await expectP53Violation(
    'SOUL.md in subpath with redirect',
    "echo 'hacked' > agents/coder/SOUL.md"
  );

  await expectP53Violation(
    'cp overwrite DOMAIN.md in subpath',
    'cp /tmp/evil.md agents/evaluator/DOMAIN.md'
  );

  // ── Negative tests: these MUST be allowed ────────────────────────

  console.log('\n── Should ALLOW (no P53 block) ──');

  await expectAllowed(
    'cat SOUL.md (read-only)',
    'cat SOUL.md'
  );

  await expectAllowed(
    'grep in SOUL.md (read-only)',
    'grep "constraint" SOUL.md'
  );

  await expectAllowed(
    'echo without redirect',
    "echo 'hello world'"
  );

  await expectAllowed(
    'redirect to unrelated file',
    "echo 'data' > /tmp/test-p53-safe.txt"
  );

  await expectAllowed(
    'sed -i on unrelated file',
    "sed -i 's/old/new/' /tmp/test-p53-safe.txt"
  );

  // ── Summary ──────────────────────────────────────────────────────

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed, ${passed + failed} total ═══`);

  if (failed > 0) {
    console.log('\n❌ MUTATION TEST FAILED — P53 protection has gaps!\n');
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.label}: ${r.reason}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ MUTATION TEST PASSED — P53 protection is effective.\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
