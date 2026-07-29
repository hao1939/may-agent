import { describe, expect, it } from "bun:test";

import { liveTaskMetricFrontier } from "./project-metrics.ts";

describe("liveTaskMetricFrontier", () => {
  it("counts only planner-assignable pending leaves as runnable and excludes runtime or satisfied waits from active/ready parity", () => {
    const frontier = liveTaskMetricFrontier({
      root_task_id: "project",
      active_task_ids: [
        "runtime/owner-review",
        "active-leaf",
        "structural-parent",
        "ready-satisfied-wait",
      ],
      tasks: {
        project: { id: "project", children: ["structural-parent"] },
        "runtime/owner-review": {
          id: "runtime/owner-review",
          children: [],
          phase: "running",
          readiness: { state: "ready", reason: "Dependencies and capacity allow claim" },
        },
        "structural-parent": {
          id: "structural-parent",
          children: ["ready-pending"],
          phase: "running",
        },
        "ready-pending": {
          id: "ready-pending",
          children: [],
          phase: "pending",
          readiness: { state: "ready", reason: "Dependencies and capacity allow claim" },
        },
        "ready-satisfied-wait": {
          id: "ready-satisfied-wait",
          children: [],
          phase: "waiting",
          readiness: { state: "ready", reason: "Condition satisfied: repo-ref-advance-demo" },
        },
        "dependency-blocked": {
          id: "dependency-blocked",
          children: [],
          phase: "pending",
          readiness: { state: "ready", reason: "dependency-blocked" },
        },
        "active-leaf": {
          id: "active-leaf",
          children: [],
          phase: "running",
          readiness: { state: "ready", reason: "already assigned" },
        },
        "review-leaf": {
          id: "review-leaf",
          children: [],
          phase: "attention",
        },
      },
    });

    expect(frontier.runnable).toEqual(["ready-pending"]);
    expect(frontier.readySatisfiedWaitHolders).toEqual(["ready-satisfied-wait"]);
    expect(frontier.active).toEqual(["active-leaf"]);
    expect(frontier.review).toEqual(["review-leaf"]);
    expect(frontier.waiting).toEqual(["ready-satisfied-wait"]);
  });
});
