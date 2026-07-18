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

  it("routes unfamiliar maintenance through the accountable owner", () => {
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
    ).toBeUndefined();
  });

  it("declares task routes and capabilities instead of direct handlers", () => {
    expect(app.ownerEntry?.workflow).toBe("knowledge-planner");
    expect(Object.keys(app.taskWorkflows ?? {})).toEqual([
      "scout-heartbeat",
      "scout-explore",
      "scout-daily-digest",
      "library-health",
    ]);
    expect(app.taskRoutes).toHaveLength(5);
  });
});
