import { describe, expect, test } from "bun:test";
import {
  accept,
  archive,
  attachFeedback,
  block,
  check,
  claim,
  create,
  decompose,
  kanban,
  next,
  readiness,
  rework,
  rollupHints,
  stale,
  status,
  submit,
  supersede,
  taskState,
  unblock,
  type Knowledge,
  type TaskTree,
} from "./task-tree.ts";

function emptyTree(): TaskTree {
  const now = new Date().toISOString();
  return {
    version: 2,
    project: "test",
    updated_at: now,
    root_task_id: "root",
    tasks: {
      root: {
        id: "root",
        goal: "Test project",
        state: "backlog",
        parent_id: null,
        children: [],
        created_at: now,
        updated_at: now,
      },
    },
  };
}

const knowledge: Knowledge = {
  summary: "Task completed successfully",
  evidence: ["evidence/test.json"],
};

describe("task states", () => {
  test("normalizes legacy status values", () => {
    expect(taskState({ status: "accepted" } as any)).toBe("done");
    expect(taskState({ status: "ready" } as any)).toBe("backlog");
    expect(taskState({ status: "proposed" } as any)).toBe("backlog");
    expect(taskState({ status: "decomposed" } as any)).toBe("backlog");
    expect(taskState({ status: "superseded" } as any)).toBe("done");
  });
});

describe("create and decompose", () => {
  test("adds backlog leaf under a parent", () => {
    const t = create(emptyTree(), "root", {
      id: "task-1",
      goal: "Do something",
    });
    expect(t.tasks["task-1"].state).toBe("backlog");
    expect(t.tasks["task-1"].status).toBeUndefined();
    expect(t.tasks["task-1"].parent_id).toBe("root");
    expect(t.tasks.root.children).toContain("task-1");
  });

  test("rejects duplicate ID", () => {
    const t = create(emptyTree(), "root", { id: "task-1", goal: "First" });
    expect(() =>
      create(t, "root", { id: "task-1", goal: "Duplicate" }),
    ).toThrow("already exists");
  });

  test("splits backlog leaf into structural children without decomposed state", () => {
    let t = create(emptyTree(), "root", { id: "parent", goal: "Parent task" });
    t = decompose(t, "parent", [
      { id: "child-1", goal: "First" },
      { id: "child-2", goal: "Second" },
    ]);
    expect(t.tasks.parent.state).toBe("backlog");
    expect(t.tasks.parent.children).toEqual(["child-1", "child-2"]);
    expect(t.tasks["child-1"].state).toBe("backlog");
  });
});

describe("worker lifecycle", () => {
  test("claim transitions backlog to active", () => {
    const t = claim(
      create(emptyTree(), "root", { id: "task", goal: "Task" }),
      "task",
    );
    expect(t.tasks.task.state).toBe("active");
  });

  test("claim rejects unmet dependency", () => {
    let t = create(emptyTree(), "root", { id: "dep", goal: "Dependency" });
    t = create(t, "root", { id: "task", goal: "Task", depends_on: ["dep"] });
    expect(() => claim(t, "task")).toThrow("not ready");
  });

  test("submit transitions active to review", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "completed", ["evidence.json"]);
    expect(t.tasks.task.state).toBe("review");
    expect(t.tasks.task.result).toBe("completed");
  });
});

describe("owner decisions", () => {
  test("accept alias marks review task done", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "done", ["ev.json"]);
    t = accept(t, "task", knowledge);
    expect(t.tasks.task.state).toBe("done");
    expect(t.tasks.task.resolution).toBe("completed");
    expect(t.tasks.task.summary).toBe("Task completed successfully");
  });

  test("rework transitions review to backlog", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "partial", ["ev.json"]);
    t = rework(t, "task", "needs more work");
    expect(t.tasks.task.state).toBe("backlog");
    expect(t.tasks.task.reason).toBe("needs more work");
  });

  test("supersede alias marks task done with replacement metadata", () => {
    let t = create(emptyTree(), "root", { id: "old", goal: "Old approach" });
    t = create(t, "root", { id: "new", goal: "New approach" });
    t = supersede(t, "old", "better approach found", ["new"]);
    expect(t.tasks.old.state).toBe("done");
    expect(t.tasks.old.resolution).toBe("replaced");
    expect(t.tasks.old.replaced_by).toEqual(["new"]);
  });
});

describe("block and unblock", () => {
  test("block requires condition", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    expect(() => block(t, "task", { condition: "" })).toThrow("condition");
  });

  test("unblock transitions blocked to backlog", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = block(t, "task", { condition: "needs approval", category: "external" });
    t = unblock(t, "task", "approved");
    expect(t.tasks.task.state).toBe("backlog");
  });
});

describe("readiness", () => {
  test("backlog leaf with no deps is ready", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    expect(readiness(t, "task").ready).toBe(true);
  });

  test("backlog with done dep is ready", () => {
    let t = create(emptyTree(), "root", { id: "dep", goal: "Dep" });
    t = create(t, "root", { id: "task", goal: "Task", depends_on: ["dep"] });
    t = claim(t, "dep");
    t = submit(t, "dep", "done", ["ev.json"]);
    t = accept(t, "dep", knowledge);
    expect(readiness(t, "task").ready).toBe(true);
  });

  test("conflict scope blocks readiness", () => {
    let t = create(emptyTree(), "root", {
      id: "a",
      goal: "A",
      conflict_scope: "cluster",
    });
    t = create(t, "root", { id: "b", goal: "B", conflict_scope: "cluster" });
    t = claim(t, "a");
    expect(readiness(t, "b").ready).toBe(false);
  });
});

describe("projections", () => {
  test("kanban projects lanes correctly", () => {
    let t = create(emptyTree(), "root", { id: "b", goal: "Backlog" });
    t = create(t, "root", { id: "a", goal: "Active" });
    t = claim(t, "a");
    const cards = kanban(t);
    expect(cards.find((c) => c.nodeId === "b")?.lane).toBe("backlog");
    expect(cards.find((c) => c.nodeId === "a")?.lane).toBe("in-progress");
    expect(cards.find((c) => c.nodeId === "b")?.badges).toContain("runnable");
    expect(next(t).map((node) => node.id)).toEqual(["b"]);
  });

  test("rollup hints when all children are done", () => {
    let t = create(emptyTree(), "root", { id: "parent", goal: "Parent" });
    t = decompose(t, "parent", [
      { id: "c1", goal: "C1" },
      { id: "c2", goal: "C2" },
    ]);
    for (const id of ["c1", "c2"]) {
      t = claim(t, id);
      t = submit(t, id, "done", ["ev.json"]);
      t = accept(t, id, knowledge);
    }
    expect(rollupHints(t).find((h) => h.nodeId === "parent")?.hint).toBe(
      "all-done",
    );
  });

  test("status summary reports state counts", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    expect(status(t).byState.backlog).toBe(2);
  });
});

describe("archive and check", () => {
  test("collapses done subtree", () => {
    let t = create(emptyTree(), "root", { id: "parent", goal: "Parent" });
    t = decompose(t, "parent", [{ id: "c1", goal: "C1" }]);
    t = claim(t, "c1");
    t = submit(t, "c1", "done", ["ev.json"]);
    t = accept(t, "c1", knowledge);
    t = accept(t, "parent", { summary: "Parent done", evidence: [] });
    t = archive(
      t,
      "parent",
      "Parent branch completed with verified evidence and reusable project knowledge",
    );
    expect(t.tasks.parent.archived).toBe(true);
    expect(t.tasks.c1).toBeUndefined();
    expect(t.archive?.c1).toBeDefined();
  });

  test("detects legacy status field", () => {
    const t = emptyTree();
    t.tasks.root.status = "accepted";
    delete t.tasks.root.state;
    const warnings = check(t).filter((v) => v.severity === "warning");
    expect(warnings.some((w) => w.code === "legacy-status-field")).toBe(true);
    expect(warnings.some((w) => w.code === "legacy-state-value")).toBe(true);
  });

  test("stale returns old backlog nodes", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t.tasks.task.updated_at = "2020-01-01T00:00:00.000Z";
    expect(stale(t).map((node) => node.id)).toContain("task");
  });
});

describe("attachFeedback", () => {
  test("adds feedback ref to node", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = attachFeedback(t, "task", "feedback-123");
    expect(t.tasks.task.feedback).toEqual(["feedback-123"]);
  });
});
