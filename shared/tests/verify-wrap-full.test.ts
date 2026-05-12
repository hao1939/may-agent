import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('verify-wrap workflow', () => {
  let mod: any;

  beforeEach(async () => {
    vi.resetModules();
    mod = await import('../workflows/verify-wrap');
  });

  it('exports name and description', () => {
    expect(mod.name).toBe('verify-wrap');
    expect(mod.description).toBeTruthy();
  });

  it('runs agent and returns done on success', async () => {
    const ctx = {
      agent: 'test-agent',
      task: 'do something',
      runAgent: vi.fn().mockResolvedValue({ status: 'ok', lastAssistantText: 'done' }),
      escalate: vi.fn(),
      done: vi.fn((msg: string) => ({ type: 'done', message: msg })),
      summarize: vi.fn().mockReturnValue('Agent completed successfully'),
    };

    await mod.execute(ctx);
    expect(ctx.runAgent).toHaveBeenCalledWith('test-agent', 'do something');
    expect(ctx.done).toHaveBeenCalled();
  });

  it('escalates on agent error', async () => {
    const ctx = {
      agent: 'test-agent',
      task: 'do something',
      runAgent: vi.fn().mockResolvedValue({ status: 'error', error: 'boom', lastAssistantText: 'failed' }),
      escalate: vi.fn((msg: string) => ({ type: 'escalate', message: msg })),
      done: vi.fn(),
      summarize: vi.fn(),
    };

    await mod.execute(ctx);
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining('test-agent'));
  });

  it('handles non-string summarize result', async () => {
    const ctx = {
      agent: 'a',
      task: 't',
      runAgent: vi.fn().mockResolvedValue({ status: 'ok' }),
      escalate: vi.fn(),
      done: vi.fn((msg: string) => ({ type: 'done', message: msg })),
      summarize: vi.fn().mockReturnValue({ text: 'obj' }),
    };

    await mod.execute(ctx);
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining('completed task successfully'));
  });

  it('uses error message when no lastAssistantText', async () => {
    const ctx = {
      agent: 'myagent',
      task: 't',
      runAgent: vi.fn().mockResolvedValue({ status: 'error', error: 'timeout' }),
      escalate: vi.fn((msg: string) => ({ type: 'escalate', message: msg })),
      done: vi.fn(),
      summarize: vi.fn(),
    };

    await mod.execute(ctx);
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining('myagent'));
  });
});
