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
import type { ProjectAppContext } from "@may-agent/sdk";
import {
  observeAksPipelines,
  artifactRunCandidates,
  artifactDirectoryReady,
  boundedTrackedRunIds,
  masterValidationNoVerdictFailure,
  pipelineLevelEvent,
  pipelineObservationEvents,
  pipelineQueueOverdueEvent,
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

function fixture() {
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
    JSON.stringify({ runId: "run-1", status: "passed", counts: { pass: 1 } }),
  );
  const emitted: Record<string, unknown>[] = [];
  const ctx = {
    appPath: (path: string) => resolve(appDir, path),
    emit: (event: Record<string, unknown>) => emitted.push(event),
    noop: (reason: string) => ({ reason }),
  } as ProjectAppContext;
  return { ctx, emitted, resultPath, resultsRoot: dirname(resultDir) };
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
