import { describe, expect, it } from "bun:test";
import {
  parseProjectTasks,
  planProjectTasks,
  updateProjectTaskFields,
  validateProjectTasks,
} from "./project-tasks.js";

const project = `---
id: task-demo
owner: agent:may
status: active
---

# Task Demo

## Goal
Exercise task parsing.

## Tasks
- id: score-a
  status: ready        # handler-owned projection; can be recomputed
  result: null
  assignee: evaluator
  goal: Score sessions 1-5.
  run: agent
  depends_on: []
  attempts: 0

- id: score-b
  status: done
  result: succeeded
  assignee: evaluator
  goal: Score sessions 6-10.
  depends_on: []
  attempts: 1

- id: analyze
  status: pending
  result: null
  assignee: may
  goal: Analyze scored sessions.
  depends_on: [score-a, score-b]
  attempts: 0

## Journal
unchanged body
`;

describe("project task parsing", () => {
  it("parses the structured ## Tasks section", () => {
    const parsed = parseProjectTasks(project);

    expect(parsed.errors).toEqual([]);
    expect(parsed.tasks).toEqual([
      {
        id: "score-a",
        status: "ready",
        result: null,
        assignee: "evaluator",
        goal: "Score sessions 1-5.",
        run: "agent",
        depends_on: [],
        attempts: 0,
      },
      {
        id: "score-b",
        status: "done",
        result: "succeeded",
        assignee: "evaluator",
        goal: "Score sessions 6-10.",
        run: null,
        depends_on: [],
        attempts: 1,
      },
      {
        id: "analyze",
        status: "pending",
        result: null,
        assignee: "may",
        goal: "Analyze scored sessions.",
        run: null,
        depends_on: ["score-a", "score-b"],
        attempts: 0,
      },
    ]);
  });

  it("treats only done+succeeded dependencies as satisfied", () => {
    const { tasks } = parseProjectTasks(project);
    const plan = planProjectTasks(tasks, { maxConcurrent: 3 });

    expect(plan.dispatchable.map((task) => task.id)).toEqual(["score-a"]);
    expect(plan.tasks.find((task) => task.id === "analyze")).toMatchObject({
      id: "analyze",
      status: "pending",
      unmetDependencies: ["score-a"],
    });
  });

  it("recomputes persisted status from source facts", () => {
    const { tasks } = parseProjectTasks(project.replace("depends_on: [score-a, score-b]", "depends_on: [score-b]"));
    const plan = planProjectTasks(tasks, { activeTaskIds: ["score-a"], maxConcurrent: 3 });

    expect(plan.tasks.find((task) => task.id === "score-a")).toMatchObject({
      id: "score-a",
      status: "running",
    });
    expect(plan.tasks.find((task) => task.id === "analyze")).toMatchObject({
      id: "analyze",
      status: "ready",
      unmetDependencies: [],
    });
    expect(plan.dispatchable.map((task) => task.id)).toEqual(["analyze"]);
  });

  it("keeps failed done tasks from unblocking downstream work", () => {
    const content = project.replace("result: succeeded", "result: failed");
    const { tasks } = parseProjectTasks(content);
    const plan = planProjectTasks(tasks, { maxConcurrent: 3 });

    expect(plan.tasks.find((task) => task.id === "analyze")).toMatchObject({
      id: "analyze",
      status: "pending",
      unmetDependencies: ["score-a", "score-b"],
    });
  });

  it("validates canonical task status and result vocabulary", () => {
    const invalid = `## Tasks
- id: bad
  status: blocked
  result: maybe
  assignee: may
  goal: Bad task.
  run: workflow:
  depends_on: []
`;

    expect(validateProjectTasks(parseProjectTasks(invalid).tasks)).toEqual([
      "task bad has non-canonical status 'blocked'",
      "task bad has non-canonical result 'maybe'",
      "task bad has non-canonical run 'workflow:'",
      "task bad is done only when status is 'done' and result is set",
    ]);
  });

  it("updates task fields without rewriting the rest of the project file", () => {
    const updated = updateProjectTaskFields(project, "score-a", {
      status: "running",
      attempts: 1,
    });

    expect(updated).toContain("## Journal\nunchanged body");
    expect(parseProjectTasks(updated).tasks.find((task) => task.id === "score-a")).toMatchObject({
      status: "running",
      result: null,
      attempts: 1,
    });
    expect(parseProjectTasks(updated).tasks.find((task) => task.id === "score-b")).toMatchObject({
      status: "done",
      result: "succeeded",
      attempts: 1,
    });
  });

  it("can mark a task done with a succeeded result", () => {
    const updated = updateProjectTaskFields(project, "score-a", {
      status: "done",
      result: "succeeded",
    });

    expect(parseProjectTasks(updated).tasks.find((task) => task.id === "score-a")).toMatchObject({
      status: "done",
      result: "succeeded",
    });
  });
});
