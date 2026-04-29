import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractReferencedFiles,
  isDuplicateTask,
  checkFileExistence,
  checkToolAvailability,
  estimateComplexity,
  checkOutputDirectory,
  validateTask,
} from '../workflows/task-validator.js';

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual as any,
    existsSync: vi.fn((p: string) => {
      if (p.includes('exists')) return true;
      if (p.includes('/real/')) return true;
      return false;
    }),
  };
});

describe('task-validator extended', () => {
  describe('isDuplicateTask', () => {
    it('detects duplicate tasks', () => {
      expect(isDuplicateTask('fix the login bug', ['fix the login bug'])).toBe(true);
    });

    it('detects similar tasks above threshold', () => {
      expect(isDuplicateTask('fix the login bug in auth', ['fix the login bug in authentication'])).toBe(true);
    });

    it('returns false for different tasks', () => {
      expect(isDuplicateTask('deploy to production', ['fix the login bug'])).toBe(false);
    });

    it('returns false for empty recent tasks', () => {
      expect(isDuplicateTask('anything', [])).toBe(false);
    });

    it('handles custom threshold', () => {
      expect(isDuplicateTask('fix login', ['fix the login bug'], 0.9)).toBe(false);
      expect(isDuplicateTask('fix login', ['fix the login bug'], 0.3)).toBe(true);
    });
  });

  describe('checkFileExistence', () => {
    it('categorizes files as found or missing', () => {
      const result = checkFileExistence(['exists.ts', 'missing.ts'], '/tmp');
      expect(result.found).toContain('exists.ts');
      expect(result.missing).toContain('missing.ts');
    });

    it('handles absolute paths', () => {
      const result = checkFileExistence(['/real/exists.ts', '/fake/missing.ts'], '/tmp');
      expect(result.found).toContain('/real/exists.ts');
      expect(result.missing).toContain('/fake/missing.ts');
    });

    it('handles empty list', () => {
      const result = checkFileExistence([], '/tmp');
      expect(result.found).toEqual([]);
      expect(result.missing).toEqual([]);
    });
  });

  describe('checkToolAvailability', () => {
    it('finds missing tools mentioned in task', () => {
      const missing = checkToolAvailability('run vitest and eslint', ['node', 'npx']);
      expect(missing).toContain('vitest');
      expect(missing).toContain('eslint');
    });

    it('returns empty when all tools available', () => {
      const missing = checkToolAvailability('run vitest', ['vitest', 'node']);
      expect(missing).toEqual([]);
    });

    it('ignores tools not mentioned in task', () => {
      const missing = checkToolAvailability('hello world', ['node']);
      expect(missing).toEqual([]);
    });

    it('detects multiple tool patterns', () => {
      const missing = checkToolAvailability('use tsc then prettier then jq', []);
      expect(missing).toContain('tsc');
      expect(missing).toContain('prettier');
      expect(missing).toContain('jq');
    });
  });

  describe('estimateComplexity', () => {
    it('returns low for simple tasks', () => {
      expect(estimateComplexity('fix typo')).toBe('low');
    });

    it('returns medium for moderate tasks', () => {
      const task = 'Read `src/a.ts`, `src/b.ts`, `src/c.ts`, `src/d.ts` then update them all. Also check `src/e.ts`.';
      expect(['medium', 'high']).toContain(estimateComplexity(task));
    });

    it('returns high for complex tasks', () => {
      const task = Array(50).fill('Read `file.ts` then edit `other.ts` after that finally also next step 1. 2. 3. 4.').join(' ');
      expect(estimateComplexity(task)).toBe('high');
    });

    it('considers step counts', () => {
      const task = '1. do A 2. do B 3. do C 4. do D';
      const c = estimateComplexity(task);
      expect(['medium', 'high']).toContain(c);
    });
  });

  describe('checkOutputDirectory', () => {
    it('returns valid when no write paths', () => {
      expect(checkOutputDirectory('read something', '/tmp').valid).toBe(true);
    });

    it('returns valid when dir exists', () => {
      expect(checkOutputDirectory('create `/real/exists.ts`', '/tmp').valid).toBe(true);
    });
  });

  describe('validateTask', () => {
    it('rejects empty task', () => {
      const result = validateTask('');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('rejects very short task', () => {
      const result = validateTask('fix');
      expect(result.valid).toBe(false);
    });

    it('rejects duplicate task', () => {
      const result = validateTask('fix the login bug in auth module', {
        recentTasks: ['fix the login bug in auth module'],
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('duplicate');
    });

    it('rejects task with too many file ops', () => {
      const task = 'Edit `a.ts`, `b.ts`, `c.ts`, `d.ts`, `e.ts`, `f.ts`, `g.ts`, `h.ts`';
      const result = validateTask(task, { maxFileOps: 3 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('file operations');
    });

    it('accepts valid task', () => {
      const result = validateTask('Implement a new feature for the dashboard component');
      expect(result.valid).toBe(true);
    });

    it('warns about missing tools', () => {
      const result = validateTask('Run eslint on the project to check for errors', {
        availableTools: ['node'],
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('eslint'))).toBe(true);
    });

    it('warns about high complexity', () => {
      const task = Array(50).fill('Edit `file.ts` then also next finally 1. 2. 3. 4.').join(' ');
      const result = validateTask(task);
      expect(result.warnings?.some(w => w.includes('complexity'))).toBe(true);
    });

    it('includes estimatedComplexity', () => {
      const result = validateTask('Simple fix for a small bug in the code');
      expect(result.estimatedComplexity).toBeDefined();
    });
  });
});
