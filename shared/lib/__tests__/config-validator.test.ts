import { describe, it, expect } from 'vitest';
import { validateProjectConfig } from '../config-validator.js';

const validProject = `---
id: my-project
owner: evaluator
status: active
workflow: project
---

# My Project

## Goal
Do something great

## Signals
- test-coverage: 80% → 95%
- speed: 100ms → 50ms

## Plan
- [ ] First task
- [x] Done task

## Validation
The next run confirms the signal moved in the right direction.
`;

describe('validateProjectConfig', () => {
  it('accepts a valid project config', () => {
    const result = validateProjectConfig(validProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on missing status frontmatter', () => {
    const content = validProject.replace(/status: active\n/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required frontmatter: status');
  });

  it('errors on missing Goal section', () => {
    const content = validProject.replace(/## Goal\nDo something great\n/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: Goal');
  });

  it('warns on missing Signals and Metrics sections', () => {
    const content = validProject.replace(/## Signals[\s\S]*?(?=## Plan)/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('Project should include Signals or Metrics section');
  });

  it('errors on missing Plan section', () => {
    const content = validProject.replace(/## Plan[\s\S]*$/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: Plan');
  });

  it('warns on metrics without targets', () => {
    const content = validProject
      .replace('## Signals', '## Metrics')
      .replace('- test-coverage: 80% → 95%', '- test-coverage: 80%');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('without target'))).toBe(true);
  });

  it('warns on empty plan', () => {
    const content = validProject.replace(/- \[ \] First task\n- \[x\] Done task\n/, '');
    const result = validateProjectConfig(content);
    expect(result.warnings).toContain('Plan section has no checklist items');
  });

  it('warns when all items checked and no Re-plan', () => {
    const content = validProject.replace('- [ ] First task', '- [x] First task');
    const result = validateProjectConfig(content);
    expect(result.warnings).toContain('All plan items checked but no Re-plan noted');
  });
});
