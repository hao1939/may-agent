/**
 * Iteration Monitor — tracks iteration outcomes and computes aggregate metrics.
 * Stores data in `.state/iteration-log.json` for persistence across sessions.
 * @module iteration-monitor
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/** A single iteration's outcome record. */
export interface IterationRecord {
  /** Unique iteration identifier (e.g., "iter-42") */
  id: string;
  /** Whether the iteration produced a file deliverable */
  deliverableProduced: boolean;
  /** Whether the iteration succeeded on the first attempt (no retries) */
  firstAttempt: boolean;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  /** Path to the primary output file, if any */
  targetPath?: string;
  /** Unix timestamp (ms) when the iteration was recorded */
  timestamp?: number;
}

/** Aggregate metrics computed from a set of iteration records. */
export interface IterationMetrics {
  /** Fraction of iterations that produced a deliverable (0–1) */
  deliverableRate: number;
  /** Fraction of iterations that succeeded on first attempt (0–1) */
  firstAttemptRate: number;
  /** Mean duration in milliseconds */
  avgDuration: number;
  /** Total number of iterations in the sample */
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

/**
 * Record a completed iteration to the persistent log.
 * @param record - Iteration outcome (timestamp is added automatically)
 * @param logPath - Path to the JSON log file (defaults to `.state/iteration-log.json`)
 */
export function recordIteration(
  record: Omit<IterationRecord, 'timestamp'>,
  logPath: string = DEFAULT_LOG_PATH
): void {
  const records = readLog(logPath);
  records.push({ ...record, timestamp: Date.now() });
  writeLog(records, logPath);
}

/**
 * Compute aggregate metrics from recorded iterations.
 * @param lastN - If provided, only consider the most recent N iterations
 * @param logPath - Path to the JSON log file
 * @returns Aggregate metrics including deliverable rate, first-attempt rate, and avg duration
 */
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
