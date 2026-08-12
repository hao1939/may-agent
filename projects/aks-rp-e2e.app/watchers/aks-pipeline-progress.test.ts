import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildMasterValidationProgress,
  failureObservationsFromAdmissionReport,
  failureObservationsFromArtifact,
  isTaskOwnedSpecRun,
  newPipelineTestNonpassingEvents,
  nodeImagePublicationEvent,
  nodeImagePublicationObservationsFromArtifact,
  planDirectoryReady,
  pipelineFailureEvent,
  pipelineSpecEvent,
  specObservationsFromArtifact,
  timelineSliceProgress,
  timelineSpecProgress,
} from "./aks-pipeline.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

test("observes artifacts for task-owned explicit spec runs", () => {
  expect(
    isTaskOwnedSpecRun({
      templateParameters: {
        specs: "spec.example",
        metadata: JSON.stringify({ taskId: "domain/example" }),
      },
    }),
  ).toBe(true);
  expect(
    isTaskOwnedSpecRun({
      templateParameters: {
        specs: "spec.example",
        metadata: JSON.stringify({ task: "feature-compact-example" }),
      },
    }),
  ).toBe(true);
  expect(
    isTaskOwnedSpecRun({
      templateParameters: { specs: "spec.example", metadata: "{}" },
    }),
  ).toBe(false);
});

describe("progressive master-validation observation", () => {
  test("uses provider job state for truthful slice progress without guessing per-spec state", () => {
    const planRoot = mkdtempSync(join(tmpdir(), "aks-plan-"));
    roots.push(planRoot);
    const planDir = join(planRoot, "plan-slices", "plan-1");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "slice-01.json"),
      JSON.stringify({ slice: "01", specIds: ["spec.a", "spec.b"] }),
    );
    writeFileSync(
      join(planDir, "slice-02.json"),
      JSON.stringify({ slice: "02", specIds: ["spec.c"] }),
    );

    const slices = timelineSliceProgress([
      {
        type: "Job",
        name: "Execute slice slice_01",
        state: "inProgress",
      },
      {
        type: "Job",
        name: "Execute slice slice_02",
        state: "pending",
      },
      { type: "Job", name: "Plan AKS RP E2E specs", state: "completed" },
    ]);
    expect(slices).toEqual([
      { sliceId: "01", executionState: "running" },
      { sliceId: "02", executionState: "queued" },
    ]);

    const projection = buildMasterValidationProgress({
      run: {
        runId: "123",
        fingerprint: "fp",
        status: "inProgress",
        result: "inProgress",
        sourceBranch: "refs/heads/main",
        sourceVersion: "abc",
        finishTime: null,
        queueTime: "2026-07-25T00:00:00Z",
        artifacts: [],
        progressive: true,
      },
      planRoot,
      artifactRoots: {},
      timelineSlices: slices,
    });
    expect(projection.slices).toEqual([
      { sliceId: "01", selected: 2, observed: 0, status: "running" },
      { sliceId: "02", selected: 1, observed: 0, status: "queued" },
    ]);
    expect(projection.counts).toMatchObject({ queued: 0, running: 0 });
    expect(
      projection.specs.every((spec) => spec.executionState === undefined),
    ).toBe(true);
  });

  test("parses owned timeline details and projects queued, running, and early failure state", () => {
    const planRoot = mkdtempSync(join(tmpdir(), "aks-plan-"));
    roots.push(planRoot);
    const planDir = join(planRoot, "plan-slices", "plan-1");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "slice-05.json"),
      JSON.stringify({
        slice: "05",
        specIds: ["spec.queued", "spec.running", "spec.failed"],
      }),
    );
    const detail = (value: Record<string, unknown>) => ({
      type: "aks-spec-progress",
      currentOperation: JSON.stringify({
        schemaVersion: "1",
        runId: "123",
        sliceId: "05",
        testRunId: "test-1",
        sequence: 1,
        executionState: "queued",
        verdict: "unknown",
        phase: "preflight",
        phaseDetail: "queued",
        message: "Waiting for a worker.",
        updatedAt: "2026-07-25T00:00:00Z",
        elapsedSeconds: 0,
        ...value,
      }),
    });
    const live = timelineSpecProgress([
      detail({ specId: "spec.queued" }),
      detail({
        specId: "spec.running",
        sequence: 2,
        executionState: "running",
        phase: "setup",
        phaseDetail: "cluster-create",
        message: "Cluster create is running.",
      }),
      detail({
        specId: "spec.failed",
        sequence: 3,
        executionState: "running",
        verdict: "fail",
        phase: "cleanup",
        phaseDetail: "resource-group-delete",
        message: "Webhook assertion failed; cleanup is running.",
        category: "product_failure",
      }),
      // Older updates cannot replace the current level.
      detail({ specId: "spec.failed", sequence: 2 }),
      { type: "Job", currentOperation: "{}" },
    ]);
    expect(live).toHaveLength(3);

    const run = {
      runId: "123",
      fingerprint: "fp",
      status: "inProgress",
      result: "inProgress",
      sourceBranch: "refs/heads/main",
      sourceVersion: "abc",
      finishTime: null,
      queueTime: "2026-07-25T00:00:00Z",
      artifacts: [],
      progressive: true,
    };
    const projection = buildMasterValidationProgress({
      run,
      planRoot,
      artifactRoots: {},
      timelineProgress: live,
      checkedAt: "2026-07-25T00:01:00Z",
    });
    expect(projection).toMatchObject({
      counts: {
        selected: 3,
        observed: 1,
        pending: 2,
        queued: 1,
        running: 2,
        fail: 1,
      },
      slices: [{ sliceId: "05", selected: 3, observed: 0, status: "partial" }],
    });
    expect(projection.specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          specId: "spec.running",
          status: "pending",
          executionState: "running",
          phaseDetail: "cluster-create",
          elapsedSeconds: 60,
        }),
        expect.objectContaining({
          specId: "spec.failed",
          status: "fail",
          executionState: "running",
          phase: "cleanup",
        }),
      ]),
    );

    const fingerprints: Record<string, string> = {};
    const first = newPipelineTestNonpassingEvents(run, live, fingerprints);
    const replay = newPipelineTestNonpassingEvents(run, live, fingerprints);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      type: "pipeline.test.nonpassing",
      specId: "spec.failed",
      status: "fail",
    });
    expect(replay).toEqual([]);
  });

  test("accepts Azure provider-field progress when currentOperation is display text", () => {
    const live = timelineSpecProgress([
      {
        type: "aks-spec-progress",
        name: "spec.running",
        state: "inProgress",
        currentOperation: "Scenario execution started.",
        changeId: 4,
        startTime: "2026-08-01T07:08:00Z",
        pipelineRunId: "174773413",
        sliceId: "03",
      },
      {
        type: "aks-spec-progress",
        name: "spec.failed",
        state: "completed",
        result: "failed",
        currentOperation: null,
        changeId: 7,
        startTime: "2026-08-01T07:08:00Z",
        finishTime: "2026-08-01T07:22:00Z",
        pipelineRunId: "174773413",
        sliceId: "03",
      },
    ]);

    expect(live).toEqual([
      expect.objectContaining({
        runId: "174773413",
        sliceId: "03",
        specId: "spec.failed",
        executionState: "completed",
        verdict: "fail",
        phase: "provider-timeline",
      }),
      expect.objectContaining({
        runId: "174773413",
        sliceId: "03",
        specId: "spec.running",
        executionState: "running",
        verdict: "unknown",
        phaseDetail: "Scenario execution started.",
      }),
    ]);

    const projection = buildMasterValidationProgress({
      run: {
        runId: "174773413",
        fingerprint: "provider-fields",
        status: "inProgress",
        result: "inProgress",
        sourceBranch: "refs/heads/main",
        sourceVersion: "abc",
        finishTime: null,
        queueTime: "2026-08-01T07:00:00Z",
        artifacts: [],
        progressive: true,
      },
      planRoot: null,
      artifactRoots: {},
      timelineProgress: live,
      checkedAt: "2026-08-01T09:08:00Z",
    });
    expect(
      projection.specs.find((spec) => spec.specId === "spec.running"),
    ).toMatchObject({ elapsedSeconds: 0 });
  });

  test("turns a soft admission exclusion into durable repair work", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-plan-"));
    roots.push(root);
    writeFileSync(
      join(root, "live-admission-report.json"),
      JSON.stringify({
        schemaVersion: 1,
        admittedSpecIds: ["spec.passing"],
        excluded: [
          {
            specId: "spec.needs-repair",
            bucket: "runner-exclusion-needing-replay-gate-repair",
            reason: "runner did not recognize its live gate",
          },
        ],
      }),
    );

    const failures = failureObservationsFromAdmissionReport({
      root,
      pipelineRunId: "123",
      sourceBranch: "refs/heads/main",
      sourceCommit: "abc123",
    });
    expect(failures).toMatchObject([
      {
        specId: "spec.needs-repair",
        status: "excluded",
        category: "admission_exclusion",
        sliceId: "admission",
        artifactName: "plan-inputs",
      },
    ]);
    expect(pipelineFailureEvent(failures[0])).toMatchObject({
      type: "pipeline.failure.observed",
      data: { specId: "spec.needs-repair", status: "excluded" },
    });
  });

  test("projects selected and completed specs without writing task state", () => {
    const planRoot = mkdtempSync(join(tmpdir(), "aks-plan-"));
    const artifactRoot = mkdtempSync(join(tmpdir(), "aks-slice-"));
    roots.push(planRoot, artifactRoot);
    const planDir = join(planRoot, "plan-slices", "plan-1");
    const resultDir = join(artifactRoot, "runs", "test-results", "slice-run");
    mkdirSync(planDir, { recursive: true });
    mkdirSync(resultDir, { recursive: true });
    writeFileSync(
      join(planDir, "slice-02.json"),
      JSON.stringify({
        slice: "02",
        specIds: ["spec.passing", "spec.pending"],
      }),
    );
    writeFileSync(
      join(resultDir, "result.json"),
      JSON.stringify({
        specResults: [
          {
            specId: "spec.passing",
            status: "pass",
            category: "none",
            reason: "passed",
          },
        ],
      }),
    );

    expect(planDirectoryReady(planRoot)).toBe(true);
    expect(
      buildMasterValidationProgress({
        run: {
          runId: "123",
          fingerprint: "fp",
          status: "inProgress",
          result: "inProgress",
          sourceBranch: "refs/heads/main",
          sourceVersion: "abc",
          finishTime: null,
          queueTime: "2026-07-23T00:00:00Z",
          artifacts: [],
          progressive: true,
        },
        planRoot,
        artifactRoots: { "slice-02-test-results": artifactRoot },
        checkedAt: "2026-07-23T00:05:00Z",
      }),
    ).toMatchObject({
      runId: "123",
      sourceCommit: "abc",
      counts: {
        selected: 2,
        observed: 1,
        pending: 1,
        pass: 1,
        fail: 0,
        excluded: 0,
      },
      slices: [{ sliceId: "02", selected: 2, observed: 1, status: "partial" }],
      specs: [
        { sliceId: "02", specId: "spec.passing", status: "pass" },
        { sliceId: "02", specId: "spec.pending", status: "pending" },
      ],
    });
  });

  test("lets an artifact verdict complete a stale running timeline row", () => {
    const planRoot = mkdtempSync(join(tmpdir(), "aks-plan-"));
    const artifactRoot = mkdtempSync(join(tmpdir(), "aks-slice-"));
    roots.push(planRoot, artifactRoot);
    const planDir = join(planRoot, "plan-slices", "plan-1");
    const resultDir = join(artifactRoot, "runs", "test-results", "slice-run");
    mkdirSync(planDir, { recursive: true });
    mkdirSync(resultDir, { recursive: true });
    writeFileSync(
      join(planDir, "slice-11.json"),
      JSON.stringify({ slice: "11", specIds: ["spec.fips"] }),
    );
    writeFileSync(
      join(resultDir, "result.json"),
      JSON.stringify({
        specResults: [
          {
            specId: "spec.fips",
            status: "pass",
            category: "none",
            reason: "FIPS validation passed.",
          },
        ],
      }),
    );

    const projection = buildMasterValidationProgress({
      run: {
        runId: "174826569",
        fingerprint: "fp",
        status: "inProgress",
        result: "inProgress",
        sourceBranch: "refs/heads/main",
        sourceVersion: "abc",
        finishTime: null,
        queueTime: "2026-08-02T04:50:17Z",
        artifacts: [],
        progressive: true,
      },
      planRoot,
      artifactRoots: { "slice-11-test-results": artifactRoot },
      timelineProgress: [
        {
          runId: "174826569",
          sliceId: "11",
          testRunId: "fips-live",
          specId: "spec.fips",
          sequence: 1,
          executionState: "running",
          verdict: "unknown",
          phase: "provider-timeline",
          phaseDetail: "Scenario execution started.",
          message: "Scenario execution started.",
          updatedAt: "2026-08-02T05:27:09Z",
          elapsedSeconds: 0,
          category: "unknown",
        },
      ],
      checkedAt: "2026-08-02T06:10:10Z",
    });

    expect(projection.specs).toEqual([
      expect.objectContaining({
        specId: "spec.fips",
        status: "pass",
        executionState: "completed",
        phase: "artifact-result",
        phaseDetail: "pass",
        updatedAt: "2026-08-02T06:10:10Z",
        elapsedSeconds: 2581,
        artifactPath: expect.stringContaining("result.json"),
      }),
    ]);
    expect(projection.specs[0]).not.toHaveProperty("stale");
    expect(projection.counts).toMatchObject({
      observed: 1,
      pending: 0,
      running: 0,
      pass: 1,
    });
  });

  test("represents missing planned slice artifacts and preserves stronger current verdicts", () => {
    const planRoot = mkdtempSync(join(tmpdir(), "aks-plan-"));
    roots.push(planRoot);
    const planDir = join(planRoot, "plan-slices", "plan-174203766");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "slice-08.json"),
      JSON.stringify({
        slice: "08",
        specIds: [
          "spec.network-isolated.managed-acr-outbound-none-vm-prerelease",
          "spec.node-custom-ca-trust.create",
          "spec.traffic-azure-service-mesh.master-validation-functionality-azurelinux",
          "spec.virtualmachines.mixed-sku-upgrade",
        ],
      }),
    );
    writeFileSync(
      join(planRoot, "live-admission-report.json"),
      JSON.stringify({
        schemaVersion: 1,
        admittedSpecIds: [
          "spec.network-isolated.managed-acr-outbound-none-vm-prerelease",
          "spec.node-custom-ca-trust.create",
          "spec.traffic-azure-service-mesh.master-validation-functionality-azurelinux",
          "spec.virtualmachines.mixed-sku-upgrade",
        ],
      }),
    );

    const projection = buildMasterValidationProgress({
      run: {
        runId: "174203766",
        fingerprint: "fp",
        status: "completed",
        result: "failed",
        sourceBranch: "refs/heads/validation/master-validation-173853081",
        sourceVersion: "2f74d4f1d6623bf7867893e5df5f802b1b329dde",
        finishTime: "2026-07-29T02:10:00Z",
        queueTime: "2026-07-28T22:02:07.894561+00:00",
        artifacts: ["plan-inputs"],
        progressive: true,
      },
      planRoot,
      artifactRoots: {},
      preservedVerdicts: {
        "spec.node-custom-ca-trust.create": {
          status: "pass",
          category: "preserved_current_exact_verdict",
          reason:
            "Treat spec.node-custom-ca-trust.create as pass from compact run 28541021680 as the current strongest verdict surface.",
          artifactPath:
            "/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json",
        },
      },
      checkedAt: "2026-07-29T02:15:45.969Z",
    });

    expect(projection.counts).toMatchObject({
      selected: 4,
      observed: 4,
      pending: 0,
      pass: 1,
      error: 3,
    });
    expect(projection.slices).toEqual([
      { sliceId: "08", selected: 4, observed: 4, status: "completed" },
    ]);
    expect(projection.specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sliceId: "08",
          specId: "spec.node-custom-ca-trust.create",
          status: "pass",
          category: "preserved_current_exact_verdict",
          artifactPath:
            "/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json",
        }),
        expect.objectContaining({
          sliceId: "08",
          specId:
            "spec.traffic-azure-service-mesh.master-validation-functionality-azurelinux",
          status: "error",
          category: "missing_slice_artifact",
          reason: expect.stringContaining(
            "completed without publishing slice-08-test-results",
          ),
        }),
      ]),
    );
    const preserved = projection.specs.find(
      (spec) => spec.specId === "spec.node-custom-ca-trust.create",
    );
    expect(preserved?.reason).toContain(
      "Preserved this stronger current verdict",
    );
  });

  test("emits a failure as soon as one slice result is available", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-slice-"));
    roots.push(root);
    const resultDir = join(root, "runs", "test-results", "slice-run");
    mkdirSync(resultDir, { recursive: true });
    writeFileSync(
      join(resultDir, "result.json"),
      JSON.stringify({
        status: "nonpassing",
        specResults: [
          {
            specId: "spec.example",
            status: "fail",
            category: "product_failure",
            reason: "GET returned 500 for cluster 123456",
          },
          { specId: "spec.passing", status: "pass", category: "none" },
        ],
      }),
    );
    const failures = failureObservationsFromArtifact({
      root,
      pipelineRunId: "123",
      sourceBranch: "refs/heads/main",
      sourceCommit: "abc123",
      artifactName: "slice-07-test-results",
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      specId: "spec.example",
      sliceId: "07",
      pipelineRunId: "123",
      sourceCommit: "abc123",
    });
    expect(pipelineFailureEvent(failures[0])).toMatchObject({
      type: "pipeline.failure.observed",
      data: {
        specId: "spec.example",
        pipelineRunId: "123",
        sliceId: "07",
      },
    });

    const observations = specObservationsFromArtifact({
      root,
      pipelineRunId: "123",
      sourceBranch: "refs/heads/main",
      sourceCommit: "abc123",
      artifactName: "slice-07-test-results",
    });
    expect(observations).toHaveLength(2);
    expect(pipelineSpecEvent(observations[1])).toMatchObject({
      type: "pipeline.spec.observed",
      specId: "spec.passing",
      status: "pass",
      sourceBranch: "refs/heads/main",
      artifactPath: expect.stringContaining("result.json"),
    });
  });

  test("projects AzureLinux security-patch publication state as structured fields", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-azurelinux-publication-"));
    roots.push(root);
    const runId = "test_20260805063245452_g6w9d7_409894";
    const resultDir = join(root, "runs", "test-results", runId);
    const testsDir = join(resultDir, "tests");
    mkdirSync(testsDir, { recursive: true });
    writeFileSync(
      join(resultDir, "result.json"),
      JSON.stringify({
        target: {
          name: "staging",
          environment: "staging",
          subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
          location: "westus2",
        },
        status: "nonpassing",
        specResults: [
          {
            specId: "spec.ccp-security-patch.azurelinux-prod-mtc",
            status: "blocked",
            category: "environment_blocker",
            reason: "No newer security patch image available.",
            artifactRefs: [
              `runs/test-results/${runId}/tests/ccp-security-patch-azurelinux-prod-mtc.json`,
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(testsDir, "ccp-security-patch-azurelinux-prod-mtc.json"),
      JSON.stringify({
        specId: "spec.ccp-security-patch.azurelinux-prod-mtc",
        assertions: [
          {
            name: "setup.cluster-created",
            detail:
              "Cluster created with nodeOSUpgradeChannel=SecurityPatch, osSKU=AzureLinux.",
          },
          {
            name: "snapshot.image-family-azurelinux",
            detail:
              "nodeImageVersion=AKSAzureLinux-V3gen2-202607.29.0, expected AKSAzureLinux* prefix",
          },
          {
            name: "assert.patch-availability",
            detail:
              "No newer security patch image available for AzureLinux. Current: AKSAzureLinux-V3gen2-202607.29.0. Available versions queried: (none). Skipping 60-min poll — environment-dependent, not a product defect.",
          },
        ],
        raw: {
          raw: {
            config: {
              subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
              location: "westus2",
              imageFamily: "AKSAzureLinux",
            },
          },
        },
      }),
    );

    const observations = nodeImagePublicationObservationsFromArtifact({
      root,
      pipelineRunId: "175244417",
      sourceBranch: "refs/heads/dev",
      sourceCommit: "fc6f20092ee567d9fa74601174a29e027f9fbcdc",
      artifactName: "slice-01-test-results",
    });
    expect(observations).toEqual([
      expect.objectContaining({
        project: "aks-rp-e2e",
        pipelineRunId: "175244417",
        specId: "spec.ccp-security-patch.azurelinux-prod-mtc",
        targetName: "staging",
        location: "westus2",
        subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
        imageFamily: "AKSAzureLinux",
        channel: "SecurityPatch",
        publishedVersion: "AKSAzureLinux-V3gen2-202607.29.0",
        currentNodeImageVersion: "AKSAzureLinux-V3gen2-202607.29.0",
        publishedVersions: [],
      }),
    ]);
    expect(nodeImagePublicationEvent(observations[0])).toMatchObject({
      type: "aks.node-image-publication.state",
      data: {
        targetName: "staging",
        location: "westus2",
        imageFamily: "AKSAzureLinux",
        channel: "SecurityPatch",
        publishedVersion: "AKSAzureLinux-V3gen2-202607.29.0",
      },
    });
  });

  test("downgrades aggregate pass rows when exact spec-runner coverage is incomplete", () => {
    const root = mkdtempSync(join(tmpdir(), "aks-slice-"));
    roots.push(root);
    const resultDir = join(
      root,
      "runs",
      "test-results",
      "test_20260803183502618_boysnr_631191",
    );
    const specRunnerDir = join(
      resultDir,
      "artifacts",
      "traffic-api-proxy-upgrade-survival",
      "spec-runner",
    );
    mkdirSync(specRunnerDir, { recursive: true });
    writeFileSync(
      join(resultDir, "result.json"),
      JSON.stringify({
        status: "nonpassing",
        specResults: [
          {
            specId: "spec.traffic-api-proxy.upgrade-survival",
            status: "pass",
            category: "none",
            reason:
              "traffic-api-proxy-upgrade-survival passed: 1 claims verified.",
            artifactRefs: [
              "runs/test-results/test_20260803183502618_boysnr_631191/artifacts/traffic-api-proxy-upgrade-survival/spec-runner/result.json",
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(specRunnerDir, "result.json"),
      JSON.stringify({
        status: "passed",
        summary:
          "traffic-api-proxy-upgrade-survival passed: 1 claims verified.",
        probeEvidence: {
          status: "pass",
          summary:
            "traffic-api-proxy-upgrade-survival passed: 1 claims verified.",
          assertions: [
            {
              name: "all-assertions-present",
              ok: true,
              detail:
                "Expected [assert.pre-upgrade.proxy-works, assert.upgrade.succeeded, assert.post-upgrade.proxy-works], found [assert.pre-upgrade.proxy-works, assert.upgrade.succeeded, assert.post-upgrade.proxy-works]",
              verdictImpact: "preflight",
            },
            {
              name: "claim.cluster-ready",
              ok: true,
              detail:
                "Cluster created, provisioningState=Succeeded. Feature validation requires kubectl for full assertion coverage.",
              verdictImpact: "claim",
            },
          ],
        },
      }),
    );

    const observations = specObservationsFromArtifact({
      root,
      pipelineRunId: "174976032",
      sourceBranch: "refs/heads/validation/master-validation-173853081",
      sourceCommit: "3ffc651bdbaccc9ba08e47d2eb9671ede3aad2f4",
      artifactName: "slice-07-test-results",
    });
    expect(observations).toEqual([
      expect.objectContaining({
        specId: "spec.traffic-api-proxy.upgrade-survival",
        status: "error",
        category: "insufficient_claim_coverage",
        artifactPath: join(specRunnerDir, "result.json"),
        reason: expect.stringContaining(
          "Missing successful claim/audit assertions: assert.pre-upgrade.proxy-works, assert.upgrade.succeeded, assert.post-upgrade.proxy-works.",
        ),
      }),
    ]);
    const failures = failureObservationsFromArtifact({
      root,
      pipelineRunId: "174976032",
      sourceBranch: "refs/heads/validation/master-validation-173853081",
      sourceCommit: "3ffc651bdbaccc9ba08e47d2eb9671ede3aad2f4",
      artifactName: "slice-07-test-results",
    });
    expect(failures).toEqual([
      expect.objectContaining({
        specId: "spec.traffic-api-proxy.upgrade-survival",
        status: "error",
        category: "insufficient_claim_coverage",
        artifactPath: join(specRunnerDir, "result.json"),
        reason: expect.stringContaining(
          "Missing successful claim/audit assertions: assert.pre-upgrade.proxy-works, assert.upgrade.succeeded, assert.post-upgrade.proxy-works.",
        ),
      }),
    ]);

    const projection = buildMasterValidationProgress({
      run: {
        runId: "174976032",
        fingerprint: "fp",
        status: "completed",
        result: "failed",
        sourceBranch: "refs/heads/validation/master-validation-173853081",
        sourceVersion: "3ffc651bdbaccc9ba08e47d2eb9671ede3aad2f4",
        finishTime: "2026-08-03T19:38:47.439Z",
        queueTime: "2026-08-03T18:33:35.176Z",
        artifacts: [],
        progressive: true,
      },
      planRoot: null,
      artifactRoots: { "slice-07-test-results": root },
      checkedAt: "2026-08-03T22:53:51.253Z",
    });
    expect(projection.counts).toMatchObject({
      selected: 1,
      observed: 1,
      pass: 0,
      error: 1,
      other: 0,
    });
    expect(projection.specs).toEqual([
      expect.objectContaining({
        specId: "spec.traffic-api-proxy.upgrade-survival",
        status: "error",
        category: "insufficient_claim_coverage",
      }),
    ]);
  });

  test("keeps the failure fingerprint stable across run-specific numbers", () => {
    const make = (reason: string) => {
      const root = mkdtempSync(join(tmpdir(), "aks-slice-"));
      roots.push(root);
      writeFileSync(
        join(root, "result.json"),
        JSON.stringify({
          specResults: [
            {
              specId: "spec.example",
              status: "fail",
              category: "implementation",
              reason,
            },
          ],
        }),
      );
      return failureObservationsFromArtifact({
        root,
        pipelineRunId: "123",
        sourceBranch: "main",
        sourceCommit: "abc",
        artifactName: "slice-01-test-results",
      })[0].fingerprint;
    };
    expect(make("request 123456 failed")).toBe(make("request 987654 failed"));
  });
});
