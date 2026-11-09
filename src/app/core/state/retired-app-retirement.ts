import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { AppTaskAdmission, AppTaskContext } from "../tasks/app-task-store.js";
import type { AppTaskResource } from "../tasks/app-task-state.js";
import { cancelAppTask } from "../tasks/app-task-reconciler.js";
import { parseTaskResource, type AppTaskResourceStore } from "./app-task-resource-store.js";

/** Private operator data: preserve the reviewed plan and a verified offline backup. */
export type RetiredAppRetirementPlan = {
  id: string;
  appId: string;
  quiesced: true;
  appRetired: true;
  tasks: Array<{ taskId: string; resourceJson: string; triggerJson: string | null; reason: string }>;
  inputs: Array<{
    row: Record<string, unknown>;
    reason: string;
    admissionWithdrawal?: {
      decision: "withdraw-unfulfilled";
      rows: Array<{ app_id: string; task_id: string; admission_json: string }>;
    };
  }>;
};

type RetirementResult = { status: "would-retire" | "retired" | "already-retired"; tasks: number; inputs: number };
class DryRunRollback extends Error {
  constructor(readonly result: RetirementResult) {
    super("Dry-run rollback");
  }
}
function required(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty`);
}
function sameIds(actual: string[], expected: string[], label: string) {
  if (new Set(expected).size !== expected.length || !isDeepStrictEqual(actual.sort(), [...expected].sort()))
    throw new Error(`${label} census changed or plan has duplicate identities`);
}

/** Read-only preservation proof, also used to audit private offline plans. */
export function assertRetainedRetirementOutcome(store: AppTaskResourceStore, task: AppTaskResource): void {
  const { status } = task;
  const payloadFields = ["summary", "response", "result"] as const;
  // Phase and missing references cannot prove there is no historical outcome.
  // Each projected value that cancellation replaces needs its own retained copy.
  const requiresEvidence =
    status.phase === "converged" ||
    status.phase === "waiting" ||
    status.observedAttemptId !== undefined ||
    payloadFields.some((field) => status[field] !== undefined);
  if (!requiresEvidence) return;
  const observed = status.observedAttemptId ? store.readAttempt(status.observedAttemptId) : undefined;
  const accepted = observed?.acceptedResult;
  if (
    !observed ||
    observed.metadata.id !== status.observedAttemptId ||
    observed.taskId !== task.metadata.id ||
    !Number.isSafeInteger(observed.taskGeneration) ||
    observed.taskGeneration < 1 ||
    // Controller acknowledgement can rewind on explicit retry; the accepted
    // attempt, not observedGeneration, owns the retained payload's generation.
    observed.taskGeneration > task.metadata.generation ||
    observed.state !== "completed" ||
    !accepted ||
    (status.phase === "converged" && accepted.state !== "converged") ||
    payloadFields.some(
      (field) =>
        status[field] !== undefined &&
        !isDeepStrictEqual(status[field], accepted[field]) &&
        // The exact attempt also retains canonical controller diagnostics, such
        // as reportAppTaskFailure's decorated summary. This is preservation, not
        // acceptance or caller fulfillment; never whitelist a text prefix.
        !(field === "summary" && status.summary === observed.summary),
    )
  )
    throw new Error(`Task outcome requires retained accepted evidence before cancellation: ${task.metadata.id}`);
}

/**
 * Explicit offline withdrawal, never startup recovery. The operator must stop
 * the Host/workers and retire the App first; expired leases prove neither.
 * Meaning and evidence belong to the exact reviewed plan, not this operation.
 */
export function retireAppState(
  context: AppTaskContext,
  plan: RetiredAppRetirementPlan,
  options: { dryRun?: boolean; now?: number } = {},
): RetirementResult {
  if (!plan || plan.quiesced !== true || plan.appRetired !== true)
    throw new Error("Retirement requires a quiesced Host and an explicitly retired App");
  required(plan.id, "plan id");
  required(plan.appId, "App id");
  if (context.resourceStore.appId !== plan.appId) throw new Error("Retirement context belongs to another App");
  if (!Array.isArray(plan.tasks) || !Array.isArray(plan.inputs) || plan.tasks.length + plan.inputs.length > 1000)
    throw new Error("Retirement requires a bounded explicit plan");
  const store = context.resourceStore;
  const db = store.db;
  // Bind every terminal decision to the complete reviewed preimages, including
  // input-only plans. Reusing an id with different evidence cannot pass replay.
  const digest = createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  const reason = (value: string) => `Retired by operator (${plan.id}; sha256:${digest}): ${value}`.trim();
  const taskControlKey = (taskId: string) => `retire-app:sha256:${digest}:task:${taskId}`;
  try {
    return stateTransaction(db, () => {
      const currentTaskIds = db
        .prepare(
          `SELECT t.task_id FROM app_tasks t WHERE t.app_id = ?
        AND NOT EXISTS (SELECT 1 FROM app_task_cancellations c WHERE c.app_id=t.app_id AND c.task_id=t.task_id)
        AND NOT EXISTS (SELECT 1 FROM app_task_receipts r
          WHERE r.app_id=t.app_id AND r.receipt_id=t.task_id
            AND json_extract(r.receipt_json, '$.metadata.generation') >= t.generation)`,
        )
        .all(plan.appId)
        .map((row) => String(row.task_id));
      const remainingTasks: typeof plan.tasks = [];
      for (const task of plan.tasks) {
        required(task.taskId, "Task id");
        required(task.reason, "Task retirement reason");
        required(task.resourceJson, "reviewed Task resource");
        const expected = parseTaskResource(task.resourceJson);
        if (
          expected?.metadata?.id !== task.taskId ||
          !expected.status ||
          !expected.spec ||
          !Number.isSafeInteger(expected.metadata.generation) ||
          expected.metadata.generation < 1 ||
          !Number.isSafeInteger(expected.metadata.resourceVersion) ||
          expected.metadata.resourceVersion < 1 ||
          expected.status.currentAttemptId ||
          (task.triggerJson !== null && typeof task.triggerJson !== "string")
        )
          throw new Error("Reviewed Task identity is mismatched or has a current attempt");
        const controlKey = taskControlKey(task.taskId);
        const terminal = store.readCancellation(task.taskId);
        if (terminal) {
          const receipt = store.readControlReceipt(controlKey);
          const current = store.readTask(task.taskId);
          if (
            !receipt ||
            receipt.action !== "cancel" ||
            receipt.appId !== plan.appId ||
            receipt.taskId !== task.taskId ||
            receipt.expectedGeneration !== expected.metadata.generation ||
            receipt.expectedResourceVersion !== expected.metadata.resourceVersion ||
            receipt.appliedResourceVersion !== expected.metadata.resourceVersion + 1 ||
            terminal.generation !== expected.metadata.generation ||
            terminal.resourceVersion !== receipt.appliedResourceVersion ||
            terminal.kind !== "cancelled" ||
            terminal.reason !== reason(task.reason) ||
            current?.metadata.generation !== terminal.generation ||
            current.metadata.resourceVersion !== terminal.resourceVersion ||
            !isDeepStrictEqual(current.spec, expected.spec) ||
            current.status.currentAttemptId ||
            current.status.phase !== "attention" ||
            current.status.summary !== terminal.summary ||
            current.status.response !== terminal.response ||
            !isDeepStrictEqual(current.status.facts, terminal.facts) ||
            !isDeepStrictEqual(terminal.facts, expected.status.facts ?? []) ||
            terminal.result !== undefined ||
            current.status.result !== undefined ||
            current.status.conditionIds?.length ||
            store.readTrigger(task.taskId)
          )
            throw new Error("Task has a different terminal decision");
        } else {
          const row = db
            .prepare("SELECT resource_json, trigger_json FROM app_tasks WHERE app_id=? AND task_id=?")
            .get(plan.appId, task.taskId);
          if (row?.resource_json !== task.resourceJson || (row?.trigger_json ?? null) !== task.triggerJson)
            throw new Error(`Reviewed Task changed: ${task.taskId}`);
          remainingTasks.push(task);
        }
      }
      if (new Set(plan.tasks.map((task) => task.taskId)).size !== plan.tasks.length)
        throw new Error("Duplicate planned Task");
      sameIds(
        currentTaskIds,
        remainingTasks.map((task) => task.taskId),
        "Task",
      );

      const remainingInputs: typeof plan.inputs = [];
      let reviewedRecords = plan.tasks.length + plan.inputs.length;
      for (const input of plan.inputs) {
        const expected = input.row;
        if (!expected || typeof expected !== "object") throw new Error("Reviewed input row is required");
        required(expected.id, "input id");
        required(input.reason, "input retirement reason");
        if (
          expected.app_id !== plan.appId ||
          !["pending", "handling"].includes(String(expected.status)) ||
          !Number.isSafeInteger(expected.lease_generation) ||
          Number(expected.lease_generation) < 0 ||
          expected.result != null ||
          expected.execution_task_id != null ||
          expected.task_admission_key != null ||
          expected.conversation_id != null ||
          expected.target_task_id != null
        )
          throw new Error(
            "Retirement only supports unresolved legacy inputs without Task/Conversation attachments or a result",
          );
        // Older Hosts could commit admission (and even its accepted answer)
        // before projecting the inbox attachment. Check that authority directly;
        // aliases may lack an event, while opaque keys can retain the input id.
        const desiredPrefix = `task:${expected.id}:desired:`;
        const existingPrefix = `task:${expected.id}:existing:`;
        const admissions = db
          .prepare(
            `SELECT app_id, task_id, admission_json FROM app_task_admissions WHERE app_id=? AND (
          task_id IN (?, ?, ?) OR substr(task_id, 1, length(?))=? OR substr(task_id, 1, length(?))=?
          OR json_extract(admission_json, '$.inputEvent.data.request.id')=?) LIMIT 1001`,
          )
          .all(
            plan.appId,
            `task:${expected.id}`,
            `conversation-input:${expected.id}`,
            `conversation-follow-up:${plan.appId}:${expected.id}`,
            desiredPrefix,
            desiredPrefix,
            existingPrefix,
            existingPrefix,
            expected.id,
          );
        const withdrawal = input.admissionWithdrawal;
        if (withdrawal === undefined) {
          if (admissions.length) throw new Error(`Reviewed input has durable admission evidence: ${expected.id}`);
        } else {
          if (
            !withdrawal ||
            withdrawal.decision !== "withdraw-unfulfilled" ||
            !Array.isArray(withdrawal.rows) ||
            !withdrawal.rows.length ||
            (reviewedRecords += withdrawal.rows.length) > 1000
          )
            throw new Error("Admitted withdrawal requires a bounded explicit unfulfilled decision");
          for (const row of withdrawal.rows) {
            if (!row || row.app_id !== plan.appId) throw new Error("Admission withdrawal belongs to another App");
            required(row.task_id, "reviewed admission key");
            required(row.admission_json, "reviewed admission bytes");
          }
          sameIds(
            admissions.map((row) => String(row.task_id)),
            withdrawal.rows.map((row) => row.task_id),
            "Input admission",
          );
          const reviewed = new Map(withdrawal.rows.map((row) => [row.task_id, row]));
          for (const row of admissions) {
            if (!isDeepStrictEqual(row, reviewed.get(String(row.task_id))))
              throw new Error(`Reviewed input admission changed: ${row.task_id}`);
            const admission = JSON.parse(String(row.admission_json)) as AppTaskAdmission;
            required(admission?.taskId, "admitted Task identity");
            required(admission.specHash, "admitted Task spec hash");
            if (!Number.isSafeInteger(admission.taskGeneration) || admission.taskGeneration < 1)
              throw new Error("Admitted Task generation is invalid");
            if (admission.resultAttemptId != null)
              throw new Error("An accepted admission answer must be settled before withdrawal");
            const request = admission.inputEvent?.data as { request?: { id?: unknown } } | undefined;
            if (request?.request?.id != null && request.request.id !== expected.id)
              throw new Error("Admission retains a different input identity");
            const task = store.readTask(admission.taskId);
            const receipt = store.readReceipt(admission.taskId);
            // Reopening retains earlier terminal authority in its control
            // receipt. A newer cancellation cannot erase an older completion.
            const terminal = store.readAdmissionCancellation(admission.taskId, String(row.task_id));
            const completed = db
              .prepare(
                `SELECT 1 FROM app_task_attempts
              WHERE app_id=? AND task_id=? AND task_generation>=?
                AND json_extract(attempt_json, '$.acceptedResult.state')='converged'
                AND (task_generation=? OR EXISTS (
                  SELECT 1 FROM json_each(app_task_attempts.attempt_json, '$.acceptedResult.inputKeys') input
                  WHERE input.value=?)) LIMIT 1`,
              )
              .get(plan.appId, admission.taskId, admission.taskGeneration, admission.taskGeneration, row.task_id);
            if (
              completed ||
              receipt?.metadata.generation === admission.taskGeneration ||
              (terminal?.kind === "closed" && terminal.generation === admission.taskGeneration) ||
              (task?.status.observedGeneration === admission.taskGeneration && task.status.phase === "converged")
            )
              throw new Error("Completion evidence for an admitted generation must be settled before withdrawal");
            const generation = Math.max(
              task?.metadata.generation ?? 0,
              receipt?.metadata.generation ?? 0,
              terminal?.generation ?? 0,
            );
            if (
              !Number.isSafeInteger(generation) ||
              generation < admission.taskGeneration ||
              task?.status.currentAttemptId
            )
              throw new Error("Admitted Task authority is missing, older than the admission, or has a current attempt");
          }
          // Withdraw the caller's requirement, not one selected alias or the
          // Task's latest answer. All admissions and accepted evidence remain.
        }
        const current = db
          .prepare("SELECT * FROM app_inbox_items WHERE id=? AND app_id=?")
          .get(expected.id, plan.appId);
        if (current?.status === "done") {
          const prior = { ...current };
          const handling = JSON.stringify({ phase: "stopped", reason: reason(input.reason) });
          if (
            current.handling !== handling ||
            current.result !== null ||
            current.lease_generation !== Number(expected.lease_generation) + 1 ||
            current.lease_owner !== null ||
            current.lease_expires_at !== null ||
            current.available_at !== null ||
            current.review_at !== null ||
            !Number.isSafeInteger(current.completed_at) ||
            current.changed_at !== current.completed_at ||
            current.updated_at !== current.completed_at
          )
            throw new Error("Input has a different terminal decision");
          for (const key of [
            "status",
            "handling",
            "lease_generation",
            "lease_owner",
            "lease_expires_at",
            "available_at",
            "review_at",
            "completed_at",
            "changed_at",
            "updated_at",
          ])
            prior[key] = expected[key];
          if (!isDeepStrictEqual(prior, expected)) throw new Error("Retired input identity changed");
        } else {
          if (!isDeepStrictEqual(current, expected)) throw new Error(`Reviewed input changed: ${expected.id}`);
          remainingInputs.push(input);
        }
      }
      const inputIds = plan.inputs.map((input) => String(input.row.id));
      if (new Set(inputIds).size !== inputIds.length) throw new Error("Duplicate planned input");
      sameIds(
        db
          .prepare("SELECT id FROM app_inbox_items WHERE app_id=? AND status!='done'")
          .all(plan.appId)
          .map((row) => String(row.id)),
        remainingInputs.map((input) => String(input.row.id)),
        "Input",
      );
      // Prove conservation for the complete original plan before any mutation,
      // including replay. A prior cancellation is not proof its history survives.
      for (const task of plan.tasks) assertRetainedRetirementOutcome(store, parseTaskResource(task.resourceJson));
      if (!remainingTasks.length && !remainingInputs.length)
        return { status: "already-retired", tasks: plan.tasks.length, inputs: plan.inputs.length };
      // One transaction is all-or-nothing. Refuse a mixed replay rather than
      // treating someone else's partial state changes as this operation's work.
      if (remainingTasks.length !== plan.tasks.length || remainingInputs.length !== plan.inputs.length)
        throw new Error("Retirement plan is partially applied or changed");

      for (const task of remainingTasks) {
        const expected = parseTaskResource(task.resourceJson);
        cancelAppTask(context, {
          appId: plan.appId,
          taskId: task.taskId,
          expectedGeneration: expected.metadata.generation,
          expectedResourceVersion: expected.metadata.resourceVersion,
          reason: reason(task.reason),
          decision: "human",
          controlKey: taskControlKey(task.taskId),
        });
      }
      const now = options.now ?? Date.now();
      for (const input of remainingInputs) {
        const updated = db
          .prepare(
            `UPDATE app_inbox_items SET status='done', handling=?, result=NULL,
          lease_generation=lease_generation+1, lease_owner=NULL, lease_expires_at=NULL,
          available_at=NULL, review_at=NULL, completed_at=?, changed_at=?, updated_at=?
          WHERE app_id=? AND id=? AND status=? AND lease_generation=?`,
          )
          .run(
            JSON.stringify({ phase: "stopped", reason: reason(input.reason) }),
            now,
            now,
            now,
            plan.appId,
            input.row.id,
            input.row.status,
            input.row.lease_generation,
          );
        if (updated.changes !== 1) throw new Error("Legacy input retirement lost its fence");
      }
      const result: RetirementResult = {
        status: options.dryRun ? "would-retire" : "retired",
        tasks: plan.tasks.length,
        inputs: plan.inputs.length,
      };
      if (options.dryRun) throw new DryRunRollback(result);
      return result;
    });
  } catch (error) {
    if (error instanceof DryRunRollback) return error.result;
    throw error;
  }
}
