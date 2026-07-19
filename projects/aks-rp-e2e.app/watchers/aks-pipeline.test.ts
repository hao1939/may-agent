import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ProjectAppContext } from "@may-agent/sdk";
import { observeAksPipelines, scanPipelineResults } from "./aks-pipeline.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
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
        data: expect.objectContaining({
          pipelineRunId: "run-1",
          status: "failed",
        }),
      }),
    );
  });
});
