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
      review: {
        acceptedRunId: "42",
        sourceCommit: "abc",
      },
    });
  });
});
