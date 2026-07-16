import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTaskTreePath } from "@may-agent/sdk";
import { peekTaskAssignments, taskTreeConfig } from "./lib/task-tree-tools.ts";
import {
  acknowledgePipelineConditionFallbackV2,
  claimPipelineConditionFallbackV2,
  ensureResolvedPipelineConditionAssignmentsV2,
  finishPipelineConditionFallbackV2,
  pipelineConditionId,
  resolvePipelineConditionV2,
  upsertPipelineConditionInTree,
} from "./lib/project-conditions.ts";
import { readTaskTree, saveTaskTree } from "./lib/task-tree-store.ts";

test("exact pipeline Condition resolves only its bound task revision", async () => {
  const appDir = await mkdtemp(join(tmpdir(), "project-condition-v2-"));
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify({
      root_task_id: "project",
      tasks: {
        project: { id: "project", state: "active", children: ["verify"] },
        verify: {
          id: "verify",
          revision: 3,
          parent_id: "project",
          state: "blocked",
          children: [],
          context: { controlPlaneVersion: 2 },
          blocker: { condition: "waiting" },
        },
      },
    })}\n`,
    "utf8",
  );
  const config = taskTreeConfig({
    appDir,
    projectDir: appDir,
    worker: "aks-explorer",
    maxConcurrent: 1,
  });
  const tree = readTaskTree(config);
  expect(() =>
    upsertPipelineConditionInTree(tree, {
      backend: "ado",
      runId: "172459471",
      runUrl: "https://dev.azure.com/example/172459471",
      taskId: "verify",
      taskRevision: 3,
      nextCheckAt: "2026-07-16T06:10:00.000Z",
      fallbackAt: "2026-07-16T08:00:00.000Z",
      fallbackAction: "escalate",
      now: "2026-07-16T06:00:00.000Z",
    }),
  ).toThrow(/writer is disabled/);
  const condition = upsertPipelineConditionInTree(tree, {
    mode: "exact-ado-revisioned",
    backend: "ado",
    runId: "172459471",
    runUrl: "https://dev.azure.com/example/172459471",
    taskId: "verify",
    taskRevision: 3,
    nextCheckAt: "2026-07-16T06:10:00.000Z",
    fallbackAt: "2026-07-16T08:00:00.000Z",
    fallbackAction: "escalate",
    now: "2026-07-16T06:00:00.000Z",
  });
  saveTaskTree(config, tree);

  const stale = resolvePipelineConditionV2(config, {
    mode: "exact-ado-revisioned",
    conditionId: condition.id,
    backend: "ado",
    runId: "172459471",
    taskId: "verify",
    taskRevision: 2,
    resolvedAt: "2026-07-16T06:05:00.000Z",
    resolution: { status: "completed" },
  });
  expect(stale).toMatchObject({
    applied: false,
    reason: "condition correlation mismatch",
  });

  const resolved = resolvePipelineConditionV2(config, {
    mode: "exact-ado-revisioned",
    conditionId: pipelineConditionId("ado", "172459471"),
    backend: "ado",
    runId: "172459471",
    taskId: "verify",
    taskRevision: 3,
    resolvedAt: "2026-07-16T06:05:00.000Z",
    resolution: { status: "completed", result: "succeeded" },
  });
  expect(resolved).toMatchObject({ applied: true, replayed: false });
  const updated = JSON.parse(
    await readFile(resolveTaskTreePath(appDir), "utf8"),
  );
  expect(updated.conditions[condition.id].status).toBe("resolved");
  expect(updated.tasks.verify.state).toBe("backlog");
  expect(updated.tasks.verify.revision).toBe(3);
  expect(updated.tasks.verify.blocker).toBeUndefined();

  const replay = resolvePipelineConditionV2(config, {
    mode: "exact-ado-revisioned",
    conditionId: condition.id,
    backend: "ado",
    runId: "172459471",
    taskId: "verify",
    taskRevision: 3,
    resolvedAt: "2026-07-16T06:06:00.000Z",
    resolution: { status: "completed", result: "succeeded" },
  });
  expect(replay).toMatchObject({ applied: true, replayed: true });

  const conflictingTree = readTaskTree(config);
  conflictingTree.tasks.other = {
    id: "other",
    revision: 3,
    parent_id: "project",
    state: "blocked",
    children: [],
  };
  expect(() =>
    upsertPipelineConditionInTree(conflictingTree, {
      mode: "exact-ado-revisioned",
      backend: "ado",
      runId: "172459471",
      runUrl: "https://dev.azure.com/example/172459471",
      taskId: "other",
      taskRevision: 3,
      nextCheckAt: "2026-07-16T06:20:00.000Z",
      fallbackAt: "2026-07-16T08:00:00.000Z",
      fallbackAction: "escalate",
      now: "2026-07-16T06:10:00.000Z",
    }),
  ).toThrow(/already belongs to verify revision 3/);

  const driftTree = readTaskTree(config);
  driftTree.tasks.drift = {
    id: "drift",
    revision: 4,
    parent_id: "project",
    state: "review",
    children: [],
    context: { controlPlaneVersion: 2 },
  };
  driftTree.tasks.project.children.push("drift");
  const driftCondition = upsertPipelineConditionInTree(driftTree, {
    mode: "exact-ado-revisioned",
    backend: "ado",
    runId: "172459472",
    runUrl: "https://dev.azure.com/example/172459472",
    taskId: "drift",
    taskRevision: 4,
    nextCheckAt: "2026-07-16T06:20:00.000Z",
    fallbackAt: "2026-07-16T08:00:00.000Z",
    fallbackAction: "escalate",
    now: "2026-07-16T06:10:00.000Z",
  });
  saveTaskTree(config, driftTree);
  const factOnly = resolvePipelineConditionV2(config, {
    mode: "exact-ado-revisioned",
    conditionId: driftCondition.id,
    backend: "ado",
    runId: "172459472",
    taskId: "drift",
    taskRevision: 4,
    resolvedAt: "2026-07-16T06:15:00.000Z",
    resolution: { status: "completed", result: "failed" },
  });
  expect(factOnly).toMatchObject({
    applied: true,
    replayed: false,
    reconciled: false,
    reason: "condition resolved; subject is review, not blocked",
  });
  const factOnlyTree = readTaskTree(config) as any;
  expect(factOnlyTree.conditions[driftCondition.id].status).toBe("resolved");
  expect(factOnlyTree.tasks.drift.state).toBe("review");
});

test("pending Condition continuations are not starved by assigned history", async () => {
  const appDir = await mkdtemp(join(tmpdir(), "project-condition-pending-v2-"));
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  const pendingConditionId = pipelineConditionId("ado", "999999999");
  const pendingRecoveryKey = `condition-continuation:${pendingConditionId}:3`;
  const assignedHistory = Object.fromEntries(
    Array.from({ length: 25 }, (_, index) => {
      const runId = String(index).padStart(9, "0");
      const conditionId = pipelineConditionId("ado", runId);
      return [
        conditionId,
        {
          version: "project-condition-v2",
          id: conditionId,
          causeKey: `pipeline:ado:${runId}:terminal`,
          class: "external",
          type: "pipeline.run.terminal",
          status: "resolved",
          backend: "ado",
          runId,
          runUrl: `https://dev.azure.com/example/${runId}`,
          subject: { kind: "task", id: `archived-${runId}`, revision: 1 },
          owner: "ado",
          observer: "project-execution-watchdog",
          observationMethod: "exact run",
          resumeCondition: "run is terminal",
          nextCheckAt: "2026-07-16T06:00:00.000Z",
          fallbackAt: "2026-07-16T08:00:00.000Z",
          fallbackAction: "escalate",
          createdAt: "2026-07-16T06:00:00.000Z",
          updatedAt: "2026-07-16T06:00:00.000Z",
          continuation: {
            recoveryKey: `condition-continuation:${conditionId}:1`,
            kind: "dispatch-subject",
            status: "assigned",
            createdAt: "2026-07-16T06:00:00.000Z",
            assignedAt: "2026-07-16T06:01:00.000Z",
            assignment: {
              taskId: `archived-${runId}`,
              taskRevision: 1,
              attemptId: `attempt-${runId}`,
              sessionId: `session-${runId}`,
              worker: "aks-explorer",
              assignedAt: "2026-07-16T06:01:00.000Z",
            },
          },
        },
      ];
    }),
  );
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify({
      root_task_id: "project",
      tasks: {
        project: { id: "project", state: "active", children: ["pending"] },
        pending: {
          id: "pending",
          revision: 3,
          parent_id: "project",
          state: "backlog",
          children: [],
          owner: "aks-explorer",
          goal: "Inspect the exact terminal pipeline artifact.",
          outputs: ["runs/test-results/spec.json"],
          acceptance: ["Record the exact artifact result."],
          context: {
            controlPlaneVersion: 2,
            conditionContinuationKey: pendingRecoveryKey,
          },
        },
      },
      conditions: {
        ...assignedHistory,
        [pendingConditionId]: {
          version: "project-condition-v2",
          id: pendingConditionId,
          causeKey: "pipeline:ado:999999999:terminal",
          class: "external",
          type: "pipeline.run.terminal",
          status: "resolved",
          backend: "ado",
          runId: "999999999",
          runUrl: "https://dev.azure.com/example/999999999",
          subject: { kind: "task", id: "pending", revision: 3 },
          owner: "ado",
          observer: "project-execution-watchdog",
          observationMethod: "exact run",
          resumeCondition: "run is terminal",
          nextCheckAt: "2026-07-16T06:00:00.000Z",
          fallbackAt: "2026-07-16T08:00:00.000Z",
          fallbackAction: "escalate",
          createdAt: "2026-07-16T06:00:00.000Z",
          updatedAt: "2026-07-16T06:00:00.000Z",
          continuation: {
            recoveryKey: pendingRecoveryKey,
            kind: "dispatch-subject",
            status: "pending",
            createdAt: "2026-07-16T06:00:00.000Z",
          },
        },
      },
    })}\n`,
    "utf8",
  );
  const config = taskTreeConfig({
    appDir,
    projectDir: appDir,
    worker: "aks-explorer",
    maxConcurrent: 1,
  });

  const assignments = ensureResolvedPipelineConditionAssignmentsV2(config, {
    mode: "exact-ado-revisioned",
    limit: 20,
  });

  expect(assignments).toHaveLength(1);
  expect(assignments[0]).toMatchObject({ taskId: "pending", taskRevision: 3 });
  expect(peekTaskAssignments(config)).toHaveLength(1);
  const updated = readTaskTree(config) as any;
  expect(updated.conditions[pendingConditionId].continuation.status).toBe(
    "assigned",
  );
});

test("fallback delivery acknowledgement is correlated, durable, and replay-safe", async () => {
  const appDir = await mkdtemp(
    join(tmpdir(), "project-condition-fallback-v2-"),
  );
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  const taskId = "wait-exact-run";
  const conditionId = pipelineConditionId("ado", "172500009");
  const recoveryKey = `condition-fallback:${conditionId}:2`;
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify({
      root_task_id: "project",
      tasks: {
        project: { id: "project", state: "active", children: [taskId] },
        [taskId]: {
          id: taskId,
          revision: 2,
          parent_id: "project",
          state: "blocked",
          children: [],
          context: { controlPlaneVersion: 2, conditionId },
          blocker: { condition: "waiting", condition_id: conditionId },
        },
      },
      conditions: {
        [conditionId]: {
          version: "project-condition-v2",
          id: conditionId,
          causeKey: "pipeline:ado:172500009:terminal",
          class: "external",
          type: "pipeline.run.terminal",
          status: "open",
          backend: "ado",
          runId: "172500009",
          runUrl: "https://dev.azure.com/example/172500009",
          subject: { kind: "task", id: taskId, revision: 2 },
          owner: "ado",
          observer: "project-execution-watchdog",
          observationMethod: "exact run",
          resumeCondition: "run is terminal",
          nextCheckAt: "2026-07-16T06:00:00.000Z",
          fallbackAt: "2026-07-16T06:10:00.000Z",
          fallbackAction: "escalate",
          createdAt: "2026-07-16T06:00:00.000Z",
          updatedAt: "2026-07-16T06:10:00.000Z",
          fallbackExecution: {
            recoveryKey,
            claimId: `${recoveryKey}:claim`,
            status: "dispatched",
            attempts: 1,
            claimedAt: "2026-07-16T06:10:00.000Z",
            leaseExpiresAt: "2026-07-16T06:15:00.000Z",
            observation: { status: "inProgress" },
            dispatchedAt: "2026-07-16T06:10:01.000Z",
          },
        },
      },
    })}\n`,
    "utf8",
  );
  const config = taskTreeConfig({
    appDir,
    projectDir: appDir,
    worker: "aks-explorer",
    maxConcurrent: 1,
  });

  expect(
    acknowledgePipelineConditionFallbackV2(config, {
      mode: "exact-ado-revisioned",
      conditionId,
      recoveryKey: `${recoveryKey}:wrong`,
      taskId,
      taskRevision: 2,
      acknowledgedAt: "2026-07-16T06:11:00.000Z",
      acknowledgedBy: "project-planner",
    }),
  ).toMatchObject({ applied: false, replayed: false });

  const acknowledged = acknowledgePipelineConditionFallbackV2(config, {
    mode: "exact-ado-revisioned",
    conditionId,
    recoveryKey,
    taskId,
    taskRevision: 2,
    acknowledgedAt: "2026-07-16T06:11:00.000Z",
    acknowledgedBy: "project-planner",
  });
  expect(acknowledged).toMatchObject({ applied: true, replayed: false });
  const replay = acknowledgePipelineConditionFallbackV2(config, {
    mode: "exact-ado-revisioned",
    conditionId,
    recoveryKey,
    taskId,
    taskRevision: 2,
    acknowledgedAt: "2026-07-16T06:12:00.000Z",
    acknowledgedBy: "project-planner",
  });
  expect(replay).toMatchObject({ applied: true, replayed: true });

  const stored = readTaskTree(config) as any;
  expect(stored.conditions[conditionId].fallbackExecution).toMatchObject({
    status: "acknowledged",
    attempts: 1,
    acknowledgedAt: "2026-07-16T06:11:00.000Z",
    acknowledgedBy: "project-planner",
  });
  expect(stored.tasks[taskId]).toMatchObject({ state: "blocked", revision: 2 });
  const journal = await readFile(
    join(appDir, ".state", "journal.jsonl"),
    "utf8",
  );
  expect(
    journal.match(/project_condition_fallback_acknowledged_v2/g),
  ).toHaveLength(1);
});

test("an unacknowledged fallback is redeliverable twice and then bounded", async () => {
  const appDir = await mkdtemp(
    join(tmpdir(), "project-condition-fallback-redelivery-v2-"),
  );
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  const taskId = "wait-redelivery";
  const runId = "172500010";
  const conditionId = pipelineConditionId("ado", runId);
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify({
      root_task_id: "project",
      tasks: {
        project: { id: "project", state: "active", children: [taskId] },
        [taskId]: {
          id: taskId,
          revision: 2,
          parent_id: "project",
          state: "blocked",
          children: [],
          context: { controlPlaneVersion: 2, conditionId },
          blocker: { condition: "waiting", condition_id: conditionId },
        },
      },
      conditions: {
        [conditionId]: {
          version: "project-condition-v2",
          id: conditionId,
          causeKey: `pipeline:ado:${runId}:terminal`,
          class: "external",
          type: "pipeline.run.terminal",
          status: "open",
          backend: "ado",
          runId,
          runUrl: `https://dev.azure.com/example/${runId}`,
          subject: { kind: "task", id: taskId, revision: 2 },
          owner: "ado",
          observer: "project-execution-watchdog",
          observationMethod: "exact run",
          resumeCondition: "run is terminal",
          nextCheckAt: "2026-07-16T06:00:00.000Z",
          fallbackAt: "2026-07-16T06:10:00.000Z",
          fallbackAction: "escalate",
          createdAt: "2026-07-16T06:00:00.000Z",
          updatedAt: "2026-07-16T06:10:00.000Z",
          fallbackExecution: {
            recoveryKey: `condition-fallback:${conditionId}:2`,
            claimId: `condition-fallback:${conditionId}:2:first`,
            status: "dispatched",
            attempts: 1,
            claimedAt: "2026-07-16T06:10:00.000Z",
            leaseExpiresAt: "2026-07-16T06:15:00.000Z",
            observation: { status: "inProgress" },
            dispatchedAt: "2026-07-16T06:10:01.000Z",
            acknowledgementDueAt: "2026-07-16T06:25:01.000Z",
          },
        },
      },
    })}\n`,
    "utf8",
  );
  const config = taskTreeConfig({
    appDir,
    projectDir: appDir,
    worker: "aks-explorer",
    maxConcurrent: 1,
  });

  const retry = claimPipelineConditionFallbackV2(config, {
    mode: "exact-ado-revisioned",
    conditionId,
    backend: "ado",
    runId,
    taskId,
    taskRevision: 2,
    claimedAt: "2026-07-16T06:26:00.000Z",
    observation: { status: "inProgress" },
  });
  expect(retry).toMatchObject({ claimed: true, replayed: false });
  expect(
    finishPipelineConditionFallbackV2(config, {
      mode: "exact-ado-revisioned",
      conditionId,
      claimId: retry.claimId!,
      finishedAt: "2026-07-16T06:26:01.000Z",
      dispatched: true,
    }),
  ).toBe(true);

  const secondRetry = claimPipelineConditionFallbackV2(config, {
    mode: "exact-ado-revisioned",
    conditionId,
    backend: "ado",
    runId,
    taskId,
    taskRevision: 2,
    claimedAt: "2026-07-16T06:42:00.000Z",
    observation: { status: "inProgress" },
  });
  expect(secondRetry).toMatchObject({ claimed: true, replayed: false });
  expect(
    finishPipelineConditionFallbackV2(config, {
      mode: "exact-ado-revisioned",
      conditionId,
      claimId: secondRetry.claimId!,
      finishedAt: "2026-07-16T06:42:01.000Z",
      dispatched: true,
    }),
  ).toBe(true);

  const exhausted = claimPipelineConditionFallbackV2(config, {
    mode: "exact-ado-revisioned",
    conditionId,
    backend: "ado",
    runId,
    taskId,
    taskRevision: 2,
    claimedAt: "2026-07-16T06:58:00.000Z",
    observation: { status: "inProgress" },
  });
  expect(exhausted).toMatchObject({
    claimed: false,
    replayed: true,
    reason:
      "condition fallback delivery acknowledgement is overdue and its retry budget is exhausted",
  });
  expect(
    (readTaskTree(config) as any).conditions[conditionId].fallbackExecution
      .attempts,
  ).toBe(3);
});
