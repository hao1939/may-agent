import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  failureObservationsFromArtifact,
  pipelineFailureEvent,
  pipelineSpecEvent,
  specObservationsFromArtifact,
} from "./aks-pipeline.js";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("progressive master-validation observation", () => {
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
