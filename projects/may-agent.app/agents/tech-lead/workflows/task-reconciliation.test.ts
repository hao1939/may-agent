import { describe, expect, it } from "bun:test";
import app, { resolveMayAgentTask, taskIntentForInput } from "../../../app.ts";
import cronEntries from "../cron.json";

describe("may-agent task reconciliation manifest", () => {
  it("keeps standalone host maintenance outside task reconciliation", () => {
    expect(
      resolveMayAgentTask({ type: "project.ops_digest.tick", data: {} }),
    ).toBeNull();
    expect(
      resolveMayAgentTask({ type: "project.ops_health.tick", data: {} }),
    ).toBeNull();
    expect(
      cronEntries.filter(({ name }) =>
        ["ops-health-review", "daily-ops-digest"].includes(name),
      ),
    ).toMatchObject([
      {
        name: "ops-health-review",
        handler: "ops-health-review",
        enabled: true,
      },
      { name: "daily-ops-digest", handler: "daily-ops-digest", enabled: true },
    ]);
  });

  it("attaches addressed owner requests to the stable owner-review task", () => {
    const subscription = app.subscriptions?.find(
      (entry) => entry.id === "project-owner-request",
    );
    const input = subscription?.toInput({
      type: "project.owner.requested",
      data: { reason: "manual-review", params: { source: "human" } },
      target: { appId: "may-agent", project: "may-agent" },
    });
    const intent = input ? taskIntentForInput(input) : null;

    expect(intent).toMatchObject({
      id: "runtime/platform-owner-review",
      parentId: "platform-system-review-feedback-loop",
      mode: "maintain",
    });
    expect(intent?.input).toEqual({ scope: "may-agent-platform" });
    expect(intent?.workflow).toBe("platform-owner-review");
    expect(app.owner).toBe("may");
    expect(app.tasks?.subscriptions).toEqual([
      {
        type: "may-agent.resource-migration.requested",
        project: "may-agent",
      },
      { type: "project.tick", project: "may-agent" },
      { type: "project.tasks.ready", project: "may-agent" },
      "metric.breach",
      "metric.stalled",
    ]);
    expect(app.tasks?.resolve).toBe(resolveMayAgentTask);
    expect(app).not.toHaveProperty("ownerEntry");
    expect(app).not.toHaveProperty("taskWorkflows");
    expect(app).not.toHaveProperty("taskRoutes");
    expect(app).not.toHaveProperty("eventGraph");
  });

  it("does not manufacture tasks for unrelated events", () => {
    expect(
      resolveMayAgentTask({ type: "unrelated.event", data: {} }),
    ).toBeNull();
  });

  it("maps the bounded legacy cleanup to one finite resource", () => {
    expect(
      resolveMayAgentTask({
        type: "may-agent.resource-migration.requested",
        data: {},
        target: { appId: "may-agent", project: "may-agent" },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-v1",
      mode: "achieve",
      workflow: "unified-resource-migration",
      priority: "P0",
    });
  });
});
