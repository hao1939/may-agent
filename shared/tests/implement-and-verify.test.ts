import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock dependencies before importing
vi.mock('../workflows/fewshot-inject-helpers.js', () => ({
  injectFewShot: (task: string) => task,
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('implement-and-verify', () => {
  let mod: any;
  let execSyncMock: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('../workflows/fewshot-inject-helpers.js', () => ({
      injectFewShot: (task: string) => task,
    }));
    const cp = await import('node:child_process');
    execSyncMock = vi.mocked(cp.execSync);
    mod = await import('../workflows/implement-and-verify');
  });

  it('exports name and description', () => {
    expect(mod.name).toBe('implement-and-verify');
    expect(mod.description).toBeTruthy();
  });

  it('exports an execute function', () => {
    expect(typeof mod.execute).toBe('function');
  });

  describe('execute', () => {
    const makeCtx = (task: string) => {
      const events: any[] = [];
      return {
        task,
        agent: 'coder',
        emit: (e: any) => events.push(e),
        runAgent: vi.fn(),
        escalate: vi.fn((msg: string, data?: any) => ({ type: 'escalate', message: msg, data })),
        done: vi.fn((msg: string) => ({ type: 'done', message: msg })),
        events,
      };
    };

    it('escalates on empty task', async () => {
      const ctx = makeCtx('');
      const result = await mod.execute(ctx);
      expect(ctx.escalate).toHaveBeenCalled();
    });

    it('escalates when only metadata lines present', async () => {
      const ctx = makeCtx('verifyCommand: echo hi\nmaxAttempts: 3');
      const result = await mod.execute(ctx);
      expect(ctx.escalate).toHaveBeenCalled();
    });

    it('runs coder then verifies - success on first attempt', async () => {
      execSyncMock.mockReturnValue('All tests passed');
      const ctx = makeCtx('Fix the bug in foo.ts');
      ctx.runAgent.mockResolvedValue({ status: 'ok', lastAssistantText: 'Fixed it' });
      
      await mod.execute(ctx);
      expect(ctx.runAgent).toHaveBeenCalledTimes(1);
      expect(ctx.done).toHaveBeenCalled();
    });

    it('retries on verification failure', async () => {
      // First verify fails, second succeeds
      execSyncMock
        .mockImplementationOnce(() => { throw { status: 1, stdout: 'error', stderr: '' }; })
        .mockReturnValueOnce('All tests passed');
      
      const ctx = makeCtx('Fix the bug');
      ctx.runAgent
        .mockResolvedValueOnce({ status: 'ok', lastAssistantText: 'attempt 1' })
        .mockResolvedValueOnce({ status: 'ok', lastAssistantText: 'attempt 2' });
      
      await mod.execute(ctx);
      expect(ctx.runAgent).toHaveBeenCalledTimes(2);
      expect(ctx.done).toHaveBeenCalled();
    });

    it('escalates after all attempts exhausted', async () => {
      execSyncMock.mockImplementation(() => { throw { status: 1, stdout: 'fail', stderr: '' }; });
      
      const ctx = makeCtx('Fix the bug');
      ctx.runAgent.mockResolvedValue({ status: 'ok', lastAssistantText: 'tried' });
      
      await mod.execute(ctx);
      expect(ctx.escalate).toHaveBeenCalledWith(
        expect.stringContaining('failed after'),
        expect.any(Object),
      );
    });

    it('escalates on coder error (first attempt, after retry)', async () => {
      const ctx = makeCtx('Fix it');
      ctx.runAgent.mockResolvedValue({ status: 'error', error: 'boom' });
      
      await mod.execute(ctx);
      expect(ctx.escalate).toHaveBeenCalled();
    });

    it('escalates on coder error on second attempt', async () => {
      execSyncMock.mockImplementationOnce(() => { throw { status: 1, stdout: 'err', stderr: '' }; });
      
      const ctx = makeCtx('Fix it');
      ctx.runAgent
        .mockResolvedValueOnce({ status: 'ok', lastAssistantText: 'first' })
        .mockResolvedValueOnce({ status: 'error', error: 'boom' });
      
      await mod.execute(ctx);
      expect(ctx.escalate).toHaveBeenCalled();
    });

    it('respects custom verifyCommand', async () => {
      execSyncMock.mockReturnValue('ok');
      const ctx = makeCtx('verifyCommand: echo hello\nDo the task');
      ctx.runAgent.mockResolvedValue({ status: 'ok', lastAssistantText: 'done' });
      
      await mod.execute(ctx);
      expect(execSyncMock).toHaveBeenCalledWith('echo hello', expect.any(Object));
    });

    it('respects custom maxAttempts', async () => {
      execSyncMock.mockImplementation(() => { throw { status: 1, stdout: 'fail', stderr: '' }; });
      const ctx = makeCtx('maxAttempts: 3\nDo the task');
      ctx.runAgent.mockResolvedValue({ status: 'ok', lastAssistantText: 'tried' });
      
      await mod.execute(ctx);
      expect(ctx.runAgent).toHaveBeenCalledTimes(3);
    });

    it('handles verification with no output', async () => {
      execSyncMock.mockReturnValue('');
      const ctx = makeCtx('Do the task');
      ctx.runAgent.mockResolvedValue({ status: 'ok', lastAssistantText: 'done' });
      
      await mod.execute(ctx);
      expect(ctx.done).toHaveBeenCalled();
    });

    it('truncates long verification output', async () => {
      const longOutput = 'x'.repeat(5000);
      execSyncMock
        .mockImplementationOnce(() => { throw { status: 1, stdout: longOutput, stderr: '' }; })
        .mockReturnValueOnce('ok');
      
      const ctx = makeCtx('Do the task');
      ctx.runAgent.mockResolvedValue({ status: 'ok', lastAssistantText: 'done' });
      
      await mod.execute(ctx);
      // Second call to runAgent should have truncated error in task
      const secondCallTask = ctx.runAgent.mock.calls[1][1];
      expect(secondCallTask).toContain('truncated');
    });

    it('retries coder once on first attempt error then succeeds', async () => {
      execSyncMock.mockReturnValue('pass');
      const ctx = makeCtx('Do the task');
      ctx.runAgent
        .mockResolvedValueOnce({ status: 'error', error: 'transient' })
        .mockResolvedValueOnce({ status: 'ok', lastAssistantText: 'fixed' });
      
      await mod.execute(ctx);
      expect(ctx.runAgent).toHaveBeenCalledTimes(2);
      expect(ctx.done).toHaveBeenCalled();
    });
  });
});
