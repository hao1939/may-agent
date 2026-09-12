import { describe, expect, it } from "bun:test";
import app, { resolveMaintenanceTask, taskIntentForInput } from "../../../app.ts";
import cronEntries from "../cron.json";

describe("may-agent task reconciliation manifest", () => {
  it("keeps standalone host maintenance outside task reconciliation", () => {
    expect(
      resolveMaintenanceTask({ type: "project.ops_digest.tick", data: {} }),
    ).toBeNull();
    expect(
      resolveMaintenanceTask({ type: "project.ops_health.tick", data: {} }),
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

  it("attaches addressed owner requests to the stable direct owner-review Task", () => {
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
    expect(intent?.agent).toBe("tech-lead");
    expect(intent).not.toHaveProperty("workflow");
    expect(app.agent).toBe("tech-lead");
    expect(app).not.toHaveProperty("owner");
    expect(app.tasks?.subscriptions).toEqual([
      { type: "project.tick", project: "may-agent" },
      { type: "project.tasks.ready", project: "may-agent" },
      "metric.breach",
      "metric.stalled",
    ]);
    expect(app.tasks?.resolve).toBe(resolveMaintenanceTask);
    expect(app).not.toHaveProperty("ownerEntry");
    expect(app).not.toHaveProperty("taskWorkflows");
    expect(app).not.toHaveProperty("taskRoutes");
    expect(app).not.toHaveProperty("eventGraph");
  });

  it("does not manufacture tasks for unrelated events", () => {
    expect(
      resolveMaintenanceTask({ type: "unrelated.event", data: {} }),
    ).toBeNull();
  });

  it("does not recreate the retired resource-migration Task route", () => {
    expect(
      resolveMaintenanceTask({
        type: "may-agent.resource-migration.requested",
        data: {},
        target: { appId: "may-agent", project: "may-agent" },
      }),
    ).toBeNull();
  });
});
