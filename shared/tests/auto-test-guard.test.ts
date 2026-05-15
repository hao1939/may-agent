/**
 * Tests for guards/auto-test.ts
 * Validates the auto-test guard detects source changes without test confirmation.
 */
import { describe, it, expect } from 'bun:test';

// We import the guard's internals by importing the module
// The guard file exports { guard } with name, events, handle
const { guard } = await import('../guards/auto-test');

describe('auto-test guard', () => {
  it('has correct name', () => {
    expect(guard.name).toBe('auto-test');
  });

  it('listens to step_done events', () => {
    expect(guard.events).toContain('step_done');
  });

  it('returns empty array for non-step_done events', () => {
    const result = guard.handle({ type: 'step_start', step: 'build', source: 'agent', result: { messages: [] } } as any);
    expect(result).toEqual([]);
  });

  it('returns empty for function source steps', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'compile',
      source: 'function',
      result: { messages: [] },
    } as any);
    expect(result).toEqual([]);
  });

  it('returns empty for guard-injected steps', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'guard:check',
      source: 'agent',
      result: { messages: [] },
    } as any);
    expect(result).toEqual([]);
  });

  it('returns empty when no source files changed', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'build',
      source: 'agent',
      result: { messages: [], lastAssistantText: '' },
    } as any);
    expect(result).toEqual([]);
  });

  it('returns empty when only non-src files changed', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'build',
      source: 'agent',
      result: {
        messages: [{
          content: [{
            type: 'toolCall',
            name: 'write',
            arguments: { path: 'tests/foo.test.ts' },
          }],
        }],
        lastAssistantText: '',
      },
    } as any);
    expect(result).toEqual([]);
  });

  it('warns when src .ts files changed without test confirmation', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [{
            type: 'toolCall',
            name: 'write',
            arguments: { path: 'src/utils.ts' },
          }],
        }],
        lastAssistantText: 'I updated the utility file.',
      },
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
    expect(result[0].reason).toContain('src/utils.ts');
  });

  it('warns when src .js files changed without test confirmation', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [{
            type: 'toolCall',
            name: 'edit',
            arguments: { path: 'src/index.js' },
          }],
        }],
        lastAssistantText: '',
      },
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('src/index.js');
  });

  it('does not warn when tests are confirmed via "all N tests pass"', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [{
            type: 'toolCall',
            name: 'write',
            arguments: { path: 'src/app.ts' },
          }],
        }],
        lastAssistantText: 'All 42 tests pass.',
      },
    } as any);
    expect(result).toEqual([]);
  });

  it('does not warn when tests confirmed via "N pass 0 fail"', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [{
            type: 'toolCall',
            name: 'write',
            arguments: { path: 'src/app.ts' },
          }],
        }],
        lastAssistantText: '50 pass 0 fail',
      },
    } as any);
    expect(result).toEqual([]);
  });

  it('does not warn when "tests passed" appears in output', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [{
            type: 'toolCall',
            name: 'write',
            arguments: { path: 'src/app.ts' },
          }],
        }],
        lastAssistantText: 'Tests passed successfully.',
      },
    } as any);
    expect(result).toEqual([]);
  });

  it('picks up files from "Wrote N bytes to <path>" text', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [{
            type: 'text',
            text: 'Wrote 500 bytes to src/helper.ts',
          }],
        }],
        lastAssistantText: 'Done.',
      },
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('src/helper.ts');
  });

  it('picks up files from finishResult deliverables', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [],
        finishResult: {
          deliverables: [{ path: 'src/new-module.ts' }],
        },
        lastAssistantText: '',
      },
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('src/new-module.ts');
  });

  it('counts multiple changed src files', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [
            { type: 'toolCall', name: 'write', arguments: { path: 'src/a.ts' } },
            { type: 'toolCall', name: 'edit', arguments: { path: 'src/b.ts' } },
          ],
        }],
        lastAssistantText: '',
      },
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('2 source file(s)');
  });

  it('deduplicates files mentioned multiple times', () => {
    const result = guard.handle({
      type: 'step_done',
      step: 'implement',
      source: 'agent',
      result: {
        messages: [{
          content: [
            { type: 'toolCall', name: 'write', arguments: { path: 'src/a.ts' } },
            { type: 'toolCall', name: 'edit', arguments: { path: 'src/a.ts' } },
          ],
        }],
        lastAssistantText: '',
      },
    } as any);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('1 source file(s)');
  });
});
