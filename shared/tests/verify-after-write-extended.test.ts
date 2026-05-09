import { describe, it, expect } from 'vitest';

// Import internal functions by reading the module
// verify-after-write exports a guard object
import { guard } from '../guards/verify-after-write.js';

function makeEvent(messages: any[], completedSteps: any[] = [], finishResult?: any) {
  return {
    type: 'step_done' as const,
    source: 'agent',
    result: { messages, finishResult },
    completedSteps,
  };
}

function toolCallMsg(name: string, path?: string, index = 0) {
  return {
    role: 'assistant',
    content: [
      {
        type: 'toolCall',
        name,
        arguments: path ? { path } : {},
      },
    ],
  };
}

describe('verify-after-write guard', () => {
  it('has correct name', () => {
    expect(guard.name).toBe('verify-after-write');
  });

  it('handles step_done events', () => {
    expect(guard.events).toContain('step_done');
  });

  it('ignores non-step_done events', () => {
    const event = { type: 'other', source: 'agent', result: { messages: [] } } as any;
    expect(guard.handle(event)).toEqual([]);
  });

  it('ignores function-source events', () => {
    const event = makeEvent([]) as any;
    event.source = 'function';
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('returns empty when no finish and no writes', () => {
    const event = makeEvent([]);
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('returns empty when writes are verified', () => {
    const event = makeEvent(
      [
        toolCallMsg('write', 'foo.ts'),
        toolCallMsg('read', 'foo.ts'),
      ],
      [],
      { status: 'success' },
    );
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('allows finish when writes are unverified because write returns a preview', () => {
    const event = makeEvent(
      [toolCallMsg('write', 'foo.ts')],
      [],
      { status: 'success' },
    );
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('blocks finish when edit is unverified', () => {
    const event = makeEvent(
      [toolCallMsg('edit', 'bar.ts')],
      [],
      { status: 'success' },
    );
    const demands = guard.handle(event as any);
    expect(demands.length).toBe(1);
    expect(demands[0].type).toBe('block');
    expect(demands[0].reason).toContain('bar.ts');
  });

  it('allows finish when write in earlier step was read in later step', () => {
    const event = makeEvent(
      [toolCallMsg('read', 'foo.ts')],
      [{ result: { messages: [toolCallMsg('write', 'foo.ts')] } }],
      { status: 'success' },
    );
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('allows finish when write in earlier step was never read', () => {
    const event = makeEvent(
      [toolCallMsg('read', 'other.ts')],
      [{ result: { messages: [toolCallMsg('write', 'foo.ts')] } }],
      { status: 'success' },
    );
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('does not block non-success finish', () => {
    const event = makeEvent(
      [toolCallMsg('write', 'foo.ts')],
      [],
      { status: 'failure' },
    );
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('handles multiple unverified files', () => {
    const event = makeEvent(
      [
        toolCallMsg('write', 'a.ts'),
        toolCallMsg('edit', 'b.ts'),
      ],
      [],
      { status: 'success' },
    );
    const demands = guard.handle(event as any);
    expect(demands.length).toBe(1);
    expect(demands[0].reason).toContain('b.ts');
    expect(demands[0].reason).not.toContain('a.ts');
  });

  it('normalizes paths with ./', () => {
    const event = makeEvent(
      [
        toolCallMsg('write', './foo.ts'),
        toolCallMsg('read', 'foo.ts'),
      ],
      [],
      { status: 'success' },
    );
    expect(guard.handle(event as any)).toEqual([]);
  });
});
