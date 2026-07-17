import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureProjectSnapshotV2 } from "../scripts/project-snapshot-v2.ts";
import { captureRuntimeProjectSnapshotV2 } from "./lib/project-snapshot-capture-v2.ts";
import {
  buildProjectSnapshotV2,
  compareFrontiersV2,
  type ProjectSnapshotV2Input,
} from "./lib/project-snapshot-v2.ts";
import type { TaskNode, TaskTree } from "./lib/task-tree-store.ts";

const NOW = Date.parse("2026-07-16T04:00:00.000Z");

function task(
  id: string,
  state: string,
  overrides: Partial<TaskNode> & { revision?: number } = {},
): TaskNode {
  return {
    id,
    state,
    kind: "domain_leaf",
    children: [],
    goal: `Complete ${id}`,
    outputs: [`evidence/${id}.md`],
    acceptance: [`${id} is complete`],
    ...overrides,
  };
}

function tree(
  tasks: TaskNode[],
  rootOverrides: Partial<TaskNode> = {},
): TaskTree {
  const rootChildren = tasks
    .filter((candidate) => candidate.parent_id === "project")
    .map((candidate) => candidate.id);
  const root = task("project", "active", {
    kind: "project",
    children: rootChildren,
    ...rootOverrides,
  });
  return {
    root_task_id: "project",
    updated_at: "2026-07-16T03:59:00.000Z",
    tasks: Object.fromEntries([root, ...tasks].map((item) => [item.id, item])),
  };
}

function snapshot(
  taskTree: TaskTree,
  overrides: Partial<ProjectSnapshotV2Input> = {},
) {
  return buildProjectSnapshotV2({
    projectId: "fixture",
    tree: taskTree,
    nowMs: NOW,
    ...overrides,
  });
}

describe("ProjectSnapshot V2", () => {
  test("derives a deterministic frontier from parent_id and reports stale child mirrors", () => {
    const input = tree(
      [
        task("ready", "backlog", { parent_id: "project" }),
        task("waiting", "backlog", {
          parent_id: "project",
          depends_on: ["ready"],
        }),
      ],
      { children: ["waiting", "ghost"] },
    );

    const first = snapshot(input);
    const second = snapshot(input);

    expect(second).toEqual(first);
    expect(first.frontier.roots).toEqual(["project"]);
    expect(first.frontier.runnable).toEqual(["ready"]);
    expect(first.frontier.waiting).toEqual(["waiting"]);
    expect(first.frontier.readiness.waiting).toEqual(["dependency:ready"]);
    expect(
      first.invariants.find(
        (finding) =>
          finding.type === "tree-relationship-mismatch" &&
          finding.subject.id === "project",
      ),
    ).toMatchObject({
      recoveryKey: "tree-relationship:project:0",
      taskIds: ["ghost", "project", "ready", "waiting"],
    });
  });

  test("limits frontier work to root-reachable tasks and excludes non-executable active leaves", () => {
    const result = snapshot(
      tree([
        task("live", "active", { parent_id: "project" }),
        task("focus", "active", {
          parent_id: "project",
          kind: "focus_plan",
        }),
        task("archive-container", "blocked", {
          kind: "work",
        }),
      ]),
    );

    expect(result.frontier.roots).toEqual(["project"]);
    expect(result.frontier.active).toEqual(["live"]);
    expect(result.frontier.blocked).toEqual([]);
    expect(result.frontier.counts).toMatchObject({
      total: 3,
      leafTotal: 2,
      active: 1,
      blocked: 0,
    });
  });

  test("projects viable, stale, terminal, and missing active attempts", () => {
    const active = ["running", "stale", "terminal", "missing"].map((id) =>
      task(id, "active", {
        parent_id: "project",
        session_id: `session-${id}`,
        trace: { current_attempt_id: `attempt-${id}` },
      }),
    );
    const result = snapshot(tree(active), {
      staleNoActivityMs: 10 * 60_000,
      assignments: [],
      attemptHeartbeats: [],
      sessions: [
        {
          sessionId: "session-running",
          status: "running",
          startedAt: NOW - 60_000,
          endedAt: null,
          lastActivityAt: NOW - 30_000,
        },
        {
          sessionId: "session-stale",
          status: "running",
          startedAt: NOW - 30 * 60_000,
          endedAt: null,
          lastActivityAt: NOW - 20 * 60_000,
        },
        {
          sessionId: "session-terminal",
          status: "completed",
          startedAt: NOW - 5 * 60_000,
          endedAt: NOW - 60_000,
          lastActivityAt: NOW - 60_000,
        },
      ],
    });

    expect(
      Object.fromEntries(
        result.attempts.map((attempt) => [
          attempt.taskId,
          attempt.runtimeState,
        ]),
      ),
    ).toEqual({
      missing: "missing",
      running: "running",
      stale: "stale",
      terminal: "terminal",
    });
    expect(result.invariants.map((finding) => finding.type)).toEqual([
      "active-attempt-missing",
      "active-attempt-stale",
      "active-attempt-terminal",
    ]);
  });

  test("marks omitted runtime sources unavailable instead of manufacturing missing facts", () => {
    const result = snapshot(
      tree([
        task("active", "active", {
          parent_id: "project",
          session_id: "session-active",
          trace: { current_attempt_id: "attempt-active" },
        }),
        task("review", "review", {
          parent_id: "project",
          trace: {
            current_attempt_id: "attempt-review",
            last_worker_completed_at: "2026-07-16T03:00:00.000Z",
          },
        }),
      ]),
    );

    expect(result.coverage).toEqual({
      tree: "available",
      assignments: "unavailable",
      sessions: "unavailable",
      reviews: "unavailable",
      controllers: "unavailable",
      controllerLiveness: "unavailable",
      delivery: "unavailable",
    });
    expect(result.attempts[0]).toMatchObject({
      taskId: "active",
      assignmentState: "unknown",
      runtimeState: "unknown",
    });
    expect(result.reviews[0]).toMatchObject({
      taskId: "review",
      deliveryState: "unknown",
    });
    expect(
      result.invariants.filter((finding) =>
        finding.type.startsWith("active-attempt"),
      ),
    ).toEqual([]);
    expect(
      result.invariants.filter((finding) => finding.type.startsWith("review-")),
    ).toEqual([]);
  });

  test("projects an exact terminal session without requiring the drained assignment outbox", () => {
    const result = snapshot(
      tree([
        task("terminal", "active", {
          parent_id: "project",
          revision: 2,
          session_id: "session-terminal",
          context: { controlPlaneVersion: 2 },
          trace: {
            current_attempt_id: "attempt-terminal",
            assigned_at: "2026-07-16T03:00:00.000Z",
          },
        }),
      ]),
      {
        sessions: [
          {
            sessionId: "session-terminal",
            status: "done",
            outcome: "done",
            startedAt: NOW - 5 * 60_000,
            endedAt: NOW - 60_000,
            lastActivityAt: NOW - 60_000,
          },
        ],
      },
    );

    expect(result.coverage.assignments).toBe("unavailable");
    expect(result.attempts[0]).toMatchObject({
      controlPlaneVersion: 2,
      assignmentState: "consumed",
      runtimeState: "terminal",
    });
    expect(result.invariants).toContainEqual(
      expect.objectContaining({
        type: "active-attempt-terminal",
        recoveryKey: "active-attempt-terminal:terminal:2:attempt-terminal",
      }),
    );
  });

  test("uses only a matching task revision and attempt controller heartbeat", () => {
    const active = task("verify", "active", {
      parent_id: "project",
      revision: 3,
      session_id: "session-verify",
      trace: { current_attempt_id: "attempt-3" },
    });
    const base = {
      assignments: [],
      sessions: [
        {
          sessionId: "session-verify",
          status: "completed",
          startedAt: NOW - 20 * 60_000,
          endedAt: NOW - 15 * 60_000,
          lastActivityAt: NOW - 15 * 60_000,
        },
      ],
      loops: [],
      reviews: [],
      deliveryGaps: [],
    } satisfies Partial<ProjectSnapshotV2Input>;

    const matching = snapshot(tree([active]), {
      ...base,
      attemptHeartbeats: [
        {
          taskId: "verify",
          taskRevision: 3,
          attemptId: "attempt-3",
          sessionId: "session-verify",
          workflow: "single-spec-verifier",
          heartbeatAt: "2026-07-16T03:59:30.000Z",
        },
      ],
    });
    expect(matching.attempts[0]).toMatchObject({
      runtimeState: "running",
      reason:
        "matching task revision and attempt controller heartbeat is fresh",
    });
    expect(
      matching.invariants.filter((finding) =>
        finding.type.startsWith("active-attempt"),
      ),
    ).toEqual([]);

    const staleRevision = snapshot(tree([active]), {
      ...base,
      attemptHeartbeats: [
        {
          taskId: "verify",
          taskRevision: 2,
          attemptId: "attempt-3",
          sessionId: "session-verify",
          workflow: "single-spec-verifier",
          heartbeatAt: "2026-07-16T03:59:30.000Z",
        },
      ],
    });
    expect(staleRevision.attempts[0].runtimeState).toBe("terminal");
    expect(staleRevision.invariants).toContainEqual(
      expect.objectContaining({
        type: "active-attempt-terminal",
        recoveryKey: "active-attempt-terminal:verify:3:attempt-3",
      }),
    );
  });

  test("distinguishes review grace, missing delivery, and unapplied decisions", () => {
    const reviewTasks = [
      task("within-grace", "review", {
        parent_id: "project",
        trace: {
          current_attempt_id: "attempt-grace",
          last_worker_completed_at: "2026-07-16T03:55:00.000Z",
        },
      }),
      task("missing-review", "review", {
        parent_id: "project",
        trace: {
          current_attempt_id: "attempt-missing",
          last_worker_completed_at: "2026-07-16T03:00:00.000Z",
        },
      }),
      task("decision-pending", "review", {
        parent_id: "project",
        trace: {
          current_attempt_id: "attempt-decision",
          last_worker_completed_at: "2026-07-16T03:00:00.000Z",
        },
      }),
    ];
    const result = snapshot(tree(reviewTasks), {
      reviewGraceMs: 15 * 60_000,
      reviews: [
        {
          taskId: "decision-pending",
          taskRevision: 0,
          attemptId: "attempt-decision",
          decision: "accepted",
          ts: "2026-07-16T03:30:00.000Z",
          actionDeliveryStatus: "pending",
        },
      ],
    });

    expect(
      Object.fromEntries(
        result.reviews.map((review) => [review.taskId, review.deliveryState]),
      ),
    ).toEqual({
      "decision-pending": "decision-pending-apply",
      "missing-review": "missing",
      "within-grace": "within-grace",
    });
    expect(result.invariants.map((finding) => finding.type)).toEqual([
      "review-decision-not-applied",
      "review-delivery-missing",
    ]);
    expect(
      result.pendingActions.map((action) => [
        action.kind,
        action.subject.taskId,
        action.status,
      ]),
    ).toEqual([
      ["completion-review-delivery", "missing-review", "pending"],
      ["completion-review-delivery", "within-grace", "unknown"],
      ["review-application-delivery", "decision-pending", "pending"],
    ]);
  });

  test("projects a fresh review application action without racing its initial grace", () => {
    const result = snapshot(
      tree([
        task("decision-pending", "review", {
          parent_id: "project",
          revision: 2,
          trace: {
            current_attempt_id: "attempt-decision",
            last_worker_completed_at: "2026-07-16T03:30:00.000Z",
          },
        }),
      ]),
      {
        reviewApplicationGraceMs: 5 * 60_000,
        reviews: [
          {
            taskId: "decision-pending",
            taskRevision: 2,
            attemptId: "attempt-decision",
            decision: "accepted",
            ts: "2026-07-16T03:59:00.000Z",
            actionDeliveryStatus: "accepted",
            actionDeliveryAttempts: 1,
            actionAcceptedAt: "2026-07-16T03:59:01.000Z",
          },
        ],
      },
    );

    expect(result.pendingActions).toContainEqual(
      expect.objectContaining({
        kind: "review-application-delivery",
        status: "accepted",
        postcondition: expect.objectContaining({
          dueAt: "2026-07-16T04:04:00.000Z",
        }),
      }),
    );
    expect(
      result.invariants.some(
        (finding) => finding.type === "review-decision-not-applied",
      ),
    ).toBe(false);
  });

  test("reports an unapplied review decision after application grace", () => {
    const taskTree = tree([
      task("decision-pending", "review", {
        parent_id: "project",
        revision: 2,
        trace: {
          current_attempt_id: "attempt-decision",
          last_worker_completed_at: "2026-07-16T03:30:00.000Z",
        },
      }),
    ]);
    const reviews = [
      {
        taskId: "decision-pending",
        taskRevision: 2,
        attemptId: "attempt-decision",
        decision: "accepted",
        ts: "2026-07-16T03:54:59.000Z",
        actionDeliveryStatus: "accepted" as const,
        actionDeliveryAttempts: 1,
        actionAcceptedAt: "2026-07-16T03:55:00.000Z",
      },
    ];

    const result = snapshot(taskTree, {
      reviewApplicationGraceMs: 5 * 60_000,
      reviews,
    });
    expect(
      result.invariants.find(
        (finding) => finding.type === "review-decision-not-applied",
      ),
    ).toMatchObject({
      subject: { kind: "task", id: "decision-pending", revision: 2 },
      automaticAction: "none",
    });
  });

  test("ignores a decision older than the current terminal-review epoch", () => {
    const terminalAttempt = "a_terminal_172475799_terminal_wait_review";
    const reviewTask = task("terminal-review", "review", {
      parent_id: "project",
      revision: 2,
      trace: {
        current_attempt_id: terminalAttempt,
        terminal_wait_review_attempt_created_at: "2026-07-16T03:50:00.000Z",
        last_worker_completed_at: "2026-07-16T03:00:00.000Z",
      },
    });
    const result = snapshot(tree([reviewTask]), {
      reviewGraceMs: 15 * 60_000,
      reviews: [
        {
          taskId: "terminal-review",
          taskRevision: 2,
          attemptId: terminalAttempt,
          decision: "redo",
          ts: "2026-07-16T03:30:00.000Z",
        },
      ],
    });

    expect(result.reviews[0]).toMatchObject({
      completedAt: "2026-07-16T03:50:00.000Z",
      latestDecision: null,
      deliveryState: "within-grace",
    });
    expect(result.invariants).toEqual([]);
  });

  test("normalizes malformed legacy blockers with stable recovery keys", () => {
    const blocked = task("blocked", "blocked", {
      parent_id: "project",
      blocker: {
        category: "pipeline-run",
        waiting_for: { type: "ado.pipeline.terminal", runId: "172459471" },
      },
    });

    const first = snapshot(tree([blocked]));
    const second = snapshot(tree([blocked]));

    expect(first.conditions[0]).toMatchObject({
      causeKey: "ado.pipeline.terminal:run:172459471",
      class: "external",
      source: "legacy",
      issues: [
        "missing-condition",
        "missing-owner",
        "missing-observer",
        "missing-observation-method",
        "missing-next-check",
        "missing-fallback-at",
        "missing-fallback-action",
      ],
    });
    expect(first.invariants[0].recoveryKey).toBe(
      "blocked-condition-incomplete:blocked:0",
    );
    expect(second.invariants[0].recoveryKey).toBe(
      first.invariants[0].recoveryKey,
    );
  });

  test("uses the Condition registry instead of its blocker projection", () => {
    const taskTree = tree([
      task("verify", "blocked", {
        parent_id: "project",
        revision: 3,
        blocker: {
          condition: "compatibility projection",
          condition_id: "condition:pipeline:ado:172459471:terminal",
        },
      }),
    ]) as TaskTree & { conditions: Record<string, unknown> };
    taskTree.conditions = {
      "condition:pipeline:ado:172459471:terminal": {
        version: "project-condition-v2",
        id: "condition:pipeline:ado:172459471:terminal",
        causeKey: "pipeline:ado:172459471:terminal",
        class: "external",
        type: "pipeline.run.terminal",
        status: "open",
        backend: "ado",
        runId: "172459471",
        runUrl: "https://dev.azure.com/example/172459471",
        subject: { kind: "task", id: "verify", revision: 3 },
        owner: "ado",
        observer: "project-execution-watchdog",
        observationMethod: "exact backend observation",
        resumeCondition: "run is terminal",
        nextCheckAt: "2026-07-16T04:10:00.000Z",
        fallbackAt: "2026-07-16T06:00:00.000Z",
        fallbackAction: "escalate exact run",
      },
    };

    const result = snapshot(taskTree);
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0]).toMatchObject({
      id: "condition:pipeline:ado:172459471:terminal",
      source: "registry",
      subject: { id: "verify", revision: 3 },
      waitingFor: { backend: "ado", runId: "172459471" },
      issues: [],
    });
  });

  test("reports an overdue unacknowledged Condition fallback with a stable recovery key", () => {
    const taskTree = tree([
      task("verify", "blocked", {
        parent_id: "project",
        revision: 3,
        blocker: {
          condition: "compatibility projection",
          condition_id: "condition:pipeline:ado:172459471:terminal",
        },
      }),
    ]) as TaskTree & { conditions: Record<string, unknown> };
    taskTree.conditions = {
      "condition:pipeline:ado:172459471:terminal": {
        version: "project-condition-v2",
        id: "condition:pipeline:ado:172459471:terminal",
        causeKey: "pipeline:ado:172459471:terminal",
        class: "external",
        type: "pipeline.run.terminal",
        status: "open",
        subject: { kind: "task", id: "verify", revision: 3 },
        fallbackExecution: {
          status: "dispatched",
          attempts: 2,
          acknowledgementDueAt: "2026-07-16T03:59:59.000Z",
        },
      },
    };

    const first = snapshot(taskTree);
    const second = snapshot(taskTree);
    const finding = first.invariants.find(
      (candidate) => candidate.type === "condition-fallback-delivery-overdue",
    );

    expect(finding).toMatchObject({
      recoveryKey:
        "condition-fallback-delivery:condition:pipeline:ado:172459471:terminal:3",
      severity: "warning",
      subject: { kind: "task", id: "verify", revision: 3 },
      automaticAction: "none",
    });
    expect(
      second.invariants.find(
        (candidate) => candidate.type === "condition-fallback-delivery-overdue",
      ),
    ).toEqual(finding);
    expect(first.pendingActions).toContainEqual(
      expect.objectContaining({
        kind: "condition-fallback-delivery",
        status: "accepted",
        delivery: expect.objectContaining({ attempts: 2, maxAttempts: 3 }),
      }),
    );
  });

  test("does not report an acknowledged resolved Condition fallback as overdue", () => {
    const taskTree = tree([
      task("verify", "blocked", {
        parent_id: "project",
        revision: 3,
      }),
    ]) as TaskTree & { conditions: Record<string, unknown> };
    taskTree.conditions = {
      "condition:pipeline:ado:42:terminal": {
        version: "project-condition-v2",
        id: "condition:pipeline:ado:42:terminal",
        causeKey: "pipeline:ado:42:terminal",
        type: "pipeline.run.terminal",
        status: "resolved",
        subject: { kind: "task", id: "verify", revision: 3 },
        fallbackExecution: {
          status: "acknowledged",
          attempts: 2,
          acknowledgementDueAt: "2026-07-16T03:45:00.000Z",
          acknowledgedAt: "2026-07-16T03:50:00.000Z",
        },
      },
    };

    const result = snapshot(taskTree);
    expect(
      result.invariants.some(
        (finding) => finding.type === "condition-fallback-delivery-overdue",
      ),
    ).toBe(false);
    expect(
      result.pendingActions.some(
        (action) => action.kind === "condition-fallback-delivery",
      ),
    ).toBe(false);
  });

  test("keeps an overdue fallback visible after its Condition resolves", () => {
    const taskTree = tree([
      task("verify", "active", {
        parent_id: "project",
        revision: 3,
      }),
    ]) as TaskTree & { conditions: Record<string, unknown> };
    taskTree.conditions = {
      "condition:pipeline:ado:42:terminal": {
        version: "project-condition-v2",
        id: "condition:pipeline:ado:42:terminal",
        causeKey: "pipeline:ado:42:terminal",
        type: "pipeline.run.terminal",
        status: "resolved",
        subject: { kind: "task", id: "verify", revision: 3 },
        fallbackExecution: {
          status: "dispatched",
          attempts: 2,
          acknowledgementDueAt: "2026-07-16T03:45:00.000Z",
        },
      },
    };

    const result = snapshot(taskTree);
    expect(
      result.invariants.find(
        (finding) => finding.type === "condition-fallback-delivery-overdue",
      ),
    ).toMatchObject({ severity: "warning" });
  });

  test("escalates an overdue Condition fallback after its bounded retry budget", () => {
    const taskTree = tree([
      task("verify", "blocked", {
        parent_id: "project",
        revision: 3,
      }),
    ]) as TaskTree & { conditions: Record<string, unknown> };
    taskTree.conditions = {
      "condition:pipeline:ado:42:terminal": {
        version: "project-condition-v2",
        id: "condition:pipeline:ado:42:terminal",
        causeKey: "pipeline:ado:42:terminal",
        type: "pipeline.run.terminal",
        status: "open",
        subject: { kind: "task", id: "verify", revision: 3 },
        fallbackExecution: {
          status: "dispatched",
          attempts: 3,
          acknowledgementDueAt: "2026-07-16T03:45:00.000Z",
        },
      },
    };

    const result = snapshot(taskTree);
    expect(
      result.invariants.find(
        (finding) => finding.type === "condition-fallback-delivery-overdue",
      ),
    ).toMatchObject({ severity: "critical" });
    expect(result.pendingActions).toContainEqual(
      expect.objectContaining({
        kind: "condition-fallback-delivery",
        status: "exhausted",
      }),
    );
  });

  test("finds a resolved Condition whose subject is still blocked", () => {
    const taskTree = tree([
      task("verify", "blocked", {
        parent_id: "project",
        revision: 3,
        blocker: {
          condition: "stale compatibility projection",
          condition_id: "condition:pipeline:ado:42:terminal",
        },
      }),
    ]) as TaskTree & { conditions: Record<string, unknown> };
    taskTree.conditions = {
      "condition:pipeline:ado:42:terminal": {
        version: "project-condition-v2",
        id: "condition:pipeline:ado:42:terminal",
        causeKey: "pipeline:ado:42:terminal",
        type: "pipeline.run.terminal",
        status: "resolved",
        backend: "ado",
        runId: "42",
        subject: { kind: "task", id: "verify", revision: 3 },
      },
    };

    const result = snapshot(taskTree);
    expect(result.invariants).toContainEqual(
      expect.objectContaining({
        type: "resolved-condition-still-blocking",
        recoveryKey:
          "resolved-condition-still-blocking:condition:pipeline:ado:42:terminal:3",
        automaticAction: "reconcile-condition",
      }),
    );
  });

  test("does not reconcile a resolved Condition against a newer blocked revision", () => {
    const taskTree = tree([
      task("verify", "blocked", {
        parent_id: "project",
        revision: 4,
        blocker: { condition: "A newer unrelated prerequisite." },
      }),
    ]) as TaskTree & { conditions: Record<string, unknown> };
    taskTree.conditions = {
      "condition:pipeline:ado:42:terminal": {
        version: "project-condition-v2",
        id: "condition:pipeline:ado:42:terminal",
        causeKey: "pipeline:ado:42:terminal",
        type: "pipeline.run.terminal",
        status: "resolved",
        backend: "ado",
        runId: "42",
        subject: { kind: "task", id: "verify", revision: 3 },
      },
    };

    const result = snapshot(taskTree);
    expect(
      result.invariants.some(
        (finding) => finding.type === "resolved-condition-still-blocking",
      ),
    ).toBe(false);
  });

  test("detects stored frontier mirror drift without using it as authority", () => {
    const taskTree = tree([task("live", "active", { parent_id: "project" })], {
      context: {
        current_root_readout: {
          active_task_ids_excluding_self: ["stale"],
          review_task_ids: [],
          waiting_task_ids: [],
          runnable_task_ids: [],
        },
      },
    });
    const result = snapshot(taskTree);

    expect(result.frontier.active).toEqual(["live"]);
    expect(result.mirrorDrift.active).toEqual({
      expected: ["live"],
      actual: ["stale"],
      matches: false,
    });
  });

  test("labels the legacy 20-item frontier cap as compatible truncation", () => {
    const tasks = Array.from({ length: 21 }, (_, index) =>
      task(`blocked-${String(index).padStart(2, "0")}`, "blocked", {
        parent_id: "project",
      }),
    );
    const result = snapshot(tree(tasks));
    const comparison = compareFrontiersV2(result, {
      runnable: [],
      waiting: [],
      active: [],
      review: [],
      blocked: result.frontier.blocked.slice(0, 20),
    });

    expect(comparison.blocked).toMatchObject({
      matches: false,
      compatible: true,
      reason: "current-truncated",
      v2Only: ["blocked-20"],
      currentOnly: [],
      ignoredCurrentOnly: [],
    });

    const withLegacyStructuralParent = compareFrontiersV2(
      result,
      {
        runnable: [],
        waiting: [],
        active: [],
        review: [],
        blocked: [
          "legacy-blocked-parent",
          ...result.frontier.blocked.slice(0, 19),
        ],
      },
      { ignoredCurrentOnly: { blocked: ["legacy-blocked-parent"] } },
    );
    expect(withLegacyStructuralParent.blocked).toMatchObject({
      matches: false,
      compatible: true,
      reason: "current-truncated",
      currentOnly: [],
      ignoredCurrentOnly: ["legacy-blocked-parent"],
    });
  });

  test("the CLI capture leaves every hashed input unchanged", async () => {
    const root = await mkdtemp(join(tmpdir(), "aks-snapshot-v2-"));
    const appDir = join(root, "aks-rp-e2e.app");
    const projectDir = join(root, "aks-rp-e2e");
    await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
    await mkdir(projectDir, { recursive: true });
    const treePath = join(appDir, ".state", "tasks", "tree.json");
    const reviewedAt = new Date().toISOString();
    await writeFile(
      treePath,
      `${JSON.stringify(
        tree([
          task("ready", "backlog", { parent_id: "project" }),
          task("review", "review", {
            parent_id: "project",
            revision: 2,
            context: { controlPlaneVersion: 2 },
            trace: {
              current_attempt_id: "attempt-review",
              last_worker_completed_at: "2026-07-16T03:30:00.000Z",
            },
          }),
        ]),
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(appDir, ".state", "task-reviewer-runs.jsonl"),
      [
        {
          ts: reviewedAt,
          result: "project.task.reviewed",
          delivery_status: "pending",
          review_id: "review-2",
          task_id: "review",
          task_revision: 2,
          attempt_id: "attempt-review",
          decision: "accept",
        },
        {
          ts: reviewedAt,
          result: "pending-action-delivery-v2",
          version: "project-pending-action-delivery-v2",
          action_key:
            "review-application-delivery:review:2:attempt-review:review-2",
          action_kind: "review-application-delivery",
          delivery_attempt: 1,
          delivery_status: "accepted",
          recorded_at: reviewedAt,
          review_id: "review-2",
          task_id: "review",
          task_revision: 2,
          attempt_id: "attempt-review",
        },
      ]
        .map((row) => JSON.stringify(row))
        .join("\n") + "\n",
      "utf8",
    );
    const before = await readFile(treePath, "utf8");

    const result = captureProjectSnapshotV2({
      appDir,
      projectDir,
      stateDbPath: join(root, "missing.db"),
      projectId: "fixture",
      json: true,
    });

    expect(result.noWriteVerification.unchanged).toBe(true);
    expect(result.noWriteVerification.readOnlyByConstruction).toBe(true);
    expect(result.noWriteVerification.interpretation).toBe("stable-inputs");
    expect(await readFile(treePath, "utf8")).toBe(before);
    expect(result.parity.runnable.matches).toBe(true);
    expect(result.healthParity.counts.matches).toBe(true);
    expect(result.snapshot.sourceMeta?.[treePath]).toMatchObject({
      available: true,
      size: before.length,
    });
    expect(result.snapshot.sourceMeta?.[treePath].fingerprint).toHaveLength(64);
    const runtime = captureRuntimeProjectSnapshotV2({
      appDir,
      treePath,
      stateDbPath: join(root, "missing.db"),
      projectId: "fixture",
    });
    expect(runtime?.snapshot.reviews).toEqual(result.snapshot.reviews);
    expect(runtime?.snapshot.pendingActions).toEqual(
      result.snapshot.pendingActions,
    );
    expect(result.snapshot.pendingActions).toContainEqual(
      expect.objectContaining({
        key: "review-application-delivery:review:2:attempt-review:review-2",
        status: "accepted",
        delivery: expect.objectContaining({ attempts: 1 }),
      }),
    );
    expect(result.snapshot.coverage).toMatchObject({
      tree: "available",
      assignments: "available",
      sessions: "unavailable",
      reviews: "available",
      controllers: "unavailable",
      controllerLiveness: "unavailable",
      delivery: "unavailable",
    });
  });
});
