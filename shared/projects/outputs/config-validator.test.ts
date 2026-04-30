import { describe, it, expect } from 'vitest';
import { validateProjectConfig } from '../lib/config-validator.js';

const validProject = `# My Project

## Status
active

## Goal
Do something great

## Metrics
- test-coverage: 80% → 95%
- speed: 100ms → 50ms

## Plan
- [ ] First task
- [x] Done task
`;

describe('validateProjectConfig', () => {
  it('accepts a valid project config', () => {
    const result = validateProjectConfig(validProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on missing Status section', () => {
    const content = validProject.replace(/## Status\nactive\n/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: Status');
  });

  it('errors on missing Goal section', () => {
    const content = validProject.replace(/## Goal\nDo something great\n/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: Goal');
  });

  it('errors on missing Metrics section', () => {
    const content = validProject.replace(/## Metrics[\s\S]*?(?=## Plan)/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: Metrics');
  });

  it('errors on missing Plan section', () => {
    const content = validProject.replace(/## Plan[\s\S]*$/, '');
    const result = validateProjectConfig(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: Plan');
  });

  it('warns on metrics without targets', () => {
    const content = validProject.replace('- test-coverage: 80% → 95%', '- test-coverage: 80%');
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
