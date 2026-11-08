import type { SqliteDb } from "../../../lib/db.js";

/** Installation record, not another Task lifecycle or spending ledger. Withdrawal
 * ends new enforcement only after externally excluded, confirmed-clean execution.
 * There is intentionally no automatic reactivation across unaccounted work. */
export type WorkloadWithdrawalCommand = {
  version: 1;
  operationId: string;
  reason: string;
  expectedConfigurationDigest: string;
};
export type WorkloadWithdrawalReceipt = {
  command: WorkloadWithdrawalCommand;
  withdrawnAt: number;
};

export function readWorkloadWithdrawal(db: SqliteDb): WorkloadWithdrawalReceipt | null {
  const row = db.prepare("SELECT receipt_json FROM task_workload_withdrawal WHERE singleton = 1").get();
  if (!row) return null;
  const receipt = JSON.parse(row.receipt_json as string) as WorkloadWithdrawalReceipt | null;
  if (!receipt || !Number.isSafeInteger(receipt.withdrawnAt) || receipt.withdrawnAt < 1 ||
    receipt.command?.version !== 1 ||
    [receipt.command.operationId, receipt.command.reason].some(value => typeof value !== "string" ||
      !value || value !== value.trim() || Buffer.byteLength(value) > 1024) ||
    typeof receipt.command.expectedConfigurationDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(receipt.command.expectedConfigurationDigest))
    throw new Error("Workload withdrawal record requires explicit recovery");
  return receipt;
}

/** Shared durable installation authority. Never cached in a runtime or Task. */
export function workloadEnforcementEnabled(db: SqliteDb): boolean {
  return !readWorkloadWithdrawal(db);
}

export function assertWorkloadEnforcementInstallable(db: SqliteDb): void {
  if (!workloadEnforcementEnabled(db))
    throw new Error("Workload enforcement was withdrawn; reactivation requires explicit adoption");
}
