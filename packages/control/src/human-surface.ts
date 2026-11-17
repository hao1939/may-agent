import type { ApprovalProposal, EventInput } from "./events.js";

export type HumanSurfaceTaskRef = {
  appId: string;
  taskId: string;
  ref?: string;
};

export type HumanSurfaceTaskSummary = {
  appId: string;
  taskId: string;
  ref?: string;
  status: string;
  statusDetail?: string;
  outcome?: string;
  acceptance?: string[];
  summary?: string;
  response?: string;
  terminal?: boolean;
  updatedAt?: number;
  progress?: { stage: string; message?: string; status?: string; updatedAt: number };
  humanAction?: {
    requestedAction: string;
    since?: number;
    task?: { appId: string; taskId: string; ref: string };
  };
  requestedBy?: { appId: string; taskId: string; ref: string; status: string; outcome: string };
  waitingOn?: Array<
    | { kind: "task"; appId: string; taskId: string; ref: string; status: string; outcome: string }
    | { kind: "app"; appId: string; status: string }
    | { kind: "condition"; type: string; subject: string }
  >;
};

export type HumanConversationInputOptions = {
  appId: string;
  conversationId: string;
  authorId: string;
  text: string;
  channel: string;
  channelTargetId?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyTo?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  approvalReply?: { target: { appId: string; taskId: string }; proposal: ApprovalProposal };
  idempotencyKey?: string;
};

/** One logical human conversation; provider chat/topic IDs are coordinates. */
export function primaryConversationId(agent: string): string {
  return `${agent.trim() || "host"}:primary`;
}

export function humanTaskStatusLabel(task: Pick<HumanSurfaceTaskSummary, "status" | "humanAction">): string {
  switch (task.status) {
    case "pending":
      return "queued";
    case "running":
      return "working";
    case "waiting":
      return "waiting";
    case "attention":
      return task.humanAction ? "needs you" : "needs review";
    case "idle":
      return "idle";
    case "done":
      return "done";
    case "closed":
      return "closed";
    case "cancelled":
      return "cancelled";
    default:
      return String(task.status || "unknown");
  }
}

export function humanCurrentTaskText(
  task: Pick<HumanSurfaceTaskSummary, "status" | "terminal" | "response" | "summary" | "progress">,
): string {
  const observed = task.terminal
    ? task.response?.trim() || task.summary?.trim()
    : task.progress?.message?.trim() || task.response?.trim() || task.summary?.trim();
  if (observed) return observed;
  switch (task.status) {
    case "pending":
      return "No attempt has started yet.";
    case "running":
      return "Work is active; no detailed progress has been reported yet.";
    case "waiting":
      return "No new progress has been reported while the Task waits.";
    case "attention":
      return "No recovery update has been reported yet.";
    case "idle":
      return "No work is runnable. The owner must retain a specific next responsibility or close this assignment.";
    case "done":
      return "No result summary was recorded.";
    case "cancelled":
    case "closed":
      return "The Task will not continue.";
    default:
      return "No current update has been reported.";
  }
}

export function representedTaskIdentities(
  task: Pick<HumanSurfaceTaskSummary, "appId" | "taskId" | "requestedBy" | "waitingOn">,
): Array<{ appId: string; taskId: string }> {
  return [
    { appId: task.appId, taskId: task.taskId },
    ...(task.requestedBy ? [{ appId: task.requestedBy.appId, taskId: task.requestedBy.taskId }] : []),
    ...(task.waitingOn ?? []).flatMap((wait) =>
      wait.kind === "task" ? [{ appId: wait.appId, taskId: wait.taskId }] : [],
    ),
  ];
}

export function buildHumanConversationMessageEvent(input: HumanConversationInputOptions): EventInput {
  const context: Record<string, unknown> = {
    ...(input.context ?? {}),
  };
  return {
    type: "conversation.message.created",
    target: { appId: input.appId },
    data: {
      conversationId: input.conversationId,
      author: { kind: "human", id: input.authorId },
      text: input.text,
      ...(Object.keys(context).length > 0 ? { context } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.approvalReply ? { approvalReply: input.approvalReply } : {}),
      metadata: {
        ...(input.metadata ?? {}),
        channel: input.channel,
        ...(input.channelTargetId !== undefined ? { channelTargetId: input.channelTargetId } : {}),
        ...(input.channelThreadId !== undefined ? { channelThreadId: input.channelThreadId } : {}),
        ...(input.channelMessageId !== undefined ? { channelMessageId: input.channelMessageId } : {}),
      },
    },
    idempotencyKey: input.idempotencyKey ?? input.authorId,
  };
}
