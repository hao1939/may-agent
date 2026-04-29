import { readFileSync } from 'fs';
import { join } from 'path';

export interface IterationRecord {
  id: string;
  deliverableProduced: boolean;
  firstAttempt: boolean;
  durationMs: number;
  targetPath?: string;
  timestamp?: number;
  workflow?: string;
}

export interface WorkflowStats {
  count: number;
  successRate: number;
  avgDurationMs: number;
}

export interface WorkflowMetricsResult {
  byWorkflow: Record<string, WorkflowStats>;
  total: number;
}

const DEFAULT_LOG_PATH = join(process.cwd(), '.state', 'iteration-log.json');

function readLog(logPath: string): IterationRecord[] {
  try {
    const data = readFileSync(logPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Extracts workflow name from iteration id.
 * Convention: id is "workflowName-iterationNumber" or "workflowName/iterationNumber"
 * Falls back to "unknown" if no separator found.
 */
function extractWorkflow(record: IterationRecord): string {
  if (record.workflow) return record.workflow;
  const id = record.id;
  // Try common separators
  for (const sep of ['-', '/', ':']) {
    const lastIdx = id.lastIndexOf(sep);
    if (lastIdx > 0) {
      const suffix = id.slice(lastIdx + 1);
      // If suffix is numeric, the prefix is the workflow name
      if (/^\d+$/.test(suffix)) {
        return id.slice(0, lastIdx);
      }
    }
  }
  return record.workflow || 'unknown';
}

export function getWorkflowMetrics(logPath: string = DEFAULT_LOG_PATH): WorkflowMetricsResult {
  const records = readLog(logPath);

  if (records.length === 0) {
    return { byWorkflow: {}, total: 0 };
  }

  const groups: Record<string, IterationRecord[]> = {};

  for (const record of records) {
    const workflow = extractWorkflow(record);
    if (!groups[workflow]) groups[workflow] = [];
    groups[workflow].push(record);
  }

  const byWorkflow: Record<string, WorkflowStats> = {};

  for (const [name, recs] of Object.entries(groups)) {
    const count = recs.length;
    const successes = recs.filter(r => r.deliverableProduced).length;
    const totalDuration = recs.reduce((sum, r) => sum + r.durationMs, 0);

    byWorkflow[name] = {
      count,
      successRate: successes / count,
      avgDurationMs: totalDuration / count,
    };
  }

  return { byWorkflow, total: records.length };
}
