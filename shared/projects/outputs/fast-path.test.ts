import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fastWrite, shouldUseFastPath, getValidationLevel } from '../workflows/fast-path';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('fast-path', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-path-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('fastWrite - empty content rejection', () => {
    it('rejects empty string at score 1', () => {
      const result = fastWrite('', path.join(tmpDir, 'test.md'), { complexityScore: 1 });
      expect(result.written).toBe(false);
      expect(result.reason).toContain('Empty');
    });

    it('rejects whitespace-only at score 1', () => {
      const result = fastWrite('   \n\n  ', path.join(tmpDir, 'test.md'), { complexityScore: 1 });
      expect(result.written).toBe(false);
      expect(result.reason).toContain('Empty');
    });

    it('rejects empty string at score 5', () => {
      const result = fastWrite('', path.join(tmpDir, 'test.md'), { complexityScore: 5 });
      expect(result.written).toBe(false);
      expect(result.reason).toContain('Empty');
    });

    it('rejects empty content at score 3', () => {
      const result = fastWrite('\t\n', path.join(tmpDir, 'test.md'), { complexityScore: 3 });
      expect(result.written).toBe(false);
    });
  });

  describe('fastWrite - score 1-2 fast path', () => {
    it('skips duplicate detection at score 1', () => {
      const filePath = path.join(tmpDir, 'existing.md');
      fs.writeFileSync(filePath, '# Hello');
      const newPath = path.join(tmpDir, 'new.md');
      const result = fastWrite('# Hello', newPath, {
        complexityScore: 1,
        existingFiles: [filePath]
      });
      expect(result.written).toBe(true);
      expect(result.skippedValidation).toContain('duplicate-detection');
    });

    it('skips content-type validation at score 2', () => {
      const filePath = path.join(tmpDir, 'test.md');
      // Markdown without headers - would fail full validation
      const result = fastWrite('no headers here', filePath, { complexityScore: 2 });
      expect(result.written).toBe(true);
      expect(result.skippedValidation).toContain('content-type-validation');
    });

    it('skips duplicate detection at score 2', () => {
      const result = fastWrite('content', path.join(tmpDir, 'f.txt'), { complexityScore: 2 });
      expect(result.skippedValidation).toContain('duplicate-detection');
    });

    it('writes file successfully at score 1', () => {
      const filePath = path.join(tmpDir, 'output.md');
      const result = fastWrite('# Quick write', filePath, { complexityScore: 1 });
      expect(result.written).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('# Quick write');
    });

    it('creates directories if needed at score 1', () => {
      const filePath = path.join(tmpDir, 'sub', 'dir', 'file.md');
      const result = fastWrite('# Content', filePath, { complexityScore: 1 });
      expect(result.written).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('fastWrite - score 3+ full validation', () => {
    it('detects duplicate content at score 3', () => {
      const existing = path.join(tmpDir, 'existing.md');
      fs.writeFileSync(existing, '# Duplicate content');
      const result = fastWrite('# Duplicate content', path.join(tmpDir, 'new.md'), {
        complexityScore: 3,
        existingFiles: [existing]
      });
      expect(result.written).toBe(false);
      expect(result.reason).toContain('Duplicate');
    });

    it('rejects markdown without headers at score 3', () => {
      const result = fastWrite('no headers', path.join(tmpDir, 'doc.md'), { complexityScore: 3 });
      expect(result.written).toBe(false);
      expect(result.reason).toContain('headers');
    });

    it('accepts markdown with headers at score 3', () => {
      const result = fastWrite('# Title\nContent', path.join(tmpDir, 'doc.md'), { complexityScore: 3 });
      expect(result.written).toBe(true);
    });

    it('rejects test file without test blocks at score 4', () => {
      const result = fastWrite('const x = 1;', path.join(tmpDir, 'foo.test.ts'), { complexityScore: 4 });
      expect(result.written).toBe(false);
      expect(result.reason).toContain('test blocks');
    });

    it('accepts test file with test blocks at score 4', () => {
      const result = fastWrite('describe("x", () => { it("works", () => {}) })', path.join(tmpDir, 'foo.test.ts'), { complexityScore: 4 });
      expect(result.written).toBe(true);
    });

    it('passes non-duplicate content at score 5', () => {
      const existing = path.join(tmpDir, 'a.md');
      fs.writeFileSync(existing, '# Original');
      const result = fastWrite('# Different', path.join(tmpDir, 'b.md'), {
        complexityScore: 5,
        existingFiles: [existing]
      });
      expect(result.written).toBe(true);
    });

    it('handles non-existent files in existingFiles gracefully', () => {
      const result = fastWrite('# Content', path.join(tmpDir, 'out.md'), {
        complexityScore: 3,
        existingFiles: ['/nonexistent/file.md']
      });
      expect(result.written).toBe(true);
    });

    it('does not skip any validations at score 3+', () => {
      const result = fastWrite('# Valid', path.join(tmpDir, 'f.md'), { complexityScore: 3 });
      expect(result.skippedValidation).toHaveLength(0);
    });
  });

  describe('fastWrite - default behavior', () => {
    it('defaults to score 3 (full validation)', () => {
      const result = fastWrite('no headers', path.join(tmpDir, 'doc.md'));
      expect(result.written).toBe(false);
      expect(result.reason).toContain('headers');
    });
  });

  describe('shouldUseFastPath', () => {
    it('returns true for score 1', () => {
      expect(shouldUseFastPath(1)).toBe(true);
    });

    it('returns true for score 2', () => {
      expect(shouldUseFastPath(2)).toBe(true);
    });

    it('returns false for score 3', () => {
      expect(shouldUseFastPath(3)).toBe(false);
    });

    it('returns false for score 5', () => {
      expect(shouldUseFastPath(5)).toBe(false);
    });
  });

  describe('getValidationLevel', () => {
    it('returns minimal for score 1', () => {
      expect(getValidationLevel(1)).toContain('minimal');
    });

    it('returns full for score 3', () => {
      expect(getValidationLevel(3)).toContain('full');
    });

    it('returns strict for score 5', () => {
      expect(getValidationLevel(5)).toContain('strict');
    });
  });
});
