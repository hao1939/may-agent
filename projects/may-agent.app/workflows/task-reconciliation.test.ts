import { describe, expect, it } from "bun:test";
import app, { resolveMayAgentTask } from "../app.ts";

describe("may-agent task reconciliation manifest", () => {
  it("maps recurring work to stable maintain tasks", () => {
    expect(
      resolveMayAgentTask({
        type: "project.ops_digest.tick",
        project: "may-agent",
        lane: "daily",
      }),
    ).toMatchObject({
      id: "runtime/daily-ops-digest",
      parentId: "platform-ops-observe-act-loop",
      mode: "maintain",
      workflow: "daily-ops-digest",
      input: { lane: "daily" },
    });

    expect(
      resolveMayAgentTask({
        type: "project.ops_health.tick",
        project: "may-agent",
        lane: "hourly",
      }),
    ).toMatchObject({
      id: "runtime/ops-health-observer",
      parentId: "platform-ops-observe-act-loop",
      mode: "maintain",
      workflow: "ops-health-review",
      input: { lane: "hourly" },
    });
  });

  it("routes owner requests through ownerEntry rather than a raw agent", () => {
    const intent = resolveMayAgentTask({
      type: "project.owner.requested",
      project: "may-agent",
      reason: "manual-review",
      params: { source: "human" },
    });

    expect(intent).toMatchObject({
      id: "runtime/platform-owner-review",
      parentId: "platform-system-review-feedback-loop",
      mode: "maintain",
      input: {
        reason: "manual-review",
        source: "human",
      },
    });
    expect(intent?.workflow).toBeUndefined();
    expect(app.ownerEntry?.workflow).toBe("platform-owner-review");
    expect(app.taskRoutes?.map((route) => route.name)).toEqual([
      "may-agent-task-daily-ops-digest",
      "may-agent-task-ops-health",
      "may-agent-task-owner",
    ]);
  });

  it("does not manufacture tasks for unrelated events", () => {
    expect(resolveMayAgentTask({ type: "project.comment.created" })).toBeNull();
  });
});
