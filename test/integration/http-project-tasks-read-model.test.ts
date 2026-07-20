import { describe, expect, it } from "bun:test";
import {
  buildProjectTasksReadModel,
  normalizeProjectTaskState,
} from "../../src/app/http/server.js";

describe("project task read model", () => {
  it("accepts only canonical task state values", () => {
    expect(normalizeProjectTaskState({ state: "backlog" })).toBe("backlog");
    expect(normalizeProjectTaskState({ state: "review" })).toBe("review");
    expect(normalizeProjectTaskState({ state: "done" })).toBe("done");
    expect(normalizeProjectTaskState({ state: "something-new" })).toBe("unknown");
  });

  it("uses canonical state for counts and output", () => {
    const model = buildProjectTasksReadModel(
      {
        root_task_id: "project",
        updated_at: "2026-06-17T00:00:00.000Z",
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            children: ["leaf-a", "leaf-b", "leaf-c"],
          },
          "leaf-a": {
            id: "leaf-a",
            parent_id: "project",
            state: "done",
            kind: "test",
            children: [],
          },
          "leaf-b": {
            id: "leaf-b",
            parent_id: "project",
            state: "blocked",
            children: [],
          },
          "leaf-c": {
            id: "leaf-c",
            parent_id: "project",
            state: "review",
            children: [],
          },
        },
      },
      { path: "projects/example.app", treePath: ".state/tasks/tree.json" },
    );

    expect(model).toMatchObject({
      available: true,
      statusCounts: {
        backlog: 1,
        done: 1,
        blocked: 1,
        review: 1,
      },
      kindCounts: {
        work: 3,
        test: 1,
      },
    });
    expect(model.tasks["leaf-a"]).toMatchObject({
      state: "done",
    });
    expect(model.tasks["leaf-c"]).toMatchObject({
      state: "review",
    });
  });

  it("derives the live frontier without writing another project state", () => {
    const model = buildProjectTasksReadModel(
      {
        root_task_id: "project",
        receipts: { completed: { summary: "done" } },
        tasks: {
          project: { id: "project", state: "backlog", children: ["active", "review", "waiting", "ready", "held"] },
          active: { id: "active", parent_id: "project", state: "active", goal: "Active work", children: [] },
          review: { id: "review", parent_id: "project", state: "review", goal: "Review work", children: [] },
          waiting: { id: "waiting", parent_id: "project", state: "blocked", goal: "Waiting work", children: [] },
          ready: {
            id: "ready",
            parent_id: "project",
            state: "backlog",
            goal: "Ready work",
            depends_on: ["completed"],
            children: [],
          },
          held: {
            id: "held",
            parent_id: "project",
            state: "backlog",
            goal: "Held work",
            depends_on: ["missing"],
            children: [],
          },
        },
      },
      { path: "projects/example.app", treePath: ".state/tasks/tree.json" },
    );

    expect(model.frontier).toEqual({
      active: ["active"],
      review: ["review"],
      waiting: ["waiting"],
      runnable: ["ready"],
      counts: { active: 1, review: 1, waiting: 1, runnable: 1 },
    });
  });

  it("returns actionable errors for malformed task trees", () => {
    const model = buildProjectTasksReadModel(
      { root_task_id: "missing", tasks: { project: { children: [7] } } },
      { path: "projects/example.app", treePath: ".state/tasks/tree.json" },
    );

    expect(model).toMatchObject({
      available: false,
      reason: "Task tree is malformed.",
    });
    expect(model.errors).toEqual(
      expect.arrayContaining([
        'root_task_id: "missing" is not present in tasks',
        "tasks.project.children: expected string[]",
      ]),
    );
  });

  it("treats a missing task map as malformed but does not throw", () => {
    expect(
      buildProjectTasksReadModel(
        { root_task_id: "project" },
        { path: "projects/example.app", treePath: ".state/tasks/tree.json" },
      ),
    ).toMatchObject({
      available: false,
      reason: "Task tree is malformed.",
      errors: ["tasks: missing task map"],
    });
  });
});
