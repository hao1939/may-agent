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

  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
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
            goal: "project",
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
      },
      null,
      2,
    )}\n`,
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

    expect(result.exitCode).toBe(0);
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
