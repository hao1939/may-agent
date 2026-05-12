import { describe, it, expect, beforeEach, mock } from 'bun:test';

describe('verify-wrap workflow', () => {
  let mod: any;

  beforeEach(async () => {
    mod = await import('../workflows/verify-wrap');
  });

  it('exports name and description', () => {
    expect(mod.name).toBe('verify-wrap');
    expect(mod.description).toBeTruthy();
  });

  it('runs agent and returns done on success', async () => {
    const calls: Record<string, any[]> = { runAgent: [], done: [], summarize: [] };
    const ctx = {
      agent: 'test-agent',
      task: 'do something',
      runAgent: async (...args: any[]) => { calls.runAgent.push(args); return { status: 'ok', lastAssistantText: 'done' }; },
      escalate: (...args: any[]) => { calls.escalate = args; return { type: 'escalate', message: args[0] }; },
      done: (msg: string) => { calls.done.push(msg); return { type: 'done', message: msg }; },
      summarize: () => { calls.summarize.push([]); return 'Agent completed successfully'; },
    };

    await mod.execute(ctx);
    expect(calls.runAgent[0]).toEqual(['test-agent', 'do something']);
    expect(calls.done.length).toBeGreaterThan(0);
  });

  it('escalates on agent error', async () => {
    const calls: Record<string, any[]> = { escalate: [] };
    const ctx = {
      agent: 'test-agent',
      task: 'do something',
      runAgent: async () => ({ status: 'error', error: 'boom', lastAssistantText: 'failed' }),
      escalate: (msg: string) => { calls.escalate.push(msg); return { type: 'escalate', message: msg }; },
      done: () => {},
      summarize: () => '',
    };

    await mod.execute(ctx);
    expect(calls.escalate.length).toBeGreaterThan(0);
    expect(calls.escalate[0]).toContain('test-agent');
  });

  it('handles non-string summarize result', async () => {
    const calls: Record<string, any[]> = { done: [] };
    const ctx = {
      agent: 'a',
      task: 't',
      runAgent: async () => ({ status: 'ok' }),
      escalate: () => {},
      done: (msg: string) => { calls.done.push(msg); return { type: 'done', message: msg }; },
      summarize: () => ({ text: 'obj' }),
    };

    await mod.execute(ctx);
    expect(calls.done.length).toBeGreaterThan(0);
    expect(calls.done[0]).toContain('completed task successfully');
  });

  it('uses error message when no lastAssistantText', async () => {
    const calls: Record<string, any[]> = { escalate: [] };
    const ctx = {
      agent: 'myagent',
      task: 't',
      runAgent: async () => ({ status: 'error', error: 'timeout' }),
      escalate: (msg: string) => { calls.escalate.push(msg); return { type: 'escalate', message: msg }; },
      done: () => {},
      summarize: () => '',
    };

    await mod.execute(ctx);
    expect(calls.escalate.length).toBeGreaterThan(0);
    expect(calls.escalate[0]).toContain('myagent');
  });
});
