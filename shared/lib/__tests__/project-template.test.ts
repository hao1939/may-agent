import { describe, it, expect } from 'bun:test';
import { generateProject, ProjectConfig } from '../project-template.js';

describe('generateProject', () => {
  const basicConfig: ProjectConfig = {
    name: 'test-project',
    goal: 'Improve test coverage to 95%',
    metrics: [{ name: 'coverage', target: '95%' }],
    owner: 'alice',
  };

  it('generates a valid project.md with required fields', () => {
    const { projectMd } = generateProject(basicConfig);
    expect(projectMd).toContain('# test-project');
    expect(projectMd).toContain('Improve test coverage to 95%');
    expect(projectMd).toContain('alice');
    expect(projectMd).toContain('active');
  });

  it('includes signals table with current and target', () => {
    const { projectMd } = generateProject({
      ...basicConfig,
      metrics: [{ name: 'coverage', target: '95%', current: '80%' }],
    });
    expect(projectMd).toContain('| coverage | 80% | 95% |');
  });

  it('defaults current metric to 0 when not provided', () => {
    const { projectMd } = generateProject(basicConfig);
    expect(projectMd).toContain('| coverage | 0 | 95% |');
  });

  it('supports multiple metrics', () => {
    const { projectMd } = generateProject({
      ...basicConfig,
      metrics: [
        { name: 'coverage', target: '95%', current: '80%' },
        { name: 'test-count', target: '200', current: '150' },
        { name: 'lint-errors', target: '0', current: '12' },
      ],
    });
    expect(projectMd).toContain('| coverage | 80% | 95% |');
    expect(projectMd).toContain('| test-count | 150 | 200 |');
    expect(projectMd).toContain('| lint-errors | 12 | 0 |');
  });

  it('generates default plan items when none provided', () => {
    const { planItems } = generateProject(basicConfig);
    expect(planItems).toHaveLength(5);
    expect(planItems[0]).toContain('test-project');
    expect(planItems[2]).toContain('tests');
  });

  it('uses the shared work-context sections', () => {
    const { projectMd } = generateProject(basicConfig);
    expect(projectMd).toContain('## Goal');
    expect(projectMd).toContain('## Signals');
    expect(projectMd).toContain('## Current State');
    expect(projectMd).toContain('## Plan');
    expect(projectMd).toContain('## Validation');
    expect(projectMd).toContain('## Journal');
  });

  it('uses custom plan items when provided', () => {
    const custom = ['Step A', 'Step B'];
    const { projectMd, planItems } = generateProject({
      ...basicConfig,
      planItems: custom,
    });
    expect(planItems).toEqual(custom);
    expect(projectMd).toContain('Step A');
    expect(projectMd).toContain('Step B');
  });

  it('respects custom phase', () => {
    const { projectMd } = generateProject({ ...basicConfig, phase: '3' });
    expect(projectMd).toContain('## Phase\n3');
  });

  it('numbers plan items sequentially', () => {
    const { projectMd } = generateProject(basicConfig);
    expect(projectMd).toMatch(/1\. \[ \]/);
    expect(projectMd).toMatch(/5\. \[ \]/);
  });
});
