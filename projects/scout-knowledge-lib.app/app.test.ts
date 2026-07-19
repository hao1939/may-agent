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
    expect(resolveScoutTask({ type: "scout.heartbeat" })).toMatchObject({
      id: "cross-source-synthesis",
      mode: "maintain",
      workflow: "scout-heartbeat",
    });
    expect(
      resolveScoutTask({ type: "project.library_health.tick" }),
    ).toMatchObject({
      id: "runtime/library-health-observer",
      mode: "maintain",
      workflow: "library-health",
    });
  });

  it("reuses learned maintenance and keeps the accountable owner fallback", () => {
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        reason: "manual-review",
      }),
    ).toMatchObject({
      id: "library-maintenance",
      mode: "maintain",
    });
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        reason: "manual-review",
      })?.workflow,
    ).toBe("knowledge-planner");
  });

  it("declares one scoped resolver and relies on workflow discovery", () => {
    expect(app.tasks?.accepts).toEqual([
      { type: "scout.heartbeat", project: "scout-knowledge-lib" },
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
    ]);
    expect(app.tasks?.resolve).toBe(resolveScoutTask);
    expect(app.owner).toBe("scout");
    expect(app).not.toHaveProperty("ownerEntry");
    expect(app).not.toHaveProperty("taskWorkflows");
    expect(app).not.toHaveProperty("taskRoutes");
    expect(app).not.toHaveProperty("eventGraph");
  });
});
