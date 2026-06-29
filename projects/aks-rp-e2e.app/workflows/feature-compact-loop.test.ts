import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  peekTaskAssignments,
  taskTreeConfig,
} from "./lib/task-tree-tools.ts";
import { execute as executeController } from "./feature-compact-loop-controller.ts";
import { execute as executePlanner } from "./feature-compact-planner.ts";
import { loadFeatureCompactRecords } from "./lib/feature-compact-loop-store.ts";

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

async function writeFakeCompactRunner(projectDir: string) {
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
writeFileSync(planPath, JSON.stringify({ id: \`feature-compact-\${capability}-\${target}\`, kind: "feature-compact-plan" }, null, 2));
writeFileSync(summaryPath, \`# \${capability} compact\\n\`);
writeFileSync(diagnosticsPath, JSON.stringify({
  packageStatus: "ready",
  planPath,
  summaryPath,
  metrics: { specsSelected: 1, clustersNeeded: 1, baselineClusterCount: 1, clustersSaved: 0 }
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
    join(projectDir, "tasks", "tree.json"),
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
      await readFile(join(projectDir, "tasks", "tree.json"), "utf8"),
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

  test("planner generates package, runs generated checks, and marks ready", async () => {
    const projectDir = await makeProject();
    await writeFakeCompactRunner(projectDir);
    await writeRootTree(projectDir);
    const treePath = join(projectDir, "tasks", "tree.json");
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
    expect(result.message).toContain("Feature compact package ready");
    const state = JSON.parse(
      await readFile(
        join(projectDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    );
    expect(state.features.windows).toMatchObject({
      status: "ready",
      lastPlanPath: "features/windows/compact/staging.plan.json",
      lastDiagnosticsPath: "features/windows/compact/staging.diagnostics.json",
      lastResultPath:
        "runs/test-results/feature-compact-windows-staging_000001",
    });
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].result).toBe("done");
  });

  test("controller accepts completed compact package reviews", async () => {
    const projectDir = await makeProject();
    await writeRootTree(projectDir);
    const treePath = join(projectDir, "tasks", "tree.json");
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
      result: "Feature compact package ready for windows.",
      trace: {
        last_worker_result: "done",
        last_worker_summary: "Feature compact package ready for windows.",
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
      "Accepted 1 completed compact package review",
    );
    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["compact-feature-windows"].state).toBe("done");
  });
});
