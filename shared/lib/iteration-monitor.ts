import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface IterationRecord {
  id: string;
  deliverableProduced: boolean;
  firstAttempt: boolean;
  durationMs: number;
  targetPath?: string;
  timestamp?: number;
}

export interface IterationMetrics {
  deliverableRate: number;
  firstAttemptRate: number;
  avgDuration: number;
  totalIterations: number;
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

function writeLog(records: IterationRecord[], logPath: string): void {
  const dir = logPath.substring(0, logPath.lastIndexOf('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(logPath, JSON.stringify(records, null, 2));
}

export function recordIteration(
  record: Omit<IterationRecord, 'timestamp'>,
  logPath: string = DEFAULT_LOG_PATH
): void {
  const records = readLog(logPath);
  records.push({ ...record, timestamp: Date.now() });
  writeLog(records, logPath);
}

export function getMetrics(lastN?: number, logPath: string = DEFAULT_LOG_PATH): IterationMetrics {
  let records = readLog(logPath);

  if (records.length === 0) {
    return { deliverableRate: 0, firstAttemptRate: 0, avgDuration: 0, totalIterations: 0 };
  }

  if (lastN !== undefined && lastN > 0) {
    records = records.slice(-lastN);
  }

  const total = records.length;
  const deliverables = records.filter(r => r.deliverableProduced).length;
  const firstAttempts = records.filter(r => r.firstAttempt).length;
  const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    deliverableRate: deliverables / total,
    firstAttemptRate: firstAttempts / total,
    avgDuration: totalDuration / total,
    totalIterations: total,
  };
}
