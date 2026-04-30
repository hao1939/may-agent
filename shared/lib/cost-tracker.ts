/**
 * Cost Tracker — records token usage per agent/workflow for budget monitoring.
 * Stores data in `.state/usage-log.json`.
 * @module cost-tracker
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface UsageRecord {
  agent: string;
  workflow?: string;
  promptTokens: number;
  completionTokens: number;
  model?: string;
  timestamp: number;
}

export interface UsageSummary {
  byAgent: Record<string, { total: number; avg: number; count: number }>;
  byWorkflow: Record<string, { total: number; avg: number; count: number }>;
}

const LOG_PATH = join(process.cwd(), '.state', 'usage-log.json');

function readLog(): UsageRecord[] {
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLog(records: UsageRecord[]): void {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  writeFileSync(LOG_PATH, JSON.stringify(records, null, 2));
}

export function recordUsage(entry: {
  agent: string;
  workflow?: string;
  promptTokens: number;
  completionTokens: number;
  model?: string;
}): void {
  const records = readLog();
  records.push({ ...entry, timestamp: Date.now() });
  writeLog(records);
}

export function getUsageSummary(lastNHours?: number): UsageSummary {
  let records = readLog();

  if (lastNHours !== undefined) {
    const cutoff = Date.now() - lastNHours * 3600 * 1000;
    records = records.filter(r => r.timestamp >= cutoff);
  }

  const byAgent: Record<string, { total: number; avg: number; count: number }> = {};
  const byWorkflow: Record<string, { total: number; avg: number; count: number }> = {};

  for (const r of records) {
    const tokens = r.promptTokens + r.completionTokens;

    if (!byAgent[r.agent]) byAgent[r.agent] = { total: 0, avg: 0, count: 0 };
    byAgent[r.agent].total += tokens;
    byAgent[r.agent].count += 1;

    if (r.workflow) {
      if (!byWorkflow[r.workflow]) byWorkflow[r.workflow] = { total: 0, avg: 0, count: 0 };
      byWorkflow[r.workflow].total += tokens;
      byWorkflow[r.workflow].count += 1;
    }
  }

  for (const v of Object.values(byAgent)) v.avg = v.count ? v.total / v.count : 0;
  for (const v of Object.values(byWorkflow)) v.avg = v.count ? v.total / v.count : 0;

  return { byAgent, byWorkflow };
}
