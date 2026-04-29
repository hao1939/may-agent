import * as fs from 'fs';
import * as path from 'path';

export interface HealthCheckItem {
  name: string;
  passed: boolean;
  details: string;
}

export interface HealthCheckResult {
  passed: boolean;
  checks: HealthCheckItem[];
  timestamp: string;
}

const WORKFLOW_MODULES = [
  'incremental-checkpoint',
  'provider-retry',
  'output-validator',
  'task-validator',
  'complexity-estimator',
  'iteration-timer',
  'metrics-dashboard',
  'fast-path',
  'metrics-aggregator',
  'iteration-budget',
];

function checkWorkflowModulesImportable(baseDir: string): HealthCheckItem {
  const missing: string[] = [];
  for (const mod of WORKFLOW_MODULES) {
    const filePath = path.join(baseDir, `${mod}.ts`);
    if (!fs.existsSync(filePath)) {
      missing.push(mod);
    }
  }
  const passed = missing.length === 0;
  return {
    name: 'workflow-modules-importable',
    passed,
    details: passed ? `All ${WORKFLOW_MODULES.length} modules found` : `Missing: ${missing.join(', ')}`,
  };
}

function checkTestFileCount(baseDir: string, minCount: number = 60): HealthCheckItem {
  const testsDir = path.join(baseDir, '..', 'tests');
  let count = 0;
  try {
    if (fs.existsSync(testsDir)) {
      const files = fs.readdirSync(testsDir);
      count = files.filter(f => f.includes('.test.')).length;
    }
  } catch {}
  const passed = count >= minCount;
  return {
    name: 'test-file-count',
    passed,
    details: `${count} test files (minimum: ${minCount})`,
  };
}

function checkOutputFileCount(outputsDir: string, minCount: number = 20): HealthCheckItem {
  let count = 0;
  try {
    if (fs.existsSync(outputsDir)) {
      const files = fs.readdirSync(outputsDir);
      count = files.filter(f => !f.startsWith('.')).length;
    }
  } catch {}
  const passed = count >= minCount;
  return {
    name: 'output-file-count',
    passed,
    details: `${count} output files (minimum: ${minCount})`,
  };
}

function checkSatelliteProjects(projectsDir: string): HealthCheckItem {
  let projectCount = 0;
  let withStatus = 0;
  try {
    if (fs.existsSync(projectsDir)) {
      const dirs = fs.readdirSync(projectsDir).filter(d => {
        const full = path.join(projectsDir, d);
        return fs.statSync(full).isDirectory();
      });
      for (const dir of dirs) {
        const projectMd = path.join(projectsDir, dir, 'project.md');
        if (fs.existsSync(projectMd)) {
          projectCount++;
          const content = fs.readFileSync(projectMd, 'utf-8');
          if (content.includes('status:') || content.includes('Status:') || content.includes('## Status')) {
            withStatus++;
          }
        }
      }
    }
  } catch {}
  const passed = projectCount > 0 && withStatus === projectCount;
  return {
    name: 'satellite-projects-status',
    passed,
    details: `${withStatus}/${projectCount} projects have status`,
  };
}

export async function runHealthCheck(options?: {
  workflowDir?: string;
  outputsDir?: string;
  projectsDir?: string;
  minTestFiles?: number;
  minOutputFiles?: number;
}): Promise<HealthCheckResult> {
  const workflowDir = options?.workflowDir || path.join(__dirname);
  const outputsDir = options?.outputsDir || path.join(__dirname, '..', 'projects', 'system-efficiency', 'outputs');
  const projectsDir = options?.projectsDir || path.join(__dirname, '..', 'projects');
  const minTestFiles = options?.minTestFiles ?? 60;
  const minOutputFiles = options?.minOutputFiles ?? 20;

  const checks: HealthCheckItem[] = [
    checkWorkflowModulesImportable(workflowDir),
    checkTestFileCount(workflowDir, minTestFiles),
    checkOutputFileCount(outputsDir, minOutputFiles),
    checkSatelliteProjects(projectsDir),
  ];

  const allPassed = checks.every(c => c.passed);

  return {
    passed: allPassed,
    checks,
    timestamp: new Date().toISOString(),
  };
}

export { WORKFLOW_MODULES };
