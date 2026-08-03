import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { execute } from "./feature-compact-loop-controller";

async function workspace(
  item: Record<string, unknown>,
  represented = false,
  options: { materializeResultPath?: boolean } = {},
) {
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
  const resultPath =
    typeof item.lastResultPath === "string" ? item.lastResultPath : null;
  if (resultPath && options.materializeResultPath !== false) {
    const resolvedPath = isAbsolute(resultPath)
      ? resultPath
      : join(projectDir, resultPath);
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(
      resolvedPath,
      JSON.stringify({ status: "passed", runId: "test-proof" }),
    );
  }
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({
      schema_version: 2,
      tasks: represented
        ? {
            "existing-compact-task": {
              id: "existing-compact-task",
              phase: "running",
            },
          }
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

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            id: expect.stringMatching(
              /^compact\/repair-compact-feature-networking-proof-[a-f0-9]{10}$/,
            ),
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
    const acceptance = result.output.actions[0].acceptance.join("\n");
    expect(acceptance).toContain(
      "do not return an action that references a missing task id",
    );
    expect(acceptance).toContain("exact branch/worktree in place");
    expect(acceptance).toContain("shared canonical dev checkout");
    expect(acceptance).toContain(
      "rebind the same task to a task-worktree workflow such as domain-task-execution",
    );
  });

  test("repairs a done row when its relative result artifact is missing", async () => {
    const ws = await workspace(
      {
        ...item("done"),
        lastResultPath: "runs/missing-result.json",
      },
      false,
      { materializeResultPath: false },
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            input: {
              featureKey: "networking",
              repair: "legacy-proof",
              missingProofFields: ["lastResultPath"],
            },
          },
        ],
      },
    });
  });

  test("repairs a done row when its absolute result artifact is missing", async () => {
    const ws = await workspace(
      {
        ...item("done"),
        lastResultPath: join(tmpdir(), "compact-loop-missing-proof", "result.json"),
      },
      false,
      { materializeResultPath: false },
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            input: {
              featureKey: "networking",
              repair: "legacy-proof",
              missingProofFields: ["lastResultPath"],
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
            parentId: "aks-feature-compact-loop",
            owner: "aks-explorer",
            input: { featureKey: "networking" },
          },
        ],
      },
    });
    const [action] = result.output.actions;
    expect(action.id).toMatch(
      /^compact\/compact-feature-networking-[a-f0-9]{10}$/,
    );
    expect(Object.keys(action.input).sort()).toEqual([
      "capabilityId",
      "featureKey",
      "loopId",
      "packetPath",
      "statePath",
      "workKey",
      "workRevision",
    ]);
    expect(action.outcome).not.toContain("pending");
    const acceptance = action.acceptance.join("\n");
    expect(acceptance).toContain("feature packet");
    expect(acceptance).toContain("reuse known-good carriers");
    expect(acceptance).toContain("Every feature-owned spec");
    expect(acceptance).toContain("shared/read-only");
    expect(acceptance).toContain("exact branch/worktree in place");
    expect(acceptance).toContain("shared canonical dev checkout");
    expect(acceptance).toContain("Rebind the same task to a task-worktree workflow");
    expect(acceptance).toContain("domain-task-execution");
    expect(acceptance).toContain("one natural ordered journey candidate");
    expect(acceptance).toContain("partial constraints");
    expect(acceptance).toContain(
      "Repeated create against satisfied state is a no-op",
    );
    expect(acceptance).toContain("unfinished compact work");
    expect(acceptance).toContain("planned cluster creates/recreates/updates");
    expect(acceptance).toContain("Regenerate the feature-owned compact plan");
    expect(acceptance).toContain(
      "real immutable-property or logical-history conflict",
    );
    expect(acceptance).toContain("branch/commit ADO will run");
    expect(acceptance).toContain("No no-op, dry-run, or metadata-only pass");
    expect(acceptance).toContain("ingested per spec branch");
    expect(acceptance).toContain("terminal with no artifacts");
    expect(acceptance).toContain("smallest failing branch");
    expect(acceptance).toContain(
      "do not return an action that references a missing task id",
    );
  });

  test("uses a new finite task identity when the desired work revision changes", async () => {
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

    expect(firstAction.id).toMatch(
      /^compact\/compact-feature-networking-[a-f0-9]{10}$/,
    );
    expect(secondAction.id).not.toBe(firstAction.id);
    expect(secondAction.input.workKey).toBe(firstAction.input.workKey);
    expect(secondAction.input.workRevision).not.toBe(
      firstAction.input.workRevision,
    );
  });

  test("treats the deterministic compact leaf as represented before ledger writeback", async () => {
    const ws = await workspace(item("pending"));
    const first = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const workRevision = first.output.actions[0].input.workRevision;
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          [first.output.actions[0].id]: {
            id: first.output.actions[0].id,
            phase: "running",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision,
            },
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

  test("treats a live feature holder referenced by taskId/frontierTaskIds as represented", async () => {
    const pendingWithHolder = {
      ...item("pending", "hold-networking-ready-package-abcdef1234"),
      frontierTaskIds: ["hold-networking-ready-package-abcdef1234"],
    };
    const ws = await workspace(pendingWithHolder);
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "hold-networking-ready-package-abcdef1234": {
            id: "hold-networking-ready-package-abcdef1234",
            phase: "waiting",
            input: {
              currentHead: "deadbeef",
            },
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
    const revisionSeed = await workspace(item("pending"));
    const initial = (await execute(
      context(revisionSeed.appDir, revisionSeed.projectDir),
    )) as any;
    const networkingRevision = initial.output.actions.find(
      (action: any) => action.input.featureKey === "networking",
    ).input.workRevision;
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
          networking: item("pending", "existing-compact-task"),
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
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "existing-compact-task": {
            id: "existing-compact-task",
            phase: "waiting",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision: networkingRevision,
            },
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    const result = await execute(context(ws.appDir, ws.projectDir));
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            parentId: "aks-feature-compact-loop",
            input: { featureKey: "storage" },
          },
        ],
      },
    });
    expect((result as any).output.conditions).toBeUndefined();
  });

  test("repairs a stale structured compact representation instead of reusing a completed leaf id", async () => {
    const ws = await workspace({
      ...item("blocked", "completed-compact-networking"),
      frontierTaskIds: ["completed-compact-networking"],
      waitingFor: {
        type: "git.ref.containsCommit",
        taskId: "completed-compact-networking",
        conditionId:
          "task-completed-compact-networking-origin-dev-contains-deadbeef",
        commit: "deadbeef",
      },
      waitingCondition:
        "Wake when origin/dev contains deadbeef or accepted same-path evidence materially changes.",
      resumeCondition: "origin/dev contains deadbeef",
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            id: expect.stringMatching(
              /^compact\/repair-compact-feature-networking-representation-[a-f0-9]{10}$/,
            ),
            owner: "aks-explorer",
            input: {
              featureKey: "networking",
              repair: "representation",
            },
          },
        ],
      },
    });
    const acceptance = result.output.actions[0].acceptance.join("\n");
    expect(acceptance).toContain(
      "recreate or repoint exactly one live holder task",
    );
    expect(acceptance).toContain("exact branch/worktree in place");
    expect(acceptance).toContain("shared canonical dev checkout");
    expect(acceptance).toContain(
      "rebind the same task to a task-worktree workflow such as domain-task-execution",
    );
    expect(acceptance).toContain("repair the representation first");
  });

  test("does not reuse a completed representation repair id that only exists in receipts", async () => {
    const ws = await workspace({
      ...item("blocked", "completed-compact-networking"),
      frontierTaskIds: ["completed-compact-networking"],
      waitingFor: {
        type: "git.ref.containsCommit",
        taskId: "completed-compact-networking",
        conditionId:
          "task-completed-compact-networking-origin-dev-contains-deadbeef",
        commit: "deadbeef",
      },
      waitingCondition:
        "Wake when origin/dev contains deadbeef or accepted same-path evidence materially changes.",
      resumeCondition: "origin/dev contains deadbeef",
    });

    const initial = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const occupiedId = initial.output.actions[0].id;
    await writeFile(
      join(ws.appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        receipts: {
          [occupiedId]: {
            metadata: { id: occupiedId },
            status: { phase: "converged" },
          },
        },
        resources: {},
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            owner: "aks-explorer",
            input: {
              featureKey: "networking",
              repair: "representation",
            },
          },
        ],
      },
    });
    expect(result.output.actions[0].id).not.toBe(occupiedId);
    expect(result.output.actions[0].id).toMatch(
      new RegExp(`^${occupiedId}-[a-f0-9]{10}$`),
    );
  });

  test("keeps an explicitly cited live wait holder across ledger-only revision changes", async () => {
    const ws = await workspace({
      ...item("blocked", "wait-networking"),
      frontierTaskIds: ["wait-networking"],
      waitingFor: {
        type: "project.approval.submitted",
        taskId: "wait-networking",
        conditionId: "approval-return:networking",
      },
      waitingCondition: "Wait for the exact networking approval return.",
      resumeCondition: "Resume when the networking approval returns.",
      updatedAt: "2026-07-27T00:00:00Z",
    });
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "wait-networking": {
            id: "wait-networking",
            phase: "waiting",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision: "older-ledger-revision",
            },
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

  test("treats reviewed terminal residue without a live holder as already covered", async () => {
    const ws = await workspace({
      ...item("blocked"),
      errorClass: "reviewed-exception",
      frontierTaskIds: [],
      nextStepClassification: "reviewed-terminal-pipeline-only-residue",
      resumeCondition:
        "Resume when stronger same-surface evidence materially changes the sole compact frontier.",
      reviewEvidencePath:
        "evidence/archive/reconcile-compact-feature-networking-reviewed-terminal-frontier.md",
      summary:
        "Reconciled networking to reviewed terminal residue with no exact machine-observable wait.",
      updatedAt: "2026-07-27T18:35:00Z",
    });

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [],
        summary: expect.stringContaining(
          "live proof or an accepted reviewed terminal disposition",
        ),
      },
    });
  });

  test("does not let an exact wait consume compact actionable capacity", async () => {
    const ws = await workspace(item("pending", "wait-networking"));
    const initial = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const networkingRevision = initial.output.actions[0].input.workRevision;
    const features: Record<string, Record<string, unknown>> = {
      networking: item("pending", "wait-networking"),
    };
    for (const featureKey of ["compute", "dns", "storage"]) {
      await mkdir(join(ws.projectDir, "features", featureKey, "specs"), {
        recursive: true,
      });
      await writeFile(
        join(ws.projectDir, "features", featureKey, "specs", "case.json"),
        JSON.stringify({ id: `spec.${featureKey}.case` }),
      );
      features[featureKey] = {
        ...item("pending"),
        featureKey,
        capabilityId: featureKey,
        packetPath: `features/${featureKey}.yaml`,
        specsDir: `features/${featureKey}/specs`,
      };
    }
    await writeFile(
      join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
      JSON.stringify({
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 3,
        cursor: 0,
        features,
      }),
    );
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "wait-networking": {
            id: "wait-networking",
            phase: "waiting",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision: networkingRevision,
            },
          },
        },
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(3);
    expect(result.output.summary).toContain("1 waiting");
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
    const ws = await workspace(item("running", "existing-compact-task"));
    const initial = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const workRevision = initial.output.actions[0].input.workRevision;
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "existing-compact-task": {
            id: "existing-compact-task",
            phase: "running",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision,
            },
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [],
      },
    });
  });

  test("does not let old-shape compact task input hide current work", async () => {
    const ws = await workspace(item("pending"));
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "legacy-compact-networking": {
            id: "legacy-compact-networking",
            phase: "running",
            input: {
              loopTaskId: "aks-feature-compact-loop",
              featureKey: "networking",
            },
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            id: expect.stringMatching(
              /^compact\/compact-feature-networking-[a-f0-9]{10}$/,
            ),
            input: {
              featureKey: "networking",
              workRevision: expect.any(String),
            },
          },
        ],
      },
    });
  });

  test("replaces terminal current-revision history with fresh bounded refill up to capacity", async () => {
    const revisionSeed = await workspace(item("pending"));
    const initial = (await execute(
      context(revisionSeed.appDir, revisionSeed.projectDir),
    )) as any;
    const workRevision = initial.output.actions[0].input.workRevision;
    const terminalTaskId = `compact/compact-feature-compute-${workRevision}`;
    const ws = await workspace(item("pending", "live-networking"));
    await mkdir(join(ws.projectDir, "features", "compute", "specs"), {
      recursive: true,
    });
    await mkdir(join(ws.projectDir, "features", "storage", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(ws.projectDir, "features", "compute", "specs", "case.json"),
      JSON.stringify({ id: "spec.compute.case" }),
    );
    await writeFile(
      join(ws.projectDir, "features", "storage", "specs", "case.json"),
      JSON.stringify({ id: "spec.storage.case" }),
    );
    await writeFile(
      join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
      JSON.stringify({
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 3,
        cursor: 0,
        features: {
          networking: item("pending", "live-networking"),
          compute: {
            ...item("pending"),
            featureKey: "compute",
            capabilityId: "compute",
            packetPath: "features/compute.yaml",
            specsDir: "features/compute/specs",
          },
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
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "live-networking": {
            id: "live-networking",
            phase: "running",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision,
            },
          },
          [terminalTaskId]: {
            id: terminalTaskId,
            phase: "converged",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "compute",
              workRevision,
            },
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output.summary).toContain("declared 2 bounded task action(s)");
    expect(result.output.summary).toContain("observed 1 actionable");
    expect(result.output.summary).toContain("1 stale terminal representation");
    expect(result.output.actions).toHaveLength(2);

    const computeAction = result.output.actions.find(
      (action: any) => action.input.featureKey === "compute",
    );
    const storageAction = result.output.actions.find(
      (action: any) => action.input.featureKey === "storage",
    );

    expect(computeAction.input.workRevision).toBe(workRevision);
    expect(computeAction.id).not.toBe(terminalTaskId);
    expect(computeAction.id).toMatch(
      new RegExp(`^${terminalTaskId}-[a-f0-9]{10}$`),
    );
    expect(storageAction.id).toMatch(
      /^compact\/compact-feature-storage-[a-f0-9]{10}$/,
    );
  });

  test("surfaces an attention-only compact frontier to the owner", async () => {
    const ws = await workspace(item("running", "existing-compact-task"));
    const initial = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const workRevision = initial.output.actions[0].input.workRevision;
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "existing-compact-task": {
            id: "existing-compact-task",
            phase: "attention",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision,
            },
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: { state: "needs-owner" },
    });
    expect(result.output).not.toHaveProperty("actions");
  });
});
