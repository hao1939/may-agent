import { getDb } from "./connection.js";
import type { SqliteDb } from "../db.js";

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

export type EvaluationProjection = {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: string;
  issues: string[];
  overall: Record<string, unknown>;
  evaluatedByHeuristic: boolean;
  createdAt: number;
  skipped: boolean;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function score(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function optionalCount(value: unknown): number | null {
  if (value === undefined) return 0;
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function optionalTextList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return value.map(textValue).filter(Boolean).slice(0, 100);
}

/** Validate the durable fact before projecting it into the evaluation read model. */
export function evaluationProjectionFromEventData(data: unknown): EvaluationProjection | null {
  const envelope = objectValue(data);
  const evaluation = objectValue(envelope.evaluation);
  const sessionId = textValue(evaluation.sessionId);
  const agent = textValue(evaluation.agent);
  const verdict = textValue(evaluation.verdict);
  const quality = score(evaluation.quality);
  const efficiency = score(evaluation.efficiency);
  const productiveCalls = optionalCount(evaluation.productiveCalls);
  const wastedCalls = optionalCount(evaluation.wastedCalls);
  const issues = optionalTextList(evaluation.issues);
  const signals = optionalTextList(evaluation.signals);
  const evaluatedByHeuristic = envelope.evaluatedByHeuristic === undefined ? true : envelope.evaluatedByHeuristic;
  const rawCreatedAt = evaluation.createdAt;
  const createdAt = rawCreatedAt === undefined ? Date.now() : finiteNumber(rawCreatedAt);
  if (
    !sessionId ||
    !agent ||
    !verdict ||
    quality === null ||
    efficiency === null ||
    productiveCalls === null ||
    wastedCalls === null ||
    issues === null ||
    signals === null ||
    typeof evaluatedByHeuristic !== "boolean" ||
    createdAt === null ||
    !Number.isSafeInteger(createdAt) ||
    createdAt <= 0 ||
    (evaluation.overall !== undefined && objectValue(evaluation.overall) !== evaluation.overall)
  ) {
    return null;
  }
  const source = textValue(envelope.source) || "evaluation.recorded";
  const overall = {
    ...objectValue(evaluation.overall),
    source,
    ...(textValue(evaluation.lane) ? { lane: textValue(evaluation.lane) } : {}),
    ...(textValue(evaluation.reason) ? { routeReason: textValue(evaluation.reason) } : {}),
    ...(signals.length ? { outputSignals: signals } : {}),
  };
  return {
    sessionId,
    agent,
    quality,
    efficiency,
    productiveCalls,
    wastedCalls,
    verdict,
    issues,
    overall,
    evaluatedByHeuristic,
    createdAt,
    skipped: verdict === "skipped",
  };
}

/** Idempotent read-model projection; the persisted event remains authoritative. */
export function upsertEvaluationProjection(db: SqliteDb, projection: EvaluationProjection): void {
  db.run(
    `INSERT INTO evaluations (
       sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
       verdict, issues, overall, usage, failureChains,
       evaluatedByHeuristic, skippedByJs, createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
     ON CONFLICT(sessionId) DO UPDATE SET
       agent = excluded.agent,
       quality = excluded.quality,
       efficiency = excluded.efficiency,
       productiveCalls = excluded.productiveCalls,
       wastedCalls = excluded.wastedCalls,
       verdict = excluded.verdict,
       issues = excluded.issues,
       overall = excluded.overall,
       evaluatedByHeuristic = excluded.evaluatedByHeuristic,
       skippedByJs = excluded.skippedByJs,
       createdAt = excluded.createdAt`,
    [
      projection.sessionId,
      projection.agent,
      projection.quality,
      projection.efficiency,
      projection.productiveCalls,
      projection.wastedCalls,
      projection.verdict,
      JSON.stringify(projection.issues),
      JSON.stringify(projection.overall),
      JSON.stringify([]),
      projection.evaluatedByHeuristic ? 1 : 0,
      projection.skipped ? 1 : 0,
      projection.createdAt,
    ],
  );
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
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
