import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import app from "../app.ts";
import {
  buildProcessGraphReport,
  buildProjectHealth,
} from "./project-health.ts";

const nowIso = "2026-07-03T12:00:00.000Z";
const nowMs = Date.parse(nowIso);

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-project-health-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify({ id: "aks-rp-e2e.app" }, null, 2)}\n`,
  );
  return { appDir, projectDir };
}

async function writeTree(
  appDir: string,
  tasks: Record<string, Record<string, unknown>>,
  rootChildren: string[],
  projectLifecycle = "active",
) {
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: projectLifecycle,
        root_task_id: "project",
        active_task_ids: rootChildren.filter(
          (id) => tasks[id]?.state === "active",
        ),
        tasks: {
          project: {
            id: "project",
            state: "active",
            status: "active",
            children: rootChildren,
            goal: "Drive the project.",
          },
          ...tasks,
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function writeJsonl(
  appDir: string,
  name: string,
  rows: Record<string, unknown>[],
) {
  await writeFile(
    join(appDir, ".state", name),
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
  );
}

describe("project health", () => {
  test("reports moving when active work has recent task movement", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "active-task": {
          id: "active-task",
          parent_id: "project",
          state: "active",
          status: "active",
          children: [],
          goal: "Do active work.",
          trace: {
            assigned_at: "2026-07-03T11:59:00.000Z",
            worker_started_at: "2026-07-03T11:59:10.000Z",
          },
        },
      },
      ["active-task"],
    );
    await writeJsonl(fixture.appDir, "journal.jsonl", [
      {
        ts: "2026-07-03T11:59:10.000Z",
        kind: "task_worker_started",
        task_id: "active-task",
      },
    ]);

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("moving");
    expect(report.processGraph.available).toBe(false);
    expect(report.frontier.counts.active).toBe(1);
    expect(report.snapshot.coverage).toEqual({
      tree: "available",
      assignments: "available",
      sessions: "unavailable",
      reviews: "available",
      controllers: "unavailable",
      controllerLiveness: "unavailable",
      delivery: "unavailable",
    });
    expect(report.signals.map((signal) => signal.code)).toContain(
      "frontier.active",
    );
  });

  test("reports recovering when the executable frontier is ops-only", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "ops/recover-auth": {
          id: "ops/recover-auth",
          parent_id: "project",
          state: "active",
          status: "active",
          owner: "app-ops",
          children: [],
          goal: "Restore worker authentication.",
          trace: {
            assigned_at: "2026-07-03T11:59:00.000Z",
            worker_started_at: "2026-07-03T11:59:10.000Z",
          },
        },
        "blocked-domain": {
          id: "blocked-domain",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          owner: "aks-explorer",
          children: [],
          goal: "Verify a blocked domain path.",
          blocker: {
            condition: "Worker authentication is unavailable.",
            owner: "app-ops",
            resume_condition: "Resume after authentication recovery.",
            next_check_at: "2026-07-03T12:10:00.000Z",
            fallback_at: "2026-07-03T13:00:00.000Z",
          },
        },
      },
      ["ops/recover-auth", "blocked-domain"],
    );
    await writeJsonl(fixture.appDir, "journal.jsonl", [
      {
        ts: "2026-07-03T11:59:10.000Z",
        kind: "task_worker_started",
        task_id: "ops/recover-auth",
      },
    ]);

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("recovering");
    expect(report.movement.domainOutcomesAccepted).toBe(0);
    expect(report.signals.map((signal) => signal.code)).toContain(
      "feedback-loop.recovery-only",
    );
  });

  test("reports moving when recovery restores an active domain frontier", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "ops/recover-auth": {
          id: "ops/recover-auth",
          parent_id: "project",
          state: "active",
          status: "active",
          owner: "app-ops",
          children: [],
          goal: "Finish recovery verification.",
          trace: { worker_started_at: "2026-07-03T11:59:10.000Z" },
        },
        "domain/retry-spec": {
          id: "domain/retry-spec",
          parent_id: "project",
          state: "active",
          status: "active",
          owner: "aks-explorer",
          children: [],
          goal: "Retry the affected domain spec.",
          trace: { worker_started_at: "2026-07-03T11:59:20.000Z" },
        },
      },
      ["ops/recover-auth", "domain/retry-spec"],
    );
    await writeJsonl(fixture.appDir, "journal.jsonl", [
      {
        ts: "2026-07-03T11:59:20.000Z",
        kind: "task_worker_started",
        task_id: "domain/retry-spec",
      },
    ]);

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("moving");
    expect(report.signals.map((signal) => signal.code)).not.toContain(
      "feedback-loop.recovery-only",
    );
  });

  test("flags an incomplete durable loop with no executable frontier", async () => {
    const fixture = await makeFixture();
    await mkdir(join(fixture.appDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(fixture.appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          specs: {
            "spec.example": { status: "error" },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeTree(
      fixture.appDir,
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          workflow: "spec-loop-controller",
          children: [],
          goal: "Verify every spec.",
          context: {
            workflowProgress: {
              completionReady: false,
              reason: "spec-loop state still has non-terminal specs",
              pending: 0,
              running: 0,
              done: 0,
              error: 1,
              unrepresentedNonTerminalCount: 1,
              updatedAt: "2026-07-03T11:00:00.000Z",
            },
          },
        },
      },
      ["aks-spec-verification-loop"],
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("stalled");
    expect(report.signals.map((signal) => signal.code)).toContain(
      "loop.incomplete-without-frontier",
    );
    expect(report.loops[0].stateCounts).toMatchObject({ error: 1 });
  });

  test("treats represented blocked waits as stalled while project lifecycle remains active", async () => {
    const fixture = await makeFixture();
    await mkdir(join(fixture.appDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(fixture.appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          specs: {
            "spec.example": {
              status: "pending",
              taskId: "hold-spec-example-exact-wait",
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeTree(
      fixture.appDir,
      {
        "aks-spec-verification-loop": {
          id: "aks-spec-verification-loop",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          workflow: "spec-loop-controller",
          children: ["hold-spec-example-exact-wait"],
          goal: "Verify every spec.",
          context: {
            workflowProgress: {
              completionReady: false,
              reason:
                "spec-loop execution is drained and the remaining frontier is exact wait stewardship",
              pending: 1,
              running: 0,
              done: 0,
              error: 0,
              unrepresentedNonTerminalCount: 0,
              activePipelineFeatureKeys: [],
              activePipelineWaits: [],
              updatedAt: "2026-07-03T11:00:00.000Z",
            },
          },
        },
        "hold-spec-example-exact-wait": {
          id: "hold-spec-example-exact-wait",
          parent_id: "aks-spec-verification-loop",
          state: "blocked",
          status: "blocked",
          children: [],
          goal: "Wait for exact owner-return result.",
          outputs: ["evidence/archive/wait.md"],
          acceptance: ["exact wait is resolved or refreshed"],
          blocker: {
            condition: "owner return is pending",
            owner: "human",
            resume_condition: "resume when owner returns",
            next_check_at: "2026-07-12T00:00:00.000Z",
            fallback_at: "2026-07-13T00:00:00.000Z",
          },
        },
      },
      ["aks-spec-verification-loop"],
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    const codes = report.signals.map((signal) => signal.code);
    expect(report.status).toBe("stalled");
    expect(codes).toContain("loop.blocked-wait-stewardship");
    expect(codes).toContain("work-loop.active-lifecycle-starved");
    expect(codes).not.toContain("loop.incomplete-without-frontier");
  });

  test("does not allow a blocked lifecycle value to hide a blocked-only stall", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "external-wait": {
          id: "external-wait",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          children: [],
          goal: "Wait for a sent external handoff.",
          blocker: {
            condition: "sent owner decision is pending",
            owner: "human",
            resume_condition: "resume when owner returns",
            next_check_at: "2026-07-12T00:00:00.000Z",
            fallback_at: "2026-07-13T00:00:00.000Z",
          },
        },
      },
      ["external-wait"],
      "blocked",
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("stalled");
    expect(report.signals.map((signal) => signal.code)).toContain(
      "work-loop.active-lifecycle-starved",
    );
  });

  test("shows active compact pipeline feature keys in loop health", async () => {
    const fixture = await makeFixture();
    await mkdir(join(fixture.appDir, ".state", "feature-compact-loop"), {
      recursive: true,
    });
    await writeFile(
      join(fixture.appDir, ".state", "feature-compact-loop", "state.json"),
      `${JSON.stringify(
        {
          features: {
            windows: {
              status: "running",
              lastWorkflowRunId: "123",
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeTree(
      fixture.appDir,
      {
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          workflow: "feature-compact-loop-controller",
          children: [],
          goal: "Compact features.",
          context: {
            workflowProgress: {
              completionReady: false,
              reason: "waiting on active Azure DevOps compact run",
              pending: 0,
              running: 1,
              done: 0,
              error: 0,
              unrepresentedNonTerminalCount: 0,
              activePipelineFeatureKeys: ["windows"],
              activePipelineWaits: [
                {
                  featureKey: "windows",
                  runId: "123",
                  runUrl:
                    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
                  runStatus: "in_progress",
                  runTitle: "AKS RP E2E compact-feature-windows staging",
                  watchedCondition:
                    "Azure DevOps run 123 reaches completed status",
                  expectedArtifact:
                    ".state/feature-compact-loop/artifacts/<runId>/",
                  owner: "feature-compact-loop-controller",
                  nextCheckAt: "2026-07-03T11:10:00.000Z",
                  fallbackAt: "2026-07-03T23:00:00.000Z",
                },
              ],
              updatedAt: "2026-07-03T11:00:00.000Z",
            },
          },
        },
      },
      ["aks-feature-compact-loop"],
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    const compactLoop = report.loops.find(
      (loop) => loop.taskId === "aks-feature-compact-loop",
    );
    expect(compactLoop).toMatchObject({
      running: 1,
      unrepresentedNonTerminalCount: 0,
      activePipelineFeatureKeys: ["windows"],
      activePipelineWaits: [
        {
          featureKey: "windows",
          runId: "123",
          runUrl:
            "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
          runStatus: "in_progress",
          watchedCondition: "Azure DevOps run 123 reaches completed status",
          expectedArtifact: ".state/feature-compact-loop/artifacts/<runId>/",
          owner: "feature-compact-loop-controller",
          nextCheckAt: "2026-07-03T11:10:00.000Z",
          fallbackAt: "2026-07-03T23:00:00.000Z",
        },
      ],
      stateCounts: { running: 1 },
    });
  });

  test("does not flag compact planner child as stale while its pipeline wait is represented", async () => {
    const fixture = await makeFixture();
    await mkdir(join(fixture.appDir, ".state", "feature-compact-loop"), {
      recursive: true,
    });
    await writeFile(
      join(fixture.appDir, ".state", "feature-compact-loop", "state.json"),
      `${JSON.stringify(
        {
          features: {
            windows: {
              status: "running",
              activeWorkflowRunId: "123",
              lastWorkflowRunId: "123",
              lastWorkflowRunUrl:
                "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
              heartbeatAt: "2026-07-03T11:00:00.000Z",
              fallbackAt: "2026-07-03T23:00:00.000Z",
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeTree(
      fixture.appDir,
      {
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "active",
          status: "active",
          workflow: "feature-compact-loop-controller",
          children: ["compact-feature-windows"],
          goal: "Compact features.",
          context: {
            workflowProgress: {
              completionReady: false,
              reason: "waiting on active Azure DevOps compact run",
              pending: 0,
              running: 1,
              done: 0,
              error: 0,
              unrepresentedNonTerminalCount: 0,
              activePipelineFeatureKeys: ["windows"],
              activePipelineWaits: [
                {
                  featureKey: "windows",
                  runId: "123",
                  runUrl:
                    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
                  watchedCondition:
                    "Azure DevOps run 123 reaches completed status",
                  expectedArtifact:
                    ".state/feature-compact-loop/artifacts/<runId>/",
                  owner: "feature-compact-loop-controller",
                  nextCheckAt: "2026-07-03T12:10:00.000Z",
                  fallbackAt: "2026-07-03T23:00:00.000Z",
                },
              ],
              updatedAt: "2026-07-03T11:00:00.000Z",
            },
          },
        },
        "compact-feature-windows": {
          id: "compact-feature-windows",
          parent_id: "aks-feature-compact-loop",
          state: "active",
          status: "active",
          workflow: "feature-compact-planner",
          children: [],
          goal: "Run compact feature windows.",
          context: {
            featureKey: "windows",
          },
          trace: {
            assigned_at: "2026-07-03T10:00:00.000Z",
            worker_started_at: "2026-07-03T10:00:00.000Z",
          },
        },
      },
      ["aks-feature-compact-loop"],
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.staleActiveTaskIds).toEqual([]);
    expect(report.signals.map((signal) => signal.code)).not.toContain(
      "frontier.stale-active",
    );
  });

  test("merges exact active compact pipeline waits from loop state", async () => {
    const fixture = await makeFixture();
    await mkdir(join(fixture.appDir, ".state", "feature-compact-loop"), {
      recursive: true,
    });
    await writeFile(
      join(fixture.appDir, ".state", "feature-compact-loop", "state.json"),
      `${JSON.stringify(
        {
          features: {
            "kms-etcd-encryption": {
              status: "error",
              activeWorkflowRunId: "171495586",
              lastWorkflowRunUrl:
                "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171495586",
              lastResultPath:
                "runs/test-results/feature-compact-kms-etcd-encryption-staging_659390",
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeTree(
      fixture.appDir,
      {
        "aks-feature-compact-loop": {
          id: "aks-feature-compact-loop",
          parent_id: "project",
          state: "blocked",
          status: "blocked",
          workflow: "feature-compact-loop-controller",
          children: [],
          goal: "Compact features.",
          context: {
            workflowProgress: {
              completionReady: false,
              reason:
                "feature-compact loop state still has non-terminal features",
              pending: 0,
              running: 0,
              done: 33,
              error: 1,
              unrepresentedNonTerminalCount: 0,
              activePipelineFeatureKeys: [],
              activePipelineWaits: [],
              updatedAt: "2026-07-03T11:00:00.000Z",
            },
          },
        },
      },
      ["aks-feature-compact-loop"],
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    const compactLoop = report.loops.find(
      (loop) => loop.taskId === "aks-feature-compact-loop",
    );
    expect(compactLoop).toMatchObject({
      activePipelineFeatureKeys: ["kms-etcd-encryption"],
      activePipelineWaits: [
        {
          featureKey: "kms-etcd-encryption",
          runId: "171495586",
          runUrl:
            "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171495586",
          runStatus: null,
          runTitle: null,
          watchedCondition:
            "Azure DevOps run 171495586 reaches completed status",
          expectedArtifact:
            "runs/test-results/feature-compact-kms-etcd-encryption-staging_659390",
          owner: "feature-compact-loop-controller",
          nextCheckAt: null,
          fallbackAt: null,
        },
      ],
    });
  });

  test("surfaces assignment rows that have not been consumed", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "queued-task": {
          id: "queued-task",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          children: [],
          goal: "Queued work.",
          depends_on: [],
        },
      },
      ["queued-task"],
    );
    await writeJsonl(fixture.appDir, "task-assignments.jsonl", [
      {
        taskId: "queued-task",
        task_id: "queued-task",
        attemptId: "a_queued",
        attempt_id: "a_queued",
        sessionId: "s_queued",
        session_id: "s_queued",
        worker: "aks-explorer",
        assignedAt: "2026-07-03T11:59:00.000Z",
        assigned_at: "2026-07-03T11:59:00.000Z",
      },
    ]);

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("attention");
    expect(report.assignments.queued).toBe(0);
    expect(report.signals.map((signal) => signal.code)).not.toContain(
      "assignment.queue-not-empty",
    );
  });

  test("surfaces runnable work that has no active worker or queued assignment", async () => {
    const fixture = await makeFixture();
    await writeTree(
      fixture.appDir,
      {
        "ready-task": {
          id: "ready-task",
          parent_id: "project",
          state: "backlog",
          status: "backlog",
          children: [],
          goal: "Ready work.",
          outputs: ["evidence/ready-task.md"],
          acceptance: ["ready task completes"],
          depends_on: [],
        },
      },
      ["ready-task"],
    );

    const report = buildProjectHealth({
      appDir: fixture.appDir,
      projectDir: fixture.projectDir,
      nowMs,
      lookbackMinutes: 30,
      staleActiveMinutes: 30,
    });

    expect(report.status).toBe("attention");
    expect(report.frontier.runnable).toEqual(["ready-task"]);
    expect(report.signals.map((signal) => signal.code)).toContain(
      "frontier.runnable-idle",
    );
    expect(report.nextActions[0]).toContain(
      "Wake the planner or assign ready runnable work",
    );
  });

  test("static process graph flags no unhandled events for the real app manifest", () => {
    const graph = buildProcessGraphReport(app);

    expect(graph.available).toBe(true);
    expect(graph.routeCount).toBeGreaterThan(0);
    expect(graph.emittedEventCount).toBeGreaterThan(0);
    expect(graph.consumedEventCount).toBeGreaterThan(0);
    expect(graph.unhandledEvents).toEqual([]);
    expect(graph.multiRouteEvents).toEqual([]);
    expect(graph.actionErrors).toEqual([]);
  });
});
