import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  assignTask,
  peekTaskAssignments,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "./lib/task-tree-tools.ts";
import {
  execute as executeController,
  harvestTerminalCompactGitHubWaits,
} from "./feature-compact-loop-controller.ts";
import { execute as executePlanner } from "./feature-compact-planner.ts";
import {
  loadFeatureCompactLoopState,
  loadFeatureCompactRecords,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "./lib/feature-compact-loop-store.ts";
import { reconcileFeatureCompactRuntimeProjection } from "./lib/feature-compact-runtime-projection.ts";
import {
  setPipelineBackendForTests,
  type CommandResult,
  type PipelineRun,
} from "./lib/ado-pipelines.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-feature-compact-loop-"));
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "features", "windows", "specs"), {
    recursive: true,
  });
  await mkdir(join(dir, "runner"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  await writeFile(
    join(dir, "features", "windows.yaml"),
    "capabilityId: windows\nstatus: draft\n",
    "utf8",
  );
  await writeFile(
    join(dir, "features", "windows", "specs", "node-pool.json"),
    JSON.stringify({ id: "spec.windows.node-pool-create" }),
    "utf8",
  );
  return dir;
}

async function writeFakeCompactRunner(
  projectDir: string,
  options: {
    packageStatus?: string;
    livePolicyOk?: boolean;
    liveAdmissionOk?: boolean;
    diagnosticsOverride?: Record<string, unknown>;
  } = {},
) {
  const packageStatus = options.packageStatus ?? "ready";
  const livePolicyOk = options.livePolicyOk ?? true;
  const liveAdmissionOk = options.liveAdmissionOk ?? true;
  const diagnosticsOverride = options.diagnosticsOverride ?? {};
  await writeFile(
    join(projectDir, "package.json"),
    JSON.stringify(
      {
        type: "module",
        scripts: {
          execute: "bun runner/fake-execute.ts",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(projectDir, "runner", "feature-compact.ts"),
    `#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const capability = process.argv[2];
let target = "staging";
for (let i = 3; i < process.argv.length; i++) {
  if (process.argv[i] === "--target" && process.argv[i + 1]) target = process.argv[++i];
}
const base = \`features/\${capability}/compact/\${target}\`;
const planPath = \`\${base}.plan.json\`;
const summaryPath = \`\${base}.summary.md\`;
const diagnosticsPath = \`\${base}.diagnostics.json\`;
mkdirSync(dirname(planPath), { recursive: true });
writeFileSync(planPath, JSON.stringify({
  id: \`feature-compact-\${capability}-\${target}\`,
  kind: "feature-compact-plan",
  selectedSpecIds: ["spec.windows.node-pool-create"]
}, null, 2));
writeFileSync(summaryPath, \`# \${capability} compact\\n\`);
writeFileSync(diagnosticsPath, JSON.stringify({
  packageStatus: ${JSON.stringify(packageStatus)},
  planPath,
  summaryPath,
  selectedSpecIds: ["spec.windows.node-pool-create"],
  metrics: { specsSelected: 1, clustersNeeded: 1, baselineClusterCount: 1, clustersSaved: 0 },
  ...${JSON.stringify(diagnosticsOverride, null, 2)}
}, null, 2));
console.log(\`[feature-compact] feature=\${capability}\`);
console.log(\`[feature-compact] plan=\${planPath}\`);
console.log(\`[feature-compact] summary=\${summaryPath}\`);
console.log(\`[feature-compact] diagnostics=\${diagnosticsPath}\`);
`,
    "utf8",
  );
  await writeFile(
    join(projectDir, "runner", "fake-execute.ts"),
    `#!/usr/bin/env bun
console.log("[test-executor] test-result=runs/test-results/feature-compact-windows-staging_000001");
`,
    "utf8",
  );
  await writeFile(
    join(projectDir, "runner", "check-private-source-policy.ts"),
    `#!/usr/bin/env bun
if (${JSON.stringify(livePolicyOk)}) {
  console.log("Live execution dependency policy passed for selected specs.");
  process.exit(0);
}
console.error("Live execution dependency policy failed:");
console.error("- features/windows/tests/node-pool.ts:1 spec.windows.node-pool-create: selected scenario test depends on mounted private AKS RP source; make it self-contained before workflow execution");
process.exit(1);
`,
    "utf8",
  );
  await writeFile(
    join(projectDir, "runner", "check-live-admission.ts"),
    `#!/usr/bin/env bun
if (${JSON.stringify(liveAdmissionOk)}) {
  console.log("Live admission policy passed for selected specs.");
  process.exit(0);
}
console.error("Live admission policy failed:");
console.error("- spec.windows.node-pool-create: source-check-only: Spec is not directly live-executable by the single-spec runner.");
process.exit(1);
`,
    "utf8",
  );
}

function pipelineRunUrl(runId: string | number): string {
  return (
    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=" +
    String(runId)
  );
}

type CompactPipelineState = {
  dispatchCount?: number;
  loopKey?: string;
  run?: PipelineRun & {
    loopKey?: string;
    planPath?: string;
    featureSet?: string;
  };
};

function readCompactPipelineState(statePath: string): CompactPipelineState {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function writeCompactPipelineState(
  statePath: string,
  state: CompactPipelineState,
): void {
  mkdirSync(join(statePath, ".."), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function appendCompactPipelineDispatch(
  logPath: string,
  inputs: Record<string, string>,
): void {
  mkdirSync(join(logPath, ".."), { recursive: true });
  appendFileSync(logPath, JSON.stringify(inputs) + "\n");
}

function writeCompactPipelineArtifacts(
  artifactDir: string,
  runId: string,
  loopKey: string,
): void {
  const artifactRoot = join(
    artifactDir,
    "aks-rp-e2e-" + runId + "-test-results",
  );
  const resultDir = join(
    artifactRoot,
    "runs",
    "test-results",
    "feature-compact-windows-staging_000001",
  );
  const sharedDir = join(resultDir, "shared-clusters");
  mkdirSync(resultDir, { recursive: true });
  mkdirSync(sharedDir, { recursive: true });
  const surface = process.env.FAKE_GH_RESULT_SURFACE || "live-azure-run";
  const status = process.env.FAKE_GH_RESULT_STATUS || "passed";
  const specStatus = status === "passed" ? "pass" : "error";
  const resultReason =
    process.env.FAKE_GH_RESULT_REASON ||
    (surface === "live-azure-run"
      ? "Live Azure run passed."
      : "Check complete without Azure resource changes.");
  const resultCategory =
    process.env.FAKE_GH_RESULT_CATEGORY ||
    (status === "passed" ? "none" : "test_error");
  writeFileSync(
    join(resultDir, "result.json"),
    JSON.stringify(
      {
        runId: "feature-compact-windows-staging_000001",
        planId: "feature-compact-windows-staging",
        planPath: "features/windows/compact/staging.plan.json",
        target: {
          name: "staging",
          environment: "staging",
          subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
          location: "westus2",
          surface,
        },
        status,
        counts: {
          pass: status === "passed" ? 1 : 0,
          fail: 0,
          error: status === "passed" ? 0 : 1,
          skipped: 0,
        },
        specResults: [
          {
            specId: "spec.windows.node-pool-create",
            status: specStatus,
            reason: resultReason,
            category: resultCategory,
            durationMs: surface === "live-azure-run" ? 240000 : 400,
          },
        ],
      },
      null,
      2,
    ),
  );
  if (surface === "live-azure-run" && status === "passed") {
    const cleanupStatus =
      process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STATUS || "delete-started";
    const cleanupStarted =
      process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STARTED !== "0";
    const record: Record<string, unknown> = {
      clusterId: "shared-exec-cluster-01",
      resourceGroup: "rg-plan-001-windows-staging-000001",
      clusterName: "aks-plan-001-windows-staging-000001",
      status: "released",
      cleanupStatus,
      createdAt: "2026-06-30T00:00:00.000Z",
    };
    if (cleanupStarted) {
      record.cleanupStartedAt = "2026-06-30T00:30:00.000Z";
      record.cleanupReason = "vitest-global-teardown";
    }
    writeFileSync(
      join(sharedDir, "shared-exec-cluster-01.json"),
      JSON.stringify(record, null, 2),
    );
  }
  mkdirSync(join(artifactRoot, "runs"), { recursive: true });
  writeFileSync(
    join(artifactRoot, "runs", "workflow-metadata.json"),
    JSON.stringify({ loop_key: loopKey }, null, 2),
  );
}

async function installCompactPipelineBackend(
  projectDir: string,
  conclusion = "success",
  options: {
    resultSurface?: string;
    resultStatus?: string;
    resultReason?: string;
    resultCategory?: string;
    sharedClusterCleanupStatus?: string;
    sharedClusterCleanupStarted?: boolean;
  } = {},
) {
  const statePath = join(projectDir, ".state", "fake-pipeline-run.json");
  const logPath = join(projectDir, ".state", "fake-pipeline-dispatches.jsonl");
  const previous = {
    FAKE_GH_STATE: process.env.FAKE_GH_STATE,
    FAKE_GH_LOG: process.env.FAKE_GH_LOG,
    FAKE_GH_CONCLUSION: process.env.FAKE_GH_CONCLUSION,
    FAKE_GH_RESULT_SURFACE: process.env.FAKE_GH_RESULT_SURFACE,
    FAKE_GH_RESULT_STATUS: process.env.FAKE_GH_RESULT_STATUS,
    FAKE_GH_RESULT_REASON: process.env.FAKE_GH_RESULT_REASON,
    FAKE_GH_RESULT_CATEGORY: process.env.FAKE_GH_RESULT_CATEGORY,
    FAKE_GH_SHARED_CLUSTER_CLEANUP_STATUS:
      process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STATUS,
    FAKE_GH_SHARED_CLUSTER_CLEANUP_STARTED:
      process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STARTED,
    FAKE_GH_DISPATCH_FAIL: process.env.FAKE_GH_DISPATCH_FAIL,
    FAKE_GH_REJECT_METADATA: process.env.FAKE_GH_REJECT_METADATA,
    MAY_ADO_PIPELINES_POLL_MS: process.env.MAY_ADO_PIPELINES_POLL_MS,
    MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS:
      process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS,
  };
  process.env.FAKE_GH_STATE = statePath;
  process.env.FAKE_GH_LOG = logPath;
  process.env.FAKE_GH_CONCLUSION = conclusion;
  process.env.FAKE_GH_RESULT_SURFACE =
    options.resultSurface ?? "live-azure-run";
  process.env.FAKE_GH_RESULT_STATUS = options.resultStatus ?? "passed";
  if (options.resultReason === undefined)
    delete process.env.FAKE_GH_RESULT_REASON;
  else process.env.FAKE_GH_RESULT_REASON = options.resultReason;
  if (options.resultCategory === undefined)
    delete process.env.FAKE_GH_RESULT_CATEGORY;
  else process.env.FAKE_GH_RESULT_CATEGORY = options.resultCategory;
  process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STATUS =
    options.sharedClusterCleanupStatus ?? "delete-started";
  process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STARTED =
    options.sharedClusterCleanupStarted === false ? "0" : "1";
  delete process.env.FAKE_GH_DISPATCH_FAIL;
  delete process.env.FAKE_GH_REJECT_METADATA;
  process.env.MAY_ADO_PIPELINES_POLL_MS = "1";
  process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS = "1";

  setPipelineBackendForTests({
    activeRuns: () => {
      const run = readCompactPipelineState(statePath).run;
      return run && run.status !== "completed" ? [run] : [];
    },
    dispatch: ({ inputs }): CommandResult => {
      appendCompactPipelineDispatch(logPath, inputs);
      const state = readCompactPipelineState(statePath);
      const dispatchCount = Number(state.dispatchCount || 0) + 1;
      if (process.env.FAKE_GH_DISPATCH_FAIL === "1") {
        return {
          ok: false,
          status: 403,
          stdout: "",
          stderr: '{"message":"dispatch failed","status":"403"}',
        };
      }
      if (
        dispatchCount === 1 &&
        process.env.FAKE_GH_REJECT_METADATA === "1" &&
        inputs.metadata
      ) {
        writeCompactPipelineState(statePath, { ...state, dispatchCount });
        return {
          ok: false,
          status: 422,
          stdout: "",
          stderr:
            '{"message":"Unexpected inputs provided: [\\"metadata\\"]","status":"422"}',
        };
      }
      const loopKey = inputs.metadata
        ? JSON.parse(inputs.metadata).loop_key || ""
        : "";
      const run: PipelineRun & {
        loopKey?: string;
        planPath?: string;
        featureSet?: string;
      } = {
        databaseId: 123,
        status: "completed",
        conclusion: process.env.FAKE_GH_CONCLUSION || "success",
        url: pipelineRunUrl(123),
        createdAt: new Date().toISOString(),
        displayTitle:
          "AKS RP E2E " +
          (inputs.plan_path || inputs.feature_set || "") +
          " " +
          (inputs.target || ""),
        loopKey,
        planPath: inputs.plan_path || "",
        featureSet: inputs.feature_set || "",
      };
      writeCompactPipelineState(statePath, {
        ...state,
        dispatchCount,
        loopKey,
        run,
      });
      return { ok: true, status: 0, stdout: JSON.stringify(run), stderr: "" };
    },
    newestRun: (input) => {
      const run = readCompactPipelineState(statePath).run ?? null;
      return run && (input.match?.(run) ?? true) ? run : null;
    },
    getRun: ({ runId }) => {
      const run = readCompactPipelineState(statePath).run ?? null;
      if (!run) return null;
      return String(run.databaseId ?? "") === String(runId) ? run : null;
    },
    downloadArtifacts: ({ artifactDir, runId }) => {
      const state = readCompactPipelineState(statePath);
      if (!state.run) {
        return { ok: false, status: 404, stdout: "", stderr: "missing run" };
      }
      writeCompactPipelineArtifacts(artifactDir, runId, state.loopKey || "");
      return {
        ok: true,
        status: 0,
        stdout: "Downloaded compact pipeline artifacts.",
        stderr: "",
      };
    },
  });

  return () => {
    setPipelineBackendForTests(null);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function eventBlock(event: Record<string, unknown>): string {
  return `## Trigger Event
\`\`\`json
${JSON.stringify(event)}
\`\`\``;
}

function config(projectDir: string, maxConcurrent = 5) {
  return taskTreeConfig({
    appDir: projectDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent,
  });
}

async function writeRootTree(projectDir: string) {
  await writeFile(
    resolveTaskTreePath(projectDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        active_task_id: null,
        active_task_ids: [],
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            status: "backlog",
            children: ["aks-feature-compact-loop"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "aks-feature-compact-loop": {
            id: "aks-feature-compact-loop",
            parent_id: "project",
            state: "backlog",
            status: "backlog",
            workflow: "feature-compact-loop-controller",
            priority: "P2",
            children: [],
            goal: "Create feature compact packages.",
            inputs: [],
            outputs: [".state/feature-compact-loop/state.json"],
            acceptance: ["Loop is current"],
            forbidden: [],
            conflict_scope: ["feature-compact-loop"],
            depends_on: [],
            context: {
              windowSize: 1,
              stateRef: ".state/feature-compact-loop/state.json",
              target: "staging",
              checkParallel: 5,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

describe("feature compact loop", () => {
  test("loads compact candidates from feature-owned specs folders", async () => {
    const projectDir = await makeProject();

    const records = loadFeatureCompactRecords(projectDir);

    expect(records).toEqual([
      expect.objectContaining({
        featureKey: "windows",
        capabilityId: "windows",
        packetPath: "features/windows.yaml",
        specsDir: "features/windows/specs",
        specCount: 1,
      }),
    ]);
  });

  test("controller creates bounded compact planner children", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(projectDir);
    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(_type: string, payload: Record<string, unknown>) {
          dispatched.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Created 1 child task");
      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(projectDir), "utf8"),
      );
      const loop = tree.tasks["aks-feature-compact-loop"];
      expect(loop.children).toHaveLength(1);
      const child = tree.tasks[loop.children[0]];
      expect(child.workflow).toBe("feature-compact-planner");
      expect(child.context.featureKey).toBe("windows");
      expect(child.context.target).toBe("staging");
      expect(child.outputs).toContain(
        "features/windows/compact/staging.plan.json",
      );
      expect(child.outputs).toContain(
        "features/windows/compact/staging.diagnostics.json",
      );
      expect(child.outputs).not.toContain(
        "features/windows/compact/staging.summary.md",
      );
      expect(child.acceptance.join("\n")).toContain(
        "not appended to generated compact summaries",
      );
      expect(child.forbidden.join("\n")).toContain(
        "Do not append task refresh",
      );
      expect(loop.context.workflowProgress).toMatchObject({
        completionReady: false,
        pending: 0,
        running: 1,
        lastPulseCreated: 1,
      });
      expect(dispatched).toHaveLength(1);
      expect(
        peekTaskAssignments(config(projectDir)).some(
          (queued) => queued.taskId === child.id,
        ),
      ).toBe(false);
    } finally {
      restoreGh();
    }
  });

  test("controller sends non-retryable compact errors to support follow-up without planner retry", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      retryable: false,
      retryReason: "Exact external prerequisite is missing.",
      attempts: 0,
      lastSummary: "Exact external prerequisite is missing.",
    });
    saveFeatureCompactLoopState(statePath, state);
    const restoreGh = await installCompactPipelineBackend(projectDir);
    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(_type: string, payload: Record<string, unknown>) {
          dispatched.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Created 0 child task");
      expect(result.message).toContain("Created 1 grouped compact repair task");
      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(projectDir), "utf8"),
      );
      const loop = tree.tasks["aks-feature-compact-loop"];
      expect(
        loop.children.filter(
          (childId: string) =>
            tree.tasks[childId]?.workflow === "feature-compact-planner",
        ),
      ).toHaveLength(0);
      const supportChildren = loop.children.filter(
        (childId: string) =>
          tree.tasks[childId]?.context?.featureCompactFollowup === true,
      );
      expect(supportChildren).toHaveLength(1);
      expect(tree.tasks[supportChildren[0]].context.errorClass).toBe(
        "compact-error",
      );
      expect(tree.tasks[supportChildren[0]].forbidden.join("\n")).toContain(
        "Do not append task refresh",
      );
      expect(tree.tasks[supportChildren[0]].acceptance.join("\n")).toContain(
        "feature-owned compact artifacts were updated only for material reusable package/spec changes",
      );
      expect(dispatched).toHaveLength(1);
    } finally {
      restoreGh();
    }
  });

  test("controller requeues stale package-gate errors when current compact plan is live-ready", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    await mkdir(join(projectDir, "features", "windows", "compact"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "windows", "compact", "staging.plan.json"),
      JSON.stringify(
        {
          liveDispatchGate: {
            allowed: true,
            packageStatus: "ready",
            reason: "current compact plan is ready",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      attempts: 2,
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastSummary:
        "Feature compact package is incomplete for windows. Compact package selected 1 of 2 feature spec(s).",
    });
    saveFeatureCompactLoopState(statePath, state);

    const restoreGh = await installCompactPipelineBackend(projectDir);
    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];
    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(_type: string, payload: Record<string, unknown>) {
          dispatched.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Reset 1 stale package-gate error");
      const updatedState = JSON.parse(await readFile(statePath, "utf8"));
      expect(updatedState.features.windows).toMatchObject({
        status: "running",
        attempts: 1,
        retryable: true,
        retryReason: null,
      });
      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(projectDir), "utf8"),
      );
      const compactChildren = tree.tasks[
        "aks-feature-compact-loop"
      ].children.filter(
        (childId: string) =>
          tree.tasks[childId]?.workflow === "feature-compact-planner",
      );
      expect(compactChildren).toHaveLength(1);
      expect(dispatched).toHaveLength(1);
    } finally {
      restoreGh();
    }
  });

  test("controller turns failed compact branches into focused diagnostic tasks", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "windows", "specs", "bad-branch.json"),
      JSON.stringify({ id: "spec.windows.bad-branch" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(projectDir);
    const resultDir = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "artifacts",
      "456",
      "bundle",
      "runs",
      "test-results",
      "feature-compact-windows-staging_000002",
    );
    await mkdir(resultDir, { recursive: true });
    await writeFile(
      join(resultDir, "result.json"),
      JSON.stringify(
        {
          runId: "feature-compact-windows-staging_000002",
          planId: "feature-compact-windows-staging",
          planPath: "features/windows/compact/staging.plan.json",
          target: {
            name: "staging",
            environment: "staging",
            location: "westus2",
            surface: "live-azure-run",
          },
          status: "nonpassing",
          counts: { pass: 1, fail: 0, error: 1, skipped: 0 },
          specResults: [
            {
              specId: "spec.windows.node-pool-create",
              status: "pass",
              reason: "Live Azure branch passed.",
              category: "none",
            },
            {
              specId: "spec.windows.bad-branch",
              status: "error",
              reason: "Focused branch assertion failed.",
              category: "unknown",
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      attempts: 2,
      lastWorkflowRunId: "456",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=456",
      lastResultPath:
        ".state/feature-compact-loop/artifacts/456/bundle/runs/test-results/feature-compact-windows-staging_000002/result.json",
      lastSummary: "Compact live run is nonpassing with one failed branch.",
    });
    saveFeatureCompactLoopState(statePath, state);
    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(_type: string, payload: Record<string, unknown>) {
          dispatched.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Created 1 focused failed-branch diagnostic task",
      );
      expect(result.message).toContain(
        "Recorded 1 compact branch pass(es) in the spec loop",
      );
      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(projectDir), "utf8"),
      );
      const loop = tree.tasks["aks-feature-compact-loop"];
      const focusedChildren = loop.children
        .map((childId: string) => tree.tasks[childId])
        .filter(
          (child: any) => child?.context?.featureCompactFocusedSpec === true,
        );
      expect(focusedChildren).toHaveLength(1);
      expect(focusedChildren[0].workflow).toBeUndefined();
      expect(focusedChildren[0].context).toMatchObject({
        featureKey: "windows",
        specId: "spec.windows.bad-branch",
        sourceCompactWorkflowRunId: "456",
        featureCompactFocusedDiagnostic: true,
        requiresGitHubRun: false,
        adoPipeline: "ado-pipeline-467665",
        target: "staging",
      });
      expect(focusedChildren[0].conflict_scope).toContain(
        "compact-failed-branch:windows:spec.windows.bad-branch",
      );
      const specLoopState = JSON.parse(
        await readFile(
          join(projectDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        specLoopState.specs["spec.windows.node-pool-create"],
      ).toMatchObject({
        status: "pass",
        lastRunId: "456",
      });
      expect(
        dispatched.some((event) => event.taskId === focusedChildren[0].id),
      ).toBe(true);
    } finally {
      restoreGh();
    }
  });

  test("controller caps compact planner children by live GitHub capacity", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "linux", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "linux.yaml"),
      "capabilityId: linux\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "linux", "specs", "node-pool.json"),
      JSON.stringify({ id: "spec.linux.node-pool-create" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].context.windowSize = 3;
    tree.tasks["aks-feature-compact-loop"].context.githubActiveRunLimit = 1;
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
    const restoreGh = await installCompactPipelineBackend(projectDir);
    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(_type: string, payload: Record<string, unknown>) {
          dispatched.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Created 1 child task");
      const updated = JSON.parse(await readFile(treePath, "utf8"));
      const loop = updated.tasks["aks-feature-compact-loop"];
      const compactChildren = loop.children.filter(
        (childId: string) =>
          updated.tasks[childId]?.workflow === "feature-compact-planner",
      );
      expect(compactChildren).toHaveLength(1);
      expect(dispatched).toHaveLength(1);
      expect(loop.context.workflowProgress).toMatchObject({
        activeGithubRuns: 0,
        githubActiveRunLimit: 1,
        openChildren: 1,
        running: 1,
      });
    } finally {
      restoreGh();
    }
  });

  test("planner marks done only after the live Azure DevOps compact pipeline passes", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    let result;
    try {
      result = await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
    } finally {
      restoreGh();
    }

    expect(result.status).toBe("done");
    expect(result.message).toContain("live Azure DevOps pipeline passed");
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "done",
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastDiagnosticsPath: "features/windows/compact/staging.diagnostics.json",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      activeAttemptId: null,
      activeTaskSessionId: null,
      activeWorkflowRunId: null,
      heartbeatAt: null,
    });
    expect(state.features.windows.lastResultPath).toContain(
      ".state/feature-compact-loop/artifacts/123/",
    );
    expect(state.features.windows.lastResultPath).toContain("result.json");
    expect(state.features.windows.lastWorkflowLoopKey).toContain(
      "compact-feature-windows-a_compact-feature-windows_",
    );
    expect(state.features.windows.lastDispatchMetadataPath).toContain(
      ".state/feature-compact-loop/dispatches/compact-feature-windows/",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("done");
    const dispatchMetadata = JSON.parse(
      await readFile(state.features.windows.lastDispatchMetadataPath, "utf8"),
    );
    expect(dispatchMetadata.loopKey).toBe(
      state.features.windows.lastWorkflowLoopKey,
    );
    expect(dispatchMetadata.inputs.metadata).toBe(
      JSON.stringify({ loop_key: state.features.windows.lastWorkflowLoopKey }),
    );
  });

  test("planner records live workflow failure as repairable error", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "failure",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "error",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      activeAttemptId: expect.stringContaining("a_compact-feature-windows"),
      activeTaskSessionId: expect.stringContaining(
        "s_task_compact-feature-windows",
      ),
      activeWorkflowRunId: "123",
    });
    expect(typeof state.features.windows.heartbeatAt).toBe("string");
    expect(state.features.windows.lastWorkflowLoopKey).toContain(
      "compact-feature-windows-a_compact-feature-windows_",
    );
    expect(state.features.windows.lastDispatchMetadataPath).toContain(
      ".state/feature-compact-loop/dispatches/compact-feature-windows/",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("partial");
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-live-test",
    });
    const dispatchMetadata = JSON.parse(
      await readFile(state.features.windows.lastDispatchMetadataPath, "utf8"),
    );
    expect(dispatchMetadata.dispatchResult.ok).toBe(true);
    expect(dispatchMetadata.inputs.metadata).toBe(
      JSON.stringify({ loop_key: state.features.windows.lastWorkflowLoopKey }),
    );
  });

  test("planner classifies failed compact workflow capacity preflight as capacity wait", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "failure",
      {
        resultStatus: "nonpassing",
        resultReason:
          "Live Azure run failed staging AKS capacity preflight: westus2 has 161/161 managed clusters, so no concurrent new cluster create slots are available.",
        resultCategory: "environment_blocker",
      },
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "error",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      activeAttemptId: expect.stringContaining("a_compact-feature-windows"),
      activeTaskSessionId: expect.stringContaining(
        "s_task_compact-feature-windows",
      ),
      activeWorkflowRunId: "123",
    });
    expect(typeof state.features.windows.heartbeatAt).toBe("string");
    expect(String(state.features.windows.lastSummary)).toContain(
      "waiting on staging capacity",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("partial");
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-capacity",
    });
  });

  test("planner clears stale live run references when workflow dispatch fails", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    process.env.FAKE_GH_DISPATCH_FAIL = "1";
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state: initialState } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(initialState, "windows", {
      status: "pending",
      lastWorkflowRunId: "old-run",
      lastWorkflowRunUrl: "https://github.example/runs/old-run",
      lastWorkflowLoopKey: "old-loop-key",
      lastDispatchMetadataPath: ".state/old-dispatch.json",
    });
    saveFeatureCompactLoopState(statePath, initialState);

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
    } finally {
      restoreGh();
    }

    const state = JSON.parse(await readFile(statePath, "utf8"));
    expect(state.features.windows).toMatchObject({
      status: "error",
      lastWorkflowRunId: null,
      lastWorkflowRunUrl: null,
    });
    expect(state.features.windows.lastWorkflowLoopKey).not.toBe("old-loop-key");
    expect(state.features.windows.lastDispatchMetadataPath).not.toBe(
      ".state/old-dispatch.json",
    );
    expect(String(state.features.windows.lastSummary)).toContain(
      "Azure DevOps live compact pipeline dispatch failed",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].problem).toMatchObject({
      category: "ado-pipeline-dispatch",
    });
  });

  test("planner derives compact identity for reviewed follow-up tasks", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows-followup",
    ];
    tree.tasks["compact-feature-windows-followup"] = {
      id: "compact-feature-windows-followup",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Regenerate the windows compact package from review feedback.",
      inputs: ["Reviewed task: compact-feature-windows"],
      outputs: [
        ".state/feature-compact-loop/state.json",
        "features/windows/compact/staging.plan.json",
        "features/windows/compact/staging.summary.md",
        "features/windows/compact/staging.diagnostics.json",
      ],
      acceptance: ["Package checked"],
      conflict_scope: ["feature-compact:windows"],
      context: {
        reviewedTask: {
          taskId: "compact-feature-windows",
          attemptId: "attempt-1",
          decision: "followup",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows-followup",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    let result;
    try {
      result = await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
    } finally {
      restoreGh();
    }

    expect(result.status).toBe("done");
    expect(result.message).toContain("live Azure DevOps pipeline passed");
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("done");
    expect(String(completedEvents[0].summary)).not.toContain(
      "missing featureKey or capabilityId",
    );
  });

  test("planner rejects green compact workflow when artifact is only check validation", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
      {
        resultSurface: "check-validation",
      },
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      const result = await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("did not prove a live Azure pass");
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "error",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
    });
    expect(String(state.features.windows.lastSummary)).toContain(
      "surface is check-validation, not live-azure-run",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("partial");
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-live-proof",
    });
  });

  test("planner rejects green compact workflow without real AKS creation evidence", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
      {
        resultReason: "Live Azure run passed.",
        sharedClusterCleanupStatus: "complete",
        sharedClusterCleanupStarted: false,
      },
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      const result = await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("did not prove a live Azure pass");
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "error",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
    });
    expect(String(state.features.windows.lastSummary)).toContain(
      "no AKS cluster creation evidence",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("partial");
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-live-proof",
    });
  });

  test("planner retries compact dispatch without metadata after exact 422 and preserves ready package intent", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    process.env.FAKE_GH_REJECT_METADATA = "1";
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      const result = await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("live Azure DevOps pipeline passed");
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "done",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
    });
    const dispatchMetadata = JSON.parse(
      await readFile(state.features.windows.lastDispatchMetadataPath, "utf8"),
    );
    expect(dispatchMetadata.dispatchResult.ok).toBe(true);
    expect(dispatchMetadata.inputs.metadata).toBeUndefined();
    const dispatchLog = (
      await readFile(
        join(projectDir, ".state", "fake-pipeline-dispatches.jsonl"),
        "utf8",
      )
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, string>);
    expect(dispatchLog).toHaveLength(2);
    expect(dispatchLog[0].metadata).toBeDefined();
    expect(dispatchLog[1].metadata).toBeUndefined();
    expect(dispatchLog[1].plan_path).toBe(
      "features/windows/compact/staging.plan.json",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("done");
  });

  test("planner blocks live dispatch when compact package status is partial", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir, { packageStatus: "partial" });
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "error",
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastDiagnosticsPath: "features/windows/compact/staging.diagnostics.json",
      lastResultPath:
        "runs/test-results/feature-compact-windows-staging_000001",
    });
    expect(state.features.windows.lastWorkflowRunId).toBeNull();
    expect(state.features.windows.lastWorkflowRunUrl).toBeNull();
    expect(state.features.windows.lastDispatchMetadataPath).toBeNull();
    expect(state.features.windows.lastWorkflowLoopKey).toBeNull();
    expect(String(state.features.windows.lastSummary)).toContain(
      "Feature compact package for windows is partial.",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("partial");
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-package-status",
    });
    expect(JSON.stringify(completedEvents[0])).toContain(
      "Feature compact package for windows is partial",
    );
  });

  test("planner trusts maintained diagnostics feature spec count over stale task specCount", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir, {
      packageStatus: "ready",
      diagnosticsOverride: {
        feature: { specCount: 1 },
        metrics: {
          specsSelected: 1,
          clustersNeeded: 1,
          baselineClusterCount: 1,
          clustersSaved: 0,
        },
        selectedSpecIds: ["spec.windows.node-pool-create"],
        materialization: {
          status: "ready",
          runnableSpecCount: 1,
          unrunnableSpecIds: [],
        },
      },
    });
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
        specCount: 2,
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      const result = await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Workflow run: 123 https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      );
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows.status).toBe("done");
    expect(String(state.features.windows.lastSummary)).not.toContain(
      "selected 1 of 2 feature spec(s)",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("done");
  });

  test("planner preserves selectionBlocker diagnostics in blocked package state writeback", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir, {
      packageStatus: "blocked",
      diagnosticsOverride: {
        selectionBlocker: {
          kind: "pipeline-only-proof-ceiling",
          reason:
            "The compact package is blocked because stronger same-path proof requires an authoritative pipeline surface.",
          remainingSpecIds: ["spec.windows.node-pool-create"],
          resumeCondition:
            "Reopen only if an authoritative pipeline artifact is returned or the owner reclassifies the carrier.",
        },
        liveDispatchGate: {
          allowed: false,
          reason:
            "Compact package is blocked; no live-ready member set remains after compact eligibility filtering.",
        },
      },
    });
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "error",
      retryable: false,
      retryReason:
        "Reopen only if an authoritative pipeline artifact is returned or the owner reclassifies the carrier.",
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastDiagnosticsPath: "features/windows/compact/staging.diagnostics.json",
      lastResultPath:
        "runs/test-results/feature-compact-windows-staging_000001",
    });
    expect(String(state.features.windows.lastSummary)).toContain(
      "Exact blocker: pipeline-only-proof-ceiling.",
    );
    expect(String(state.features.windows.lastSummary)).toContain(
      "Live dispatch gate: Compact package is blocked; no live-ready member set remains after compact eligibility filtering.",
    );
    expect(String(state.features.windows.lastSummary)).not.toContain(
      "live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-package-status",
      resumeCondition:
        "Reopen only if an authoritative pipeline artifact is returned or the owner reclassifies the carrier.",
    });
    expect(JSON.stringify(completedEvents[0])).toContain(
      "pipeline-only-proof-ceiling",
    );
  });

  test("planner blocks live dispatch when selected specs fail live policy", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir, { liveAdmissionOk: false });
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        checkParallel: 5,
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const assignment = assignTask(config(projectDir), {
      taskId: "compact-feature-windows",
    });
    const completedEvents: Array<Record<string, unknown>> = [];
    try {
      const result = await executePlanner({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(type: string, payload: Record<string, unknown>) {
          if (type === "project.task.completed") completedEvents.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Feature compact live policy failed");
    } finally {
      restoreGh();
    }

    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "error",
      retryable: true,
      retryReason:
        "Repair selected compact scenario tests so live execution is self-contained and live-admissible before retrying Azure DevOps pipeline dispatch.",
      lastWorkflowRunId: null,
      lastWorkflowRunUrl: null,
      lastDispatchMetadataPath: null,
      lastWorkflowLoopKey: null,
    });
    expect(String(state.features.windows.lastSummary)).toContain(
      "Azure DevOps pipeline dispatch skipped",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-live-policy",
    });
    try {
      await readFile(
        join(projectDir, ".state", "fake-pipeline-dispatches.jsonl"),
        "utf8",
      );
      throw new Error("expected no Azure DevOps pipeline dispatch log");
    } catch (error) {
      expect(String(error)).toContain("ENOENT");
    }
  });

  test("controller accepts completed compact package reviews only after live proof", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "review",
      status: "review",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      result:
        "Feature compact package done for windows; live Azure DevOps pipeline passed.",
      trace: {
        last_worker_result: "done",
        last_worker_summary:
          "Feature compact package done for windows; live Azure DevOps pipeline passed.",
      },
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "done",
      taskId: "compact-feature-windows",
      attempts: 1,
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: "live-aks-proof-v2",
      lastSummary:
        "Feature compact package done for windows; live Azure DevOps pipeline passed.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Accepted 1 recorded compact package review",
    );
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["compact-feature-windows"].state).toBe("done");
  });

  test("controller marks drained blocked-wait compact frontier as no-refill stewardship", async () => {
    const projectDir = await makeProject();
    const restoreGh = await installCompactPipelineBackend(projectDir);
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = ["wait-compact-signal"];
    tree.tasks["wait-compact-signal"] = {
      id: "wait-compact-signal",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal: "Wait for exact compact resume signal.",
      inputs: [],
      outputs: ["evidence/archive/wait-compact-signal.md"],
      acceptance: ["Signal returned"],
      forbidden: [],
      conflict_scope: ["feature-compact"],
      depends_on: [],
      blocker: {
        condition: "external signal required",
        category: "external-wait",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      const updated = JSON.parse(await readFile(treePath, "utf8"));
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
      ).toMatchObject({
        completionReady: false,
        openChildren: 0,
        openSupportChildren: 1,
        blockedWaitChildren: 1,
        retryBudgetExhausted: 1,
        maxDirectAttemptsPerFeature: 2,
        unrepresentedNonTerminalCount: 0,
      });
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress
          .reason,
      ).toContain("non-terminal features");
      expect(
        updated.tasks["reconcile-compact-loop-package-partial"],
      ).toBeTruthy();
    } finally {
      restoreGh();
    }
  });

  test("controller represents staging capacity errors as blocked wait follow-ups", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Exact staging capacity wait for windows: westus2 managed-cluster capacity was 161/161 before mutation. Rerun only after capacity frees or quota changes.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    const waitTask =
      updated.tasks["hold-compact-windows-staging-capacity-frontier"];
    expect(waitTask).toBeTruthy();
    expect(waitTask.state).toBe("blocked");
    expect(waitTask.blocker.category).toBe("external-wait");
    expect(waitTask.blocker.blocked_at).toBeTruthy();
    expect(waitTask.blocker.waiting_for).toMatchObject({
      type: "azure.capacity.available",
      target: "staging",
      resource: "managedClusters",
    });
    expect(waitTask.blocker.waiting_for.featureKey).toBe("windows");
    expect(waitTask.blocker.observed_by).toMatchObject({
      workflow: "feature-compact-loop-controller",
      trigger: "project.task.tick",
    });
    expect(waitTask.blocker.observation_method).toContain("compact-loop tick");
    expect(waitTask.blocker.next_check_at).toBeTruthy();
    expect(waitTask.blocker.resume_condition).toContain("capacity frees");
    expect(waitTask.blocker.fallback_at).toBeTruthy();
    expect(waitTask.blocker.fallback_action).toContain("refresh evidence");
    expect(waitTask.conflict_scope).toContain("feature-compact:windows");
    expect(waitTask.context.errorClass).toBe("staging-capacity");
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      openSupportChildren: 0,
      blockedWaitChildren: 1,
      blocked: 1,
      error: 0,
      retryBudgetExhausted: 0,
      blockedWaitBlockedCount: 1,
      unrepresentedNonTerminalCount: 0,
    });

    await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);
    const repulsed = JSON.parse(await readFile(treePath, "utf8"));
    const capacityWaits = Object.values(repulsed.tasks).filter(
      (task: any) => task.context?.errorClass === "staging-capacity",
    );
    expect(capacityWaits).toHaveLength(1);
  });

  test("controller does not recreate grouped follow-up for feature with exact open successor", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-compact-windows-capacity",
    ];
    tree.tasks["wait-compact-windows-capacity"] = {
      id: "wait-compact-windows-capacity",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal: "Carry exact windows capacity wait.",
      inputs: [],
      outputs: ["evidence/archive/wait-compact-windows-capacity.md"],
      acceptance: ["Resume when capacity returns."],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      blocker: {
        condition: "windows capacity wait",
        category: "external-wait",
        owner: "operator",
        resume_condition: "capacity returns",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Exact staging capacity wait for windows: westus2 managed-cluster capacity was 161/161 before mutation. Rerun only after capacity frees or quota changes.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["reconcile-compact-loop-staging-capacity"]).toBe(
      undefined,
    );
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      blockedWaitChildren: 1,
      retryBudgetExhausted: 1,
      unrepresentedNonTerminalCount: 0,
    });
  });

  test("controller treats feature-compact-followup conflict scope as open grouped representation", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "diagnose-compact-capacity-family",
    ];
    tree.tasks["diagnose-compact-capacity-family"] = {
      id: "diagnose-compact-capacity-family",
      parent_id: "aks-feature-compact-loop",
      state: "active",
      status: "active",
      priority: "P1",
      children: [],
      goal: "Diagnose compact capacity family.",
      inputs: [],
      outputs: ["evidence/archive/diagnose-compact-capacity-family.md"],
      acceptance: ["Classify capacity family."],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:staging-capacity"],
      depends_on: [],
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Exact staging capacity wait for windows: westus2 managed-cluster capacity was 161/161 before mutation. Rerun only after capacity frees or quota changes.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["reconcile-compact-loop-staging-capacity"]).toBe(
      undefined,
    );
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress
        .representedSupportErrorClasses,
    ).toContain("staging-capacity");
  });

  test("controller creates a new support follow-up when prior error-class follow-up is done", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "reconcile-compact-loop-package-partial",
    ];
    tree.tasks["reconcile-compact-loop-package-partial"] = {
      id: "reconcile-compact-loop-package-partial",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      priority: "P1",
      children: [],
      goal: "Previous package-partial reconciliation wave.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Classified previous package partials"],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:package-partial"],
      depends_on: [],
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    const newFollowups = Object.keys(updated.tasks).filter(
      (taskId) =>
        taskId.startsWith("reconcile-compact-loop-package-partial-") &&
        ["active", "backlog"].includes(updated.tasks[taskId].state),
    );
    expect(newFollowups).toHaveLength(1);
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      openSupportChildren: 1,
      unrepresentedNonTerminalCount: 0,
    });
  });

  test("controller support follow-up only represents its own compact error class", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "linux", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "network", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "linux.yaml"),
      "capabilityId: linux\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "network.yaml"),
      "capabilityId: network\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "linux", "specs", "node-pool.json"),
      JSON.stringify({ id: "spec.linux.node-pool-create" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "network", "specs", "cni.json"),
      JSON.stringify({ id: "spec.network.cni" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "reconcile-compact-loop-package-partial",
    ];
    tree.tasks["aks-feature-compact-loop"].context.maxCompactFollowupGroups = 1;
    tree.tasks["reconcile-compact-loop-package-partial"] = {
      id: "reconcile-compact-loop-package-partial",
      parent_id: "aks-feature-compact-loop",
      state: "backlog",
      status: "backlog",
      priority: "P1",
      children: [],
      goal: "Current package-partial reconciliation wave.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Classify package partials"],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:package-partial"],
      depends_on: [],
      context: {
        featureCompactFollowup: true,
        errorClass: "package-partial",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    for (const featureKey of ["linux", "windows"]) {
      updateFeatureCompactItem(state, featureKey, {
        status: "error",
        taskId: `compact-feature-${featureKey}`,
        attempts: 2,
        lastSummary: `Feature compact package for ${featureKey} is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.`,
      });
    }
    updateFeatureCompactItem(state, "network", {
      status: "error",
      taskId: "compact-feature-network",
      attempts: 2,
      lastSummary:
        "Feature compact live Azure DevOps pipeline failed for network. Run id 12345.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      completionReady: false,
      error: 3,
      openSupportChildren: 1,
      representedSupportErrorClasses: ["package-partial"],
      unrepresentedNonTerminalCount: 1,
    });
  });

  test("controller does not duplicate timestamped support follow-up for same error class", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "reconcile-compact-loop-package-partial",
      "reconcile-compact-loop-package-partial-202607020451",
    ];
    tree.tasks["reconcile-compact-loop-package-partial"] = {
      id: "reconcile-compact-loop-package-partial",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      priority: "P1",
      children: [],
      goal: "Previous package-partial reconciliation wave.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Classified previous package partials"],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:package-partial"],
      depends_on: [],
      context: {
        featureCompactFollowup: true,
        errorClass: "package-partial",
      },
    };
    tree.tasks["reconcile-compact-loop-package-partial-202607020451"] = {
      id: "reconcile-compact-loop-package-partial-202607020451",
      parent_id: "aks-feature-compact-loop",
      state: "active",
      status: "active",
      priority: "P1",
      children: [],
      goal: "Current package-partial reconciliation wave.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Classify current package partials"],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:package-partial"],
      depends_on: [],
      context: {
        featureCompactFollowup: true,
        errorClass: "package-partial",
      },
      trace: {
        current_attempt_id:
          "a_reconcile-compact-loop-package-partial-202607020451",
        worker_started_attempt_id:
          "a_reconcile-compact-loop-package-partial-202607020451",
        worker_started_at: new Date().toISOString(),
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    const openPackagePartialFollowups = Object.values(updated.tasks).filter(
      (task: any) =>
        task.context?.featureCompactFollowup === true &&
        task.context?.errorClass === "package-partial" &&
        ["active", "backlog"].includes(task.state),
    );
    expect(openPackagePartialFollowups).toHaveLength(1);
    expect(
      updated.tasks["reconcile-compact-loop-package-partial-202607020451"],
    ).toBeTruthy();
    expect(
      updated.tasks["reconcile-compact-loop-package-partial-202607020452"],
    ).toBeUndefined();
  });

  test("controller recreates support follow-up when terminal class task leaves feature error unresolved", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "reconcile-compact-loop-package-partial",
    ];
    tree.tasks["reconcile-compact-loop-package-partial"] = {
      id: "reconcile-compact-loop-package-partial",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      resolution: "completed",
      done_at: "2999-01-01T00:00:00.000Z",
      priority: "P1",
      children: [],
      goal: "Current package-partial reconciliation wave.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Classified current package partials"],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:package-partial"],
      depends_on: [],
      context: {
        featureCompactFollowup: true,
        errorClass: "package-partial",
        totalFeatureCount: 1,
        sampledFeatureKeys: ["windows"],
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    const packagePartialFollowups = Object.values(updated.tasks).filter(
      (task: any) =>
        task.context?.featureCompactFollowup === true &&
        task.context?.errorClass === "package-partial",
    );
    expect(packagePartialFollowups).toHaveLength(2);
    const successor = packagePartialFollowups.find(
      (task: any) => task.id !== "reconcile-compact-loop-package-partial",
    ) as any;
    expect(successor).toBeTruthy();
    expect(successor.state).toBe("active");
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      representedSupportErrorClasses: ["package-partial"],
      unrepresentedNonTerminalCount: 0,
    });
  });

  test("controller does not let archived terminal follow-up hide retry-drained feature errors", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    await mkdir(join(projectDir, "tasks", "archive"), { recursive: true });

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    saveFeatureCompactLoopState(statePath, state);

    const archiveBundle = {
      version: 1,
      generated_at: "2999-01-01T00:00:00.000Z",
      tasks: [
        {
          id: "reconcile-compact-loop-package-partial-archived",
          parent_id: "aks-feature-compact-loop",
          state: "done",
          status: "done",
          resolution: "completed",
          done_at: "2999-01-01T00:00:00.000Z",
          priority: "P1",
          children: [],
          goal: "Archived package-partial reconciliation wave.",
          inputs: [],
          outputs: [".state/feature-compact-loop/state.json"],
          acceptance: ["Classified archived package partials"],
          forbidden: [],
          conflict_scope: ["feature-compact-followup:package-partial"],
          depends_on: [],
          context: {
            featureCompactFollowup: true,
            errorClass: "package-partial",
            totalFeatureCount: 1,
            sampledFeatureKeys: ["windows"],
          },
        },
      ],
    };
    await writeFile(
      join(projectDir, "tasks", "archive", "done-leaves-test.json"),
      `${JSON.stringify(archiveBundle, null, 2)}\n`,
      "utf8",
    );

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updated.tasks["reconcile-compact-loop-package-partial"],
    ).toBeTruthy();
    expect(updated.tasks["reconcile-compact-loop-package-partial"].state).toBe(
      "active",
    );
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      representedSupportErrorClasses: ["package-partial"],
      unrepresentedNonTerminalCount: 0,
    });
  });

  test("controller prefers durable feature error class over stale capacity wording", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      errorClass: "runtime-product-lineage",
      retryable: false,
      retryReason:
        "Superseded by accepted same-path runtime/product nonpass lineage; rerun only after meaningful product change.",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact live workflow is waiting on staging capacity for windows because managed clusters are full.",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    const exactWaits = Object.values(updated.tasks).filter(
      (task: any) => task.context?.featureCompactExactWait === true,
    );
    expect(exactWaits).toHaveLength(1);
    expect((exactWaits[0] as any).context.errorClass).toBe(
      "runtime-product-lineage",
    );
    expect((exactWaits[0] as any).blocker.waiting_for).toMatchObject({
      type: "owner.decision",
      featureKey: "windows",
      errorClass: "runtime-product-lineage",
      scope: "feature-compact",
    });
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      representedSupportErrorClasses: [],
      blocked: 1,
      error: 0,
      blockedWaitBlockedCount: 1,
      unrepresentedNonTerminalCount: 0,
      retryBudgetExhausted: 0,
    });
  });

  test("completed support task can reset exhausted compact retry budget with structured directive", async () => {
    const projectDir = await makeProject();
    const restoreGh = await installCompactPipelineBackend(projectDir);
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "repair-compact-package-partial",
    ];
    tree.tasks["repair-compact-package-partial"] = {
      id: "repair-compact-package-partial",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      done_at: "2999-01-01T00:00:00.000Z",
      priority: "P1",
      children: [],
      goal: "Repair package partial root cause.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Root cause fixed"],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:package-partial"],
      depends_on: [],
      context: {
        compactRetryReset: {
          errorClass: "package-partial",
          reason: "shared compact package generator now produces a ready plan",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Reset compact retry budget for 1 feature(s)",
      );
      const updated = JSON.parse(await readFile(treePath, "utf8"));
      expect(updated.tasks["compact-feature-windows"]).toBeTruthy();
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
      ).toMatchObject({
        retryBudgetExhausted: 0,
        lastPulseCreated: 1,
      });
      const savedState = JSON.parse(await readFile(statePath, "utf8"));
      expect(savedState.features.windows).toMatchObject({
        status: "running",
        attempts: 1,
        taskId: "compact-feature-windows",
      });
    } finally {
      restoreGh();
    }
  });

  test("completed exact compact repair can infer retry reset from accepted rerun text", async () => {
    const projectDir = await makeProject();
    const restoreGh = await installCompactPipelineBackend(projectDir);
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "repair-compact-windows-ready-package",
    ];
    tree.tasks["repair-compact-windows-ready-package"] = {
      id: "repair-compact-windows-ready-package",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      done_at: "2999-01-01T00:00:00.000Z",
      priority: "P1",
      children: [],
      goal: "Repair windows compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Root cause fixed"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      result:
        "Windows compact package is ready and the next bounded live rerun should prove the repaired path.",
      trace: {
        last_worker_summary:
          "Fixed the windows compact package. Do not retry the package repair itself; current repo truth is ready package plus next bounded live rerun.",
        review_summary:
          "Accepted repair: package is ready and should be requeued for live verification.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Reset compact retry budget for 1 feature(s)",
      );
      const updated = JSON.parse(await readFile(treePath, "utf8"));
      expect(updated.tasks["compact-feature-windows"]).toBeTruthy();
      const savedState = JSON.parse(await readFile(statePath, "utf8"));
      expect(savedState.features.windows).toMatchObject({
        status: "running",
        attempts: 1,
        taskId: "compact-feature-windows",
      });
    } finally {
      restoreGh();
    }
  });

  test("does not create focused compact diagnostics when an authoritative blocked holder already represents the same feature", async () => {
    const projectDir = await makeProject();
    const restoreGh = await installCompactPipelineBackend(projectDir);
    await mkdir(join(projectDir, "features", "fleet", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "fleet.yaml"),
      "capabilityId: fleet\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "fleet", "specs", "hubless.json"),
      JSON.stringify({ id: "spec.fleet.hubless-rpapi-lifecycle" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709",
    ];
    tree.tasks["hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709"] = {
      id: "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact compact frontier for spec.fleet.hubless-rpapi-lifecycle after same-path evidence reconfirmed the Fleet update readback/version progression mismatch.",
      inputs: [],
      outputs: [],
      acceptance: [
        "Resume only after changed-input, stronger same-path runtime evidence, or accepted replacement evidence changes this exact Fleet frontier.",
      ],
      forbidden: [],
      conflict_scope: ["feature-compact:fleet"],
      depends_on: [],
      blocker: {
        condition:
          "Blocked on the exact Fleet compact same-path update-readback/version progression frontier; no unchanged rerun is truthful.",
        waiting_for: {
          type: "owner.decision",
          featureKey: "fleet",
          target: "staging",
          errorClass: "reviewed-exception",
          scope: "feature-compact",
        },
      },
      context: {
        featureKey: "fleet",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const resultPath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "artifacts",
      "28621132999",
      "bundle",
      "runs",
      "test-results",
      "feature-compact-fleet-staging_000001",
      "result.json",
    );
    await mkdir(dirname(resultPath), { recursive: true });
    await writeFile(
      resultPath,
      JSON.stringify(
        {
          status: "nonpassing",
          targetSurface: "live-azure-run",
          specResults: [
            {
              specId: "spec.fleet.hubless-rpapi-lifecycle",
              status: "error",
              reason:
                "Fleet update readback mismatch: fleet-configuration-version stayed unchanged.",
              category: "unknown",
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "fleet", {
      status: "error",
      errorClass: "reviewed-exception",
      taskId: "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260708",
      frontierTaskIds: [
        "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260709",
      ],
      lastWorkflowRunId: "171368699",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171368699",
      lastResultPath:
        ".state/feature-compact-loop/artifacts/28621132999/bundle/runs/test-results/feature-compact-fleet-staging_000001/result.json",
      lastSummary:
        "Assigned compact artifact and same-path verifier still show one narrow Fleet update readback/version progression mismatch.",
      retryReason:
        "Do not regenerate a generic compact-error repair leaf; stronger same-path evidence already exists and no unchanged rerun is justified.",
    });
    saveFeatureCompactLoopState(statePath, state);
    const dispatched: Array<Record<string, unknown>> = [];

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent(_type: string, payload: Record<string, unknown>) {
          dispatched.push(payload);
        },
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).not.toContain(
        "Created 1 focused failed-branch diagnostic task",
      );
      const updated = JSON.parse(await readFile(treePath, "utf8"));
      expect(
        Object.keys(updated.tasks).filter((taskId) =>
          taskId.startsWith("verify-compact-fleet-fleet.hubless-rpapi-lifecycle"),
        ),
      ).toHaveLength(0);
      expect(
        dispatched.some((event) =>
          String(event.taskId ?? "").startsWith(
            "verify-compact-fleet-fleet.hubless-rpapi-lifecycle",
          ),
        ),
      ).toBe(false);
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
      ).toMatchObject({
        unrepresentedErrorCount: 0,
        unrepresentedBlockedCount: 0,
        blockedWaitChildren: 1,
      });
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress
          .representedFeatureKeys,
      ).toContain("fleet");
    } finally {
      restoreGh();
    }
  });

  test("completed focused compact diagnostic does not infer retry reset from rerun wording", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "verify-compact-windows-node-pool",
    ];
    tree.tasks["verify-compact-windows-node-pool"] = {
      id: "verify-compact-windows-node-pool",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      done_at: "2999-01-01T00:00:00.000Z",
      priority: "P1",
      children: [],
      goal: "Diagnose failed compact branch.",
      inputs: ["spec:spec.windows.node-pool-create"],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Diagnosed"],
      forbidden: [],
      conflict_scope: [
        "feature-compact:windows",
        "spec:spec.windows.node-pool-create",
      ],
      depends_on: [],
      context: {
        featureCompactFocusedSpec: true,
        featureCompactFocusedDiagnostic: true,
        featureKey: "windows",
        specId: "spec.windows.node-pool-create",
      },
      result:
        "Cancelled old single-spec rerun; rerun wording is diagnostic history, not accepted compact repair.",
      trace: {
        last_worker_summary:
          "The diagnostic mentions rerun, but no explicit compactRetryReset was emitted.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary: "Compact live run is nonpassing.",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).not.toContain("Reset compact retry budget");
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    expect(savedState.features.windows).toMatchObject({
      status: "error",
      attempts: 2,
      taskId: "compact-feature-windows",
    });
  });

  test("completed compact classification without retry intent does not requeue feature", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "classify-compact-windows-no-rerun",
    ];
    tree.tasks["classify-compact-windows-no-rerun"] = {
      id: "classify-compact-windows-no-rerun",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      done_at: "2999-01-01T00:00:00.000Z",
      priority: "P1",
      children: [],
      goal: "Classify windows compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Classified"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      result:
        "Windows compact package is classified as external wait; no rerun is truthful until product rollout lands.",
      trace: {
        review_summary:
          "Accepted classification and no-rerun condition for windows.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).not.toContain("Reset compact retry budget");
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    expect(savedState.features.windows).toMatchObject({
      status: "error",
      attempts: 2,
      taskId: "compact-feature-windows",
    });
  });

  test("blocked support wait suppresses duplicate planner-child creation for the same feature", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-compact-windows-capacity",
    ];
    tree.tasks["wait-compact-windows-capacity"] = {
      id: "wait-compact-windows-capacity",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal: "Hold the exact compact windows capacity wait.",
      inputs: [],
      outputs: ["evidence/archive/wait-compact-windows-capacity.md"],
      acceptance: ["Capacity returns or target changes"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      blocker: {
        condition: "capacity unavailable",
        category: "external-wait",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 1,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 0 child task(s)");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["aks-feature-compact-loop"].children).toEqual([
      "wait-compact-windows-capacity",
    ]);
    expect(updated.tasks["compact-feature-windows"]).toBeUndefined();
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      openChildren: 0,
      blockedWaitChildren: 1,
      running: 0,
      lastPulseCreated: 0,
      lastPulseAssigned: 0,
    });
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    expect(savedState.features.windows).toMatchObject({
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 1,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
  });

  test("blocked support wait can suppress duplicate planner-child creation via sampled feature keys", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-compact-auth-family",
    ];
    tree.tasks["wait-compact-auth-family"] = {
      id: "wait-compact-auth-family",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal: "Hold the exact compact auth-preflight wait for oidc-issuer.",
      inputs: ["feature:oidc-issuer"],
      outputs: ["evidence/archive/wait-compact-auth-family.md"],
      acceptance: ["Auth surface recovers or ref changes"],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:live-workflow"],
      depends_on: [],
      context: {
        featureCompactFollowup: true,
        errorClass: "live-workflow",
        sampledFeatureKeys: ["oidc-issuer"],
      },
      blocker: {
        condition: "auth preflight unavailable",
        category: "external-wait",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, "features", "oidc-issuer", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "oidc-issuer.yaml"),
      "capabilityId: oidc-issuer\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "oidc-issuer",
        "specs",
        "default-by-version.json",
      ),
      JSON.stringify({ id: "spec.oidc-issuer.default-by-version" }),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
      refreshFromProject: true,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "done",
      taskId: "compact-feature-windows",
      attempts: 1,
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: "live-aks-proof-v2",
      lastSummary:
        "Feature compact package done for windows; live Azure DevOps pipeline passed.",
    });
    updateFeatureCompactItem(state, "oidc-issuer", {
      status: "error",
      taskId: "compact-feature-oidc-issuer",
      attempts: 1,
      lastSummary:
        "Feature compact live workflow failed for oidc-issuer. Run id 28618848728.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 0 child task(s)");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["compact-feature-oidc-issuer"]).toBeUndefined();
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      blockedWaitChildren: 1,
      representedFeatureKeys: ["oidc-issuer"],
      unrepresentedNonTerminalCount: 0,
      lastPulseCreated: 0,
    });
  });

  test("controller closes recorded terminal compact attempts without unbounded retry", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].context.maxDirectAttemptsPerFeature =
      2;
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "review",
      status: "review",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      result:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      trace: {
        last_worker_result: "partial",
        last_worker_summary:
          "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      },
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 2,
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastSummaryPath: "features/windows/compact/staging.summary.md",
      lastDiagnosticsPath: "features/windows/compact/staging.diagnostics.json",
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Accepted 1 recorded compact package review",
    );
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["compact-feature-windows"].state).toBe("done");
    const loopProgress =
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress;
    expect(loopProgress).toMatchObject({
      completionReady: false,
      openChildren: 0,
      lastPulseCreated: 0,
      retryBudgetExhausted: 1,
      maxDirectAttemptsPerFeature: 2,
    });
    expect(updated.tasks["aks-feature-compact-loop"].children).toHaveLength(2);
    expect(
      updated.tasks["aks-feature-compact-loop"].children.some(
        (childId: string) => childId.startsWith("reconcile-compact-loop-"),
      ),
    ).toBe(true);
  });

  test("controller does not let terminal class followup hide retry-drained feature errors", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].context.maxDirectAttemptsPerFeature =
      2;
    tree.tasks["aks-feature-compact-loop"].children = [
      "reconcile-compact-loop-package-partial",
    ];
    tree.tasks["reconcile-compact-loop-package-partial"] = {
      id: "reconcile-compact-loop-package-partial",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      priority: "P1",
      children: [],
      goal: "Reconcile package-partial compact errors.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Classified current package-partial errors."],
      forbidden: [],
      conflict_scope: ["feature-compact-followup:package-partial"],
      depends_on: [],
      result: "No bounded repo-local repair was found.",
      context: {
        featureCompactFollowup: true,
        errorClass: "package-partial",
        totalFeatureCount: 1,
        sampledFeatureKeys: ["windows"],
        stateRef: ".state/feature-compact-loop/state.json",
        target: "staging",
        branch: "dev",
      },
      trace: {
        reviewed_at: "2026-07-03T00:10:00.000Z",
        review_summary: "Accepted package-partial classification.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      attempts: 2,
      errorClass: "package-partial",
      retryable: true,
      taskId: "compact-feature-windows",
      updatedAt: "2026-07-03T00:00:00.000Z",
      lastSummary:
        "windows compact package remains partial; no live GitHub proof exists.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Created 1 grouped compact repair task");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    const children = updated.tasks["aks-feature-compact-loop"].children;
    const successor = children.find(
      (childId: string) =>
        childId.startsWith("reconcile-compact-loop-package-partial-") &&
        childId !== "reconcile-compact-loop-package-partial",
    );
    expect(successor).toBeTruthy();
    expect(updated.tasks[successor].context).toMatchObject({
      featureCompactFollowup: true,
      errorClass: "package-partial",
      totalFeatureCount: 1,
      sampledFeatureKeys: ["windows"],
    });
  });

  test("controller preserves exact feature summary when terminal planner child is stale generic package gate", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      result:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      trace: {
        last_worker_result: "partial",
        last_worker_summary:
          "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
      },
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "compact-feature-windows",
      attempts: 1,
      retryReason:
        "Either reclassify the listed specs out of reviewed-exception with accepted new evidence, or intentionally change the compact live-ready filter contract to include reviewed-exception members.",
      lastSummary:
        "Feature compact package for windows remains partial because compactEligibility intentionally quarantines reviewed-exception spec.windows.example. Keep the exact blocker-specific summary instead of the generic package-ready placeholder.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    expect(savedState.features.windows.lastSummary).toBe(
      "Feature compact package for windows remains partial because compactEligibility intentionally quarantines reviewed-exception spec.windows.example. Keep the exact blocker-specific summary instead of the generic package-ready placeholder.",
    );
    expect(savedState.features.windows.lastSummary).not.toContain(
      "live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready",
    );
  });

  test("state save does not downgrade a live-proven compact feature", async () => {
    const projectDir = await makeProject();
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state: staleState } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });

    const { state: provenState } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
      refreshFromProject: false,
    });
    updateFeatureCompactItem(provenState, "windows", {
      status: "done",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: "live-aks-proof-v2",
      lastSummary: "Live shared-cluster proof accepted.",
    });
    saveFeatureCompactLoopState(statePath, provenState);

    updateFeatureCompactItem(staleState, "windows", {
      status: "running",
      lastWorkflowRunId: null,
      lastWorkflowRunUrl: null,
      lastLiveProofVersion: null,
      lastSummary: "Stale worker snapshot without live proof.",
    });
    saveFeatureCompactLoopState(statePath, staleState);

    const saved = JSON.parse(await readFile(statePath, "utf8"));
    expect(saved.features.windows).toMatchObject({
      status: "done",
      lastWorkflowRunId: "123",
      lastLiveProofVersion: "live-aks-proof-v2",
    });
  });

  test("project refresh preserves blocked compact feature state", async () => {
    const projectDir = await makeProject();
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "blocked",
      errorClass: "staging-capacity",
      blockerOwner: "operator",
      blockedAt: "2026-07-05T00:00:00.000Z",
      waitingFor: {
        type: "azure.capacity.available",
        target: "staging",
      },
      waitingCondition: "Resume when staging capacity returns.",
      observedBy: {
        workflow: "feature-compact-loop-controller",
      },
      observationMethod: "Recheck capacity on each loop tick.",
      nextCheckAt: "2026-07-05T00:10:00.000Z",
      fallbackAt: "2026-07-05T06:00:00.000Z",
      fallbackAction: "Recheck staging capacity.",
      lastCheckedAt: "2026-07-05T00:00:00.000Z",
    });
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const { state: refreshed } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });

    expect(refreshed.features.windows).toMatchObject({
      status: "blocked",
      errorClass: "staging-capacity",
      blockerOwner: "operator",
      waitingFor: {
        type: "azure.capacity.available",
        target: "staging",
      },
      waitingCondition: "Resume when staging capacity returns.",
      observedBy: {
        workflow: "feature-compact-loop-controller",
      },
      observationMethod: "Recheck capacity on each loop tick.",
      nextCheckAt: "2026-07-05T00:10:00.000Z",
      fallbackAction: "Recheck staging capacity.",
    });
  });

  test("project refresh preserves unchanged feature compact timestamps", async () => {
    const projectDir = await makeProject();
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      attempts: 2,
      lastSummary:
        "Feature compact package for windows is partial; live Azure DevOps pipeline dispatch is intentionally blocked until the package becomes ready.",
    });
    state.features.windows.updatedAt = "2026-01-01T00:00:00.000Z";
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const { state: refreshed } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });

    expect(refreshed.features.windows.updatedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  test("project refresh preserves structured reconciliation metadata", async () => {
    const projectDir = await makeProject();
    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      rootCauseClassification:
        "repo-local-package-ready-live-proof-already-queued",
      ownerReason:
        "Current feature summary already narrowed the frontier to run-artifact review.",
      attemptedFixes: [
        "Recorded the exact queued same-path rerun review boundary.",
      ],
      nextStepClassification:
        "review already-queued same-path run before any rerun decision",
      resumeCondition:
        "Resume only after reviewing the queued workflow artifacts.",
      evidencePaths: ["evidence/archive/example.md"],
      reviewEvidencePath: "evidence/archive/example.md",
      verificationBlocker: "Another duplicate dispatch would be untruthful.",
      summary:
        "Windows compact frontier is already narrowed to queued-run review.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const { state: refreshed } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });

    expect(refreshed.features.windows).toMatchObject({
      rootCauseClassification:
        "repo-local-package-ready-live-proof-already-queued",
      ownerReason:
        "Current feature summary already narrowed the frontier to run-artifact review.",
      attemptedFixes: [
        "Recorded the exact queued same-path rerun review boundary.",
      ],
      nextStepClassification:
        "review already-queued same-path run before any rerun decision",
      resumeCondition:
        "Resume only after reviewing the queued workflow artifacts.",
      evidencePaths: ["evidence/archive/example.md"],
      reviewEvidencePath: "evidence/archive/example.md",
      verificationBlocker: "Another duplicate dispatch would be untruthful.",
      summary:
        "Windows compact frontier is already narrowed to queued-run review.",
    });
  });

  test("controller keeps running feature when recorded Azure DevOps run is active", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const restoreGh = await installCompactPipelineBackend(projectDir);
    const pipelineState = process.env.FAKE_GH_STATE;
    if (!pipelineState) throw new Error("missing fake pipeline state path");
    await writeFile(
      pipelineState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "in_progress",
            conclusion: "",
            url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            createdAt: new Date().toISOString(),
            displayTitle: "AKS RP E2E compact-feature-windows staging",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "running",
      taskId: "compact-feature-windows",
      attempts: 1,
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastSummary: "Live compact workflow is in progress.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).not.toContain("Released 1 stale running");
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      expect(saved.features.windows).toMatchObject({
        status: "running",
        lastWorkflowRunId: "123",
      });
      const updated = JSON.parse(await readFile(treePath, "utf8"));
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
      ).toMatchObject({
        completionReady: false,
        running: 1,
        openChildren: 0,
        unrepresentedNonTerminalCount: 0,
        activePipelineFeatureKeys: ["windows"],
        activePipelineWaits: [
          {
            featureKey: "windows",
            runId: "123",
            runUrl:
              "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            runStatus: "in_progress",
            runTitle: "AKS RP E2E compact-feature-windows staging",
            watchedCondition: "Azure DevOps run 123 reaches completed status",
            expectedArtifact: ".state/feature-compact-loop/artifacts/<runId>/",
            owner: "feature-compact-loop-controller",
          },
        ],
        lastPulseCreated: 0,
      });
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress
          .unrepresentedErrorCount,
      ).toBe(0);
      expect(updated.tasks["compact-feature-windows"]).toBeUndefined();
    } finally {
      restoreGh();
    }
  });

  test("controller treats error rows with active Azure DevOps runs as represented pipeline waits", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    const pipelineState = process.env.FAKE_GH_STATE;
    if (!pipelineState) throw new Error("missing fake pipeline state path");
    await writeFile(
      pipelineState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "in_progress",
            conclusion: "",
            url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            createdAt: new Date().toISOString(),
            displayTitle: "AKS RP E2E compact-feature-windows staging",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      attempts: 1,
      retryable: true,
      lastWorkflowRunId: "123",
      activeWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastSummary:
        "Live compact workflow is still running while the feature row has not been reconciled yet.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      const updated = JSON.parse(await readFile(treePath, "utf8"));
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
      ).toMatchObject({
        completionReady: false,
        unrepresentedNonTerminalCount: 0,
        activePipelineFeatureKeys: ["windows"],
        activePipelineWaits: [
          {
            featureKey: "windows",
            runId: "123",
            runUrl:
              "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            runStatus: "in_progress",
            runTitle: "AKS RP E2E compact-feature-windows staging",
            watchedCondition: "Azure DevOps run 123 reaches completed status",
            expectedArtifact: ".state/feature-compact-loop/artifacts/<runId>/",
            owner: "feature-compact-loop-controller",
          },
        ],
      });
      expect(
        updated.tasks["aks-feature-compact-loop"].context.workflowProgress
          .unrepresentedErrorCount,
      ).toBe(0);
    } finally {
      restoreGh();
    }
  });

  test("controller reconciles completed orphaned Azure DevOps run before releasing running feature", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    const pipelineState = process.env.FAKE_GH_STATE;
    if (!pipelineState) throw new Error("missing fake pipeline state path");
    await writeFile(
      pipelineState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "success",
            url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            createdAt: new Date().toISOString(),
            displayTitle:
              "AKS RP E2E features/windows/compact/staging.plan.json staging",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "running",
      taskId: "compact-feature-windows",
      attempts: 1,
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastSummary:
        "Live compact workflow was dispatched before the task attempt became obsolete.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Reconciled 1 completed Azure DevOps compact",
      );
      expect(result.message).not.toContain("Released 1 stale running");
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      expect(saved.features.windows).toMatchObject({
        status: "done",
        lastWorkflowRunId: "123",
        lastLiveProofVersion: "live-aks-proof-v2",
      });
      expect(saved.features.windows.lastSummary).toContain(
        "Reconciled completed compact Azure DevOps pipeline run 123",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller backfills stale error row from completed Azure DevOps live proof", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    const pipelineState = process.env.FAKE_GH_STATE;
    if (!pipelineState) throw new Error("missing fake pipeline state path");
    await writeFile(
      pipelineState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "success",
            url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            createdAt: new Date().toISOString(),
            displayTitle:
              "AKS RP E2E features/windows/compact/staging.plan.json staging",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      retryable: true,
      attempts: 2,
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: null,
      lastSummary:
        "Feature compact live workflow did not prove a live Azure pass for windows.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Backfilled 1 stale compact error run(s).",
      );
      expect(result.message).toContain("Created 0 child task(s).");
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      expect(saved.features.windows).toMatchObject({
        status: "done",
        attempts: 2,
        lastWorkflowRunId: "123",
        lastLiveProofVersion: "live-aks-proof-v2",
      });
      expect(saved.features.windows.lastSummary).toContain(
        "Backfilled completed compact Azure DevOps pipeline run 123",
      );
    } finally {
      restoreGh();
    }
  });

  test("runtime projection repair rewrites serverless underlay waits and clears replaced shared-wait pointers", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      ...(tree.tasks["aks-feature-compact-loop"].children ?? []),
      "hold-compact-serverless-schedulerctrl-live-workflow-frontier",
      "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      "hold-compact-app-monitoring-live-workflow-frontier",
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    ];
    tree.tasks["hold-compact-serverless-schedulerctrl-live-workflow-frontier"] = {
      id: "hold-compact-serverless-schedulerctrl-live-workflow-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature serverless-schedulerctrl as the compact-facing projection of the shared underlay/runtime-input wait until the named condition changes.",
      inputs: ["feature:serverless-schedulerctrl"],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["wait remains exact"],
      forbidden: [],
      conflict_scope: ["feature-compact:serverless-schedulerctrl"],
      context: {
        featureCompactExactWait: true,
        featureKey: "serverless-schedulerctrl",
        errorClass: "live-workflow",
        target: "staging",
      },
      blocker: {
        condition:
          "Blocked only while the shared underlay/runtime-input family wait remains true because AKS_RP_E2E_UNDERLAY_KUBECONFIG is missing or unusable.",
        category: "external-wait",
        owner: "human",
        waiting_for: {
          featureKey: "serverless-schedulerctrl",
          target: "staging",
          errorClass: "live-workflow",
          scope: "feature-compact",
          type: "publish.auth.ready",
        },
      },
    };
    tree.tasks["wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708"] = {
      id: "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Shared underlay/runtime-input wait.",
      inputs: [],
      outputs: [],
      acceptance: ["shared wait holds"],
      forbidden: [],
      conflict_scope: ["ops:shared-underlay-runtime-input-family"],
      blocker: {
        condition: "Shared underlay wait still active.",
      },
    };
    tree.tasks["hold-compact-app-monitoring-live-workflow-frontier"] = {
      id: "hold-compact-app-monitoring-live-workflow-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Obsolete app-monitoring holder.",
      inputs: [],
      outputs: [],
      acceptance: ["replaced"],
      forbidden: [],
      conflict_scope: ["feature-compact:app-monitoring"],
      context: {
        featureCompactExactWait: true,
        featureKey: "app-monitoring",
        errorClass: "live-workflow",
        acceptance_note:
          "Replaced this duplicate compact app-monitoring environment holder with the existing project-level shared westus2 managed-cluster capacity family wait.",
      },
      resolution: "replaced",
      trace: {
        review_summary:
          "Replaced this duplicate compact app-monitoring environment holder with the existing project-level shared westus2 managed-cluster capacity family wait.",
      },
    };
    tree.tasks["wait-shared-westus2-managed-cluster-capacity-family-return-20260703"] = {
      id: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Shared westus2 capacity wait for compact app-monitoring.",
      inputs: [],
      outputs: [],
      acceptance: ["capacity wait holds"],
      forbidden: [],
      conflict_scope: ["westus2-managed-cluster-capacity-family"],
      blocker: {
        condition:
          "Shared westus2 managed-cluster capacity wait remains active for app-monitoring.",
        waiting_for: {
          type: "azure.capacity.available",
          resource: "managedClusters",
          taskId: "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "serverless-schedulerctrl", {
      status: "blocked",
      errorClass: "live-workflow",
      taskId: "hold-compact-serverless-schedulerctrl-live-workflow-frontier",
      waitingFor: {
        featureKey: "serverless-schedulerctrl",
        target: "staging",
        errorClass: "live-workflow",
        scope: "feature-compact",
        type: "publish.auth.ready",
      },
      waitingCondition:
        "Resume when a working AKS_RP_E2E_UNDERLAY_KUBECONFIG is available.",
      blockedReason:
        "Reviewed run still stops before mutation because AKS_RP_E2E_UNDERLAY_KUBECONFIG is missing or unusable.",
    });
    updateFeatureCompactItem(state, "app-monitoring", {
      status: "blocked",
      errorClass: "live-workflow",
      taskId: "hold-compact-app-monitoring-live-workflow-frontier",
      waitingFor: {
        featureKey: "app-monitoring",
        target: "staging",
        errorClass: "live-workflow",
        scope: "feature-compact",
        type: "azure.capacity.available",
        resource: "managedClusters",
      },
      waitingCondition: "Resume when capacity returns.",
      blockedReason: "Managed-cluster capacity frontier still active.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.taskRepairs).toMatchObject([
      expect.objectContaining({
        taskId: "hold-compact-serverless-schedulerctrl-live-workflow-frontier",
        featureKey: "serverless-schedulerctrl",
        field: "task.owner",
        before: "aks-explorer",
        after: "operator",
      }),
      expect.objectContaining({
        taskId: "hold-compact-serverless-schedulerctrl-live-workflow-frontier",
        featureKey: "serverless-schedulerctrl",
        field: "task.projection",
        before: "human",
        after: "operator",
      }),
      expect.objectContaining({
        taskId: "hold-compact-serverless-schedulerctrl-live-workflow-frontier",
        featureKey: "serverless-schedulerctrl",
        field: "blocker.waiting_for",
        before: {
          featureKey: "serverless-schedulerctrl",
          target: "staging",
          errorClass: "live-workflow",
          scope: "feature-compact",
          type: "publish.auth.ready",
        },
        after: {
          featureKey: "serverless-schedulerctrl",
          target: "staging",
          errorClass: "live-workflow",
          scope: "feature-compact",
          type: "environment.prerequisite.ready",
        },
      }),
    ]);
    expect(
      savedTree.tasks[
        "hold-compact-serverless-schedulerctrl-live-workflow-frontier"
      ].blocker.waiting_for,
    ).toMatchObject({
      type: "environment.prerequisite.ready",
    });
    expect(repair.stateRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureKey: "serverless-schedulerctrl",
          field: "waitingFor",
          before: {
            featureKey: "serverless-schedulerctrl",
            target: "staging",
            errorClass: "live-workflow",
            scope: "feature-compact",
            type: "publish.auth.ready",
          },
          after: {
            featureKey: "serverless-schedulerctrl",
            target: "staging",
            errorClass: "live-workflow",
            scope: "feature-compact",
            type: "environment.prerequisite.ready",
          },
        }),
        expect.objectContaining({
          featureKey: "app-monitoring",
          field: "taskId",
          before: "hold-compact-app-monitoring-live-workflow-frontier",
          after:
            "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
        }),
      ]),
    );
    expect(savedState.features["serverless-schedulerctrl"].waitingFor).toMatchObject({
      type: "environment.prerequisite.ready",
    });
    expect(savedState.features["app-monitoring"].taskId).toBe(
      "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    );
  });

  test("counts blocked compact features with projected frontier tasks as represented", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "features", "node-confidential-vm.yaml"),
      "capabilityId: node-confidential-vm\nstatus: draft\n",
      "utf8",
    );
    await mkdir(join(projectDir, "features", "node-confidential-vm", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "node-confidential-vm", "specs", "kata.json"),
      JSON.stringify({ id: "spec.node-confidential-vm.kata-snp-runtime" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "node-confidential-vm", "specs", "snp.json"),
      JSON.stringify({ id: "spec.node-confidential-vm.snp-pool" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks.project.children = [
      "aks-feature-compact-loop",
      "aks-spec-verification-loop",
    ];
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [];
    tree.tasks["aks-spec-verification-loop"] = {
      id: "aks-spec-verification-loop",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      workflow: "spec-loop-controller",
      priority: "P2",
      children: [
        "hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707",
        "hold-spec-node-confidential-vm-snp-pool-run-28672036322-artifact-visibility-frontier-20260707c",
      ],
      goal: "Verify every single executable spec through the live workflow.",
      inputs: [],
      outputs: [".state/spec-loop/state.json"],
      acceptance: ["Loop is current"],
      forbidden: [],
      conflict_scope: ["spec-loop"],
      depends_on: [],
      context: {},
    };
    tree.tasks["hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707"] = {
      id: "hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707",
      parent_id: "aks-spec-verification-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve spec.node-confidential-vm.kata-snp-runtime as a reviewed nonlive adjacent-hypothesis carrier pending new authoritative confidential-node kata source or explicit reclassification.",
      inputs: [],
      outputs: [],
      acceptance: ["kata exact wait holds"],
      forbidden: [],
      conflict_scope: ["feature:node-confidential-vm", "spec:spec.node-confidential-vm.kata-snp-runtime"],
      depends_on: [],
    };
    tree.tasks["hold-spec-node-confidential-vm-snp-pool-run-28672036322-artifact-visibility-frontier-20260707c"] = {
      id: "hold-spec-node-confidential-vm-snp-pool-run-28672036322-artifact-visibility-frontier-20260707c",
      parent_id: "aks-spec-verification-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact same-run artifact-visibility frontier for spec.node-confidential-vm.snp-pool after terminal run 28672036322.",
      inputs: [],
      outputs: [],
      acceptance: ["snp-pool exact wait holds"],
      forbidden: [],
      conflict_scope: ["feature:node-confidential-vm", "spec:spec.node-confidential-vm.snp-pool"],
      depends_on: [],
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "done",
      lastSummary: "Windows compact proof already accepted.",
      lastWorkflowRunId: "123",
      lastLiveProofVersion: "live-aks-proof-v2",
    });
    updateFeatureCompactItem(state, "node-confidential-vm", {
      status: "blocked",
      errorClass: "reviewed-exception",
      retryable: false,
      taskId: "hold-compact-node-confidential-vm-reviewed-exception-frontier",
      frontierTaskIds: [
        "hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707",
        "hold-spec-node-confidential-vm-snp-pool-run-28672036322-artifact-visibility-frontier-20260707c",
      ],
      retryReason:
        "Resume only if new authoritative confidential-node kata source appears, or if the owner intentionally rehomes or reclassifies spec.node-confidential-vm.kata-snp-runtime.",
      lastSummary:
        "Node-confidential-vm no longer needs broad family-style metadata repair: the only excluded member is the already narrowed adjacent-hypothesis carrier spec.node-confidential-vm.kata-snp-runtime.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      blocked: 1,
      blockedWaitBlockedCount: 0,
      unrepresentedBlockedCount: 0,
      unrepresentedNonTerminalCount: 0,
    });
  });

  test("reprojects stale compact warning-family holders to sharper exact waits", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-compact-node-http-proxy-trusted-ca-quarantine-20260702",
      "wait-compact-machines-agentpool-run-28809049156-review-20260707",
      "wait-compact-ccp-coredns-reviewed-exception-or-filter-change-20260701",
      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
      "hold-compact-aad-rbac-mixed-frontier-20260705b",
      "hold-compact-app-routing-shared-fixture-frontier-20260708",
    ];
    tree.tasks["wait-compact-node-http-proxy-trusted-ca-quarantine-20260702"] = {
      id: "wait-compact-node-http-proxy-trusted-ca-quarantine-20260702",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the exact node-http-proxy trusted-ca branch until the trusted-ca/runtime-input quarantine changes.",
      inputs: [],
      outputs: [],
      acceptance: ["trusted-ca branch stays isolated"],
      conflict_scope: ["feature-compact:node-http-proxy-trusted-ca"],
      context: {
        featureCompactExactWait: true,
        featureKey: "node-http-proxy",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Blocked on the node-http-proxy trusted-ca/runtime-input quarantine after the create/update carrier passed.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "node-http-proxy",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["wait-compact-machines-agentpool-run-28809049156-review-20260707"] = {
      id: "wait-compact-machines-agentpool-run-28809049156-review-20260707",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact same-spec compact rerun result 28809049156 for spec.nap.default-machines-pool-cleanup-no-machine-crud while reviewed-exception siblings stay on the shared family wait.",
      inputs: [],
      outputs: [],
      acceptance: ["same-spec frontier stays isolated"],
      conflict_scope: ["feature:machines-agentpool"],
      context: {
        featureCompactExactWait: true,
        featureKey: "machines-agentpool",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Blocked on exact run 28809049156 review for spec.nap.default-machines-pool-cleanup-no-machine-crud after compact-state writeback preserved this same-spec frontier as the current truthful machines-agentpool carrier.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "machines-agentpool",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["wait-compact-ccp-coredns-reviewed-exception-or-filter-change-20260701"] = {
      id: "wait-compact-ccp-coredns-reviewed-exception-or-filter-change-20260701",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the exact compact wait for ccp-coredns until reviewed-exception members are reclassified or the filter changes.",
      inputs: [],
      outputs: [],
      acceptance: ["ccp-coredns wait stays isolated"],
      conflict_scope: ["feature-compact:ccp-coredns"],
      context: {
        featureCompactExactWait: true,
        featureKey: "ccp-coredns",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Blocked only while spec.ccp-coredns.pdb-disruption-budget and spec.ccp-coredns.upgrade-survival remain reviewed-exception members excluded by the live-ready filter.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "ccp-coredns",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["wait-compact-reviewed-exception-live-ready-policy-family-20260702"] = {
      id: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Represent the shared reviewed-exception/live-ready policy wait for ccp-coredns, machines-agentpool, planned-maintenance, and ossku-migration.",
      inputs: [],
      outputs: [],
      acceptance: ["shared family wait stays visible"],
      conflict_scope: ["feature:ccp-coredns", "feature:machines-agentpool", "feature:planned-maintenance", "feature:ossku-migration"],
      blocker: {
        condition:
          "Blocked only while reviewed-exception members in ccp-coredns, machines-agentpool, planned-maintenance, and ossku-migration remain intentionally excluded from the compact live-ready subset.",
        waiting_for: {
          type: "evidence.available",
          taskId: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        },
      },
    };
    tree.tasks["hold-compact-aad-rbac-mixed-frontier-20260705b"] = {
      id: "hold-compact-aad-rbac-mixed-frontier-20260705b",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve one exact compact mixed-frontier holder for aad-rbac.",
      inputs: [],
      outputs: [],
      acceptance: ["mixed frontier stays visible"],
      conflict_scope: ["feature:compact:aad-rbac"],
      context: {
        featureCompactExactWait: true,
        featureKey: "aad-rbac",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "The active compact frontier now consists only of spec.aad-rbac.azure-rbac-automatic-sku, the managed-v2 lifecycle contradiction, and the current run-command-access wait ceiling. No unchanged compact rerun is justified until one of those residual carriers changes materially.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "aad-rbac",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-app-routing-shared-fixture-frontier-20260708"] = {
      id: "hold-compact-app-routing-shared-fixture-frontier-20260708",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact app-routing shared fixture / split frontier after the internal OSM pair promotion.",
      inputs: [],
      outputs: [],
      acceptance: ["split frontier stays visible"],
      conflict_scope: ["feature:app-routing"],
      context: {
        featureCompactExactWait: true,
        featureKey: "app-routing",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "App-routing remains compact-partial only because the regenerated package truthfully preserves environment-blocked, product-gap, and reviewed-exception members after the OSM internal pair was promoted.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "app-routing",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "node-http-proxy", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-node-http-proxy-package-partial-frontier-202607090544",
      waitingFor: null,
      blockedReason:
        "Create/update current-head rerun 28673740487 already passed; do not regenerate a duplicate create/update review leaf. Exact surviving holder is wait-compact-node-http-proxy-trusted-ca-quarantine-20260702 for the separate trusted-ca quarantine.",
    });
    updateFeatureCompactItem(state, "machines-agentpool", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-machines-agentpool-package-partial-frontier-202607090546",
      waitingFor: "bounded fix or accepted reclassification for the exact preflight blocker surfaced by run 28809049156",
      blockedReason:
        "Rewrite review confirmed the stale runtime package-partial holder broadens the exact same-spec frontier; preserve wait-compact-machines-agentpool-run-28809049156-review-20260707 for spec.nap.default-machines-pool-cleanup-no-machine-crud.",
    });
    updateFeatureCompactItem(state, "ccp-coredns", {
      status: "blocked",
      errorClass: "package-partial",
      taskId: "hold-compact-ccp-coredns-package-partial-frontier",
      waitingFor: {
        featureKey: "ccp-coredns",
        target: "staging",
        errorClass: "package-partial",
        scope: "feature-compact",
        type: "publish.auth.ready",
      },
      blockedReason:
        "The compact package remains partial only because reviewed-exception members stay intentionally quarantined by the live-ready filter.",
    });
    updateFeatureCompactItem(state, "ossku-migration", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-ossku-migration-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Reuse existing shared wait-compact-reviewed-exception-live-ready-policy-family-20260702 for the Mariner-era reviewed-exception member set.",
    });
    updateFeatureCompactItem(state, "planned-maintenance", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-planned-maintenance-package-partial-frontier-202607090546",
      waitingFor: null,
      blockedReason:
        "Broad compact rerun remains untruthful because the only remaining blocker is the residual reviewed-exception pair under the shared live-ready filter wait.",
    });
    updateFeatureCompactItem(state, "aad-rbac", {
      status: "error",
      errorClass: "package-partial",
      taskId: null,
      waitingFor: null,
      blockedReason:
        "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter: spec.aad-rbac.azure-rbac-automatic-sku, spec.aad-rbac.managed-v2-lifecycle, and spec.aad-rbac.run-command-access.",
    });
    updateFeatureCompactItem(state, "app-routing", {
      status: "error",
      errorClass: "package-partial",
      taskId: null,
      waitingFor: null,
      blockedReason:
        "Do not rerun unchanged; current-head package-partial regeneration keeps app-routing partial, but the exact two-spec OSM internal promotion subset is now promoted to live-ready. The remaining live-dispatch blocker is only the residual split frontier.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.stateRepairs).toMatchObject([
        expect.objectContaining({
          featureKey: "node-http-proxy",
          field: "taskId",
          before: "hold-compact-node-http-proxy-package-partial-frontier-202607090544",
          after: "wait-compact-node-http-proxy-trusted-ca-quarantine-20260702",
        }),
        expect.objectContaining({
          featureKey: "machines-agentpool",
          field: "taskId",
          before: "hold-compact-machines-agentpool-package-partial-frontier-202607090546",
          after: "wait-compact-machines-agentpool-run-28809049156-review-20260707",
        }),
        expect.objectContaining({
          featureKey: "ccp-coredns",
          field: "taskId",
          before: "hold-compact-ccp-coredns-package-partial-frontier",
          after: "wait-compact-ccp-coredns-reviewed-exception-or-filter-change-20260701",
        }),
        expect.objectContaining({
          featureKey: "ossku-migration",
          field: "taskId",
          before: "hold-compact-ossku-migration-package-partial-frontier",
          after: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        }),
        expect.objectContaining({
          featureKey: "planned-maintenance",
          field: "taskId",
          before: "hold-compact-planned-maintenance-package-partial-frontier-202607090546",
          after: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        }),
        expect.objectContaining({
          featureKey: "aad-rbac",
          field: "taskId",
          before: null,
          after: "hold-compact-aad-rbac-mixed-frontier-20260705b",
        }),
        expect.objectContaining({
          featureKey: "app-routing",
          field: "taskId",
          before: null,
          after: "hold-compact-app-routing-shared-fixture-frontier-20260708",
        }),
      ],
    );
    expect(savedState.features["node-http-proxy"].taskId).toBe(
      "wait-compact-node-http-proxy-trusted-ca-quarantine-20260702",
    );
    expect(savedState.features["machines-agentpool"].taskId).toBe(
      "wait-compact-machines-agentpool-run-28809049156-review-20260707",
    );
    expect(savedState.features["ccp-coredns"].taskId).toBe(
      "wait-compact-ccp-coredns-reviewed-exception-or-filter-change-20260701",
    );
    expect(savedState.features["ossku-migration"].taskId).toBe(
      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
    );
    expect(savedState.features["planned-maintenance"].taskId).toBe(
      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
    );
    expect(savedState.features["aad-rbac"].taskId).toBe(
      "hold-compact-aad-rbac-mixed-frontier-20260705b",
    );
    expect(savedState.features["app-routing"].taskId).toBe(
      "hold-compact-app-routing-shared-fixture-frontier-20260708",
    );
    expect(savedState.features["aad-rbac"].frontierTaskIds).toBeUndefined();
    expect(savedState.features["app-routing"].frontierTaskIds).toBeUndefined();
  });

  test("reprojects persisted state to exact cross-loop frontier holders for second-batch mixed surfaces", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "aad-rbac", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "egress-lockdown", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "gpu", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "aad-rbac.yaml"),
      "capabilityId: aad-rbac\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "egress-lockdown.yaml"),
      "capabilityId: egress-lockdown\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "gpu.yaml"),
      "capabilityId: gpu\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "aad-rbac", "specs", "auto.json"),
      JSON.stringify({ id: "spec.aad-rbac.azure-rbac-automatic-sku" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "egress-lockdown", "specs", "fips.json"),
      JSON.stringify({ id: "spec.egress-lockdown.fips" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "gpu", "specs", "multi.json"),
      JSON.stringify({ id: "spec.gpu.multi-gpu-workload" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["project"].children = [
      ...(tree.tasks["project"].children ?? []),
      "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    ];
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-aad-rbac-package-partial-frontier",
      "hold-compact-egress-lockdown-package-partial-frontier",
      "hold-compact-gpu-package-partial-frontier",
    ];
    tree.tasks["hold-compact-aad-rbac-package-partial-frontier"] = {
      id: "hold-compact-aad-rbac-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature aad-rbac on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac holder stays visible"],
      conflict_scope: ["feature-compact:aad-rbac"],
      context: {
        featureCompactExactWait: true,
        featureKey: "aad-rbac",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter.",
        waiting_for: {
          type: "pipeline.result.or.artifact.available",
          featureKey: "aad-rbac",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-egress-lockdown-package-partial-frontier"] = {
      id: "hold-compact-egress-lockdown-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature egress-lockdown on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["egress holder stays visible"],
      conflict_scope: ["feature-compact:egress-lockdown"],
      context: {
        featureCompactExactWait: true,
        featureKey: "egress-lockdown",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Compact wait/review holder mapped in review evidence; reuse existing wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702 for spec.egress-lockdown.fips and avoid a duplicate compact passive wait.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "egress-lockdown",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-gpu-package-partial-frontier"] = {
      id: "hold-compact-gpu-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature gpu on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["gpu holder stays visible"],
      conflict_scope: ["feature-compact:gpu"],
      context: {
        featureCompactExactWait: true,
        featureKey: "gpu",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Do not rerun unchanged. Same-day accepted GPU pending reviews already consumed the single-spec multi-gpu rerun lineage and now classify spec.gpu.multi-gpu-workload on a reviewed westus2 GPU SKU environment blocker rather than queued-run review.",
        waiting_for: {
          type: "azure.capacity.available",
          resource: "managedClusters",
          featureKey: "gpu",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702"] = {
      id: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the shared Automatic/ManagedSystem create-time capacity-family blocker for spec.secops-fips.automatic-sku, spec.aad-rbac.azure-rbac-automatic-sku, and spec.workload-identity.automatic-sku.",
      inputs: [],
      outputs: [],
      acceptance: ["shared wait holds"],
      conflict_scope: ["spec:spec.aad-rbac.azure-rbac-automatic-sku", "feature:aad-rbac"],
      blocker: {
        condition: "Automatic/ManagedSystem capacity family still blocked.",
        waiting_for: { type: "azure.capacity.available", taskId: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702" },
      },
    };
    tree.tasks["hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705"] = {
      id: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the row-37 managed AAD lifecycle owner surface.",
      inputs: [],
      outputs: [],
      acceptance: ["row37 wait holds"],
      conflict_scope: ["spec:spec.aad-rbac.managed-v2-lifecycle", "feature:aad-rbac"],
      blocker: {
        condition: "Owner response still required for row-37 contradiction.",
        waiting_for: { type: "evidence.available", taskId: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705" },
      },
    };
    tree.tasks["hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706"] = {
      id: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the run-command-access authorization branch ceiling.",
      inputs: [],
      outputs: [],
      acceptance: ["run-command wait holds"],
      conflict_scope: ["spec:spec.aad-rbac.run-command-access"],
      blocker: {
        condition: "Authorization branch ceiling remains unchanged.",
        waiting_for: { type: "evidence.available", taskId: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706" },
      },
    };
    tree.tasks["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"] = {
      id: "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the exact egress-lockdown FIPS rerun until UDR proof exists.",
      inputs: [],
      outputs: [],
      acceptance: ["egress exact wait holds"],
      conflict_scope: ["spec:spec.egress-lockdown.fips", "feature:egress-lockdown"],
      blocker: {
        condition: "Blocked until exact BYO UDR next-hop/prerequisite proof exists.",
        waiting_for: { type: "evidence.available", taskId: "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702" },
      },
    };
    tree.tasks["wait-spec-gpu-classic-westus2-sku-support-family-return-20260704"] = {
      id: "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Keep one exact blocked holder for classic westus2 GPU SKU support.",
      inputs: [],
      outputs: [],
      acceptance: ["gpu classic wait holds"],
      conflict_scope: ["feature:gpu", "spec:spec.gpu.multi-gpu-workload"],
      blocker: {
        condition: "Classic westus2 GPU SKU support has not returned.",
        waiting_for: { type: "evidence.available", taskId: "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704" },
      },
    };
    tree.tasks["wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708"] = {
      id: "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the shared underlay/runtime-input family wait.",
      inputs: [],
      outputs: [],
      acceptance: ["underlay shared wait holds"],
      conflict_scope: ["feature:gpu", "ops:shared-underlay-runtime-input-family"],
      blocker: {
        condition: "Shared underlay/runtime input family still blocked.",
        waiting_for: { type: "environment.available", taskId: "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708" },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "aad-rbac", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-aad-rbac-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface.",
    });
    updateFeatureCompactItem(state, "egress-lockdown", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-egress-lockdown-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Reuse existing wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702 for spec.egress-lockdown.fips and avoid a duplicate compact passive wait.",
    });
    updateFeatureCompactItem(state, "gpu", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-gpu-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Do not rerun unchanged; owner promotion review or materially changed supported GPU execution surface remains required.",
    });
    updateFeatureCompactItem(state, "localdns", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-localdns-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Do not rerun unchanged; exact LocalDNS split-frontier remains package-partial until the surviving LocalDNS waits materially change.",
    });
    saveFeatureCompactLoopState(statePath, state);

    tree.tasks["wait-localdns-create-http400-residual-family-return-20260704"] = {
      id: "wait-localdns-create-http400-residual-family-return-20260704",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Carry the single truthful LocalDNS create-time HTTP400 family wait.",
      inputs: [],
      outputs: [],
      acceptance: ["localdns create-time wait holds"],
      conflict_scope: ["feature:localdns", "spec-loop-followup:pending:localdns:create-time-http400"],
      blocker: {
        condition: "Blocked until a reviewed material signal changes one of the remaining LocalDNS create-time HTTP400 bounded surfaces.",
        waiting_for: { type: "evidence.available", taskId: "wait-localdns-create-http400-residual-family-return-20260704" },
      },
    };
    tree.tasks["hold-spec-localdns-managed-cluster-quota-family-frontier-20260708"] = {
      id: "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact LocalDNS managed-cluster quota/headroom frontier.",
      inputs: [],
      outputs: [],
      acceptance: ["localdns quota wait holds"],
      conflict_scope: ["feature:localdns"],
      blocker: {
        condition: "Blocked on LocalDNS managed-cluster quota/headroom recovery for the bounded residual carriers.",
        waiting_for: { type: "azure.capacity.available", taskId: "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708", resource: "managedClusters" },
      },
    };
    tree.tasks["hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c"] = {
      id: "hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve one exact blocked holder for spec.network-acns.performance-cilium-upgrade after terminal rerun 28849780940 narrowed the live frontier to the pre-upgrade user-iptables-label assertion missing on two CiliumNode objects.",
      inputs: [],
      outputs: [],
      acceptance: ["network-acns exact wait holds"],
      conflict_scope: ["spec:spec.network-acns.performance-cilium-upgrade:run-28849780940:user-iptables-runtime"],
      blocker: {
        condition: "Terminal rerun 28849780940 proved the repaired LocalDNS/system-pool-size carrier launches, and the remaining exact frontier is the pre-upgrade runtime assertion failure.",
        waiting_for: { type: "environment.available", taskId: "hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c" },
      },
    };

    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.stateRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureKey: "aad-rbac",
          field: "frontierTaskIds",
          after: [
            "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
            "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
            "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
          ],
        }),
        expect.objectContaining({
          featureKey: "egress-lockdown",
          field: "frontierTaskIds",
          after: ["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"],
        }),
        expect.objectContaining({
          featureKey: "gpu",
          field: "frontierTaskIds",
          after: [
            "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
            "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
          ],
        }),
        expect.objectContaining({
          featureKey: "localdns",
          field: "frontierTaskIds",
          after: [
            "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708",
            "wait-localdns-create-http400-residual-family-return-20260704",
          ],
        }),
      ]),
    );
    expect(savedState.features["aad-rbac"].frontierTaskIds).toEqual([
      "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
      "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
      "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
    ]);
    expect(savedState.features["egress-lockdown"].frontierTaskIds).toEqual([
      "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
    ]);
    expect(savedState.features["gpu"].frontierTaskIds).toEqual([
      "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
    ]);
    expect(savedState.features["localdns"].frontierTaskIds).toEqual([
      "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708",
      "wait-localdns-create-http400-residual-family-return-20260704",
    ]);
    expect(savedState.features["aad-rbac"].taskId).toBe(
      "hold-compact-aad-rbac-package-partial-frontier",
    );
    expect(savedState.features["egress-lockdown"].taskId).toBe(
      "hold-compact-egress-lockdown-package-partial-frontier",
    );
  });

  test("controller pulse persists second-batch cross-loop frontier bindings", async () => {
    const projectDir = await makeProject();
    const restoreGh = await installCompactPipelineBackend(projectDir);
    try {
    await mkdir(join(projectDir, "features", "aad-rbac", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "egress-lockdown", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "aad-rbac.yaml"),
      "capabilityId: aad-rbac\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "egress-lockdown.yaml"),
      "capabilityId: egress-lockdown\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "aad-rbac", "specs", "auto.json"),
      JSON.stringify({ id: "spec.aad-rbac.azure-rbac-automatic-sku" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "egress-lockdown", "specs", "fips.json"),
      JSON.stringify({ id: "spec.egress-lockdown.fips" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["project"].children = [
      ...(tree.tasks["project"].children ?? []),
      "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
      "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
      "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
      "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
    ];
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-aad-rbac-package-partial-frontier",
      "hold-compact-egress-lockdown-package-partial-frontier",
    ];
    tree.tasks["hold-compact-aad-rbac-package-partial-frontier"] = {
      id: "hold-compact-aad-rbac-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature aad-rbac on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac holder stays visible"],
      forbidden: [],
      conflict_scope: ["feature-compact:aad-rbac"],
      context: {
        featureCompactExactWait: true,
        featureKey: "aad-rbac",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter.",
        waiting_for: {
          type: "pipeline.result.or.artifact.available",
          featureKey: "aad-rbac",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-egress-lockdown-package-partial-frontier"] = {
      id: "hold-compact-egress-lockdown-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature egress-lockdown on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["egress holder stays visible"],
      forbidden: [],
      conflict_scope: ["feature-compact:egress-lockdown"],
      context: {
        featureCompactExactWait: true,
        featureKey: "egress-lockdown",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Compact wait/review holder mapped in review evidence; reuse existing wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702 for spec.egress-lockdown.fips and avoid a duplicate compact passive wait.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "egress-lockdown",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702"] = {
      id: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the shared Automatic/ManagedSystem create-time capacity-family blocker.",
      inputs: [],
      outputs: [],
      acceptance: ["shared wait holds"],
      forbidden: [],
      conflict_scope: ["spec:spec.aad-rbac.azure-rbac-automatic-sku", "feature:aad-rbac"],
      blocker: {
        condition: "Automatic/ManagedSystem capacity family still blocked.",
        waiting_for: { type: "azure.capacity.available", taskId: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702" },
      },
    };
    tree.tasks["hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705"] = {
      id: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the row-37 managed AAD lifecycle owner surface.",
      inputs: [],
      outputs: [],
      acceptance: ["row37 wait holds"],
      forbidden: [],
      conflict_scope: ["spec:spec.aad-rbac.managed-v2-lifecycle", "feature:aad-rbac"],
      blocker: {
        condition: "Owner response still required for row-37 contradiction.",
        waiting_for: { type: "evidence.available", taskId: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705" },
      },
    };
    tree.tasks["hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706"] = {
      id: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the run-command-access authorization branch ceiling.",
      inputs: [],
      outputs: [],
      acceptance: ["run-command wait holds"],
      forbidden: [],
      conflict_scope: ["spec:spec.aad-rbac.run-command-access"],
      blocker: {
        condition: "Authorization branch ceiling remains unchanged.",
        waiting_for: { type: "evidence.available", taskId: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706" },
      },
    };
    tree.tasks["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"] = {
      id: "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the exact egress-lockdown FIPS rerun until UDR proof exists.",
      inputs: [],
      outputs: [],
      acceptance: ["egress exact wait holds"],
      forbidden: [],
      conflict_scope: ["spec:spec.egress-lockdown.fips", "feature:egress-lockdown"],
      blocker: {
        condition: "Blocked until exact BYO UDR next-hop/prerequisite proof exists.",
        waiting_for: { type: "evidence.available", taskId: "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702" },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "aad-rbac", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-aad-rbac-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface.",
    });
    updateFeatureCompactItem(state, "egress-lockdown", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-egress-lockdown-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Reuse existing wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702 for spec.egress-lockdown.fips and avoid a duplicate compact passive wait.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const saved = JSON.parse(await readFile(statePath, "utf8"));
    expect(saved.features["aad-rbac"].frontierTaskIds).toEqual([
      "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
      "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
      "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
    ]);
    expect(saved.features["egress-lockdown"].frontierTaskIds).toEqual([
      "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
    ]);
    } finally {
      restoreGh();
    }
  });

  test("reconcile filters durable loop ids and aligns exact holder owner metadata", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "rp-nodepool-lifecycle", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "rp-nodepool-lifecycle.yaml"),
      "capabilityId: rp-nodepool-lifecycle\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "rp-nodepool-lifecycle", "specs", "add-remove.json"),
      JSON.stringify({ id: "spec.rp-nodepool-lifecycle.add-remove" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["project"].children = [
      ...(tree.tasks["project"].children ?? []),
      "aks-spec-verification-loop",
      "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707",
    ];
    tree.tasks["aks-spec-verification-loop"] = {
      id: "aks-spec-verification-loop",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "ops_loop",
      priority: "P1",
      owner: "aks-explorer",
      children: [],
      workflow: "spec-loop-controller",
      goal: "Keep spec verification represented.",
      inputs: [],
      outputs: [".state/spec-loop/state.json"],
      acceptance: ["loop remains represented"],
      conflict_scope: ["loop:spec-verification"],
      context: {
        workflowProgress: {
          completionReady: false,
        },
      },
      blocker: {
        condition: "Spec loop is blocked-only stewardship.",
        waiting_for: { type: "compact.frontier.changed" },
      },
    };
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-rp-nodepool-lifecycle-package-partial-frontier",
      "hold-compact-node-http-proxy-package-partial-frontier",
      "hold-compact-aad-rbac-package-partial-frontier",
    ];
    tree.tasks["hold-compact-rp-nodepool-lifecycle-package-partial-frontier"] = {
      id: "hold-compact-rp-nodepool-lifecycle-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P1",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature rp-nodepool-lifecycle on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["holder stays visible"],
      conflict_scope: ["feature-compact:rp-nodepool-lifecycle", "feature:rp-nodepool-lifecycle"],
      context: {
        featureCompactExactWait: true,
        featureKey: "rp-nodepool-lifecycle",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Current-head package-partial regeneration retires the older mixed five-member review wording. Four source-grounded carriers now classify as execute-ready-promotion-candidate, while rollback remains an accepted environment-only wait. Do not rerun unchanged.",
        owner: "product-owner",
        waiting_for: {
          type: "owner.decision",
          featureKey: "rp-nodepool-lifecycle",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707"] = {
      id: "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact rollback environment frontier.",
      inputs: [],
      outputs: [],
      acceptance: ["rollback wait holds"],
      conflict_scope: ["feature:rp-nodepool-lifecycle", "spec:spec.rp-nodepool-lifecycle.rollback"],
      blocker: {
        condition: "Rollback remains environment blocked.",
        waiting_for: { type: "environment.available", taskId: "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707" },
      },
    };
    tree.tasks["hold-compact-node-http-proxy-package-partial-frontier"] = {
      id: "hold-compact-node-http-proxy-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P1",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature node-http-proxy only as represented split-frontier state while its remaining trusted-ca carrier stays preserved by the exact downstream human owner-decision wait, without reopening an unchanged broad compact rerun.",
      inputs: [],
      outputs: [],
      acceptance: ["holder stays visible"],
      conflict_scope: ["feature-compact:node-http-proxy", "feature:node-http-proxy"],
      context: {
        featureCompactExactWait: true,
        featureKey: "node-http-proxy",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Create/update current-head rerun 28673740487 already passed; do not regenerate a duplicate create/update review leaf. The compact feature now remains partial only as represented state for spec.node-http-proxy.trusted-ca, whose exact surviving blocker is wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 after durable send-proof and the 2026-07-09 second-contact chase. This holder does not ask for a generic environment diagnosis family; it only preserves the trusted-ca owner-decision branch until human:operator approves a source-shaped redesign, declines to one exact runtime-input wait, or reroutes the decision surface.",
        owner: "human",
        waiting_for: {
          type: "environment.prerequisite.ready",
          featureKey: "node-http-proxy",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-aad-rbac-package-partial-frontier"] = {
      id: "hold-compact-aad-rbac-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature aad-rbac on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac holder stays visible"],
      conflict_scope: ["feature-compact:aad-rbac"],
      context: {
        featureCompactExactWait: true,
        featureKey: "aad-rbac",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter.",
        owner: "operator",
        waiting_for: {
          type: "pipeline.result.or.artifact.available",
          featureKey: "aad-rbac",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702"] = {
      id: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the shared Automatic/ManagedSystem create-time capacity-family blocker.",
      inputs: [],
      outputs: [],
      acceptance: ["shared wait holds"],
      conflict_scope: ["spec:spec.aad-rbac.azure-rbac-automatic-sku", "feature:aad-rbac"],
      blocker: {
        condition: "Automatic/ManagedSystem capacity family still blocked.",
        waiting_for: { type: "azure.capacity.available", taskId: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702" },
      },
    };
    tree.tasks["hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705"] = {
      id: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the row-37 managed AAD lifecycle owner surface.",
      inputs: [],
      outputs: [],
      acceptance: ["row37 wait holds"],
      conflict_scope: ["spec:spec.aad-rbac.managed-v2-lifecycle", "feature:aad-rbac"],
      blocker: {
        condition: "Owner response still required for row-37 contradiction.",
        waiting_for: { type: "evidence.available", taskId: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705" },
      },
    };
    tree.tasks["hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706"] = {
      id: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the run-command-access authorization branch ceiling.",
      inputs: [],
      outputs: [],
      acceptance: ["run-command wait holds"],
      conflict_scope: ["spec:spec.aad-rbac.run-command-access"],
      blocker: {
        condition: "Authorization branch ceiling remains unchanged.",
        waiting_for: { type: "evidence.available", taskId: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706" },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(projectDir, ".state", "feature-compact-loop", "state.json");
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "rp-nodepool-lifecycle", {
      status: "error",
      errorClass: "package-partial",
      taskId: null,
      frontierTaskIds: [
        "aks-feature-compact-loop",
        "aks-spec-verification-loop",
        "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707",
      ],
      waitingFor: null,
      blockedReason:
        "Current-head package-partial regeneration retires the older mixed five-member review wording. Four source-grounded carriers now classify as execute-ready-promotion-candidate, while rollback remains an accepted environment-only wait. Do not rerun unchanged.",
    });
    updateFeatureCompactItem(state, "node-http-proxy", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-node-http-proxy-package-partial-frontier",
      frontierTaskIds: ["aks-feature-compact-loop"],
      waitingFor: null,
      blockedReason:
        "Create/update current-head rerun 28673740487 already passed; do not regenerate a duplicate create/update review leaf. The compact feature now remains partial only as represented state for spec.node-http-proxy.trusted-ca, whose exact surviving blocker is wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 after durable send-proof and the 2026-07-09 second-contact chase. This holder does not ask for a generic environment diagnosis family; it only preserves the trusted-ca owner-decision branch until human:operator approves a source-shaped redesign, declines to one exact runtime-input wait, or reroutes the decision surface.",
    });
    updateFeatureCompactItem(state, "aad-rbac", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-aad-rbac-package-partial-frontier",
      waitingFor: null,
      blockedReason:
        "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.stateRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureKey: "rp-nodepool-lifecycle",
          field: "frontierTaskIds",
          before: [
            "aks-feature-compact-loop",
            "aks-spec-verification-loop",
            "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707",
          ],
          after: [
            "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707",
          ],
        }),
      ]),
    );
    expect(savedState.features["rp-nodepool-lifecycle"].frontierTaskIds).toEqual([
      "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707",
    ]);
    expect(repair.stateRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureKey: "rp-nodepool-lifecycle",
          field: "taskId",
          before: null,
          after: "hold-compact-rp-nodepool-lifecycle-package-partial-frontier",
        }),
      ]),
    );
    expect(savedState.features["rp-nodepool-lifecycle"].taskId).toBe(
      "hold-compact-rp-nodepool-lifecycle-package-partial-frontier",
    );
    expect(savedTree.tasks["hold-compact-node-http-proxy-package-partial-frontier"].owner).toBe(
      "product-owner",
    );
    expect(
      savedTree.tasks["hold-compact-node-http-proxy-package-partial-frontier"].blocker.owner,
    ).toBe("product-owner");
    expect(
      savedTree.tasks["hold-compact-node-http-proxy-package-partial-frontier"].blocker.waiting_for,
    ).toEqual({
      featureKey: "node-http-proxy",
      target: "staging",
      errorClass: "package-partial",
      scope: "feature-compact",
      type: "owner.decision",
    });
    expect(savedTree.tasks["hold-compact-aad-rbac-package-partial-frontier"].owner).toBe(
      "aks-explorer",
    );
    expect(
      savedTree.tasks["hold-compact-aad-rbac-package-partial-frontier"].blocker.owner,
    ).toBe("aks-explorer");
    expect(
      savedTree.tasks["hold-compact-aad-rbac-package-partial-frontier"].blocker.waiting_for,
    ).toEqual({
      featureKey: "aad-rbac",
      target: "staging",
      errorClass: "package-partial",
      scope: "feature-compact",
      type: "compact.frontier.changed",
    });
  });

  test("controller pulse does not recreate package-partial holders when state already projects to shared or cross-loop waits", async () => {
    const projectDir = await makeProject();
    const restoreGh = await installCompactPipelineBackend(projectDir);
    try {
      await mkdir(join(projectDir, "features", "ossku-migration", "specs"), {
        recursive: true,
      });
      await mkdir(join(projectDir, "features", "planned-maintenance", "specs"), {
        recursive: true,
      });
      await mkdir(join(projectDir, "features", "egress-lockdown", "specs"), {
        recursive: true,
      });
      await writeFile(
        join(projectDir, "features", "ossku-migration.yaml"),
        "capabilityId: ossku-migration\nstatus: draft\n",
        "utf8",
      );
      await writeFile(
        join(projectDir, "features", "planned-maintenance.yaml"),
        "capabilityId: planned-maintenance\nstatus: draft\n",
        "utf8",
      );
      await writeFile(
        join(projectDir, "features", "egress-lockdown.yaml"),
        "capabilityId: egress-lockdown\nstatus: draft\n",
        "utf8",
      );
      await writeFile(
        join(projectDir, "features", "ossku-migration", "specs", "mariner.json"),
        JSON.stringify({ id: "spec.ossku-migration.mariner-era" }),
        "utf8",
      );
      await writeFile(
        join(projectDir, "features", "planned-maintenance", "specs", "api.json"),
        JSON.stringify({ id: "spec.planned-maintenance.autoupgrade-scheduling-api-lifecycle" }),
        "utf8",
      );
      await writeFile(
        join(projectDir, "features", "egress-lockdown", "specs", "fips.json"),
        JSON.stringify({ id: "spec.egress-lockdown.fips" }),
        "utf8",
      );
      await writeRootTree(projectDir);
      const treePath = resolveTaskTreePath(projectDir);
      const tree = JSON.parse(await readFile(treePath, "utf8"));
      tree.tasks["project"].children = [
        ...(tree.tasks["project"].children ?? []),
        "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
      ];
      tree.tasks["aks-feature-compact-loop"].state = "active";
      tree.tasks["aks-feature-compact-loop"].status = "active";
      tree.tasks["aks-feature-compact-loop"].children = [
        "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
      ];
      tree.tasks["wait-compact-reviewed-exception-live-ready-policy-family-20260702"] = {
        id: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        parent_id: "aks-feature-compact-loop",
        state: "blocked",
        status: "blocked",
        kind: "domain_leaf",
        priority: "P2",
        owner: "aks-explorer",
        children: [],
        goal: "Represent the shared reviewed-exception/live-ready policy wait for planned-maintenance and ossku-migration.",
        inputs: [],
        outputs: [],
        acceptance: ["shared wait holds"],
        forbidden: [],
        conflict_scope: [
          "feature:planned-maintenance",
          "feature:ossku-migration",
        ],
        blocker: {
          condition:
            "Blocked only while reviewed-exception members in planned-maintenance and ossku-migration remain intentionally excluded from the compact live-ready subset.",
          waiting_for: {
            type: "evidence.available",
            taskId: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
          },
        },
      };
      tree.tasks["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"] = {
        id: "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
        parent_id: "project",
        state: "blocked",
        status: "blocked",
        kind: "domain_leaf",
        priority: "P2",
        owner: "aks-explorer",
        children: [],
        goal: "Hold the exact egress-lockdown FIPS rerun until UDR proof exists.",
        inputs: [],
        outputs: [],
        acceptance: ["egress exact wait holds"],
        forbidden: [],
        conflict_scope: ["spec:spec.egress-lockdown.fips", "feature:egress-lockdown"],
        blocker: {
          condition: "Blocked until exact BYO UDR next-hop/prerequisite proof exists.",
          waiting_for: {
            type: "evidence.available",
            taskId: "wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702",
          },
        },
      };
      await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

      const statePath = join(
        projectDir,
        ".state",
        "feature-compact-loop",
        "state.json",
      );
      const { state } = loadFeatureCompactLoopState({
        appDir: projectDir,
        projectDir,
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 1,
        statePath,
      });
      updateFeatureCompactItem(state, "ossku-migration", {
        status: "error",
        errorClass: "package-partial",
        taskId: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        blockedReason:
          "Reuse existing shared wait-compact-reviewed-exception-live-ready-policy-family-20260702 for the Mariner-era reviewed-exception member set.",
      });
      updateFeatureCompactItem(state, "planned-maintenance", {
        status: "error",
        errorClass: "package-partial",
        taskId: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        blockedReason:
          "Broad compact rerun remains untruthful because the only remaining blocker is the residual reviewed-exception pair under the shared live-ready filter wait.",
      });
      updateFeatureCompactItem(state, "egress-lockdown", {
        status: "error",
        errorClass: "package-partial",
        taskId: "hold-compact-egress-lockdown-package-partial-frontier",
        frontierTaskIds: ["wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702"],
        blockedReason:
          "Reuse existing wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702 for spec.egress-lockdown.fips and avoid a duplicate compact passive wait.",
      });
      saveFeatureCompactLoopState(statePath, state);

      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      const savedTree = JSON.parse(await readFile(treePath, "utf8"));
      expect(savedTree.tasks["hold-compact-ossku-migration-package-partial-frontier"]).toBeUndefined();
      expect(savedTree.tasks["hold-compact-planned-maintenance-package-partial-frontier"]).toBeUndefined();
      expect(savedTree.tasks["hold-compact-egress-lockdown-package-partial-frontier"]).toBeUndefined();

      const progress = savedTree.tasks["aks-feature-compact-loop"].context.workflowProgress;
      expect(progress.representedFeatureKeys).toEqual(
        expect.arrayContaining([
          "ossku-migration",
          "planned-maintenance",
          "egress-lockdown",
        ]),
      );
    } finally {
      restoreGh();
    }
  });

  test("repairs runtime backbinding for the current warning-family survivors", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "gpu", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "cluster-autoscaler", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "planned-maintenance", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "ccp-coredns", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "ossku-migration", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "gpu.yaml"),
      "capabilityId: gpu\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "cluster-autoscaler.yaml"),
      "capabilityId: cluster-autoscaler\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "planned-maintenance.yaml"),
      "capabilityId: planned-maintenance\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "ccp-coredns.yaml"),
      "capabilityId: ccp-coredns\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "ossku-migration.yaml"),
      "capabilityId: ossku-migration\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "gpu", "specs", "multi.json"),
      JSON.stringify({ id: "spec.gpu.multi-gpu-workload" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "cluster-autoscaler", "specs", "vm.json"),
      JSON.stringify({ id: "spec.cluster-autoscaler.vm-prerelease-spot-reference" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "planned-maintenance", "specs", "api.json"),
      JSON.stringify({ id: "spec.planned-maintenance.autoupgrade-scheduling-api-lifecycle" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "ccp-coredns", "specs", "pdb.json"),
      JSON.stringify({ id: "spec.ccp-coredns.pdb-disruption-budget" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "ossku-migration", "specs", "mariner.json"),
      JSON.stringify({ id: "spec.ossku-migration.mariner-era" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["project"].children = [
      ...(tree.tasks["project"].children ?? []),
      "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      "wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709",
    ];
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
      "hold-compact-gpu-package-partial-frontier",
      "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
    ];
    tree.tasks["hold-compact-gpu-package-partial-frontier"] = {
      id: "hold-compact-gpu-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      resolution: "replaced",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature gpu on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["gpu holder replaced"],
      conflict_scope: ["feature-compact:gpu", "feature:gpu"],
      context: {
        featureCompactExactWait: true,
        featureKey: "gpu",
        errorClass: "package-partial",
        target: "staging",
        acceptance_note:
          "Replaced the generic compact gpu package-partial/environment holder with the two existing exact shared waits identified by the accepted repair memo: wait-spec-gpu-classic-westus2-sku-support-family-return-20260704 now owns spec.gpu.multi-gpu-workload and wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708 continues to own the vm-prerelease underlay carrier.",
      },
    };
    tree.tasks["hold-compact-cluster-autoscaler-package-partial-frontier-202607090657"] = {
      id: "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      resolution: "replaced",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact seven-member cluster-autoscaler accepted-environment-blocked compact frontier without reopening an unchanged broad compact rerun.",
      inputs: [],
      outputs: [],
      acceptance: ["cluster-autoscaler holder replaced"],
      conflict_scope: ["feature-compact:cluster-autoscaler", "feature:cluster-autoscaler"],
      context: {
        featureCompactExactWait: true,
        featureKey: "cluster-autoscaler",
        errorClass: "package-partial",
        target: "staging",
        acceptance_note:
          "Replaced by wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709 after the accepted audit verified cluster-autoscaler no longer needs a broad compact package-partial holder.",
      },
    };
    tree.tasks["wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709"] = {
      id: "wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709",
      parent_id: "project",
      state: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve one exact compact-facing blocked carrier for the accepted cluster-autoscaler VM-prerelease environment-blocked seven-member frontier so compact cluster-autoscaler can reference the real exact waits without restoring the retired broad package-partial holder or reopening unchanged reruns.",
      inputs: [],
      outputs: [],
      acceptance: ["cluster-autoscaler compact-facing carrier survives"],
      conflict_scope: ["feature-compact:cluster-autoscaler"],
      blocker: {
        condition:
          "Blocked only while the accepted cluster-autoscaler VM-prerelease environment-blocked frontier remains represented by exact downstream carriers.",
        waiting_for: {
          type: "environment.available",
          taskId: "wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709",
        },
      },
    };
    tree.tasks["wait-compact-reviewed-exception-live-ready-policy-family-20260702"] = {
      id: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Represent the shared residual reviewed-exception/live-ready policy wait for ccp-coredns, planned-maintenance, and ossku-migration.",
      inputs: [],
      outputs: [],
      acceptance: ["shared reviewed-exception wait survives"],
      conflict_scope: [
        "feature:ccp-coredns",
        "feature:planned-maintenance",
        "feature:ossku-migration",
      ],
      blocker: {
        condition:
          "Blocked only while residual reviewed-exception members in ccp-coredns, planned-maintenance, and ossku-migration remain intentionally excluded from the compact live-ready subset.",
        waiting_for: {
          type: "evidence.available",
          taskId: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        },
      },
    };
    tree.tasks["wait-spec-gpu-classic-westus2-sku-support-family-return-20260704"] = {
      id: "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
      parent_id: "project",
      state: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Keep one exact blocked holder for classic westus2 GPU SKU support.",
      inputs: [],
      outputs: [],
      acceptance: ["gpu classic wait survives"],
      conflict_scope: ["feature:gpu", "spec:spec.gpu.multi-gpu-workload"],
      blocker: {
        condition: "Classic westus2 GPU SKU support has not returned.",
        waiting_for: {
          type: "evidence.available",
          taskId: "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
        },
      },
    };
    tree.tasks["wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708"] = {
      id: "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      parent_id: "project",
      state: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the single shared underlay/runtime-input family wait for GPU VM-prerelease provisioner and other unchanged carriers.",
      inputs: [],
      outputs: [],
      acceptance: ["shared underlay wait survives"],
      conflict_scope: ["ops:shared-underlay-runtime-input-family", "feature:gpu"],
      blocker: {
        condition: "Shared underlay/runtime input family still blocked.",
        waiting_for: {
          type: "environment.available",
          taskId: "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(projectDir, ".state", "feature-compact-loop", "state.json");
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "gpu", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-gpu-package-partial-frontier",
      frontierTaskIds: ["wait-spec-gpu-classic-westus2-sku-support-family-return-20260704"],
      retryReason:
        "Do not rerun unchanged. Same-day accepted GPU pending reviews already consumed the single-spec multi-gpu rerun lineage and now classify spec.gpu.multi-gpu-workload on a reviewed westus2 GPU SKU environment blocker rather than queued-run review.",
      resumeCondition:
        "Resume only if accepted evidence promotes or reclassifies spec.gpu.multi-gpu-workload for compact live-readiness, or if an owner-approved same-contract GPU execution surface materially changes.",
    });
    updateFeatureCompactItem(state, "cluster-autoscaler", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
      retryReason:
        "Do not broad-rerun cluster-autoscaler unchanged. The published current-head compact package still regenerates as partial with one exact accepted-environment-blocked seven-member frontier.",
      resumeCondition:
        "Resume only if accepted evidence materially changes one of the seven accepted-environment-blocked members.",
    });
    updateFeatureCompactItem(state, "planned-maintenance", {
      status: "error",
      errorClass: "package-partial",
      taskId: null,
      retryReason:
        "Broad compact rerun remains untruthful because the only remaining blocker is the residual reviewed-exception pair under the shared live-ready filter wait.",
    });
    updateFeatureCompactItem(state, "ccp-coredns", {
      status: "blocked",
      errorClass: "package-partial",
      taskId: null,
      waitingFor: {
        featureKey: "ccp-coredns",
        target: "staging",
        errorClass: "package-partial",
        scope: "feature-compact",
        type: "publish.auth.ready",
      },
      blockedReason:
        "The compact package remains partial only because reviewed-exception members stay intentionally quarantined by the live-ready filter.",
    });
    updateFeatureCompactItem(state, "ossku-migration", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-ossku-migration-package-partial-frontier",
      retryReason:
        "Compact wait/review holder mapped in evidence; reuse existing shared wait-compact-reviewed-exception-live-ready-policy-family-20260702 for the Mariner-era reviewed-exception member set.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });
    saveTaskTreeWithKanbanSnapshot(config(projectDir), savedTree);
    saveFeatureCompactLoopState(statePath, savedState);

    expect(repair.stateRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureKey: "cluster-autoscaler",
          field: "taskId",
          before: "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
          after: "wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709",
        }),
        expect.objectContaining({
          featureKey: "planned-maintenance",
          field: "taskId",
          before: null,
          after: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        }),
        expect.objectContaining({
          featureKey: "ccp-coredns",
          field: "taskId",
          before: null,
          after: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        }),
        expect.objectContaining({
          featureKey: "ossku-migration",
          field: "taskId",
          before: "hold-compact-ossku-migration-package-partial-frontier",
          after: "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        }),
      ]),
    );
    expect(savedState.features["cluster-autoscaler"].taskId).toBe(
      "wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709",
    );
    expect(savedState.features["planned-maintenance"].taskId).toBe(
      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
    );
    expect(savedState.features["ccp-coredns"].taskId).toBe(
      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
    );
    expect(savedState.features["ossku-migration"].taskId).toBe(
      "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
    );
    expect(savedState.features["gpu"].taskId).toBeNull();
    expect(savedState.features["gpu"].frontierTaskIds).toEqual([
      "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
      "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704",
    ]);
  });

  test("backfills owner on surviving blank-owner exact compact holders without changing blocker links", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-app-routing-package-partial-frontier-202607090657",
      "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
    ];
    tree.tasks["hold-compact-app-routing-package-partial-frontier-202607090657"] = {
      id: "hold-compact-app-routing-package-partial-frontier-202607090657",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P1",
      owner: "",
      children: [],
      goal: "Preserve the exact app-routing mixed residual compact frontier without reopening an unchanged broad compact rerun.",
      inputs: [],
      outputs: [],
      acceptance: ["app-routing holder stays visible"],
      conflict_scope: ["feature-compact:app-routing", "feature:app-routing"],
      context: {
        featureCompactExactWait: true,
        featureKey: "app-routing",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Do not rerun unchanged; current-head package-partial regeneration keeps app-routing partial, but the exact two-spec OSM internal promotion subset is now promoted to live-ready. The remaining live-dispatch blocker is only the residual split frontier: four accepted environment-blocked members, one accepted product-gap member, and four reviewed-exception members.",
        owner: "product-owner",
        waiting_for: {
          type: "owner.decision",
          featureKey: "app-routing",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-cluster-autoscaler-package-partial-frontier-202607090657"] = {
      id: "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P1",
      owner: "",
      children: [],
      goal: "Preserve the exact seven-member cluster-autoscaler accepted-environment-blocked compact frontier without reopening an unchanged broad compact rerun.",
      inputs: [],
      outputs: [],
      acceptance: ["cluster-autoscaler holder stays visible"],
      conflict_scope: ["feature-compact:cluster-autoscaler", "feature:cluster-autoscaler"],
      context: {
        featureCompactExactWait: true,
        featureKey: "cluster-autoscaler",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Do not broad-rerun cluster-autoscaler unchanged. The published current-head compact package still regenerates as partial with one exact accepted-environment-blocked seven-member frontier, so broad live dispatch remains untruthful until that frontier materially changes or the compact live-ready filter contract is intentionally changed.",
        owner: "aks-explorer",
        waiting_for: {
          type: "pipeline.result.or.artifact.available",
          featureKey: "cluster-autoscaler",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "app-routing", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-app-routing-package-partial-frontier-202607090657",
      waitingFor: {
        type: "owner.decision",
        featureKey: "app-routing",
        target: "staging",
        errorClass: "package-partial",
        scope: "feature-compact",
      },
      blockedReason:
        "Do not rerun unchanged; current-head package-partial regeneration keeps app-routing partial, but the remaining live-dispatch blocker is only the residual split frontier.",
    });
    updateFeatureCompactItem(state, "cluster-autoscaler", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
      waitingFor: {
        type: "pipeline.result.or.artifact.available",
        featureKey: "cluster-autoscaler",
        target: "staging",
        errorClass: "package-partial",
        scope: "feature-compact",
      },
      blockedReason:
        "Do not broad-rerun cluster-autoscaler unchanged; the package still regenerates as partial with one exact accepted-environment-blocked seven-member frontier.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const appRoutingWaitingForBefore = JSON.parse(
      JSON.stringify(
        savedTree.tasks[
          "hold-compact-app-routing-package-partial-frontier-202607090657"
        ].blocker.waiting_for,
      ),
    );
    const clusterAutoscalerWaitingForBefore = JSON.parse(
      JSON.stringify(
        savedTree.tasks[
          "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657"
        ].blocker.waiting_for,
      ),
    );
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.taskRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "hold-compact-app-routing-package-partial-frontier-202607090657",
          featureKey: "app-routing",
          field: "task.owner",
          before: "",
          after: "product-owner",
        }),
        expect.objectContaining({
          taskId: "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
          featureKey: "cluster-autoscaler",
          field: "task.owner",
          before: "",
          after: "aks-explorer",
        }),
      ]),
    );
    expect(savedTree.tasks["hold-compact-app-routing-package-partial-frontier-202607090657"].owner).toBe(
      "product-owner",
    );
    expect(savedTree.tasks["hold-compact-cluster-autoscaler-package-partial-frontier-202607090657"].owner).toBe(
      "aks-explorer",
    );
    expect(
      savedTree.tasks[
        "hold-compact-app-routing-package-partial-frontier-202607090657"
      ].blocker.owner,
    ).toBe("product-owner");
    expect(
      savedTree.tasks[
        "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657"
      ].blocker.owner,
    ).toBe("aks-explorer");
    expect(
      savedTree.tasks[
        "hold-compact-app-routing-package-partial-frontier-202607090657"
      ].blocker.waiting_for,
    ).toEqual(appRoutingWaitingForBefore);
    expect(
      savedTree.tasks[
        "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657"
      ].blocker.waiting_for,
    ).toEqual(clusterAutoscalerWaitingForBefore);
    expect(savedState.features["app-routing"].taskId).toBe(
      "hold-compact-app-routing-package-partial-frontier-202607090657",
    );
    expect(savedState.features["cluster-autoscaler"].taskId).toBe(
      "hold-compact-cluster-autoscaler-package-partial-frontier-202607090657",
    );
  });

  test("aligns compact owner-decision holder watch windows to represented downstream owner-decision lineages", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-aad-rbac-package-partial-frontier",
      "hold-compact-defender-profile-reviewed-exception-frontier",
      "hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier",
    ];
    tree.tasks["hold-compact-aad-rbac-package-partial-frontier"] = {
      id: "hold-compact-aad-rbac-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "operator",
      children: [],
      goal: "Hold compact feature aad-rbac on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac holder stays visible"],
      conflict_scope: ["feature-compact:aad-rbac", "feature:aad-rbac"],
      context: {
        featureCompactExactWait: true,
        featureKey: "aad-rbac",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter. Resume only when one of the preserved reviewed-exception branches changes materially.",
        waiting_for: {
          featureKey: "aad-rbac",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
          type: "owner.decision",
        },
        next_check_at: "2026-07-09T04:22:20.953Z",
        fallback_at: "2026-07-10T03:52:20.953Z",
      },
    };
    tree.tasks["hold-compact-defender-profile-reviewed-exception-frontier"] = {
      id: "hold-compact-defender-profile-reviewed-exception-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "operator",
      children: [],
      goal: "Hold compact feature defender-profile on exact reviewed-exception wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["defender-profile holder stays visible"],
      conflict_scope: ["feature-compact:defender-profile", "feature:defender-profile"],
      context: {
        featureCompactExactWait: true,
        featureKey: "defender-profile",
        errorClass: "reviewed-exception",
        target: "staging",
      },
      blocker: {
        condition:
          "Do not regenerate a generic compact-error repair leaf. The current truthful next review step is the accepted owner-promotion note evidence/archive/review-compact-defender-profile-promotion-frontier-20260704.md; compact eligibility still depends on owner promotion or explicit reclassification under the accepted request-plus-runtime floor.",
        waiting_for: {
          featureKey: "defender-profile",
          target: "staging",
          errorClass: "reviewed-exception",
          scope: "feature-compact",
          type: "owner.decision",
        },
        next_check_at: "2026-07-10T18:30:00Z",
        fallback_at: "2026-07-11T18:30:00Z",
      },
    };
    tree.tasks["hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier"] = {
      id: "hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "operator",
      children: [],
      goal: "Hold compact feature ccp-security-patch-os-variants only as a represented split-frontier carrier while the exact represented blocker remains wait-ccp-security-patch-reviewed-exception-owner-response-20260708.",
      inputs: [],
      outputs: [],
      acceptance: ["ccp holder stays visible"],
      conflict_scope: [
        "feature-compact:ccp-security-patch-os-variants",
        "feature:ccp-security-patch-os-variants",
      ],
      context: {
        featureCompactExactWait: true,
        featureKey: "ccp-security-patch-os-variants",
        errorClass: "reviewed-exception",
        target: "staging",
      },
      blocker: {
        condition:
          "Represented by wait-ccp-security-patch-reviewed-exception-owner-response-20260708. This compact leaf is a split-frontier carrier for feature-local state only; the exact represented blocker remains the human-owned owner/source-authority response wait.",
        waiting_for: {
          featureKey: "ccp-security-patch-os-variants",
          target: "staging",
          errorClass: "reviewed-exception",
          scope: "feature-compact",
          type: "owner.decision",
        },
        next_check_at: "2026-07-09T04:22:21.848Z",
        fallback_at: "2026-07-10T03:52:21.848Z",
      },
    };
    tree.tasks["hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706"] = {
      id: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
      parent_id: "aks-spec-verification-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "human",
      children: [],
      goal: "Preserve the exact aad-rbac run-command-access authorization frontier.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac exact frontier stays visible"],
      conflict_scope: ["feature:aad-rbac"],
      blocker: {
        condition: "Owner decision still gates the aad-rbac run-command-access authorization branch.",
        waiting_for: { type: "owner.decision", taskId: "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706" },
        next_check_at: "2026-07-10T18:20:00Z",
        fallback_at: "2026-07-11T18:20:00Z",
      },
    };
    tree.tasks["hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705"] = {
      id: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
      parent_id: "aks-spec-verification-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "human",
      children: [],
      goal: "Preserve the exact managed-v2 lifecycle contradiction frontier for aad-rbac row 37.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac exact frontier stays visible"],
      conflict_scope: ["feature:aad-rbac"],
      blocker: {
        condition: "Owner decision still gates the aad-rbac managed-v2 lifecycle contradiction branch.",
        waiting_for: { type: "owner.decision", taskId: "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705" },
        next_check_at: "2026-07-10T18:00:00Z",
        fallback_at: "2026-07-11T18:00:00Z",
      },
    };
    tree.tasks["wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702"] = {
      id: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "human",
      children: [],
      goal: "Preserve the shared secops-fips automatic managedsystem capacity family.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac capacity frontier stays visible"],
      conflict_scope: ["feature:aad-rbac"],
      blocker: {
        condition: "Capacity-family recovery still gates aad-rbac automatic SKU coverage.",
        waiting_for: { type: "owner.decision", taskId: "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702" },
        next_check_at: "2026-07-10T18:00:00Z",
        fallback_at: "2026-07-11T18:00:00Z",
      },
    };
    tree.tasks["wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704"] = {
      id: "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "human",
      children: [],
      goal: "Preserve the exact shared owner-promotion/auth frontier for defender-profile compact eligibility.",
      inputs: [],
      outputs: [],
      acceptance: ["defender-profile exact frontier stays visible"],
      conflict_scope: ["feature:defender-profile"],
      blocker: {
        condition: "Owner promotion frontier still governs defender-profile compact eligibility.",
        waiting_for: { type: "owner.decision", taskId: "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704" },
        next_check_at: "2026-07-10T18:30:00Z",
        fallback_at: "2026-07-11T18:30:00Z",
      },
    };
    tree.tasks["wait-ccp-security-patch-reviewed-exception-owner-response-20260708"] = {
      id: "wait-ccp-security-patch-reviewed-exception-owner-response-20260708",
      parent_id: "aks-spec-verification-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold the exact owner/source-authority response wait for the remaining ccp-security-patch reviewed-exception slice after durable send proof exists, without reopening unchanged reruns.",
      inputs: [],
      outputs: [],
      acceptance: ["shared CCP wait stays visible"],
      conflict_scope: ["spec-loop-followup:pending:ccp-security-patch", "feature:ccp-security-patch-os-variants"],
      blocker: {
        condition:
          "Blocked on the returned owner/source-authority decision for the remaining ccp-security-patch slice after durable send proof exists.",
        waiting_for: {
          type: "owner.decision",
          taskId: "wait-ccp-security-patch-reviewed-exception-owner-response-20260708",
        },
        next_check_at: "2026-07-10T18:00:00Z",
        fallback_at: "2026-07-11T18:00:00Z",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "aad-rbac", {
      status: "blocked",
      errorClass: "package-partial",
      taskId: "hold-compact-aad-rbac-package-partial-frontier",
      frontierTaskIds: [
        "hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706",
        "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705",
        "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702",
      ],
      waitingFor: {
        featureKey: "aad-rbac",
        target: "staging",
        errorClass: "package-partial",
        scope: "feature-compact",
        type: "owner.decision",
      },
      blockedReason:
        "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The remaining live-dispatch blocker is one reviewed-exception branch, one bounded promotion carrier, and one upheld unsplit truthful-wait carrier rather than missing package membership.",
      resumeCondition:
        "Resume only when one of the preserved reviewed-exception branches changes materially.",
      nextCheckAt: "2026-07-09T04:22:20.953Z",
      fallbackAt: "2026-07-10T03:52:20.953Z",
    });
    updateFeatureCompactItem(state, "defender-profile", {
      status: "blocked",
      errorClass: "reviewed-exception",
      taskId: "hold-compact-defender-profile-reviewed-exception-frontier",
      frontierTaskIds: [
        "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
      ],
      waitingFor: {
        featureKey: "defender-profile",
        target: "staging",
        errorClass: "reviewed-exception",
        scope: "feature-compact",
        type: "owner.decision",
      },
      blockedReason:
        "The current truthful next review step is the accepted owner-promotion note; compact eligibility still depends on owner promotion or explicit reclassification under the accepted request-plus-runtime floor.",
      resumeCondition:
        "Resume only after the owner promotes or intentionally reclassifies spec.defender-profile.vm-prerelease-matrix.",
      nextCheckAt: "2026-07-09T04:22:22.748Z",
      fallbackAt: "2026-07-10T03:52:22.748Z",
    });
    updateFeatureCompactItem(state, "ccp-security-patch-os-variants", {
      status: "blocked",
      errorClass: "reviewed-exception",
      taskId: "hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier",
      frontierTaskIds: [
        "wait-ccp-security-patch-reviewed-exception-owner-response-20260708",
      ],
      waitingFor: {
        featureKey: "ccp-security-patch-os-variants",
        target: "staging",
        errorClass: "reviewed-exception",
        scope: "feature-compact",
        type: "owner.decision",
      },
      blockedReason:
        "Represented by wait-ccp-security-patch-reviewed-exception-owner-response-20260708; the next truthful step is owner/source-authority reclassification of the MarinerV2 carrier rather than another same-scope rerun.",
      resumeCondition:
        "Resume only if accepted evidence re-authors the MarinerV2 carrier or intentionally reclassifies/removes it.",
      nextCheckAt: "2026-07-09T04:22:21.848Z",
      fallbackAt: "2026-07-10T03:52:21.848Z",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.stateRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          featureKey: "aad-rbac",
          field: "nextCheckAt",
          before: "2026-07-09T04:22:20.953Z",
          after: "2026-07-10T18:20:00Z",
        }),
        expect.objectContaining({
          featureKey: "aad-rbac",
          field: "fallbackAt",
          before: "2026-07-10T03:52:20.953Z",
          after: "2026-07-11T18:20:00Z",
        }),
        expect.objectContaining({
          featureKey: "ccp-security-patch-os-variants",
          field: "nextCheckAt",
          before: "2026-07-09T04:22:21.848Z",
          after: "2026-07-10T18:00:00Z",
        }),
        expect.objectContaining({
          featureKey: "ccp-security-patch-os-variants",
          field: "fallbackAt",
          before: "2026-07-10T03:52:21.848Z",
          after: "2026-07-11T18:00:00Z",
        }),
      ]),
    );
    expect(savedState.features["aad-rbac"].nextCheckAt).toBe(
      "2026-07-10T18:20:00Z",
    );
    expect(savedState.features["aad-rbac"].fallbackAt).toBe(
      "2026-07-11T18:20:00Z",
    );
    expect(savedState.features["defender-profile"].nextCheckAt).toBe(
      "2026-07-10T18:30:00Z",
    );
    expect(savedState.features["defender-profile"].fallbackAt).toBe(
      "2026-07-11T18:30:00Z",
    );
    expect(savedState.features["ccp-security-patch-os-variants"].nextCheckAt).toBe(
      "2026-07-10T18:00:00Z",
    );
    expect(savedState.features["ccp-security-patch-os-variants"].fallbackAt).toBe(
      "2026-07-11T18:00:00Z",
    );
  });

  test("refreshes existing exact holders from generic wait types to the represented promotion or prerequisite frontier", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "cost-analysis", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "managedsystem-pool", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "cost-analysis.yaml"),
      "capabilityId: cost-analysis\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "managedsystem-pool.yaml"),
      "capabilityId: managedsystem-pool\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "cost-analysis", "specs", "seed.json"),
      JSON.stringify({ id: "spec.cost-analysis.vm-prerelease-source-seed" }),
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "managedsystem-pool", "specs", "create.json"),
      JSON.stringify({ id: "spec.managedsystem.cli-create-variant" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-cost-analysis-reviewed-exception-frontier",
      "hold-compact-managedsystem-pool-reviewed-exception-frontier",
      "hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier",
    ];
    tree.tasks["hold-compact-cost-analysis-reviewed-exception-frontier"] = {
      id: "hold-compact-cost-analysis-reviewed-exception-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature cost-analysis on exact reviewed-exception wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["cost-analysis holder stays visible"],
      conflict_scope: ["feature-compact:cost-analysis", "feature:cost-analysis"],
      context: {
        featureCompactExactWait: true,
        featureKey: "cost-analysis",
        errorClass: "reviewed-exception",
        target: "staging",
      },
      blocker: {
        condition:
          "reviewed-exception frontier still governs cost-analysis, including the execute-ready-promotion plus underlay-kubeconfig owner wait boundary recorded in compact state; restore the missing compact blocked holder and wait until that exact frontier changes.",
        waiting_for: {
          type: "environment.available",
          taskId: "hold-compact-cost-analysis-reviewed-exception-frontier",
        },
      },
    };
    tree.tasks["hold-compact-managedsystem-pool-reviewed-exception-frontier"] = {
      id: "hold-compact-managedsystem-pool-reviewed-exception-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature managedsystem-pool on exact reviewed-exception wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["managedsystem-pool holder stays visible"],
      conflict_scope: ["feature-compact:managedsystem-pool", "feature:managedsystem-pool"],
      context: {
        featureCompactExactWait: true,
        featureKey: "managedsystem-pool",
        errorClass: "reviewed-exception",
        target: "staging",
      },
      blocker: {
        condition:
          "reviewed-exception frontier still governs managedsystem-pool, including the repo-local mixed terminal and promotion frontier recorded in compact state; restore the missing compact blocked holder and wait until that exact frontier changes.",
        waiting_for: {
          type: "evidence.available",
          taskId: "hold-compact-managedsystem-pool-reviewed-exception-frontier",
        },
      },
    };
    tree.tasks["hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier"] = {
      id: "hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature remediator-node-not-ready-restart on the exact accepted runtime/product-lineage owner wait until a material same-path signal changes.",
      inputs: [],
      outputs: [],
      acceptance: ["remediator holder stays visible"],
      conflict_scope: [
        "feature-compact:remediator-node-not-ready-restart",
        "feature:remediator-node-not-ready-restart",
      ],
      context: {
        featureCompactExactWait: true,
        featureKey: "remediator-node-not-ready-restart",
        errorClass: "runtime-product-lineage",
        target: "staging",
      },
      blocker: {
        condition:
          "Do not rerun unchanged. Accepted same-path runtime/product nonpass lineage remains the controlling frontier for remediator-node-not-ready-restart, but stale text still mentions westus2 managed-cluster capacity from an older failed run.",
        waiting_for: {
          type: "azure.capacity.available",
          resource: "managedClusters",
          featureKey: "remediator-node-not-ready-restart",
          target: "staging",
          errorClass: "runtime-product-lineage",
          scope: "feature-compact",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "cost-analysis", {
      status: "blocked",
      errorClass: "reviewed-exception",
      taskId: "hold-compact-cost-analysis-reviewed-exception-frontier",
      waitingFor: {
        featureKey: "cost-analysis",
        target: "staging",
        errorClass: "reviewed-exception",
        scope: "feature-compact",
        type: "environment.prerequisite.ready",
      },
      blockedReason:
        "Resume only after a working underlay kubeconfig is available and the owner explicitly reviews or promotes the source-grounded carrier.",
    });
    updateFeatureCompactItem(state, "managedsystem-pool", {
      status: "blocked",
      errorClass: "reviewed-exception",
      taskId: "hold-compact-managedsystem-pool-reviewed-exception-frontier",
      waitingFor: {
        featureKey: "managedsystem-pool",
        target: "staging",
        errorClass: "reviewed-exception",
        scope: "feature-compact",
        type: "owner.decision",
      },
      blockedReason:
        "Resume only if accepted evidence promotes or explicitly narrows spec.managedsystem.cli-create-variant, removes or rehomes any superseded lineage carrier, or if concrete external environment/product/client evidence reopens the remaining frontier.",
    });
    updateFeatureCompactItem(state, "remediator-node-not-ready-restart", {
      status: "blocked",
      errorClass: "runtime-product-lineage",
      taskId: "hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier",
      waitingFor: {
        featureKey: "remediator-node-not-ready-restart",
        target: "staging",
        errorClass: "runtime-product-lineage",
        scope: "feature-compact",
        type: "owner.decision",
      },
      blockedReason:
        "Do not rerun unchanged; accepted same-path runtime/product nonpass lineage remains controlling, and only an owner/runtime verdict or material product change should reopen this frontier.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.taskRepairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: "hold-compact-cost-analysis-reviewed-exception-frontier",
          featureKey: "cost-analysis",
          field: "blocker.waiting_for",
          before: {
            type: "environment.available",
            taskId: "hold-compact-cost-analysis-reviewed-exception-frontier",
          },
          after: {
            featureKey: "cost-analysis",
            target: "staging",
            errorClass: "reviewed-exception",
            scope: "feature-compact",
            type: "environment.prerequisite.ready",
          },
        }),
        expect.objectContaining({
          taskId: "hold-compact-managedsystem-pool-reviewed-exception-frontier",
          featureKey: "managedsystem-pool",
          field: "blocker.waiting_for",
          before: {
            type: "evidence.available",
            taskId: "hold-compact-managedsystem-pool-reviewed-exception-frontier",
          },
          after: {
            featureKey: "managedsystem-pool",
            target: "staging",
            errorClass: "reviewed-exception",
            scope: "feature-compact",
            type: "owner.decision",
          },
        }),
        expect.objectContaining({
          taskId: "hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier",
          featureKey: "remediator-node-not-ready-restart",
          field: "blocker.waiting_for",
          before: {
            type: "azure.capacity.available",
            resource: "managedClusters",
            featureKey: "remediator-node-not-ready-restart",
            target: "staging",
            errorClass: "runtime-product-lineage",
            scope: "feature-compact",
          },
          after: {
            featureKey: "remediator-node-not-ready-restart",
            target: "staging",
            errorClass: "runtime-product-lineage",
            scope: "feature-compact",
            type: "owner.decision",
          },
        }),
      ]),
    );
    expect(
      savedTree.tasks["hold-compact-cost-analysis-reviewed-exception-frontier"].blocker.waiting_for,
    ).toEqual({
      featureKey: "cost-analysis",
      target: "staging",
      errorClass: "reviewed-exception",
      scope: "feature-compact",
      type: "environment.prerequisite.ready",
    });
    expect(
      savedTree.tasks["hold-compact-managedsystem-pool-reviewed-exception-frontier"].blocker.waiting_for,
    ).toEqual({
      featureKey: "managedsystem-pool",
      target: "staging",
      errorClass: "reviewed-exception",
      scope: "feature-compact",
      type: "owner.decision",
    });
    expect(
      savedTree.tasks["hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier"].blocker.waiting_for,
    ).toEqual({
      featureKey: "remediator-node-not-ready-restart",
      target: "staging",
      errorClass: "runtime-product-lineage",
      scope: "feature-compact",
      type: "owner.decision",
    });
    expect(savedState.features["cost-analysis"].taskId).toBe(
      "hold-compact-cost-analysis-reviewed-exception-frontier",
    );
    expect(savedState.features["managedsystem-pool"].taskId).toBe(
      "hold-compact-managedsystem-pool-reviewed-exception-frontier",
    );
    expect(savedState.features["remediator-node-not-ready-restart"].taskId).toBe(
      "hold-compact-remediator-node-not-ready-restart-runtime-product-lineage-frontier",
    );
  });

  test("reprojects to live generic exact holders when no sharper child exists", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-aad-rbac-package-partial-frontier",
      "hold-compact-app-routing-package-partial-frontier-202607090617",
      "hold-compact-machines-agentpool-package-partial-frontier-202607090617",
      "hold-compact-node-http-proxy-package-partial-frontier-202607090544",
    ];
    tree.tasks["hold-compact-aad-rbac-package-partial-frontier"] = {
      id: "hold-compact-aad-rbac-package-partial-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature aad-rbac on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["aad-rbac holder stays visible"],
      conflict_scope: ["feature-compact:aad-rbac"],
      context: {
        featureCompactExactWait: true,
        featureKey: "aad-rbac",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter.",
        waiting_for: {
          type: "azure.capacity.available",
          resource: "managedClusters",
          featureKey: "aad-rbac",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-app-routing-package-partial-frontier-202607090617"] = {
      id: "hold-compact-app-routing-package-partial-frontier-202607090617",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature app-routing on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["app-routing holder stays visible"],
      conflict_scope: ["feature-compact:app-routing"],
      context: {
        featureCompactExactWait: true,
        featureKey: "app-routing",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Do not rerun unchanged; current-head package-partial regeneration keeps app-routing partial, but the exact two-spec OSM internal promotion subset is now promoted to live-ready. The remaining live-dispatch blocker is only the residual split frontier.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "app-routing",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-machines-agentpool-package-partial-frontier-202607090617"] = {
      id: "hold-compact-machines-agentpool-package-partial-frontier-202607090617",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature machines-agentpool on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["machines-agentpool holder stays visible"],
      conflict_scope: ["feature-compact:machines-agentpool"],
      context: {
        featureCompactExactWait: true,
        featureKey: "machines-agentpool",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Compact package remains partial with exactly one repaired rerun-ready member. Rewrite review confirmed the stale runtime package-partial holder broadens the exact same-spec frontier; preserve the exact single-spec owner review frontier.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "machines-agentpool",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["hold-compact-node-http-proxy-package-partial-frontier-202607090544"] = {
      id: "hold-compact-node-http-proxy-package-partial-frontier-202607090544",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Hold compact feature node-http-proxy on exact package-partial wait until the named condition changes.",
      inputs: [],
      outputs: [],
      acceptance: ["node-http-proxy holder stays visible"],
      conflict_scope: ["feature-compact:node-http-proxy"],
      context: {
        featureCompactExactWait: true,
        featureKey: "node-http-proxy",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Create/update current-head rerun 28673740487 already passed; exact surviving holder is the separate trusted-ca quarantine.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "node-http-proxy",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "aad-rbac", {
      status: "error",
      errorClass: "package-partial",
      taskId: null,
      waitingFor: null,
      blockedReason:
        "Reviewed same-path pass run 28847520644 cleared spec.aad-rbac.nonaad-to-aadv2-migration from the compact blocker surface. The live aad-rbac compact frontier is now only the residual reviewed-exception trio under the existing live-ready filter.",
    });
    updateFeatureCompactItem(state, "app-routing", {
      status: "error",
      errorClass: "package-partial",
      taskId: null,
      waitingFor: null,
      blockedReason:
        "Do not rerun unchanged; current-head package-partial regeneration keeps app-routing partial, but the exact two-spec OSM internal promotion subset is now promoted to live-ready. The remaining live-dispatch blocker is only the residual split frontier.",
    });
    updateFeatureCompactItem(state, "machines-agentpool", {
      status: "error",
      errorClass: "package-partial",
      taskId: "wait-compact-machines-agentpool-run-28809049156-review-20260707",
      waitingFor:
        "bounded fix or accepted reclassification for the exact preflight blocker surfaced by run 28809049156",
      blockedReason:
        "Rewrite review confirmed the stale runtime package-partial holder broadens the exact same-spec frontier.",
    });
    updateFeatureCompactItem(state, "node-http-proxy", {
      status: "error",
      errorClass: "package-partial",
      taskId: "wait-compact-node-http-proxy-trusted-ca-quarantine-20260702",
      waitingFor: null,
      blockedReason:
        "Create/update current-head rerun 28673740487 already passed; do not regenerate a duplicate create/update review leaf.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const savedTree = JSON.parse(await readFile(treePath, "utf8"));
    const savedState = JSON.parse(await readFile(statePath, "utf8"));
    const repair = reconcileFeatureCompactRuntimeProjection({
      loopTask: savedTree.tasks["aks-feature-compact-loop"],
      tasks: savedTree.tasks,
      state: savedState,
    });

    expect(repair.stateRepairs).toMatchObject([
      expect.objectContaining({
        featureKey: "aad-rbac",
        field: "taskId",
        before: null,
        after: "hold-compact-aad-rbac-package-partial-frontier",
      }),
      expect.objectContaining({
        featureKey: "app-routing",
        field: "taskId",
        before: null,
        after: "hold-compact-app-routing-package-partial-frontier-202607090617",
      }),
      expect.objectContaining({
        featureKey: "machines-agentpool",
        field: "taskId",
        before: "wait-compact-machines-agentpool-run-28809049156-review-20260707",
        after: "hold-compact-machines-agentpool-package-partial-frontier-202607090617",
      }),
      expect.objectContaining({
        featureKey: "node-http-proxy",
        field: "taskId",
        before: "wait-compact-node-http-proxy-trusted-ca-quarantine-20260702",
        after: "hold-compact-node-http-proxy-package-partial-frontier-202607090544",
      }),
    ]);
    expect(savedState.features["aad-rbac"].taskId).toBe(
      "hold-compact-aad-rbac-package-partial-frontier",
    );
    expect(savedState.features["app-routing"].taskId).toBe(
      "hold-compact-app-routing-package-partial-frontier-202607090617",
    );
    expect(savedState.features["machines-agentpool"].taskId).toBe(
      "hold-compact-machines-agentpool-package-partial-frontier-202607090617",
    );
    expect(savedState.features["node-http-proxy"].taskId).toBe(
      "hold-compact-node-http-proxy-package-partial-frontier-202607090544",
    );
  });

  test("controller backfills completed Azure DevOps live proof even when an exact wait holder represents the feature", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "success",
    );
    const pipelineState = process.env.FAKE_GH_STATE;
    if (!pipelineState) throw new Error("missing fake pipeline state path");
    await writeFile(
      pipelineState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "success",
            url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            createdAt: new Date().toISOString(),
            displayTitle:
              "AKS RP E2E features/windows/compact/staging.plan.json staging",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      ...(tree.tasks["aks-feature-compact-loop"].children ?? []),
      "wait-compact-windows-ado-run-123-review",
    ];
    tree.tasks["wait-compact-windows-ado-run-123-review"] = {
      id: "wait-compact-windows-ado-run-123-review",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P1",
      owner: "aks-explorer",
      children: [],
      goal: "Wait for Azure DevOps run 123 for windows compact package.",
      inputs: ["feature:windows", "runId:123"],
      outputs: [],
      acceptance: ["Review run 123 when terminal."],
      conflict_scope: ["feature-compact:windows"],
      context: {
        featureKey: "windows",
        runId: "123",
      },
      blocker: {
        condition: "Azure DevOps run 123 review pending.",
        waiting_for: {
          type: "azure-devops.run.completed",
          runId: "123",
        },
      },
    };
    await writeFile(treePath, JSON.stringify(tree, null, 2), "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      errorClass: "live-workflow",
      retryable: true,
      attempts: 2,
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: null,
      lastSummary:
        "Exact Azure DevOps run 123 is represented by a wait holder and needs result harvest.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Backfilled 1 stale compact error run(s).",
      );
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      expect(saved.features.windows).toMatchObject({
        status: "done",
        lastWorkflowRunId: "123",
        lastLiveProofVersion: "live-aks-proof-v2",
      });
      expect(saved.features.windows.lastSummary).toContain(
        "Backfilled completed compact Azure DevOps pipeline run 123",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller does not repeatedly backfill an already inspected failing run", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "failure",
      {
        resultStatus: "nonpassing",
        resultReason: "Previously inspected failing live proof.",
        resultCategory: "test_error",
      },
    );
    const pipelineState = process.env.FAKE_GH_STATE;
    if (!pipelineState) throw new Error("missing fake pipeline state path");
    await writeFile(
      pipelineState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "success",
            url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            createdAt: new Date().toISOString(),
            displayTitle:
              "AKS RP E2E features/windows/compact/staging.plan.json staging",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      retryable: true,
      attempts: 2,
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: null,
      lastSummary:
        "Backfilled completed compact Azure DevOps pipeline run 123 for windows; live proof is still failing.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).not.toContain("Backfilled 1 stale");
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      expect(saved.features.windows).toMatchObject({
        status: "error",
        lastWorkflowRunId: "123",
        lastLiveProofVersion: null,
      });
      expect(saved.features.windows.lastSummary).toBe(
        "Backfilled completed compact Azure DevOps pipeline run 123 for windows; live proof is still failing.",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller preserves exact retryReason when backfilling a completed nonpassing run without capacity classification", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(
      projectDir,
      "failure",
      {
        resultStatus: "nonpassing",
        resultReason:
          "Run artifact bundle is incomplete; only workflow metadata and dispatch inputs were materialized locally.",
        resultCategory: "workflow_artifact_gap",
      },
    );
    const pipelineState = process.env.FAKE_GH_STATE;
    if (!pipelineState) throw new Error("missing fake pipeline state path");
    await writeFile(
      pipelineState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "failure",
            url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
            createdAt: new Date().toISOString(),
            displayTitle:
              "AKS RP E2E features/windows/compact/staging.plan.json staging",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      retryable: true,
      attempts: 2,
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: null,
      retryReason:
        "Recover and review the exact failed run artifact/log surface before any successor rerun.",
      lastSummary: "Feature compact live workflow did not pass for windows.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain(
        "Backfilled 1 stale compact error run(s).",
      );
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      expect(saved.features.windows).toMatchObject({
        status: "error",
        lastWorkflowRunId: "123",
        lastLiveProofVersion: null,
        retryReason:
          "Recover and review the exact failed run artifact/log surface before any successor rerun.",
      });
      expect(String(saved.features.windows.lastSummary)).toContain(
        "Backfilled completed compact Azure DevOps pipeline run 123 for windows; live proof is still failing.",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller sync does not downgrade live proof from stale completed partial child", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "compact-feature-windows",
    ];
    tree.tasks["compact-feature-windows"] = {
      id: "compact-feature-windows",
      parent_id: "aks-feature-compact-loop",
      state: "done",
      status: "done",
      workflow: "feature-compact-planner",
      priority: "P1",
      children: [],
      goal: "Generate compact package.",
      inputs: [],
      outputs: [".state/feature-compact-loop/state.json"],
      acceptance: ["Package checked"],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      trace: {
        last_worker_result: "partial",
        last_worker_summary: "Stale cancelled workflow result.",
      },
      context: {
        featureKey: "windows",
        capabilityId: "windows",
        target: "staging",
        stateRef: ".state/feature-compact-loop/state.json",
        loopTaskId: "aks-feature-compact-loop",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "done",
      attempts: 1,
      taskId: "compact-feature-windows-retry",
      lastWorkflowRunId: "123",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      lastLiveProofVersion: "live-aks-proof-v2",
      lastSummary: "Live shared-cluster proof accepted.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const saved = JSON.parse(await readFile(statePath, "utf8"));
    expect(saved.features.windows).toMatchObject({
      status: "done",
      lastWorkflowRunId: "123",
      lastLiveProofVersion: "live-aks-proof-v2",
    });
  });

  test("closes stale compact waits when every named spec already has live pass evidence", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].state = "active";
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-storage-csi-two-spec-live-run-review",
      "wait-storage-csi-mixed-frontier",
    ];
    tree.tasks["wait-storage-csi-two-spec-live-run-review"] = {
      id: "wait-storage-csi-two-spec-live-run-review",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal: "Wait for run 28775604245 covering spec.storage-csi.disk-resize and spec.storage-csi.disk-xfs.",
      inputs: [],
      outputs: [],
      acceptance: [
        "Review spec.storage-csi.disk-resize and spec.storage-csi.disk-xfs.",
      ],
      forbidden: [],
      conflict_scope: ["feature:storage-csi"],
      depends_on: [],
      blocker: {
        condition:
          "Waiting for Azure DevOps run 28775604245 terminal artifacts for the two-spec storage-csi slice.",
      },
    };
    tree.tasks["wait-storage-csi-mixed-frontier"] = {
      id: "wait-storage-csi-mixed-frontier",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal: "Wait for storage-csi frontier covering spec.storage-csi.disk-resize and spec.storage-csi.csidrivers.",
      inputs: [],
      outputs: [],
      acceptance: [
        "Do not close while spec.storage-csi.csidrivers is still pending.",
      ],
      forbidden: [],
      conflict_scope: ["feature:storage-csi"],
      depends_on: [],
      blocker: {
        condition: "Waiting for a mixed storage-csi frontier to change.",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.storage-csi.disk-resize": {
              status: "pass",
              lastRunId: "28793232048",
            },
            "spec.storage-csi.disk-xfs": {
              status: "pass",
              lastRunId: "28791413293",
            },
            "spec.storage-csi.csidrivers": {
              status: "pending",
              lastRunId: "28417939305",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await executeController({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 5",
        eventBlock({
          type: "project.task.tick",
          action: "feature-compact-loop",
          project: "aks-rp-e2e",
          taskId: "aks-feature-compact-loop",
          target: { taskId: "aks-feature-compact-loop" },
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Closed 1 stale compact blocked wait");
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updated.tasks["wait-storage-csi-two-spec-live-run-review"],
    ).toMatchObject({
      state: "done",
      done_by: "feature-compact-loop-controller",
      resolution: "completed",
    });
    expect(
      updated.tasks["wait-storage-csi-two-spec-live-run-review"].trace
        .stale_wait_spec_ids,
    ).toEqual(["spec.storage-csi.disk-resize", "spec.storage-csi.disk-xfs"]);
    expect(updated.tasks["wait-storage-csi-mixed-frontier"]).toMatchObject({
      state: "blocked",
    });
  });

  test("controller keeps feature-compact exact waits blocked and rebinds persisted state to them", async () => {
    const projectDir = await makeProject();
    await mkdir(join(projectDir, "features", "app-routing", "specs"), {
      recursive: true,
    });
    await mkdir(join(projectDir, "features", "machines-agentpool", "specs"), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, "features", "app-routing.yaml"),
      "capabilityId: app-routing\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "machines-agentpool.yaml"),
      "capabilityId: machines-agentpool\nstatus: draft\n",
      "utf8",
    );
    await writeFile(
      join(projectDir, "features", "app-routing", "specs", "split.json"),
      JSON.stringify({ id: "spec.app-routing.vm-prerelease.osm-acnginx-internal" }),
      "utf8",
    );
    await writeFile(
      join(
        projectDir,
        "features",
        "machines-agentpool",
        "specs",
        "cleanup.json",
      ),
      JSON.stringify({ id: "spec.nap.default-machines-pool-cleanup-no-machine-crud" }),
      "utf8",
    );
    await writeRootTree(projectDir);
    const restoreGh = await installCompactPipelineBackend(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].status = "active";
    tree.tasks["aks-feature-compact-loop"].children = [
      "hold-compact-app-routing-shared-fixture-frontier-20260708",
      "wait-compact-machines-agentpool-run-28809049156-review-20260707",
    ];
    tree.tasks["hold-compact-app-routing-shared-fixture-frontier-20260708"] = {
      id: "hold-compact-app-routing-shared-fixture-frontier-20260708",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal:
        "Preserve the exact app-routing shared fixture / split frontier after the internal OSM pair promotion.",
      inputs: [],
      outputs: [],
      acceptance: ["split frontier stays visible"],
      forbidden: [],
      conflict_scope: ["feature:app-routing"],
      depends_on: [],
      context: {
        featureCompactExactWait: true,
        featureKey: "app-routing",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "App-routing remains compact-partial after spec.app-routing.vm-prerelease.osm-acnginx-internal and spec.app-routing.vm-prerelease.osm-internal-nginx-internal were promoted; the residual split frontier still blocks a broad rerun.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "app-routing",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    tree.tasks["wait-compact-machines-agentpool-run-28809049156-review-20260707"] = {
      id: "wait-compact-machines-agentpool-run-28809049156-review-20260707",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P2",
      children: [],
      goal:
        "Preserve the exact same-spec compact rerun result 28809049156 for spec.nap.default-machines-pool-cleanup-no-machine-crud while reviewed-exception siblings stay on the shared family wait.",
      inputs: [],
      outputs: [],
      acceptance: ["same-spec frontier stays isolated"],
      forbidden: [],
      conflict_scope: ["feature:machines-agentpool"],
      depends_on: [],
      context: {
        featureCompactExactWait: true,
        featureKey: "machines-agentpool",
        errorClass: "package-partial",
        target: "staging",
      },
      blocker: {
        condition:
          "Blocked on exact run 28809049156 review for spec.nap.default-machines-pool-cleanup-no-machine-crud after compact-state writeback preserved this same-spec frontier as the current truthful machines-agentpool carrier.",
        waiting_for: {
          type: "publish.auth.ready",
          featureKey: "machines-agentpool",
          target: "staging",
          errorClass: "package-partial",
          scope: "feature-compact",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.app-routing.vm-prerelease.osm-acnginx-internal": {
              status: "pass",
            },
            "spec.app-routing.vm-prerelease.osm-internal-nginx-internal": {
              status: "pass",
            },
            "spec.nap.default-machines-pool-cleanup-no-machine-crud": {
              status: "pass",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", { status: "done" });
    updateFeatureCompactItem(state, "app-routing", {
      status: "error",
      errorClass: "package-partial",
      taskId: null,
      waitingFor: null,
      blockedReason:
        "Do not rerun unchanged; current-head package-partial regeneration keeps app-routing partial, but the exact two-spec OSM internal promotion subset is now promoted to live-ready. The remaining live-dispatch blocker is only the residual split frontier.",
    });
    updateFeatureCompactItem(state, "machines-agentpool", {
      status: "error",
      errorClass: "package-partial",
      taskId: "hold-compact-machines-agentpool-package-partial-frontier-202607090617",
      waitingFor: null,
      blockedReason:
        "Rewrite review confirmed the stale runtime package-partial holder broadens the exact same-spec frontier; preserve wait-compact-machines-agentpool-run-28809049156-review-20260707.",
    });
    saveFeatureCompactLoopState(statePath, state);

    try {
      const result = await executeController({
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 5",
          eventBlock({
            type: "project.task.tick",
            action: "feature-compact-loop",
            project: "aks-rp-e2e",
            taskId: "aks-feature-compact-loop",
            target: { taskId: "aks-feature-compact-loop" },
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).not.toContain("Closed 2 stale compact blocked wait");

      const updatedTree = JSON.parse(await readFile(treePath, "utf8"));
      expect(
        updatedTree.tasks["hold-compact-app-routing-shared-fixture-frontier-20260708"],
      ).toMatchObject({ state: "blocked" });
      expect(
        updatedTree.tasks[
          "wait-compact-machines-agentpool-run-28809049156-review-20260707"
        ],
      ).toMatchObject({ state: "blocked" });

      const updatedState = JSON.parse(await readFile(statePath, "utf8"));
      expect(updatedState.features["app-routing"].taskId).toBe(
        "hold-compact-app-routing-shared-fixture-frontier-20260708",
      );
      expect(updatedState.features["machines-agentpool"].taskId).toBe(
        "wait-compact-machines-agentpool-run-28809049156-review-20260707",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller moves terminal Azure DevOps compact waits to review", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-compact-windows-run",
    ];
    tree.tasks["wait-compact-windows-run"] = {
      id: "wait-compact-windows-run",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P1",
      children: [],
      goal: "Wait for windows compact Azure DevOps pipeline run 123456789 to finish.",
      inputs: ["feature:windows", "spec.windows.node-pool-create"],
      outputs: [],
      acceptance: ["Review terminal workflow result."],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      context: {
        featureCompactFollowup: true,
        errorClass: "live-workflow",
        sampledFeatureKeys: ["windows"],
      },
      blocker: {
        category: "external-wait",
        condition: "Waiting for Azure DevOps pipeline run 123456789.",
        waiting_for: {
          type: "github.workflow_run.completed",
          runId: "123456789",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
    await mkdir(join(projectDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(projectDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          specs: {
            "spec.windows.node-pool-create": {
              status: "error",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });
    updateFeatureCompactItem(state, "windows", {
      status: "error",
      taskId: "wait-compact-windows-run",
      attempts: 2,
      lastSummary: "Waiting for compact live workflow.",
    });
    saveFeatureCompactLoopState(statePath, state);

    const result = harvestTerminalCompactGitHubWaits({
      config: config(projectDir),
      projectDir,
      appDir: projectDir,
      loopTaskId: "aks-feature-compact-loop",
      state,
      client: { kind: "gh" },
      limit: 10,
      getRun: (runId) => ({
        databaseId: Number(runId),
        status: "completed",
        conclusion: "failure",
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
        displayTitle: "Compact windows staging",
      }),
    });

    expect(result.harvestedTaskIds).toEqual(["wait-compact-windows-run"]);
    expect(result.terminalRunIds).toEqual(["123456789"]);
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["wait-compact-windows-run"]).toMatchObject({
      state: "review",
      context: {
        terminalPipelineWaitReview: {
          runId: "123456789",
          runStatus: "completed",
          runConclusion: "failure",
          featureKeys: ["windows"],
          namedSpecIds: ["spec.windows.node-pool-create"],
        },
      },
    });
    expect(updated.tasks["wait-compact-windows-run"].blocker).toBeUndefined();
    expect(state.features.windows).toMatchObject({
      taskId: "wait-compact-windows-run",
      lastWorkflowRunId: "123456789",
      lastWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456789",
      observedBy: {
        workflow: "feature-compact-loop-controller",
        taskId: "wait-compact-windows-run",
        runId: "123456789",
      },
    });
  });

  test("controller leaves active Azure DevOps compact waits blocked", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = resolveTaskTreePath(projectDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["aks-feature-compact-loop"].children = [
      "wait-compact-windows-run",
    ];
    tree.tasks["wait-compact-windows-run"] = {
      id: "wait-compact-windows-run",
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      status: "blocked",
      priority: "P1",
      children: [],
      goal: "Wait for windows compact Azure DevOps pipeline run 123456789 to finish.",
      inputs: ["feature:windows"],
      outputs: [],
      acceptance: ["Review terminal workflow result."],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      blocker: {
        category: "external-wait",
        condition: "Waiting for Azure DevOps pipeline run 123456789.",
        waiting_for: {
          type: "github.workflow_run.completed",
          runId: "123456789",
        },
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const statePath = join(
      projectDir,
      ".state",
      "feature-compact-loop",
      "state.json",
    );
    const { state } = loadFeatureCompactLoopState({
      appDir: projectDir,
      projectDir,
      loopTaskId: "aks-feature-compact-loop",
      windowSize: 1,
      statePath,
    });

    const result = harvestTerminalCompactGitHubWaits({
      config: config(projectDir),
      projectDir,
      appDir: projectDir,
      loopTaskId: "aks-feature-compact-loop",
      state,
      client: { kind: "gh" },
      limit: 10,
      getRun: (runId) => ({
        databaseId: Number(runId),
        status: "in_progress",
        conclusion: null,
      }),
    });

    expect(result.harvestedTaskIds).toEqual([]);
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["wait-compact-windows-run"]).toMatchObject({
      state: "blocked",
      status: "blocked",
    });
  });
});
