import { describe, expect, it } from "bun:test";
import {
  buildProjectTasksReadModel,
  normalizeProjectTaskState,
} from "../../src/app/http/server.js";

describe("project task read model", () => {
  it("normalizes canonical state and legacy status values", () => {
    expect(normalizeProjectTaskState({ state: "backlog" })).toBe("backlog");
    expect(normalizeProjectTaskState({ status: "ready" })).toBe("backlog");
    expect(normalizeProjectTaskState({ status: "claimed_done" })).toBe(
      "review",
    );
    expect(normalizeProjectTaskState({ status: "accepted" })).toBe("done");
    expect(normalizeProjectTaskState({ status: "superseded" })).toBe("done");
    expect(normalizeProjectTaskState({ status: "something-new" })).toBe(
      "unknown",
    );
  });

  it("uses state for counts and exposes status as a compatibility alias", () => {
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
            status: "claimed_done",
            children: [],
          },
        },
      },
      { path: "projects/example.app", treePath: "tasks/tree.json" },
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
      status: "done",
      raw_state: "done",
    });
    expect(model.tasks["leaf-c"]).toMatchObject({
      state: "review",
      status: "review",
      raw_status: "claimed_done",
    });
  });

  it("returns actionable errors for malformed task trees", () => {
    const model = buildProjectTasksReadModel(
      { root_task_id: "missing", tasks: { project: { children: [7] } } },
      { path: "projects/example.app", treePath: "tasks/tree.json" },
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
        { path: "projects/example.app", treePath: "tasks/tree.json" },
      ),
    ).toMatchObject({
      available: false,
      reason: "Task tree is malformed.",
      errors: ["tasks: missing task map"],
    });
  });
});
