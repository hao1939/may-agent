import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildMasterValidationProgress,
  failureObservationsFromAdmissionReport,
  failureObservationsFromArtifact,
  planDirectoryReady,
  pipelineFailureEvent,
  pipelineSpecEvent,
  specObservationsFromArtifact,
} from "./aks-pipeline.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("progressive master-validation observation", () => {
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
