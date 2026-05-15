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

const LOG_PATH = join(process.env.STATE_DIR ?? join(process.cwd(), '.state'), 'usage-log.json');

function readLog(logPath = LOG_PATH): UsageRecord[] {
  try {
    return JSON.parse(readFileSync(logPath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLog(records: UsageRecord[], logPath = LOG_PATH): void {
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, JSON.stringify(records, null, 2));
}

export function recordUsage(entry: {
  agent: string;
  workflow?: string;
  promptTokens: number;
  completionTokens: number;
  model?: string;
}, logPath = LOG_PATH): void {
  const records = readLog(logPath);
  records.push({ ...entry, timestamp: Date.now() });
  writeLog(records, logPath);
}

export function getUsageSummary(lastNHours?: number, logPath = LOG_PATH): UsageSummary {
  let records = readLog(logPath);

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
