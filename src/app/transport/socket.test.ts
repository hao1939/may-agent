import { describe, expect, it } from "bun:test";
import { legacyEventInput } from "./socket.js";

describe("control-socket compatibility event boundary", () => {
  it("keeps lifecycle and correlation identities in data unless target is explicit", () => {
    expect(
      legacyEventInput({
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

  it("preserves an explicit malformed exact-task target for subscriber failure evidence", () => {
    expect(
      legacyEventInput({
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
