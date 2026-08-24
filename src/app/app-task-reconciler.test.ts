import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TaskIntent as AppTaskIntent } from "@may-agent/sdk";
import { cacheTaskStateReads, readTaskState, saveTaskState, type TaskStateConfig } from "./app-task-store.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import {
  matchingAppTaskConditionTaskIds,
  trackAppTaskConditionEvent,
  trackAppTaskConditionEventForTasks,
} from "./app-task-condition-tracker.ts";
import { AppTaskQueue } from "./app-task-queue.ts";
import {
  associateAppTaskSession,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  acknowledgeAppTaskRecoveryAttention,
  listHandlerExecutionFailedAppTasks,
  listHandlerUnavailableAppTasks,
  listWorkspacePreparationFailedAppTasks,
  markAppTaskAttention,
  observeAppTaskIntent,
  listRunnableAppTaskQueueEntries,
  listRunnableAppTaskIds,
  readAppTaskIntent,
  readAppTaskChildContext,
  readAppTaskLiveSnapshot,
  readPendingAppTaskTrigger,
  readAppTaskTrigger,
  recordAppTaskTrigger,
  pendingAppTaskRecoveryAttention,
  appTaskQueueEntries,
  AppTaskActionStaleError,
  repairPreviousRuntimeRecoveryAttention,
  repairRunningAppTasksWithoutAttempt,
  recoverableAppTaskAttempts,
  expiredAgentSessionAppTaskAttempt,
  terminalAgentSessionAppTaskClaim,
  releaseHandlerExecutionFailedAppTask,
  releaseHandlerUnavailableAppTask,
  releaseWorkspacePreparationFailedAppTask,
  releaseInterruptedAppTaskAttempt,
  releaseLateTerminalWorkflowAppTaskAttempt,
  releaseTerminalSessionExpiredAppTaskAttempt,
  releaseStaleAppTaskResult,
  recordAppTaskAttemptSession,
  recordAppTaskAttemptWorkspace,
  renewAppTaskAttemptLease,
  taskReconciliationConfig,
} from "./app-task-reconciler.ts";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `task-reconciler-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(
      {
        root_task_id: "root",
        groups: {
          root: {
            id: "root",
            parent_id: null,
            state: "backlog",
            owner: "branch-owner",
            children: ["operations"],
          },
          operations: {
            id: "operations",
            parent_id: "root",
            state: "backlog",
            children: [],
          },
        },
        resources: {
          "categorized-task": {
            metadata: {
              id: "categorized-task",
              generation: 1,
              resourceVersion: 1,
            },
            spec: {
              parentId: "operations",
              outcome: "Categorized bounded work",
              acceptance: ["The categorized work converges"],
              mode: "achieve",
              category: "domain",
            },
            status: {
              observedGeneration: 0,
              phase: "pending",
              updatedAt: new Date().toISOString(),
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  const config = taskReconciliationConfig({
    appDir,
    projectDir: appDir,
    owner: "app-owner",
    maxConcurrent: 3,
  });
  return { root, appDir, config };
}

function intent(mode: "achieve" | "maintain" = "achieve") {
  return {
    id: mode === "achieve" ? "evaluate:session-1" : "pipeline-monitor",
    parentId: "operations",
    outcome: mode === "achieve" ? "Evaluate session 1" : "Keep the pipeline observable",
    acceptance: ["The workflow returns evidence"],
    mode,
    workflow: "known-workflow",
    input: { sessionId: "session-1" },
  } as const;
}

function declareAndClaimTask(
  config: TaskStateConfig,
  input: {
    intent: AppTaskIntent;
    appAgent: string;
    handler: string;
    reason?: string;
    trigger?: Record<string, unknown>;
    isAgentRunnable?: (agent: string) => boolean;
  },
) {
  const observed = observeAppTaskIntent(config, {
    intent: input.intent,
    appAgent: input.appAgent,
    trigger: input.trigger,
  });
  if (observed.kind === "completed") return observed;
  return claimObservedAppTask(config, {
    taskId: observed.taskId,
    appAgent: input.appAgent,
    handler: input.handler,
    reason: input.reason,
    isAgentRunnable: input.isAgentRunnable,
  });
}

function reclaimInterruptedSession(
  config: TaskStateConfig,
  root: string,
  sessionId: string,
  transcript: unknown[],
  checkpoint?: Record<string, unknown>,
) {
  const claim = declareAndClaimTask(config, {
    intent: intent(),
    appAgent: "app-owner",
    handler: "workflow:known-workflow",
  });
  if (claim.kind !== "claimed") throw new Error("expected initial claim");
  expect(recordAppTaskAttemptSession(config, claim, sessionId)).toBe(true);

  const sessionPath = join(root, ".state", "sessions", sessionId);
  mkdirSync(sessionPath, { recursive: true });
  writeFileSync(join(sessionPath, "meta.json"), `${JSON.stringify({ error: "previous runtime interrupted" })}\n`);
  writeFileSync(join(sessionPath, "result.json"), `${JSON.stringify({ status: "interrupted" })}\n`);
  writeFileSync(join(sessionPath, "session.jsonl"), transcript.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  if (checkpoint) {
    const checkpointDir = join(root, ".state", "checkpoints");
    mkdirSync(checkpointDir, { recursive: true });
    writeFileSync(join(checkpointDir, `${sessionId}.jsonl`), `${JSON.stringify(checkpoint)}\n`);
  }

  const interrupted = readTaskState(config);
  interrupted.attempts![claim.attemptId].runtimeId = "previous-runtime";
  saveTaskState(config, interrupted);
  expect(releaseInterruptedAppTaskAttempt(config, claim.taskId, "previous runtime stopped").released).toBe(true);

  const reclaimed = declareAndClaimTask(config, {
    intent: intent(),
    appAgent: "app-owner",
    handler: "workflow:known-workflow",
    reason: `attempt-recovery:${claim.taskId}`,
  });
  if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");
  return { reclaimed, sessionPath };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("App task reconciler state", () => {
  it("fences a fresh canonical attempt before its first Agent session", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const attempt = readTaskState(config).attempts?.[claim.attemptId];
    expect(attempt).toMatchObject({
      state: "running",
      runtimeId: expect.any(String),
      lease: {
        id: expect.any(String),
        version: 1,
        runtimeId: expect.any(String),
      },
    });
    expect(attempt?.sessionId).toBeUndefined();
    expect(attempt?.lease?.sessionId).toBeUndefined();
    expect(Date.parse(attempt?.lease?.expiresAt ?? "")).toBeGreaterThan(Date.now());
  });

  it("renews only the current bounded workflow attempt lease", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const before = readTaskState(config).attempts?.[claim.attemptId];
    const renewalAt = Date.parse(before?.lease?.lastActivityAt ?? "") + 500;
    expect(renewAppTaskAttemptLease(config, claim, renewalAt)).toBe(true);

    const renewed = readTaskState(config).attempts?.[claim.attemptId];
    expect(renewed?.lease).toMatchObject({
      id: before?.lease?.id,
      version: 2,
      runtimeId: before?.runtimeId,
      lastActivityAt: new Date(renewalAt).toISOString(),
    });
    expect(Date.parse(renewed?.lease?.expiresAt ?? "")).toBeGreaterThan(Date.parse(before?.lease?.expiresAt ?? ""));

    const staleClaim = { ...claim, attemptId: `${claim.attemptId}-stale` };
    expect(renewAppTaskAttemptLease(config, staleClaim, renewalAt)).toBe(false);
  });

  it("keeps an achieve task live when its handler revises the same task generation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const result = completeAppTask(config, claim, {
      summary: "Bound the newly observed cleanup proof",
      evidence: ["cleanup-proof:resource-group-absent"],
      actions: [
        {
          kind: "update-task",
          taskId: claim.taskId,
          expectedGeneration: claim.generation,
          workflow: "known-workflow",
          input: {
            sessionId: "session-1",
            cleanupProof: "resource-group-absent",
          },
        },
      ],
    });

    expect(result).toMatchObject({
      status: "applied",
      actionsApplied: [`updated ${claim.taskId}`],
      dependentTaskIds: [claim.taskId],
      taskContinues: true,
    });
    const tree = readTaskState(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      metadata: { generation: claim.generation + 1 },
      spec: {
        workflow: "known-workflow",
        input: {
          sessionId: "session-1",
          cleanupProof: "resource-group-absent",
        },
      },
      status: { phase: "pending" },
    });
    expect(tree.attempts?.[claim.attemptId]?.state).toBe("completed");
    expect(tree.receipts?.[claim.taskId]).toBeUndefined();
  });

  it("keeps a maintain task pending when a durable wake arrives during its attempt", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      recordAppTaskTrigger(config, claim.taskId, {
        type: "sample.continue",
        reason: "bounded-stage-complete",
      }),
    ).toEqual({ kind: "recorded" });

    expect(
      completeAppTask(config, claim, {
        summary: "Checkpointed one bounded stage",
        evidence: ["checkpoint:stage-1"],
      }),
    ).toMatchObject({
      status: "applied",
      dependentTaskIds: [claim.taskId],
      taskContinues: true,
    });
    const tree = readTaskState(config);
    expect(tree.resources?.[claim.taskId]?.status.phase).toBe("pending");
    expect(tree.taskTriggers?.[claim.taskId]?.event).toMatchObject({
      type: "sample.continue",
    });
    expect(tree.attempts?.[claim.attemptId]?.state).toBe("completed");
  });

  it("keeps an achieve task live until events that arrived during the attempt are reconciled", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:worker",
      trigger: { type: "sample.requested", eventId: 100 },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      recordAppTaskTrigger(config, claim.taskId, {
        type: "sample.corrected",
        eventId: 101,
        data: { correction: "use the revised evidence" },
      }),
    ).toEqual({ kind: "recorded" });

    expect(
      completeAppTask(config, claim, {
        summary: "Satisfied the outcome observed before the correction",
        evidence: ["result:initial"],
      }),
    ).toMatchObject({
      status: "applied",
      dependentTaskIds: [claim.taskId],
      taskContinues: true,
    });

    const tree = readTaskState(config);
    expect(tree.receipts?.[claim.taskId]).toBeUndefined();
    expect(tree.resources?.[claim.taskId]?.status.phase).toBe("pending");
    const next = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "workflow:worker",
      reason: "event",
    });
    expect(next).toMatchObject({
      kind: "claimed",
      events: [
        {
          event: {
            type: "sample.corrected",
            eventId: 101,
          },
        },
      ],
      eventsTruncated: false,
    });
  });

  it("consumes only live events incorporated into the accepted result", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "executor:reviewer",
      trigger: { type: "sample.requested", eventId: 100 },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    recordAppTaskTrigger(config, claim.taskId, { type: "sample.corrected", eventId: 101 });
    recordAppTaskTrigger(config, claim.taskId, { type: "sample.follow-up", eventId: 102 });

    expect(
      completeAppTask(config, claim, {
        summary: "Incorporated the correction but not the later follow-up",
        evidence: ["event:101"],
        acceptedLiveEventIds: [101],
      }),
    ).toMatchObject({ status: "applied", taskContinues: true });
    expect(readTaskState(config).taskTriggers?.[claim.taskId]?.events?.map((entry) => entry.event.eventId)).toEqual([
      102,
    ]);
  });

  it("does not apply task actions across newer unaccepted evidence", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "executor:reviewer",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    recordAppTaskTrigger(config, claim.taskId, {
      type: "sample.corrected",
      eventId: 101,
      data: { state: "corrected" },
    });
    const action = {
      kind: "create-task" as const,
      id: "work/from-stale-result",
      parentId: claim.taskId,
      outcome: "Act on the latest correction",
      acceptance: ["The correction is handled"],
      mode: "achieve" as const,
      outputs: [],
    };

    expect(() =>
      completeAppTask(config, claim, {
        summary: "Act on the older snapshot",
        evidence: ["snapshot:old"],
        actions: [action],
      }),
    ).toThrow("newer Task evidence is pending");
    expect(readTaskState(config).resources?.[action.id]).toBeUndefined();

    expect(
      completeAppTask(config, claim, {
        summary: "Act on the accepted correction",
        evidence: ["event:101"],
        actions: [action],
        acceptedLiveEventIds: [101],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: [`created ${action.id}`] });
  });

  it("claims an ordered bounded event prefix without losing the remaining wakes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:worker",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    for (let index = 1; index <= 35; index += 1) {
      expect(
        recordAppTaskTrigger(config, first.taskId, {
          type: "sample.observed",
          eventId: index,
          data: { index },
        }),
      ).toEqual({ kind: "recorded" });
    }
    expect(completeAppTask(config, first, { summary: "Observed the initial state" }).taskContinues).toBe(true);

    const second = claimObservedAppTask(config, {
      taskId: first.taskId,
      appAgent: "app-owner",
      handler: "workflow:worker",
      reason: "event",
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");
    expect(second.events.map((entry) => entry.event.eventId)).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 1),
    );
    expect(second.eventsTruncated).toBe(true);
    expect(readTaskState(config).taskTriggers?.[first.taskId]?.events?.map((entry) => entry.event.eventId)).toEqual([
      33, 34, 35,
    ]);
  });

  it("rejects a no-op or mixed self-update", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "No effective correction",
        evidence: ["reviewed-current-input"],
        actions: [
          {
            kind: "update-task",
            taskId: claim.taskId,
            expectedGeneration: claim.generation,
            input: { sessionId: "session-1" },
          },
        ],
      }),
    ).toThrow("must change task execution intent");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "Mixed correction",
        evidence: ["reviewed-current-input"],
        actions: [
          {
            kind: "update-task",
            taskId: claim.taskId,
            expectedGeneration: claim.generation,
            input: { sessionId: "session-2" },
          },
          {
            kind: "create-task",
            id: "unrelated-followup",
            parentId: "operations",
            outcome: "Do unrelated work",
            mode: "achieve",
            outputs: [],
            acceptance: ["The unrelated work completes"],
          },
        ],
      }),
    ).toThrow("must be the only reconciliation action");
  });

  it("carries observed workspace lineage from the attempt into its completion receipt", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const workspace = {
      kind: "task-worktree" as const,
      path: "/tmp/worktrees/example",
      baseRef: "origin/dev",
      baseCommit: "a".repeat(40),
      branch: "task/example",
      headCommit: "b".repeat(40),
      disposition: "branch-retained" as const,
    };

    expect(recordAppTaskAttemptWorkspace(config, claim, workspace)).toBe(true);
    expect(completeAppTask(config, claim, { summary: "completed in isolated workspace" }).status).toBe("applied");
    expect(readTaskState(config).receipts?.[claim.taskId]?.workspace).toEqual(workspace);
  });
  it("rejects a missing or completed parent instead of creating an orphan", () => {
    const { config } = fixture();

    expect(() =>
      observeAppTaskIntent(config, {
        intent: {
          ...intent(),
          id: "work/orphan",
          parentId: "already-absorbed-parent",
        },
        appAgent: "app-owner",
      }),
    ).toThrow("parent does not exist in the live graph");

    expect(readAppTaskIntent(config, "work/orphan")).toBeNull();
  });

  it("selects a CLI adapter without creating a second Task lifecycle", () => {
    const { config } = fixture();
    const cliIntent: AppTaskIntent = {
      ...intent(),
      id: "work/codex",
      workflow: undefined,
      executor: "codex",
    };
    observeAppTaskIntent(config, { intent: cliIntent, appAgent: "app-owner" });

    expect(
      claimObservedAppTask(config, {
        taskId: cliIntent.id,
        appAgent: "app-owner",
        handler: "auto",
      }),
    ).toMatchObject({ kind: "claimed", handler: "executor:codex" });
  });

  it("accepts canonical Task agent selection and retains it in Host state", () => {
    const { config } = fixture();
    const agentIntent: AppTaskIntent = {
      ...intent(),
      id: "work/managed-agent",
      agent: "specialist",
      workflow: undefined,
      executor: "agent",
    };
    observeAppTaskIntent(config, { intent: agentIntent, appAgent: "app-owner" });

    expect(readAppTaskIntent(config, agentIntent.id)).toMatchObject({ owner: "specialist" });

    expect(
      claimObservedAppTask(config, {
        taskId: agentIntent.id,
        appAgent: "app-owner",
        handler: "auto",
      }),
    ).toMatchObject({ kind: "claimed", agent: "specialist", handler: "agent:specialist" });
  });

  it("rejects conflicting or empty Task agent selection before persistence", () => {
    const { config } = fixture();
    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: "work/conflict", agent: "one", owner: "two" },
        appAgent: "app-owner",
      }),
    ).toThrow("conflicting agent and legacy owner");
    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: "work/empty-agent", agent: " " },
        appAgent: "app-owner",
      }),
    ).toThrow("agent must be a non-empty string");
    expect(readAppTaskIntent(config, "work/conflict")).toBeNull();
    expect(readAppTaskIntent(config, "work/empty-agent")).toBeNull();
  });

  it("rejects ambiguous workflow and CLI executor intent", () => {
    const { config } = fixture();
    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: "work/ambiguous", executor: "claude" },
        appAgent: "app-owner",
      }),
    ).toThrow("cannot configure both workflow and executor");
  });

  it("lists pending and explicit agent handoff tasks but keeps unavailable workflows asleep", () => {
    const { config } = fixture();
    const attentionIntent = {
      ...intent(),
      id: "work/attention",
      outcome: "Needs owner review",
    };
    const waitingIntent = {
      ...intent(),
      id: "work/waiting",
      outcome: "Waits for evidence",
    };
    const pendingIntent = {
      ...intent(),
      id: "work/pending",
      outcome: "Ready work",
    };
    const unavailableIntent = {
      ...intent(),
      id: "work/unavailable",
      outcome: "Run only after the workflow binding is repaired",
      workflow: "missing-workflow",
    };

    observeAppTaskIntent(config, { intent: attentionIntent, appAgent: "app-owner" });
    const attentionClaim = claimObservedAppTask(config, {
      taskId: attentionIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (attentionClaim.kind !== "claimed") throw new Error("expected attention claim");
    markAppTaskAttention(config, attentionClaim, {
      summary: "owner must decide",
      reason: "needs-agent",
    });

    observeAppTaskIntent(config, { intent: unavailableIntent, appAgent: "app-owner" });
    const unavailableClaim = claimObservedAppTask(config, {
      taskId: unavailableIntent.id,
      appAgent: "app-owner",
      handler: "workflow:missing-workflow",
      reason: "task-controller",
    });
    if (unavailableClaim.kind !== "claimed") throw new Error("expected unavailable claim");
    markAppTaskAttention(config, unavailableClaim, {
      summary: "workflow is not installed",
      reason: "HandlerUnavailable",
    });

    observeAppTaskIntent(config, { intent: waitingIntent, appAgent: "app-owner" });
    const waitingClaim = claimObservedAppTask(config, {
      taskId: waitingIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (waitingClaim.kind !== "claimed") throw new Error("expected waiting claim");
    deferAppTask(config, waitingClaim, {
      disposition: "waiting",
      summary: "waiting for evidence",
      conditions: [
        {
          id: "evidence-window",
          type: "session.end",
          subject: "session:s_evidence",
          expected: "done",
        },
      ],
    });

    observeAppTaskIntent(config, { intent: pendingIntent, appAgent: "app-owner" });
    const maintainClaim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (maintainClaim.kind !== "claimed") throw new Error("expected maintain claim");
    completeAppTask(config, maintainClaim, { summary: "monitor converged" });

    expect(listRunnableAppTaskIds(config)).toEqual(["categorized-task", "work/attention", "work/pending"]);
    expect(listHandlerUnavailableAppTasks(config, "app-owner")).toEqual([
      { taskId: "work/unavailable", agent: "branch-owner", workflow: "missing-workflow" },
    ]);

    observeAppTaskIntent(config, {
      intent: attentionIntent,
      appAgent: "app-owner",
      trigger: { type: "manual.wake", data: { reason: "fresh owner evidence" } },
    });
    expect(listRunnableAppTaskIds(config)).toEqual(["work/attention", "categorized-task", "work/pending"]);

    trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "s_evidence",
      status: "done",
    });
    expect(listRunnableAppTaskIds(config)).toEqual([
      "work/waiting",
      "work/attention",
      "categorized-task",
      "work/pending",
    ]);

    expect(releaseHandlerUnavailableAppTask(config, "work/unavailable")).toBe(true);
    expect(listRunnableAppTaskIds(config)).toEqual([
      "work/waiting",
      "work/attention",
      "categorized-task",
      "work/pending",
      "work/unavailable",
    ]);
  });

  it("lists and releases only structured workspace preparation failures for the current generation", () => {
    const { config } = fixture();
    const workspaceIntent = {
      ...intent(),
      id: "work/workspace-failed",
      outcome: "Resume a task workspace",
      workflow: "workspace-worker",
    };
    observeAppTaskIntent(config, { intent: workspaceIntent, appAgent: "app-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: workspaceIntent.id,
      appAgent: "app-owner",
      handler: "workflow:workspace-worker",
      reason: "task-controller",
    });
    if (claim.kind !== "claimed") throw new Error("expected workspace claim");
    recordAppTaskAttemptWorkspace(config, claim, {
      kind: "task-worktree",
      path: "/tmp/workspace-failed",
      baseRef: "origin/dev",
      baseCommit: "base",
      branch: "task/workspace-failed",
      headCommit: "head",
      disposition: "active",
    });
    markAppTaskAttention(config, claim, {
      summary: "workspace preparation failed",
      reason: "WorkspacePreparationFailed",
    });

    const cliIntent = {
      ...intent(),
      id: "work/cli-workspace-failed",
      outcome: "Resume a CLI task workspace",
      workflow: undefined,
      executor: "codex" as const,
    };
    observeAppTaskIntent(config, { intent: cliIntent, appAgent: "app-owner" });
    const cliClaim = claimObservedAppTask(config, {
      taskId: cliIntent.id,
      appAgent: "app-owner",
      handler: "cli:codex",
      reason: "task-controller",
    });
    if (cliClaim.kind !== "claimed") throw new Error("expected CLI workspace claim");
    markAppTaskAttention(config, cliClaim, {
      summary: "CLI workspace preparation failed",
      reason: "WorkspacePreparationFailed",
    });

    expect(listWorkspacePreparationFailedAppTasks(config, "app-owner")).toEqual([
      {
        taskId: "work/cli-workspace-failed",
        generation: 1,
        agent: "branch-owner",
        executor: "codex",
      },
      {
        taskId: "work/workspace-failed",
        generation: 1,
        agent: "branch-owner",
        workflow: "workspace-worker",
        previous: expect.objectContaining({ path: "/tmp/workspace-failed" }),
      },
    ]);
    expect(releaseWorkspacePreparationFailedAppTask(config, workspaceIntent.id, 2)).toBe(false);
    expect(releaseWorkspacePreparationFailedAppTask(config, workspaceIntent.id, 1)).toBe(true);
    expect(readTaskState(config).resources?.[workspaceIntent.id].status.phase).toBe("pending");
  });

  it("separates desired-state observation from attempt claiming", () => {
    const { config } = fixture();
    expect(
      observeAppTaskIntent(config, {
        intent: intent("maintain"),
        appAgent: "app-owner",
        trigger: { type: "pipeline.changed", data: { project: "sample" } },
      }),
    ).toMatchObject({ kind: "observed", taskId: "pipeline-monitor", generation: 1, changed: true });

    const observedTree = readTaskState(config);
    expect(observedTree.tasks["pipeline-monitor"]).toMatchObject({
      state: "backlog",
      revision: 1,
    });
    expect(observedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { id: "pipeline-monitor", generation: 1, resourceVersion: 1 },
      spec: { outcome: "Keep the pipeline observable", mode: "maintain" },
      status: { observedGeneration: 0, phase: "pending" },
    });
    expect(readAppTaskIntent(config, "pipeline-monitor")).toEqual(intent("maintain"));

    const claim = claimObservedAppTask(config, {
      taskId: "pipeline-monitor",
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "queue",
    });
    expect(claim).toMatchObject({ kind: "claimed", taskId: "pipeline-monitor", generation: 1 });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const claimedTree = readTaskState(config);
    expect(claimedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: { phase: "running", currentAttemptId: claim.attemptId },
    });
    expect(claimedTree.attempts?.[claim.attemptId]).toMatchObject({
      metadata: { id: claim.attemptId, resourceVersion: 1 },
      taskId: "pipeline-monitor",
      taskGeneration: 1,
      state: "running",
      handler: "workflow:known-workflow",
    });
    expect(claimedTree.attempts?.[claim.attemptId]).toMatchObject({
      reason: "queue",
      events: [{ event: { type: "pipeline.changed" } }],
    });
    expect(claimedTree.attempts?.[claim.attemptId]?.trigger).toBeUndefined();
    expect(claimedTree.tasks["pipeline-monitor"].trace?.reconciliation).toBeUndefined();
  });

  it("orders runnable tasks by declared priority before lower-priority work", () => {
    const { config } = fixture();
    for (const [id, priority] of [
      ["work/p2", "P2"],
      ["work/p0-z", "P0"],
      ["work/p1", "P1"],
      ["work/p0-a", "P0"],
    ] as const) {
      observeAppTaskIntent(config, {
        intent: { ...intent("achieve"), id, priority },
        appAgent: "app-owner",
      });
    }

    expect(listRunnableAppTaskIds(config)).toEqual([
      "work/p0-z",
      "work/p0-a",
      "work/p1",
      "categorized-task",
      "work/p2",
    ]);
  });

  it("prefers older ready work over newer peers within the same priority", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/a-newer", priority: "P2" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/z-older", priority: "P2" },
      appAgent: "app-owner",
    });

    const tree = readTaskState(config);
    if (!tree.resources?.["work/a-newer"] || !tree.resources?.["work/z-older"]) {
      throw new Error("expected runnable resources");
    }
    tree.resources["work/a-newer"].status.updatedAt = "2026-07-25T10:00:00.000Z";
    tree.resources["work/z-older"].status.updatedAt = "2026-07-25T09:00:00.000Z";
    saveTaskState(config, tree);

    const runnable = listRunnableAppTaskIds(config);
    expect(runnable.indexOf("work/z-older")).toBeLessThan(runnable.indexOf("work/a-newer"));
  });

  it("ages ready work toward P1 without erasing the explicit P0 boundary", () => {
    const { config } = fixture();
    for (const [id, priority] of [
      ["work/fresh-p0", "P0"],
      ["work/aged-p1", "P1"],
      ["work/aged-p2", "P2"],
      ["work/aged-p3", "P3"],
      ["work/fresh-p1", "P1"],
    ] as const) {
      observeAppTaskIntent(config, {
        intent: { ...intent("achieve"), id, priority },
        appAgent: "app-owner",
      });
    }

    const tree = readTaskState(config);
    const nowMs = Date.now();
    for (const [id, ageMinutes] of [
      ["work/aged-p1", 5],
      ["work/aged-p2", 10],
      ["work/aged-p3", 15],
    ] as const) {
      const resource = tree.resources?.[id];
      if (!resource) throw new Error(`expected ${id}`);
      resource.status.updatedAt = new Date(nowMs - ageMinutes * 60_000 - 1_000).toISOString();
    }
    saveTaskState(config, tree);

    const entries = listRunnableAppTaskQueueEntries(config);
    expect(entries.filter((entry) => entry.taskId.startsWith("work/aged-"))).toEqual([
      { taskId: "work/aged-p3", options: { front: false, priority: "P1", lane: "normal" } },
      { taskId: "work/aged-p2", options: { front: false, priority: "P1", lane: "normal" } },
      { taskId: "work/aged-p1", options: { front: false, priority: "P1", lane: "normal" } },
    ]);
    expect(entries.find((entry) => entry.taskId === "work/fresh-p1")?.options.priority).toBe("P1");
  });

  it("uses persisted age when enqueuing selected task IDs", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/aged-p2", priority: "P2" },
      appAgent: "app-owner",
    });
    const tree = readTaskState(config);
    const resource = tree.resources?.["work/aged-p2"];
    if (!resource) throw new Error("expected aged resource");
    resource.status.updatedAt = new Date(Date.now() - 10 * 60_000 - 1_000).toISOString();
    saveTaskState(config, tree);

    expect(appTaskQueueEntries(config, ["work/aged-p2"])).toEqual([
      { taskId: "work/aged-p2", options: { front: false, priority: "P1", lane: "normal" } },
    ]);
  });

  it("ages triggered work from when it became ready instead of its old waiting status", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/fresh-trigger-p2", priority: "P2" },
      appAgent: "app-owner",
      trigger: { type: "repo.ref.changed", data: { ref: "origin/dev" } },
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/aged-trigger-p2", priority: "P2" },
      appAgent: "app-owner",
      trigger: { type: "repo.ref.changed", data: { ref: "origin/dev" } },
    });

    const tree = readTaskState(config);
    const oldStatus = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const oldTrigger = new Date(Date.now() - 10 * 60_000 - 1_000).toISOString();
    for (const id of ["work/fresh-trigger-p2", "work/aged-trigger-p2"]) {
      const resource = tree.resources?.[id];
      if (!resource) throw new Error(`expected ${id}`);
      resource.status.updatedAt = oldStatus;
    }
    const agedTrigger = tree.taskTriggers?.["work/aged-trigger-p2"];
    if (!agedTrigger) throw new Error("expected persisted trigger");
    agedTrigger.observedAt = oldTrigger;
    saveTaskState(config, tree);

    const entries = listRunnableAppTaskQueueEntries(config);
    expect(entries.find((entry) => entry.taskId === "work/fresh-trigger-p2")).toEqual({
      taskId: "work/fresh-trigger-p2",
      options: { front: true, priority: "P2", lane: "normal" },
    });
    expect(entries.find((entry) => entry.taskId === "work/aged-trigger-p2")).toEqual({
      taskId: "work/aged-trigger-p2",
      options: { front: true, priority: "P1", lane: "normal" },
    });
  });

  it("schedules an unresolved direct project comment before autonomous priority backlog", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/autonomous-p0", priority: "P0" },
      appAgent: "app-owner",
      trigger: {
        type: "pipeline-run.state",
        data: { runId: "99", status: "completed", result: "succeeded" },
      },
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review", priority: "P1" },
      appAgent: "app-owner",
      trigger: {
        type: "project.comment.created",
        eventId: 42,
        source: "human",
        data: { comment: "Review current project direction" },
      },
    });

    expect(listRunnableAppTaskIds(config).slice(0, 2)).toEqual(["runtime/owner-review", "work/autonomous-p0"]);
    const entries = listRunnableAppTaskQueueEntries(config).slice(0, 2);
    expect(entries).toEqual([
      { taskId: "runtime/owner-review", options: { front: true, priority: "P0", lane: "human" } },
      { taskId: "work/autonomous-p0", options: { front: true, priority: "P0", lane: "normal" } },
    ]);
    const queue = new AppTaskQueue(1);
    for (const entry of entries) queue.enqueue(entry.taskId, entry.options);
    expect(queue.take()).toBe("runtime/owner-review");
  });

  it("keeps an unresolved human task control ahead of a later automated wake", () => {
    const { config } = fixture();
    const ownerReview = { ...intent("maintain"), id: "runtime/owner-review", priority: "P1" as const };
    const humanComment = {
      type: "project.comment.created",
      eventId: 5157130,
      source: "human",
      data: { comment: "Finish all 79 source lanes and all 82 mapped specs" },
    };

    observeAppTaskIntent(config, {
      intent: ownerReview,
      appAgent: "app-owner",
      trigger: humanComment,
    });
    recordAppTaskTrigger(config, ownerReview.id, {
      type: "metric.breach",
      eventId: 5157466,
      source: "runtime-metrics",
      reason: "master-validation-product-issue",
      data: { specId: "spec.network-isolated.byo-acr-outbound-none" },
    });

    expect(readAppTaskTrigger(config, ownerReview.id)).toEqual(humanComment);
    expect(appTaskQueueEntries(config, [ownerReview.id])).toEqual([
      { taskId: ownerReview.id, options: { front: true, priority: "P0", lane: "human" } },
    ]);
    expect(listRunnableAppTaskIds(config)[0]).toBe(ownerReview.id);
  });

  it("retains trusted human scheduling origin on the admitted task resource", () => {
    const { config } = fixture();
    const humanTask = { ...intent("achieve"), id: "conversation/request-42", priority: "P0" as const };
    observeAppTaskIntent(config, {
      intent: humanTask,
      appAgent: "app-owner",
      trigger: {
        type: "app.task.requested",
        source: "human",
        data: {
          request: { id: "request-42", source: { kind: "human", id: "message-42" } },
        },
      },
    });

    expect(readTaskState(config).resources?.[humanTask.id]?.status.lane).toBe("human");
    expect(appTaskQueueEntries(config, [humanTask.id])).toEqual([
      {
        taskId: humanTask.id,
        options: { front: true, priority: "P0", lane: "human" },
      },
    ]);
  });

  it("schedules untriggered P0 before triggered P2 (priority over trigger presence)", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/new-p0", priority: "P0" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/live-result-p2", priority: "P2" },
      appAgent: "app-owner",
      trigger: {
        type: "pipeline-run.state",
        data: { runId: "42", status: "completed", result: "succeeded" },
      },
    });

    expect(listRunnableAppTaskIds(config).slice(0, 2)).toEqual(["work/new-p0", "work/live-result-p2"]);
    expect(listRunnableAppTaskQueueEntries(config).slice(0, 2)).toEqual([
      {
        taskId: "work/new-p0",
        options: { front: false, priority: "P0", lane: "normal" },
      },
      {
        taskId: "work/live-result-p2",
        options: { front: true, priority: "P2", lane: "normal" },
      },
    ]);
  });

  it("uses trigger as tiebreak within same priority", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/untriggered-p1", priority: "P1" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/triggered-p1", priority: "P1" },
      appAgent: "app-owner",
      trigger: {
        type: "repo.ref.changed",
        data: { ref: "origin/dev" },
      },
    });

    const ids = listRunnableAppTaskIds(config);
    const triggeredIdx = ids.indexOf("work/triggered-p1");
    const untriggeredIdx = ids.indexOf("work/untriggered-p1");
    expect(triggeredIdx).toBeLessThan(untriggeredIdx);
  });

  it("P0 untriggered beats stream of triggered P1s (priority inversion regression)", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "ops/critical-p0", priority: "P0" },
      appAgent: "app-owner",
    });
    for (let i = 0; i < 5; i++) {
      observeAppTaskIntent(config, {
        intent: { ...intent("achieve"), id: `work/triggered-p1-${i}`, priority: "P1" },
        appAgent: "app-owner",
        trigger: {
          type: "repo.ref.changed",
          data: { ref: `origin/cleanup-${i}` },
        },
      });
    }
    // Also add a direct comment task to confirm it still wins over everything
    observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), id: "runtime/comment-task", priority: "P1" },
      appAgent: "app-owner",
      trigger: {
        type: "project.comment.created",
        data: { comment: "Please review" },
      },
    });

    const ids = listRunnableAppTaskIds(config);
    // Direct comment wins first
    expect(ids[0]).toBe("runtime/comment-task");
    // P0 is next, before all triggered P1s
    expect(ids[1]).toBe("ops/critical-p0");
    // All triggered P1s come after
    for (let i = 0; i < 5; i++) {
      expect(ids.indexOf(`work/triggered-p1-${i}`)).toBeGreaterThan(1);
    }
  });

  it("keeps triggered work behind unresolved dependencies during passive resync", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: { ...intent("achieve"), id: "work/dependency" },
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: {
        ...intent("achieve"),
        id: "work/dependent",
        dependsOn: ["work/dependency"],
      },
      appAgent: "app-owner",
      trigger: { type: "pipeline.completed", data: { runId: "42" } },
    });

    expect(listRunnableAppTaskIds(config)).toContain("work/dependency");
    expect(listRunnableAppTaskIds(config)).not.toContain("work/dependent");
    expect(readAppTaskTrigger(config, "work/dependent")).toEqual({
      type: "pipeline.completed",
      data: { runId: "42" },
    });
  });

  it("persists the exact Condition observation as the next attempt trigger", () => {
    const { config } = fixture();
    const waitingIntent = {
      ...intent(),
      id: "work/condition-trigger",
      outcome: "Continue after the exact session observation",
      category: "domain",
    };
    observeAppTaskIntent(config, { intent: waitingIntent, appAgent: "app-owner" });
    const first = claimObservedAppTask(config, {
      taskId: waitingIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected initial claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for session",
      conditions: [
        {
          id: "session-terminal:s_condition",
          type: "session.end",
          subject: "session:s_condition",
          expected: "done",
        },
      ],
    });

    const event = {
      type: "session.end",
      sessionId: "s_condition",
      status: "done",
      evidence: "session completed cleanly",
    };
    const [wake] = trackAppTaskConditionEvent(config, event);
    expect(wake?.taskId).toBe(waitingIntent.id);

    expect(readAppTaskTrigger(config, waitingIntent.id)).toEqual(event);
    expect(appTaskQueueEntries(config, [waitingIntent.id])).toEqual([
      {
        taskId: waitingIntent.id,
        options: { front: true, priority: "P0", lane: "normal" },
      },
    ]);
    expect(readAppTaskIntent(config, waitingIntent.id)?.category).toBe("domain");
    const resumed = claimObservedAppTask(config, {
      taskId: waitingIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    expect(resumed.intent.category).toBe("domain");
    expect(resumed.trigger).toEqual(event);
    const persistedAttempt = readTaskState(config).attempts?.[resumed.attemptId];
    expect(persistedAttempt?.events?.[0]?.event).toEqual(event);
    expect(persistedAttempt?.trigger).toBeUndefined();
  });

  it("preflights Condition routes without mutation and admits only selected exact tasks", () => {
    const { config } = fixture();
    for (const taskId of ["work/first", "work/second"]) {
      observeAppTaskIntent(config, {
        intent: { ...intent(), id: taskId },
        appAgent: "app-owner",
      });
      const claim = claimObservedAppTask(config, {
        taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (claim.kind !== "claimed") throw new Error(`expected claim for ${taskId}`);
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting for shared observation",
        conditions: [
          {
            id: `shared-ready:${taskId}`,
            type: "provider.state",
            subject: "provider:shared",
            expected: "ready",
          },
        ],
      });
    }
    const event = { type: "provider.state", provider: "shared", state: "ready" };

    const conditionRoutesPath = projectRuntimePaths(config.appDir).taskConditionRoutesPath;
    expect(JSON.parse(readFileSync(conditionRoutesPath, "utf-8"))).toMatchObject({
      schemaVersion: 1,
      eventTypes: {
        "provider.state": [{ taskIds: ["work/first"] }, { taskIds: ["work/second"] }],
      },
    });

    expect(matchingAppTaskConditionTaskIds(config, event)).toEqual(["work/first", "work/second"]);
    expect(readAppTaskTrigger(config, "work/first")).toBeUndefined();
    expect(readAppTaskTrigger(config, "work/second")).toBeUndefined();
    expect(matchingAppTaskConditionTaskIds(config, event, ["work/first"])).toEqual(["work/first"]);

    rmSync(conditionRoutesPath);
    expect(matchingAppTaskConditionTaskIds(config, event)).toEqual(["work/first", "work/second"]);
    expect(existsSync(conditionRoutesPath)).toBe(true);

    expect(trackAppTaskConditionEventForTasks(config, event, ["work/first"])).toEqual([
      { conditionId: "shared-ready:work/first", taskId: "work/first" },
    ]);
    expect(readAppTaskTrigger(config, "work/first")).toEqual(event);
    expect(readAppTaskTrigger(config, "work/second")).toBeUndefined();
    expect(readTaskState(config).conditions?.["shared-ready:work/second"]).toMatchObject({
      status: { state: "unknown" },
    });
  });

  it("claims the current canonical spec after a stale reader observed an older version", () => {
    const { config } = fixture();
    const original = intent("maintain");
    observeAppTaskIntent(config, { intent: original, appAgent: "app-owner" });
    const staleCopy = readAppTaskIntent(config, original.id);
    if (!staleCopy) throw new Error("expected original intent");

    const current = {
      ...original,
      outcome: "Keep the current pipeline and its newer contract observable",
      acceptance: ["The newer contract is observed"],
    };
    observeAppTaskIntent(config, { intent: current, appAgent: "app-owner" });
    expect(recordAppTaskTrigger(config, original.id, { type: "pipeline.changed", revision: 2 })).toEqual({
      kind: "recorded",
    });

    const claim = claimObservedAppTask(config, {
      taskId: original.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected current claim");
    expect(claim.intent.outcome).toBe(current.outcome);
    expect(claim.intent.outcome).not.toBe(staleCopy.outcome);
    expect(claim.generation).toBe(2);
    expect(claim.trigger).toEqual({ type: "pipeline.changed", revision: 2 });
  });

  it("preserves an explicit retry over lower-priority task wakes", () => {
    const { config } = fixture();
    const monitor = intent("maintain");
    observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
    });
    const retry = {
      type: "gym.improvement.requested",
      source: "web-ui",
      reason: "retry-candidate-verification",
      candidateFingerprint: "sha256:candidate",
    };
    expect(recordAppTaskTrigger(config, monitor.id, retry)).toEqual({
      kind: "recorded",
    });

    recordAppTaskTrigger(config, monitor.id, {
      type: "metric.breach",
      source: "agent:tech-lead",
      metricId: "may.failure-rate",
    });
    recordAppTaskTrigger(config, monitor.id, {
      type: "gym.improvement.requested",
      source: "agent:app-owner",
      params: { reason: "curriculum-continue" },
    });

    expect(readAppTaskTrigger(config, monitor.id)).toEqual(retry);
  });

  it("returns trigger snapshots that cannot mutate a long-lived cached task tree", () => {
    const { config } = fixture();
    cacheTaskStateReads(config);
    const monitor = intent("maintain");
    observeAppTaskIntent(config, { intent: monitor, appAgent: "app-owner" });
    recordAppTaskTrigger(config, monitor.id, {
      type: "metric.breach",
      data: { metricId: "may.failure-rate" },
    });

    const trigger = readAppTaskTrigger(config, monitor.id);
    const pending = readPendingAppTaskTrigger(config, monitor.id);
    if (!trigger || !pending) throw new Error("expected trigger snapshots");
    (trigger.data as Record<string, unknown>).metricId = "mutated-trigger";
    (pending.data as Record<string, unknown>).metricId = "mutated-pending";

    expect(readAppTaskTrigger(config, monitor.id)).toEqual({
      type: "metric.breach",
      data: { metricId: "may.failure-rate" },
    });
    expect(readPendingAppTaskTrigger(config, monitor.id)).toEqual({
      type: "metric.breach",
      data: { metricId: "may.failure-rate" },
    });
  });

  it("keeps a waiting task asleep on a duplicate trigger unless overrideWait is explicit", () => {
    const { config } = fixture();
    const monitor = intent("maintain");

    observeAppTaskIntent(config, { intent: monitor, appAgent: "app-owner" });
    const firstClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, firstClaim, {
      disposition: "waiting",
      summary: "waiting for old condition",
      conditions: [
        {
          id: "external-run-finished",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });

    expect(
      claimObservedAppTask(config, {
        taskId: monitor.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "passive-resync",
      }),
    ).toMatchObject({
      kind: "waiting",
      conditionIds: ["external-run-finished"],
    });

    const trigger = {
      type: "project.task.tick",
      data: {
        project: "sample",
        taskId: monitor.id,
        action: "spec-loop",
      },
    };
    observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      trigger,
    });

    const duplicateClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(duplicateClaim).toMatchObject({ kind: "waiting", taskId: monitor.id });

    const overrideTrigger = {
      type: "project.task.tick",
      data: {
        project: "sample",
        taskId: monitor.id,
        overrideWait: true,
      },
    };
    observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      trigger: overrideTrigger,
    });

    const secondClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(secondClaim).toMatchObject({ kind: "claimed", taskId: monitor.id });
    if (secondClaim.kind !== "claimed") throw new Error("expected second claim");

    const persistedAttempt = readTaskState(config).attempts?.[secondClaim.attemptId];
    expect(persistedAttempt).toMatchObject({
      state: "running",
      events: [{ event: overrideTrigger }],
    });
    expect(persistedAttempt?.trigger).toBeUndefined();
  });

  it("wakes a waiting task for explicit human task control", () => {
    const { config } = fixture();
    const monitor = intent("maintain");

    observeAppTaskIntent(config, { intent: monitor, appAgent: "app-owner" });
    const firstClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, firstClaim, {
      disposition: "waiting",
      summary: "waiting for an older external condition",
      conditions: [
        {
          id: "older-external-run-finished",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });

    const comment = {
      type: "project.comment.created",
      eventId: 42,
      data: { project: "sample", comment: "Verify the missing live proof" },
    };
    observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      trigger: comment,
    });

    const ownerClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(ownerClaim).toMatchObject({ kind: "claimed", taskId: monitor.id, trigger: comment });
    expect(readTaskState(config).resources[monitor.id].status.conditionIds).toEqual(["older-external-run-finished"]);
  });

  it("invalidates an old attempt when desired state changes generation", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");

    const changed = observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), input: { sessionId: "session-2" } },
      appAgent: "app-owner",
    });
    expect(changed).toMatchObject({ kind: "observed", generation: 2, changed: true });
    const changedTree = readTaskState(config);
    expect(changedTree.tasks["pipeline-monitor"]).toMatchObject({ state: "backlog", revision: 2 });
    expect(changedTree.resources?.["pipeline-monitor"]).toMatchObject({
      metadata: { generation: 2, resourceVersion: 3 },
      status: { phase: "pending" },
    });
    expect(changedTree.attempts?.[first.attemptId]).toMatchObject({
      state: "interrupted",
      summary: "Task specification changed while the attempt was active",
    });
    expect(completeAppTask(config, first, { summary: "late generation one result" }).status).toBe("stale");
  });

  it("detaches prior-generation Conditions and triggers when desired state changes", () => {
    const { config } = fixture();
    const monitor = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: monitor,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for the prior generation",
      conditions: [
        {
          id: "prior-generation-run",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });
    const waitingTree = readTaskState(config);
    waitingTree.taskTriggers = {
      ...(waitingTree.taskTriggers ?? {}),
      [monitor.id]: {
        taskId: monitor.id,
        taskGeneration: 1,
        resourceVersion: 1,
        event: { type: "prior-generation.trigger" },
        observedAt: "2026-07-20T00:00:00.000Z",
      },
    };
    saveTaskState(config, waitingTree);

    expect(
      observeAppTaskIntent(config, {
        intent: { ...monitor, input: { sessionId: "session-2" } },
        appAgent: "app-owner",
      }),
    ).toMatchObject({ kind: "observed", generation: 2, changed: true });

    const changedTree = readTaskState(config);
    expect(changedTree.resources?.[monitor.id]).toMatchObject({
      metadata: { generation: 2 },
      status: { phase: "pending" },
    });
    expect(changedTree.resources?.[monitor.id]?.status.conditionIds ?? []).toEqual([]);
    expect(changedTree.conditions?.["prior-generation-run"]).toBeUndefined();
    expect(changedTree.taskTriggers?.[monitor.id]).toBeUndefined();
    expect(listRunnableAppTaskIds(config)).toContain(monitor.id);
  });

  it("claims generation drift before honoring a stale waiting Condition", () => {
    const { config } = fixture();
    const monitor = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: monitor,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for a stale observation",
      conditions: [
        {
          id: "stale-run",
          type: "ado.pipeline.completed",
          subject: "ado:run:123",
          expected: "completed",
        },
      ],
    });
    const driftedTree = readTaskState(config);
    const resource = driftedTree.resources?.[monitor.id];
    if (!resource) throw new Error("expected task resource");
    resource.metadata.generation = 2;
    resource.metadata.resourceVersion += 1;
    saveTaskState(config, driftedTree);

    expect(listRunnableAppTaskIds(config)).toContain(monitor.id);
    const claim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "passive-resync",
    });
    expect(claim).toMatchObject({ kind: "claimed", taskId: monitor.id, generation: 2 });
    const claimedTree = readTaskState(config);
    expect(claimedTree.conditions?.["stale-run"]).toBeUndefined();
    expect(claimedTree.resources?.[monitor.id]?.status.conditionIds ?? []).toEqual([]);
  });

  it("keeps an active generation when only containment, category, or priority changes", () => {
    const { config } = fixture();
    const original = { ...intent("maintain"), category: "monitor", priority: "P2" as const };
    const claim = declareAndClaimTask(config, {
      intent: original,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const observed = observeAppTaskIntent(config, {
      intent: { ...original, parentId: "root", category: "operations", priority: "P0" },
      appAgent: "app-owner",
    });
    expect(observed).toEqual({ kind: "observed", taskId: claim.taskId, generation: 1, changed: true });

    const tree = readTaskState(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      metadata: { generation: 1, resourceVersion: claim.resourceVersion + 1 },
      spec: { parentId: "root", category: "operations", priority: "P0" },
      status: { phase: "running", currentAttemptId: claim.attemptId },
    });
    expect(tree.tasks.root.children).toContain(claim.taskId);
    expect(tree.tasks.operations.children).not.toContain(claim.taskId);
    expect(completeAppTask(config, claim, { summary: "same execution completed" }).status).toBe("applied");
  });

  it("advances generation when a parent move changes the effective agent", () => {
    const { config } = fixture();
    const tree = readTaskState(config);
    tree.groups!.operations.owner = "operations-owner";
    saveTaskState(config, tree);
    const original = { ...intent("maintain"), parentId: "operations" };
    const claim = declareAndClaimTask(config, {
      intent: original,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(claim.agent).toBe("operations-owner");

    const observed = observeAppTaskIntent(config, {
      intent: { ...original, parentId: "root" },
      appAgent: "app-owner",
    });
    expect(observed).toMatchObject({ kind: "observed", generation: 2, changed: true });
    expect(readTaskState(config).attempts?.[claim.attemptId]).toMatchObject({ state: "interrupted" });
  });

  it("inherits agent selection, claims one attempt, and deduplicates concurrent wakes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(first).toMatchObject({ kind: "claimed", agent: "branch-owner", generation: 1 });

    const duplicate = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(duplicate).toMatchObject({ kind: "busy", taskId: "evaluate:session-1" });

    const tree = readTaskState(config);
    expect(tree.tasks["evaluate:session-1"]).toMatchObject({
      state: "active",
      owner: "branch-owner",
      workflow: "known-workflow",
      revision: 1,
    });
    expect(tree.active_task_ids).toContain("evaluate:session-1");
  });

  it("moves an unresolved agent to attention before claiming an attempt", () => {
    const { config } = fixture();
    const result = declareAndClaimTask(config, {
      intent: { ...intent(), owner: "human" },
      appAgent: "app-owner",
      handler: "auto",
      trigger: { type: "project.comment.created", data: { comment: "Please retry" } },
      isAgentRunnable: (agent) => agent !== "human",
    });

    expect(result).toMatchObject({
      kind: "attention",
      summary: "Resolved agent human is not a runnable agent",
    });
    const tree = readTaskState(config);
    expect(tree.resources?.["evaluate:session-1"]).toMatchObject({
      status: {
        phase: "attention",
        summary: "Resolved agent human is not a runnable agent",
      },
    });
    expect(tree.resources?.["evaluate:session-1"].status.currentAttemptId).toBeUndefined();
    expect(tree.taskTriggers?.["evaluate:session-1"]).toBeUndefined();
    expect(Object.values(tree.attempts ?? {}).filter((attempt) => attempt.taskId === "evaluate:session-1")).toEqual([]);
  });

  it("clears legacy assignment authority when reconciliation claims a task", () => {
    const { config } = fixture();
    const tree = readTaskState(config);
    tree.tasks["pipeline-monitor"] = {
      id: "pipeline-monitor",
      parent_id: "operations",
      state: "active",
      children: [],
      goal: "Legacy duplicate execution",
      outputs: ["legacy.md"],
      acceptance: ["Legacy execution finishes"],
      trace: {
        current_attempt_id: "a_legacy",
        current_task_revision: 0,
        assigned_at: "2026-07-18T00:00:00Z",
        assigned_by: "planner",
        assigned_worker: "owner",
      },
    };
    tree.tasks.operations.children = [...(tree.tasks.operations.children ?? []), "pipeline-monitor"];
    saveTaskState(config, tree);

    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim.kind).toBe("claimed");

    const claimed = readTaskState(config).tasks["pipeline-monitor"];
    expect(claimed.trace?.current_attempt_id).toBeUndefined();
    expect(claimed.trace?.assigned_by).toBeUndefined();
    expect(readTaskState(config).resources?.["pipeline-monitor"]).toMatchObject({
      status: { phase: "running" },
    });
    expect(claimed.trace?.reconciliation).toBeUndefined();
  });

  it("absorbs achieved work into a completion receipt and deduplicates redelivery", () => {
    const { config, appDir } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeAppTask(config, claim, {
        summary: "session evaluated",
        response: "The session meets the requested quality bar.",
      }).status,
    ).toBe("applied");
    const tree = readTaskState(config);
    expect(tree.tasks[claim.taskId]).toBeUndefined();
    expect(tree.resources?.[claim.taskId]).toBeUndefined();
    expect(tree.tasks.operations.children).not.toContain(claim.taskId);
    expect(tree.receipts?.[claim.taskId]).toMatchObject({
      metadata: { id: claim.taskId, generation: 1, resourceVersion: 1 },
      handler: "workflow:known-workflow",
      summary: "session evaluated",
      response: "The session meets the requested quality bar.",
      outcome: "Evaluate session 1",
      workflow: "known-workflow",
      evidence: [],
      acceptanceBasis: { method: "workflow-contract", evidence: [] },
      failureFingerprints: [],
    });
    expect(tree.attempts?.[claim.attemptId]).toMatchObject({
      state: "completed",
      summary: "session evaluated",
    });

    expect(
      declareAndClaimTask(config, {
        intent: intent(),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", taskId: claim.taskId, generation: 1 });
    expect(readFileSync(join(appDir, "tasks", "seed.json"), "utf8")).not.toContain("evaluate:session-1");
  });

  it("prunes a stale live duplicate when a matching achieve receipt already exists", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, claim, { summary: "session evaluated" });

    const tree = readTaskState(config);
    tree.resources = {
      ...(tree.resources ?? {}),
      [taskIntent.id]: {
        metadata: { id: taskIntent.id, generation: claim.generation, resourceVersion: 2 },
        spec: {
          parentId: taskIntent.parentId,
          outcome: taskIntent.outcome,
          acceptance: [...taskIntent.acceptance],
          mode: taskIntent.mode,
          owner: "branch-owner",
          workflow: taskIntent.workflow,
          outputs: [...(taskIntent.outputs ?? [])],
        },
        status: {
          observedGeneration: claim.generation,
          phase: "attention",
          updatedAt: "2026-07-20T00:00:00.000Z",
          summary: "stale duplicate attention",
          conditionIds: [],
        },
      },
    };
    tree.tasks[taskIntent.id] = {
      id: taskIntent.id,
      parent_id: taskIntent.parentId,
      children: [],
      state: "review",
    };
    tree.tasks.operations.children = [...new Set([...(tree.tasks.operations.children ?? []), taskIntent.id])];
    saveTaskState(config, tree);

    expect(
      observeAppTaskIntent(config, {
        intent: taskIntent,
        appAgent: "app-owner",
      }),
    ).toMatchObject({ kind: "completed", taskId: taskIntent.id, generation: claim.generation });

    const repaired = readTaskState(config);
    expect(repaired.resources?.[taskIntent.id]).toBeUndefined();
    expect(repaired.tasks[taskIntent.id]).toBeUndefined();
    expect(repaired.tasks.operations.children).not.toContain(taskIntent.id);
    expect(repaired.receipts?.[taskIntent.id]).toBeDefined();
  });

  it("does not orphan live children while pruning a stale receipt duplicate", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, claim, { summary: "session evaluated" });

    const tree = readTaskState(config);
    tree.resources = {
      ...(tree.resources ?? {}),
      [taskIntent.id]: {
        metadata: { id: taskIntent.id, generation: claim.generation, resourceVersion: 2 },
        spec: {
          parentId: taskIntent.parentId,
          outcome: taskIntent.outcome,
          acceptance: [...taskIntent.acceptance],
          mode: taskIntent.mode,
          owner: "branch-owner",
          workflow: taskIntent.workflow,
          outputs: [...(taskIntent.outputs ?? [])],
        },
        status: {
          observedGeneration: claim.generation,
          phase: "attention",
          updatedAt: "2026-07-20T00:00:00.000Z",
          summary: "stale duplicate attention",
          conditionIds: [],
        },
      },
      "work/live-child": {
        metadata: { id: "work/live-child", generation: 1, resourceVersion: 1 },
        spec: {
          parentId: taskIntent.id,
          outcome: "Finish live child work",
          acceptance: ["Live child work is complete"],
          mode: "achieve",
          owner: "branch-owner",
          outputs: [],
        },
        status: {
          observedGeneration: 0,
          phase: "pending",
          updatedAt: "2026-07-20T00:00:00.000Z",
          summary: "Live child is still pending",
          conditionIds: [],
        },
      },
    };
    tree.tasks[taskIntent.id] = {
      id: taskIntent.id,
      parent_id: taskIntent.parentId,
      children: ["work/live-child"],
      state: "review",
    };
    tree.tasks["work/live-child"] = {
      id: "work/live-child",
      parent_id: taskIntent.id,
      children: [],
      state: "backlog",
    };
    tree.tasks.operations.children = [...new Set([...(tree.tasks.operations.children ?? []), taskIntent.id])];
    saveTaskState(config, tree);

    expect(() =>
      observeAppTaskIntent(config, {
        intent: taskIntent,
        appAgent: "app-owner",
      }),
    ).toThrow("cannot be pruned while it has live children: work/live-child");

    const preserved = readTaskState(config);
    expect(preserved.tasks[taskIntent.id]?.children).toEqual(["work/live-child"]);
    expect(preserved.tasks["work/live-child"]?.parent_id).toBe(taskIntent.id);
  });

  it("creates a new achieve generation when a completed task specification changes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, first, { summary: "first shape completed" });

    expect(
      declareAndClaimTask(config, {
        intent: {
          ...intent(),
          outcome: "Evaluate session 1 with the revised policy",
        },
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "claimed", generation: 2 });
  });

  it("retains minimal completion receipts needed for durable deduplication", () => {
    const { config } = fixture();
    const tree = readTaskState(config);
    tree.receipts = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => {
        const id = `completed-${index}`;
        return [
          id,
          {
            metadata: { id, generation: 1, resourceVersion: 1 },
            specHash: `hash-${index}`,
            parentId: "operations",
            outcome: `Completed outcome ${index}`,
            acceptance: ["Completed"],
            owner: "app-owner",
            handler: "agent:app-owner",
            summary: "Completed",
            evidence: [],
            acceptanceBasis: { method: "agent-judgment", evidence: [] },
            failureFingerprints: [],
            completedAt: new Date(index).toISOString(),
          },
        ];
      }),
    );
    saveTaskState(config, tree);

    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, claim, { summary: "new completion" });

    const completed = readTaskState(config);
    expect(Object.keys(completed.receipts ?? {})).toHaveLength(1_002);
    expect(completed.receipts?.["completed-0"]).toBeTruthy();
    expect(completed.receipts?.[claim.taskId]).toBeTruthy();
  });

  it("keeps reconciliation child history small and decision-ready", () => {
    const { config } = fixture();
    const tree = readTaskState(config);
    const longText = "x".repeat(700);
    tree.receipts = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => {
        const id = `child-${index}`;
        return [
          id,
          {
            metadata: { id, generation: 1, resourceVersion: 1 },
            specHash: `hash-${index}`,
            parentId: "pipeline-monitor",
            outcome: longText,
            acceptance: ["Completed"],
            owner: "app-owner",
            handler: "agent:app-owner",
            summary: longText,
            evidence: Array.from({ length: 6 }, () => longText),
            acceptanceBasis: { method: "agent-judgment", evidence: [] },
            failureFingerprints: [],
            completedAt: new Date(index).toISOString(),
          },
        ];
      }),
    );
    saveTaskState(config, tree);

    const context = readAppTaskChildContext(config, "pipeline-monitor");

    expect(context.completed).toHaveLength(8);
    expect(context.completed.map(({ taskId }) => taskId)).toEqual([
      "child-11",
      "child-10",
      "child-9",
      "child-8",
      "child-7",
      "child-6",
      "child-5",
      "child-4",
    ]);
    expect(context.completed[0]?.outcome.length).toBeLessThanOrEqual(512);
    expect(context.completed[0]?.summary.length).toBeLessThanOrEqual(512);
    expect(context.completed[0]?.evidence).toHaveLength(4);
    expect(context.completed[0]?.evidence[0]?.length).toBeLessThanOrEqual(512);
  });

  it("supplies a bounded App-wide live snapshot without the reviewing task", () => {
    const { config } = fixture();
    for (let index = 0; index < 65; index += 1) {
      observeAppTaskIntent(config, {
        intent: {
          id: `snapshot-task-${String(index).padStart(2, "0")}`,
          parentId: "operations",
          outcome: `Review snapshot task ${index}`,
          acceptance: [`The task converges ${"a".repeat(2_000)}`],
          mode: "achieve",
          owner: "app-owner",
          priority: index === 0 ? "P0" : "P2",
          category: index === 0 ? "focus_plan" : "domain",
          input: { index, exactPrivateDetail: `private-${index}-${"x".repeat(4_000)}` },
        },
        appAgent: "app-owner",
      });
    }

    const snapshot = readAppTaskLiveSnapshot(config, "snapshot-task-64");

    expect(snapshot.truncated).toBe(true);
    expect(snapshot.live).toHaveLength(64);
    expect(snapshot.live.some(({ taskId }) => taskId === "snapshot-task-64")).toBe(false);
    expect(snapshot.live.find(({ taskId }) => taskId === "snapshot-task-00")).toMatchObject({
      category: "focus_plan",
      priority: "P0",
      readiness: { state: "ready", relatedTaskIds: [] },
    });
    expect(JSON.stringify(snapshot)).not.toContain("exactPrivateDetail");
    expect(Buffer.byteLength(JSON.stringify(snapshot), "utf8")).toBeLessThan(40_000);
  });

  it("commits a receipt and identifies dependents in the same absorption transaction", () => {
    const { config } = fixture();
    const dependency = intent();
    const dependent = {
      ...intent("maintain"),
      id: "dependent-monitor",
      outcome: "Run after evaluation completes",
      dependsOn: [dependency.id],
    };
    observeAppTaskIntent(config, {
      intent: dependent,
      appAgent: "app-owner",
    });
    expect(
      claimObservedAppTask(config, {
        taskId: dependent.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({
      kind: "waiting",
      dependencyIds: [dependency.id],
    });

    const dependencyClaim = declareAndClaimTask(config, {
      intent: dependency,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (dependencyClaim.kind !== "claimed") throw new Error("expected dependency claim");
    expect(
      completeAppTask(config, dependencyClaim, {
        summary: "evaluation absorbed",
        evidence: ["artifact:evaluation.json"],
      }),
    ).toMatchObject({
      status: "applied",
      dependentTaskIds: [dependent.id],
    });
    expect(readTaskState(config).receipts?.[dependency.id]).toMatchObject({
      evidence: ["artifact:evaluation.json"],
      outcome: dependency.outcome,
    });
    expect(
      claimObservedAppTask(config, {
        taskId: dependent.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "claimed", taskId: dependent.id });
  });

  it("keeps active parent rollups out of the executable projection", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const running = readTaskState(config);
    running.tasks.root.state = "active";
    running.tasks.operations.state = "active";
    saveTaskState(config, running);

    completeAppTask(config, claim, { summary: "session evaluated" });

    const completed = readTaskState(config);
    expect(completed.active_task_ids).toEqual([]);
    expect(completed.active_task_id).toBeNull();
  });

  it("consumes the exact completing child through its matching receipt without retrying the stale parent", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const completedClaim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (completedClaim.kind !== "claimed") throw new Error("expected claim");
    const completedResource = readTaskState(config).resources?.[taskIntent.id];
    if (!completedResource) throw new Error("expected running resource");
    const completedSpec = structuredClone(completedResource.spec);
    completeAppTask(config, completedClaim, { summary: "session evaluated" });

    const stale = readTaskState(config);
    const receipt = stale.receipts?.[taskIntent.id];
    if (!receipt) throw new Error("expected completion receipt");
    stale.resources = {
      ...(stale.resources ?? {}),
      [taskIntent.id]: {
        metadata: { id: taskIntent.id, generation: receipt.metadata.generation, resourceVersion: 3 },
        spec: completedSpec,
        status: {
          observedGeneration: receipt.metadata.generation,
          phase: "running",
          currentAttemptId: "r_duplicate_current",
          updatedAt: "2026-07-20T00:00:00.000Z",
          conditionIds: [],
        },
      },
    };
    stale.tasks[taskIntent.id] = {
      id: taskIntent.id,
      parent_id: taskIntent.parentId,
      children: [],
      state: "active",
    };
    stale.tasks.operations.children = [...new Set([...(stale.tasks.operations.children ?? []), taskIntent.id])];
    stale.attempts = {
      ...(stale.attempts ?? {}),
      r_duplicate_current: {
        metadata: { id: "r_duplicate_current", resourceVersion: 1 },
        taskId: taskIntent.id,
        taskGeneration: receipt.metadata.generation,
        specHash: receipt.specHash,
        owner: receipt.owner,
        handler: receipt.handler,
        runtimeId: "previous-runtime",
        sessionId: "s_1786376881309_240",
        state: "running",
        startedAt: "2026-07-20T00:00:00.000Z",
      },
      r_duplicate_lineage: {
        metadata: { id: "r_duplicate_lineage", resourceVersion: 1 },
        taskId: taskIntent.id,
        taskGeneration: receipt.metadata.generation,
        specHash: receipt.specHash,
        owner: receipt.owner,
        handler: receipt.handler,
        runtimeId: "previous-runtime",
        sessionId: "s_1786376766268_235",
        state: "running",
        startedAt: "2026-07-19T23:59:00.000Z",
      },
    };
    const attemptIdsBefore = Object.keys(stale.attempts);
    saveTaskState(config, stale);

    expect(recoverableAppTaskAttempts(config)).toEqual([]);

    const retired = readTaskState(config);
    expect(retired.receipts?.[taskIntent.id]).toEqual(receipt);
    expect(Object.keys(retired.attempts ?? {})).toEqual(expect.arrayContaining(attemptIdsBefore));
    expect(Object.keys(retired.attempts ?? {})).toHaveLength(attemptIdsBefore.length);
    for (const [attemptId, sessionId] of [
      ["r_duplicate_current", "s_1786376881309_240"],
      ["r_duplicate_lineage", "s_1786376766268_235"],
    ]) {
      expect(retired.attempts?.[attemptId]).toMatchObject({
        state: "interrupted",
        failureReason: "matching-completion-receipt",
        sessionId,
      });
    }
    expect(retired.resources?.[taskIntent.id]).toBeUndefined();
    expect(retired.tasks[taskIntent.id]).toBeUndefined();
    expect(retired.tasks.operations.children).not.toContain(taskIntent.id);
  });

  it("keeps changed completion generations and specifications recoverable", () => {
    const { config } = fixture();
    const taskIntent = intent();
    const completedClaim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (completedClaim.kind !== "claimed") throw new Error("expected claim");
    completeAppTask(config, completedClaim, { summary: "session evaluated" });

    for (const variant of ["generation", "specification"] as const) {
      const tree = readTaskState(config);
      const receipt = tree.receipts?.[taskIntent.id];
      if (!receipt) throw new Error("expected completion receipt");
      const generation = variant === "generation" ? receipt.metadata.generation + 1 : receipt.metadata.generation;
      tree.resources = {
        ...(tree.resources ?? {}),
        [taskIntent.id]: {
          metadata: { id: taskIntent.id, generation, resourceVersion: 1 },
          spec: {
            parentId: taskIntent.parentId,
            outcome: variant === "specification" ? `${taskIntent.outcome} revised` : taskIntent.outcome,
            acceptance: [...taskIntent.acceptance],
            mode: "achieve",
            owner: receipt.owner,
            workflow: taskIntent.workflow,
            outputs: [...(taskIntent.outputs ?? [])],
          },
          status: {
            observedGeneration: generation,
            phase: "running",
            currentAttemptId: `r_changed_${variant}`,
            updatedAt: "2026-07-20T00:00:00.000Z",
            conditionIds: [],
          },
        },
      };
      tree.attempts = {
        ...(tree.attempts ?? {}),
        [`r_changed_${variant}`]: {
          metadata: { id: `r_changed_${variant}`, resourceVersion: 1 },
          taskId: taskIntent.id,
          taskGeneration: generation,
          specHash: variant,
          owner: receipt.owner,
          handler: receipt.handler,
          runtimeId: "previous-runtime",
          state: "running",
          startedAt: "2026-07-20T00:00:00.000Z",
        },
      };
      saveTaskState(config, tree);

      expect(recoverableAppTaskAttempts(config)).toEqual([
        expect.objectContaining({ taskId: taskIntent.id, intent: expect.objectContaining({ id: taskIntent.id }) }),
      ]);

      const reset = readTaskState(config);
      delete reset.resources?.[taskIntent.id];
      delete reset.attempts?.[`r_changed_${variant}`];
      saveTaskState(config, reset);
    }
  });

  it("recovers a receipted checkpoint from an interrupted session transcript when checkpoint JSONL is absent", () => {
    const { root, config } = fixture();
    const sessionId = "s_1786381127581_184";
    const artifactPaths = ["/app/projects/may-agent/report.json", "/app/projects/may-agent/verification.log"];
    const { reclaimed, sessionPath } = reclaimInterruptedSession(config, root, sessionId, [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "checkpoint-recovery",
            name: "checkpoint",
            arguments: {
              summary: "Fallback implementation complete; deterministic acceptance tests remain.",
              data: {
                next_step: "run focused tests and typecheck",
                artifact_paths: artifactPaths,
              },
            },
          },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "checkpoint-recovery",
        toolName: "checkpoint",
        isError: false,
        content: [{ type: "text", text: "Checkpoint saved (step 1)." }],
      },
    ]);

    expect(existsSync(join(root, ".state", "checkpoints", `${sessionId}.jsonl`))).toBe(false);
    expect(reclaimed.handoff).toMatchObject({ reason: "recovered-session" });
    expect(reclaimed.handoff?.evidence).toEqual(
      expect.arrayContaining([
        `Recovered interrupted workflow:known-workflow session path: ${sessionPath}`,
        `Recovered interrupted workflow:known-workflow session artifact: ${join(sessionPath, "result.json")}`,
        `Recovered interrupted workflow:known-workflow session transcript: ${join(sessionPath, "session.jsonl")}`,
        expect.stringContaining("summary=Fallback implementation complete; deterministic acceptance tests remain."),
        expect.stringContaining(
          `data=${JSON.stringify({ artifact_paths: artifactPaths, next_step: "run focused tests and typecheck" })}`,
        ),
      ]),
    );
  });

  it("prefers a file-backed checkpoint over a successful transcript checkpoint", () => {
    const { root, config } = fixture();
    const sessionId = "session-file-checkpoint-precedence";
    const fileCheckpoint = {
      sessionId,
      agentName: "dev",
      step: 4,
      summary: "File-backed checkpoint wins",
      data: { source: "checkpoint-jsonl", artifact_paths: ["/tmp/file-backed.txt"] },
      timestamp: 1_786_381_127_581,
    };
    const { reclaimed } = reclaimInterruptedSession(
      config,
      root,
      sessionId,
      [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "checkpoint-transcript",
              name: "checkpoint",
              arguments: { summary: "Transcript checkpoint loses", data: { source: "transcript" } },
            },
          ],
        },
        { role: "toolResult", toolCallId: "checkpoint-transcript", toolName: "checkpoint", isError: false },
      ],
      fileCheckpoint,
    );

    const checkpointEvidence = reclaimed.handoff?.evidence.find((entry) =>
      entry.startsWith("Recovered latest durable checkpoint:"),
    );
    expect(checkpointEvidence).toContain(
      `Recovered latest durable checkpoint: ${join(root, ".state", "checkpoints", `${sessionId}.jsonl`)}`,
    );
    expect(checkpointEvidence).toContain("step=4 summary=File-backed checkpoint wins");
    expect(checkpointEvidence).toContain(
      'data={"artifact_paths":["/tmp/file-backed.txt"],"source":"checkpoint-jsonl"}',
    );
    expect(checkpointEvidence).not.toContain("Transcript checkpoint loses");
  });

  it("reports checkpoint absence without a file or matching successful transcript receipt", () => {
    for (const [sessionId, transcript] of [
      [
        "session-checkpoint-no-receipt",
        [
          {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "checkpoint-unreceipted",
                name: "checkpoint",
                arguments: { summary: "Unreceipted checkpoint", data: { source: "transcript" } },
              },
            ],
          },
        ],
      ],
      [
        "session-checkpoint-error-receipt",
        [
          {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "checkpoint-error",
                name: "checkpoint",
                arguments: { summary: "Failed checkpoint", data: { source: "transcript" } },
              },
            ],
          },
          { role: "toolResult", toolCallId: "checkpoint-error", toolName: "checkpoint", isError: true },
        ],
      ],
    ] as const) {
      const { root, config } = fixture();
      const { reclaimed, sessionPath } = reclaimInterruptedSession(config, root, sessionId, [...transcript]);
      expect(reclaimed.handoff?.evidence).toContain(
        `Recovered durable checkpoint: absent for session ${sessionId}; no matching successful checkpoint receipt in ${join(sessionPath, "session.jsonl")}`,
      );
      expect(reclaimed.handoff?.evidence.join("\n")).not.toContain("Unreceipted checkpoint");
      expect(reclaimed.handoff?.evidence.join("\n")).not.toContain("Failed checkpoint");
    }
  });

  it("consumes a terminal direct-agent result exactly once even while its lease is fresh", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "terminal-agent-session");

    const before = readTaskState(config);
    expect(Date.parse(before.attempts![claim.attemptId].lease!.expiresAt)).toBeGreaterThan(Date.now());
    const recovered = terminalAgentSessionAppTaskClaim(config, claim.taskId, "terminal-agent-session");
    expect(recovered).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      attemptId: claim.attemptId,
      handler: "agent:branch-owner",
    });
    if (!recovered) throw new Error("expected terminal agent claim");

    expect(
      deferAppTask(config, recovered, {
        disposition: "waiting",
        summary: "terminal result requires one bounded child",
        evidence: ["session:terminal-agent-session"],
        actions: [
          {
            kind: "create-task",
            id: "terminal-result-child",
            parentId: claim.taskId,
            outcome: "Finish terminal result follow-up",
            acceptance: ["Follow-up converges"],
            mode: "achieve",
            outputs: [],
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["created terminal-result-child"] });
    expect(terminalAgentSessionAppTaskClaim(config, claim.taskId, "terminal-agent-session")).toBeNull();
    expect(readTaskState(config)).toMatchObject({
      resources: { [claim.taskId]: { status: { phase: "waiting" } } },
      attempts: { [claim.attemptId]: { state: "completed", sessionId: "terminal-agent-session" } },
      tasks: { "terminal-result-child": { parent_id: claim.taskId } },
    });
    expect(Object.keys(readTaskState(config).tasks).filter((id) => id === "terminal-result-child")).toHaveLength(1);
  });

  it("releases only the exact expired agent attempt after its session is terminal", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "terminal-agent-session");

    const stale = readTaskState(config);
    const resource = stale.resources?.[claim.taskId];
    const attempt = stale.attempts?.[claim.attemptId];
    if (!resource || !attempt?.lease) throw new Error("expected leased attempt");
    attempt.lease.expiresAt = "2026-08-15T23:57:29.078Z";
    saveTaskState(config, stale);
    const recovery = {
      taskId: claim.taskId,
      intent: claim.intent,
      taskGeneration: resource.metadata.generation,
      taskResourceVersion: resource.metadata.resourceVersion,
      attemptId: attempt.metadata.id,
      attemptResourceVersion: attempt.metadata.resourceVersion,
      leaseId: attempt.lease.id,
      leaseVersion: attempt.lease.version,
      legacyLeaseLess: false as const,
      sessionId: "terminal-agent-session",
      terminalStatus: "done" as const,
    };

    expect(
      releaseTerminalSessionExpiredAppTaskAttempt(
        config,
        recovery,
        "Synchronous caller disappeared during rollback",
        Date.parse("2026-08-16T01:00:00.000Z"),
      ),
    ).toEqual({ released: true, sessionIds: ["terminal-agent-session"] });
    expect(readTaskState(config)).toMatchObject({
      resources: { [claim.taskId]: { status: { phase: "pending", observedGeneration: 0 } } },
      attempts: {
        [claim.attemptId]: {
          state: "interrupted",
          sessionId: "terminal-agent-session",
          failureReason: "terminal-agent-session-expired-lease-requeued",
        },
      },
    });
  });

  it("never releases a healthy live agent session or a stale fenced observation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "live-agent-session");
    const tree = readTaskState(config);
    const resource = tree.resources?.[claim.taskId];
    const attempt = tree.attempts?.[claim.attemptId];
    if (!resource || !attempt?.lease) throw new Error("expected leased attempt");
    const recovery = {
      taskId: claim.taskId,
      intent: claim.intent,
      taskGeneration: resource.metadata.generation,
      taskResourceVersion: resource.metadata.resourceVersion,
      attemptId: attempt.metadata.id,
      attemptResourceVersion: attempt.metadata.resourceVersion,
      leaseId: attempt.lease.id,
      leaseVersion: attempt.lease.version,
      legacyLeaseLess: false as const,
      sessionId: "live-agent-session",
      terminalStatus: "done" as const,
    };

    expect(releaseTerminalSessionExpiredAppTaskAttempt(config, recovery, "must remain live", Date.now())).toEqual({
      released: false,
      sessionIds: [],
    });
    attempt.lease.expiresAt = "2020-01-01T00:00:00.000Z";
    saveTaskState(config, tree);
    const activeAt = Date.now();
    const activity = { sessionId: "live-agent-session", lastActivityAt: activeAt - 1_000 };
    expect(expiredAgentSessionAppTaskAttempt(config, claim.taskId, activeAt, activity)).toBeNull();
    expect(
      expiredAgentSessionAppTaskAttempt(config, claim.taskId, activeAt, {
        sessionId: "unrelated-session",
        lastActivityAt: activeAt,
      }),
    ).toMatchObject({ taskId: claim.taskId, sessionId: "live-agent-session" });
    expect(
      releaseTerminalSessionExpiredAppTaskAttempt(
        config,
        recovery,
        "recent session activity must preserve ownership",
        activeAt,
        activity,
      ),
    ).toEqual({ released: false, sessionIds: [] });
    expect(
      releaseTerminalSessionExpiredAppTaskAttempt(
        config,
        { ...recovery, attemptResourceVersion: recovery.attemptResourceVersion + 1 },
        "stale fence must fail",
        Date.now(),
      ),
    ).toEqual({ released: false, sessionIds: [] });
    expect(readTaskState(config).resources?.[claim.taskId].status.phase).toBe("running");
  });

  it("requeues the same task when a late workflow result reaches its still-running attempt", () => {
    const { config } = fixture();
    const trigger = {
      type: "project.task.tick",
      data: { project: "sample", taskId: "maintain" },
    };
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger,
    });
    if (claim.kind !== "claimed") throw new Error("expected workflow claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-resumed-after-restart")).toBe(true);

    expect(
      releaseLateTerminalWorkflowAppTaskAttempt(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "session-resumed-after-restart",
        "Late terminal result cannot reattach to restart-interrupted workflow workflow-run-1",
      ),
    ).toEqual({ released: true, taskId: claim.taskId });

    const released = readTaskState(config);
    expect(released.resources?.[claim.taskId].status).toMatchObject({
      phase: "pending",
      observedGeneration: claim.generation - 1,
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(released.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "late-terminal-workflow-result-requeued",
      sessionId: "session-resumed-after-restart",
    });
    expect(readAppTaskTrigger(config, claim.taskId)).toEqual(trigger);
    expect(
      releaseLateTerminalWorkflowAppTaskAttempt(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "session-resumed-after-restart",
        "duplicate terminal delivery",
      ),
    ).toEqual({ released: false, taskId: claim.taskId });
  });

  it("recovers an interrupted attempt only from a previous runtime trigger", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    expect(recoverableAppTaskAttempts(config)).toEqual([]);

    const interrupted = readTaskState(config);
    interrupted.attempts![first.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const [recovery] = recoverableAppTaskAttempts(config);
    expect(recovery).toMatchObject({
      taskId: first.taskId,
      intent: { id: first.taskId },
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });

    const reclaimed = declareAndClaimTask(config, {
      intent: recovery.intent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: recovery.trigger,
      reason: `attempt-recovery:${first.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: first.taskId,
      generation: first.generation,
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaim");
    expect(reclaimed.attemptId).not.toBe(first.attemptId);
    const recovered = readTaskState(config);
    expect(recovered.attempts?.[first.attemptId]).toMatchObject({ state: "interrupted" });
    expect(recovered.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: `attempt-recovery:${first.taskId}`,
      events: [{ event: { type: "session.end" } }],
    });
    expect(recovered.attempts?.[reclaimed.attemptId]?.trigger).toBeUndefined();
  });

  it("claims a previous-runtime attempt with a persisted trigger during ordinary resync", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (first.kind !== "claimed") throw new Error("expected claim");

    const interrupted = readTaskState(config);
    interrupted.attempts![first.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const resync = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "task-controller",
    });
    expect(resync).toMatchObject({
      kind: "claimed",
      taskId: first.taskId,
      generation: first.generation,
      trigger: {
        type: "session.end",
        data: { project: "sample", sessionId: "session-1" },
      },
    });
    if (resync.kind !== "claimed") throw new Error("expected reclaim");
    expect(resync.attemptId).not.toBe(first.attemptId);

    const tree = readTaskState(config);
    expect(tree.attempts?.[first.attemptId]).toMatchObject({
      runtimeId: "previous-runtime",
      state: "interrupted",
    });
    expect(tree.attempts?.[resync.attemptId]).toMatchObject({
      runtimeId: expect.any(String),
      state: "running",
      reason: "task-controller",
      events: [
        {
          event: {
            type: "session.end",
            data: { project: "sample", sessionId: "session-1" },
          },
        },
      ],
    });
    expect(tree.attempts?.[resync.attemptId]?.trigger).toBeUndefined();
    expect(tree.resources?.[first.taskId].status).toMatchObject({
      phase: "running",
      currentAttemptId: resync.attemptId,
    });
  });

  it("returns superseded agent-session ids when reclaiming a previous-runtime attempt", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, first, "session-old")).toBe(true);

    const interrupted = readTaskState(config);
    interrupted.attempts![first.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const reclaimed = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: `attempt-recovery:${first.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      supersededSessionIds: ["session-old"],
    });
  });

  it("associates workflow sessions with the current attempt and rejects stale generations", () => {
    const { config } = fixture();
    const original = intent();
    const claim = declareAndClaimTask(config, {
      intent: original,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      associateAppTaskSession(
        config,
        { taskId: claim.taskId, generation: claim.generation },
        "nested-workflow-session",
      ),
    ).toEqual({ status: "recorded", taskId: claim.taskId });
    const associated = readTaskState(config).attempts?.[claim.attemptId];
    expect(associated?.sessionId).toBe("nested-workflow-session");
    const associatedVersion = associated?.metadata.resourceVersion;
    expect(recordAppTaskAttemptSession(config, claim, "nested-workflow-session")).toBe(true);
    expect(readTaskState(config).attempts?.[claim.attemptId].metadata.resourceVersion).toBe(associatedVersion);

    const revised: AppTaskIntent = {
      ...original,
      outcome: "Evaluate the revised session contract",
    };
    expect(
      observeAppTaskIntent(config, {
        intent: revised,
        appAgent: "app-owner",
      }),
    ).toMatchObject({
      kind: "observed",
      generation: claim.generation + 1,
      supersededSessionIds: ["nested-workflow-session"],
    });
    expect(
      associateAppTaskSession(config, { taskId: claim.taskId, generation: claim.generation }, "late-stale-session"),
    ).toEqual({ status: "superseded", taskId: claim.taskId });
    expect(associateAppTaskSession(config, { taskId: "missing-task", generation: 1 }, "missing-session")).toEqual({
      status: "missing",
      taskId: "missing-task",
    });
  });

  it("returns orphaned agent-session ids when requeueing a previous-runtime attempt without a trigger", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-old")).toBe(true);

    const interrupted = readTaskState(config);
    interrupted.attempts![claim.attemptId].runtimeId = "previous-runtime";
    delete interrupted.attempts![claim.attemptId].trigger;
    saveTaskState(config, interrupted);

    const [recovery] = recoverableAppTaskAttempts(config);
    expect(recovery.taskId).toBe(claim.taskId);
    expect(recovery.trigger).toBeUndefined();
    expect(releaseInterruptedAppTaskAttempt(config, claim.taskId, "trigger packet was not persisted")).toEqual({
      released: true,
      sessionIds: ["session-old"],
    });

    const released = readTaskState(config);
    expect(released.tasks[claim.taskId]).toMatchObject({
      state: "backlog",
      summary: "trigger packet was not persisted; retrying from current task evidence",
    });
    expect(released.resources?.[claim.taskId]).toMatchObject({
      status: { phase: "pending" },
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(released.active_task_ids).not.toContain(claim.taskId);
    expect(pendingAppTaskRecoveryAttention(config)).toEqual([]);
    expect(acknowledgeAppTaskRecoveryAttention(config, claim.taskId)).toBe(false);
  });

  it("requeues running tasks whose current attempt record is missing", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const orphaned = readTaskState(config);
    delete orphaned.attempts![claim.attemptId];
    saveTaskState(config, orphaned);

    expect(listRunnableAppTaskIds(config)).toContain(claim.taskId);
    expect(repairRunningAppTasksWithoutAttempt(config)).toEqual([
      expect.objectContaining({
        taskId: claim.taskId,
        disposition: "requeued",
      }),
    ]);

    const released = readTaskState(config);
    expect(released.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "pending",
      },
    });
    expect(released.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(released.active_task_ids).not.toContain(claim.taskId);
    expect(listRunnableAppTaskIds(config)).toContain(claim.taskId);
  });

  it("claims running tasks whose current attempt record is missing", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const orphaned = readTaskState(config);
    delete orphaned.attempts![claim.attemptId];
    saveTaskState(config, orphaned);

    const reclaimed = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "test-reclaim",
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      generation: claim.generation,
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");
    expect(reclaimed.attemptId).not.toBe(claim.attemptId);
    expect(readTaskState(config).attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: "test-reclaim",
    });
  });

  it("persists a synthetic controller trigger so task-controller attempts survive restart", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(claim).toMatchObject({
      kind: "claimed",
      trigger: {
        type: "project.task.tick",
        source: "app-task:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const interrupted = readTaskState(config);
    interrupted.attempts![claim.attemptId].runtimeId = "previous-runtime";
    saveTaskState(config, interrupted);

    const [recovery] = recoverableAppTaskAttempts(config);
    expect(recovery).toMatchObject({
      taskId: claim.taskId,
      trigger: {
        type: "project.task.tick",
        source: "app-task:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });

    expect(releaseInterruptedAppTaskAttempt(config, claim.taskId, "previous runtime stopped")).toEqual({
      released: true,
      sessionIds: [],
    });
    const pending = readTaskState(config);
    expect(pending.resources?.[claim.taskId].status).toMatchObject({
      phase: "pending",
    });
    expect(pending.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(pending.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "previous-runtime-attempt-requeued",
    });
    expect(pending.taskTriggers?.[claim.taskId]?.event).toMatchObject({
      type: "project.task.tick",
      source: "app-task:sample:task-controller",
      target: { project: "sample", taskId: "evaluate:session-1" },
      reason: "task-controller",
    });
    expect(listRunnableAppTaskIds(config)).toContain(claim.taskId);

    const reclaimed = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: `attempt-recovery:${claim.taskId}`,
    });
    expect(reclaimed).toMatchObject({
      kind: "claimed",
      taskId: claim.taskId,
      generation: claim.generation,
      trigger: {
        type: "project.task.tick",
        source: "app-task:sample:task-controller",
        target: { project: "sample", taskId: "evaluate:session-1" },
        reason: "task-controller",
      },
    });
    if (reclaimed.kind !== "claimed") throw new Error("expected reclaimed claim");

    const released = readTaskState(config);
    expect(released.tasks[claim.taskId]).toMatchObject({
      state: "active",
    });
    expect(released.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
    });
    expect(released.attempts?.[reclaimed.attemptId]).toMatchObject({
      state: "running",
      reason: `attempt-recovery:${claim.taskId}`,
      events: [
        {
          event: {
            type: "project.task.tick",
            source: "app-task:sample:task-controller",
            target: { project: "sample", taskId: "evaluate:session-1" },
            reason: "task-controller",
          },
        },
      ],
    });
    expect(released.attempts?.[reclaimed.attemptId]?.trigger).toBeUndefined();
    expect(released.active_task_ids).toContain(claim.taskId);
  });

  it("atomically fences an interrupted orphan claim and accepts exactly one later wake (events 5446564 and 5446878)", () => {
    const { root, config } = fixture();
    const taskIntent = { ...intent("maintain"), id: "ops/orphan-claim-fence" };
    const oldClaim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (oldClaim.kind !== "claimed") throw new Error("expected old claim");
    expect(recordAppTaskAttemptSession(config, oldClaim, "r_1_f85fb905-old-session")).toBe(true);

    const checkpointDir = join(root, ".state", "checkpoints");
    mkdirSync(checkpointDir, { recursive: true });
    writeFileSync(
      join(checkpointDir, "r_1_f85fb905-old-session.jsonl"),
      `${JSON.stringify({
        sessionId: "r_1_f85fb905-old-session",
        agentName: "app-owner",
        step: 1,
        timestamp: 1_786_564_000_000,
        summary: "Event 5446564 interrupted the old owner after acceptance-critical evidence",
        data: { next_step: "replacement owner decides the unchanged generation" },
      })}\n`,
    );
    const interrupted = readTaskState(config);
    interrupted.attempts![oldClaim.attemptId].runtimeId = "runtime-before-event-5446564";
    saveTaskState(config, interrupted);

    expect(releaseInterruptedAppTaskAttempt(config, oldClaim.taskId, "restart event 5446564")).toEqual({
      released: true,
      sessionIds: ["r_1_f85fb905-old-session"],
    });
    const replacement = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "restart-event:5446564",
    });
    if (replacement.kind !== "claimed") throw new Error("expected replacement claim");
    expect(replacement.generation).toBe(oldClaim.generation);
    expect(replacement.handoff?.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Event 5446564 interrupted the old owner after acceptance-critical evidence"),
        expect.stringContaining('data={"next_step":"replacement owner decides the unchanged generation"}'),
      ]),
    );

    expect(completeAppTask(config, oldClaim, { summary: "late old disposition" }).status).toBe("stale");
    expect(
      claimObservedAppTask(config, {
        taskId: replacement.taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "duplicate-reclaim",
      }),
    ).toMatchObject({ kind: "busy", attemptId: replacement.attemptId });
    expect(completeAppTask(config, replacement, { summary: "replacement disposition accepted" }).status).toBe(
      "applied",
    );

    const laterWake = {
      type: "project.task.tick",
      eventId: 5446878,
      source: "app-task:sample:task-controller",
      target: { project: "sample", taskId: taskIntent.id },
      reason: "explicit-later-wake",
    };
    expect(
      observeAppTaskIntent(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        trigger: laterWake,
      }),
    ).toMatchObject({ kind: "observed", generation: replacement.generation, changed: false });
    const fresh = claimObservedAppTask(config, {
      taskId: taskIntent.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "event:5446878",
    });
    if (fresh.kind !== "claimed") throw new Error("expected exactly one fresh reconciliation");
    expect(fresh.trigger).toEqual(laterWake);
    expect(fresh.attemptId).not.toBe(replacement.attemptId);
    expect(
      claimObservedAppTask(config, {
        taskId: taskIntent.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "duplicate-event:5446878",
      }),
    ).toMatchObject({ kind: "busy", attemptId: fresh.attemptId });

    const state = readTaskState(config);
    const acceptedAttempts = Object.values(state.attempts ?? {}).filter(
      (attempt) => attempt.taskId === taskIntent.id && attempt.state === "completed",
    );
    const runningAttempts = Object.values(state.attempts ?? {}).filter(
      (attempt) => attempt.taskId === taskIntent.id && attempt.state === "running",
    );
    expect(acceptedAttempts).toHaveLength(1);
    expect(acceptedAttempts[0].metadata.id).toBe(replacement.attemptId);
    expect(runningAttempts).toHaveLength(1);
    expect(runningAttempts[0].metadata.id).toBe(fresh.attemptId);
  });

  it("repairs existing previous-runtime attention records on startup", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const stale = readTaskState(config);
    for (const activeClaim of [claim]) {
      stale.attempts![activeClaim.attemptId].runtimeId = "previous-runtime";
      stale.attempts![activeClaim.attemptId].state = "interrupted";
      stale.attempts![activeClaim.attemptId].failureReason = "previous-runtime-attempt-not-recoverable";
      stale.resources![activeClaim.taskId].status = {
        ...stale.resources![activeClaim.taskId].status,
        phase: "attention",
        observedGeneration: activeClaim.generation,
        currentAttemptId: undefined,
        summary: `old attention ${activeClaim.taskId}`,
      };
      stale.tasks[activeClaim.taskId].state = "review";
    }
    stale.active_task_ids = [];
    stale.active_task_id = null;
    saveTaskState(config, stale);

    expect(repairPreviousRuntimeRecoveryAttention(config)).toMatchObject([
      { taskId: "evaluate:session-1", disposition: "requeued" },
    ]);

    const repaired = readTaskState(config);
    expect(repaired.resources?.["evaluate:session-1"]).toMatchObject({
      status: { phase: "pending", observedGeneration: 0 },
    });
    expect(repaired.tasks["evaluate:session-1"].state).toBe("backlog");
    expect(pendingAppTaskRecoveryAttention(config)).toEqual([]);
  });

  it("keeps converged maintain tasks live for the next event", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(completeAppTask(config, claim, { summary: "pipeline healthy" }).status).toBe("applied");
    const convergedTree = readTaskState(config);
    const task = convergedTree.tasks[claim.taskId];
    expect(task).toMatchObject({ state: "backlog", reconcile_mode: "maintain", summary: "pipeline healthy" });
    expect(task.trace?.reconciliation).toBeUndefined();
    expect(convergedTree.resources?.[claim.taskId]).toMatchObject({
      status: {
        observedGeneration: claim.generation,
        phase: "converged",
        summary: "pipeline healthy",
      },
    });
    expect(convergedTree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(convergedTree.attempts?.[claim.attemptId]).toMatchObject({ state: "completed" });

    expect(
      claimObservedAppTask(config, {
        taskId: claim.taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", generation: claim.generation });

    const next = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      trigger: { type: "pipeline.changed", revision: 2 },
    });
    expect(next).toMatchObject({ kind: "claimed", generation: claim.generation });
  });

  it("wakes a maintain task once per canonical App admission", () => {
    const { config } = fixture();
    const monitor = intent("maintain");
    const trigger = (key: string) => ({
      type: "app.task.requested",
      source: "app-inbox:sample",
      idempotencyKey: key,
      data: { taskId: monitor.id, idempotencyKey: key },
    });

    const first = observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      admissionKey: "app-request-1",
      trigger: trigger("app-request-1"),
    });
    expect(first).toMatchObject({ kind: "observed", taskId: monitor.id });
    const firstClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (firstClaim.kind !== "claimed") throw new Error("expected first claim");
    expect(firstClaim.trigger).toEqual(trigger("app-request-1"));
    completeAppTask(config, firstClaim, { summary: "first scheduled review complete" });

    const duplicate = observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      admissionKey: "app-request-1",
      trigger: trigger("app-request-1"),
    });
    expect(duplicate).toMatchObject({
      kind: "observed",
      taskId: monitor.id,
      generation: firstClaim.generation,
      changed: false,
    });
    expect(readAppTaskTrigger(config, monitor.id)).toBeUndefined();
    expect(
      claimObservedAppTask(config, {
        taskId: monitor.id,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "completed", generation: firstClaim.generation });

    const second = observeAppTaskIntent(config, {
      intent: monitor,
      appAgent: "app-owner",
      admissionKey: "app-request-2",
      trigger: trigger("app-request-2"),
    });
    expect(second).toMatchObject({
      kind: "observed",
      taskId: monitor.id,
      generation: firstClaim.generation,
      changed: false,
    });
    const secondClaim = claimObservedAppTask(config, {
      taskId: monitor.id,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(secondClaim).toMatchObject({
      kind: "claimed",
      generation: firstClaim.generation,
      trigger: trigger("app-request-2"),
    });

    expect(() =>
      observeAppTaskIntent(config, {
        intent: { ...monitor, outcome: "Different desired work" },
        appAgent: "app-owner",
        admissionKey: "app-request-2",
        trigger: trigger("app-request-2"),
      }),
    ).toThrow("was already used for different desired work");
  });

  it("replays a queued maintain trigger after the older attempt completes", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review" },
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    observeAppTaskIntent(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review" },
      appAgent: "app-owner",
      trigger: {
        type: "project.comment.created",
        data: { comment: "Please review the new approval packet" },
      },
    });

    expect(listRunnableAppTaskIds(config)).not.toContain("runtime/owner-review");

    const completed = completeAppTask(config, claim, {
      summary: "current review complete",
    });
    expect(completed).toMatchObject({
      status: "applied",
      dependentTaskIds: ["runtime/owner-review"],
    });
    expect(readAppTaskTrigger(config, "runtime/owner-review")).toEqual({
      type: "project.comment.created",
      data: { comment: "Please review the new approval packet" },
    });

    const replay = claimObservedAppTask(config, {
      taskId: "runtime/owner-review",
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    expect(replay).toMatchObject({
      kind: "claimed",
      taskId: "runtime/owner-review",
      generation: claim.generation,
      trigger: {
        type: "project.comment.created",
        data: { comment: "Please review the new approval packet" },
      },
    });
  });

  it("preserves a queued project comment through child completion and interrupted-attempt recovery", () => {
    const { config } = fixture();
    const parentIntent = {
      ...intent("maintain"),
      id: "runtime/owner-review",
    } as const;
    const childIntent = {
      id: "runtime/owner-review/domain-fix",
      parentId: parentIntent.id,
      outcome: "Finish the bounded domain fix",
      acceptance: ["The domain fix has exact evidence"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const parentClaim = declareAndClaimTask(config, {
      intent: parentIntent,
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (parentClaim.kind !== "claimed") throw new Error("expected parent claim");

    const commentTrigger = {
      type: "project.comment.created",
      eventId: 4425120,
      data: { comment: "Re-evaluate the existing normalization leaf" },
    };
    observeAppTaskIntent(config, {
      intent: parentIntent,
      appAgent: "app-owner",
      trigger: commentTrigger,
    });

    const childClaim = declareAndClaimTask(config, {
      intent: childIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (childClaim.kind !== "claimed") throw new Error("expected child claim");
    expect(
      completeAppTask(config, childClaim, {
        summary: "bounded domain fix completed",
        evidence: ["proof:domain-fix"],
      }),
    ).toMatchObject({ status: "applied", dependentTaskIds: [parentIntent.id] });
    expect(readAppTaskTrigger(config, parentIntent.id)).toEqual(commentTrigger);

    const interruptedTree = readTaskState(config);
    const currentAttemptId = interruptedTree.resources?.[parentIntent.id]?.status.currentAttemptId;
    if (!currentAttemptId) throw new Error("expected current parent attempt");
    interruptedTree.attempts![currentAttemptId]!.runtimeId = "previous-runtime";
    saveTaskState(config, interruptedTree);

    expect(releaseInterruptedAppTaskAttempt(config, parentIntent.id, "Process restarted")).toMatchObject({
      released: true,
    });
    expect(readAppTaskTrigger(config, parentIntent.id)).toEqual(commentTrigger);

    const recoveredClaim = claimObservedAppTask(config, {
      taskId: parentIntent.id,
      appAgent: "app-owner",
      handler: "agent:app-owner",
      reason: `attempt-recovery:${parentIntent.id}`,
    });
    expect(recoveredClaim).toMatchObject({
      kind: "claimed",
      taskId: parentIntent.id,
      trigger: commentTrigger,
    });
  });

  it("rejects absorbing an achieve parent that still has live children", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "normalize-frontier",
      parentId: "operations",
      outcome: "Normalize the remaining frontier",
      acceptance: ["The frontier is empty or every remainder has exact disposition"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const childIntent = {
      id: "normalize-frontier/spec-a",
      parentId: parentIntent.id,
      outcome: "Normalize spec A",
      acceptance: ["Spec A has exact live proof or exact blocker"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;

    observeAppTaskIntent(config, {
      intent: parentIntent,
      appAgent: "app-owner",
    });
    observeAppTaskIntent(config, {
      intent: childIntent,
      appAgent: "app-owner",
    });
    const claim = declareAndClaimTask(config, {
      intent: parentIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "parent has no direct mutation to make",
      }),
    ).toThrow("cannot converge while it has live children");
    const tree = readTaskState(config);
    expect(tree.tasks[parentIntent.id]).toBeTruthy();
    expect(tree.resources?.[parentIntent.id]?.status.phase).toBe("running");
    expect(tree.receipts?.[parentIntent.id]).toBeUndefined();
    expect(tree.tasks[childIntent.id]).toBeTruthy();
  });

  it("rejects closing another task that still has live children", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "parent-with-live-child",
      parentId: "operations",
      outcome: "Finish a parent only after its child",
      acceptance: ["Every child is absorbed first"],
      mode: "achieve",
    } as const;
    const childIntent = {
      id: "parent-with-live-child/child",
      parentId: parentIntent.id,
      outcome: "Finish the child",
      acceptance: ["The child is complete"],
      mode: "achieve",
    } as const;
    observeAppTaskIntent(config, { intent: parentIntent, appAgent: "app-owner" });
    observeAppTaskIntent(config, { intent: childIntent, appAgent: "app-owner" });

    const carrier = claimObservedAppTask(config, {
      taskId: "categorized-task",
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    expect(() =>
      completeAppTask(config, carrier, {
        summary: "Attempted parent closure",
        evidence: ["review:parent-closure"],
        actions: [
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Parent complete",
          },
        ],
      }),
    ).toThrow("cannot absorb parent-with-live-child while it has live children");

    const rejectedTree = readTaskState(config);
    expect(rejectedTree.tasks[parentIntent.id]).toBeTruthy();
    expect(rejectedTree.resources?.[parentIntent.id]).toBeTruthy();
    expect(rejectedTree.receipts?.[parentIntent.id]).toBeUndefined();
    expect(rejectedTree.tasks[childIntent.id]).toBeTruthy();

    expect(
      completeAppTask(config, carrier, {
        summary: "Closed the current bottom-most descendant",
        evidence: ["review:bottom-most-child"],
        actions: [
          {
            kind: "close-task",
            taskId: childIntent.id,
            expectedGeneration: 1,
            summary: "Bottom-most child complete",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: [`closed ${childIntent.id}`],
    });

    const afterChild = readTaskState(config);
    expect(afterChild.tasks[childIntent.id]).toBeUndefined();
    expect(afterChild.receipts?.[childIntent.id]).toBeDefined();
    expect(afterChild.tasks[parentIntent.id]).toBeTruthy();
    expect(afterChild.receipts?.[parentIntent.id]).toBeUndefined();

    const upwardCarrierIntent = {
      id: "close-upward-carrier",
      parentId: "operations",
      outcome: "Reconcile the next ancestor transition",
      acceptance: ["Only the now-leaf ancestor is closed"],
      mode: "achieve",
    } as const;
    const upwardCarrier = declareAndClaimTask(config, {
      intent: upwardCarrierIntent,
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (upwardCarrier.kind !== "claimed") {
      throw new Error("expected upward carrier claim");
    }
    expect(
      completeAppTask(config, upwardCarrier, {
        summary: "Reconciled the ancestor after its child",
        evidence: ["review:ancestor-now-leaf"],
        actions: [
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Ancestor complete after child transition",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: [`closed ${parentIntent.id}`],
    });

    const reconciledTree = readTaskState(config);
    expect(reconciledTree.tasks[parentIntent.id]).toBeUndefined();
    expect(reconciledTree.receipts?.[parentIntent.id]).toBeDefined();
  });

  it("allows a batch to reparent a live child before closing its old parent", () => {
    const { config } = fixture();
    const parentIntent = {
      id: "stale-parent",
      parentId: "operations",
      outcome: "Retire stale parent after preserving the useful child",
      acceptance: ["The useful child remains live"],
      mode: "achieve",
    } as const;
    const childIntent = {
      id: "useful-wait",
      parentId: parentIntent.id,
      outcome: "Wait on the exact external signal",
      acceptance: ["The wait has a typed condition"],
      mode: "achieve",
    } as const;
    observeAppTaskIntent(config, { intent: parentIntent, appAgent: "app-owner" });
    observeAppTaskIntent(config, { intent: childIntent, appAgent: "app-owner" });

    const carrier = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    expect(
      completeAppTask(config, carrier, {
        summary: "Collapsed stale parent",
        evidence: ["reparented useful wait before closing stale parent"],
        actions: [
          {
            kind: "update-task",
            taskId: childIntent.id,
            expectedGeneration: 1,
            parentId: "operations",
          },
          {
            kind: "close-task",
            taskId: parentIntent.id,
            expectedGeneration: 1,
            summary: "Parent was stale after child was preserved elsewhere",
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["updated useful-wait", "closed stale-parent"] });

    const tree = readTaskState(config);
    expect(tree.tasks[parentIntent.id]).toBeUndefined();
    expect(tree.receipts?.[parentIntent.id]).toBeDefined();
    expect(tree.tasks[childIntent.id]?.parent_id).toBe("operations");
    expect(tree.tasks.operations.children).toContain(childIntent.id);
  });

  it("rejects stale results after a fallback attempt takes ownership", () => {
    const { config } = fixture();
    const primary = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (primary.kind !== "claimed") throw new Error("expected primary claim");
    expect(
      markAppTaskAttention(config, primary, {
        summary: "workflow could not classify the task",
        reason: "needs-agent",
      }),
    ).toMatchObject({ status: "applied" });

    const fallback = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      reason: "workflow-fallback",
    });
    if (fallback.kind !== "claimed") throw new Error("expected fallback claim");
    expect(
      completeAppTask(config, primary, {
        summary: "late primary result",
        actions: [
          {
            kind: "create-task",
            id: "stale-action-must-not-apply",
            parentId: "operations",
            outcome: "This task must not exist",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }).status,
    ).toBe("stale");
    expect(readTaskState(config).tasks["stale-action-must-not-apply"]).toBeUndefined();
    expect(completeAppTask(config, fallback, { summary: "owner handled exception" }).status).toBe("applied");
  });

  it("does not reclaim attention tasks during plain resync", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      markAppTaskAttention(config, claim, {
        summary: "reviewer must decide the next move",
        reason: "handler-blocked",
      }),
    ).toMatchObject({ status: "applied" });

    expect(
      declareAndClaimTask(config, {
        intent: intent(),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "task-controller",
      }),
    ).toMatchObject({
      kind: "attention",
      taskId: claim.taskId,
      generation: claim.generation,
      summary: "reviewer must decide the next move",
    });

    const tree = readTaskState(config);
    expect(tree.tasks[claim.taskId]).toMatchObject({
      state: "review",
      summary: "reviewer must decide the next move",
    });
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "attention",
      },
    });
    expect(tree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(tree.active_task_ids).not.toContain(claim.taskId);
  });

  it("allows a new trigger to reclaim an attention task", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    markAppTaskAttention(config, claim, {
      summary: "waiting for new evidence",
      reason: "handler-blocked",
    });

    const next = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "event",
      trigger: { type: "project.problem.resolved", data: { project: "sample" } },
    });
    expect(next).toMatchObject({ kind: "claimed", taskId: claim.taskId, generation: claim.generation });
    if (next.kind !== "claimed") throw new Error("expected reclaim");
    expect(readTaskState(config).tasks[claim.taskId]).toMatchObject({ state: "active" });
    const persistedAttempt = readTaskState(config).attempts?.[next.attemptId];
    expect(persistedAttempt).toMatchObject({ events: [{ event: { type: "project.problem.resolved" } }] });
    expect(persistedAttempt?.trigger).toBeUndefined();
  });

  it("releases execution failure only after newer success from the same agent", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      trigger: {
        type: "project.task.child-transitioned",
        childTaskId: "work/recovered-evidence",
      },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "failed-agent-session");
    markAppTaskAttention(config, claim, {
      summary: "agent execution ended without a decision",
      reason: "HandlerExecutionFailed",
    });

    const [candidate] = listHandlerExecutionFailedAppTasks(config);
    expect(candidate).toMatchObject({
      taskId: claim.taskId,
      agent: "branch-owner",
      failureReason: "HandlerExecutionFailed",
      sessionId: "failed-agent-session",
    });
    expect(
      releaseHandlerExecutionFailedAppTask(config, claim.taskId, {
        agent: "other-owner",
        sessionId: "unrelated-success",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      releaseHandlerExecutionFailedAppTask(config, claim.taskId, {
        agent: "branch-owner",
        sessionId: "new-success",
        observedAt: "invalid",
      }),
    ).toBe(false);
    expect(
      releaseHandlerExecutionFailedAppTask(config, claim.taskId, {
        agent: "branch-owner",
        sessionId: "new-success",
        observedAt: "2000-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      releaseHandlerExecutionFailedAppTask(config, claim.taskId, {
        agent: "branch-owner",
        sessionId: "new-success",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(readTaskState(config).resources?.[claim.taskId].status.phase).toBe("pending");
    expect(readAppTaskTrigger(config, claim.taskId)).toEqual({
      type: "project.task.child-transitioned",
      childTaskId: "work/recovered-evidence",
    });
  });

  it("preserves newer human steering while releasing one execution failure", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      trigger: { type: "project.task.tick", data: { reason: "initial" } },
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskAttemptSession(config, claim, "failed-agent-session");
    markAppTaskAttention(config, claim, {
      summary: "agent execution ended without a decision",
      reason: "HandlerExecutionFailed",
    });
    expect(
      recordAppTaskTrigger(config, claim.taskId, {
        type: "project.comment.created",
        data: { project: "sample", comment: "Use the exact evidence paths" },
      }),
    ).toEqual({ kind: "recorded" });

    expect(
      releaseHandlerExecutionFailedAppTask(config, claim.taskId, {
        agent: "branch-owner",
        sessionId: "new-success",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
    expect(readAppTaskTrigger(config, claim.taskId)).toEqual({
      type: "project.comment.created",
      data: { project: "sample", comment: "Use the exact evidence paths" },
    });

    const recovered = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      reason: "execution-recovered",
    });
    if (recovered.kind !== "claimed") throw new Error("expected recovered claim");
    expect(recovered.events.map(({ event }) => event)).toEqual([
      { type: "project.task.tick", data: { reason: "initial" } },
      {
        type: "project.comment.created",
        data: { project: "sample", comment: "Use the exact evidence paths" },
      },
    ]);
  });

  it("replays a failed attempt batch before every newer pending event", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      trigger: { type: "sample.first", eventId: 701 },
    });
    expect(
      recordAppTaskTrigger(config, "pipeline-monitor", {
        type: "sample.second",
        eventId: 702,
      }),
    ).toEqual({ kind: "recorded" });
    const claim = claimObservedAppTask(config, {
      taskId: "pipeline-monitor",
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      reason: "event",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(claim.events.map(({ event }) => event.eventId)).toEqual([701, 702]);
    recordAppTaskAttemptSession(config, claim, "failed-batch-session");
    markAppTaskAttention(config, claim, {
      summary: "agent execution ended without a decision",
      reason: "HandlerExecutionFailed",
    });
    expect(
      recordAppTaskTrigger(config, claim.taskId, {
        type: "sample.third",
        eventId: 703,
      }),
    ).toEqual({ kind: "recorded" });

    expect(
      releaseHandlerExecutionFailedAppTask(config, claim.taskId, {
        agent: "branch-owner",
        sessionId: "new-success",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
    const replay = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      reason: "execution-recovered",
    });
    if (replay.kind !== "claimed") throw new Error("expected replay claim");
    expect(replay.events.map(({ event }) => event.eventId)).toEqual([701, 702, 703]);
  });

  it("does not revive repeated execution failures from unrelated agent success", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      trigger: { type: "project.task.tick", data: { reason: "initial" } },
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    recordAppTaskAttemptSession(config, first, "first-failed-session");
    markAppTaskAttention(config, first, {
      summary: "first agent execution failure",
      reason: "HandlerExecutionFailed",
    });
    expect(
      releaseHandlerExecutionFailedAppTask(config, first.taskId, {
        agent: "branch-owner",
        sessionId: "first-health-proof",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe(true);

    const second = declareAndClaimTask(config, {
      intent: intent(),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
      trigger: { type: "project.task.tick", data: { reason: "automatic-retry" } },
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");
    recordAppTaskAttemptSession(config, second, "second-failed-session");
    markAppTaskAttention(config, second, {
      summary: "second agent execution failure",
      reason: "HandlerExecutionFailed",
    });

    expect(
      releaseHandlerExecutionFailedAppTask(config, second.taskId, {
        agent: "branch-owner",
        sessionId: "unrelated-success",
        observedAt: "2100-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(readTaskState(config).resources?.[second.taskId].status.phase).toBe("attention");
  });

  it("accepts the current attempt after a status-only resource version change", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const concurrent = readTaskState(config);
    concurrent.resources![claim.taskId].metadata.resourceVersion += 1;
    concurrent.resources![claim.taskId].status.summary = "concurrent observation";
    saveTaskState(config, concurrent);

    expect(completeAppTask(config, claim, { summary: "current handler result" })).toMatchObject({
      status: "applied",
      actionsApplied: [],
    });
    expect(readTaskState(config).resources?.[claim.taskId]).toMatchObject({
      metadata: { resourceVersion: claim.resourceVersion + 2 },
      status: { phase: "converged", summary: "current handler result" },
    });
  });

  it("can release a stale current attempt so the task is judged again from current evidence", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const concurrent = readTaskState(config);
    concurrent.attempts![claim.attemptId].metadata.resourceVersion += 1;
    concurrent.attempts![claim.attemptId].specHash = "superseded-attempt-contract";
    saveTaskState(config, concurrent);

    expect(
      completeAppTask(config, claim, {
        summary: "late result",
        evidence: ["stale result must not apply actions"],
        actions: [
          {
            kind: "create-task",
            id: "stale-action-must-not-apply",
            parentId: "operations",
            outcome: "This task must not exist",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["Never applied"],
          },
        ],
      }),
    ).toMatchObject({ status: "stale", actionsApplied: [] });
    expect(readTaskState(config).tasks["stale-action-must-not-apply"]).toBeUndefined();

    expect(releaseStaleAppTaskResult(config, claim)).toEqual({
      status: "released",
      taskId: claim.taskId,
    });
    const tree = readTaskState(config);
    expect(tree.resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "pending",
      },
    });
    expect(tree.resources?.[claim.taskId].status.currentAttemptId).toBeUndefined();
    expect(tree.attempts?.[claim.attemptId]).toMatchObject({
      state: "interrupted",
      failureReason: "stale-reconciliation-result",
    });
    expect(listRunnableAppTaskIds(config)).toContain(claim.taskId);
  });

  it("applies handler actions atomically with reconciliation completion", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const applied = completeAppTask(config, claim, {
      summary: "owner proposed a bounded child",
      evidence: ["owner packet reviewed"],
      actions: [
        {
          kind: "create-task",
          id: "owner-created-task",
          parentId: "operations",
          outcome: "Verify the owner action boundary",
          mode: "achieve",
          outputs: ["proof.md"],
          acceptance: ["The reconciler creates this task"],
          input: { specId: "spec.network-cni.example" },
          dependsOn: ["categorized-task"],
        },
      ],
    });

    expect(applied).toEqual({
      status: "applied",
      actionsApplied: ["created owner-created-task"],
      dependentTaskIds: ["owner-created-task"],
      supersededSessionIds: [],
    });
    const tree = readTaskState(config);
    expect(tree.tasks["owner-created-task"]).toMatchObject({
      state: "backlog",
      owner: "branch-owner",
      revision: 1,
      reconcile_mode: "achieve",
      depends_on: ["categorized-task"],
    });
    expect(readAppTaskIntent(config, "owner-created-task")).toMatchObject({
      input: { specId: "spec.network-cni.example" },
      dependsOn: ["categorized-task"],
    });
    expect(tree.tasks["owner-created-task"].kind).toBeUndefined();
    expect(tree.tasks.operations.children).toContain("owner-created-task");
    expect(tree.resources?.["owner-created-task"]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending" },
    });
  });

  it("applies the same fenced action rules to runtime-prefixed task identities", () => {
    const { config } = fixture();
    const parentClaim = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "runtime/owner-review" },
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (parentClaim.kind !== "claimed") throw new Error("expected parent claim");

    expect(
      completeAppTask(config, parentClaim, {
        summary: "Owner review revised its desired execution",
        evidence: ["review:current"],
        actions: [
          {
            kind: "update-task",
            taskId: parentClaim.taskId,
            expectedGeneration: parentClaim.generation,
            outcome: "Keep the platform reviewed from current evidence",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["updated runtime/owner-review"],
      taskContinues: true,
    });

    const revised = readTaskState(config).resources?.["runtime/owner-review"];
    expect(revised?.spec.outcome).toBe("Keep the platform reviewed from current evidence");
    expect(revised?.metadata.generation).toBe(parentClaim.generation + 1);

    const nextClaim = claimObservedAppTask(config, {
      taskId: "runtime/owner-review",
      appAgent: "app-owner",
      handler: "agent:app-owner",
    });
    if (nextClaim.kind !== "claimed") throw new Error("expected revised claim");
    expect(
      completeAppTask(config, nextClaim, {
        summary: "Created one bounded follow-up",
        evidence: ["review:follow-up"],
        actions: [
          {
            kind: "create-task",
            id: "runtime/owner-review/follow-up",
            parentId: "runtime/owner-review",
            outcome: "Complete the bounded follow-up",
            mode: "achieve",
            outputs: [],
            acceptance: ["The follow-up is complete"],
            priority: "P2",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["created runtime/owner-review/follow-up"],
    });
  });

  it("lets a controller retry a known transient attention task without changing its generation", () => {
    const { config } = fixture();
    const retryIntent = {
      id: "retry-after-base-race",
      parentId: "operations",
      outcome: "Retry after the integration base moves",
      acceptance: ["The same task generation retries from current evidence"],
      mode: "achieve",
      workflow: "known-workflow",
    } as const;
    const failed = declareAndClaimTask(config, {
      intent: retryIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (failed.kind !== "claimed") throw new Error("expected failed claim");
    expect(
      markAppTaskAttention(config, failed, {
        summary: "integration base changed",
        reason: "transient-base-race",
      }),
    ).toMatchObject({ status: "applied" });

    const controller = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:controller",
    });
    if (controller.kind !== "claimed") throw new Error("expected controller claim");
    expect(
      completeAppTask(config, controller, {
        summary: "retry transient attention",
        evidence: ["the integration base has stabilized"],
        actions: [
          {
            kind: "unblock-task",
            taskId: retryIntent.id,
            expectedGeneration: 1,
            reason: "Retry the same review against current origin/dev",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["unblocked retry-after-base-race"],
    });
    expect(readTaskState(config).resources?.[retryIntent.id]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending", observedGeneration: 0 },
    });
  });

  it("treats an unblock action whose target already advanced as stale", () => {
    const { config } = fixture();
    observeAppTaskIntent(config, {
      intent: {
        id: "already-advancing",
        parentId: "operations",
        outcome: "Continue work already admitted by another reconciliation",
        acceptance: ["The task is reconciled once"],
        mode: "achieve",
      },
      appAgent: "app-owner",
    });
    const controller = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:controller",
    });
    if (controller.kind !== "claimed") throw new Error("expected controller claim");

    expect(() =>
      completeAppTask(config, controller, {
        summary: "retry from the earlier snapshot",
        evidence: ["target was waiting when reviewed"],
        actions: [
          {
            kind: "unblock-task",
            taskId: "already-advancing",
            expectedGeneration: 1,
            reason: "Resume the target",
          },
        ],
      }),
    ).toThrow(AppTaskActionStaleError);
    expect(readTaskState(config).resources?.["already-advancing"]).toMatchObject({
      metadata: { generation: 1 },
      status: { phase: "pending" },
    });
  });

  it("rejects project as a fake workflow in observed intent", () => {
    const { config } = fixture();
    expect(() =>
      observeAppTaskIntent(config, {
        intent: {
          ...intent("achieve"),
          workflow: "project",
        },
        appAgent: "app-owner",
      }),
    ).toThrow("workflow must name a real workflow; omit workflow for agent-handled project work");
  });

  it("rejects project as a fake workflow in create actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "owner proposed a bounded child",
        evidence: ["owner packet reviewed"],
        actions: [
          {
            kind: "create-task",
            id: "owner-created-task",
            parentId: "operations",
            outcome: "Verify the owner action boundary",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["The reconciler creates this task"],
            owner: "branch-owner",
            workflow: "project",
          },
        ],
      }),
    ).toThrow("workflow must name a real workflow; omit workflow for agent-handled project work");
    expect(readTaskState(config).tasks["owner-created-task"]).toBeUndefined();
  });

  it("updates task mode without overwriting its domain category", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeAppTask(config, claim, {
        summary: "updated categorized task",
        evidence: ["task schema review"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            mode: "achieve",
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    const task = readTaskState(config).tasks["categorized-task"];
    expect(task.reconcile_mode).toBe("achieve");
    expect(task.kind).toBe("domain");
  });

  it("repairs explicit agent and workflow bindings through an update action", () => {
    const { config } = fixture();
    const observed = observeAppTaskIntent(config, {
      intent: {
        id: "categorized-task",
        parentId: "operations",
        outcome: "Categorized bounded work",
        acceptance: ["The categorized work converges"],
        mode: "achieve",
        owner: "human",
        workflow: "removed-workflow",
        category: "domain",
      },
      appAgent: "app-owner",
    });
    if (observed.kind !== "observed") throw new Error("expected observation");

    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      completeAppTask(config, claim, {
        summary: "repaired stale binding",
        evidence: ["removed workflow is not registered"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: observed.generation,
            owner: "scout",
            workflow: null,
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    expect(readAppTaskIntent(config, "categorized-task")).toMatchObject({
      owner: "scout",
      category: "domain",
    });
    expect(readAppTaskIntent(config, "categorized-task")?.workflow).toBeUndefined();
    expect(readTaskState(config).resources?.["categorized-task"].metadata.generation).toBe(observed.generation + 1);
  });

  it("returns sessions superseded by a dependent update-task action", () => {
    const { config } = fixture();
    const targetIntent: AppTaskIntent = {
      id: "work/running-target",
      parentId: "operations",
      outcome: "Run the original target generation",
      acceptance: ["The current target generation converges"],
      mode: "achieve",
      workflow: "known-workflow",
    };
    const target = declareAndClaimTask(config, {
      intent: targetIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (target.kind !== "claimed") throw new Error("expected target claim");
    expect(associateAppTaskSession(config, target, "running-target-session")).toEqual({
      status: "recorded",
      taskId: targetIntent.id,
    });

    const carrier = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (carrier.kind !== "claimed") throw new Error("expected carrier claim");

    expect(
      completeAppTask(config, carrier, {
        summary: "Advanced the dependent target",
        evidence: ["the dependent target needs revised execution intent"],
        actions: [
          {
            kind: "update-task",
            taskId: targetIntent.id,
            expectedGeneration: target.generation,
            outcome: "Run the revised target generation",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: [`updated ${targetIntent.id}`],
      supersededSessionIds: ["running-target-session"],
    });

    const targetResource = readTaskState(config).resources?.[targetIntent.id];
    expect(targetResource).toMatchObject({
      metadata: { generation: target.generation + 1 },
      status: { phase: "pending" },
    });
  });

  it("rejects an invalid action batch without partially applying earlier actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid batch",
        evidence: ["batch validation test"],
        actions: [
          {
            kind: "create-task",
            id: "must-roll-back",
            parentId: "operations",
            outcome: "Must not be persisted",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
          {
            kind: "close-task",
            taskId: "missing-task",
            expectedGeneration: 1,
            summary: "invalid",
          },
        ],
      }),
    ).toThrow("Handler action task not found: missing-task");
    const tree = readTaskState(config);
    expect(tree.tasks["must-roll-back"]).toBeUndefined();
    expect(tree.tasks[claim.taskId].state).toBe("active");
  });

  it("rejects task actions that declare outputs outside app and domain roots", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid output root",
        evidence: ["path boundary test"],
        actions: [
          {
            kind: "create-task",
            id: "must-not-escape",
            parentId: "operations",
            outcome: "Write outside the project",
            mode: "achieve",
            outputs: ["../../outside/result.txt"],
            acceptance: ["Never accepted"],
            priority: "P2",
          },
        ],
      }),
    ).toThrow("escapes the app/domain roots");
    expect(readTaskState(config).tasks["must-not-escape"]).toBeUndefined();
  });

  it("treats repeated close actions against already receipted tasks as idempotent", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");

    expect(
      completeAppTask(config, first, {
        summary: "close completed child",
        evidence: ["first reconciliation"],
        actions: [
          {
            kind: "close-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            summary: "child finished",
          },
        ],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["closed categorized-task"] });

    const second = declareAndClaimTask(config, {
      intent: {
        id: "route-review",
        parentId: "operations",
        outcome: "Review route residue",
        acceptance: ["Route residue is reconciled"],
        mode: "achieve",
        workflow: "known-workflow",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (second.kind !== "claimed") throw new Error("expected second claim");

    expect(
      completeAppTask(config, second, {
        summary: "stale child close observed",
        evidence: ["second reconciliation"],
        actions: [
          {
            kind: "close-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            summary: "already finished",
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["already completed categorized-task"],
    });

    const tree = readTaskState(config);
    expect(tree.tasks["categorized-task"]).toBeUndefined();
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
    expect(tree.tasks["route-review"]).toBeUndefined();
  });

  it("rejects update actions against completed task receipts", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    completeAppTask(config, first, {
      summary: "close completed child",
      evidence: ["first reconciliation"],
      actions: [
        {
          kind: "close-task",
          taskId: "categorized-task",
          expectedGeneration: 1,
          summary: "child finished",
        },
      ],
    });

    const review = declareAndClaimTask(config, {
      intent: {
        id: "receipt-update-review",
        parentId: "operations",
        outcome: "Review a completed task",
        acceptance: ["Completed work is handled truthfully"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeAppTask(config, review, {
        summary: "attempted completed-task update",
        evidence: ["receipt inspection"],
        actions: [
          {
            kind: "update-task",
            taskId: "categorized-task",
            expectedGeneration: 1,
            mode: "maintain",
          },
        ],
      }),
    ).toThrow("Handler update-task action cannot mutate completed task categorized-task; create a new linked task");

    const tree = readTaskState(config);
    expect(tree.tasks["receipt-update-review"]?.state).toBe("active");
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
  });

  it("rejects create actions that reuse a completed task identity", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (first.kind !== "claimed") throw new Error("expected first claim");
    completeAppTask(config, first, {
      summary: "close completed child",
      evidence: ["first reconciliation"],
      actions: [
        {
          kind: "close-task",
          taskId: "categorized-task",
          expectedGeneration: 1,
          summary: "child finished",
        },
      ],
    });

    const review = declareAndClaimTask(config, {
      intent: {
        id: "receipt-create-review",
        parentId: "operations",
        outcome: "Review a completed task identity",
        acceptance: ["Completed identities are not reused"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeAppTask(config, review, {
        summary: "attempted completed-task recreation",
        evidence: ["receipt inspection"],
        actions: [
          {
            kind: "create-task",
            id: "categorized-task",
            parentId: "operations",
            outcome: "Reuse a completed identity",
            acceptance: ["This action must be rejected"],
            mode: "achieve",
            outputs: [],
            priority: "P2",
          },
        ],
      }),
    ).toThrow("Handler action task already exists or completed: categorized-task");

    const tree = readTaskState(config);
    expect(tree.tasks["receipt-create-review"]?.state).toBe("active");
    expect(tree.receipts?.["categorized-task"]).toBeDefined();
  });

  it("treats an identical create action for an existing live task as idempotent", () => {
    const { config } = fixture();
    const childIntent: AppTaskIntent = {
      id: "already-created-child",
      parentId: "operations",
      outcome: "Complete deterministic child work",
      acceptance: ["The child converges once"],
      mode: "achieve",
      owner: "branch-owner",
      workflow: "known-workflow",
      input: { workKey: "same-work" },
      outputs: ["proof.md"],
      priority: "P1",
    };
    observeAppTaskIntent(config, { intent: childIntent, appAgent: "app-owner" });
    const review = declareAndClaimTask(config, {
      intent: {
        id: "live-create-review",
        parentId: "operations",
        outcome: "Reconcile deterministic child creation",
        acceptance: ["Concurrent creation is harmless"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(
      completeAppTask(config, review, {
        summary: "the desired child already exists",
        evidence: ["current task resource"],
        actions: [{ kind: "create-task", ...childIntent }],
      }),
    ).toMatchObject({ status: "applied", actionsApplied: ["already exists already-created-child"] });
    const tree = readTaskState(config);
    expect(tree.resources?.["already-created-child"]?.metadata.generation).toBe(1);
    expect(tree.resources?.["live-create-review"]?.status.phase).toBe("converged");
  });

  it("rejects an existing live task with a different specification", () => {
    const { config } = fixture();
    const review = declareAndClaimTask(config, {
      intent: {
        id: "live-create-conflict-review",
        parentId: "operations",
        outcome: "Reject conflicting deterministic child creation",
        acceptance: ["Intent is not overwritten"],
        mode: "maintain",
      },
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (review.kind !== "claimed") throw new Error("expected review claim");

    expect(() =>
      completeAppTask(config, review, {
        summary: "attempted conflicting reuse",
        evidence: ["current task resource"],
        actions: [
          {
            kind: "create-task",
            id: "categorized-task",
            parentId: "operations",
            outcome: "Replace existing intent",
            acceptance: ["This action must be rejected"],
            mode: "achieve",
            outputs: [],
          },
        ],
      }),
    ).toThrow("Handler action task already exists with a different specification: categorized-task");
    expect(readTaskState(config).resources?.["categorized-task"]?.spec.outcome).toBe("Categorized bounded work");
  });

  it("rejects malformed action payloads and blank evidence before mutation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "agent:branch-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid runtime payload",
        evidence: ["  "],
        actions: [
          {
            kind: "create-task",
            id: "must-not-apply",
            parentId: "operations",
            outcome: "Must not be persisted",
            mode: "achieve",
            outputs: ["proof.md"],
            acceptance: ["No partial apply"],
          },
        ],
      }),
    ).toThrow("require non-empty evidence");
    expect(readTaskState(config).tasks["must-not-apply"]).toBeUndefined();

    expect(() =>
      completeAppTask(config, claim, {
        summary: "invalid runtime payload",
        evidence: ["runtime validation test"],
        actions: [{ kind: "create-task", id: "bad-shape" } as never],
      }),
    ).toThrow("parentId requires a non-empty string");
    expect(readTaskState(config).tasks["bad-shape"]).toBeUndefined();
    expect(readTaskState(config).tasks[claim.taskId].state).toBe("active");
  });

  it("ends waiting attempts only with an exact Condition", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without identity",
      }),
    ).toThrow("requires at least one exact Condition");
    expect(readTaskState(config).tasks[claim.taskId].state).toBe("active");

    expect(() =>
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting with an ambiguous condition",
        conditions: [{} as never],
      }),
    ).toThrow("Condition for pipeline-monitor identity requires a non-empty string");
    expect(readTaskState(config).tasks[claim.taskId].state).toBe("active");

    expect(() =>
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting without a type",
        conditions: [{ id: "session-terminal:s_1" } as never],
      }),
    ).toThrow("Condition session-terminal:s_1 type requires a non-empty string");

    const result = deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for the source session",
      evidence: ["source session is still running"],
      conditions: [
        {
          id: "session-terminal:s_1",
          type: "session.end",
          subject: "session:s_1",
          expected: "done",
        },
      ],
    });
    expect(result.status).toBe("applied");
    const task = readTaskState(config).tasks[claim.taskId];
    expect(task.state).toBe("blocked");
    expect(readTaskState(config).resources?.[claim.taskId]).toMatchObject({
      status: {
        phase: "waiting",
        conditionIds: ["session-terminal:s_1"],
      },
    });
    expect(readTaskState(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      metadata: {
        id: "session-terminal:s_1",
        generation: 1,
        resourceVersion: 1,
      },
      spec: {
        type: "session.end",
        subject: "session:s_1",
        expected: "done",
      },
      status: { observedGeneration: 0, state: "unknown" },
    });

    const timerWake = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(timerWake).toMatchObject({
      kind: "waiting",
      taskId: "pipeline-monitor",
      conditionIds: ["session-terminal:s_1"],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "session.end",
        sessionId: "s_other",
        status: "done",
      }),
    ).toEqual([]);

    const wakes = trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "s_1",
      status: "done",
      source: "test",
    });
    expect(wakes).toMatchObject([
      {
        conditionId: "session-terminal:s_1",
        taskId: "pipeline-monitor",
      },
    ]);
    expect(readTaskState(config).conditions?.["session-terminal:s_1"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: {
        observedGeneration: 1,
        state: "true",
        observed: { eventType: "session.end", sessionId: "s_1", state: "done" },
      },
    });

    const resumed = claimObservedAppTask(config, {
      taskId: wakes[0].taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:session-terminal:s_1",
    });
    expect(resumed.kind).toBe("claimed");
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    completeAppTask(config, resumed, { summary: "session terminal observed" });
    expect(readTaskState(config).conditions?.["session-terminal:s_1"]).toBeUndefined();
    expect(readTaskState(config).tasks["pipeline-monitor"].blocker).toBeUndefined();
  });

  it("consumes an unrelated trigger queued while the task installs a wait", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "work/queued-pulse" },
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      recordAppTaskTrigger(config, claim.taskId, {
        type: "project.task.tick",
        data: { taskId: claim.taskId, reason: "periodic-pulse" },
      }),
    ).toEqual({ kind: "recorded" });

    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for pipeline completion",
      conditions: [
        {
          id: "pipeline-run:42:completed",
          type: "pipeline-run.state",
          subject: "pipeline-run:42",
          expected: "completed",
        },
      ],
    });

    expect(readAppTaskTrigger(config, claim.taskId)).toBeUndefined();
    expect(
      claimObservedAppTask(config, {
        taskId: claim.taskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "waiting", conditionIds: ["pipeline-run:42:completed"] });
  });

  it("preserves a queued trigger that satisfies the wait installed by the attempt", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "work/queued-completion" },
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const completion = {
      type: "pipeline-run.state",
      pipelineRunId: "42",
      state: "completed",
      source: "pipeline-watcher",
    };
    expect(recordAppTaskTrigger(config, claim.taskId, completion)).toEqual({ kind: "recorded" });

    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for pipeline completion",
      conditions: [
        {
          id: "pipeline-run:42:completed",
          type: "pipeline-run.state",
          subject: "pipeline-run:42",
          expected: "completed",
        },
      ],
    });

    expect(readTaskState(config).conditions?.["pipeline-run:42:completed"]?.status.state).toBe("true");
    expect(readAppTaskTrigger(config, claim.taskId)).toEqual(completion);
    const resumed = claimObservedAppTask(config, {
      taskId: claim.taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    expect(resumed).toMatchObject({ kind: "claimed", trigger: completion });
  });

  it("keeps later Condition events pending while an earlier Condition event is reconciling", () => {
    const { config } = fixture();
    const initial = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "work/two-conditions" },
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (initial.kind !== "claimed") throw new Error("expected initial claim");
    deferAppTask(config, initial, {
      disposition: "waiting",
      summary: "waiting for either dependency update",
      conditions: [
        {
          id: "dependency:a",
          type: "project.task.reconciled",
          subject: "task:dependency-a",
          expected: "done",
        },
        {
          id: "dependency:b",
          type: "project.task.reconciled",
          subject: "task:dependency-b",
          expected: "done",
        },
      ],
    });

    const firstEvent = {
      type: "project.task.reconciled",
      eventId: 801,
      taskId: "dependency-a",
      state: "converged",
    };
    expect(trackAppTaskConditionEvent(config, firstEvent)).toMatchObject([
      { conditionId: "dependency:a", taskId: "work/two-conditions" },
    ]);
    const first = claimObservedAppTask(config, {
      taskId: "work/two-conditions",
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:dependency:a",
    });
    if (first.kind !== "claimed") throw new Error("expected first Condition claim");
    expect(first.events.map(({ event }) => event.eventId)).toEqual([801]);

    const secondEvent = {
      type: "project.task.reconciled",
      eventId: 802,
      taskId: "dependency-b",
      state: "converged",
    };
    expect(trackAppTaskConditionEvent(config, secondEvent)).toMatchObject([
      { conditionId: "dependency:b", taskId: "work/two-conditions" },
    ]);
    expect(trackAppTaskConditionEvent(config, secondEvent)).toEqual([]);
    expect(
      completeAppTask(config, first, {
        summary: "observed dependency A",
        evidence: ["event:801"],
      }),
    ).toMatchObject({ status: "applied", taskContinues: true });

    const second = claimObservedAppTask(config, {
      taskId: "work/two-conditions",
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "condition:dependency:b",
    });
    if (second.kind !== "claimed") throw new Error("expected second Condition claim");
    expect(second.events.map(({ event }) => event.eventId)).toEqual([802]);
  });

  it("keeps a decomposition parent open while applying child task actions", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("achieve"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "declared bounded child work for the parent",
        evidence: ["frontier selected child-a and child-b"],
        actions: [
          {
            kind: "create-task",
            id: "work/child-a",
            parentId: claim.taskId,
            outcome: "Finish child A",
            acceptance: ["Child A converges"],
            mode: "achieve",
            outputs: [],
          },
          {
            kind: "create-task",
            id: "work/child-b",
            parentId: claim.taskId,
            outcome: "Finish child B",
            acceptance: ["Child B converges"],
            mode: "achieve",
            outputs: [],
          },
        ],
      }),
    ).toMatchObject({
      status: "applied",
      actionsApplied: ["created work/child-a", "created work/child-b"],
    });

    const tree = readTaskState(config);
    expect(tree.tasks[claim.taskId]).toMatchObject({
      state: "blocked",
      children: ["work/child-a", "work/child-b"],
    });
    expect(tree.resources?.[claim.taskId]?.status).toMatchObject({
      phase: "waiting",
      conditionIds: [],
    });
    expect(tree.tasks["work/child-a"]).toMatchObject({ parent_id: claim.taskId, state: "backlog" });
    expect(tree.tasks["work/child-b"]).toMatchObject({ parent_id: claim.taskId, state: "backlog" });
    expect(tree.conditions ?? {}).toEqual({});
    expect(listRunnableAppTaskIds(config)).toEqual(expect.arrayContaining(["work/child-a", "work/child-b"]));
  });

  it("delivers every child transition to the parent in one ordered event batch", () => {
    const { config } = fixture();
    const parent = declareAndClaimTask(config, {
      intent: { ...intent("maintain"), id: "work/parent-batch" },
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (parent.kind !== "claimed") throw new Error("expected parent claim");
    const child = (id: string) => ({
      kind: "create-task" as const,
      id,
      parentId: parent.taskId,
      outcome: `Complete ${id}`,
      acceptance: [`${id} converges`],
      mode: "achieve" as const,
      outputs: [],
      priority: "P2" as const,
    });
    expect(
      deferAppTask(config, parent, {
        disposition: "waiting",
        summary: "waiting for both children",
        evidence: ["decomposition:two-children"],
        actions: [child("work/child-one"), child("work/child-two")],
      }),
    ).toMatchObject({ status: "applied" });

    for (const childTaskId of ["work/child-one", "work/child-two"]) {
      const childClaim = claimObservedAppTask(config, {
        taskId: childTaskId,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "child",
      });
      if (childClaim.kind !== "claimed") throw new Error(`expected claim for ${childTaskId}`);
      expect(
        completeAppTask(config, childClaim, {
          summary: `${childTaskId} converged`,
          evidence: [`proof:${childTaskId}`],
        }),
      ).toMatchObject({ status: "applied", dependentTaskIds: [parent.taskId] });
    }

    const resumed = claimObservedAppTask(config, {
      taskId: parent.taskId,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
      reason: "children-transitioned",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed parent claim");
    expect(resumed.events.map(({ event }) => event.childTaskId)).toEqual(["work/child-one", "work/child-two"]);
  });

  it("filters task Conditions by subject and expected state", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for dependency completion",
      conditions: [
        {
          id: "task-done:dependency-1",
          type: "project.task.reconciled",
          subject: "task:dependency-1",
          expected: "done",
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-2",
        disposition: "converged",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "waiting",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-1",
        disposition: "converged",
      }),
    ).toMatchObject([{ conditionId: "task-done:dependency-1", taskId: "pipeline-monitor" }]);
  });

  it("wakes an exact pipeline-run Condition from a watcher observation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for pipeline",
      evidence: [],
      conditions: [
        {
          id: "pipeline:run-42",
          type: "project.test_run.completed",
          subject: "pipeline-run:run-42",
          expected: { field: "status", equals: "passed" },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.test_run.completed",
        pipelineRunId: "run-42",
        status: "failed",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.test_run.completed",
        pipelineRunId: "run-42",
        status: "passed",
        source: "aks-pipeline-watcher",
      }),
    ).toMatchObject([{ conditionId: "pipeline:run-42", taskId: "pipeline-monitor" }]);
  });

  it("wakes every task linked to the same typed Condition", () => {
    const { config } = fixture();
    const intents = ["pipeline-a", "pipeline-b"].map((id) => ({
      ...intent("maintain"),
      id,
      outcome: `Keep ${id} current`,
    }));
    for (const taskIntent of intents) {
      const claim = declareAndClaimTask(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (claim.kind !== "claimed") throw new Error("expected claim");
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "waiting for the shared dependency",
        conditions: [
          {
            id: "shared-dependency",
            type: "project.task.reconciled",
            subject: "task:dependency-shared",
            expected: "done",
          },
        ],
      });
    }

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.task.reconciled",
        taskId: "dependency-shared",
        state: "converged",
      }).map((wake) => wake.taskId),
    ).toEqual(["pipeline-a", "pipeline-b"]);
    expect(readTaskState(config).conditions?.["shared-dependency"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 2 },
      status: { observedGeneration: 1, state: "true" },
    });

    for (const taskIntent of intents) {
      const resumed = declareAndClaimTask(config, {
        intent: taskIntent,
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      });
      if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
      completeAppTask(config, resumed, { summary: `${taskIntent.id} converged` });
    }
    expect(readTaskState(config).conditions?.["shared-dependency"]).toBeUndefined();
  });

  it("rejects changing a shared Condition specification", () => {
    const { config } = fixture();
    const firstIntent = { ...intent("maintain"), id: "pipeline-a" };
    const secondIntent = { ...intent("maintain"), id: "pipeline-b" };
    const first = declareAndClaimTask(config, {
      intent: firstIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    const second = declareAndClaimTask(config, {
      intent: secondIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed" || second.kind !== "claimed") throw new Error("expected claims");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for shared session",
      conditions: [
        {
          id: "shared-session",
          type: "session.end",
          subject: "session:first",
          expected: "done",
        },
      ],
    });

    expect(() =>
      deferAppTask(config, second, {
        disposition: "waiting",
        summary: "attempted conflicting wait",
        conditions: [
          {
            id: "shared-session",
            type: "session.end",
            subject: "session:other",
            expected: "done",
          },
        ],
      }),
    ).toThrow("already linked to another task with a different specification");
  });

  it("consumes a satisfied Condition before waiting for the same observation again", () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    const condition = {
      id: "session-terminal",
      type: "session.end",
      subject: "session:repeatable",
      expected: "done",
    } as const;
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for first observation",
      conditions: [condition],
    });
    trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "repeatable",
      status: "done",
    });
    const resumed = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    expect(readTaskState(config).conditions?.[condition.id]).toBeUndefined();

    deferAppTask(config, resumed, {
      disposition: "waiting",
      summary: "waiting for a new observation",
      conditions: [condition],
    });
    expect(readTaskState(config).conditions?.[condition.id]).toMatchObject({
      status: { observedGeneration: 0, state: "unknown" },
    });
    expect(
      trackAppTaskConditionEvent(config, {
        type: "unrelated.event",
        sessionId: "repeatable",
        status: "done",
      }),
    ).toEqual([]);
  });

  it("does not replay an old level observation into a newly established state wait", async () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const condition = {
      id: "credential-ready:xhs",
      type: "credential.state",
      subject: "credential:xhs",
      expected: { field: "state", equals: "ready" },
    } as const;
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for credential",
      conditions: [condition],
    });

    const readyObservation = {
      type: "credential.state",
      credential: "xhs",
      state: "ready",
      timestamp: Date.now(),
    };
    expect(trackAppTaskConditionEvent(config, readyObservation)).toEqual([
      { conditionId: condition.id, taskId: taskIntent.id },
    ]);
    const resumed = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    await new Promise((resolve) => setTimeout(resolve, 5));
    deferAppTask(config, resumed, {
      disposition: "waiting",
      summary: "credential was lost before use",
      conditions: [condition],
    });

    expect(trackAppTaskConditionEvent(config, readyObservation)).toEqual([]);
    expect(readTaskState(config).conditions?.[condition.id]).toMatchObject({
      status: { observedGeneration: 0, state: "unknown" },
    });
  });

  it("does not replay an old scheduled check into a newly established pulse wait", () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const condition = {
      id: "next-master-validation-check",
      type: "aks.master-validation.check",
      subject: "project:demo",
      expected: { field: "project", equals: "demo" },
    } as const;
    const oldPulse = {
      type: "aks.master-validation.check",
      project: "demo",
      timestamp: Date.now() - 10_000,
    };
    const first = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for the next scheduled check",
      conditions: [condition],
    });

    expect(trackAppTaskConditionEvent(config, oldPulse)).toEqual([]);
    expect(readTaskState(config).conditions?.[condition.id]).toMatchObject({
      status: { observedGeneration: 0, state: "unknown" },
    });

    expect(
      trackAppTaskConditionEvent(config, {
        ...oldPulse,
        timestamp: Date.now() + 1_000,
      }),
    ).toEqual([{ conditionId: condition.id, taskId: taskIntent.id }]);
  });

  it("does not replay an old capacity pulse into a future-slot wait", () => {
    const { config } = fixture();
    const taskIntent = intent("maintain");
    const condition = {
      id: "capacity-after-slot-82677:task-holder-a",
      type: "aks.master-validation.capacity-pulse",
      subject: "project:demo",
      expected: { field: "cycleSlot", notEquals: 82677 },
    } as const;
    const claim = declareAndClaimTask(config, {
      intent: taskIntent,
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for a future capacity slot",
      conditions: [condition],
    });
    const establishedAt = Date.parse(readTaskState(config).conditions?.[condition.id]?.status.observedAt ?? "");

    expect(
      trackAppTaskConditionEvent(config, {
        type: condition.type,
        project: "demo",
        cycleSlot: 82676,
        timestamp: establishedAt - 1,
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: condition.type,
        project: "demo",
        cycleSlot: 82677,
        timestamp: establishedAt + 1,
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: condition.type,
        project: "demo",
        cycleSlot: 82678,
        timestamp: establishedAt + 2,
      }),
    ).toEqual([{ conditionId: condition.id, taskId: taskIntent.id }]);
  });

  it("advances Condition generation when its desired observation changes", () => {
    const { config } = fixture();
    const first = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (first.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, first, {
      disposition: "waiting",
      summary: "waiting for first session",
      conditions: [
        {
          id: "session-terminal",
          type: "session.end",
          subject: "session:first",
          expected: "done",
        },
      ],
    });
    trackAppTaskConditionEvent(config, {
      type: "session.end",
      sessionId: "first",
      status: "done",
    });
    const resumed = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (resumed.kind !== "claimed") throw new Error("expected resumed claim");
    deferAppTask(config, resumed, {
      disposition: "waiting",
      summary: "waiting for replacement session",
      conditions: [
        {
          id: "session-terminal",
          type: "session.end",
          subject: "session:replacement",
          expected: "done",
        },
      ],
    });

    expect(readTaskState(config).conditions?.["session-terminal"]).toMatchObject({
      metadata: { generation: 1, resourceVersion: 1 },
      spec: { subject: "session:replacement" },
      status: { observedGeneration: 0, state: "unknown" },
    });
    expect(
      trackAppTaskConditionEvent(config, {
        type: "session.end",
        sessionId: "first",
        status: "done",
      }),
    ).toEqual([]);
  });

  it("matches exact app-specific event fields without an app-specific controller", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact approval",
      conditions: [
        {
          id: "approval-returned",
          type: "project.approval.submitted",
          subject: "approvalId:approval-42",
          expected: { field: "decision", anyOf: ["approve", "decline"] },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        approvalId: "approval-42",
        decision: "hold",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        data: { approvalId: "approval-42", decision: "approve" },
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "approval-returned" }]);
  });

  it("keeps approval-packet waits blocked when only the decision matches but the lineage does not", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const approvalId =
      "aks-rp-e2e:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const waitId =
      "wait:aks-rp-e2e:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const pathId = "ops/request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730";

    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact approval lineage",
      conditions: [
        {
          id: waitId,
          type: "project.approval.submitted",
          subject: "project:aks-rp-e2e",
          expected: {
            approvalKind: "approval-packet-dispatch",
            approvalId,
            waitId,
            pathId,
            acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
            field: "decision",
            anyOf: ["approve", "adjust", "hold", "decline", "reroute"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        project: "aks-rp-e2e",
        approvalKind: "approval-packet-dispatch",
        approvalId:
          "aks-rp-e2e:approval:node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730:evidence-archive-ops-send-node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730-packet.md",
        waitId:
          "wait:aks-rp-e2e:approval:node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730:evidence-archive-ops-send-node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730-packet.md",
        pathId: "node-pool-config-skip-gpu-driver-staging-gpu-vmsize-realization-owner-handoff-20260730",
        decision: "approve",
      }),
    ).toEqual([]);

    expect(readTaskState(config).conditions?.[waitId]).toMatchObject({
      status: { state: "unknown" },
    });
  });

  it("wakes approval-packet waits only when the returned event matches the exact lineage", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    const approvalId =
      "aks-rp-e2e:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const waitId =
      "wait:aks-rp-e2e:approval:ops-request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730:evidence-archive-ops-request-serverless-multi-pod-burst-stale-residue-worktree-cleanup-approval-20260730-packet.md";
    const pathId = "ops/request-approval-serverless-multi-pod-burst-stale-residue-worktree-cleanup-f1273011fd-20260730";

    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact approval lineage",
      conditions: [
        {
          id: waitId,
          type: "project.approval.submitted",
          subject: "project:aks-rp-e2e",
          expected: {
            approvalKind: "approval-packet-dispatch",
            approvalId,
            waitId,
            pathId,
            acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
            field: "decision",
            anyOf: ["approve", "adjust", "hold", "decline", "reroute"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.approval.submitted",
        project: "aks-rp-e2e",
        approvalKind: "approval-packet-dispatch",
        approvalId,
        waitId,
        pathId,
        decision: "approve",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: waitId }]);

    expect(readTaskState(config).conditions?.[waitId]).toMatchObject({
      status: {
        state: "true",
        observed: {
          eventType: "project.approval.submitted",
        },
      },
    });
  });

  it("matches owner decision conditions using allowedDecisions against event decision", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact owner decision",
      conditions: [
        {
          id: "owner-decision",
          type: "project.owner-decision.recorded",
          subject: "task:pipeline-monitor",
          expected: {
            taskBranch: "task/pipeline-monitor",
            headCommit: "abc123",
            allowedDecisions: ["abandon-legacy-merge", "extract-current-lineage-successor"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.owner-decision.recorded",
        taskId: "pipeline-monitor",
        taskBranch: "task/pipeline-monitor",
        headCommit: "abc123",
        decision: "hold",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.owner-decision.recorded",
        taskId: "pipeline-monitor",
        taskBranch: "task/pipeline-monitor",
        headCommit: "abc123",
        decision: "extract-current-lineage-successor",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "owner-decision" }]);
  });

  it("matches owner decision conditions using acceptedDecisions against event decision", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for exact owner decision",
      conditions: [
        {
          id: "owner-decision",
          type: "project.owner-decision.recorded",
          subject: "project:aks-rp-e2e",
          expected: {
            taskId: "pipeline-monitor",
            sourceBranch: "codex/source",
            acceptedDecisions: ["abandon-stale-lineage", "approve-fresh-current-lineage-app-routing-successor"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "project.owner-decision.recorded",
        project: "aks-rp-e2e",
        taskId: "pipeline-monitor",
        sourceBranch: "codex/source",
        decision: "approve-fresh-current-lineage-app-routing-successor",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "owner-decision" }]);
  });

  it("keeps waiting until the Condition observer reports state", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for external evidence",
      conditions: [
        {
          id: "pipeline-result",
          type: "pipeline.result.available",
          subject: "pipeline-run:run-42",
          expected: { field: "status", equals: "succeeded" },
        },
      ],
    });
    const stale = readTaskState(config);
    stale.conditions!["pipeline-result"].status.observedAt = "2026-01-01T00:00:00.000Z";
    saveTaskState(config, stale);

    expect(
      declareAndClaimTask(config, {
        intent: intent("maintain"),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
        reason: "periodic-resync",
      }),
    ).toMatchObject({ kind: "waiting", taskId: "pipeline-monitor", conditionIds: ["pipeline-result"] });
  });

  it("links a watcher event Condition without monitoring the pipeline itself", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "pipeline watcher will emit the terminal observation",
        conditions: [
          {
            id: "pipeline-run:42",
            type: "pipeline.completed",
            subject: "pipelineRun:42",
            expected: { field: "result", anyOf: ["succeeded", "failed"] },
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });
    const waitingTree = readTaskState(config);
    const task = waitingTree.tasks["pipeline-monitor"];
    expect(task.state).toBe("blocked");
    expect(waitingTree.resources?.["pipeline-monitor"]).toMatchObject({
      status: {
        phase: "waiting",
        conditionIds: ["pipeline-run:42"],
      },
    });
    expect(waitingTree.conditions?.["pipeline-run:42"]).toMatchObject({
      spec: {
        type: "pipeline.completed",
        subject: "pipelineRun:42",
      },
      status: { state: "unknown" },
    });
    expect(
      declareAndClaimTask(config, {
        intent: intent("maintain"),
        appAgent: "app-owner",
        handler: "workflow:known-workflow",
      }),
    ).toMatchObject({ kind: "waiting", conditionIds: ["pipeline-run:42"] });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pipeline.completed",
        pipelineRun: "42",
        result: "succeeded",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "pipeline-run:42" }]);
  });

  it("matches pull-request typed subjects through the generic Condition tracker", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for PR merge or review change",
      conditions: [
        {
          id: "pull-request-77-changed",
          type: "pull-request.state",
          subject: "pull-request:77",
          expected: {
            field: "state",
            anyOf: ["completed", "abandoned", "conflicted", "source-updated"],
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        state: "completed",
      }),
    ).toMatchObject([{ taskId: "pipeline-monitor", conditionId: "pull-request-77-changed" }]);
  });

  it("wakes when a level-observed PR source differs from the tested commit", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for PR source update",
      conditions: [
        {
          id: "pull-request-77-source-not-abc",
          type: "pull-request.state",
          subject: "pull-request:77",
          expected: { field: "sourceCommit", notEquals: "abc" },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        sourceCommit: "abc",
        state: "active",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "pull-request.state",
        pullRequestId: "77",
        sourceCommit: "def",
        state: "active",
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "pull-request-77-source-not-abc",
      },
    ]);
  });

  it("does not wake a new repo-ref wait from an older journal observation", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for origin/dev to advance",
      conditions: [
        {
          id: "origin-dev-after-abc",
          type: "aks.repo-ref.observed",
          subject: "repoRef:origin/dev",
          expected: { field: "commit", notEquals: "abc" },
        },
      ],
    });

    const establishedAt = Date.parse(
      readTaskState(config).conditions?.["origin-dev-after-abc"]?.status.observedAt ?? "",
    );
    expect(Number.isFinite(establishedAt)).toBe(true);

    expect(
      trackAppTaskConditionEvent(config, {
        type: "aks.repo-ref.observed",
        repoRef: "origin/dev",
        commit: "older-different-commit",
        timestamp: establishedAt - 1,
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "aks.repo-ref.observed",
        repoRef: "origin/dev",
        commit: "newer-different-commit",
        timestamp: establishedAt + 1,
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "origin-dev-after-abc",
      },
    ]);
  });

  it("supports future-only comparisons for level-based pipeline artifact facts", () => {
    const { config } = fixture();
    const claim = declareAndClaimTask(config, {
      intent: intent("maintain"),
      appAgent: "app-owner",
      handler: "workflow:known-workflow",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "waiting for the first later artifact",
      conditions: [
        {
          id: "artifact-after-100",
          type: "pipeline-artifact.available",
          subject: "project:sample",
          expected: {
            artifactName: "slice-06-test-results",
            sourceBranch: "refs/heads/main",
            pipelineRunId: { gt: "100" },
          },
        },
      ],
    });

    expect(
      trackAppTaskConditionEvent(config, {
        type: "pipeline-artifact.available",
        project: "sample",
        artifactName: "slice-06-test-results",
        sourceBranch: "refs/heads/main",
        pipelineRunId: "100",
      }),
    ).toEqual([]);
    expect(
      trackAppTaskConditionEvent(config, {
        type: "pipeline-artifact.available",
        project: "sample",
        artifactName: "slice-06-test-results",
        sourceBranch: "refs/heads/main",
        pipelineRunId: "101",
      }),
    ).toMatchObject([
      {
        taskId: "pipeline-monitor",
        conditionId: "artifact-after-100",
      },
    ]);
  });
});
