import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncSpecLiveProof } from "./spec-live-proof-sync.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("spec live proof sync", () => {
  test("projects an accepted workflow receipt into the app-owned spec ledger", () => {
    const appDir = mkdtempSync(join(tmpdir(), "spec-live-proof-sync-"));
    roots.push(appDir);
    const proofPath = join(appDir, ".state", "proof.json");
    mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
    mkdirSync(join(appDir, ".state", "spec-loop"), { recursive: true });
    writeFileSync(
      proofPath,
      JSON.stringify({
        version: 1,
        specId: "spec.example.lifecycle",
        runId: "42",
        sourceCommit: "abc",
        sourceBranch: "task/spec-example",
        verdict: "pass",
        reviewedAt: "2026-07-21T00:00:00.000Z",
      }),
    );
    writeFileSync(
      join(appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        receipts: {
          "spec/example": {
            workflow: "spec-live-reconciliation",
            evidence: [`proof:${proofPath}`],
          },
        },
      }),
    );
    writeFileSync(
      join(appDir, ".state", "spec-loop", "state.json"),
      JSON.stringify({
        specs: {
          "spec.example.lifecycle": {
            status: "pending",
            taskId: "spec/example",
            lastRunId: "old-run",
            lastRunUrl: "https://github.com/example/actions/runs/old-run",
            lastResultPath: ".state/spec-loop/artifacts/old-run/result.json",
            catalogStatus: "ready",
            catalogSpecState: "ready",
            successorDisposition: "workflow-auth-preflight-blocker",
            successorEvidencePath: "evidence/old-github-blocker.md",
            successorRunId: "old-run",
            successorRunUrl: "https://github.com/example/actions/runs/old-run",
            successorResultPath:
              ".state/spec-loop/artifacts/old-run/result.json",
            successorStateReason: "GitHub authentication failed.",
            resumeCondition: "Wait for GitHub authentication repair.",
            review: {
              lastRootCause: "GitHub authentication failed.",
              lastAction: "Wait for GitHub authentication repair.",
              reviewedAt: "2026-07-01T00:00:00.000Z",
            },
          },
        },
      }),
    );

    expect(syncSpecLiveProof(appDir, "spec/example")).toMatchObject({
      changed: true,
      specId: "spec.example.lifecycle",
      runId: "42",
    });
    expect(
      JSON.parse(
        readFileSync(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
      ).specs["spec.example.lifecycle"],
    ).toMatchObject({
      status: "pass",
      taskId: null,
      lastRunId: "42",
      lastRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=42",
      lastResultPath: null,
      catalogStatus: "pass",
      catalogSpecState: "verified",
      review: {
        acceptedRunId: "42",
        sourceCommit: "abc",
      },
    });
    const projected = JSON.parse(
      readFileSync(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    ).specs["spec.example.lifecycle"];
    expect(projected).not.toHaveProperty("successorDisposition");
    expect(projected).not.toHaveProperty("successorEvidencePath");
    expect(projected).not.toHaveProperty("successorRunId");
    expect(projected).not.toHaveProperty("successorRunUrl");
    expect(projected).not.toHaveProperty("successorResultPath");
    expect(projected).not.toHaveProperty("successorStateReason");
    expect(projected).not.toHaveProperty("resumeCondition");
    expect(projected.review).not.toHaveProperty("lastRootCause");
    expect(projected.review).not.toHaveProperty("lastAction");
    expect(projected.review).not.toHaveProperty("reviewedAt");
  });

  test("projects the accepted aggregate artifact path from the receipt", () => {
    const appDir = mkdtempSync(join(tmpdir(), "spec-live-proof-sync-"));
    roots.push(appDir);
    const proofPath = join(appDir, ".state", "proof.json");
    const aggregatePath = join(appDir, "runs", "42", "result.json");
    mkdirSync(join(appDir, ".state", "tasks"), { recursive: true });
    mkdirSync(join(appDir, ".state", "spec-loop"), { recursive: true });
    writeFileSync(
      proofPath,
      JSON.stringify({
        specId: "spec.example.lifecycle",
        runId: "42",
        sourceCommit: "abc",
        verdict: "pass",
      }),
    );
    writeFileSync(
      join(appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        receipts: {
          "spec/example": {
            workflow: "spec-live-reconciliation",
            evidence: [`proof:${proofPath}`],
            acceptanceBasis: {
              evidence: [`aggregate-artifact:${aggregatePath}`],
            },
          },
        },
      }),
    );
    writeFileSync(
      join(appDir, ".state", "spec-loop", "state.json"),
      JSON.stringify({ specs: { "spec.example.lifecycle": {} } }),
    );

    expect(syncSpecLiveProof(appDir, "spec/example").changed).toBe(true);
    const projected = JSON.parse(
      readFileSync(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    ).specs["spec.example.lifecycle"];
    expect(projected.lastResultPath).toBe(aggregatePath);
    expect(projected.review.acceptedResultPath).toBe(aggregatePath);
  });
});
