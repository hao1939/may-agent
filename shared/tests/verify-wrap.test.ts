import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for workflows/verify-wrap.ts
 * 
 * verify-wrap is a simple wrapper workflow that runs an agent task
 * and handles success/error outcomes. We replicate its logic here
 * to test the decision paths.
 */

// Replicate the core logic from verify-wrap.ts
function verifyWrapLogic(result: { status: string; error?: string; lastAssistantText?: string }, agent: string, summarizeFn: (r: any, opts: any) => string | object): { action: 'done' | 'escalate'; message: string } {
  if (result.status === "error") {
    const detail = result.error || result.lastAssistantText?.slice(0, 200);
    return { action: 'escalate', message: `Agent ${agent} failed: ${detail}` };
  }

  const summary = summarizeFn(result, { maxLength: 300 });
  const message = typeof summary === "string" ? summary : `${agent} completed task successfully.`;
  return { action: 'done', message };
}

describe('verify-wrap logic', () => {
  describe('error handling', () => {
    it('escalates when status is error with error message', () => {
      const result = verifyWrapLogic(
        { status: 'error', error: 'timeout exceeded' },
        'worker',
        () => ''
      );
      expect(result.action).toBe('escalate');
      expect(result.message).toBe('Agent worker failed: timeout exceeded');
    });

    it('escalates with lastAssistantText when no error message', () => {
      const result = verifyWrapLogic(
        { status: 'error', lastAssistantText: 'Something went wrong in the process' },
        'researcher',
        () => ''
      );
      expect(result.action).toBe('escalate');
      expect(result.message).toBe('Agent researcher failed: Something went wrong in the process');
    });

    it('truncates lastAssistantText to 200 chars', () => {
      const longText = 'x'.repeat(500);
      const result = verifyWrapLogic(
        { status: 'error', lastAssistantText: longText },
        'agent1',
        () => ''
      );
      expect(result.message).toBe(`Agent agent1 failed: ${'x'.repeat(200)}`);
    });

    it('escalates with undefined when no error and no lastAssistantText', () => {
      const result = verifyWrapLogic(
        { status: 'error' },
        'myagent',
        () => ''
      );
      expect(result.message).toBe('Agent myagent failed: undefined');
    });

    it('prefers error over lastAssistantText', () => {
      const result = verifyWrapLogic(
        { status: 'error', error: 'real error', lastAssistantText: 'fallback text' },
        'worker',
        () => ''
      );
      expect(result.message).toContain('real error');
      expect(result.message).not.toContain('fallback text');
    });
  });

  describe('success handling', () => {
    it('returns done with string summary', () => {
      const result = verifyWrapLogic(
        { status: 'success' },
        'worker',
        () => 'Task completed successfully'
      );
      expect(result.action).toBe('done');
      expect(result.message).toBe('Task completed successfully');
    });

    it('returns default message when summary is not a string', () => {
      const result = verifyWrapLogic(
        { status: 'success' },
        'optimizer',
        () => ({ key: 'value' }) as any
      );
      expect(result.action).toBe('done');
      expect(result.message).toBe('optimizer completed task successfully.');
    });

    it('returns done for any non-error status', () => {
      const result = verifyWrapLogic(
        { status: 'partial' },
        'worker',
        () => 'partial result'
      );
      expect(result.action).toBe('done');
      expect(result.message).toBe('partial result');
    });

    it('passes maxLength 300 to summarize', () => {
      const summarizeFn = vi.fn().mockReturnValue('summary');
      verifyWrapLogic({ status: 'success' }, 'worker', summarizeFn);
      expect(summarizeFn).toHaveBeenCalledWith({ status: 'success' }, { maxLength: 300 });
    });

    it('handles empty string summary', () => {
      const result = verifyWrapLogic(
        { status: 'success' },
        'worker',
        () => ''
      );
      // empty string is still typeof string
      expect(result.action).toBe('done');
      expect(result.message).toBe('');
    });
  });

  describe('agent name in messages', () => {
    it('includes agent name in error escalation', () => {
      const result = verifyWrapLogic(
        { status: 'error', error: 'oops' },
        'custom-agent-name',
        () => ''
      );
      expect(result.message).toContain('custom-agent-name');
    });

    it('includes agent name in default success message', () => {
      const result = verifyWrapLogic(
        { status: 'success' },
        'my-special-agent',
        () => ({}) as any
      );
      expect(result.message).toContain('my-special-agent');
    });
  });

  describe('edge cases', () => {
    it('handles status with extra whitespace in error field', () => {
      const result = verifyWrapLogic(
        { status: 'error', error: '  ' },
        'worker',
        () => ''
      );
      // truthy string, so error is used
      expect(result.message).toBe('Agent worker failed:   ');
    });

    it('handles lastAssistantText exactly 200 chars', () => {
      const text = 'a'.repeat(200);
      const result = verifyWrapLogic(
        { status: 'error', lastAssistantText: text },
        'worker',
        () => ''
      );
      expect(result.message).toBe(`Agent worker failed: ${text}`);
    });

    it('handles lastAssistantText under 200 chars', () => {
      const text = 'short message';
      const result = verifyWrapLogic(
        { status: 'error', lastAssistantText: text },
        'worker',
        () => ''
      );
      expect(result.message).toBe('Agent worker failed: short message');
    });
  });
});
