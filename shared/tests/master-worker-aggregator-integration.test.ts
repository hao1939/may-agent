import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { aggregateMetrics, getProjectByName, getActiveProjects, getCompletedProjects } from '../workflows/metrics-aggregator.ts';

describe('master-worker aggregator integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-agg-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createProject(name: string, content: string) {
    const dir = path.join(tmpDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'project.md'), content);
  }

  it('aggregates metrics from multiple projects', () => {
    createProject('proj-a', '## Status\nactive\n## Metrics\n| tests | 50 |\n');
    createProject('proj-b', '## Status\nclosed\n## Metrics\n| coverage | 80% |\n');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(2);
    expect(result.activeProjects).toBe(1);
    expect(result.completedProjects).toBe(1);
  });

  it('returns empty when no projects exist', () => {
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(0);
    expect(result.projects).toEqual([]);
  });

  it('handles missing project.md gracefully', () => {
    fs.mkdirSync(path.join(tmpDir, 'empty-proj'));
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(0);
  });

  it('handles malformed project.md gracefully', () => {
    createProject('bad', 'this is not valid markdown with no sections');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(1);
    expect(result.projects[0].status).toBe('unknown');
  });

  it('skips hidden directories', () => {
    createProject('.hidden', '## Status\nactive\n');
    createProject('visible', '## Status\nactive\n');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(1);
    expect(result.projects[0].name).toBe('visible');
  });

  it('skips underscore directories', () => {
    createProject('_internal', '## Status\nactive\n');
    createProject('real', '## Status\nactive\n');
    const result = aggregateMetrics(tmpDir);
    expect(result.totalProjects).toBe(1);
  });

  it('parses metrics from table format', () => {
    createProject('metrics-proj', '## Status\nactive\n## Metrics\n| metric | value |\n|---|---|\n| tests | 100 |\n| coverage | 95% |\n');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].metrics['tests']).toBe('100');
    expect(result.projects[0].metrics['coverage']).toBe('95%');
  });

  it('parses metrics from list format', () => {
    createProject('list-proj', '## Status\nactive\n## Metrics\n- tests: 200\n- files: 10\n');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].metrics['tests']).toBe('200');
    expect(result.projects[0].metrics['files']).toBe('10');
  });

  it('getProjectByName finds specific project', () => {
    createProject('target', '## Status\ncomplete\n');
    createProject('other', '## Status\nactive\n');
    const proj = getProjectByName('target', tmpDir);
    expect(proj).toBeDefined();
    expect(proj!.name).toBe('target');
    expect(proj!.status).toBe('complete');
  });

  it('getProjectByName returns undefined for missing', () => {
    createProject('exists', '## Status\nactive\n');
    const proj = getProjectByName('nope', tmpDir);
    expect(proj).toBeUndefined();
  });

  it('getActiveProjects filters correctly', () => {
    createProject('a1', '## Status\nactive\n');
    createProject('a2', '## Status\nclosed\n');
    createProject('a3', '## Status\nactive\n');
    const active = getActiveProjects(tmpDir);
    expect(active.length).toBe(2);
  });

  it('getCompletedProjects filters correctly', () => {
    createProject('c1', '## Status\ncomplete\n');
    createProject('c2', '## Status\nclosed\n');
    createProject('c3', '## Status\nactive\n');
    const completed = getCompletedProjects(tmpDir);
    expect(completed.length).toBe(2);
  });

  it('includes directory path in project info', () => {
    createProject('with-dir', '## Status\nactive\n');
    const result = aggregateMetrics(tmpDir);
    expect(result.projects[0].directory).toBe(path.join(tmpDir, 'with-dir'));
  });

  it('includes collectedAt timestamp', () => {
    const before = new Date().toISOString();
    const result = aggregateMetrics(tmpDir);
    expect(result.collectedAt).toBeDefined();
    expect(result.collectedAt >= before).toBe(true);
  });

  it('handles non-existent base directory', () => {
    const result = aggregateMetrics('/tmp/nonexistent-dir-xyz-12345');
    expect(result.totalProjects).toBe(0);
  });

  it('aggregator is called in master-worker planning phase context', () => {
    // Simulate the master-worker integration: aggregateMetrics is called
    // with the projects base directory (parent of project dir)
    createProject('system-efficiency', '**Status**: active\n## Metrics\n- iterations: 30\n');
    createProject('test-coverage', '**Status**: closed\n## Metrics\n- tests: 528\n');
    
    // This is what master-worker.ts does: dirname(projectDir) = projectsBaseDir
    const projectDir = path.join(tmpDir, 'system-efficiency');
    const projectsBaseDir = path.dirname(projectDir); // = tmpDir
    
    const metrics = aggregateMetrics(projectsBaseDir);
    expect(metrics.totalProjects).toBeGreaterThan(0);
    
    // Verify the format used in master-worker planning prompt
    const projectSummaries = metrics.projects.map(p => `  - ${p.name}: ${p.status}`).join('\n');
    expect(projectSummaries).toContain('system-efficiency');
    expect(projectSummaries).toContain('test-coverage');
  });
});
