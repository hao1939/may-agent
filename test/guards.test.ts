import { describe, it, expect } from 'vitest';

// We test the guard handle() functions by importing the guard objects
// and calling handle() with mock events.

import { guard as hallucinatedPathGuard } from '../shared/guards/hallucinated-path.ts';
import { guard as readBeforeEditGuard } from '../shared/guards/read-before-edit.ts';

function makeEvent(overrides: any = {}): any {
  return {
    type: 'step_done',
    source: 'agent',
    step: 'coder',
    result: { messages: [], lastAssistantText: '' },
    completedSteps: [],
    ...overrides,
  };
}

function makeToolCallMsg(name: string, args: any) {
  return {
    content: [{ type: 'toolCall', name, arguments: args }],
  };
}

describe('hallucinated-path guard', () => {
  it('returns empty for clean commands', () => {
    const event = makeEvent({
      result: {
        messages: [makeToolCallMsg('bash', { command: 'ls /app/src' })],
        lastAssistantText: '',
      },
    });
    expect(hallucinatedPathGuard.handle(event)).toEqual([]);
  });

  it('warns on /home/ paths in bash commands', () => {
    const event = makeEvent({
      result: {
        messages: [makeToolCallMsg('bash', { command: 'cat /home/user/file.txt' })],
        lastAssistantText: '',
      },
    });
    const demands = hallucinatedPathGuard.handle(event);
    expect(demands.length).toBe(1);
    expect(demands[0].type).toBe('warn');
    expect(demands[0].reason).toContain('C7.1');
  });

  it('blocks on /Users/ paths', () => {
    const event = makeEvent({
      result: {
        messages: [makeToolCallMsg('bash', { command: 'cd /Users/dev/project' })],
        lastAssistantText: '',
      },
    });
    expect(hallucinatedPathGuard.handle(event).length).toBe(1);
  });

  it('allows grep commands that reference /home/', () => {
    const event = makeEvent({
      result: {
        messages: [makeToolCallMsg('bash', { command: 'grep /home/user config.txt' })],
        lastAssistantText: '',
      },
    });
    expect(hallucinatedPathGuard.handle(event)).toEqual([]);
  });

  it('skips function source events', () => {
    const event = makeEvent({
      source: 'function',
      result: {
        messages: [makeToolCallMsg('bash', { command: 'cat /home/x/y' })],
        lastAssistantText: '',
      },
    });
    expect(hallucinatedPathGuard.handle(event)).toEqual([]);
  });
});

describe('read-before-edit guard', () => {
  it('returns empty when read precedes edit', () => {
    const event = makeEvent({
      result: {
        messages: [
          makeToolCallMsg('read', { path: 'src/app.ts' }),
          makeToolCallMsg('edit', { path: 'src/app.ts', oldText: 'a', newText: 'b' }),
        ],
        lastAssistantText: '',
      },
    });
    expect(readBeforeEditGuard.handle(event)).toEqual([]);
  });

  it('warns when edit without prior read', () => {
    const event = makeEvent({
      result: {
        messages: [
          makeToolCallMsg('edit', { path: 'src/app.ts', oldText: 'a', newText: 'b' }),
        ],
        lastAssistantText: '',
      },
    });
    const demands = readBeforeEditGuard.handle(event);
    expect(demands.length).toBe(1);
    expect(demands[0].type).toBe('warn');
    expect(demands[0].reason).toContain('C1.1');
    expect(demands[0].reason).toContain('src/app.ts');
  });

  it('normalizes paths with leading ./', () => {
    const event = makeEvent({
      result: {
        messages: [
          makeToolCallMsg('read', { path: './src/app.ts' }),
          makeToolCallMsg('edit', { path: 'src/app.ts', oldText: 'a', newText: 'b' }),
        ],
        lastAssistantText: '',
      },
    });
    expect(readBeforeEditGuard.handle(event)).toEqual([]);
  });

  it('skips function source events', () => {
    const event = makeEvent({
      source: 'function',
      result: {
        messages: [makeToolCallMsg('edit', { path: 'x.ts', oldText: 'a', newText: 'b' })],
        lastAssistantText: '',
      },
    });
    expect(readBeforeEditGuard.handle(event)).toEqual([]);
  });
});
