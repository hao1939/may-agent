import { describe, it, expect } from 'bun:test';
import { createTaskTemplate } from '../task-template';

describe('createTaskTemplate', () => {
  it('produces GOAL and TARGET lines for minimal input', () => {
    const result = createTaskTemplate({
      goal: 'Write a utility',
      targetPath: 'lib/utils.ts',
    });
    expect(result).toBe('GOAL: Write a utility\nTARGET: lib/utils.ts');
  });

  it('includes TEST line when testPath provided', () => {
    const result = createTaskTemplate({
      goal: 'Create parser',
      targetPath: 'lib/parser.ts',
      testPath: 'lib/__tests__/parser.test.ts',
    });
    expect(result).toContain('TEST: lib/__tests__/parser.test.ts');
  });

  it('includes CONTEXT line when context provided', () => {
    const result = createTaskTemplate({
      goal: 'Build feature',
      targetPath: 'src/feature.ts',
      context: 'Depends on lib/utils.ts',
    });
    expect(result).toContain('CONTEXT: Depends on lib/utils.ts');
  });

  it('includes all four lines when all fields provided', () => {
    const result = createTaskTemplate({
      goal: 'Full task',
      targetPath: 'src/full.ts',
      testPath: 'src/__tests__/full.test.ts',
      context: 'Phase 2 work',
    });
    const lines = result.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('GOAL: Full task');
    expect(lines[1]).toBe('TARGET: src/full.ts');
    expect(lines[2]).toBe('TEST: src/__tests__/full.test.ts');
    expect(lines[3]).toBe('CONTEXT: Phase 2 work');
  });

  it('throws when goal is empty', () => {
    expect(() => createTaskTemplate({ goal: '', targetPath: 'x.ts' })).toThrow('goal is required');
  });

  it('throws when targetPath is empty', () => {
    expect(() => createTaskTemplate({ goal: 'Do thing', targetPath: '' })).toThrow('targetPath is required');
  });

  it('trims whitespace from all fields', () => {
    const result = createTaskTemplate({
      goal: '  spaced goal  ',
      targetPath: '  path/file.ts  ',
      testPath: '  path/test.ts  ',
      context: '  extra info  ',
    });
    expect(result).toBe('GOAL: spaced goal\nTARGET: path/file.ts\nTEST: path/test.ts\nCONTEXT: extra info');
  });
});
