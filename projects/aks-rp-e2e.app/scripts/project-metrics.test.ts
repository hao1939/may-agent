import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  activeTaskAssignments,
  activeTaskAttemptId,
  activeTaskSessionId,
  blockedTaskHasRegisteredCondition,
  blockedShapeOffenders,
  composeResourceTaskMetricView,
  composeTaskTreeMetricView,
  assignmentStillLooksUnconsumed,
  liveTaskMetricFrontier,
  resourceTaskAuthorityActive,
  normalizeWorkflowTaskLivenessRow,
  ownerSessionRecentCompletionGapLooksHealthy,
  ownerTaskSessionMatchesTaskId,
  representedWaitCoveredFrontierDisposition,
  recentPlannerRunsFromFile,
  specLoopRepresentationAuthority,
  taskState,
  terminalOwnerAttemptHasExpiredLease,
  terminalSessionCompletionGapLooksHealthy,
  workflowDispatchRecentStartLooksHealthy,
  workflowRunRecentSessionGapLooksHealthy,
} from "./project-metrics.ts";

describe("recentPlannerRunsFromFile", () => {
  it("reads only the recent suffix of the retained append-only journal", () => {
    const dir = mkdtempSync(join(tmpdir(), "aks-planner-metric-"));
    const path = join(dir, "planner-runs.jsonl");
    const since = Date.parse("2026-08-22T10:00:00Z");
    writeFileSync(
      path,
      [
        JSON.stringify({
          ts: "2026-08-21T09:00:00Z",
          kind: "planner_wake",
          result: "old",
          detail: "x".repeat(70_000),
        }),
        JSON.stringify({
          ts: "2026-08-22T10:00:00Z",
          kind: "planner_wake",
          result: "at-boundary",
        }),
        "not-json",
        JSON.stringify({
          ts: "2026-08-22T11:00:00Z",
          kind: "other",
          result: "not-a-planner-run",
        }),
        JSON.stringify({
          ts: "2026-08-22T12:00:00Z",
          kind: "planner_wake",
          result: "recent",
        }),
      ].join("\n") + "\n",
    );

    expect(
      recentPlannerRunsFromFile(path, since).map((run) => run.result),
    ).toEqual(["at-boundary", "recent"]);
  });
});

describe("composeTaskTreeMetricView", () => {
  it("combines projected root/tasks with canonical resources/attempts", () => {
    const projection = {
      root_task_id: "project",
      active_task_ids: ["ops/repair"],
      tasks: {
        project: { id: "project", children: ["ops/repair"] },
        "ops/repair": { id: "ops/repair", children: [], phase: "running" },
      },
    };
    const canonical = {
      root_task_id: "stale-canonical-root",
      resources: {
        "ops/repair": { status: { currentAttemptId: "attempt-7" } },
      },
      attempts: {
        "attempt-7": {
          metadata: { id: "attempt-7" },
          taskId: "ops/repair",
          state: "running",
        },
      },
    };

    expect(composeTaskTreeMetricView(projection, canonical)).toMatchObject({
      root_task_id: "project",
      active_task_ids: ["ops/repair"],
      tasks: projection.tasks,
      resources: canonical.resources,
      attempts: canonical.attempts,
    });
  });
});

describe("composeResourceTaskMetricView", () => {
  it("derives the bounded metric projection from current resource rows", () => {
    const taskId = "ops/current";
    const attemptId = "attempt-current";
    const conditionId = "condition:ops/current:pipeline";
    const view = composeResourceTaskMetricView({
      tasks: [
        {
          task_id: taskId,
          phase: "running",
          current_attempt_id: attemptId,
          updated_at: Date.parse("2026-08-22T10:00:00Z"),
          parent_id: "group/app-operations",
          owner: "app-ops",
          workflow: null,
          outcome: "Repair the current issue",
          summary: "Repairing",
          input_json: JSON.stringify({ scope: "current" }),
          condition_ids_json: JSON.stringify([conditionId]),
        },
      ],
      attempts: [
        {
          id: attemptId,
          json: JSON.stringify({
            metadata: { id: attemptId },
            taskId,
            state: "running",
            sessionId: "session-current",
          }),
        },
      ],
      groups: [
        {
          id: "group/app-operations",
          json: JSON.stringify({
            id: "group/app-operations",
            owner: "app-ops",
            parent_id: "project",
          }),
        },
      ],
      conditions: [
        {
          id: conditionId,
          json: JSON.stringify({ id: conditionId, state: "waiting" }),
        },
      ],
    });

    expect(view.root_task_id).toBe("project");
    expect(view.active_task_ids).toEqual([taskId]);
    expect(view.tasks?.project.children).toEqual(["group/app-operations"]);
    expect(view.tasks?.["group/app-operations"].children).toEqual([taskId]);
    expect(view.tasks?.[taskId]).toMatchObject({
      id: taskId,
      phase: "running",
      parent_id: "group/app-operations",
      owner: "app-ops",
      summary: "Repairing",
      trace: { current_attempt_id: attemptId },
      children: [],
    });
    expect(view.resources?.[taskId]).toEqual({
      spec: {
        parentId: "group/app-operations",
        owner: "app-ops",
        workflow: null,
        outcome: "Repair the current issue",
        input: { scope: "current" },
      },
      status: {
        phase: "running",
        currentAttemptId: attemptId,
        conditionIds: [conditionId],
        summary: "Repairing",
        updatedAt: "2026-08-22T10:00:00.000Z",
      },
    });
    expect(view.attempts?.[attemptId].sessionId).toBe("session-current");
    expect(view.conditions?.[conditionId]).toEqual({
      id: conditionId,
      state: "waiting",
    });
  });
});

describe("resourceTaskAuthorityActive", () => {
  it("uses the exact production authority value", () => {
    expect(resourceTaskAuthorityActive("resources")).toBe(true);
    expect(resourceTaskAuthorityActive("resource")).toBe(false);
    expect(resourceTaskAuthorityActive(undefined)).toBe(false);
  });
});

describe("activeTaskAttemptId", () => {
  it("does not dereference a missing projected task while canonical attempts roll up", () => {
    expect(activeTaskAttemptId(undefined)).toBe("");
  });
});

describe("blockedTaskHasRegisteredCondition", () => {
  it("recognizes a canonical registered Condition as the wait and fallback authority", () => {
    const tree = {
      resources: {
        "ops/wait": {
          status: { conditionIds: ["condition:ops/wait:approval"] },
        },
      },
      conditions: {
        "condition:ops/wait:approval": {
          id: "condition:ops/wait:approval",
          type: "approval.state",
        },
      },
    };

    expect(blockedTaskHasRegisteredCondition(tree, { id: "ops/wait" })).toBe(
      true,
    );
    expect(
      blockedTaskHasRegisteredCondition(tree, { id: "ops/legacy-wait" }),
    ).toBe(false);
  });
});

describe("blockedShapeOffenders", () => {
  const empty = {
    missingWaitingForTaskIds: [],
    missingObserverTaskIds: [],
    missingResumeConditionTaskIds: [],
    missingOwnerTaskIds: [],
    missingFallbackTaskIds: [],
  };

  it("keeps a Condition-backed wait at zero across a projected waiting transition", () => {
    const taskId = "ops/condition-wait";
    const conditionId = "condition:ops/condition-wait:pipeline";
    expect(
      blockedShapeOffenders({
        root_task_id: "project",
        tasks: {
          project: { id: "project", children: [taskId] },
          [taskId]: { id: taskId, children: [], phase: "waiting" },
        },
        resources: {
          [taskId]: {
            spec: { parentId: "project" },
            status: { phase: "waiting", conditionIds: [conditionId] },
          },
        },
        conditions: { [conditionId]: { id: conditionId } },
      }),
    ).toEqual(empty);
  });

  it("does not mistake a stale projected leaf for a malformed wait after its direct child is admitted", () => {
    const taskId = "ops/parent-wait";
    const childId = "ops/parent-wait/repair";
    expect(
      blockedShapeOffenders({
        root_task_id: "project",
        tasks: {
          project: { id: "project", children: [taskId] },
          [taskId]: { id: taskId, children: [], phase: "waiting" },
        },
        resources: {
          [taskId]: {
            spec: { parentId: "project" },
            status: { phase: "waiting", conditionIds: [] },
          },
          [childId]: {
            spec: { parentId: taskId },
            status: { phase: "pending", conditionIds: [] },
          },
        },
        conditions: {},
      }),
    ).toEqual(empty);
  });

  it("retains a stable malformed compatibility wait and its exact offender id", () => {
    const taskId = "ops/malformed-legacy-wait";
    const offenders = blockedShapeOffenders({
      root_task_id: "project",
      tasks: {
        project: { id: "project", children: [taskId] },
        [taskId]: { id: taskId, children: [], phase: "waiting" },
      },
      resources: {
        [taskId]: {
          spec: { parentId: "project" },
          status: { phase: "waiting", conditionIds: [] },
        },
      },
      conditions: {},
    });

    expect(offenders).toEqual({
      missingWaitingForTaskIds: [taskId],
      missingObserverTaskIds: [taskId],
      missingResumeConditionTaskIds: [taskId],
      missingOwnerTaskIds: [taskId],
      missingFallbackTaskIds: [taskId],
    });
  });
});

describe("activeTaskSessionId", () => {
  it("reads the current canonical attempt session when the task projection omits legacy session fields", () => {
    expect(
      activeTaskSessionId(
        { id: "ops/recovery" },
        {
          resources: {
            "ops/recovery": { status: { currentAttemptId: "attempt-2" } },
          },
          attempts: {
            "attempt-2": {
              metadata: { id: "attempt-2" },
              taskId: "ops/recovery",
              state: "running",
              sessionId: "terminal-owner-session",
            },
          },
        },
      ),
    ).toBe("terminal-owner-session");
  });

  it("prefers the task's explicit live session over attempt fallback", () => {
    expect(
      activeTaskSessionId(
        { id: "ops/recovery", session_id: "healthy-live-session" },
        {
          resources: {
            "ops/recovery": { status: { currentAttemptId: "attempt-2" } },
          },
          attempts: {
            "attempt-2": {
              metadata: { id: "attempt-2" },
              taskId: "ops/recovery",
              state: "running",
              sessionId: "old-session",
            },
          },
        },
      ),
    ).toBe("healthy-live-session");
  });
});

describe("terminalOwnerAttemptHasExpiredLease", () => {
  const attempt = {
    state: "running",
    handler: "owner:app-ops",
    sessionId: "owner-session",
    lease: {
      sessionId: "owner-session",
      expiresAt: "2026-08-15T23:57:29.078Z",
    },
  };

  it("exposes a terminal agent session whose exact lease expired", () => {
    expect(
      terminalOwnerAttemptHasExpiredLease(
        attempt,
        "done",
        Date.parse("2026-08-16T01:00:00Z"),
      ),
    ).toBe(true);
  });

  it("never marks a healthy live agent session or fresh lease stale", () => {
    expect(
      terminalOwnerAttemptHasExpiredLease(
        attempt,
        "running",
        Date.parse("2026-08-16T01:00:00Z"),
      ),
    ).toBe(false);
    expect(
      terminalOwnerAttemptHasExpiredLease(
        attempt,
        "done",
        Date.parse("2026-08-15T23:40:00Z"),
      ),
    ).toBe(false);
  });
});

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

describe("ownerTaskSessionMatchesTaskId", () => {
  it("matches the exact reconciliation task id from the owner-session prompt", () => {
    expect(
      ownerTaskSessionMatchesTaskId({
        taskId:
          "compact/compact-feature-traffic-alb-controller-f289285684-28251226a1",
        sessionTask: `## Reconciliation Task\n\
\
\
{"taskId":"compact/compact-feature-traffic-alb-controller-f289285684-28251226a1"}`,
      }),
    ).toBeTrue();
  });

  it("does not let a nearby different agent session match the wrong task", () => {
    expect(
      ownerTaskSessionMatchesTaskId({
        taskId:
          "compact/compact-feature-traffic-alb-controller-f289285684-28251226a1",
        sessionTask: `## Reconciliation Task\n\
\
\
{"taskId":"domain/review-terminal-ado-run-174455557"}`,
      }),
    ).toBeFalse();
  });
});

describe("ownerSessionRecentCompletionGapLooksHealthy", () => {
  it("covers the reproduced direct-agent completion gap before project.task.reconciled clears the attempt", () => {
    expect(
      ownerSessionRecentCompletionGapLooksHealthy({
        sessionStatus: "done",
        sessionOutcome: "done",
        lastSessionEndedAt: 1785396689748,
        nowMs: 1785396690495,
        gapGraceMs: 300000,
      }),
    ).toBeTrue();
  });

  it("does not hide stale or failed agent sessions", () => {
    expect(
      ownerSessionRecentCompletionGapLooksHealthy({
        sessionStatus: "error",
        sessionOutcome: "error",
        lastSessionEndedAt: 1785396689748,
        nowMs: 1785396690495,
        gapGraceMs: 300000,
      }),
    ).toBeFalse();
    expect(
      ownerSessionRecentCompletionGapLooksHealthy({
        sessionStatus: "done",
        sessionOutcome: "done",
        lastSessionEndedAt: 1000,
        nowMs: 302001,
        gapGraceMs: 300000,
      }),
    ).toBeFalse();
  });
});

describe("terminalSessionCompletionGapLooksHealthy", () => {
  it("covers the reproduced workflow-backed worker completion gap before task reconciliation clears the active leaf", () => {
    expect(
      terminalSessionCompletionGapLooksHealthy({
        sessionStatus: "done",
        lastSessionEndedAt: 1785432390028,
        nowMs: 1785432395012,
        gapGraceMs: 600000,
      }),
    ).toBeTrue();
  });

  it("does not hide stale or still-running worker sessions", () => {
    expect(
      terminalSessionCompletionGapLooksHealthy({
        sessionStatus: "running",
        lastSessionEndedAt: 1785432390028,
        nowMs: 1785432395012,
        gapGraceMs: 600000,
      }),
    ).toBeFalse();
    expect(
      terminalSessionCompletionGapLooksHealthy({
        sessionStatus: "done",
        lastSessionEndedAt: 1000,
        nowMs: 601001,
        gapGraceMs: 600000,
      }),
    ).toBeFalse();
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

  it("covers a recent done workflow-backed gap until task reconciliation clears the active leaf", () => {
    expect(
      workflowRunRecentSessionGapLooksHealthy({
        workflowStatus: "done",
        workflowEndedAt: 1785432395336,
        sessionStatus: "done",
        lastSessionEndedAt: 1785432390028,
        nowMs: 1785432396000,
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

  it("does not hide failed workflow-backed gaps", () => {
    expect(
      workflowRunRecentSessionGapLooksHealthy({
        workflowStatus: "done",
        workflowEndedAt: 1785432395336,
        sessionStatus: "error",
        lastSessionEndedAt: 1785432390028,
        nowMs: 1785432396000,
        gapGraceMs: 300000,
      }),
    ).toBeFalse();
  });
});

describe("workflowDispatchRecentStartLooksHealthy", () => {
  it("covers a recent workflow-dispatch started handoff before workflow_run_id is recorded", () => {
    expect(
      workflowDispatchRecentStartLooksHealthy({
        dispatchStatus: "started",
        dispatchTimestamp: 1785468171663,
        nowMs: 1785468447308,
        gapGraceMs: 300000,
      }),
    ).toBeTrue();
  });

  it("covers the alert 4303 prolonged queue/start gap while the workflow run is still pending", () => {
    expect(
      workflowDispatchRecentStartLooksHealthy({
        dispatchStatus: "started",
        dispatchTimestamp: 1785509540926,
        nowMs: 1785510300000,
      }),
    ).toBeTrue();
  });

  it("does not hide workflow-dispatch started handoffs after the extended queue grace ages out", () => {
    expect(
      workflowDispatchRecentStartLooksHealthy({
        dispatchStatus: "started",
        dispatchTimestamp: 1785509540926,
        nowMs: 1785510500000,
      }),
    ).toBeFalse();
  });

  it("does not hide stale workflow-dispatch started handoffs", () => {
    expect(
      workflowDispatchRecentStartLooksHealthy({
        dispatchStatus: "started",
        dispatchTimestamp: 1000,
        nowMs: 302001,
        gapGraceMs: 300000,
      }),
    ).toBeFalse();
  });
});

describe("projected task phase assignment consumption", () => {
  it("normalizes string state, string status, then projected phase without treating resource status objects as state", () => {
    expect(
      taskState({ state: "waiting", status: "running", phase: "running" }),
    ).toBe("blocked");
    expect(taskState({ status: "accepted", phase: "running" })).toBe("done");
    expect(taskState({ status: { phase: "waiting" }, phase: "running" })).toBe(
      "active",
    );
    expect(taskState({ status: { phase: "running" } })).toBe("backlog");
  });

  it("treats a projected phase=running assignment with its canonical attempt and healthy workflow session as consumed", () => {
    const taskId = "domain/projected-running";
    const attemptId = "attempt-projected-running";
    const view = composeTaskTreeMetricView(
      {
        root_task_id: "project",
        tasks: {
          project: { id: "project", children: [taskId] },
          [taskId]: {
            id: taskId,
            phase: "running",
            status: { phase: "running", currentAttemptId: attemptId },
            trace: { current_attempt_id: attemptId },
            children: [],
          },
        },
      },
      {
        resources: {
          [taskId]: { status: { currentAttemptId: attemptId } },
        },
        attempts: {
          [attemptId]: {
            metadata: { id: attemptId },
            taskId,
            state: "running",
          },
        },
      },
    );
    const task = view.tasks?.[taskId];

    expect(taskState(task)).toBe("active");
    expect(activeTaskAttemptId(task)).toBe(attemptId);
    expect(
      assignmentStillLooksUnconsumed({
        taskState: taskState(task),
        currentAttemptId: activeTaskAttemptId(task),
        assignmentAttemptId: attemptId,
        hasHealthyWorkflowSession: true,
      }),
    ).toBeFalse();
  });

  it("keeps an actually mismatched projected assignment visible", () => {
    expect(
      assignmentStillLooksUnconsumed({
        taskState: taskState({ phase: "running" }),
        currentAttemptId: "attempt-current",
        assignmentAttemptId: "attempt-stale",
        hasHealthyWorkflowSession: true,
      }),
    ).toBeTrue();
  });
});

describe("assignmentStillLooksUnconsumed", () => {
  it("treats a healthy agent session as consumed even before worker_started_attempt_id is written", () => {
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

  it("treats a recent direct-agent completion gap as consumed", () => {
    expect(
      assignmentStillLooksUnconsumed({
        taskState: "active",
        currentAttemptId: "attempt-owner-gap",
        assignmentAttemptId: "attempt-owner-gap",
        workerStartedAttemptId: null,
        hasHealthyWorkerSession: false,
        hasHealthyOwnerSession: false,
        hasHealthyOwnerGap: true,
        hasHealthyWorkflowSession: false,
        hasHealthyWorkflowGap: false,
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
        hasHealthyOwnerGap: false,
        hasHealthyWorkflowSession: false,
        hasHealthyWorkflowGap: true,
      }),
    ).toBeFalse();
  });

  it("treats a recent workflow-dispatch started gap as consumed", () => {
    expect(
      assignmentStillLooksUnconsumed({
        taskState: "active",
        currentAttemptId: "attempt-dispatch-gap",
        assignmentAttemptId: "attempt-dispatch-gap",
        workerStartedAttemptId: null,
        hasHealthyWorkerSession: false,
        hasHealthyOwnerSession: false,
        hasHealthyOwnerGap: false,
        hasHealthyWorkflowSession: false,
        hasHealthyWorkflowGap: false,
        hasHealthyDispatchStartGap: true,
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

describe("specLoopRepresentationAuthority", () => {
  it("treats the scenario-normalization master-validation residue as fully represented exact waits", () => {
    const waitingTaskIds = [
      "domain/master-validation-failure/spec.node-ephemeral-disk.master-validation/f4f61b9810af0df7b51b",
      "domain/master-validation-failure/spec.traffic-azure-service-mesh.master-validation-canary-upgrade-azurelinux/f34b24018b058e7e1a21",
      "domain/master-validation-failure/spec.traffic-azure-service-mesh.master-validation-crud-azurelinux/4beee8c851402f5791b8",
      "domain/master-validation-failure/spec.traffic-azure-service-mesh.master-validation-fips-azurelinux-source-equivalent/3c95fe5376e9fdc604ea",
      "domain/master-validation-failure/spec.traffic-azure-service-mesh.master-validation-functionality-azurelinux/35379ea757d7be623f5b",
      "domain/master-validation-failure/spec.traffic-azure-service-mesh.master-validation-functionality-dualstack-azurelinux/3624a61378a9ffb4b279",
      "domain/master-validation-failure/spec.traffic-azure-service-mesh.master-validation-functionality-istiocni-azurelinux/f2406340319ae6374723",
    ];
    const specIds = [
      "spec.node-ephemeral-disk.master-validation",
      "spec.traffic-azure-service-mesh.master-validation-canary-upgrade-azurelinux",
      "spec.traffic-azure-service-mesh.master-validation-crud-azurelinux",
      "spec.traffic-azure-service-mesh.master-validation-fips-azurelinux-source-equivalent",
      "spec.traffic-azure-service-mesh.master-validation-functionality-azurelinux",
      "spec.traffic-azure-service-mesh.master-validation-functionality-dualstack-azurelinux",
      "spec.traffic-azure-service-mesh.master-validation-functionality-istiocni-azurelinux",
    ];

    const tree = {
      tasks: Object.fromEntries(
        waitingTaskIds.map((taskId, index) => [
          taskId,
          {
            id: taskId,
            children: [],
            phase: "waiting",
            conflict_scope: [`spec:${specIds[index]}`],
            blocker: { waiting_for: { type: "pipeline.spec.observed" } },
          },
        ]),
      ),
    };
    const state = {
      specs: Object.fromEntries(
        specIds.map((specId, index) => [
          specId,
          {
            status: "pending",
            taskId: waitingTaskIds[index],
            successorDisposition: "master_validation_failure_lineage_wait",
            resumeCondition: `wait for ${specId}`,
            review: {
              classification: "master_validation_failure_lineage_wait",
            },
          },
        ]),
      ),
    };

    expect(specLoopRepresentationAuthority({ tree, state })).toEqual({
      authorityObserved: true,
      nonTerminalSpecCount: 7,
      unrepresentedNonTerminalCount: 0,
      representedSpecIds: specIds,
      unrepresentedSpecIds: [],
      waitingTaskIds,
    });
  });

  it("treats a live standing controller as the holder for its bounded ledger backlog and excludes terminal dispositions", () => {
    const loopTaskId = "aks-spec-verification-loop";
    const queuedSpecId = "spec.queued";
    const terminalSpecId = "spec.terminal";
    const tree = {
      tasks: {
        [loopTaskId]: {
          id: loopTaskId,
          children: ["spec/current-slice"],
          phase: "waiting",
        },
      },
    };
    const state = {
      loopTaskId,
      specs: {
        [queuedSpecId]: {
          status: "pending",
          taskId: null,
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-08-19T00:00:00.000Z",
        },
        [terminalSpecId]: {
          status: "pending",
          terminalDisposition: true,
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-08-19T00:00:00.000Z",
        },
      },
    };

    expect(specLoopRepresentationAuthority({ tree, state })).toEqual({
      authorityObserved: true,
      nonTerminalSpecCount: 1,
      unrepresentedNonTerminalCount: 0,
      representedSpecIds: [queuedSpecId],
      unrepresentedSpecIds: [],
      waitingTaskIds: [loopTaskId],
    });
  });

  it("does not publish a false recovery while a running controller retains an unchanged stale-fence failure", () => {
    const loopTaskId = "aks-spec-verification-loop";
    const specId = "spec.aad-rbac.azure-rbac-authorization";
    const state = {
      loopTaskId,
      specs: { [specId]: { status: "pending", taskId: null } },
    };
    const staleRunningTree = {
      tasks: {
        [loopTaskId]: {
          id: loopTaskId,
          phase: "running",
          summary:
            "Handler actions were rejected: Resource-backed task mutation was rejected by a stale fence",
        },
      },
    };
    const healthyRunningTree = {
      tasks: {
        [loopTaskId]: {
          id: loopTaskId,
          phase: "running",
          summary: "Prior bounded frontier reconciliation applied",
        },
      },
    };

    expect(
      specLoopRepresentationAuthority({ tree: staleRunningTree, state }),
    ).toMatchObject({
      unrepresentedNonTerminalCount: 1,
      representedSpecIds: [],
      unrepresentedSpecIds: [specId],
    });
    expect(
      specLoopRepresentationAuthority({ tree: healthyRunningTree, state }),
    ).toMatchObject({
      unrepresentedNonTerminalCount: 0,
      representedSpecIds: [specId],
      unrepresentedSpecIds: [],
    });
  });

  it("excludes projected attention from holder authority while preserving exact waiting holders", () => {
    const loopTaskId = "aks-spec-verification-loop";
    const machinesSpecId = "spec.localdns.topology-machines";
    const networkIsolatedSpecId = "spec.localdns.topology-network-isolated";
    const machinesHolderId =
      "spec/verify-spec-localdns-topology-machines-79d198900f";
    const networkIsolatedHolderId =
      "spec/verify-spec-localdns-topology-network-isolated-79d198900f";
    const tree = {
      tasks: {
        [loopTaskId]: {
          id: loopTaskId,
          children: [machinesHolderId, networkIsolatedHolderId],
          phase: "converged",
        },
        [machinesHolderId]: {
          id: machinesHolderId,
          parent_id: loopTaskId,
          children: [],
          phase: "waiting",
          input: { loopId: loopTaskId, specId: machinesSpecId },
        },
        [networkIsolatedHolderId]: {
          id: networkIsolatedHolderId,
          parent_id: loopTaskId,
          children: [],
          phase: "attention",
          input: { loopId: loopTaskId, specId: networkIsolatedSpecId },
        },
      },
    };
    const state = {
      loopTaskId,
      specs: {
        [machinesSpecId]: { status: "pending", taskId: machinesHolderId },
        [networkIsolatedSpecId]: { status: "pending", taskId: null },
      },
    };

    expect(specLoopRepresentationAuthority({ tree, state })).toEqual({
      authorityObserved: true,
      nonTerminalSpecCount: 2,
      unrepresentedNonTerminalCount: 1,
      representedSpecIds: [machinesSpecId],
      unrepresentedSpecIds: [networkIsolatedSpecId],
      waitingTaskIds: [machinesHolderId],
    });
  });
});

describe("representedWaitCoveredFrontierDisposition", () => {
  it("suppresses wait-covered gap alerts when loop authorities report zero unrepresented work", () => {
    expect(
      representedWaitCoveredFrontierDisposition({
        projectClosed: false,
        runnable: 0,
        healthyActive: 0,
        review: 0,
        openGaps: 111,
        loopUnrepresentedCount: 0,
        loopAuthorityObservationCount: 2,
        waitingTaskIds: [
          "hold-compact-aad-rbac-split-frontier-9a363c168b-20260728",
          "hold-compact-ccp-metricsserver-reviewed-exception-ha-frontier-3d7512da55-20260730",
          "hold-compact-ccp-security-patch-os-variants-reviewed-terminal-frontier-ac11f9ba2e-20260728",
          "hold-compact-kms-split-frontier-116cb59d75-20260730",
          "domain/wait-machines-agentpool-nap-full-cleanup-direct-carrier-origin-dev-publication-after-next-dev-advance-89146c8c-20260728",
          "hold-compact-secure-tls-bootstrap-current-ready-subset-frontier-ac65437296-20260728",
        ],
      }),
    ).toEqual({
      covered: true,
      note: JSON.stringify({
        disposition: "represented-wait-covered-frontier",
        waitingTaskCount: 6,
        waitingTaskIds: [
          "hold-compact-aad-rbac-split-frontier-9a363c168b-20260728",
          "hold-compact-ccp-metricsserver-reviewed-exception-ha-frontier-3d7512da55-20260730",
          "hold-compact-ccp-security-patch-os-variants-reviewed-terminal-frontier-ac11f9ba2e-20260728",
          "hold-compact-kms-split-frontier-116cb59d75-20260730",
          "domain/wait-machines-agentpool-nap-full-cleanup-direct-carrier-origin-dev-publication-after-next-dev-advance-89146c8c-20260728",
          "hold-compact-secure-tls-bootstrap-current-ready-subset-frontier-ac65437296-20260728",
        ],
        openGapCount: 111,
        loopUnrepresentedCount: 0,
        loopAuthorityObservationCount: 2,
      }),
    });
  });

  it("does not suppress when loop authorities still report unrepresented work", () => {
    expect(
      representedWaitCoveredFrontierDisposition({
        projectClosed: false,
        runnable: 0,
        healthyActive: 0,
        review: 0,
        openGaps: 111,
        loopUnrepresentedCount: 1,
        loopAuthorityObservationCount: 2,
        waitingTaskIds: [
          "hold-compact-aad-rbac-split-frontier-9a363c168b-20260728",
        ],
      }),
    ).toEqual({ covered: false });
  });

  it("does not suppress when no loop authority reported representation", () => {
    expect(
      representedWaitCoveredFrontierDisposition({
        projectClosed: false,
        runnable: 0,
        healthyActive: 0,
        review: 0,
        openGaps: 111,
        loopUnrepresentedCount: 0,
        loopAuthorityObservationCount: 0,
        waitingTaskIds: ["hold-compact-aad-rbac-split-frontier"],
      }),
    ).toEqual({ covered: false });
  });
});
