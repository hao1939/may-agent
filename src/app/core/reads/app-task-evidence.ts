import type { TaskAcceptedEvidencePage, TaskAcceptedEvidenceOptions } from "@may-agent/sdk/app";
import type { SqliteDb } from "../../../lib/db.js";
import type { AppTaskAttempt } from "../tasks/app-task-state.js";

const DEFAULT_LIMIT = 8;
export const TASK_ACCEPTED_EVIDENCE_MAX_PAGE_SIZE = 8;
// Leaves room for record identity/provenance inside a 32 KiB per-item response budget.
const MAX_ACCEPTED_RESULT_BYTES = 24 * 1_024;
const MAX_SUMMARY_BYTES = 4_096;
const MAX_RESPONSE_BYTES = 4_096;
const MAX_FACTS = 8;
const MAX_FACT_BYTES = 512;
const MAX_RESULT_BYTES = 16 * 1_024;

type EvidenceCursor = { startedAt: number; attemptId: string };

function encodeCursor(cursor: EvidenceCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): EvidenceCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<EvidenceCursor>;
    if (
      !Number.isSafeInteger(parsed.startedAt) ||
      typeof parsed.attemptId !== "string" ||
      !parsed.attemptId ||
      encodeCursor(parsed as EvidenceCursor) !== value
    ) {
      throw new Error("invalid cursor");
    }
    return parsed as EvidenceCursor;
  } catch {
    throw new Error("Invalid accepted evidence cursor");
  }
}

function boundedText(value: string, maxBytes: number): { value: string; truncated: boolean } {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return { value, truncated: false };
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle), "utf8") <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return { value: value.slice(0, low), truncated: true };
}

function boundedAcceptedResult(result: NonNullable<AppTaskAttempt["acceptedResult"]>) {
  if (Buffer.byteLength(JSON.stringify(result), "utf8") <= MAX_ACCEPTED_RESULT_BYTES) {
    return { value: structuredClone(result), fields: [] as string[] };
  }
  const fields = new Set<"summary" | "response" | "result" | "facts" | "acceptanceBasis" | "acceptedLiveEventIds">();
  const summary = boundedText(result.summary, MAX_SUMMARY_BYTES);
  if (summary.truncated) fields.add("summary");
  const response = result.response ? boundedText(result.response, MAX_RESPONSE_BYTES) : null;
  if (response?.truncated) fields.add("response");
  const facts = result.facts.slice(0, MAX_FACTS).map((fact) => {
    const bounded = boundedText(fact, MAX_FACT_BYTES);
    if (bounded.truncated) fields.add("facts");
    return bounded.value;
  });
  if (result.facts.length > MAX_FACTS) fields.add("facts");
  const resultBytes = result.result === undefined ? 0 : Buffer.byteLength(JSON.stringify(result.result), "utf8");
  if (resultBytes > MAX_RESULT_BYTES) fields.add("result");
  if (result.acceptanceBasis) fields.add("acceptanceBasis");
  if (result.acceptedLiveEventIds) fields.add("acceptedLiveEventIds");
  const value = {
    state: result.state,
    ...(result.reviewAt === undefined ? {} : { reviewAt: result.reviewAt }),
    ...(result.continue ? { continue: true as const } : {}),
    ...(result.report ? { report: true as const } : {}),
    summary: summary.value,
    ...(response ? { response: response.value } : {}),
    ...(result.result !== undefined && resultBytes <= MAX_RESULT_BYTES
      ? { result: structuredClone(result.result) }
      : {}),
    facts,
  };
  if (Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_ACCEPTED_RESULT_BYTES) {
    return { value, fields: [...fields] };
  }
  // Raw UTF-8 field limits do not bound JSON escaping (for example U+0001).
  // Fall back once for the complete serialized acceptedResult rather than
  // accumulating per-field exceptions. Cursor progress and record provenance
  // remain outside this omitted content.
  fields.add("summary");
  if (result.response) fields.add("response");
  if (result.result !== undefined) fields.add("result");
  if (result.facts.length > 0) fields.add("facts");
  return {
    value: {
      state: result.state,
      ...(result.reviewAt === undefined ? {} : { reviewAt: result.reviewAt }),
      ...(result.continue ? { continue: true as const } : {}),
      ...(result.report ? { report: true as const } : {}),
      summary: boundedText(result.summary, 1_024).value,
      facts: [],
    },
    fields: [...fields],
  };
}

export function hasTaskAcceptedEvidence(db: SqliteDb, appId: string, taskId: string): boolean {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM app_task_attempts
       WHERE app_id = ? AND task_id = ?
         AND json_type(attempt_json, '$.acceptedResult') = 'object'
       LIMIT 1`,
      )
      .get(appId, taskId),
  );
}

/** Bounded immutable accepted-attempt records. They never replace the Task's current result. */
export function readTaskAcceptedEvidence(
  db: SqliteDb,
  appId: string,
  taskId: string,
  options: TaskAcceptedEvidenceOptions = {},
): TaskAcceptedEvidencePage {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > TASK_ACCEPTED_EVIDENCE_MAX_PAGE_SIZE) {
    throw new Error(`Accepted evidence limit must be an integer between 1 and ${TASK_ACCEPTED_EVIDENCE_MAX_PAGE_SIZE}`);
  }
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  const rows = db
    .prepare(
      `SELECT attempt_id, task_generation, started_at, attempt_json
       FROM app_task_attempts
       WHERE app_id = ? AND task_id = ?
         AND json_type(attempt_json, '$.acceptedResult') = 'object'
         ${cursor ? "AND (started_at < ? OR (started_at = ? AND attempt_id < ?))" : ""}
       ORDER BY started_at DESC, attempt_id DESC
       LIMIT ?`,
    )
    .all(appId, taskId, ...(cursor ? [cursor.startedAt, cursor.startedAt, cursor.attemptId] : []), limit + 1) as Array<{
    attempt_id: string;
    task_generation: number;
    started_at: number;
    attempt_json: string;
  }>;
  const pageRows = rows.slice(0, limit);
  const items = pageRows.flatMap((row) => {
    const attempt = JSON.parse(row.attempt_json) as AppTaskAttempt;
    if (!attempt.acceptedResult) return [];
    const bounded = boundedAcceptedResult(attempt.acceptedResult);
    return [
      {
        appId,
        taskId,
        taskGeneration: row.task_generation,
        attemptId: row.attempt_id,
        provenance: "app_task_attempts.acceptedResult" as const,
        startedAt: attempt.startedAt,
        ...(attempt.finishedAt ? { finishedAt: attempt.finishedAt } : {}),
        ...(bounded.fields.length > 0 ? { truncated: { fields: bounded.fields } } : {}),
        acceptedResult: bounded.value,
      },
    ];
  });
  const last = pageRows.at(-1);
  return {
    items,
    ...(rows.length > limit && last
      ? { nextCursor: encodeCursor({ startedAt: last.started_at, attemptId: last.attempt_id }) }
      : {}),
  };
}
