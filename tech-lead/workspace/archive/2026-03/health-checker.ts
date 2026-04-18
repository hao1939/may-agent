import * as fs from 'fs/promises';
import * as path from 'path';

// Types

export interface HealthCheckResult {
  agent: string;
  healthy: boolean;
  missingFiles: string[];
  checkedAt: number;
}

export interface HealthReport {
  results: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    healthRate: number;
  };
  generatedAt: number;
}

// Required files every agent must have
const REQUIRED_FILES = ['SOUL.md', 'DOMAIN.md'];

/**
 * Check a single agent directory for required files.
 * Returns a HealthCheckResult indicating whether the agent is healthy.
 */
export async function checkAgent(agentDir: string): Promise<HealthCheckResult> {
  const agentName = path.basename(agentDir);
  const missing: string[] = [];

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(agentDir, file);
    try {
      await fs.access(filePath);
    } catch {
      missing.push(file);
    }
  }

  return {
    agent: agentName,
    healthy: missing.length === 0,
    missingFiles: missing,
    checkedAt: Date.now(),
  };
}

/**
 * Check all agent directories under baseDir.
 * Each subdirectory of baseDir is treated as an agent directory.
 * Returns a full health report with summary statistics.
 */
export async function checkAll(baseDir: string): Promise<HealthReport> {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());

  const results: HealthCheckResult[] = [];
  for (const dir of dirs) {
    const result = await checkAgent(path.join(baseDir, dir.name));
    results.push(result);
  }

  const total = results.length;
  const healthy = results.filter(r => r.healthy).length;
  const unhealthy = total - healthy;
  const healthRate = total === 0 ? 0 : healthy / total;

  return {
    results,
    summary: { total, healthy, unhealthy, healthRate },
    generatedAt: Date.now(),
  };
}

/**
 * Format a HealthReport into a human-readable markdown string.
 * 
 * Expected format:
 * ```
 * # Health Report
 * Generated: <ISO date>
 * 
 * ## Summary
 * - Total agents: X
 * - Healthy: Y
 * - Unhealthy: Z
 * - Health rate: XX%
 * 
 * ## Details
 * - ✅ agent-name
 * - ❌ agent-name (missing: SOUL.md, DOMAIN.md)
 * ```
 */
export function formatReport(report: HealthReport): string {
  const date = new Date(report.generatedAt).toISOString();
  const { total, healthy, unhealthy, healthRate } = report.summary;
  const pct = Math.round(healthRate * 100);

  const details = report.results.map(r => {
    if (r.healthy) {
      return `- ✅ ${r.agent}`;
    }
    return `- ❌ ${r.agent} (missing: ${r.missingFiles.join(', ')})`;
  }).join('\n');

  return `# Health Report
Generated: ${date}

## Summary
- Total agents: ${total}
- Healthy: ${healthy}
- Unhealthy: ${unhealthy}
- Health rate: ${pct}%

## Details
${details}`;
}
