import { describe, expect, it } from "bun:test";
import app, { resolveMayAgentTask } from "../../../app.ts";

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
      parentId: "ops-health",
      mode: "maintain",
      workflow: "daily-ops-digest",
    });

    expect(
      resolveMayAgentTask({
        type: "project.ops_health.tick",
        project: "may-agent",
        lane: "hourly",
      }),
    ).toMatchObject({
      id: "runtime/ops-health-observer",
      parentId: "ops-health",
      mode: "maintain",
      workflow: "ops-health-review",
    });
    expect(
      resolveMayAgentTask({ type: "project.ops_digest.tick", eventId: 1 })
        ?.input,
    ).toBeUndefined();
    expect(
      resolveMayAgentTask({ type: "project.ops_digest.tick", eventId: 2 })
        ?.input,
    ).toBeUndefined();
  });

  it("reuses the learned owner-review workflow with automatic owner fallback", () => {
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
    });
    expect(intent?.input).toBeUndefined();
    expect(intent?.workflow).toBe("platform-owner-review");
    expect(app.owner).toBe("tech-lead");
    expect(app.tasks?.accepts).toEqual([
      { type: "project.ops_digest.tick", project: "may-agent" },
      { type: "project.ops_health.tick", project: "may-agent" },
      { type: "project.owner.requested", project: "may-agent" },
    ]);
    expect(app.tasks?.resolve).toBe(resolveMayAgentTask);
    expect(app).not.toHaveProperty("ownerEntry");
    expect(app).not.toHaveProperty("taskWorkflows");
    expect(app).not.toHaveProperty("taskRoutes");
    expect(app).not.toHaveProperty("eventGraph");
  });

  it("does not manufacture tasks for unrelated events", () => {
    expect(resolveMayAgentTask({ type: "project.comment.created" })).toBeNull();
  });
});
