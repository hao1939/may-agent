import { describe, expect, it } from "bun:test";
import { operatorEventInput } from "./socket.js";

describe("control-socket operator event boundary", () => {
  it("keeps lifecycle and correlation identities in data unless target is explicit", () => {
    expect(
      operatorEventInput({
        type: "trigger.metrics-snapshot",
        source: "control-socket",
        owner: "agent:may",
        data: {
          reason: "completed-task-correlation",
          appId: "may-agent",
          taskId: "reconcile-stale-active-metric-contract-20260818",
          sessionId: "historical-session",
          idempotencyKey: "metrics-correlation-golden-trace",
        },
      }),
    ).toEqual({
      type: "trigger.metrics-snapshot",
      data: {
        reason: "completed-task-correlation",
        appId: "may-agent",
        taskId: "reconcile-stale-active-metric-contract-20260818",
        sessionId: "historical-session",
        idempotencyKey: "metrics-correlation-golden-trace",
      },
      idempotencyKey: "metrics-correlation-golden-trace",
    });
  });

  it("preserves an explicit malformed exact-task target for subscriber failure facts", () => {
    expect(
      operatorEventInput({
        type: "trigger.metrics-snapshot",
        target: { taskId: "missing-app-target" },
        data: { appId: "correlation-only" },
      }),
    ).toEqual({
      type: "trigger.metrics-snapshot",
      target: { appId: undefined, taskId: "missing-app-target", sessionId: undefined },
      data: { appId: "correlation-only" },
    });
  });
});
