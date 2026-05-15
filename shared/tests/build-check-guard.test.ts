import { describe, it, expect } from 'bun:test';

// Import the guard module
const guardModule = await import('../guards/build-check');
const { guard } = guardModule;

describe('build-check guard', () => {
  const makeEvent = (step: string, text: string): any => ({
    type: 'step_done',
    source: 'agent',
    step,
    result: { lastAssistantText: text },
  });

  it('returns empty for non step_done events', () => {
    expect(guard.handle({ type: 'step_start', step: 'coder', result: {} } as any)).toEqual([]);
  });

  it('returns empty for non-agent sources', () => {
    expect(guard.handle({ type: 'step_done', source: 'shell', step: 'coder', result: {} } as any)).toEqual([]);
  });

  it('returns empty for non-coding steps', () => {
    expect(guard.handle(makeEvent('reviewer', 'looks good'))).toEqual([]);
  });

  it('returns empty when build success is mentioned', () => {
    expect(guard.handle(makeEvent('coder', 'build passes, all good'))).toEqual([]);
  });

  it('returns empty when tests pass is mentioned', () => {
    expect(guard.handle(makeEvent('coder', 'tests pass successfully'))).toEqual([]);
  });

  it('returns empty when exit code 0 is mentioned', () => {
    expect(guard.handle(makeEvent('coder', 'exit code 0'))).toEqual([]);
  });

  it('returns empty when ✅ is mentioned', () => {
    expect(guard.handle(makeEvent('coder', '✅ done'))).toEqual([]);
  });

  it('returns empty for "all 5 tests pass"', () => {
    expect(guard.handle(makeEvent('coder', 'all 5 tests pass'))).toEqual([]);
  });

  it('warns when no success indicator in coding step', () => {
    const result = guard.handle(makeEvent('coder', 'I made some changes'));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
    expect(result[0].reason).toContain('coder');
  });

  it('warns for implement step without success', () => {
    const result = guard.handle(makeEvent('implement-task', 'done with changes'));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
  });

  it('warns for fix step without success', () => {
    const result = guard.handle(makeEvent('fix-bug', 'changed the code'));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
  });

  it('handles missing lastAssistantText', () => {
    const event = { type: 'step_done', source: 'agent', step: 'coder', result: {} };
    const result = guard.handle(event as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
  });
});
