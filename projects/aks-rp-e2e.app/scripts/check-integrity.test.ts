import { resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const durableLoopWaitStewardshipModulePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "workflows",
  "lib",
  "durable-loop-wait-stewardship.ts",
);

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "check-integrity.ts",
);

const fixtureProjectGoal = "Deliver durable AKS verification outcomes.";

async function runIntegrity(appDir: string) {
  const proc = Bun.spawn(["bun", scriptPath], {
    cwd: appDir,
    env: {
      ...process.env,
      PROJECT_APP_DIR: appDir,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-check-integrity-"));
  const appDir = join(root, "projects", "aks-rp-e2e.app");
  const domainDir = join(root, "projects", "aks-rp-e2e");

  await mkdir(appDir, { recursive: true });
  await mkdir(join(appDir, "agents", "aks-explorer"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, "workflows", "lib"), { recursive: true });
  await mkdir(join(appDir, "scripts"), { recursive: true });
  await mkdir(join(appDir, ".state", "feature-reference-loop"), {
    recursive: true,
  });
  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
  await mkdir(join(appDir, ".state", "feature-compact-loop"), {
    recursive: true,
  });
  await mkdir(join(domainDir, "runner"), { recursive: true });

  await writeFile(
    join(domainDir, "runner", "spec-runner.ts"),
    "export {}\n",
    "utf8",
  );

  await writeFile(
    join(appDir, "package.json"),
    `${JSON.stringify(
      {
        scripts: {
          bundle: "echo bundle",
          check: "echo check",
          integrity: "echo integrity",
          syntax: "echo syntax",
          typecheck: "echo typecheck",
          test: "echo test",
          format: "echo format",
          "format:check": "echo format:check",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify(
      {
        id: "aks-rp-e2e.app",
        owner: "aks-explorer",
        type: "project-app",
        goal: fixtureProjectGoal,
        domainProject: {
          id: "aks-rp-e2e.app",
          path: "../aks-rp-e2e",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    join(appDir, "app.ts"),
    `export default {
  id: "aks-rp-e2e.app",
  workspace: {
    localPath: "../aks-rp-e2e",
    repo: "git@example.com:repo.git",
    branch: "main",
  },
  workflowHandlers: [
    {
      name: "feature-reference-loop-handler",
      accepts: [{ type: "project.task.tick", target: { project: "aks-rp-e2e.app" } }],
      handler: {
        workflow: "feature-reference-loop-controller",
        task: "app: /tmp\\nproject: /tmp",
      },
      emits: ["project.task.completed"],
    },
  ],
  schedules: [],
  actions: {},
  eventGraph: {
    externalEvents: ["project.task.tick", "project.task.completed"],
  },
};
`,
    "utf8",
  );

  await writeFile(
    join(appDir, "workflows", "feature-reference-loop-controller.ts"),
    "export const name = 'feature-reference-loop-controller';\nexport const workflowContract = { workflow: name, version: 'test' };\n",
    "utf8",
  );
  await writeFile(
    join(appDir, "workflows", "spec-loop-controller.ts"),
    "export const name = 'spec-loop-controller';\nexport const workflowContract = { workflow: name, version: 'test' };\n",
    "utf8",
  );
  await writeFile(
    join(appDir, "workflows", "feature-compact-loop-controller.ts"),
    "export const name = 'feature-compact-loop-controller';\nexport const workflowContract = { workflow: name, version: 'test' };\n",
    "utf8",
  );

  await writeFile(
    join(appDir, "workflows", "lib", "durable-loop-wait-stewardship.ts"),
    await Bun.file(durableLoopWaitStewardshipModulePath).text(),
    "utf8",
  );

  const initialTree = {
    version: 1,
    project: "aks-rp-e2e",
    project_lifecycle: "active",
    root_task_id: "project",
    active_task_id:
      "repair-feature-reference-loop-dormant-backlog-metadata-contract-20260628",
    active_task_ids: [
      "repair-feature-reference-loop-dormant-backlog-metadata-contract-20260628",
    ],
    tasks: {
      project: {
        id: "project",
        state: "active",
        children: [
          "aks-spec-verification-loop",
          "aks-feature-reference-loop",
          "aks-feature-compact-loop",
        ],
        goal: fixtureProjectGoal,
        outputs: ["tasks/tree.json"],
        acceptance: ["done"],
      },
      "aks-spec-verification-loop": {
        id: "aks-spec-verification-loop",
        parent_id: "project",
        state: "done",
        workflow: "spec-loop-controller",
        children: [],
        goal: "Verify specs.",
        outputs: [".state/spec-loop/state.json"],
        acceptance: ["Loop is current"],
      },
      "aks-feature-reference-loop": {
        id: "aks-feature-reference-loop",
        parent_id: "project",
        state: "active",
        workflow: "feature-reference-loop-controller",
        children: [
          "repair-feature-reference-loop-dormant-backlog-metadata-contract-20260628",
        ],
        goal: "Collect official references.",
        outputs: [".state/feature-reference-loop/state.json"],
        acceptance: ["Loop is current"],
        forbidden: [],
        conflict_scope: ["feature-reference-loop"],
        depends_on: [],
        context: {
          stateRef: ".state/feature-reference-loop/state.json",
          workflowProgress: {
            completionReady: true,
            reason:
              "feature-reference loop has no active refill work; dormant backlog is preserved outside the workflow guard path",
            pending: 0,
            running: 0,
            done: 204,
            blocked: 0,
            error: 0,
            dormant: 76,
            stale: 24,
            holdMode: "dormant-backlog-preserved",
            noRefillNow: true,
            openChildren: 1,
            lastPulseCreated: 0,
            lastPulseAssigned: 0,
            updatedAt: new Date().toISOString(),
          },
        },
      },
      "aks-feature-compact-loop": {
        id: "aks-feature-compact-loop",
        parent_id: "project",
        state: "done",
        workflow: "feature-compact-loop-controller",
        children: [],
        goal: "Compact feature tests.",
        outputs: [".state/feature-compact-loop/state.json"],
        acceptance: ["Loop is current"],
      },
      "repair-feature-reference-loop-dormant-backlog-metadata-contract-20260628":
        {
          id: "repair-feature-reference-loop-dormant-backlog-metadata-contract-20260628",
          parent_id: "aks-feature-reference-loop",
          state: "active",
          kind: "domain_leaf",
          priority: "P2",
          owner: "aks-explorer",
          children: [],
          goal: "Repair metadata contract.",
          outputs: ["evidence/archive/repair.md"],
          acceptance: ["done"],
          forbidden: [],
          conflict_scope: ["feature-reference-loop-state-truth"],
          depends_on: [],
        },
    },
  };

  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(initialTree, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(initialTree, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    join(appDir, ".state", "feature-reference-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-feature-reference-loop",
        windowSize: 25,
        cursor: 0,
        holdState: {
          mode: "dormant-backlog-preserved",
          staleFeatureKeys: ["alpha"],
          dormantFeatureKeys: ["beta"],
          reopenDefaultFeatureKeys: ["beta"],
          noRefillNow: true,
          note: "hold",
          updatedAt: new Date().toISOString(),
        },
        features: {
          alpha: {
            featureKey: "alpha",
            packetPath: "features/alpha.yaml",
            packetKind: "feature",
            layout: "migration-root-feature",
            capabilityId: null,
            coveredFeatureIds: [],
            status: "stale",
            taskId: "missing-child",
            attempts: 0,
            lastOutputPath: null,
            lastSummary: null,
            updatedAt: new Date().toISOString(),
          },
          beta: {
            featureKey: "beta",
            packetPath: "features/beta.yaml",
            packetKind: "feature",
            layout: "migration-root-feature",
            capabilityId: null,
            coveredFeatureIds: [],
            status: "dormant",
            taskId: null,
            attempts: 0,
            lastOutputPath: null,
            lastSummary: null,
            updatedAt: new Date().toISOString(),
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { root, appDir };
}

describe("check-integrity durable loop contracts", () => {
  test("accepts held feature-reference loop metadata when active refill counts are zeroed", async () => {
    const fixture = await makeFixture();
    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("App integrity OK");
  });

  test("reports parent rollup drift as an owner hint without rewriting project judgment", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());
    tree.tasks["aks-feature-reference-loop"].state = "backlog";
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "task aks-feature-reference-loop state backlog has child rollup hint active",
    );
  });

  test("accepts explicit task workflow binding names in reconciler-owned tasks", async () => {
    const fixture = await makeFixture();
    const appPath = join(fixture.appDir, "app.ts");
    const appSource = await Bun.file(appPath).text();
    await writeFile(
      appPath,
      appSource.replace(
        "  schedules: [],",
        `  taskWorkflows: {
    "reviewed-task-applier": {
      workflow: "feature-reference-loop-controller",
      task: "apply one review",
      timeoutMs: 60000,
      context: [],
    },
  },
  schedules: [],`,
      ),
      "utf8",
    );

    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());
    tree.tasks.project.children.push("runtime/review-application/test-review");
    tree.tasks["runtime/review-application/test-review"] = {
      id: "runtime/review-application/test-review",
      parent_id: "project",
      state: "backlog",
      children: [],
      goal: "Apply one review exactly once.",
      outputs: [".state/planner-runs.jsonl"],
      acceptance: ["The review is applied or recorded stale."],
      workflow: "reviewed-task-applier",
      reconcile_mode: "achieve",
      context: { reconciliation: { phase: "converged" } },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("App integrity OK");
  });

  test("rejects a runtime root goal that replaces the configured project goal", async () => {
    const fixture = await makeFixture();
    await writeFile(
      join(fixture.appDir, "project.json"),
      `${JSON.stringify(
        {
          id: "aks-rp-e2e.app",
          owner: "aks-explorer",
          type: "project-app",
          goal: "Refresh blocked-wait bookkeeping forever.",
          domainProject: {
            id: "aks-rp-e2e.app",
            path: "../aks-rp-e2e",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await runIntegrity(fixture.appDir);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "runtime task tree project root goal must match project.json goal",
    );
  });

  test("accepts durable loop roots blocked on child waits even when progress open counters are stale", async () => {
    const fixture = await makeFixture();
    await writeFile(
      resolveTaskTreePath(fixture.appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "blocked",
              children: [
                "aks-spec-verification-loop",
                "aks-feature-reference-loop",
                "aks-feature-compact-loop",
              ],
              goal: fixtureProjectGoal,
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "done",
              workflow: "spec-loop-controller",
              children: [],
              goal: "Verify specs.",
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Loop is current"],
            },
            "aks-feature-reference-loop": {
              id: "aks-feature-reference-loop",
              parent_id: "project",
              state: "done",
              workflow: "feature-reference-loop-controller",
              children: [],
              goal: "Collect official references.",
              outputs: [".state/feature-reference-loop/state.json"],
              acceptance: ["Loop is current"],
            },
            "aks-feature-compact-loop": {
              id: "aks-feature-compact-loop",
              parent_id: "project",
              state: "blocked",
              workflow: "feature-compact-loop-controller",
              children: ["wait-compact-external-signal"],
              goal: "Keep compact loop moving.",
              outputs: [".state/feature-compact-loop/state.json"],
              acceptance: ["Loop is current"],
              context: {
                workflowProgress: {
                  completionReady: false,
                  reason:
                    "feature-compact loop state still has non-terminal features",
                  pending: 0,
                  running: 0,
                  error: 3,
                  unrepresentedNonTerminalCount: 0,
                  openChildren: 0,
                  openSupportChildren: 1,
                  blockedWaitChildren: 1,
                },
              },
            },
            "wait-compact-external-signal": {
              id: "wait-compact-external-signal",
              parent_id: "aks-feature-compact-loop",
              state: "blocked",
              goal: "Wait for exact signal.",
              outputs: ["evidence/archive/wait.md"],
              acceptance: ["Signal returned"],
              blocker: {
                condition: "external signal required",
                category: "external-wait",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("App integrity OK");
  });

  test("does not treat focus observation prose as task-tree structure", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await Bun.file(treePath).text());

    tree.tasks.project.context = {
      current_focus_proposal: {
        id: "focus-owner-return-test",
        reason:
          "The live owner-return holder set is now focus-owner-return-test, wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175; the consumed wait should have been removed.",
      },
    };
    tree.tasks.project.children.push("focus-owner-return-test");
    tree.tasks["focus-owner-return-test"] = {
      id: "focus-owner-return-test",
      parent_id: "project",
      kind: "focus_plan",
      state: "blocked",
      children: [],
      goal: "Keep the owner-return lineage visible.",
      outputs: ["evidence/archive/focus-owner-return-test.md"],
      acceptance: ["Live holder set is current."],
      context: {
        progress_review: {
          evidence: [
            "2026-07-13T17:14:11.012Z the current live owner-return blocked-holder set is focus-owner-return-test, wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175.",
          ],
        },
        observations: {
          linked_blocked_task_ids: [
            "focus-owner-return-test",
            "wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175",
          ],
        },
      },
      blocker: {
        condition: "Waiting for exact owner-return decision.",
        category: "human-approval",
        owner: "human",
        blocked_at: "2026-07-13T17:14:11.012Z",
        waiting_for: {
          type: "project.approval.submitted",
          taskId: "focus-owner-return-test",
        },
        observed_by: {
          workflow: "project-planner",
          trigger: "project.approval.submitted",
        },
        observation_method: "Planner reconciles the returned approval.",
        next_check_at: "2026-07-14T01:14:11.012Z",
        resume_condition: "Resume when the owner responds.",
        fallback_at: "2026-07-14T13:14:11.012Z",
        fallback_action: "Refresh the same wait.",
      },
    };

    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("App integrity OK");
  });

  test("rejects direct feature carriers that still preserve wrapper-plus-plain scenario files", async () => {
    const fixture = await makeFixture();
    const domainDir = resolve(fixture.appDir, "..", "aks-rp-e2e");

    await mkdir(join(domainDir, "features", "net-integration", "tests"), {
      recursive: true,
    });
    await mkdir(join(domainDir, "features", "net-integration", "specs"), {
      recursive: true,
    });
    await mkdir(join(domainDir, "features", "net-integration", "packets"), {
      recursive: true,
    });
    await mkdir(join(domainDir, "features", "net-integration", "compact"), {
      recursive: true,
    });

    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "tests",
        "net-integration-row166.test.ts",
      ),
      [
        'import { execFile } from "node:child_process";',
        'const legacySiblingFsPath = "features/net-integration/tests/net-integration-row166.ts";',
        'const replayPath = "features/net-integration/tests/net-integration-row166.ts";',
        "void console.log(legacySiblingFsPath);",
        'void execFile("bun", [replayPath]);',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "tests",
        "net-integration-row166.ts",
      ),
      [
        "#!/usr/bin/env bun",
        'const probeName = "net-integration-row166";',
        'const specId = "spec.net-integration.row166";',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "specs",
        "net-integration-row166.json",
      ),
      `${JSON.stringify(
        {
          id: "spec.net-integration.row166",
          probeRef:
            "features/net-integration/tests/net-integration-row166.test.ts",
          implementation: {
            path: "features/net-integration/tests/net-integration-row166.test.ts",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "packets",
        "net-integration-row166.yaml",
      ),
      [
        "probeRef: features/net-integration/tests/net-integration-row166.ts",
        "replayRef: features/net-integration/tests/net-integration-row166.ts",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "compact",
        "staging.plan.json",
      ),
      `${JSON.stringify(
        {
          scenarioTestPath:
            "features/net-integration/tests/net-integration-row166.ts",
          replay: "features/net-integration/tests/net-integration-row166.ts",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "feature-scenario-carrier-wrapper-plus-plain",
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      "feature-scenario-carrier-maintained-surface-points-plain",
    );
  });

  test("allows ordinary support modules beside a direct feature carrier", async () => {
    const fixture = await makeFixture();
    const domainDir = resolve(fixture.appDir, "..", "aks-rp-e2e");

    await mkdir(join(domainDir, "features", "net-integration", "tests"), {
      recursive: true,
    });
    await mkdir(join(domainDir, "features", "net-integration", "specs"), {
      recursive: true,
    });

    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "tests",
        "net-integration-clean.test.ts",
      ),
      'export const directVitestPath = "features/net-integration/tests/net-integration-clean.test.ts";\n',
      "utf8",
    );
    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "tests",
        "shared-support.ts",
      ),
      'export function sharedSupport() { return "ok"; }\n',
      "utf8",
    );
    await writeFile(
      join(
        domainDir,
        "features",
        "net-integration",
        "specs",
        "net-integration-clean.json",
      ),
      `${JSON.stringify(
        {
          id: "spec.net-integration.clean",
          probeRef:
            "features/net-integration/tests/net-integration-clean.test.ts",
          implementation: {
            path: "features/net-integration/tests/net-integration-clean.test.ts",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("App integrity OK");
  });

  test("rejects git-tracked project-app runtime files", async () => {
    const fixture = await makeFixture();
    execFileSync("git", ["init"], { cwd: fixture.root });
    execFileSync(
      "git",
      ["add", "-f", "projects/aks-rp-e2e.app/.state/tasks/tree.json"],
      { cwd: fixture.root },
    );

    const result = await runIntegrity(fixture.appDir);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "project-app runtime files must not be tracked by git",
    );
    expect(`${result.stdout}${result.stderr}`).toContain(
      "projects/aks-rp-e2e.app/.state/tasks/tree.json",
    );
  });
});
