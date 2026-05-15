import { describe, it, expect } from 'bun:test';
import { buildPrompt } from '../prompt-builder.js';

describe('buildPrompt', () => {
  it('builds a minimal prompt with role and goal only', () => {
    const result = buildPrompt({ role: 'Engineer', goal: 'Fix the bug' });
    expect(result).toContain('## Role\nEngineer');
    expect(result).toContain('## Goal\nFix the bug');
    expect(result).not.toContain('## Context');
    expect(result).not.toContain('## Constraints');
    expect(result).not.toContain('## Output Format');
  });

  it('includes context items as bullet list', () => {
    const result = buildPrompt({
      role: 'Analyst',
      goal: 'Review data',
      context: ['Dataset has 1M rows', 'Format is CSV'],
    });
    expect(result).toContain('## Context\n- Dataset has 1M rows\n- Format is CSV');
  });

  it('includes constraints as bullet list', () => {
    const result = buildPrompt({
      role: 'Writer',
      goal: 'Draft report',
      constraints: ['Max 500 words', 'Use plain language'],
    });
    expect(result).toContain('## Constraints\n- Max 500 words\n- Use plain language');
  });

  it('includes output format section', () => {
    const result = buildPrompt({
      role: 'Coder',
      goal: 'Generate function',
      outputFormat: 'TypeScript function with JSDoc',
    });
    expect(result).toContain('## Output Format\nTypeScript function with JSDoc');
  });

  it('includes all fields together in correct order', () => {
    const result = buildPrompt({
      role: 'Agent',
      goal: 'Complete task',
      context: ['File exists at /tmp/x'],
      constraints: ['No side effects'],
      outputFormat: 'JSON object',
    });
    const roleIdx = result.indexOf('## Role');
    const goalIdx = result.indexOf('## Goal');
    const ctxIdx = result.indexOf('## Context');
    const conIdx = result.indexOf('## Constraints');
    const outIdx = result.indexOf('## Output Format');
    expect(roleIdx).toBeLessThan(goalIdx);
    expect(goalIdx).toBeLessThan(ctxIdx);
    expect(ctxIdx).toBeLessThan(conIdx);
    expect(conIdx).toBeLessThan(outIdx);
  });

  it('skips context section when array is empty', () => {
    const result = buildPrompt({ role: 'X', goal: 'Y', context: [] });
    expect(result).not.toContain('## Context');
  });
});
