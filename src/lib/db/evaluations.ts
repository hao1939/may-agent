import { getDb } from "./connection.js";

export interface EvaluationRecord {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  verdict: string;
  issues: string[];
  usage: Record<string, unknown> | null;
  createdAt: number;
}

/** Check if an evaluation already exists for a session. */
export function hasEvaluation(persistDir: string, sessionId: string): boolean {
  const db = getDb(persistDir);
  const row = db.prepare("SELECT 1 FROM evaluations WHERE sessionId = ?").get(sessionId);
  return row !== null;
}

/** Get all evaluations within a time window. */
export function getEvaluationsSince(persistDir: string, sinceMs: number): EvaluationRecord[] {
  const db = getDb(persistDir);
  return (
    db.prepare("SELECT * FROM evaluations WHERE createdAt >= ? ORDER BY createdAt ASC").all(sinceMs) as Record<
      string,
      unknown
    >[]
  ).map((row) => ({
    sessionId: row.sessionId as string,
    agent: row.agent as string,
    quality: row.quality as number,
    efficiency: row.efficiency as number,
    verdict: row.verdict as string,
    issues: safeParseJson(row.issues as string | null, []) as string[],
    usage: safeParseJson(row.usage as string | null, null),
    createdAt: row.createdAt as number,
  }));
}

function safeParseJson(s: string | null, fallback: any): any {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}
