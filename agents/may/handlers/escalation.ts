/**
 * escalation — Route canonical escalation.created events.
 */

import type {
  EventEnvelope,
  HandlerContext,
  HandlerModule,
} from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";

function emitSkip(
  ctx: HandlerContext,
  sessionId: string | null,
  reason: string,
  data: Record<string, unknown> = {},
): void {
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

function objectField(
  data: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = data[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
  severity?: string;
  blockedOn?: string;
}): string {
  const area = input.projectId ?? input.projectPath;
  return [
    "May-agent needs a decision",
    "",
    "What happened",
    input.reason,
    "",
    "Decision needed",
    input.requestedAction,
    "",
    area ? `Area: ${area}` : "",
    input.blockedOn ? `Blocked on: ${input.blockedOn}` : "",
    "",
    "You can reply with",
    "- the decision or missing input",
    "- who should own it",
    "- what to change",
    "- why to hold or reject it",
    "",
    "What happens next",
    "May will attach your reply to the tracked issue and either resolve it, delegate it, update the owning task, or ask one focused follow-up.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  _entry: CronEntry,
) => {
  return async (event?: EventEnvelope) => {
    if (!event?.data) {
      emitSkip(ctx, null, "missing escalation.created event data", {
        eventType: event?.type ?? null,
      });
      return;
    }

    if (event.type !== "escalation.created") {
      emitSkip(ctx, null, "unsupported escalation event type", {
        eventType: event.type,
      });
      return;
    }

    const data = event.data;
    const escalationId = stringField(data, "escalationId");
    const sourceAgent = stringField(data, "sourceAgent");
    const reason = stringField(data, "reason");
    const requestedAction = stringField(data, "requestedAction");

    if (!escalationId || !sourceAgent || !reason || !requestedAction) {
      emitSkip(
        ctx,
        stringField(data, "sourceSessionId") || null,
        "escalation.created missing required data",
        {
          eventType: event.type,
          escalationId: escalationId || null,
        },
      );
      return;
    }

    const route = event.owner || "agent:may";
    const target = routeTarget(route);
    const sourceSessionId = stringField(data, "sourceSessionId") || undefined;
    const projectId = stringField(data, "projectId") || undefined;
    const projectPath = stringField(data, "projectPath") || undefined;
    const severity = stringField(data, "severity") || undefined;
    const blockedOn = stringField(data, "blockedOn") || undefined;
    const resume = objectField(data, "resume");
    const evidence = objectField(data, "evidence");
    const dedupKey = stringField(data, "dedupKey") || escalationId;

    ctx.sdk.log(
      "info",
      `[escalation] route=${route} escalation=${escalationId} sourceAgent=${sourceAgent}`,
    );
    // NOTE: Previously emitted escalation.routed here, but nothing consumed it
    // and events accumulated as orphan pending rows (36+). The handler.routed
    // event below captures the same audit trail without orphan accumulation.
    ctx.sdk.emit("handler.routed", {
      handler: "escalation",
      escalationId,
      sourceAgent,
      route,
      reason,
    });

    if (target && target !== "may") {
      const content = routeBrief({
        escalationId,
        sourceAgent,
        reason,
        requestedAction,
        sourceSessionId,
        projectId,
        projectPath,
        severity,
        blockedOn,
      });
      if (target === "human") {
        ctx.sdk.emit(
          "message.created",
          {
            from: sourceAgent,
            to: "human",
            content,
            priority:
              severity === "P0" ? "P0" : severity === "P1" ? "P1" : "P2",
            intent: "escalation",
            subject: `Escalation ${escalationId}`,
            kind: "escalation",
            severity,
            projectId,
            projectPath,
            sessionId: sourceSessionId,
            escalationId,
            sourceAgent,
            reason,
            requestedAction,
            blockedOn,
            evidence,
            resume,
            conversationId: `escalation:${escalationId}`,
            originalIssue: {
              eventType: "escalation.created",
              escalationId,
              sourceAgent,
              sourceSessionId,
              projectId,
              projectPath,
              reason,
              requestedAction,
              severity,
              blockedOn,
            },
            expectedClosure: ["escalation.resolved", "escalation.dismissed"],
            actionHints: [
              "answered <decision or missing input>",
              "fixed <what changed>",
              "reroute <owner or surface>",
              "reject <why invalid>",
              "hold <why waiting>",
            ],
            dedupKey,
          },
          {
            owner: "human:operator",
            source: "agent:may",
            target: { human: true },
            urgency: event.urgency,
            ttl_ms: event.ttl_ms,
          },
        );
      } else {
        ctx.sdk.message(target, content);
      }
    }
  };
};
