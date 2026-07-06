import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  peekTaskAssignments,
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

async function installFakeGh(
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
  const binDir = join(projectDir, "bin");
  const statePath = join(projectDir, ".state", "fake-gh-run.json");
  const logPath = join(projectDir, ".state", "fake-gh-dispatches.jsonl");
  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(binDir, "gh"),
    `#!/usr/bin/env bun
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const statePath = process.env.FAKE_GH_STATE;
const logPath = process.env.FAKE_GH_LOG;
function readState() {
  try { return JSON.parse(readFileSync(statePath, "utf8")); } catch { return {}; }
}
function writeState(value) {
  writeFileSync(statePath, JSON.stringify(value, null, 2));
}
if (args[0] === "--version") {
  console.log("gh version fake");
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "status") {
  console.log("Logged in to github.com as fake-user");
  process.exit(0);
}
if (args[0] === "workflow" && args[1] === "run") {
  const inputs = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-f" && args[i + 1]) {
      const [key, ...rest] = args[++i].split("=");
      inputs[key] = rest.join("=");
    }
  }
  if (process.env.FAKE_GH_DISPATCH_FAIL === "1") {
    if (logPath) appendFileSync(logPath, JSON.stringify(inputs) + "\\n");
    console.error('{"message":"dispatch failed","status":"403"}');
    process.exit(1);
  }
  if (logPath) appendFileSync(logPath, JSON.stringify(inputs) + "\\n");
  const state = readState();
  const dispatchCount = Number(state.dispatchCount || 0) + 1;
  if (dispatchCount === 1 && process.env.FAKE_GH_REJECT_METADATA === "1" && inputs.metadata) {
    writeState({ ...state, dispatchCount });
    console.error('{"message":"Unexpected inputs provided: [\\"metadata\\"]","status":"422"}');
    process.exit(1);
  }
  const run = {
    databaseId: 123,
    status: "completed",
    conclusion: process.env.FAKE_GH_CONCLUSION || "success",
    url: "https://github.example/runs/123",
    createdAt: new Date().toISOString(),
    displayTitle: \`AKS RP E2E \${inputs.plan_path || inputs.feature_set || ""} \${inputs.target || ""}\`
  };
  writeState({ ...state, dispatchCount, run });
  process.exit(0);
}
if (args[0] === "run" && args[1] === "list") {
  const state = readState();
  console.log(JSON.stringify(state.run ? [state.run] : []));
  process.exit(0);
}
if (args[0] === "run" && args[1] === "view") {
  const state = readState();
  console.log(JSON.stringify(state.run || null));
  process.exit(state.run ? 0 : 1);
}
if (args[0] === "run" && args[1] === "download") {
  const state = readState();
  let dir = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) dir = args[++i];
  }
  if (!state.run || !dir) process.exit(1);
  const artifactRoot = join(dir, \`aks-rp-e2e-\${state.run.databaseId}-test-results\`);
  const resultDir = join(artifactRoot, "runs", "test-results", "feature-compact-windows-staging_000001");
  const sharedDir = join(resultDir, "shared-clusters");
  mkdirSync(resultDir, { recursive: true });
  mkdirSync(sharedDir, { recursive: true });
  const surface = process.env.FAKE_GH_RESULT_SURFACE || "live-azure-run";
  const status = process.env.FAKE_GH_RESULT_STATUS || "passed";
  const specStatus = status === "passed" ? "pass" : "error";
  const resultReason = process.env.FAKE_GH_RESULT_REASON || (surface === "live-azure-run" ? "Live Azure run passed." : "Check complete without Azure resource changes.");
  const resultCategory = process.env.FAKE_GH_RESULT_CATEGORY || (status === "passed" ? "none" : "test_error");
  const result = {
    runId: "feature-compact-windows-staging_000001",
    planId: "feature-compact-windows-staging",
    planPath: "features/windows/compact/staging.plan.json",
    target: {
      name: "staging",
      environment: "staging",
      subscriptionId: "26fe00f8-9173-4872-9134-bb1d2e00343a",
      location: "westus2",
      surface
    },
    status,
    counts: {
      pass: status === "passed" ? 1 : 0,
      fail: 0,
      error: status === "passed" ? 0 : 1,
      skipped: 0
    },
    specResults: [{
	      specId: "spec.windows.node-pool-create",
	      status: specStatus,
	      reason: resultReason,
	      category: resultCategory,
	      durationMs: surface === "live-azure-run" ? 240000 : 400
	    }]
	  };
  writeFileSync(join(resultDir, "result.json"), JSON.stringify(result, null, 2));
  if (surface === "live-azure-run" && status === "passed") {
    const cleanupStatus = process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STATUS || "delete-started";
    const cleanupStarted = process.env.FAKE_GH_SHARED_CLUSTER_CLEANUP_STARTED !== "0";
    const record = {
      clusterId: "shared-exec-cluster-01",
      resourceGroup: "rg-plan-001-windows-staging-000001",
      clusterName: "aks-plan-001-windows-staging-000001",
      status: "released",
      cleanupStatus,
      createdAt: "2026-06-30T00:00:00.000Z"
    };
    if (cleanupStarted) {
      record.cleanupStartedAt = "2026-06-30T00:30:00.000Z";
      record.cleanupReason = "vitest-global-teardown";
    }
    writeFileSync(join(sharedDir, "shared-exec-cluster-01.json"), JSON.stringify({
      ...record
    }, null, 2));
  }
  writeFileSync(join(artifactRoot, "runs", "workflow-metadata.json"), JSON.stringify({ loop_key: state.loopKey || "" }, null, 2));
  process.exit(0);
}
console.error(\`unexpected gh args: \${args.join(" ")}\`);
process.exit(1);
`,
    "utf8",
  );
  await chmod(join(binDir, "gh"), 0o755);

  const previous = {
    PATH: process.env.PATH,
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
    MAY_GITHUB_ACTIONS_POLL_MS: process.env.MAY_GITHUB_ACTIONS_POLL_MS,
    MAY_GITHUB_ACTIONS_RUN_LOOKUP_POLL_MS:
      process.env.MAY_GITHUB_ACTIONS_RUN_LOOKUP_POLL_MS,
  };
  const localBin = "/app/.state/.local/bin";
  const pathWithLocalBin = (process.env.PATH ?? "")
    .split(":")
    .includes(localBin)
    ? (process.env.PATH ?? "")
    : `${localBin}:${process.env.PATH ?? ""}`;
  process.env.PATH = `${binDir}:${pathWithLocalBin}`;
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
  process.env.MAY_GITHUB_ACTIONS_POLL_MS = "1";
  process.env.MAY_GITHUB_ACTIONS_RUN_LOOKUP_POLL_MS = "1";
  return () => {
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
    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];

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
    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];

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
    expect(dispatched).toHaveLength(1);
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

    const assignment = assignTask(config(projectDir), {
      taskId: "aks-feature-compact-loop",
    });
    const dispatched: Array<Record<string, unknown>> = [];
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
    const restoreGh = await installFakeGh(projectDir);
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

  test("planner marks done only after the live GitHub compact workflow passes", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installFakeGh(projectDir, "success");
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
    expect(result.message).toContain("live GitHub workflow passed");
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
    const restoreGh = await installFakeGh(projectDir, "failure");
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
    });
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
    const restoreGh = await installFakeGh(projectDir, "failure", {
      resultStatus: "nonpassing",
      resultReason:
        "Live Azure run failed staging AKS capacity preflight: westus2 has 161/161 managed clusters, so no concurrent new cluster create slots are available.",
      resultCategory: "environment_blocker",
    });
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
    });
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
    const restoreGh = await installFakeGh(projectDir, "success");
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
      "GitHub live compact workflow dispatch failed",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].problem).toMatchObject({
      category: "github-actions-dispatch",
    });
  });

  test("planner derives compact identity for reviewed follow-up tasks", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installFakeGh(projectDir, "success");
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
    expect(result.message).toContain("live GitHub workflow passed");
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("done");
    expect(String(completedEvents[0].summary)).not.toContain(
      "missing featureKey or capabilityId",
    );
  });

  test("planner rejects green compact workflow when artifact is only check validation", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    const restoreGh = await installFakeGh(projectDir, "success", {
      resultSurface: "check-validation",
    });
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
    const restoreGh = await installFakeGh(projectDir, "success", {
      resultReason: "Live Azure run passed.",
      sharedClusterCleanupStatus: "complete",
      sharedClusterCleanupStarted: false,
    });
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
    const restoreGh = await installFakeGh(projectDir, "success");
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
      expect(result.message).toContain("live GitHub workflow passed");
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
    });
    const dispatchMetadata = JSON.parse(
      await readFile(state.features.windows.lastDispatchMetadataPath, "utf8"),
    );
    expect(dispatchMetadata.dispatchResult.ok).toBe(true);
    expect(dispatchMetadata.inputs.metadata).toBeUndefined();
    const dispatchLog = (
      await readFile(
        join(projectDir, ".state", "fake-gh-dispatches.jsonl"),
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
    const restoreGh = await installFakeGh(projectDir, "success");
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
    const restoreGh = await installFakeGh(projectDir, "success");
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
        "Workflow run: 123 https://github.example/runs/123",
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
    const restoreGh = await installFakeGh(projectDir, "success");
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
      "live GitHub dispatch is intentionally blocked until the package becomes ready",
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
    const restoreGh = await installFakeGh(projectDir, "success");
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
        "Repair selected compact scenario tests so live execution is self-contained and live-admissible before retrying GitHub dispatch.",
      lastWorkflowRunId: null,
      lastWorkflowRunUrl: null,
      lastDispatchMetadataPath: null,
      lastWorkflowLoopKey: null,
    });
    expect(String(state.features.windows.lastSummary)).toContain(
      "GitHub dispatch skipped",
    );
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].problem).toMatchObject({
      action: "request",
      category: "feature-compact-live-policy",
    });
    try {
      await readFile(
        join(projectDir, ".state", "fake-gh-dispatches.jsonl"),
        "utf8",
      );
      throw new Error("expected no GitHub dispatch log");
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
        "Feature compact package done for windows; live GitHub workflow passed.",
      trace: {
        last_worker_result: "done",
        last_worker_summary:
          "Feature compact package done for windows; live GitHub workflow passed.",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
      lastLiveProofVersion: "live-aks-proof-v2",
      lastSummary:
        "Feature compact package done for windows; live GitHub workflow passed.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
      openChildren: 0,
      openSupportChildren: 1,
      blockedWaitChildren: 1,
      retryBudgetExhausted: 1,
      maxDirectAttemptsPerFeature: 2,
      unrepresentedNonTerminalCount: 0,
    });
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress.reason,
    ).toContain("non-terminal features");
    expect(
      updated.tasks["reconcile-compact-loop-package-partial"],
    ).toBeTruthy();
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
    const waitTask = updated.tasks["reconcile-compact-loop-staging-capacity"];
    expect(waitTask).toBeTruthy();
    expect(waitTask.state).toBe("blocked");
    expect(waitTask.blocker.category).toBe("external-wait");
    expect(waitTask.blocker.blocked_at).toBeTruthy();
    expect(waitTask.blocker.waiting_for).toMatchObject({
      type: "azure.capacity.available",
      target: "staging",
      resource: "managedClusters",
    });
    expect(waitTask.blocker.waiting_for.featureKeys).toContain("windows");
    expect(waitTask.blocker.observed_by).toMatchObject({
      workflow: "feature-compact-loop-controller",
      trigger: "project.task.tick",
    });
    expect(waitTask.blocker.observation_method).toContain("compact-loop tick");
    expect(waitTask.blocker.next_check_at).toBeTruthy();
    expect(waitTask.blocker.resume_condition).toContain(
      "managed-cluster headroom returns",
    );
    expect(waitTask.blocker.fallback_at).toBeTruthy();
    expect(waitTask.blocker.fallback_action).toContain("Recheck");
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        lastSummary: `Feature compact package for ${featureKey} is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.`,
      });
    }
    updateFeatureCompactItem(state, "network", {
      status: "error",
      taskId: "compact-feature-network",
      attempts: 2,
      lastSummary:
        "Feature compact live GitHub workflow failed for network. Run id 12345.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
    const capacityFollowups = Object.values(updated.tasks).filter(
      (task: any) => task.context?.errorClass === "staging-capacity",
    );
    expect(capacityFollowups).toHaveLength(0);
    expect(
      updated.tasks["aks-feature-compact-loop"].context.workflowProgress,
    ).toMatchObject({
      representedSupportErrorClasses: [],
      unrepresentedNonTerminalCount: 1,
      retryBudgetExhausted: 1,
    });
  });

  test("completed support task can reset exhausted compact retry budget with structured directive", async () => {
    const projectDir = await makeProject();
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
  });

  test("completed exact compact repair can infer retry reset from accepted rerun text", async () => {
    const projectDir = await makeProject();
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
      lastLiveProofVersion: "live-aks-proof-v2",
      lastSummary:
        "Feature compact package done for windows; live GitHub workflow passed.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
      trace: {
        last_worker_result: "partial",
        last_worker_summary:
          "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
      trace: {
        last_worker_result: "partial",
        last_worker_summary:
          "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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
      "live GitHub dispatch is intentionally blocked until the package becomes ready",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
        "Feature compact package for windows is partial; live GitHub dispatch is intentionally blocked until the package becomes ready.",
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

  test("controller keeps running feature when recorded GitHub run is active", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installFakeGh(projectDir);
    const fakeGhState = process.env.FAKE_GH_STATE;
    if (!fakeGhState) throw new Error("missing fake gh state path");
    await writeFile(
      fakeGhState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "in_progress",
            conclusion: "",
            url: "https://github.example/runs/123",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
    } finally {
      restoreGh();
    }
  });

  test("controller reconciles completed orphaned GitHub run before releasing running feature", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installFakeGh(projectDir, "success");
    const fakeGhState = process.env.FAKE_GH_STATE;
    if (!fakeGhState) throw new Error("missing fake gh state path");
    await writeFile(
      fakeGhState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "success",
            url: "https://github.example/runs/123",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
      expect(result.message).toContain("Reconciled 1 completed GitHub compact");
      expect(result.message).not.toContain("Released 1 stale running");
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      expect(saved.features.windows).toMatchObject({
        status: "done",
        lastWorkflowRunId: "123",
        lastLiveProofVersion: "live-aks-proof-v2",
      });
      expect(saved.features.windows.lastSummary).toContain(
        "Reconciled completed compact GitHub run 123",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller backfills stale error row from completed GitHub live proof", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installFakeGh(projectDir, "success");
    const fakeGhState = process.env.FAKE_GH_STATE;
    if (!fakeGhState) throw new Error("missing fake gh state path");
    await writeFile(
      fakeGhState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "success",
            url: "https://github.example/runs/123",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
        "Backfilled completed compact GitHub run 123",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller does not repeatedly backfill an already inspected failing run", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installFakeGh(projectDir, "success");
    const fakeGhState = process.env.FAKE_GH_STATE;
    if (!fakeGhState) throw new Error("missing fake gh state path");
    await writeFile(
      fakeGhState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "success",
            url: "https://github.example/runs/123",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
      lastLiveProofVersion: null,
      lastSummary:
        "Backfilled completed compact GitHub run 123 for windows; live proof is still failing.",
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
        "Backfilled completed compact GitHub run 123 for windows; live proof is still failing.",
      );
    } finally {
      restoreGh();
    }
  });

  test("controller preserves exact retryReason when backfilling a completed nonpassing run without capacity classification", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const restoreGh = await installFakeGh(projectDir, "failure", {
      resultStatus: "nonpassing",
      resultReason:
        "Run artifact bundle is incomplete; only workflow metadata and dispatch inputs were materialized locally.",
      resultCategory: "workflow_artifact_gap",
    });
    const fakeGhState = process.env.FAKE_GH_STATE;
    if (!fakeGhState) throw new Error("missing fake gh state path");
    await writeFile(
      fakeGhState,
      JSON.stringify(
        {
          run: {
            databaseId: 123,
            status: "completed",
            conclusion: "failure",
            url: "https://github.example/runs/123",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
        "Backfilled completed compact GitHub run 123 for windows; live proof is still failing.",
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
      lastWorkflowRunUrl: "https://github.example/runs/123",
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
          "Waiting for GitHub run 28775604245 terminal artifacts for the two-spec storage-csi slice.",
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

  test("controller moves terminal GitHub compact waits to review", async () => {
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
      goal: "Wait for windows compact GitHub workflow run 123456789 to finish.",
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
        condition: "Waiting for GitHub workflow run 123456789.",
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
        url: "https://github.example/runs/123456789",
        displayTitle: "Compact windows staging",
      }),
    });

    expect(result.harvestedTaskIds).toEqual(["wait-compact-windows-run"]);
    expect(result.terminalRunIds).toEqual(["123456789"]);
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["wait-compact-windows-run"]).toMatchObject({
      state: "review",
      context: {
        terminalGitHubWaitReview: {
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
      lastWorkflowRunUrl: "https://github.example/runs/123456789",
      observedBy: {
        workflow: "feature-compact-loop-controller",
        taskId: "wait-compact-windows-run",
        runId: "123456789",
      },
    });
  });

  test("controller leaves active GitHub compact waits blocked", async () => {
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
      goal: "Wait for windows compact GitHub workflow run 123456789 to finish.",
      inputs: ["feature:windows"],
      outputs: [],
      acceptance: ["Review terminal workflow result."],
      forbidden: [],
      conflict_scope: ["feature-compact:windows"],
      depends_on: [],
      blocker: {
        category: "external-wait",
        condition: "Waiting for GitHub workflow run 123456789.",
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
