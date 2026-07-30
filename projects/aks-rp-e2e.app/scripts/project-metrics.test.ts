import { describe, expect, it } from "bun:test";

import {
  activeTaskAssignments,
  assignmentStillLooksUnconsumed,
  liveTaskMetricFrontier,
  normalizeWorkflowTaskLivenessRow,
  workflowRunRecentSessionGapLooksHealthy,
} from "./project-metrics.ts";

describe("activeTaskAssignments", () => {
  it("returns only complete running attempts and preserves an optional session", () => {
    expect(
      activeTaskAssignments({
        attempts: {
          running: {
            metadata: { id: "attempt-1" },
            taskId: "task-1",
            state: "running",
            startedAt: "2026-07-29T01:02:03.000Z",
            sessionId: "session-1",
          },
          queued: {
            metadata: { id: "attempt-2" },
            taskId: "task-2",
            state: "queued",
            startedAt: "2026-07-29T01:02:04.000Z",
          },
          incomplete: {
            metadata: { id: "attempt-3" },
            taskId: "task-3",
            state: "running",
          },
        },
      }),
    ).toEqual([
      {
        taskId: "task-1",
        attemptId: "attempt-1",
        assignedAt: "2026-07-29T01:02:03.000Z",
        sessionId: "session-1",
      },
    ]);
  });
});

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
          readiness: {
            state: "ready",
            reason: "Dependencies and capacity allow claim",
          },
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
          readiness: {
            state: "ready",
            reason: "Dependencies and capacity allow claim",
          },
        },
        "ready-satisfied-wait": {
          id: "ready-satisfied-wait",
          children: [],
          phase: "waiting",
          readiness: {
            state: "ready",
            reason: "Condition satisfied: repo-ref-advance-demo",
          },
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
    expect(frontier.readySatisfiedWaitHolders).toEqual([
      "ready-satisfied-wait",
    ]);
    expect(frontier.active).toEqual(["active-leaf"]);
    expect(frontier.review).toEqual(["review-leaf"]);
    expect(frontier.waiting).toEqual(["ready-satisfied-wait"]);
  });
});

describe("normalizeWorkflowTaskLivenessRow", () => {
  it("treats a running workflow run without a child session row as healthy liveness evidence", () => {
    expect(
      normalizeWorkflowTaskLivenessRow(
        {
          workflowRunId: "wr_demo",
          workflowStatus: "running",
          workflowStartedAt: 1785387130184,
          workflowEndedAt: null,
        },
        null,
      ),
    ).toEqual({
      workflowRunId: "wr_demo",
      workflowStatus: "running",
      workflowStartedAt: 1785387130184,
      workflowEndedAt: null,
      sessionId: "wr_demo",
      status: "running",
      startedAt: 1785387130184,
      lastActivityAt: 1785387130184,
      endedAt: null,
    });
  });

  it("prefers the concrete child session row when one exists", () => {
    expect(
      normalizeWorkflowTaskLivenessRow(
        {
          workflowRunId: "wr_demo",
          workflowStatus: "running",
          workflowStartedAt: 10,
          workflowEndedAt: null,
        },
        {
          sessionId: "s_demo",
          status: "running",
          startedAt: 20,
          lastActivityAt: 30,
          endedAt: null,
        },
      ),
    ).toEqual({
      workflowRunId: "wr_demo",
      workflowStatus: "running",
      workflowStartedAt: 10,
      workflowEndedAt: null,
      sessionId: "s_demo",
      status: "running",
      startedAt: 20,
      lastActivityAt: 30,
      endedAt: null,
    });
  });
});

describe("workflowRunRecentSessionGapLooksHealthy", () => {
  it("covers the alert 4273 workflow-completion gap while the workflow run is still finishing", () => {
    expect(
      workflowRunRecentSessionGapLooksHealthy({
        workflowStatus: "running",
        sessionStatus: "done",
        lastSessionEndedAt: 1785375265909,
        nowMs: 1785375266827,
        gapGraceMs: 300000,
      }),
    ).toBeTrue();
  });

  it("covers the alert 4274 session-restart gap while the same workflow run stays active", () => {
    expect(
      workflowRunRecentSessionGapLooksHealthy({
        workflowStatus: "running",
        sessionStatus: "done",
        lastSessionEndedAt: 1785377758852,
        nowMs: 1785377761134,
        gapGraceMs: 300000,
      }),
    ).toBeTrue();
  });

  it("does not hide stale queued assignments once the workflow gap ages past the grace window", () => {
    expect(
      workflowRunRecentSessionGapLooksHealthy({
        workflowStatus: "running",
        sessionStatus: "done",
        lastSessionEndedAt: 1000,
        nowMs: 302001,
        gapGraceMs: 300000,
      }),
    ).toBeFalse();
  });
});

describe("assignmentStillLooksUnconsumed", () => {
  it("treats a healthy owner session as consumed even before worker_started_attempt_id is written", () => {
    expect(
      assignmentStillLooksUnconsumed({
        taskState: "active",
        currentAttemptId: "attempt-1",
        assignmentAttemptId: "attempt-1",
        workerStartedAttemptId: null,
        hasHealthyWorkerSession: false,
        hasHealthyOwnerSession: true,
        hasHealthyWorkflowSession: false,
      }),
    ).toBeFalse();
  });

  it("treats a recent workflow-run handoff gap as consumed", () => {
    expect(
      assignmentStillLooksUnconsumed({
        taskState: "active",
        currentAttemptId: "attempt-gap",
        assignmentAttemptId: "attempt-gap",
        workerStartedAttemptId: null,
        hasHealthyWorkerSession: false,
        hasHealthyOwnerSession: false,
        hasHealthyWorkflowSession: false,
        hasHealthyWorkflowGap: true,
      }),
    ).toBeFalse();
  });

  it("still flags active assignments with no healthy worker, owner, or workflow session", () => {
    expect(
      assignmentStillLooksUnconsumed({
        taskState: "active",
        currentAttemptId: "attempt-2",
        assignmentAttemptId: "attempt-2",
        workerStartedAttemptId: null,
        hasHealthyWorkerSession: false,
        hasHealthyOwnerSession: false,
        hasHealthyWorkflowSession: false,
        hasHealthyWorkflowGap: false,
      }),
    ).toBeTrue();
  });
});
