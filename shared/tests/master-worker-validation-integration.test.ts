/**
 * Integration test: output-validator wired into master-worker.ts
 * Verifies that empty/duplicate outputs are rejected in the iteration loop.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { validateOutput } from '../workflows/output-validator.ts';
import { snapshotOutputs, diffSnapshots } from '../workflows/master-worker.ts';

const TEST_DIR = join(__dirname, '__test-validation-integration__');
const OUTPUTS_DIR = join(TEST_DIR, 'outputs');

beforeEach(() => {
  mkdirSync(OUTPUTS_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('master-worker validation integration', () => {
  it('rejects empty files produced by worker', () => {
    // Simulate worker producing an empty file
    const filePath = join(OUTPUTS_DIR, 'empty-report.md');
    writeFileSync(filePath, '', 'utf-8');

    const result = validateOutput('empty-report.md', '', { outputDir: OUTPUTS_DIR });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File content is empty');
  });

  it('rejects duplicate files', () => {
    // Existing file
    const existingContent = '# Report\n\nSome important content here that is long enough.';
    writeFileSync(join(OUTPUTS_DIR, 'existing-report.md'), existingContent, 'utf-8');

    // Worker produces same content with different name
    const result = validateOutput('new-report.md', existingContent, {
      outputDir: OUTPUTS_DIR,
      checkDuplicates: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('duplicate');
  });

  it('accepts valid non-duplicate files', () => {
    writeFileSync(join(OUTPUTS_DIR, 'old.md'), '# Old\n\nOld content here.', 'utf-8');

    const newContent = '# New Report\n\nCompletely different content that is unique.';
    const result = validateOutput('new.md', newContent, {
      outputDir: OUTPUTS_DIR,
      checkDuplicates: true,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects files that are too small', () => {
    const result = validateOutput('tiny.md', 'hi', { minSize: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('too small');
  });

  it('warns about markdown files without headers', () => {
    const content = 'This is just plain text without any markdown headers but long enough to pass size check.';
    const result = validateOutput('no-headers.md', content, {
      checkDuplicates: false,
      validateContentType: true,
    });
    expect(result.valid).toBe(true); // warnings don't fail
    expect(result.warnings).toContain('Markdown file has no headers (expected at least one # heading)');
  });

  it('rejects test files without test blocks', () => {
    const content = 'const x = 1;\nexport default x;\n// no tests here';
    const result = validateOutput('bad.test.ts', content, {
      checkDuplicates: false,
      validateContentType: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('no test/it/describe blocks');
  });

  it('integrates with snapshotOutputs/diffSnapshots flow', () => {
    // Take before snapshot
    const before = snapshotOutputs(OUTPUTS_DIR);

    // Simulate worker writing files
    writeFileSync(join(OUTPUTS_DIR, 'valid.md'), '# Valid\n\nGood content.', 'utf-8');
    writeFileSync(join(OUTPUTS_DIR, 'empty.md'), '', 'utf-8');

    // Take after snapshot
    const after = snapshotOutputs(OUTPUTS_DIR);
    const changed = diffSnapshots(before, after);

    // Validate each changed file (mimics master-worker logic)
    const validFiles: string[] = [];
    for (const filePath of changed) {
      const content = readFileSync(filePath, 'utf-8');
      const filename = filePath.split('/').pop() || '';
      const result = validateOutput(filename, content, { outputDir: OUTPUTS_DIR });
      if (result.valid) validFiles.push(filePath);
    }

    expect(changed).toHaveLength(2);
    expect(validFiles).toHaveLength(1);
    expect(validFiles[0]).toContain('valid.md');
  });
});
