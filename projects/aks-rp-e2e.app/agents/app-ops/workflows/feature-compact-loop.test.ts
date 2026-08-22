import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { execute } from "./feature-compact-loop-controller";
import { verify as verifyFeatureCompactConvergence } from "../../owner/workflows/feature-compact-reconciliation";
import { defaultFeatureCompactLoopStatePath } from "./lib/feature-compact-loop-store";

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
  const read = (name: string) => {
    try {
      return JSON.parse(
        readFileSync(join(appDir, ".state", "tasks", name), "utf8"),
      ) as Record<string, any>;
    } catch {
      return {};
    }
  };
  const tree = read("tree.json");
  const state = read("state.json");
  const tasks = { ...(tree.tasks ?? {}), ...(state.tasks ?? {}) };
  const resources = state.resources ?? {};
  const liveById = new Map<string, any>();
  for (const [taskId, task] of Object.entries(tasks) as Array<
    [string, Record<string, any>]
  >) {
    const resource = resources[taskId] ?? {};
    const spec = resource.spec ?? task;
    const status = resource.status ?? task;
    const phase = String(status.phase ?? status.state ?? "pending");
    if (["done", "closed", "converged"].includes(phase)) continue;
    liveById.set(taskId, {
      taskId,
      parentId: String(task.parent_id ?? "aks-feature-compact-loop"),
      generation: Number(resource.metadata?.generation ?? task.generation ?? 1),
      status: phase,
      outcome: String(spec.outcome ?? task.goal ?? "fixture task"),
      input: spec.input ?? task.input ?? {},
      conditions: [],
      hasLiveChildren: (task.children ?? []).some((childId: string) => {
        const child = resources[childId]?.status ?? tasks[childId] ?? {};
        return !["done", "closed", "converged"].includes(
          String(child.phase ?? child.state ?? "pending"),
        );
      }),
      evidence: status.evidence ?? [],
      summary: status.summary,
    });
  }
  for (const [taskId, resource] of Object.entries(resources) as Array<
    [string, Record<string, any>]
  >) {
    if (liveById.has(taskId)) continue;
    const phase = String(resource.status?.phase ?? "pending");
    if (["done", "closed", "converged"].includes(phase)) continue;
    liveById.set(taskId, {
      taskId,
      parentId: String(resource.spec?.parentId ?? "aks-feature-compact-loop"),
      generation: Number(resource.metadata?.generation ?? 1),
      status: phase,
      outcome: String(resource.spec?.outcome ?? "fixture task"),
      input: resource.spec?.input ?? {},
      conditions: (resource.status?.conditionIds ?? []).flatMap(
        (conditionId: string) => {
          const condition = state.conditions?.[conditionId];
          return condition
            ? [{ id: conditionId, ...(condition.spec ?? condition) }]
            : [];
        },
      ),
      hasLiveChildren: false,
      evidence: resource.status?.evidence ?? [],
      summary: resource.status?.summary,
      updatedAt: resource.status?.updatedAt,
    });
  }
  const completed = Object.entries(state.receipts ?? {}).map(
    ([taskId, receipt]: [string, any]) => ({
      taskId,
      parentId: String(receipt.parentId ?? "aks-feature-compact-loop"),
      generation: Number(receipt.metadata?.generation ?? 1),
      status: "done",
      outcome: String(receipt.outcome ?? receipt.summary ?? "fixture receipt"),
      input: receipt.input ?? {},
      conditions: [],
      hasLiveChildren: false,
      evidence: receipt.evidence ?? [],
      summary: receipt.summary,
      completedAt: receipt.completedAt ?? "2026-01-01T00:00:00Z",
    }),
  );
  return {
    input: {},
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "aks-feature-compact-loop",
      generation: 1,
      resourceVersion: 1,
      owner: "app-ops",
      mode: "maintain",
      outcome: "Maintain feature compaction",
      acceptance: [],
      input: {},
      children: { live: [...liveById.values()], completed },
      events: {
        items: [
          {
            observedAt: "2026-08-21T00:00:00.000Z",
            event: {
              type: "project.task.tick",
              data: {
                action: "feature-compact-loop",
                taskId: "aks-feature-compact-loop",
              },
            },
          },
        ],
        truncated: false,
      },
    },
    workspace: {
      appRoot: appDir,
      projectRoot: projectDir,
      root: projectDir,
      output: projectDir,
    },
    done: (message: string, output?: unknown) => ({
      status: "done",
      message,
      output,
    }),
  } as any;
}

function git(
  cwd: string,
  args: string[],
  options: { stdio?: "pipe" | "ignore" } = {},
): string {
  const output = execFileSync("git", args, {
    cwd,
    stdio: ["ignore", options.stdio ?? "pipe", "pipe"],
    encoding: "utf8",
  });
  return typeof output === "string" ? output.trim() : "";
}

function initializeOriginDevFixture(projectDir: string): void {
  git(projectDir, ["init"]);
  git(projectDir, ["config", "user.name", "Test User"]);
  git(projectDir, ["config", "user.email", "test@example.com"]);
  git(projectDir, ["add", "."]);
  git(projectDir, ["commit", "-m", "initial fixture"], { stdio: "ignore" });
  const head = git(projectDir, ["rev-parse", "HEAD"]);
  git(projectDir, ["update-ref", "refs/remotes/origin/dev", head]);
}

describe("feature compact reconciliation workflow", () => {
  test("converges when every package has live proof", async () => {
    const ws = await workspace(item("done"));
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });
  });

  test("rejects owner convergence when the sole holder disappears but the feature row remains stale and nonterminal", async () => {
    const ws = await workspace({
      ...item("pending"),
      taskId: null,
      frontierTaskIds: null,
      inputFingerprint: "feature-input-v1:stale",
    });
    initializeOriginDevFixture(ws.projectDir);

    const verification = await verifyFeatureCompactConvergence(
      {
        appId: "aks-rp-e2e",
        taskId: "compact/compact-feature-networking-observed-shape",
        generation: 1,
        appDir: ws.appDir,
        projectDir: ws.projectDir,
        workspaceDir: ws.projectDir,
        intent: {
          id: "compact/compact-feature-networking-observed-shape",
          parentId: "aks-feature-compact-loop",
          outcome: "Reconcile networking compact proof.",
          acceptance: ["The compact loop state is updated before convergence."],
          mode: "achieve",
          owner: "aks-explorer",
          workflow: "feature-compact-reconciliation",
          input: {
            featureKey: "networking",
            statePath: defaultFeatureCompactLoopStatePath(ws.appDir),
          },
        },
      },
      {
        state: "converged",
        summary: "Owner accepted proof but omitted ledger projection.",
        evidence: ["pipeline-run:test-proof"],
        actions: [],
      },
    );

    expect(verification).toMatchObject({
      accepted: false,
      summary: expect.stringContaining("status=pending"),
    });
  });

  test("admits owner convergence when the current terminal row retains durable proof and no holder residue", async () => {
    const ws = await workspace(item("done"));
    initializeOriginDevFixture(ws.projectDir);
    await execute(context(ws.appDir, ws.projectDir));

    const verification = await verifyFeatureCompactConvergence(
      {
        appId: "aks-rp-e2e",
        taskId: "compact/compact-feature-networking-current-proof",
        generation: 1,
        appDir: ws.appDir,
        projectDir: ws.projectDir,
        workspaceDir: ws.projectDir,
        intent: {
          id: "compact/compact-feature-networking-current-proof",
          parentId: "aks-feature-compact-loop",
          outcome: "Reconcile networking compact proof.",
          acceptance: ["The compact loop state is updated before convergence."],
          mode: "achieve",
          owner: "aks-explorer",
          workflow: "feature-compact-reconciliation",
          input: {
            featureKey: "networking",
            statePath: defaultFeatureCompactLoopStatePath(ws.appDir),
          },
        },
      },
      {
        state: "converged",
        summary: "Current durable proof is projected.",
        evidence: ["pipeline-run:test-proof"],
        actions: [],
      },
    );

    expect(verification).toMatchObject({
      accepted: true,
      summary: expect.stringContaining("current, terminal"),
    });
  });

  test("admits owner convergence when a relative durable result exists only under app state", async () => {
    const current = item("done");
    const ws = await workspace(current, false, {
      materializeResultPath: false,
    });
    initializeOriginDevFixture(ws.projectDir);
    const appResultPath = join(ws.appDir, current.lastResultPath as string);
    await mkdir(dirname(appResultPath), { recursive: true });
    await writeFile(
      appResultPath,
      JSON.stringify({ status: "passed", runId: "app-state-proof" }),
    );
    await execute(context(ws.appDir, ws.projectDir));

    const verification = await verifyFeatureCompactConvergence(
      {
        appId: "aks-rp-e2e",
        taskId: "compact/compact-feature-networking-app-state-proof",
        generation: 1,
        appDir: ws.appDir,
        projectDir: ws.projectDir,
        workspaceDir: ws.projectDir,
        intent: {
          id: "compact/compact-feature-networking-app-state-proof",
          parentId: "aks-feature-compact-loop",
          outcome: "Reconcile networking compact proof.",
          acceptance: ["The compact loop state is updated before convergence."],
          mode: "achieve",
          owner: "aks-explorer",
          workflow: "feature-compact-reconciliation",
          input: {
            featureKey: "networking",
            statePath: defaultFeatureCompactLoopStatePath(ws.appDir),
          },
        },
      },
      {
        state: "converged",
        summary: "Current app-owned durable proof is projected.",
        evidence: ["pipeline-run:app-state-proof"],
        actions: [],
      },
    );

    expect(verification).toMatchObject({
      accepted: true,
      summary: expect.stringContaining("current, terminal"),
      evidence: expect.arrayContaining([
        `feature-compact-result:${appResultPath}`,
      ]),
    });
  });

  test("records a current input fingerprint without reopening unchanged done rows", async () => {
    const ws = await workspace(item("done"));

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const state = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(state.features.networking.inputFingerprint).toEqual(
      expect.any(String),
    );

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });
  });

  test("baselines an unversioned fingerprint without reopening settled work", async () => {
    const ws = await workspace({
      ...item("done"),
      inputFingerprint: "legacy-unversioned-fingerprint",
    });
    initializeOriginDevFixture(ws.projectDir);

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const state = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(state.features.networking.status).toBe("done");
    expect(state.features.networking.inputFingerprint).toMatch(
      /^feature-input-v1:/,
    );
  });

  test("uses committed origin/dev feature truth instead of dirty local residue", async () => {
    const ws = await workspace(item("done"));
    initializeOriginDevFixture(ws.projectDir);

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const initialState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    const committedFingerprint =
      initialState.features.networking.inputFingerprint;

    await mkdir(join(ws.projectDir, "features", "networking", "tests"), {
      recursive: true,
    });
    await writeFile(
      join(
        ws.projectDir,
        "features",
        "networking",
        "tests",
        "local-only.test.ts",
      ),
      "console.log('dirty local residue');\n",
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const afterDirtyState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(afterDirtyState.features.networking.inputFingerprint).toBe(
      committedFingerprint,
    );
  });

  test("does not reopen a done row when only compact live-proof writeback files change", async () => {
    const ws = await workspace(item("done"));
    initializeOriginDevFixture(ws.projectDir);

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const baselineState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    const baselineFingerprint =
      baselineState.features.networking.inputFingerprint;

    await mkdir(join(ws.projectDir, "features", "networking", "compact"), {
      recursive: true,
    });
    await writeFile(
      join(
        ws.projectDir,
        "features",
        "networking",
        "compact",
        "staging.summary.md",
      ),
      "# Live Proof writeback\n",
    );
    await writeFile(
      join(
        ws.projectDir,
        "features",
        "networking",
        "compact",
        "staging.diagnostics.json",
      ),
      JSON.stringify({ reviewed: true }),
    );
    git(ws.projectDir, ["add", "."]);
    git(ws.projectDir, ["commit", "-m", "write back live proof"], {
      stdio: "ignore",
    });
    const writebackHead = git(ws.projectDir, ["rev-parse", "HEAD"]);
    git(ws.projectDir, [
      "update-ref",
      "refs/remotes/origin/dev",
      writebackHead,
    ]);

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const afterWritebackState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(afterWritebackState.features.networking.inputFingerprint).toBe(
      baselineFingerprint,
    );
  });

  test("reopens a settled done row when committed origin/dev feature truth changes", async () => {
    const ws = await workspace(item("done"));
    initializeOriginDevFixture(ws.projectDir);

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const baselineState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    const baselineFingerprint =
      baselineState.features.networking.inputFingerprint;

    await mkdir(join(ws.projectDir, "features", "networking", "tests"), {
      recursive: true,
    });
    await writeFile(
      join(ws.projectDir, "features", "networking", "tests", "case.test.ts"),
      "export const changed = true;\n",
    );
    git(ws.projectDir, ["add", "."]);
    git(ws.projectDir, ["commit", "-m", "change committed feature truth"], {
      stdio: "ignore",
    });
    const head = git(ws.projectDir, ["rev-parse", "HEAD"]);
    git(ws.projectDir, ["update-ref", "refs/remotes/origin/dev", head]);

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            input: {
              featureKey: "networking",
            },
          },
        ],
      },
    });
    expect(result.output.actions[0].input.workRevision).toEqual(
      expect.any(String),
    );

    const reopenedState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(reopenedState.features.networking.status).toBe("pending");
    expect(reopenedState.features.networking.inputFingerprint).toEqual(
      expect.any(String),
    );
    expect(reopenedState.features.networking.inputFingerprint).not.toBe(
      baselineFingerprint,
    );
  });

  test("reopens a settled blocked exact-wait row and clears stale wait fields when committed feature truth changes", async () => {
    const ws = await workspace({
      ...item("blocked", "stale-holder"),
      frontierTaskIds: ["stale-holder"],
      retryable: false,
      nextStepClassification: "package-partial-exact-wait",
      resumeCondition:
        "Resume when origin/dev advances or same-surface evidence changes.",
      waitingFor: {
        taskId: "stale-holder",
        conditionId: "wait:stale-holder",
      },
      waitingCondition: "stale wait",
      observedBy: { workflow: "owner:aks-explorer" },
      observationMethod: "exact wait",
      summary: "Blocked on exact wait",
    });
    initializeOriginDevFixture(ws.projectDir);
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "stale-holder": {
            id: "stale-holder",
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

    const baselineState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    const baselineFingerprint =
      baselineState.features.networking.inputFingerprint;

    await mkdir(join(ws.projectDir, "features", "networking", "tests"), {
      recursive: true,
    });
    await writeFile(
      join(ws.projectDir, "features", "networking", "tests", "case.test.ts"),
      "export const changed = true;\n",
    );
    git(ws.projectDir, ["add", "."]);
    git(ws.projectDir, ["commit", "-m", "change blocked feature truth"], {
      stdio: "ignore",
    });
    const head = git(ws.projectDir, ["rev-parse", "HEAD"]);
    git(ws.projectDir, ["update-ref", "refs/remotes/origin/dev", head]);

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            input: { featureKey: "networking" },
          },
        ],
      },
    });

    const updatedState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(updatedState.features.networking.status).toBe("pending");
    expect(updatedState.features.networking.inputFingerprint).toEqual(
      expect.any(String),
    );
    expect(updatedState.features.networking.inputFingerprint).not.toBe(
      baselineFingerprint,
    );
    expect(updatedState.features.networking.taskId).toBeNull();
    expect(updatedState.features.networking.frontierTaskIds).toBeNull();
    expect(updatedState.features.networking.nextStepClassification).toBeNull();
    expect(updatedState.features.networking.resumeCondition).toBeNull();
    expect(updatedState.features.networking.waitingFor).toBeNull();
    expect(updatedState.features.networking.waitingCondition).toBeNull();
    expect(updatedState.features.networking.observedBy).toBeNull();
    expect(updatedState.features.networking.observationMethod).toBeNull();
  });

  test("rebinds a reopened blocked compact frontier row to its live hold-compact carrier", async () => {
    const holderTaskId =
      "hold-compact-networking-split-frontier-older-revision";
    const ws = await workspace({
      ...item("blocked", holderTaskId),
      frontierTaskIds: [holderTaskId],
      retryable: false,
      nextStepClassification: "repo-local-spec-metadata-split-frontier",
      resumeCondition:
        "Resume when the exact holder changes or same-surface evidence materially changes.",
      waitingFor: {
        taskId: holderTaskId,
        conditionId:
          "project:feature-compact-loop:networking:lastCheckedAt-changed",
      },
      waitingCondition:
        "project:feature-compact-loop:networking:lastCheckedAt-changed",
      summary:
        "Current networking compact frontier is still represented by the existing holder.",
    });
    initializeOriginDevFixture(ws.projectDir);
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          [holderTaskId]: {
            id: holderTaskId,
            phase: "waiting",
            parent_id:
              "compact/repair-compact-feature-networking-representation-older-revision",
            input: {
              featureKey: "networking",
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

    const baselineState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    const baselineFingerprint =
      baselineState.features.networking.inputFingerprint;

    await mkdir(join(ws.projectDir, "features", "networking", "tests"), {
      recursive: true,
    });
    await writeFile(
      join(ws.projectDir, "features", "networking", "tests", "case.test.ts"),
      "export const changed = true;\n",
    );
    git(ws.projectDir, ["add", "."]);
    git(
      ws.projectDir,
      ["commit", "-m", "change represented blocked feature truth"],
      {
        stdio: "ignore",
      },
    );
    const head = git(ws.projectDir, ["rev-parse", "HEAD"]);
    git(ws.projectDir, ["update-ref", "refs/remotes/origin/dev", head]);

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const reboundState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(reboundState.features.networking.status).toBe("blocked");
    expect(reboundState.features.networking.inputFingerprint).toEqual(
      expect.any(String),
    );
    expect(reboundState.features.networking.inputFingerprint).not.toBe(
      baselineFingerprint,
    );
    expect(reboundState.features.networking.taskId).toBe(holderTaskId);
    expect(reboundState.features.networking.frontierTaskIds).toEqual([
      holderTaskId,
    ]);
    expect(reboundState.features.networking.waitingFor).toEqual({
      taskId: holderTaskId,
      conditionId:
        "project:feature-compact-loop:networking:lastCheckedAt-changed",
    });
  });

  test("rebinds a reopened blocked compact frontier row to its live compact child wait", async () => {
    const holderTaskId =
      "domain/wait-networking-origin-dev-advance-older-revision";
    const ws = await workspace({
      ...item("blocked", holderTaskId),
      frontierTaskIds: [holderTaskId],
      retryable: false,
      resumeCondition:
        "Resume when origin/dev advances beyond the represented frontier baseline.",
      waitingFor: {
        taskId: holderTaskId,
        conditionId: "aks.repo-ref.observed:origin/dev:next",
      },
      waitingCondition: "aks.repo-ref.observed:origin/dev:next",
      summary:
        "Current networking compact frontier is still represented by the exact repo-ref wait.",
    });
    initializeOriginDevFixture(ws.projectDir);
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          [holderTaskId]: {
            id: holderTaskId,
            phase: "waiting",
            parent_id: "compact/compact-feature-networking",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: "deadbeef",
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

    await mkdir(join(ws.projectDir, "features", "networking", "tests"), {
      recursive: true,
    });
    await writeFile(
      join(
        ws.projectDir,
        "features",
        "networking",
        "tests",
        "domain-wait-change.test.ts",
      ),
      "export const changed = true;\n",
    );
    git(ws.projectDir, ["add", "."]);
    git(
      ws.projectDir,
      ["commit", "-m", "change compact child wait feature truth"],
      {
        stdio: "ignore",
      },
    );
    const head = git(ws.projectDir, ["rev-parse", "HEAD"]);
    git(ws.projectDir, ["update-ref", "refs/remotes/origin/dev", head]);

    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });

    const reboundState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(reboundState.features.networking.status).toBe("blocked");
    expect(reboundState.features.networking.taskId).toBe(holderTaskId);
    expect(reboundState.features.networking.frontierTaskIds).toEqual([
      holderTaskId,
    ]);
    expect(reboundState.features.networking.waitingFor).toEqual({
      taskId: holderTaskId,
      conditionId: "aks.repo-ref.observed:origin/dev:next",
    });
  });

  test("rebinds a pending null row to its live compact holder from current tree evidence", async () => {
    const holderTaskId =
      "hold-compact-networking-split-frontier-current-authority";
    const ws = await workspace({
      ...item("pending"),
      inputFingerprint: "feature-input-v1:current-authority",
      retryReason:
        "Resume because current feature source inputs changed after reviewed fingerprint prior-author.",
      ownerReason:
        "Current feature source fingerprint current-auth materially changed after reviewed fingerprint prior-author.",
      summary:
        "Reopened because current feature source inputs materially changed after the previously reviewed compact fingerprint.",
    });
    initializeOriginDevFixture(ws.projectDir);
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          [holderTaskId]: {
            id: holderTaskId,
            phase: "waiting",
            parent_id:
              "compact/repair-compact-feature-networking-representation-current-authority",
            input: {
              featureKey: "networking",
              workRevision: "current-authority",
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

    const reboundState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(reboundState.features.networking.status).toBe("blocked");
    expect(reboundState.features.networking.taskId).toBe(holderTaskId);
    expect(reboundState.features.networking.frontierTaskIds).toEqual([
      holderTaskId,
    ]);
    expect(reboundState.features.networking.summary).toBe(
      "Reopened because current feature source inputs materially changed after the previously reviewed compact fingerprint.",
    );
  });

  test("rebinds a pending null row to a hold carrier that advertises the feature only in task input", async () => {
    const holderTaskId = "hold-compact-net-split-frontier-current-authority";
    const ws = await workspace({
      ...item("pending"),
      inputFingerprint: "feature-input-v1:current-authority",
      retryReason:
        "Resume because current feature source inputs changed after reviewed fingerprint prior-author.",
      ownerReason:
        "Current feature source fingerprint current-auth materially changed after reviewed fingerprint prior-author.",
      summary:
        "Reopened because current feature source inputs materially changed after the previously reviewed compact fingerprint.",
    });
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "compact/compact-feature-networking-current-authority": {
            id: "compact/compact-feature-networking-current-authority",
            phase: "waiting",
            parent_id: "group/feature-compact",
            input: {
              featureKey: "networking",
              workRevision: "current-authority",
            },
          },
          [holderTaskId]: {
            id: holderTaskId,
            phase: "waiting",
            parent_id: "compact/compact-feature-networking-current-authority",
            input: {
              featureKey: "networking",
              workRevision: "current-authority",
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

    const reboundState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(reboundState.features.networking.status).toBe("blocked");
    expect(reboundState.features.networking.taskId).toBe(holderTaskId);
    expect(reboundState.features.networking.frontierTaskIds).toEqual([
      holderTaskId,
    ]);
  });

  test("rebinds a pending null row to a wait carrier when that is the only live holder", async () => {
    const holderTaskId =
      "wait-compact-networking-isolated-owner-decision-return-current";
    const ws = await workspace({
      ...item("pending"),
      inputFingerprint: "feature-input-v1:current-authority",
      retryReason:
        "Resume because current feature source inputs changed after reviewed fingerprint prior-author.",
      ownerReason:
        "Current feature source fingerprint current-auth materially changed after reviewed fingerprint prior-author.",
      summary:
        "Reopened because current feature source inputs materially changed after the previously reviewed compact fingerprint.",
    });
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          [holderTaskId]: {
            id: holderTaskId,
            phase: "waiting",
            parent_id: "group/feature-compact",
            input: {
              approvalId: "approval-123",
            },
          },
          "compact/compact-feature-networking-current-authority": {
            id: "compact/compact-feature-networking-current-authority",
            phase: "waiting",
            parent_id: "group/feature-compact",
            input: {
              featureKey: "networking",
              workRevision: "current-authority",
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

    const reboundState = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf-8",
      ),
    );
    expect(reboundState.features.networking.status).toBe("blocked");
    expect(reboundState.features.networking.taskId).toBe(holderTaskId);
    expect(reboundState.features.networking.frontierTaskIds).toEqual([
      holderTaskId,
    ]);
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
      "marked not-a-current-direct-child-or-receipt in representationReview as stale history",
    );
    expect(acceptance).toContain("exact branch/worktree in place");
    expect(acceptance).toContain("shared canonical dev checkout");
    expect(acceptance).toContain(
      "rebind the same task to spec-live-reconciliation",
    );
    expect(acceptance).toContain("complete feature specIds");
    expect(acceptance).toContain("prepared sourceBranch/sourceCommit");
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
        lastResultPath: join(
          tmpdir(),
          "compact-loop-missing-proof",
          "result.json",
        ),
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
            workflow: "feature-compact-reconciliation",
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
    expect(acceptance).toContain("input includes representationReview");
    expect(acceptance).toContain("Do not query task-state files");
    expect(acceptance).toContain("reuse known-good carriers");
    expect(acceptance).toContain("Every feature-owned spec");
    expect(acceptance).toContain("shared/read-only");
    expect(acceptance).toContain("exact branch/worktree in place");
    expect(acceptance).toContain("shared canonical dev checkout");
    expect(acceptance).toContain(
      "Rebind the same task to spec-live-reconciliation",
    );
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
      "current task input and direct-child reconciliation facts carry task authority",
    );
  });

  test("preserves current feature state from serialized structured task input without refilling while the master campaign is active", async () => {
    const ws = await workspace(item("pending"));
    const ctx = context(ws.appDir, ws.projectDir);
    ctx.reconciliation.generation = 17;
    ctx.reconciliation.input = { frontierLimit: 3, refillEnabled: false };

    const result = (await execute(ctx)) as any;

    expect(result).toMatchObject({
      output: {
        state: "needs-owner",
      },
    });
    expect(result.output.actions ?? []).toHaveLength(0);
    expect(result.output.summary).toContain(
      "refill paused for the selector-first master-validation campaign",
    );
    expect(result.output.summary).toContain(
      "declared 0 bounded task action(s)",
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
    expect(acceptance).toContain("input.representationReview");
    expect(acceptance).toContain("do not query task persistence");
    expect(acceptance).toContain("exact branch/worktree in place");
    expect(acceptance).toContain("shared canonical dev checkout");
    expect(acceptance).toContain(
      "rebind the same task to spec-live-reconciliation",
    );
    expect(acceptance).toContain("complete feature specIds");
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

  test("keeps a revisioned running parent as the in-flight feature transition", async () => {
    const ws = await workspace(item("pending"));
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "running-prior-revision": {
            id: "running-prior-revision",
            phase: "running",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision: "prior-source-revision",
            },
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain("observed 1 actionable");
  });

  test("keeps a prior-revision parent while its direct child is live", async () => {
    const ws = await workspace(item("pending"));
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "waiting-prior-revision": {
            id: "waiting-prior-revision",
            phase: "waiting",
            children: ["live-repair-child"],
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision: "prior-source-revision",
            },
          },
          "live-repair-child": {
            id: "live-repair-child",
            parent_id: "waiting-prior-revision",
            phase: "running",
            input: {},
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain("1 waiting");
  });

  test("does not let a waiting prior revision with only terminal children hide current work", async () => {
    const ws = await workspace(item("pending"));
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "waiting-prior-revision": {
            id: "waiting-prior-revision",
            phase: "waiting",
            children: ["completed-repair-child"],
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "networking",
              workRevision: "prior-source-revision",
            },
          },
          "completed-repair-child": {
            id: "completed-repair-child",
            parent_id: "waiting-prior-revision",
            phase: "done",
            input: {},
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
          },
        ],
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

    const seed = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const networkingRevision = seed.output.actions.find(
      (action: any) => action.input.featureKey === "networking",
    ).input.workRevision;
    const computeRevision = seed.output.actions.find(
      (action: any) => action.input.featureKey === "compute",
    ).input.workRevision;
    const terminalTaskId = `compact/compact-feature-compute-${computeRevision}`;

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
              workRevision: networkingRevision,
            },
          },
        },
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );
    await writeFile(
      join(ws.appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        receipts: {
          [terminalTaskId]: {
            metadata: { id: terminalTaskId, generation: 1 },
            parentId: "aks-feature-compact-loop",
            outcome: "Compact compute",
            input: {
              loopId: "aks-feature-compact-loop",
              workKey: "compute",
              workRevision: computeRevision,
            },
            evidence: [],
            summary: "Terminal current-revision history",
            completedAt: "2026-07-20T00:00:00Z",
          },
        },
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output.summary).toContain(
      "declared 2 bounded task action(s)",
    );
    expect(result.output.summary).toContain("observed 1 actionable");
    expect(result.output.summary).toContain("1 stale terminal representation");
    expect(result.output.actions).toHaveLength(2);

    const computeAction = result.output.actions.find(
      (action: any) => action.input.featureKey === "compute",
    );
    const storageAction = result.output.actions.find(
      (action: any) => action.input.featureKey === "storage",
    );

    expect(computeAction.input.workRevision).toBe(computeRevision);
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

  test("reopens a blocked row whose every declared holder left the live tree", async () => {
    const ws = await workspace({
      ...item("blocked", "hold-compact-networking-retired"),
      frontierTaskIds: ["hold-compact-networking-retired"],
      waitingCondition: "Wait for the exact networking approval return.",
      resumeCondition: "Resume when the networking approval returns.",
      blockedReason: "Reviewed terminal split preserved.",
    });
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {},
        conditions: {},
        satisfied_dependency_ids: [],
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions.length).toBeGreaterThan(0);
    const state = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.networking.status).not.toBe("blocked");
    expect(state.features.networking.frontierTaskIds).toBeNull();
    expect(state.features.networking.waitingCondition).toBeNull();
  });

  test("leaves a blocked row alone while any declared holder is still live", async () => {
    const ws = await workspace({
      ...item("blocked", "hold-compact-networking-retired"),
      frontierTaskIds: [
        "hold-compact-networking-retired",
        "hold-compact-networking-live",
      ],
      resumeCondition: "Resume when the networking approval returns.",
    });
    await writeFile(
      join(ws.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({
        schema_version: 2,
        tasks: {
          "hold-compact-networking-live": {
            id: "hold-compact-networking-live",
            phase: "waiting",
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

    await execute(context(ws.appDir, ws.projectDir));

    const state = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.networking.status).toBe("blocked");
    expect(state.features.networking.frontierTaskIds).toContain(
      "hold-compact-networking-live",
    );
  });
});
