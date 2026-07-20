import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./feature-compact-loop-controller";

async function workspace(item: Record<string, unknown>, represented = false) {
  const root = await mkdtemp(join(tmpdir(), "compact-loop-v2-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, ".state", "feature-compact-loop"), {
    recursive: true,
  });
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, "features", "networking", "specs"), {
    recursive: true,
  });
  await writeFile(
    join(projectDir, "features", "networking", "specs", "case.json"),
    JSON.stringify({ id: "spec.networking.case" }),
  );
  await writeFile(
    join(appDir, ".state", "feature-compact-loop", "state.json"),
    JSON.stringify({
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      cursor: 0,
      features: { networking: item },
    }),
  );
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({
      schema_version: 2,
      tasks: represented
        ? { "existing-compact-task": { id: "existing-compact-task" } }
        : {},
      conditions: {},
      satisfied_dependency_ids: [],
    }),
  );
  return { appDir, projectDir };
}

function item(status: string, taskId?: string) {
  return {
    featureKey: "networking",
    capabilityId: "networking",
    packetPath: "features/networking.yaml",
    specsDir: "features/networking/specs",
    specCount: 2,
    status,
    taskId,
    attempts: 0,
    lastPlanPath: null,
    lastSummaryPath: null,
    lastDiagnosticsPath: null,
    lastResultPath: status === "done" ? "runs/result.json" : null,
    lastWorkflowRunId: status === "done" ? "run-1" : null,
    lastWorkflowRunUrl: null,
    lastWorkflowLoopKey: null,
    lastDispatchMetadataPath: null,
    lastLiveProofVersion: status === "done" ? "v1" : null,
    lastSummary: null,
    updatedAt: "2026-07-19T00:00:00Z",
  };
}

function context(appDir: string, projectDir: string) {
  return {
    task: `app: ${appDir}\nproject: ${projectDir}\n## Trigger Event\n\`\`\`json\n${JSON.stringify({ type: "project.task.tick", action: "feature-compact-loop", taskId: "aks-feature-compact-loop" })}\n\`\`\``,
    agent: "aks-explorer",
    done: (message: string, output?: unknown) => ({
      status: "done",
      message,
      output,
    }),
  } as any;
}

describe("feature compact reconciliation workflow", () => {
  test("converges when every package has live proof", async () => {
    const ws = await workspace(item("done"));
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });
  });

  test("does not accept a done label without durable live proof", async () => {
    const ws = await workspace({
      ...item("done"),
      lastLiveProofVersion: null,
    });

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            id: "compact/repair-compact-feature-networking-proof",
            outcome: expect.stringContaining("without launching"),
            input: {
              featureKey: "networking",
              repair: "legacy-proof",
              missingProofFields: ["lastLiveProofVersion"],
            },
          },
        ],
      },
    });
  });

  test("declares bounded owner work without assigning it", async () => {
    const ws = await workspace(item("pending"));
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            parentId: "group/feature-compact",
            owner: "aks-explorer",
            input: { featureKey: "networking" },
          },
        ],
      },
    });
    const [action] = result.output.actions;
    expect(action.id).toBe("compact/compact-feature-networking");
    expect(Object.keys(action.input).sort()).toEqual([
      "capabilityId",
      "featureKey",
      "loopTaskId",
      "packetPath",
      "statePath",
      "workRevision",
    ]);
    expect(action.outcome).not.toContain("pending");
  });

  test("keeps task identity stable while changing the desired work revision", async () => {
    const first = await workspace(item("pending"));
    const second = await workspace({
      ...item("pending"),
      inputFingerprint: "new-spec-catalog",
      updatedAt: "2026-07-20T00:00:00Z",
    });

    const firstResult = (await execute(
      context(first.appDir, first.projectDir),
    )) as any;
    const secondResult = (await execute(
      context(second.appDir, second.projectDir),
    )) as any;
    const firstAction = firstResult.output.actions[0];
    const secondAction = secondResult.output.actions[0];

    expect(firstAction.id).toBe("compact/compact-feature-networking");
    expect(secondAction.id).toBe(firstAction.id);
    expect(secondAction.input.workRevision).not.toBe(
      firstAction.input.workRevision,
    );
  });

  test("treats the deterministic compact leaf as represented before ledger writeback", async () => {
    const ws = await workspace(item("pending"));
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "compact/compact-feature-networking": {
            id: "compact/compact-feature-networking",
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });
  });

  test("does not return wait Conditions with converged action results", async () => {
    const ws = await workspace(item("pending", "existing-compact-task"), true);
    await mkdir(join(ws.projectDir, "features", "storage", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(ws.projectDir, "features", "storage", "specs", "case.json"),
      JSON.stringify({ id: "spec.storage.case" }),
    );
    await writeFile(
      join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
      JSON.stringify({
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 2,
        cursor: 0,
        features: {
          networking: item("running", "existing-compact-task"),
          storage: {
            ...item("pending"),
            featureKey: "storage",
            capabilityId: "storage",
            packetPath: "features/storage.yaml",
            specsDir: "features/storage/specs",
          },
        },
      }),
    );

    const result = await execute(context(ws.appDir, ws.projectDir));
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            parentId: "group/feature-compact",
            input: { featureKey: "storage" },
          },
        ],
      },
    });
    expect((result as any).output.conditions).toBeUndefined();
  });

  test("prunes stale compact rows for features absent from the current project layout", async () => {
    const ws = await workspace(item("pending"));
    await writeFile(
      join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
      JSON.stringify({
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 1,
        cursor: 0,
        features: {
          networking: item("pending"),
          "service-platform": {
            ...item("pending"),
            featureKey: "service-platform",
            capabilityId: "service-platform",
            packetPath: "features/service-platform.yaml",
            specsDir: "features/service-platform/specs",
          },
        },
      }),
    );

    await execute(context(ws.appDir, ws.projectDir));

    const state = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(Object.keys(state.features).sort()).toEqual(["networking"]);
  });

  test("converges when a compact task is represented", async () => {
    const ws = await workspace(item("running", "existing-compact-task"), true);
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [],
      },
    });
  });

  test("converges when the only represented compact task needs attention", async () => {
    const ws = await workspace(item("running", "existing-compact-task"));
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "existing-compact-task": {
            id: "existing-compact-task",
            phase: "attention",
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });
  });
});
