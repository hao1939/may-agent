import { describe, it, expect, vi } from 'vitest';

// Test the exported pure functions from finish-guard
import {
  validateFinishDeliverables,
  enforceFinishDeliverables,
  validateVerificationEvidence,
  enforceVerificationEvidence,
} from '../guards/finish-guard';

// Also import the guard
const guardModule = await import('../guards/finish-guard');
const { guard } = guardModule;

describe('finish-guard', () => {
  describe('isPersistentTaskRequired (via guard)', () => {
    const makeEvent = (task: string, status: string, messages: any[] = []) => ({
      type: 'step_done',
      task,
      step: task,
      result: {
        finishResult: { status },
        messages,
        lastAssistantText: '',
      },
    });

    it('returns empty for non step_done', () => {
      expect(guard.handle({ type: 'step_start' } as any)).toEqual([]);
    });

    it('returns empty when no finishResult', () => {
      expect(guard.handle({ type: 'step_done', result: {} } as any)).toEqual([]);
    });

    it('returns empty for non-success finish', () => {
      expect(guard.handle({
        type: 'step_done',
        task: 'use persistent-task workflow',
        result: { finishResult: { status: 'partial' } },
      } as any)).toEqual([]);
    });

    it('returns empty when task does not require persistent-task', () => {
      expect(guard.handle(makeEvent('fix this bug', 'success'))).toEqual([]);
    });

    it('blocks when task mentions persistent-task but not run', () => {
      const result = guard.handle(makeEvent('run the persistent-task workflow for X', 'success'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('block');
      expect(result[0].reason).toContain('FM-3.4');
    });

    it('blocks when task has project: field', () => {
      const result = guard.handle(makeEvent('project: /app/projects/foo\ngoal: do stuff', 'success'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('block');
    });

    it('passes when persistent-task workflow was invoked via toolCall', () => {
      const messages = [{
        content: [{
          type: 'toolCall',
          name: 'workflow',
          arguments: { action: 'run', name: 'persistent-task' },
        }],
      }];
      const result = guard.handle(makeEvent('run the persistent-task workflow', 'success', messages));
      expect(result).toEqual([]);
    });

    it('passes when persistent-task workflow was invoked via tool_use', () => {
      const messages = [{
        content: [{
          type: 'tool_use',
          name: 'workflow',
          input: { action: 'run', name: 'persistent-task' },
        }],
      }];
      const result = guard.handle(makeEvent('must use persistent-task', 'success', messages));
      expect(result).toEqual([]);
    });

    it('passes when result text mentions persistent-task workflow.run', () => {
      const event = {
        type: 'step_done',
        task: 'use persistent-task workflow',
        result: {
          finishResult: { status: 'success' },
          messages: [],
          lastAssistantText: 'I used persistent-task via workflow.run and completed 3 iterations',
        },
      };
      expect(guard.handle(event as any)).toEqual([]);
    });

    it('detects workflow.run("persistent-task" in task text', () => {
      const result = guard.handle(makeEvent('workflow.run("persistent-task", "...")', 'success'));
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('block');
    });
  });

  describe('validateFinishDeliverables', () => {
    it('returns valid for null deliverables', () => {
      expect(validateFinishDeliverables(null, 'success', '/tmp')).toEqual({ valid: true, missing: [] });
    });

    it('returns valid for empty deliverables', () => {
      expect(validateFinishDeliverables([], 'success', '/tmp')).toEqual({ valid: true, missing: [] });
    });

    it('reports missing files', () => {
      const result = validateFinishDeliverables(
        [{ path: 'nonexistent-file-xyz.txt', description: 'test' }],
        'success',
        '/tmp',
      );
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('nonexistent-file-xyz.txt');
    });
  });

  describe('enforceFinishDeliverables', () => {
    it('skips for non-success status', () => {
      expect(() => enforceFinishDeliverables(
        [{ path: 'nonexistent.txt', description: 'test' }],
        'partial',
        '/tmp',
      )).not.toThrow();
    });

    it('throws for missing deliverables on success', () => {
      expect(() => enforceFinishDeliverables(
        [{ path: 'nonexistent-xyz.txt', description: 'test' }],
        'success',
        '/tmp',
      )).toThrow('Ghost deliverables');
    });
  });

  describe('validateVerificationEvidence', () => {
    it('returns valid for non-success status', () => {
      const result = validateVerificationEvidence({ status: 'partial' });
      expect(result.valid).toBe(true);
    });

    it('warns when success has no evidence', () => {
      const result = validateVerificationEvidence({ status: 'success' });
      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
    });

    it('warns when success has empty evidence', () => {
      const result = validateVerificationEvidence({ status: 'success', verification_evidence: [] });
      expect(result.valid).toBe(false);
    });

    it('passes when success has evidence', () => {
      const result = validateVerificationEvidence({
        status: 'success',
        verification_evidence: ['test passed'],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('enforceVerificationEvidence', () => {
    it('returns warnings array', () => {
      const warnings = enforceVerificationEvidence({ status: 'success' });
      expect(warnings).toHaveLength(1);
    });

    it('returns empty for non-success', () => {
      expect(enforceVerificationEvidence({ status: 'failure' })).toEqual([]);
    });
  });
});
