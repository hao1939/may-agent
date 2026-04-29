import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runHealthCheck, WORKFLOW_MODULES } from '../workflows/health-check';

describe('health-check', () => {
  let tmpDir: string;
  let workflowDir: string;
  let outputsDir: string;
  let projectsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-check-'));
    workflowDir = path.join(tmpDir, 'workflows');
    outputsDir = path.join(tmpDir, 'outputs');
    projectsDir = path.join(tmpDir, 'projects');
    fs.mkdirSync(workflowDir, { recursive: true });
    fs.mkdirSync(outputsDir, { recursive: true });
    fs.mkdirSync(projectsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createWorkflowModules(modules: string[]) {
    for (const mod of modules) {
      fs.writeFileSync(path.join(workflowDir, `${mod}.ts`), `// ${mod}`);
    }
  }

  function createTestFiles(count: number) {
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(testsDir, { recursive: true });
    for (let i = 0; i < count; i++) {
      fs.writeFileSync(path.join(testsDir, `test-${i}.test.ts`), '// test');
    }
  }

  function createOutputFiles(count: number) {
    for (let i = 0; i < count; i++) {
      fs.writeFileSync(path.join(outputsDir, `output-${i}.md`), '# output');
    }
  }

  function createSatelliteProject(name: string, hasStatus: boolean) {
    const dir = path.join(projectsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const content = hasStatus ? '## Status\nactive' : '# Project\nno status here';
    fs.writeFileSync(path.join(dir, 'project.md'), content);
  }

  it('returns passed=true when all checks pass', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(65);
    createOutputFiles(25);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({
      workflowDir,
      outputsDir,
      projectsDir,
      minTestFiles: 60,
      minOutputFiles: 20,
    });

    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(4);
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it('returns passed=false when workflow modules are missing', async () => {
    createWorkflowModules(['incremental-checkpoint', 'provider-retry']);
    createTestFiles(65);
    createOutputFiles(25);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    expect(result.passed).toBe(false);
    const moduleCheck = result.checks.find(c => c.name === 'workflow-modules-importable');
    expect(moduleCheck?.passed).toBe(false);
    expect(moduleCheck?.details).toContain('Missing');
  });

  it('returns passed=false when test file count is below minimum', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(10);
    createOutputFiles(25);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    expect(result.passed).toBe(false);
    const testCheck = result.checks.find(c => c.name === 'test-file-count');
    expect(testCheck?.passed).toBe(false);
    expect(testCheck?.details).toContain('10 test files');
  });

  it('returns passed=false when output file count is below minimum', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(65);
    createOutputFiles(5);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    expect(result.passed).toBe(false);
    const outputCheck = result.checks.find(c => c.name === 'output-file-count');
    expect(outputCheck?.passed).toBe(false);
  });

  it('returns passed=false when satellite projects lack status', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(65);
    createOutputFiles(25);
    createSatelliteProject('proj1', false);

    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    expect(result.passed).toBe(false);
    const satCheck = result.checks.find(c => c.name === 'satellite-projects-status');
    expect(satCheck?.passed).toBe(false);
  });

  it('handles missing workflow directory gracefully', async () => {
    const result = await runHealthCheck({
      workflowDir: '/nonexistent/path',
      outputsDir,
      projectsDir,
    });
    expect(result.passed).toBe(false);
  });

  it('handles missing outputs directory gracefully', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(65);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({
      workflowDir,
      outputsDir: '/nonexistent/outputs',
      projectsDir,
    });
    expect(result.passed).toBe(false);
  });

  it('handles missing projects directory gracefully', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(65);
    createOutputFiles(25);

    const result = await runHealthCheck({
      workflowDir,
      outputsDir,
      projectsDir: '/nonexistent/projects',
    });
    // No projects = 0/0, which fails the projectCount > 0 check
    expect(result.passed).toBe(false);
  });

  it('includes timestamp in result', async () => {
    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('counts only .test. files in test directory', async () => {
    const testsDir = path.join(tmpDir, 'tests');
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(path.join(testsDir, 'helper.ts'), '// not a test');
    fs.writeFileSync(path.join(testsDir, 'utils.ts'), '// not a test');
    fs.writeFileSync(path.join(testsDir, 'foo.test.ts'), '// test');

    createWorkflowModules(WORKFLOW_MODULES);
    createOutputFiles(25);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir, minTestFiles: 1 });
    const testCheck = result.checks.find(c => c.name === 'test-file-count');
    expect(testCheck?.details).toContain('1 test files');
    expect(testCheck?.passed).toBe(true);
  });

  it('ignores hidden files in outputs', async () => {
    fs.writeFileSync(path.join(outputsDir, '.hidden'), 'hidden');
    fs.writeFileSync(path.join(outputsDir, 'visible.md'), 'visible');

    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(65);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir, minOutputFiles: 1 });
    const outputCheck = result.checks.find(c => c.name === 'output-file-count');
    expect(outputCheck?.details).toContain('1 output files');
  });

  it('detects status via different formats', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(65);
    createOutputFiles(25);

    const dir1 = path.join(projectsDir, 'p1');
    fs.mkdirSync(dir1);
    fs.writeFileSync(path.join(dir1, 'project.md'), 'status: active');

    const dir2 = path.join(projectsDir, 'p2');
    fs.mkdirSync(dir2);
    fs.writeFileSync(path.join(dir2, 'project.md'), 'Status: complete');

    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    const satCheck = result.checks.find(c => c.name === 'satellite-projects-status');
    expect(satCheck?.passed).toBe(true);
    expect(satCheck?.details).toContain('2/2');
  });

  it('custom minimum thresholds work', async () => {
    createWorkflowModules(WORKFLOW_MODULES);
    createTestFiles(5);
    createOutputFiles(3);
    createSatelliteProject('proj1', true);

    const result = await runHealthCheck({
      workflowDir, outputsDir, projectsDir,
      minTestFiles: 3,
      minOutputFiles: 2,
    });
    const testCheck = result.checks.find(c => c.name === 'test-file-count');
    const outputCheck = result.checks.find(c => c.name === 'output-file-count');
    expect(testCheck?.passed).toBe(true);
    expect(outputCheck?.passed).toBe(true);
  });

  it('reports all 10 workflow modules in WORKFLOW_MODULES constant', () => {
    expect(WORKFLOW_MODULES).toHaveLength(10);
    expect(WORKFLOW_MODULES).toContain('incremental-checkpoint');
    expect(WORKFLOW_MODULES).toContain('iteration-budget');
  });

  it('each check has name, passed, and details', async () => {
    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    for (const check of result.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('passed');
      expect(check).toHaveProperty('details');
      expect(typeof check.name).toBe('string');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.details).toBe('string');
    }
  });

  it('returns exactly 4 checks', async () => {
    const result = await runHealthCheck({ workflowDir, outputsDir, projectsDir });
    expect(result.checks).toHaveLength(4);
  });
});
