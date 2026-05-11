/**
 * requests.ts — compatibility facade for DB helpers.
 *
 * The original `requests` table has been removed — work tracking uses the
 * sessions table and events table (event-native architecture). New DB code
 * should prefer the focused modules under `./db/`; this file preserves the
 * existing public import surface while Phase 9c splits storage by concern.
 */

export { getDb, closeDb, closeAllDbs } from "./db/connection.js";
export { hasEvaluation, getEvaluationsSince } from "./db/evaluations.js";
export type { EvaluationRecord } from "./db/evaluations.js";
export { upsertSession, updateSessionDb } from "./db/sessions.js";
export type { SessionDbEntry } from "./db/sessions.js";
export {
  insertWorkflowRun,
  updateWorkflowRun,
  getWorkflowRun,
  listWorkflowRunIds,
  getWorkflowStepSessions,
} from "./db/workflows.js";
export type { WorkflowRunRecord } from "./db/workflows.js";

// ErrorClass and classifyError are in classify-error.ts; re-export for backward compatibility.
export type { ErrorClass } from "./classify-error.js";
export { classifyError } from "./classify-error.js";
