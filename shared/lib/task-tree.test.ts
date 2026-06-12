import { describe, expect, test } from "bun:test";
import {
  create, decompose, accept, rework, supersede, block, unblock,
  claim, submit, archive, prune, attachFeedback,
  readiness, next, rollupHints, kanban, stale, status, check,
  type TaskTree, type Knowledge,
} from "./task-tree.ts";

function emptyTree(): TaskTree {
  return {
    version: 1,
    project: "test",
    updated_at: new Date().toISOString(),
    root_task_id: "root",
    tasks: {
      root: {
        id: "root",
        goal: "Test project",
        status: "decomposed",
        parent_id: null,
        children: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  };
}

const knowledge: Knowledge = {
  summary: "Task completed successfully",
  evidence: ["evidence/test.json"],
};

describe("create", () => {
  test("adds backlog leaf under decomposed parent", () => {
    const t = create(emptyTree(), "root", { id: "task-1", goal: "Do something" });
    expect(t.tasks["task-1"].status).toBe("backlog");
    expect(t.tasks["task-1"].parent_id).toBe("root");
    expect(t.tasks["root"].children).toContain("task-1");
  });

  test("rejects duplicate ID", () => {
    const t = create(emptyTree(), "root", { id: "task-1", goal: "First" });
    expect(() => create(t, "root", { id: "task-1", goal: "Duplicate" })).toThrow("already exists");
  });

  test("rejects missing parent", () => {
    expect(() => create(emptyTree(), "nonexistent", { id: "task-1", goal: "Orphan" })).toThrow("not found");
  });

  test("rejects adding child to backlog leaf", () => {
    const t = create(emptyTree(), "root", { id: "task-1", goal: "Leaf" });
    expect(() => create(t, "task-1", { id: "child", goal: "Child" })).toThrow("Decompose it first");
  });
});

describe("decompose", () => {
  test("splits backlog leaf into children", () => {
    let t = create(emptyTree(), "root", { id: "parent", goal: "Parent task" });
    t = decompose(t, "parent", [
      { id: "child-1", goal: "First" },
      { id: "child-2", goal: "Second" },
    ]);
    expect(t.tasks["parent"].status).toBe("decomposed");
    expect(t.tasks["parent"].children).toEqual(["child-1", "child-2"]);
    expect(t.tasks["child-1"].status).toBe("backlog");
  });

  test("rejects decomposing non-backlog", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    expect(() => decompose(t, "task", [{ id: "c", goal: "Child" }])).toThrow("backlog");
  });

  test("rejects empty children", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    expect(() => decompose(t, "task", [])).toThrow("at least one");
  });
});

describe("worker: claim + submit", () => {
  test("claim transitions backlog → active", () => {
    const t = claim(create(emptyTree(), "root", { id: "task", goal: "Task" }), "task");
    expect(t.tasks["task"].status).toBe("active");
  });

  test("claim rejects non-backlog", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    expect(() => claim(t, "task")).toThrow("backlog");
  });

  test("claim rejects unmet dependency", () => {
    let t = create(emptyTree(), "root", { id: "dep", goal: "Dependency" });
    t = create(t, "root", { id: "task", goal: "Task", depends_on: ["dep"] });
    expect(() => claim(t, "task")).toThrow("not ready");
  });

  test("submit transitions active → review", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "completed", ["evidence.json"]);
    expect(t.tasks["task"].status).toBe("review");
    expect(t.tasks["task"].result).toBe("completed");
  });
});

describe("planner: accept + rework", () => {
  test("accept transitions review → accepted with knowledge", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "done", ["ev.json"]);
    t = accept(t, "task", knowledge);
    expect(t.tasks["task"].status).toBe("accepted");
    expect(t.tasks["task"].summary).toBe("Task completed successfully");
    expect(t.tasks["task"].evidence).toEqual(["evidence/test.json"]);
  });

  test("accept rejects without summary", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "done", ["ev.json"]);
    expect(() => accept(t, "task", { summary: "", evidence: [] })).toThrow("summary");
  });

  test("rework transitions review → backlog", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "partial", ["ev.json"]);
    t = rework(t, "task", "needs more work");
    expect(t.tasks["task"].status).toBe("backlog");
    expect(t.tasks["task"].reason).toBe("needs more work");
  });
});

describe("supersede", () => {
  test("supersedes with reason and cascades to children", () => {
    let t = create(emptyTree(), "root", { id: "old", goal: "Old approach" });
    t = decompose(t, "old", [
      { id: "old-child", goal: "Old child" },
    ]);
    t = create(t, "root", { id: "new", goal: "New approach" });
    t = supersede(t, "old", "better approach found", ["new"]);
    expect(t.tasks["old"].status).toBe("superseded");
    expect(t.tasks["old-child"].status).toBe("superseded");
    expect(t.tasks["old-child"].reason).toBe("parent-superseded");
  });

  test("cannot supersede accepted", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    t = submit(t, "task", "done", ["ev.json"]);
    t = accept(t, "task", knowledge);
    expect(() => supersede(t, "task", "oops", [])).toThrow("Cannot supersede");
  });
});

describe("block + unblock", () => {
  test("block requires condition and category", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    expect(() => block(t, "task", { condition: "", category: "infra" })).toThrow("condition");
    expect(() => block(t, "task", { condition: "needs approval", category: "" })).toThrow("category");
  });

  test("block only from backlog or review", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = claim(t, "task");
    expect(() => block(t, "task", { condition: "x", category: "y" })).toThrow("backlog or review");
  });

  test("unblock transitions blocked → backlog", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = block(t, "task", { condition: "needs approval", category: "external" });
    t = unblock(t, "task", "approved");
    expect(t.tasks["task"].status).toBe("backlog");
  });
});

describe("readiness", () => {
  test("backlog leaf with no deps is ready", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    expect(readiness(t, "task").ready).toBe(true);
  });

  test("backlog with unmet dep is not ready", () => {
    let t = create(emptyTree(), "root", { id: "dep", goal: "Dep" });
    t = create(t, "root", { id: "task", goal: "Task", depends_on: ["dep"] });
    const r = readiness(t, "task");
    expect(r.ready).toBe(false);
    expect(r.reasons[0]).toContain("dep");
  });

  test("backlog with accepted dep is ready", () => {
    let t = create(emptyTree(), "root", { id: "dep", goal: "Dep" });
    t = create(t, "root", { id: "task", goal: "Task", depends_on: ["dep"] });
    t = claim(t, "dep");
    t = submit(t, "dep", "done", ["ev.json"]);
    t = accept(t, "dep", knowledge);
    expect(readiness(t, "task").ready).toBe(true);
  });

  test("conflict scope blocks readiness", () => {
    let t = create(emptyTree(), "root", { id: "a", goal: "A", conflict_scope: "cluster" });
    t = create(t, "root", { id: "b", goal: "B", conflict_scope: "cluster" });
    t = claim(t, "a");
    expect(readiness(t, "b").ready).toBe(false);
  });
});

describe("kanban", () => {
  test("projects lanes correctly", () => {
    let t = create(emptyTree(), "root", { id: "b", goal: "Backlog" });
    t = create(t, "root", { id: "a", goal: "Active" });
    t = claim(t, "a");
    const cards = kanban(t);
    expect(cards.find((c) => c.nodeId === "b")?.lane).toBe("backlog");
    expect(cards.find((c) => c.nodeId === "a")?.lane).toBe("in-progress");
    expect(cards.find((c) => c.nodeId === "b")?.badges).toContain("runnable");
  });
});

describe("rollupHints", () => {
  test("hints when all children accepted", () => {
    let t = create(emptyTree(), "root", { id: "parent", goal: "Parent" });
    t = decompose(t, "parent", [{ id: "c1", goal: "C1" }, { id: "c2", goal: "C2" }]);
    t = claim(t, "c1");
    t = submit(t, "c1", "done", ["ev.json"]);
    t = accept(t, "c1", knowledge);
    t = claim(t, "c2");
    t = submit(t, "c2", "done", ["ev.json"]);
    t = accept(t, "c2", knowledge);
    const hints = rollupHints(t);
    expect(hints.find((h) => h.nodeId === "parent")?.hint).toBe("all-accepted");
  });
});

describe("archive", () => {
  test("collapses accepted subtree", () => {
    let t = create(emptyTree(), "root", { id: "parent", goal: "Parent" });
    t = decompose(t, "parent", [{ id: "c1", goal: "C1" }]);
    t = claim(t, "c1");
    t = submit(t, "c1", "done", ["ev.json"]);
    t = accept(t, "c1", knowledge);
    t = accept(t, "parent", { summary: "Parent done", evidence: [] });
    t = archive(t, "parent", "2 tasks, 1 evidence");
    expect(t.tasks["parent"].archived).toBe(true);
    expect(t.tasks["c1"]).toBeUndefined();
    expect(t.archive?.["c1"]).toBeDefined();
  });

  test("rejects archiving non-accepted", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    expect(() => archive(t, "task", "summary")).toThrow("accepted");
  });
});

describe("check", () => {
  test("clean tree has no errors", () => {
    const t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    const violations = check(t);
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors).toEqual([]);
  });

  test("detects missing child ref", () => {
    const t = emptyTree();
    t.tasks["root"].children = ["nonexistent"];
    const errors = check(t).filter((v) => v.severity === "error");
    expect(errors.some((e) => e.code === "missing-child")).toBe(true);
  });

  test("detects review without evidence", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t.tasks["task"].status = "review"; // bypass submit
    const errors = check(t).filter((v) => v.severity === "error");
    expect(errors.some((e) => e.code === "review-no-result")).toBe(true);
  });

  test("detects ambiguous status", () => {
    const t = emptyTree();
    t.tasks["root"].status = "waiting" as any;
    const errors = check(t).filter((v) => v.severity === "error");
    expect(errors.some((e) => e.code === "invalid-status" || e.code === "ambiguous-status")).toBe(true);
  });

  test("warns on accepted without summary", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t.tasks["task"].status = "accepted"; // bypass accept
    const warnings = check(t).filter((v) => v.severity === "warning");
    expect(warnings.some((w) => w.code === "accepted-no-summary")).toBe(true);
  });
});

describe("attachFeedback", () => {
  test("adds feedback ref to node", () => {
    let t = create(emptyTree(), "root", { id: "task", goal: "Task" });
    t = attachFeedback(t, "task", "feedback-123");
    expect(t.tasks["task"].feedback).toEqual(["feedback-123"]);
  });
});
