import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ProjectAppContext } from "@may-agent/sdk/legacy";
import {
  observeAksPipelines,
  artifactRunCandidates,
  artifactDirectoryReady,
  boundedTrackedRunIds,
  masterValidationNoVerdictFailure,
  mergeAdoRunObservations,
  pipelineLevelEvent,
  pipelineObservationEvents,
  pipelineQueueOverdueEvent,
  pipelineTestNonpassingEvent,
  progressTimelineDetailIds,
  retainedTrackedRunIds,
  shouldEmitMasterValidationFailure,
  shouldEmitPipelineLevel,
  shouldScanProgressiveArtifacts,
  scanPipelineResults,
} from "./aks-pipeline.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  delete process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO;
});

test("scheduled provider observers do not block the May event loop", () => {
  for (const file of [
    "aks-pipeline.ts",
    "aks-pull-request.ts",
    "repo-ref.ts",
    "scenario-test-inventory.ts",
    "workspace-integrity.ts",
  ]) {
    const source = readFileSync(join(import.meta.dir, file), "utf8");
    expect(source).not.toMatch(/\b(?:spawnSync|execFileSync|execSync)\b/);
  }
});

describe("progressive artifact scan selection", () => {
  const completed = {
    runId: "123",
    fingerprint: "completed:failed",
    status: "completed",
    result: "failed",
    sourceBranch: "refs/heads/main",
    sourceVersion: "abc",
    finishTime: "2026-07-23T00:00:00Z",
    queueTime: "2026-07-22T23:00:00Z",
    artifacts: [],
    progressive: true,
  };

  test("scans active, newly completed, and still-draining runs only", () => {
    expect(
      shouldScanProgressiveArtifacts({
        run: { ...completed, status: "inProgress" },
        wasTracked: false,
        priorFingerprint: completed.fingerprint,
      }),
    ).toBe(true);
    expect(
      shouldScanProgressiveArtifacts({
        run: completed,
        wasTracked: false,
        priorFingerprint: "inProgress:",
      }),
    ).toBe(true);
    expect(
      shouldScanProgressiveArtifacts({
        run: completed,
        wasTracked: true,
        priorFingerprint: completed.fingerprint,
      }),
    ).toBe(true);
    expect(
      shouldScanProgressiveArtifacts({
        run: completed,
        wasTracked: false,
        priorFingerprint: completed.fingerprint,
      }),
    ).toBe(false);
  });

  test("repeats live levels but emits terminal levels only when changed", () => {
    expect(
      shouldEmitPipelineLevel({
        run: { ...completed, status: "inProgress" },
        priorFingerprint: completed.fingerprint,
      }),
    ).toBe(true);
    expect(
      shouldEmitPipelineLevel({
        run: completed,
        priorFingerprint: "inProgress:",
      }),
    ).toBe(true);
    expect(
      shouldEmitPipelineLevel({
        run: completed,
        priorFingerprint: completed.fingerprint,
      }),
    ).toBe(false);
  });

  test("does not let stale filtered ADO results downgrade a terminal run", () => {
    const base = {
      runId: "174259208",
      sourceBranch: "refs/heads/task/example",
      sourceVersion: "abc123",
      queueTime: "2026-07-29T04:57:51Z",
      artifacts: [],
      progressive: false,
      fingerprint: "",
    };
    const merged = mergeAdoRunObservations([
      {
        ...base,
        status: "completed",
        result: "failed",
        finishTime: "2026-07-29T05:14:48Z",
      },
      {
        ...base,
        status: "inProgress",
        result: "inProgress",
        finishTime: null,
      },
      {
        ...base,
        status: "notStarted",
        result: "notStarted",
        finishTime: null,
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      status: "completed",
      result: "failed",
      finishTime: "2026-07-29T05:14:48Z",
    });
  });

  test("finds bounded nested progress timelines for slice execution tasks", () => {
    expect(
      progressTimelineDetailIds(
        [
          {
            type: "Task",
            name: "Auth and execute plan slice",
            details: { id: "timeline-slice-01" },
          },
          {
            type: "Task",
            name: "Auth and execute plan slice",
            details: { id: "timeline-slice-01" },
          },
          {
            type: "Task",
            name: "Publish slice test result artifacts",
            details: { id: "not-progress" },
          },
          {
            type: "Task",
            name: "Auth and execute plan slice",
            details: { id: "timeline-slice-02" },
          },
        ],
        1,
      ),
    ).toEqual(["timeline-slice-01"]);
  });

  test("preserves task correlation on early nonpassing events", () => {
    expect(
      pipelineTestNonpassingEvent(
        {
          ...completed,
          status: "inProgress",
          result: "inProgress",
          progressive: false,
          metadataTaskId: "domain/verify-serverless",
          metadataGeneration: "6",
        },
        {
          runId: "123",
          sliceId: "01",
          testRunId: "serverless-live",
          specId: "spec.serverless-virtual-nodes.enable",
          sequence: 4,
          executionState: "completed",
          verdict: "fail",
          phase: "runtime",
          phaseDetail: "virtual-node-readiness",
          message: "virtual-node-aci-linux did not become Ready",
          updatedAt: "2026-07-29T21:20:46Z",
          elapsedSeconds: 900,
          category: "runtime_readiness",
        },
      ),
    ).toMatchObject({
      type: "pipeline.test.nonpassing",
      taskId: "domain/verify-serverless",
      generation: "6",
      data: expect.objectContaining({
        taskId: "domain/verify-serverless",
        generation: "6",
      }),
    });
  });

  test("keeps progressive nonpassing events app-routable instead of targeting the sleeping master-validation task", () => {
    const event = pipelineTestNonpassingEvent(
      {
        ...completed,
        status: "inProgress",
        result: "inProgress",
        progressive: true,
        metadataTaskId: "master-validation-staging-cycle",
        metadataGeneration: "6",
      },
      {
        runId: "174826569",
        sliceId: "05",
        testRunId: "managed-namespaces-live",
        specId: "spec.managed-namespaces.lifecycle",
        sequence: 4,
        executionState: "completed",
        verdict: "fail",
        phase: "provider-timeline",
        phaseDetail: "completed",
        message:
          "Azure timeline reports spec.managed-namespaces.lifecycle fail before slice artifacts are available.",
        updatedAt: "2026-08-02T05:06:40Z",
        elapsedSeconds: 900,
        category: "unknown",
      },
    );

    expect(event).toMatchObject({
      type: "pipeline.test.nonpassing",
      validationTaskId: "master-validation-staging-cycle",
      validationGeneration: "6",
      data: expect.objectContaining({
        validationTaskId: "master-validation-staging-cycle",
        validationGeneration: "6",
      }),
    });
    expect(event).not.toHaveProperty("taskId");
    expect(event.data).not.toHaveProperty("taskId");
  });

  test("bounds historical task artifacts while retaining active and progressive runs", () => {
    const taskRuns = Array.from({ length: 15 }, (_, index) => ({
      ...completed,
      runId: String(100 + index),
      fingerprint: `task-${index}`,
      progressive: false,
      artifactObservable: true,
    }));
    taskRuns[0] = { ...taskRuns[0], status: "inProgress" };
    const progressive = {
      ...completed,
      runId: "50",
      fingerprint: "progressive",
    };

    const selected = artifactRunCandidates({
      runs: [progressive, ...taskRuns],
      previouslyTrackedRunIds: new Set(),
      priorFingerprints: {},
      observedArtifacts: {},
      taskRunLimit: 3,
    }).map((run) => run.runId);

    expect(selected).toEqual(["50", "100", "113", "114"]);
    expect(boundedTrackedRunIds(["2", "1", "3", "2"], 2)).toEqual(["3", "2"]);
  });

  test("retains an unchanged historical campaign only while bounded artifact recovery is pending", () => {
    const runs = [
      { ...completed, runId: "100", fingerprint: "old-terminal" },
      { ...completed, runId: "150", fingerprint: "just-finished" },
      {
        ...completed,
        runId: "200",
        fingerprint: "current-live",
        status: "inProgress",
        result: "inProgress",
      },
    ];
    const input = {
      runs,
      previouslyTrackedRunIds: new Set(["100", "150", "200"]),
      priorFingerprints: {
        "100": "old-terminal",
        "150": "previous-live",
        "200": "current-live",
      },
      observedArtifacts: {},
    };

    expect(artifactRunCandidates(input).map((run) => run.runId)).toEqual([
      "150",
      "200",
    ]);
    expect(
      artifactRunCandidates({
        ...input,
        pendingTerminalArtifactRunIds: new Set(["100"]),
      }).map((run) => run.runId),
    ).toEqual(["100", "150", "200"]);
    expect(
      artifactRunCandidates({
        ...input,
        pendingTerminalArtifactRunIds: new Set(["100"]),
        terminalArtifactUnavailableRunIds: new Set(["100"]),
      }).map((run) => run.runId),
    ).toEqual(["150", "200"]);
  });

  test("drops missing historical run ids after Azure returns current runs", () => {
    const active = {
      ...completed,
      runId: "200",
      status: "inProgress",
      result: "inProgress",
    };
    expect(
      retainedTrackedRunIds({
        priorRunIds: ["100", "200"],
        runs: [active],
        pendingTerminalArtifactRunIds: new Set(),
      }),
    ).toEqual(["200"]);

    expect(
      retainedTrackedRunIds({
        priorRunIds: ["100", "200"],
        runs: [],
        pendingTerminalArtifactRunIds: new Set(),
      }),
    ).toEqual(["200", "100"]);

    expect(
      retainedTrackedRunIds({
        priorRunIds: ["100", "200"],
        runs: [active, { ...completed, runId: "100" }],
        pendingTerminalArtifactRunIds: new Set(["100"]),
      }),
    ).toEqual(["200", "100"]);
  });

  test("recovers recent completed spec runs that still lack local artifact roots", () => {
    const selected = artifactRunCandidates({
      runs: [
        {
          ...completed,
          runId: "174041352",
          fingerprint: "completed-missing-roots",
          progressive: false,
          artifactObservable: false,
          specRun: true,
          metadataTaskId: null,
        },
        {
          ...completed,
          runId: "174070172",
          fingerprint: "completed-with-roots",
          progressive: false,
          artifactObservable: true,
          specRun: true,
          metadataTaskId:
            "compact/reconcile-secure-tls-bootstrap-current-ready-subset-frontier-30b4c3dd-20260728",
        },
      ],
      previouslyTrackedRunIds: new Set(),
      priorFingerprints: {
        "174041352": "completed-missing-roots",
        "174070172": "completed-with-roots",
      },
      observedArtifacts: {
        "174070172:plan-inputs": "/tmp/174070172/plan-inputs",
      },
      taskRunLimit: 3,
    }).map((run) => run.runId);

    expect(selected).toContain("174041352");
    expect(selected).not.toContain("174070172");
    expect(
      shouldScanProgressiveArtifacts({
        run: {
          ...completed,
          progressive: false,
          artifactObservable: false,
          specRun: true,
        },
        wasTracked: false,
        priorFingerprint: completed.fingerprint,
        forceRescan: true,
      }),
    ).toBe(true);
  });

  test("routes failure work only from progressive master-validation runs", () => {
    expect(shouldEmitMasterValidationFailure(completed)).toBe(true);
    expect(
      shouldEmitMasterValidationFailure({
        ...completed,
        progressive: false,
        artifactObservable: true,
        sourceBranch: "refs/heads/task/domain-example",
      }),
    ).toBe(false);
  });
});

describe("master-validation pipeline failures", () => {
  test("turns a failed aggregate with no spec verdict into a repair issue", () => {
    expect(
      masterValidationNoVerdictFailure({
        pipelineRunId: "173655312",
        sourceBranch: "refs/heads/validation/master-validation-173646937",
        sourceCommit: "candidate123",
        status: "completed",
        result: "failed",
        progressive: true,
        artifactsReady: true,
        observedVerdictCount: 0,
        observedFailureCount: 0,
      }),
    ).toMatchObject({
      specId: "pipeline.master-validation.bootstrap",
      category: "pipeline_failure",
      artifactPath: "ado://build/173655312",
    });
  });

  test("does not duplicate a real spec or admission failure", () => {
    expect(
      masterValidationNoVerdictFailure({
        pipelineRunId: "123",
        sourceBranch: "refs/heads/main",
        sourceCommit: "main123",
        status: "completed",
        result: "failed",
        progressive: true,
        artifactsReady: true,
        observedVerdictCount: 0,
        observedFailureCount: 1,
      }),
    ).toBeNull();
    expect(
      masterValidationNoVerdictFailure({
        pipelineRunId: "124",
        sourceBranch: "refs/heads/main",
        sourceCommit: "main123",
        status: "completed",
        result: "canceled",
        progressive: true,
        artifactsReady: true,
        observedVerdictCount: 0,
        observedFailureCount: 0,
      }),
    ).toBeNull();
  });
});

function fixture(options?: {
  result?: Record<string, unknown>;
  run?: Record<string, unknown> | null;
}) {
  process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO = "0";
  const root = mkdtempSync(join(tmpdir(), "aks-pipeline-watcher-"));
  roots.push(root);
  const appDir = join(root, "aks-rp-e2e.app");
  const resultDir = join(root, "aks-rp-e2e", "runs", "test-results", "run-1");
  mkdirSync(appDir, { recursive: true });
  mkdirSync(resultDir, { recursive: true });
  const resultPath = join(resultDir, "result.json");
  writeFileSync(
    resultPath,
    JSON.stringify(
      options?.result ?? {
        runId: "run-1",
        status: "passed",
        counts: { pass: 1 },
      },
    ),
  );
  const runPath = join(resultDir, "run.json");
  if (options?.run !== null && options?.run !== undefined) {
    writeFileSync(runPath, JSON.stringify(options.run));
  }
  const emitted: Record<string, unknown>[] = [];
  const ctx = {
    appPath: (path: string) => resolve(appDir, path),
    emit: (event: Record<string, unknown>) => emitted.push(event),
    noop: (reason: string) => ({ reason }),
  } as ProjectAppContext;
  return { ctx, emitted, resultPath, runPath, resultsRoot: dirname(resultDir) };
}

describe("AKS pipeline watcher", () => {
  test("indexes pipeline results without task-tree knowledge", () => {
    const { resultsRoot } = fixture();
    expect(scanPipelineResults(resultsRoot)).toMatchObject([
      { runId: "run-1", result: { status: "passed" } },
    ]);
  });

  test("baselines once and emits a semantic result only when provider state changes", async () => {
    const { ctx, emitted, resultPath } = fixture();
    await observeAksPipelines(ctx);
    expect(emitted).toEqual([]);

    writeFileSync(
      resultPath,
      JSON.stringify({ runId: "run-1", status: "failed", counts: { fail: 1 } }),
    );
    await observeAksPipelines(ctx);
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: "project.test_run.completed",
        source: "aks-pipeline-watcher",
        pipelineRunId: "run-1",
        status: "failed",
        data: expect.objectContaining({
          pipelineRunId: "run-1",
          status: "failed",
        }),
      }),
    );
  });

  test("contract bump keeps local result fingerprints stable", async () => {
    const { ctx, emitted } = fixture();
    await observeAksPipelines(ctx);
    expect(emitted).toEqual([]);

    const statePath = join(
      ctx.appPath("."),
      ".state/watchers/aks-pipeline.json",
    );
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    writeFileSync(
      statePath,
      JSON.stringify({ ...state, schemaVersion: "older-contract" }, null, 2),
    );

    await observeAksPipelines(ctx);
    expect(emitted).toEqual([]);
  });

  test("waits for the sibling local run record to become terminal before emitting completion", async () => {
    const { ctx, emitted, resultPath, runPath } = fixture({
      result: {
        runId: "run-1",
        status: "empty",
        counts: { pass: 0, fail: 0, blocked: 0, error: 0, skipped: 0 },
        specResults: [],
        updatedAt: "2026-07-29T07:41:57.920Z",
      },
      run: {
        runId: "run-1",
        status: "running",
        startedAt: "2026-07-29T07:41:56.817Z",
        endedAt: null,
        updatedAt: "2026-07-29T07:41:57.920Z",
      },
    });

    await observeAksPipelines(ctx);
    expect(emitted).toEqual([]);

    writeFileSync(
      resultPath,
      JSON.stringify({
        runId: "run-1",
        status: "empty",
        counts: { pass: 0, fail: 0, blocked: 0, error: 0, skipped: 0 },
        specResults: [],
        updatedAt: "2026-07-29T07:42:10.000Z",
      }),
    );
    await observeAksPipelines(ctx);
    expect(emitted).toEqual([]);

    writeFileSync(
      runPath,
      JSON.stringify({
        runId: "run-1",
        status: "passed",
        startedAt: "2026-07-29T07:41:56.817Z",
        endedAt: null,
        updatedAt: "2026-07-29T07:49:03.803Z",
      }),
    );
    await observeAksPipelines(ctx);

    const completionEvents = emitted.filter(
      (event) => event.type === "project.test_run.completed",
    );
    expect(completionEvents).toHaveLength(1);
    expect(completionEvents[0]).toMatchObject({
      pipelineRunId: "run-1",
      status: "empty",
      data: expect.objectContaining({
        resultPath,
        runPath,
        runStatus: "passed",
        runState: "terminal",
      }),
    });

    await observeAksPipelines(ctx);
    expect(
      emitted.filter((event) => event.type === "project.test_run.completed"),
    ).toHaveLength(1);
  });

  test("emits terminal ADO facts separately from artifact materialization", () => {
    const events = pipelineObservationEvents({
      runId: "172897811",
      fingerprint: "fp",
      status: "completed",
      result: "succeeded",
      sourceBranch: "refs/heads/dev",
      sourceVersion: "abc123",
      finishTime: "2026-07-20T03:28:29Z",
      queueTime: "2026-07-20T01:00:00Z",
      artifacts: ["plan-inputs", "slice-01-test-results"],
    });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "pipeline.completed",
        pipelineRunId: "172897811",
        state: "completed",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "pipeline-run.state",
        pipelineRunId: "172897811",
        state: "completed",
        terminal: true,
      }),
    );
    expect(
      events.find((event) => event.type === "pipeline-artifact.available"),
    ).toBeUndefined();
  });

  test("emits a repeatable level event without task-tree knowledge", () => {
    expect(
      pipelineLevelEvent({
        runId: "172897811",
        fingerprint: "fp",
        status: "inProgress",
        result: "inProgress",
        sourceBranch: "refs/heads/task/spec-example",
        sourceVersion: "abc123",
        finishTime: null,
        queueTime: "2026-07-20T03:00:00Z",
        artifacts: [],
      }),
    ).toMatchObject({
      type: "pipeline-run.state",
      pipelineRunId: "172897811",
      state: "inProgress",
      terminal: false,
    });
  });

  test("emits one actionable fact only after a master-validation queue is overdue", () => {
    const observed = {
      runId: "173408245",
      fingerprint: "fp",
      status: "notStarted",
      result: "notStarted",
      sourceBranch: "refs/heads/main",
      sourceVersion: "abc123",
      finishTime: null,
      queueTime: "2026-07-23T01:00:00.000Z",
      artifacts: [],
      progressive: true,
    };
    expect(
      pipelineQueueOverdueEvent(
        observed,
        Date.parse("2026-07-23T02:29:59.999Z"),
      ),
    ).toBeNull();
    expect(
      pipelineQueueOverdueEvent(
        observed,
        Date.parse("2026-07-23T02:30:00.000Z"),
      ),
    ).toMatchObject({
      type: "pipeline.queue.overdue",
      pipelineRunId: "173408245",
      queueTime: "2026-07-23T01:00:00.000Z",
      queueAgeMs: 5_400_000,
    });
  });

  test("detects slice jobs still awaiting agents after planning completed", () => {
    const observed = {
      runId: "173695985",
      fingerprint: "fp",
      status: "inProgress",
      result: "inProgress",
      sourceBranch: "refs/heads/validation/master-validation-173646937",
      sourceVersion: "f65a9354",
      finishTime: null,
      queueTime: "2026-07-24T20:00:34.000Z",
      artifacts: [],
      progressive: true,
    };
    const timeline = [
      {
        type: "Job",
        name: "Plan AKS RP E2E specs",
        state: "completed",
        finishTime: "2026-07-24T20:07:33.000Z",
      },
      { type: "Job", name: "Execute slice slice_01", state: "pending" },
      { type: "Job", name: "Execute slice slice_02", state: "pending" },
    ];
    expect(
      pipelineQueueOverdueEvent(
        observed,
        Date.parse("2026-07-24T21:37:32.999Z"),
        timeline,
      ),
    ).toBeNull();
    expect(
      pipelineQueueOverdueEvent(
        observed,
        Date.parse("2026-07-24T21:37:33.000Z"),
        timeline,
      ),
    ).toMatchObject({
      type: "pipeline.queue.overdue",
      pipelineRunId: "173695985",
      queueTime: "2026-07-24T20:07:33.000Z",
      queueAgeMs: 5_400_000,
      queueScope: "slice-jobs",
    });
    expect(
      pipelineQueueOverdueEvent(
        observed,
        Date.parse("2026-07-24T22:30:00.000Z"),
        [
          timeline[0]!,
          {
            type: "Job",
            name: "Execute slice slice_01",
            state: "completed",
            finishTime: "2026-07-24T21:00:00.000Z",
          },
          { type: "Job", name: "Execute slice slice_02", state: "pending" },
        ],
      ),
    ).toMatchObject({
      type: "pipeline.queue.overdue",
      queueTime: "2026-07-24T21:00:00.000Z",
      queueAgeMs: 5_400_000,
      queueScope: "slice-jobs",
    });
    expect(
      pipelineQueueOverdueEvent(observed, Date.now(), [
        ...timeline.slice(0, 2),
        {
          type: "Job",
          name: "Execute slice slice_02",
          state: "inProgress",
        },
      ]),
    ).toBeNull();
  });

  test("recovers an older unchanged terminal campaign after a newer campaign starts and emits stable observations exactly once", async () => {
    const { ctx, emitted } = fixture();
    const statePath = ctx.appPath(".state/watchers/aks-pipeline.json");
    const oldRun = {
      runId: "176781818",
      fingerprint: "terminal-fingerprint",
      status: "completed",
      result: "failed",
      sourceBranch: "refs/heads/validation/master-validation-176781818",
      sourceVersion: "old-commit",
      finishTime: "2026-08-15T06:00:00Z",
      queueTime: "2026-08-15T05:00:00Z",
      artifacts: ["slice-01-test-results"],
      progressive: true,
      artifactObservable: true,
    };
    const newerRun = {
      ...oldRun,
      runId: "176784770",
      fingerprint: "newer-live",
      status: "inProgress",
      result: "inProgress",
      finishTime: null,
      artifacts: [],
    };
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(
      statePath,
      JSON.stringify({
        schemaVersion: "10",
        adoFingerprints: { [oldRun.runId]: "previous-live" },
        trackedRunIds: [oldRun.runId],
      }),
    );
    let downloads = 0;
    const dependencies = {
      scanAdoRuns: async () => [oldRun, newerRun],
      getTimeline: async () => [],
      listArtifactNames: async (runId: string) =>
        runId === oldRun.runId ? ["slice-01-test-results"] : [],
      downloadArtifact: async (
        runId: string,
        artifactName: string,
        destination: string,
      ) => {
        if (runId !== oldRun.runId || artifactName !== "slice-01-test-results")
          return false;
        downloads += 1;
        if (downloads === 1) return false;
        mkdirSync(destination, { recursive: true });
        writeFileSync(
          join(destination, "result.json"),
          JSON.stringify({
            status: "failed",
            specResults: [
              {
                specId: "spec.target140",
                status: "fail",
                category: "runner_failure",
                reason: "stable recovered result",
              },
            ],
          }),
        );
        return true;
      },
    };

    await observeAksPipelines(ctx, dependencies);
    let state = JSON.parse(readFileSync(statePath, "utf8"));
    expect(state.trackedRunIds).toContain(oldRun.runId);
    expect(state.terminalArtifactAttempts).toEqual({ [oldRun.runId]: 1 });
    expect(
      emitted.filter((event) => event.type === "pipeline.spec.observed"),
    ).toHaveLength(0);

    await observeAksPipelines(ctx, dependencies);
    state = JSON.parse(readFileSync(statePath, "utf8"));
    expect(state.trackedRunIds).not.toContain(oldRun.runId);
    expect(state.terminalArtifactAttempts).toEqual({});
    expect(
      emitted.filter(
        (event) =>
          event.type === "pipeline.spec.observed" &&
          event.pipelineRunId === oldRun.runId,
      ),
    ).toHaveLength(1);
    expect(
      emitted.filter(
        (event) =>
          event.type === "pipeline.failure.observed" &&
          event.pipelineRunId === oldRun.runId,
      ),
    ).toHaveLength(1);

    await observeAksPipelines(ctx, dependencies);
    expect(downloads).toBe(2);
    expect(
      emitted.filter(
        (event) =>
          event.type === "pipeline.spec.observed" &&
          event.pipelineRunId === oldRun.runId,
      ),
    ).toHaveLength(1);
  });

  test("bounds permanently unavailable terminal artifact retries and emits one durable disposition", async () => {
    const { ctx, emitted } = fixture();
    const statePath = ctx.appPath(".state/watchers/aks-pipeline.json");
    const run = {
      runId: "176780615",
      fingerprint: "terminal-fingerprint",
      status: "completed",
      result: "failed",
      sourceBranch: "refs/heads/validation/master-validation-176780615",
      sourceVersion: "old-commit",
      finishTime: "2026-08-15T04:00:00Z",
      queueTime: "2026-08-15T03:00:00Z",
      artifacts: ["slice-01-test-results"],
      progressive: true,
      artifactObservable: true,
    };
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(
      statePath,
      JSON.stringify({
        schemaVersion: "10",
        adoFingerprints: { [run.runId]: "previous-live" },
        trackedRunIds: [run.runId],
      }),
    );
    let downloads = 0;
    const dependencies = {
      scanAdoRuns: async () => [run],
      listArtifactNames: async () => ["slice-01-test-results"],
      downloadArtifact: async () => {
        downloads += 1;
        return false;
      },
    };

    for (let attempt = 0; attempt < 4; attempt += 1)
      await observeAksPipelines(ctx, dependencies);

    const state = JSON.parse(readFileSync(statePath, "utf8"));
    expect(downloads).toBe(3);
    expect(state.trackedRunIds).not.toContain(run.runId);
    expect(state.terminalArtifactAttempts).toEqual({});
    expect(state.terminalArtifactUnavailable[run.runId]).toContain(
      run.fingerprint,
    );
    expect(
      emitted.filter(
        (event) =>
          event.type === "pipeline-artifact.unavailable" &&
          event.pipelineRunId === run.runId,
      ),
    ).toHaveLength(1);
    expect(
      emitted.filter(
        (event) =>
          event.type === "pipeline.failure.observed" &&
          event.pipelineRunId === run.runId &&
          event.category === "terminal_artifact_unavailable",
      ),
    ).toHaveLength(1);
  });

  test("does not accept an empty or malformed artifact directory", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-pipeline-artifact-"));
    roots.push(root);
    expect(artifactDirectoryReady(root)).toBe(false);
    writeFileSync(join(root, "result.json"), "not-json");
    expect(artifactDirectoryReady(root)).toBe(false);
    writeFileSync(
      join(root, "result.json"),
      JSON.stringify({ status: "pass" }),
    );
    expect(artifactDirectoryReady(root)).toBe(true);
  });
});
