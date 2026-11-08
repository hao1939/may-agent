import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../lib/db.js";
import { stateTransaction } from "../../lib/db/transaction.js";
import { wakeTaskWorkloadConstraints } from "../core/state/task-budget-funding.js";
import { readWorkloadWithdrawal, type WorkloadWithdrawalCommand, type WorkloadWithdrawalReceipt } from "../core/state/task-workload-enforcement.js";
import { assertOfflineWorkloadExecution, assertOfflineWorkloadFiles } from "./install-retained-workload-state.js";

/** Exact installation declarations, including historical root caps. Inspection
 * acquires a snapshot only; it creates no withdrawal record or new authority. */
export function inspectWorkloadConfiguration(db: SqliteDb): { configurationDigest: string } {
  return stateTransaction(db, () => {
    const configuration = {
      policies: db.prepare("SELECT * FROM task_budget_policies ORDER BY app_id").all(),
      limits: db.prepare("SELECT * FROM task_execution_limits ORDER BY scope_kind, scope_key").all(),
      roots: db.prepare("SELECT * FROM task_budget_roots ORDER BY root_app_id, root_task_id").all(),
    };
    return { configurationDigest: createHash("sha256").update(JSON.stringify(configuration)).digest("hex") };
  });
}

function validate(input: unknown): WorkloadWithdrawalCommand {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    Object.keys(input).some(key => !["version", "operationId", "reason", "expectedConfigurationDigest"].includes(key)))
    throw new Error("Invalid workload withdrawal command");
  const command = input as WorkloadWithdrawalCommand;
  if (command.version !== 1 || [command.operationId, command.reason].some(value =>
    typeof value !== "string" || !value || value !== value.trim() || Buffer.byteLength(value) > 1024) ||
    typeof command.expectedConfigurationDigest !== "string" || !/^[a-f0-9]{64}$/.test(command.expectedConfigurationDigest))
    throw new Error("Workload withdrawal requires exact operation identity, reason and expected configuration");
  return command;
}

/** One-way, trusted offline withdrawal after external exclusion and confirmed
 * cleanup. Keep every policy, root, debit, reservation and caller obligation.
 * Future work uses ordinary Host limits and records no new workload charges.
 * There is no reactivation API across that unaccounted interval. */
export function withdrawWorkloadEnforcement(
  db: SqliteDb, stateDir: string, input: unknown,
  options: { quiesced: true; dryRun?: boolean }, now = Date.now(),
): { kind: "withdrawn" | "dry-run"; receipt: WorkloadWithdrawalReceipt; replay: boolean } {
  if (options.quiesced !== true) throw new Error("Withdrawal requires externally isolated, quiesced state");
  const command = validate(input);
  if (!Number.isSafeInteger(now) || now < 1) throw new Error("Withdrawal requires a positive epoch timestamp");
  assertOfflineWorkloadFiles(db, stateDir);
  const rollback = Symbol("rollback workload withdrawal validation");
  let result: { kind: "withdrawn" | "dry-run"; receipt: WorkloadWithdrawalReceipt; replay: boolean };
  try {
    return stateTransaction(db, () => {
      assertOfflineWorkloadExecution(db);
      const previous = readWorkloadWithdrawal(db);
      if (previous) {
        if (!isDeepStrictEqual(previous.command, command)) throw new Error("Workload enforcement already has a different withdrawal record");
        return { kind: "withdrawn", receipt: previous, replay: true };
      }
      if (inspectWorkloadConfiguration(db).configurationDigest !== command.expectedConfigurationDigest)
        throw new Error("Workload withdrawal lost its exact installation configuration fence");
      if (!db.prepare("SELECT 1 FROM task_budget_policies LIMIT 1").get() &&
        !db.prepare("SELECT 1 FROM task_execution_limits LIMIT 1").get())
        throw new Error("No installed workload policy to withdraw");
      const receipt: WorkloadWithdrawalReceipt = { command, withdrawnAt: now };
      db.prepare("INSERT INTO task_workload_withdrawal(singleton, receipt_json) VALUES (1, ?)").run(JSON.stringify(receipt));
      const tasks = db.prepare(`SELECT app_id, task_id FROM app_tasks WHERE json_valid(resource_json)
        AND (json_extract(resource_json, '$.status.funding') IS NOT NULL
          OR json_extract(resource_json, '$.status.executionConstraint') IS NOT NULL)`).all();
      wakeTaskWorkloadConstraints(db, tasks, now, ["funding", "executionConstraint"]);
      db.prepare(`UPDATE app_inbox_items SET handling = NULL, available_at = ?, changed_at = ?, updated_at = ?
        WHERE status != 'done' AND json_extract(handling, '$.phase') = 'deferred'
          AND json_extract(handling, '$.funding') IS NOT NULL`).run(now, now, now);
      result = { kind: options.dryRun ? "dry-run" : "withdrawn", receipt, replay: false };
      if (options.dryRun) throw rollback;
      return result;
    });
  } catch (error) {
    if (error === rollback) return result!;
    throw error;
  }
}
