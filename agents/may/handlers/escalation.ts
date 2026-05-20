/**
 * escalation — Route canonical escalation.created events.
 */

import type { EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";

function emitSkip(ctx: HandlerContext, sessionId: string | null, reason: string, data: Record<string, unknown> = {}): void {
  ctx.sdk.log("info", `[escalation] skipped: ${reason}`);
  ctx.sdk.emit("handler.skipped", {
    handler: "escalation",
    sessionId,
    ...data,
    reason,
  });
}

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function routeTarget(owner: string): string | null {
  if (owner.startsWith("human:")) return "human";
  if (owner.startsWith("agent:")) return owner.slice("agent:".length);
  return owner || null;
}

function routeBrief(input: {
  escalationId: string;
  sourceAgent: string;
  reason: string;
  requestedAction: string;
  sourceSessionId?: string;
  projectId?: string;
  projectPath?: string;
}): string {
  return [
    `[escalation] ${input.escalationId}`,
    `From: ${input.sourceAgent}`,
    input.sourceSessionId ? `Session: ${input.sourceSessionId}` : "",
    input.projectId ? `Project: ${input.projectId}` : "",
    input.projectPath ? `Path: ${input.projectPath}` : "",
    "",
    `Reason: ${input.reason}`,
    `Requested action: ${input.requestedAction}`,
  ].filter(Boolean).join("\n");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: EventEnvelope) => {
    if (!event?.data) {
      emitSkip(ctx, null, "missing escalation.created event data", { eventType: event?.type ?? null });
      return;
    }

    if (event.type !== "escalation.created") {
      emitSkip(ctx, null, "unsupported escalation event type", { eventType: event.type });
      return;
    }

    const data = event.data;
    const escalationId = stringField(data, "escalationId");
    const sourceAgent = stringField(data, "sourceAgent");
    const reason = stringField(data, "reason");
    const requestedAction = stringField(data, "requestedAction");

    if (!escalationId || !sourceAgent || !reason || !requestedAction) {
      emitSkip(ctx, stringField(data, "sourceSessionId") || null, "escalation.created missing required data", {
        eventType: event.type,
        escalationId: escalationId || null,
      });
      return;
    }

    const route = event.owner || "agent:may";
    const target = routeTarget(route);
    const sourceSessionId = stringField(data, "sourceSessionId") || undefined;
    const projectId = stringField(data, "projectId") || undefined;
    const projectPath = stringField(data, "projectPath") || undefined;

    ctx.sdk.log("info", `[escalation] route=${route} escalation=${escalationId} sourceAgent=${sourceAgent}`);
    ctx.sdk.emit("escalation.routed", {
      escalationId,
      route,
      reason,
    }, {
      source: "agent:may",
      owner: route,
    });
    ctx.sdk.emit("handler.routed", {
      handler: "escalation",
      escalationId,
      sourceAgent,
      route,
      reason,
    });

    if (target && target !== "may") {
      ctx.sdk.message(target, routeBrief({
        escalationId,
        sourceAgent,
        reason,
        requestedAction,
        sourceSessionId,
        projectId,
        projectPath,
      }));
    }
  };
};
