import { describe, it, expect } from 'bun:test';
import { onProjectCreate, requireValidProject } from '../hooks/validate-on-create.ts';

const validProject = `---
id: test-project
owner: evaluator
status: active
---

# Test Project

## Goal
Build something great

## Signals
- coverage: 50% → 80%

## Plan
- [ ] Do the thing

## Validation
Coverage signal improves.
`;

const missingGoal = `---
id: test-project
owner: evaluator
status: active
---

# Test Project

## Signals
- coverage: 50% → 80%

## Plan
- [ ] Do the thing

## Validation
Coverage signal improves.
`;

const missingSections = `# Test Project

Just some text without proper sections.
`;

const noMetricTarget = `---
id: test-project
owner: evaluator
status: active
---

# Test Project

## Goal
Build it

## Metrics
- coverage: 50%

## Plan
- [ ] Do the thing

## Validation
Coverage signal improves.
`;

describe('onProjectCreate', () => {
  it('returns valid for well-formed project', () => {
    const result = onProjectCreate(validProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing Goal section', () => {
    const result = onProjectCreate(missingGoal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('goal'))).toBe(true);
  });

  it('returns errors for missing multiple sections', () => {
    const result = onProjectCreate(missingSections);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('warns on metrics without targets', () => {
    const result = onProjectCreate(noMetricTarget);
    expect(result.warnings.some(w => w.toLowerCase().includes('target') || w.toLowerCase().includes('→'))).toBe(true);
  });
});

describe('requireValidProject', () => {
  it('does not throw for valid project', () => {
    expect(() => requireValidProject(validProject)).not.toThrow();
  });

  it('throws for invalid project', () => {
    expect(() => requireValidProject(missingSections)).toThrow('Invalid project config');
  });
});
