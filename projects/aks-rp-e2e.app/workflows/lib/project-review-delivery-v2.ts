import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROJECT_PENDING_ACTION_DELIVERY_V2,
  type PendingActionDeliveryReceiptV2,
} from "./project-pending-actions-v2.ts";

type JsonRecord = Record<string, unknown>;

function reviewerLedgerPath(appDir: string): string {
  return join(appDir, ".state", "task-reviewer-runs.jsonl");
}

export function readReviewerLedgerRowsV2(appDir: string): JsonRecord[] {
  const path = reviewerLedgerPath(appDir);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .flatMap((line): JsonRecord[] => {
      try {
        const value = JSON.parse(line);
        return value && typeof value === "object" && !Array.isArray(value)
          ? [value as JsonRecord]
          : [];
      } catch {
        return [];
      }
    });
}

export function pendingActionDeliveryReceiptsV2(
  rows: JsonRecord[],
  actionKey: string,
): PendingActionDeliveryReceiptV2[] {
  return rows.flatMap((row): PendingActionDeliveryReceiptV2[] => {
    if (
      row.result !== "pending-action-delivery-v2" ||
      row.version !== PROJECT_PENDING_ACTION_DELIVERY_V2 ||
      row.action_key !== actionKey
    ) {
      return [];
    }
    const attempt = row.delivery_attempt;
    const status = row.delivery_status;
    const actionKind = row.action_kind;
    const recordedAt = row.recorded_at;
    if (
      typeof attempt !== "number" ||
      !Number.isInteger(attempt) ||
      attempt <= 0 ||
      (status !== "accepted" && status !== "failed") ||
      actionKind !== "review-application-delivery" ||
      typeof recordedAt !== "string"
    ) {
      return [];
    }
    return [
      {
        version: PROJECT_PENDING_ACTION_DELIVERY_V2,
        actionKey,
        actionKind,
        attempt,
        status,
        recordedAt,
        ...(typeof row.error === "string" ? { error: row.error } : {}),
      },
    ];
  });
}

export function appendReviewerLedgerRowV2(
  appDir: string,
  workflow: string,
  entry: JsonRecord,
): void {
  const path = reviewerLedgerPath(appDir);
  mkdirSync(join(appDir, ".state"), { recursive: true });
  appendFileSync(
    path,
    `${JSON.stringify({ ts: new Date().toISOString(), workflow, ...entry })}\n`,
  );
}

export function appendPendingActionDeliveryReceiptV2(
  appDir: string,
  workflow: string,
  receipt: PendingActionDeliveryReceiptV2,
  input: {
    reviewId: string;
    taskId: string;
    taskRevision: number;
    attemptId: string;
  },
): void {
  appendReviewerLedgerRowV2(appDir, workflow, {
    result: "pending-action-delivery-v2",
    version: receipt.version,
    action_key: receipt.actionKey,
    action_kind: receipt.actionKind,
    delivery_attempt: receipt.attempt,
    delivery_status: receipt.status,
    recorded_at: receipt.recordedAt,
    ...(receipt.error ? { error: receipt.error } : {}),
    review_id: input.reviewId,
    task_id: input.taskId,
    task_revision: input.taskRevision,
    attempt_id: input.attemptId,
  });
}
