import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bindKnownWorkflowRun, loadSpecLoopState } from "./spec-loop-store.ts";

describe("spec-loop-store", () => {
  test("reconciles existing state with the current spec catalog", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-loop-store-"));
    const projectDir = join(root, "project");
    const appDir = join(root, "app");
    const statePath = join(appDir, ".state", "spec-loop", "state.json");

    await mkdir(join(projectDir, "specs"), { recursive: true });
    await mkdir(join(projectDir, ".github", "workflows", "feature-sets"), {
      recursive: true,
    });
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });

    await writeFile(
      join(projectDir, "specs", "index.json"),
      `${JSON.stringify({ specFiles: ["existing.json", "added.json"] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "existing.json"),
      `${JSON.stringify({ id: "spec.existing", featurePathIds: ["path.existing"] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "added.json"),
      `${JSON.stringify({ id: "spec.added", featurePathIds: ["path.priority"] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "path.priority\n",
      "utf8",
    );
    await writeFile(
      statePath,
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.existing": {
              status: "pass",
              taskId: null,
              attempts: 1,
              lastRunId: "1",
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              activeAttemptId: null,
              activeTaskSessionId: null,
              activeWorkflowRunId: null,
              heartbeatAt: null,
              updatedAt: "2026-06-30T00:00:00.000Z",
            },
            "spec.removed": {
              status: "error",
              taskId: null,
              attempts: 1,
              lastRunId: "2",
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              activeAttemptId: null,
              activeTaskSessionId: null,
              activeWorkflowRunId: "2",
              heartbeatAt: null,
              updatedAt: "2026-06-30T00:00:00.000Z",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const { state } = loadSpecLoopState({
      appDir,
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 5,
      statePath,
    });

    expect(Object.keys(state.specs).sort()).toEqual([
      "spec.added",
      "spec.existing",
    ]);
    expect(state.specs["spec.existing"].status).toBe("pass");
    expect(state.specs["spec.added"].status).toBe("pending");
    expect(state.prioritySpecIds).toEqual(["spec.added"]);
  });

  test("clears active workflow fields for non-running specs", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-loop-store-"));
    const projectDir = join(root, "project");
    const appDir = join(root, "app");
    const statePath = join(appDir, ".state", "spec-loop", "state.json");

    await mkdir(join(projectDir, "specs"), { recursive: true });
    await mkdir(join(projectDir, ".github", "workflows", "feature-sets"), {
      recursive: true,
    });
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, "specs", "index.json"),
      `${JSON.stringify({ specFiles: ["a.json"] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "a.json"),
      `${JSON.stringify({ id: "spec.a" }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );
    await writeFile(
      statePath,
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a": {
              status: "done",
              taskId: "verify-spec-a",
              attempts: 1,
              lastRunId: "1",
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              activeAttemptId: "attempt",
              activeTaskSessionId: "session",
              activeWorkflowRunId: "1",
              heartbeatAt: "2026-06-30T00:00:00.000Z",
              updatedAt: "2026-06-30T00:00:00.000Z",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const { state } = loadSpecLoopState({
      appDir,
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 5,
      statePath,
    });

    expect(state.specs["spec.a"]).toMatchObject({
      status: "pending",
      activeAttemptId: null,
      activeTaskSessionId: null,
      activeWorkflowRunId: null,
      heartbeatAt: null,
    });
  });

  test("bindKnownWorkflowRun preserves loop-key and dispatch-metadata correlation fields", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-loop-store-"));
    const projectDir = join(root, "project");
    const appDir = join(root, "app");

    await mkdir(join(projectDir, "specs"), { recursive: true });
    await mkdir(join(projectDir, ".github", "workflows", "feature-sets"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "specs", "index.json"),
      `${JSON.stringify({ specFiles: ["a.json"] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectDir, "specs", "a.json"),
      `${JSON.stringify({ id: "spec.a" }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        ".github",
        "workflows",
        "feature-sets",
        "dev-infra-core.txt",
      ),
      "",
      "utf8",
    );

    const { state } = loadSpecLoopState({
      appDir,
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 5,
    });

    bindKnownWorkflowRun(state, "spec.a", {
      runId: "123",
      runUrl: "https://github.com/example/repo/actions/runs/123",
      taskId: "verify-spec-a",
      attemptId: "a_verify-spec-a_20260630",
      taskSessionId: "s_verify-spec-a",
      status: "running",
      loopKey: "verify-spec-a-a_verify-spec-a_20260630",
      dispatchMetadataPath: "/tmp/spec-a-dispatch.json",
    });

    expect(state.specs["spec.a"]).toMatchObject({
      status: "running",
      activeWorkflowRunId: "123",
      lastRunUrl: "https://github.com/example/repo/actions/runs/123",
      lastWorkflowLoopKey: "verify-spec-a-a_verify-spec-a_20260630",
      lastDispatchMetadataPath: "/tmp/spec-a-dispatch.json",
    });
  });
});
