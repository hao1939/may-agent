import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { isHumanActionOwner } from "../tasks/human-condition.js";
import { validateCurrentApproval } from "./approval.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export type HumanTaskReply = {
  target: { appId: string; taskId: string };
  taskGeneration: number;
  proposal?: unknown;
  condition?: { taskGeneration: number; conditionId: string; conditionGeneration: number };
};

export type HumanTaskReplyOptions = {
  trustedTelegram?: boolean;
  hasExactApp?: (appId: string) => boolean;
  db?: SqliteDb;
};

/** Resolve exact installed or retained App IDs (such as `worker.app`) before legacy `.app` suffix aliases. */
export function resolveHumanTaskReplyAppId(
  value: string,
  options?: Pick<HumanTaskReplyOptions, "hasExactApp" | "db">,
): string {
  const raw = value.trim();
  if (!raw || !raw.endsWith(".app")) return raw;
  if (options?.hasExactApp?.(raw)) return raw;
  if (options?.db) {
    const hasExact = Boolean(
      options.db
        .prepare(
          `SELECT 1 FROM app_task_store_meta WHERE app_id = ?
           UNION ALL SELECT 1 FROM app_tasks WHERE app_id = ?
           UNION ALL SELECT 1 FROM app_task_cancellations WHERE app_id = ?
           LIMIT 1`,
        )
        .get(raw, raw, raw),
    );
    if (hasExact) return raw;
  }
  if (!options?.hasExactApp && !options?.db) return raw;
  return raw.slice(0, -".app".length) || raw;
}

/** An explicit gesture, not a watch, quote, list or inferred intention. */
export function readHumanTaskReply(
  data: Record<string, unknown>,
  trustedOrOptions: boolean | HumanTaskReplyOptions = false,
): HumanTaskReply | null {
  const options: HumanTaskReplyOptions =
    typeof trustedOrOptions === "boolean" ? { trustedTelegram: trustedOrOptions } : trustedOrOptions;
  const trustedTelegram = options.trustedTelegram === true;
  const context = record(data.context);
  let reply = record(data.taskReply);
  // Older Telegram cards already retained a complete ordinary-question anchor.
  // Progress cards and bare focus never carried this evidence.
  if (
    trustedTelegram &&
    !data.taskReply &&
    record(context.ingress).provider === "telegram" &&
    Number.isSafeInteger(record(context.ingress).replyToMessageId) &&
    context.displayedHumanCondition
  ) {
    reply = {
      target: context.focusedTask,
      taskGeneration: record(context.displayedHumanCondition).taskGeneration,
      condition: context.displayedHumanCondition,
    };
  }
  // Older Console proposal details were already an explicit, generation-fenced
  // reply gesture, including feedback that is not a literal decision.
  if (!data.taskReply && !Object.keys(reply).length && data.replyTo && data.approvalReply) {
    const proposalReply = record(data.approvalReply);
    reply = {
      target: proposalReply.target,
      taskGeneration: record(proposalReply.proposal).taskGeneration,
      proposal: proposalReply.proposal,
    };
  }
  const target = record(reply.target);
  if (
    typeof target.appId !== "string" ||
    !target.appId.trim() ||
    typeof target.taskId !== "string" ||
    !target.taskId.trim() ||
    !Number.isSafeInteger(reply.taskGeneration) ||
    Number(reply.taskGeneration) < 1
  )
    return null;
  const targetAppId = resolveHumanTaskReplyAppId(target.appId, options);
  // Console sends both bindings for a displayed proposal. The weaker feedback
  // binding must not bypass that card's identity, even for non-decision text.
  if (data.approvalReply !== undefined) {
    const approval = record(data.approvalReply);
    const approvalTarget = record(approval.target);
    const proposal = record(approval.proposal);
    if (
      !data.replyTo ||
      typeof approvalTarget.appId !== "string" ||
      !approvalTarget.appId.trim() ||
      resolveHumanTaskReplyAppId(approvalTarget.appId, options) !== targetAppId ||
      typeof approvalTarget.taskId !== "string" ||
      approvalTarget.taskId.trim() !== target.taskId.trim() ||
      proposal.taskGeneration !== reply.taskGeneration ||
      (reply.proposal !== undefined && !isDeepStrictEqual(reply.proposal, proposal))
    )
      return null;
    reply = { ...reply, proposal };
  }
  const anchor = record(reply.condition);
  if (
    reply.condition !== undefined &&
    (typeof anchor.conditionId !== "string" ||
      !anchor.conditionId.trim() ||
      !Number.isSafeInteger(anchor.conditionGeneration) ||
      Number(anchor.conditionGeneration) < 1 ||
      anchor.taskGeneration !== reply.taskGeneration)
  )
    return null;
  return {
    target: { appId: targetAppId, taskId: target.taskId.trim() },
    taskGeneration: Number(reply.taskGeneration),
    ...(reply.proposal ? { proposal: reply.proposal } : {}),
    ...(reply.condition === undefined
      ? {}
      : {
          condition: {
            taskGeneration: Number(anchor.taskGeneration),
            conditionId: String(anchor.conditionId),
            conditionGeneration: Number(anchor.conditionGeneration),
          },
        }),
  };
}

/** Reused at routing and inside owning Task admission. Never searches for a newer card. */
export function currentHumanTaskReply(db: SqliteDb, reply: HumanTaskReply): boolean {
  const store = AppTaskResourceStore.activeFromDb(db, reply.target.appId);
  const view = store?.readTaskForView(reply.target.taskId);
  if (!view || view.closed || view.resource.metadata.generation !== reply.taskGeneration) return false;
  if (reply.proposal) {
    try {
      validateCurrentApproval(
        { type: "project.approval.submitted", target: reply.target, data: { proposal: reply.proposal } },
        db,
        { proposalOnly: true },
      );
    } catch {
      return false;
    }
  }
  if (!reply.condition) return true; // Exact feedback need not answer a question.
  if (!["pending", "running", "waiting", "attention"].includes(view.phase)) return false;
  const anchor = reply.condition;
  if (!view.resource.status.conditionIds?.includes(anchor.conditionId)) return false;
  const conditionIds = view.resource.status.conditionIds ?? [];
  // Match the exact-detail bound. Partial/unreadable cards cannot establish a
  // single question, and this action must not expand an unrelated Task graph.
  if (conditionIds.length > 100) return false;
  const conditions = store!.readTaskContext(
    { taskIds: [], conditionIds },
    { includeHistory: false, childLimit: 0 },
  ).conditions;
  if (conditionIds.some((id) => !conditions?.[id])) return false;
  const pending = conditionIds
    .map((id) => conditions?.[id])
    .filter((condition) => condition && condition.status.state !== "true" && isHumanActionOwner(condition.spec.owner));
  const condition = pending.length === 1 ? pending[0] : undefined;
  return Boolean(
    condition &&
    condition.metadata.id === anchor.conditionId &&
    condition.metadata.generation === anchor.conditionGeneration &&
    condition.spec.type !== "project.approval.submitted",
  );
}
