import { describe, it, expect } from 'bun:test';
import { execSync } from 'child_process';

describe('metric-collector', () => {
  it('outputs table format by default', () => {
    const out = execSync('bun scripts/metric-collector.ts').toString();
    expect(out).toContain('Agent');
    expect(out).toContain('Sessions');
    expect(out).toContain('bob');
  });

  it('filters by agent', () => {
    const out = execSync('bun scripts/metric-collector.ts --agent bob').toString();
    expect(out).toContain('bob');
    expect(out).not.toContain('coach');
  });
});
