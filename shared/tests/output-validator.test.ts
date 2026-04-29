import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  validateOutput,
  findDuplicate,
  validateContentType,
  hashContent,
} from '../workflows/output-validator';

describe('output-validator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'output-validator-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('validateOutput', () => {
    it('rejects empty content', () => {
      const result = validateOutput('test.md', '', { outputDir: tempDir });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File content is empty');
    });

    it('rejects whitespace-only content', () => {
      const result = validateOutput('test.md', '   \n\n  ', { outputDir: tempDir });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File content is empty');
    });

    it('rejects content below minimum size', () => {
      const result = validateOutput('test.md', 'hi', { outputDir: tempDir, minSize: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/too small/);
    });

    it('accepts valid markdown', () => {
      const content = '# Hello World\n\nThis is valid markdown content.';
      const result = validateOutput('report.md', content, { outputDir: tempDir });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects duplicate files', () => {
      const content = '# Duplicate Content\n\nThis already exists.';
      writeFileSync(join(tempDir, 'existing.md'), content);

      const result = validateOutput('new.md', content, { outputDir: tempDir });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/duplicate.*existing\.md/);
    });

    it('does not flag same file as duplicate', () => {
      const content = '# My Content\n\nSome unique content here.';
      writeFileSync(join(tempDir, 'same.md'), content);

      const result = validateOutput('same.md', content, { outputDir: tempDir });
      expect(result.valid).toBe(true);
    });

    it('skips duplicate check when disabled', () => {
      const content = '# Duplicate\n\nDuplicate content.';
      writeFileSync(join(tempDir, 'existing.md'), content);

      const result = validateOutput('new.md', content, {
        outputDir: tempDir,
        checkDuplicates: false,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('findDuplicate', () => {
    it('returns null for empty directory', () => {
      expect(findDuplicate('content', tempDir)).toBeNull();
    });

    it('returns null when no duplicate exists', () => {
      writeFileSync(join(tempDir, 'a.md'), 'unique content A');
      expect(findDuplicate('unique content B', tempDir)).toBeNull();
    });

    it('finds exact duplicate', () => {
      writeFileSync(join(tempDir, 'original.md'), 'same content');
      expect(findDuplicate('same content', tempDir)).toBe('original.md');
    });

    it('ignores whitespace differences in trim', () => {
      writeFileSync(join(tempDir, 'original.md'), '  same content  ');
      expect(findDuplicate('same content', tempDir)).toBe('original.md');
    });

    it('returns null for non-existent directory', () => {
      expect(findDuplicate('content', '/nonexistent')).toBeNull();
    });
  });

  describe('validateContentType', () => {
    it('warns when markdown has no headers', () => {
      const result = validateContentType('readme.md', 'No headers here, just text.');
      expect(result.warnings[0]).toMatch(/no headers/);
    });

    it('accepts markdown with headers', () => {
      const result = validateContentType('readme.md', '# Title\n\nContent');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('errors when test file has no test blocks', () => {
      const result = validateContentType('foo.test.ts', 'const x = 1;');
      expect(result.errors[0]).toMatch(/no test.*blocks/);
    });

    it('accepts test file with describe/it', () => {
      const result = validateContentType(
        'foo.test.ts',
        'describe("foo", () => { it("works", () => {}) })'
      );
      expect(result.errors).toHaveLength(0);
    });

    it('errors on invalid JSON', () => {
      const result = validateContentType('data.json', '{invalid json}');
      expect(result.errors[0]).toMatch(/invalid JSON/);
    });

    it('accepts valid JSON', () => {
      const result = validateContentType('data.json', '{"key": "value"}');
      expect(result.errors).toHaveLength(0);
    });

    it('warns when shell script missing shebang', () => {
      const result = validateContentType('run.sh', 'echo hello');
      expect(result.warnings[0]).toMatch(/shebang/);
    });

    it('accepts shell script with shebang', () => {
      const result = validateContentType('run.sh', '#!/bin/bash\necho hello');
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when source file has no declarations', () => {
      const result = validateContentType('utils.ts', '// just a comment');
      expect(result.warnings[0]).toMatch(/no exports/);
    });
  });

  describe('hashContent', () => {
    it('produces consistent hashes', () => {
      expect(hashContent('hello')).toBe(hashContent('hello'));
    });

    it('trims before hashing', () => {
      expect(hashContent('  hello  ')).toBe(hashContent('hello'));
    });

    it('produces different hashes for different content', () => {
      expect(hashContent('hello')).not.toBe(hashContent('world'));
    });
  });
});
