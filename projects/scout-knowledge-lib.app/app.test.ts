import { describe, expect, it } from "bun:test";
import app, { resolveScoutTask } from "./app";

describe("Scout task reconciliation", () => {
  it("maps each source to an independent standing maintain task", () => {
    for (const source of ["arxiv", "hn", "xhs", "github"]) {
      expect(
        resolveScoutTask({
          type: "scout.explore",
          project: "scout-knowledge-lib",
          source,
        }),
      ).toMatchObject({
        id: `explore-${source}`,
        parentId: "ongoing-research",
        mode: "maintain",
        workflow: "scout-explore",
        input: { source },
        outputs: [
          "/app/projects/scout-knowledge-lib/knowledge",
          "/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md",
        ],
      });
    }
  });

  it("rejects malformed source exploration instead of creating a task", () => {
    expect(
      resolveScoutTask({ type: "scout.explore", source: "unknown" }),
    ).toBeNull();
  });

  it("binds recurring responsibilities to stable task identities", () => {
    expect(resolveScoutTask({ type: "scout.digest" })).toMatchObject({
      id: "daily-digest",
      mode: "maintain",
      workflow: "scout-daily-digest",
    });
    expect(
      resolveScoutTask({ type: "project.library_health.tick" }),
    ).toMatchObject({
      id: "runtime/library-health-observer",
      parentId: "library-operations",
      mode: "maintain",
      workflow: "library-health",
    });
    expect(
      resolveScoutTask({ type: "scout.digest", eventId: 1 })?.input,
    ).toBeUndefined();
    expect(
      resolveScoutTask({ type: "scout.digest", eventId: 2 })?.input,
    ).toBeUndefined();
  });

  it("routes explicit owner requests to the accountable owner workflow", () => {
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        reason: "manual-library-review",
      }),
    ).toMatchObject({
      id: "library-maintenance",
      parentId: "library-operations",
      mode: "maintain",
      outputs: [
        "/app/projects/scout-knowledge-lib/knowledge",
        "/app/projects/scout-knowledge-lib/reports",
        "/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md",
      ],
    });
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        reason: "manual-library-review",
      })?.workflow,
    ).toBe("knowledge-planner");
  });

  it("rejects infrastructure and unknown owner wakes", () => {
    for (const reason of [
      "workflow-blocked",
      "handler-unavailable",
      "task-recovery",
      "unknown-owner-reason",
    ]) {
      expect(
        resolveScoutTask({
          type: "project.owner.requested",
          project: "scout-knowledge-lib",
          reason,
        }),
      ).toBeNull();
    }
  });

  it("declares one scoped resolver and relies on workflow discovery", () => {
    expect(app.tasks?.accepts).toEqual([
      { type: "scout.explore", project: "scout-knowledge-lib" },
      { type: "scout.digest", project: "scout-knowledge-lib" },
      {
        type: "project.library_health.tick",
        project: "scout-knowledge-lib",
      },
      {
        type: "project.owner.requested",
        project: "scout-knowledge-lib",
      },
      {
        type: "project.comment.created",
        project: "scout-knowledge-lib",
      },
    ]);
    expect(app.tasks?.resolve).toBe(resolveScoutTask);
    expect(app.owner).toBe("scout");
    expect(app.events).toContainEqual({
      type: "project.xhs_credential.check",
      project: "scout-knowledge-lib",
    });
    expect(app.events.some((event) => event.type === "metric.breach")).toBe(
      false,
    );
    expect(app.events.some((event) => event.type === "project.tick")).toBe(
      false,
    );
    expect(app.schedules).toContainEqual(
      expect.objectContaining({ id: "xhs-credential-watcher", enabled: true }),
    );
    expect(app).not.toHaveProperty("ownerEntry");
    expect(app).not.toHaveProperty("taskWorkflows");
    expect(app).not.toHaveProperty("taskRoutes");
    expect(app).not.toHaveProperty("eventGraph");
  });

  it("keeps routine source demand within the planning envelope", () => {
    const intervals = Object.fromEntries(
      app.schedules.map((schedule) => [schedule.id, schedule.intervalMs]),
    );

    expect(intervals["scout-explore-arxiv"]).toBe(14_400_000);
    expect(intervals["scout-explore-hn"]).toBe(7_200_000);
    expect(intervals["scout-explore-xhs"]).toBe(14_400_000);
    expect(intervals["scout-explore-github"]).toBe(7_200_000);
    expect(app.budget?.maxConcurrent).toBe(1);
  });

  it("uses one daily combined owner review", () => {
    const ownerSchedules = app.schedules.filter(
      (schedule) => schedule.id === "owner-review",
    );

    expect(ownerSchedules).toHaveLength(1);
    expect(ownerSchedules[0]).toMatchObject({
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        {
          type: "project.owner.requested",
          project: "scout-knowledge-lib",
          reason: "experience-review",
        },
      ],
    });
    expect(
      app.schedules.some((schedule) => schedule.id === "owner-heartbeat"),
    ).toBe(false);
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        project: "scout-knowledge-lib",
        reason: "experience-review",
      }),
    ).toMatchObject({
      id: "library-maintenance",
      mode: "maintain",
      workflow: "knowledge-planner",
    });
  });
});
