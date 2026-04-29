import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { aggregateMetrics, getProjectByName, getActiveProjects, getCompletedProjects } from '../workflows/metrics-aggregator';

describe('metrics-aggregator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-agg-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createProject(name: string, content: string) {
    const dir = path.join(tmpDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'project.md'), content);
  }

  it('returns empty result for non-existent directory', () => {
    const result = aggregateMetrics('/nonexistent/path');
    expect(result.totalProjects).toBe(0);
    expect(result.projects).toEqual([]);
  });

  it('returns empty result for empty directory', () => {
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(0);
  });

  it('discovers projects with project.md files', () => {
    createProject('proj-a', '# Project A\n## Status\nactive');
    createProject('proj-b', '# Project B\n## Status\ncomplete');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(2);
  });

  it('skips directories without project.md', () => {
    fs.mkdirSync(path.join(tmpDir, 'no-project'));
    createProject('has-project', '# Test');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(1);
  });

  it('skips directories starting with underscore', () => {
    createProject('_archive', '# Archived');
    createProject('real-project', '# Real\n## Status\nactive');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(1);
    expect(result.projects[0].name).toBe('real-project');
  });

  it('skips directories starting with dot', () => {
    createProject('.hidden', '# Hidden');
    createProject('visible', '# Visible');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(1);
  });

  it('parses status from ## Status section', () => {
    createProject('proj', '# Test\n## Status\nactive\n\n## Other');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].status).toBe('active');
  });

  it('parses status from **Status**: format', () => {
    createProject('proj', '# Test\n**Status**: closed');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].status).toBe('closed');
  });

  it('detects complete status from ✅ emoji', () => {
    createProject('proj', '# Test\nThis project is ✅ done');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].status).toBe('complete');
  });

  it('returns unknown for unparseable status', () => {
    createProject('proj', '# Test\nNo status info here');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].status).toBe('unknown');
  });

  it('parses metrics from table format', () => {
    createProject('proj', '# Test\n## Metrics\n| Metric | Value |\n|---|---|\n| tests | 50 |\n| coverage | 80% |');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].metrics['tests']).toBe('50');
    expect(result.projects[0].metrics['coverage']).toBe('80%');
  });

  it('parses metrics from list format', () => {
    createProject('proj', '# Test\n## Metrics\n- tests: 42\n- files: 10');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].metrics['tests']).toBe('42');
    expect(result.projects[0].metrics['files']).toBe('10');
  });

  it('returns empty metrics when no metrics section', () => {
    createProject('proj', '# Test\nNo metrics here');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].metrics).toEqual({});
  });

  it('counts active projects correctly', () => {
    createProject('a', '# A\n## Status\nactive');
    createProject('b', '# B\n## Status\ncomplete');
    createProject('c', '# C\nno status');
    const result = aggregateMetrics(tmpDir);
    expect(result.activeProjects).toBe(2); // active + unknown
  });

  it('counts completed projects correctly', () => {
    createProject('a', '# A\n## Status\ncomplete');
    createProject('b', '# B\n## Status\nclosed');
    createProject('c', '# C\n## Status\ndone');
    const result = aggregateMetrics(tmpDir);
    expect(result.completedProjects).toBe(3);
  });

  it('includes collectedAt timestamp', () => {
    const before = new Date().toISOString();
    const result = aggregateMetrics(tmpDir);
    expect(result.collectedAt).toBeDefined();
    expect(result.collectedAt >= before).toBe(true);
  });

  it('includes directory path for each project', () => {
    createProject('my-proj', '# Test');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].directory).toBe(path.join(tmpDir, 'my-proj'));
  });

  it('includes lastUpdated for each project', () => {
    createProject('proj', '# Test');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].lastUpdated).not.toBe('unknown');
    expect(new Date(result.projects[0].lastUpdated).getTime()).toBeGreaterThan(0);
  });

  describe('getProjectByName', () => {
    it('finds project by name', () => {
      createProject('target', '# Target\n## Status\nactive');
      createProject('other', '# Other');
      const proj = getProjectByName('target', tmpDir);
      expect(proj).toBeDefined();
      expect(proj!.name).toBe('target');
    });

    it('returns undefined for non-existent project', () => {
      createProject('exists', '# Exists');
      const proj = getProjectByName('nope', tmpDir);
      expect(proj).toBeUndefined();
    });
  });

  describe('getActiveProjects', () => {
    it('returns only active/unknown projects', () => {
      createProject('a', '# A\n## Status\nactive');
      createProject('b', '# B\n## Status\ncomplete');
      const active = getActiveProjects(tmpDir);
      expect(active.length).toBe(1);
      expect(active[0].name).toBe('a');
    });
  });

  describe('getCompletedProjects', () => {
    it('returns only completed projects', () => {
      createProject('a', '# A\n## Status\nactive');
      createProject('b', '# B\n## Status\ncomplete');
      createProject('c', '# C\n## Status\nclosed');
      const completed = getCompletedProjects(tmpDir);
      expect(completed.length).toBe(2);
    });
  });

  it('handles read errors gracefully', () => {
    const dir = path.join(tmpDir, 'bad-proj');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'project.md'), '');
    fs.chmodSync(path.join(dir, 'project.md'), 0o000);
    const result = aggregateMetrics(tmpDir);
    // Should not throw, should mark as error
    expect(result.totalProjects).toBe(1);
    // Restore permissions for cleanup
    fs.chmodSync(path.join(dir, 'project.md'), 0o644);
  });
});
