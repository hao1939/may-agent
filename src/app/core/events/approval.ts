import { isDeepStrictEqual } from "node:util";
import { readVerifiedApprovalDecision, type EventInput } from "@may-agent/control/events";
import type { SqliteDb } from "../../../lib/db.js";
import type { AppTaskCondition } from "../tasks/app-task-state.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { isHumanActionOwner } from "../tasks/human-condition.js";

export const HOST_APPROVAL_VERSION = 1;

export class ApprovalValidationError extends Error {}

export type ApprovalIngressAuthorization = {
  actor: { kind: "human" | "operator"; id: string };
  reference: string;
  evidence: Record<string, unknown>;
};

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${field} must be a positive integer`);
  return Number(value);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

export function validateCurrentApproval(input: EventInput, db: SqliteDb): void {
  const appId = text(input.target?.appId, "project.approval.submitted target.appId");
  const taskId = text(input.target?.taskId, "project.approval.submitted target.taskId");
  const proposal = record(input.data.proposal, "project.approval.submitted data.proposal");
  const taskGeneration = integer(proposal.taskGeneration, "project.approval.submitted data.proposal.taskGeneration");
  const conditionId = text(proposal.conditionId, "project.approval.submitted data.proposal.conditionId");
  const conditionGeneration = integer(
    proposal.conditionGeneration,
    "project.approval.submitted data.proposal.conditionGeneration",
  );
  const requestedAction = text(proposal.requestedAction, "project.approval.submitted data.proposal.requestedAction");
  const subject = text(proposal.subject, "project.approval.submitted data.proposal.subject");
  if (!("expected" in proposal)) throw new ApprovalValidationError("project.approval.submitted data.proposal.expected is required");

  const store = AppTaskResourceStore.activeFromDb(db, appId);
  const taskView = store?.readTaskForView(taskId);
  if (!taskView) throw new ApprovalValidationError(`Task ${appId}/${taskId} was not found`);
  const task = taskView.resource;
  if (task.metadata.generation !== taskGeneration) {
    throw new ApprovalValidationError(`Task ${appId}/${taskId} generation changed`);
  }
  if (taskView.closed || !["pending", "running", "waiting", "attention"].includes(taskView.phase)) {
    throw new ApprovalValidationError(`Task ${appId}/${taskId} is not awaiting approval`);
  }
  if (!task.status.conditionIds?.includes(conditionId)) {
    throw new ApprovalValidationError(`Condition ${conditionId} is not current for Task ${appId}/${taskId}`);
  }

  const condition = store!.readTaskContext({ taskIds: [taskId] }, { includeHistory: false, childLimit: 0 })
    .conditions?.[conditionId];
  if (!condition) throw new ApprovalValidationError(`Condition ${conditionId} was not found`);
  if (
    condition.metadata.generation !== conditionGeneration ||
    condition.status.state === "true" ||
    condition.spec.type !== "project.approval.submitted" ||
    !isHumanActionOwner(condition.spec.owner)
  ) {
    throw new ApprovalValidationError(`Condition ${conditionId} is not the current human approval`);
  }
  if (condition.spec.subject !== subject) throw new ApprovalValidationError(`Condition ${conditionId} subject changed`);
  if (condition.spec.requestedAction?.trim() !== requestedAction) {
    throw new ApprovalValidationError(`Condition ${conditionId} requested action changed`);
  }
  if (!isDeepStrictEqual(condition.spec.expected, proposal.expected)) {
    throw new ApprovalValidationError(`Condition ${conditionId} expected contract changed`);
  }
  for (const [field, value] of Object.entries(proposal)) {
    if (field in input.data && field !== "expected" && !isDeepStrictEqual(input.data[field], value)) {
      throw new ApprovalValidationError(`project.approval.submitted data.${field} conflicts with the proposal anchor`);
    }
  }
  if (proposal.expected && typeof proposal.expected === "object" && !Array.isArray(proposal.expected)) {
    for (const [field, value] of Object.entries(proposal.expected as Record<string, unknown>)) {
      if (field in input.data && !isDeepStrictEqual(input.data[field], value)) {
        throw new ApprovalValidationError(`project.approval.submitted data.${field} conflicts with the proposal anchor`);
      }
    }
  }
  const expected = proposal.expected;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    throw new ApprovalValidationError(`Condition ${conditionId} expected contract must be an object`);
  }
  const expectedRecord = expected as Record<string, unknown>;
  const allowed = [expectedRecord.anyOf, expectedRecord.allowedDecisions, expectedRecord.acceptedDecisions].filter(
    Array.isArray,
  ) as unknown[][];
  if (
    !allowed.length ||
    !allowed.every((choices) => choices.some((candidate) => isDeepStrictEqual(candidate, input.data.decision)))
  ) {
    throw new ApprovalValidationError(`Decision is not allowed by Condition ${conditionId}`);
  }
}

export function stampApproval(
  input: EventInput,
  source: string,
  authorization: ApprovalIngressAuthorization,
): EventInput {
  const actor = {
    kind: authorization.actor.kind,
    id: text(authorization.actor.id, "approval actor id"),
  };
  const reference = text(authorization.reference, "approval authorization reference");
  const evidence = record(authorization.evidence, "approval authorization evidence");
  const data = { ...input.data };
  delete data.provenance;
  delete data.hostApproval;
  data.hostApproval = {
    version: HOST_APPROVAL_VERSION,
    ingressSource: source,
    actor,
    authorization: { reference, evidence: structuredClone(evidence) },
  };
  if (!readVerifiedApprovalDecision({ type: input.type, source, data })) {
    throw new Error("Formal approval requires a valid proposal and ingress attribution");
  }
  return { ...input, data };
}

export function matchesVerifiedApprovalCondition(condition: AppTaskCondition, event: Record<string, unknown>): boolean {
  if (!isHostVerifiedApproval(event)) return false;
  const data =
    event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? (event.data as Record<string, unknown>)
      : event;
  const proposal = data.proposal;
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return false;
  const anchor = proposal as Record<string, unknown>;
  return (
    anchor.conditionId === condition.metadata.id &&
    anchor.conditionGeneration === condition.metadata.generation &&
    anchor.subject === condition.spec.subject &&
    anchor.requestedAction === condition.spec.requestedAction?.trim() &&
    isDeepStrictEqual(anchor.expected, condition.spec.expected)
  );
}

export function isHostVerifiedApproval(event: Record<string, unknown>): boolean {
  const data =
    event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? (event.data as Record<string, unknown>)
      : event;
  return (
    readVerifiedApprovalDecision({
      type: String(event.type ?? ""),
      source: typeof event.source === "string" ? event.source : undefined,
      data,
    }) !== null
  );
}

/** Exact controls only. Understanding conditional or conversational text belongs to the App. */
export function approvalDecision(text: unknown): "approve" | "reject" | "defer" | null {
  if (typeof text !== "string") return null;
  switch (text.trim().toLowerCase()) {
    case "approve":
    case "approved":
      return "approve";
    case "reject":
    case "rejected":
      return "reject";
    case "defer":
    case "deferred":
      return "defer";
    default:
      return null;
  }
}

/** Freeze the channel's explicit reply and authority, never a freshly fetched proposal. */
export function stampConversationApproval(
  input: EventInput,
  source: string,
  authorization?: ApprovalIngressAuthorization,
): EventInput {
  const data = { ...input.data };
  if (!data.approvalReply) return { ...input, data };
  const supplied = record(data.approvalReply, "approvalReply");
  const reply = { target: supplied.target, proposal: supplied.proposal };
  data.approvalReply = reply;
  const author = data.author as Record<string, unknown> | undefined;
  const decision = approvalDecision(data.text);
  if (author?.kind !== "human" || !data.replyTo || !decision || !authorization) return { ...input, data };
  const target = record(reply.target, "approvalReply.target");
  const stamped = stampApproval(
    {
      type: "project.approval.submitted",
      target: { appId: text(target.appId, "approvalReply App"), taskId: text(target.taskId, "approvalReply Task") },
      data: { decision, proposal: reply.proposal },
    },
    source,
    authorization,
  );
  data.approvalReply = { target: stamped.target, ...stamped.data };
  return { ...input, data };
}
