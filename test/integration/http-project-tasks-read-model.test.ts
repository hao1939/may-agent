import { describe, expect, it } from "bun:test";
import { buildProjectTasksReadModel, normalizeAppTaskPhase } from "../../src/app/http/server.js";

function group(children: string[]) {
  return { item_type: "group", id: "project", parent_id: null, children };
}

function task(
  id: string,
  phase: "pending" | "running" | "waiting" | "attention" | "converged",
  options: Record<string, unknown> = {},
) {
  return {
    item_type: "task",
    id,
    parent_id: "project",
    children: [],
    outcome: `Outcome ${id}`,
    mode: "achieve",
    generation: 1,
    resource_version: 1,
    phase,
    observed_generation: phase === "converged" ? 1 : 0,
    synchronized: phase === "converged",
    readiness: {
      state: phase === "pending" ? "ready" : "not-applicable",
      reason: phase === "pending" ? "Ready" : `Task phase is ${phase}`,
      related_ids: [],
    },
    acceptance: ["Accepted"],
    depends_on: [],
    outputs: [],
    condition_ids: [],
    status_updated_at: "2026-07-20T00:00:00.000Z",
    ...options,
  };
}

function projection(items: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    schema_version: 2,
    project: "example",
    project_lifecycle: "active",
    root_task_id: "project",
    updated_at: "2026-07-20T00:00:00.000Z",
    max_concurrent: 2,
    active_task_ids: [],
    conditions: {},
    satisfied_dependency_ids: [],
    integrity: [],
    tasks: items,
    ...extra,
  };
}

describe("project task read model", () => {
  it("accepts only canonical task phases", () => {
    expect(normalizeAppTaskPhase({ phase: "pending" })).toBe("pending");
    expect(normalizeAppTaskPhase({ phase: "attention" })).toBe("attention");
    expect(normalizeAppTaskPhase({ phase: "converged" })).toBe("converged");
    expect(normalizeAppTaskPhase({ phase: "backlog" })).toBe("unknown");
  });

  it("preserves canonical classification and app metadata", () => {
    const model = buildProjectTasksReadModel(
      projection({
        project: group(["running", "ready", "pending", "waiting", "attention", "standing"]),
        running: task("running", "running", { active_attempt: { id: "a1" } }),
        ready: task("ready", "pending"),
        pending: task("pending", "pending", {
          readiness: { state: "dependency-blocked", reason: "Waiting for dep", related_ids: ["dep"] },
        }),
        waiting: task("waiting", "waiting", {
          condition_ids: ["credential:xhs"],
          readiness: {
            state: "condition-blocked",
            reason: "Waiting for credential:xhs",
            related_ids: ["credential:xhs"],
          },
        }),
        attention: task("attention", "attention"),
        standing: task("standing", "converged", { mode: "maintain" }),
      }),
      {
        path: "projects/example",
        treePath: ".state/tasks/tree.json",
        measuredAt: "2026-07-20T01:00:00.000Z",
        project: { id: "example", owner: "owner", posture: "active" },
      },
    );

    expect(model).toMatchObject({
      available: true,
      schemaVersion: 2,
      measuredAt: "2026-07-20T01:00:00.000Z",
      project: { id: "example", owner: "owner", maxConcurrent: 2 },
      stats: {
        groups: 1,
        resources: 6,
        attention: 1,
        running: 1,
        ready: 1,
        pending: 1,
        waiting: 1,
        healthyStanding: 1,
      },
      items: {
        attention: { phase: "attention" },
        standing: { phase: "converged", mode: "maintain" },
      },
    });
    expect(model).not.toHaveProperty("frontier");
    expect(model).not.toHaveProperty("statusCounts");
  });

  it("returns actionable errors for malformed or legacy projections", () => {
    const model = buildProjectTasksReadModel(
      {
        schema_version: 1,
        root_task_id: "missing",
        tasks: { project: { id: "project", state: "backlog", children: [7] } },
      },
      { path: "projects/example", treePath: ".state/tasks/tree.json" },
    );

    expect(model).toMatchObject({ available: false, reason: "Task tree is malformed." });
    expect(model.errors).toEqual(
      expect.arrayContaining([
        "schema_version: expected 2",
        'root_task_id: "missing" is not present in tasks',
        "tasks.project.children: expected string[]",
        "tasks.project.item_type: expected group or task",
      ]),
    );
  });

  it("treats a missing task map as malformed but does not throw", () => {
    expect(
      buildProjectTasksReadModel(
        { schema_version: 2, root_task_id: "project" },
        { path: "projects/example", treePath: ".state/tasks/tree.json" },
      ),
    ).toMatchObject({
      available: false,
      reason: "Task tree is malformed.",
      errors: ["tasks: missing task map"],
    });
  });
});
