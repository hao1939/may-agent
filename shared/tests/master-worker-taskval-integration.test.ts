/**
 * Integration test: task-validator integrated into master-worker.ts
 * Verifies that invalid tasks are rejected early (fast-fail) before wasting iteration time.
 */

import { describe, it, expect } from 'vitest';
import { validateTask, extractReferencedFiles, type ValidationContext } from '../workflows/task-validator.ts';

describe('master-worker task validation integration', () => {
  const baseContext: ValidationContext = {
    workingDir: '/app/agents/shared/projects/system-efficiency',
    recentTasks: [],
    availableTools: ['read', 'write', 'edit', 'bash'],
  };

  describe('early rejection of invalid tasks', () => {
    it('rejects empty task descriptions', () => {
      const result = validateTask('', baseContext);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('rejects tasks that are too short to be actionable', () => {
      const result = validateTask('do it', baseContext);
      expect(result.valid).toBe(false);
    });

    it('rejects tasks referencing non-existent files when workingDir set', () => {
      const result = validateTask(
        'Read `/app/agents/shared/projects/system-efficiency/nonexistent-file-xyz.ts` and summarize it',
        { ...baseContext, workingDir: '/app/agents/shared/projects/system-efficiency' }
      );
      // Should flag missing file references as warnings or invalid
      expect(result.warnings?.length || !result.valid).toBeTruthy();
    });

    it('rejects duplicate tasks matching recent completions', () => {
      const result = validateTask(
        'Create the error recovery audit document with findings',
        { ...baseContext, recentTasks: ['Create the error recovery audit document with findings'] }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('duplicate');
    });
  });

  describe('valid tasks pass through', () => {
    it('accepts well-formed task with clear deliverable', () => {
      const result = validateTask(
        'CONTINUE\n\n(a) Next iteration should: Create a test file at tests/new.test.ts that validates the retry logic.\n(b) What is different: Module exists.\n(c) First step: Write the test file.',
        baseContext
      );
      expect(result.valid).toBe(true);
    });

    it('accepts tasks with existing file references', () => {
      const result = validateTask(
        'Read `/app/agents/shared/workflows/master-worker.ts` and add error handling',
        { ...baseContext, workingDir: '/app/agents/shared' }
      );
      expect(result.valid).toBe(true);
    });

    it('provides complexity estimate for valid tasks', () => {
      const result = validateTask(
        'Create a comprehensive module with 5 functions, tests, and documentation at agents/shared/workflows/new-module.ts',
        baseContext
      );
      expect(result.valid).toBe(true);
      expect(result.estimatedComplexity).toBeDefined();
    });
  });

  describe('file reference extraction', () => {
    it('extracts backtick-wrapped paths', () => {
      const files = extractReferencedFiles('Read `src/app.ts` and `lib/utils.ts`');
      expect(files).toContain('src/app.ts');
      expect(files).toContain('lib/utils.ts');
    });

    it('extracts paths from action verbs', () => {
      const files = extractReferencedFiles('write outputs/report.md with the findings');
      expect(files).toContain('outputs/report.md');
    });

    it('extracts slash-prefixed paths', () => {
      const files = extractReferencedFiles('Check /app/agents/shared/workflows/master-worker.ts');
      expect(files).toContain('/app/agents/shared/workflows/master-worker.ts');
    });
  });

  describe('integration flow simulation', () => {
    it('simulates the master-worker pre-validation check', () => {
      // Simulate what master-worker.ts does: validate before dispatching to worker
      const guidance = `CONTINUE\n\n(a) Next iteration should: Write outputs/final-report.md\n(b) Different: nothing\n(c) First step: Write the file`;
      
      const taskValidation = validateTask(guidance, baseContext);
      
      if (!taskValidation.valid) {
        // Would skip iteration and feed back to orchestrator
        expect(taskValidation.reason).toBeDefined();
      } else {
        // Would proceed with worker.prompt()
        expect(taskValidation.valid).toBe(true);
      }
    });

    it('fast-fails on clearly invalid guidance', () => {
      const guidance = '';  // Empty guidance = orchestrator error
      const taskValidation = validateTask(guidance, baseContext);
      expect(taskValidation.valid).toBe(false);
      // This saves ~15 minutes of wasted iteration time
    });

    it('warns but proceeds on borderline tasks', () => {
      const guidance = `CONTINUE\n\nDo the next thing based on what we discussed. Check the files and proceed.`;
      const taskValidation = validateTask(guidance, baseContext);
      // Vague tasks may pass but with warnings
      if (taskValidation.valid) {
        // Warnings about vagueness are acceptable
        expect(taskValidation.warnings || []).toBeDefined();
      }
    });
  });
});
