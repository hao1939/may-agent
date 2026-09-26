/**
 * requests.ts — compatibility facade for DB helpers.
 *
 * Retained for callers outside the Host that use the old import path.
 * Host code imports the owning module under `./db/` directly. Conversation
 * Request state belongs to `app/core/state/conversation-requests.ts`.
 */

export { getDb, closeDb, closeAllDbs } from "./db/connection.js";
export { hasEvaluation, getEvaluationsSince } from "./db/evaluations.js";
export type { EvaluationRecord } from "./db/evaluations.js";
export {
  listTerminalTaskSessionBindings,
  readSessionLastActivityAt,
  upsertSession,
  updateSessionDb,
  updateSessionProgress,
} from "./db/sessions.js";
export type { SessionDbEntry } from "./db/sessions.js";
export { storeNotificationMessage, getNotificationMessage } from "./db/notifications.js";
export type { NotificationMessageRecord } from "./db/notifications.js";
export {
  insertWorkflowRun,
  updateWorkflowRun,
  getWorkflowRun,
  listWorkflowRunIds,
  listChildWorkflowRunIds,
  listRunningWorkflowRunIdsBefore,
  getWorkflowStepSessions,
} from "./db/workflows.js";
export type { WorkflowRunRecord } from "./db/workflows.js";
