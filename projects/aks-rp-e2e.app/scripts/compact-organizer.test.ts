import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "compact-organizer.ts",
);

async function runCompactOrganizer(
  args: string[],
  env: Record<string, string | undefined>,
) {
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    env,
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
  const root = await mkdtemp(join(tmpdir(), "aks-compact-organizer-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");

  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state", "feature-compact-loop"), {
    recursive: true,
  });
  await mkdir(join(projectDir, "features", "secops", "specs"), {
    recursive: true,
  });

  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify(
      {
        id: "aks-rp-e2e.app",
        policy: { maxConcurrent: 5 },
      },
      null,
      2,
    )}\n`,
  );

  const durableTree = {
    version: 1,
    project: "aks-rp-e2e",
    project_lifecycle: "active",
    root_task_id: "project",
    active_task_id: null,
    tasks: {
      project: {
        id: "project",
        state: "active",
        children: ["aks-feature-compact-loop"],
        goal: "project",
        outputs: ["tasks/tree.json"],
        acceptance: ["done"],
      },
      "aks-feature-compact-loop": {
        id: "aks-feature-compact-loop",
        parent_id: "project",
        state: "active",
        workflow: "feature-compact-loop-controller",
        kind: "workflow_controller",
        owner: "aks-explorer",
        children: [],
        goal: "compact loop",
        outputs: [".state/feature-compact-loop/state.json"],
        acceptance: ["done"],
      },
      "wait-secops-identity-sp-workflow-secret-contract-return-20260704": {
        id: "wait-secops-identity-sp-workflow-secret-contract-return-20260704",
        parent_id: "project",
        state: "blocked",
        kind: "domain_leaf",
        priority: "P2",
        owner: "aks-explorer",
        children: [],
        goal: "Carry exact secops secret wait.",
        outputs: ["evidence/archive/secops.md"],
        acceptance: ["reviewed"],
        forbidden: [],
        conflict_scope: ["feature:secops"],
        depends_on: [],
        blocker: { condition: "waiting for secrets" },
      },
    },
  };

  const runtimeTree = {
    ...durableTree,
    tasks: {
      ...durableTree.tasks,
      "aks-feature-compact-loop": {
        ...durableTree.tasks["aks-feature-compact-loop"],
        children: [
          "hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707",
        ],
      },
      "hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707": {
        id: "hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707",
        parent_id: "aks-feature-compact-loop",
        state: "blocked",
        kind: "domain_leaf",
        priority: "P2",
        owner: "aks-explorer",
        children: [],
        goal: "Preserve exact cluster-autoscaler frontier.",
        outputs: ["evidence/archive/cluster-autoscaler.md"],
        acceptance: ["reviewed"],
        forbidden: [],
        conflict_scope: ["feature:cluster-autoscaler"],
        depends_on: [],
        blocker: { condition: "waiting for evidence" },
      },
    },
  };

  await writeFile(
    join(appDir, "tasks", "tree.json"),
    `${JSON.stringify(durableTree, null, 2)}\n`,
  );
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    `${JSON.stringify(runtimeTree, null, 2)}\n`,
  );
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");

  await writeFile(
    join(appDir, ".state", "feature-compact-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 1,
        cursor: 0,
        features: {
          secops: {
            featureKey: "secops",
            capabilityId: "secops",
            packetPath: "features/secops.yaml",
            specsDir: "features/secops/specs",
            specCount: 1,
            status: "error",
            errorClass: "package-partial",
            retryable: true,
            retryReason: "needs exact wait",
            taskId:
              "hold-compact-secops-identity-pair-published-workflow-secret-frontier-20260707c",
            attempts: 1,
            lastPlanPath: null,
            lastSummaryPath: null,
            lastDiagnosticsPath: null,
            lastResultPath: null,
            lastWorkflowRunId: null,
            lastWorkflowRunUrl: null,
            lastWorkflowLoopKey: null,
            lastDispatchMetadataPath: null,
            lastLiveProofVersion: null,
            activeAttemptId: null,
            activeTaskSessionId: null,
            activeWorkflowRunId: null,
            heartbeatAt: null,
            lastSummary: null,
            updatedAt: "2026-07-07T00:00:00.000Z",
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    join(projectDir, "features", "secops.yaml"),
    "capabilityId: secops\n",
    "utf8",
  );
  await writeFile(
    join(projectDir, "features", "secops", "specs", "identity.json"),
    JSON.stringify({ id: "spec.secops.identity" }),
    "utf8",
  );

  return { root, appDir, projectDir };
}

describe("compact-organizer CLI", () => {
  test("publish-holder copies a runtime holder into the durable tree", async () => {
    const fixture = await makeFixture();

    const result = await runCompactOrganizer(
      [
        "publish-holder",
        "hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707",
        "--source",
        "runtime",
        "--target",
        "durable",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      results?: Array<{ action?: string; surface?: string }>;
    };
    expect(parsed.results?.[0]).toMatchObject({
      surface: "durable",
      action: "created",
    });

    const durableTree = JSON.parse(
      await readFile(join(fixture.appDir, "tasks", "tree.json"), "utf8"),
    ) as {
      tasks: Record<string, Record<string, unknown>>;
    };
    expect(
      durableTree.tasks[
        "hold-compact-cluster-autoscaler-vm-prerelease-current-head-frontier-20260707"
      ],
    ).toMatchObject({
      parent_id: "aks-feature-compact-loop",
      state: "blocked",
      goal: "Preserve exact cluster-autoscaler frontier.",
    });
  });

  test("upsert-holder creates a new holder in both trees", async () => {
    const fixture = await makeFixture();

    const result = await runCompactOrganizer(
      [
        "upsert-holder",
        "wait-compact-machines-agentpool-run-28809049156-review-20260707",
        "--target",
        "both",
        "--parent",
        "aks-feature-compact-loop",
        "--state",
        "blocked",
        "--goal",
        "Preserve exact same-spec compact rerun result 28809049156.",
        "--output",
        "../aks-rp-e2e/evidence/archive/machines-agentpool.md",
        "--acceptance",
        "Review run 28809049156 or supersede it with a materially changed rerun surface.",
        "--conflict-scope",
        "feature:machines-agentpool",
        "--blocker",
        "Blocked on exact run 28809049156 review.",
        "--blocker-category",
        "external-wait",
        "--blocker-owner",
        "aks-explorer",
        "--resume-condition",
        "Resume when run 28809049156 is ready for exact review.",
        "--resume-at",
        "2099-06-26T00:00:00.000Z",
        "--next-check-at",
        "2099-06-26T12:00:00.000Z",
        "--fallback-at",
        "2099-06-27T00:00:00.000Z",
        "--fallback-action",
        "Escalate if the run is still not reviewable.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      results?: Array<{ action?: string; surface?: string }>;
    };
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ surface: "runtime", action: "created" }),
        expect.objectContaining({ surface: "durable", action: "created" }),
      ]),
    );

    for (const path of [
      join(fixture.appDir, "tasks", "tree.json"),
      join(fixture.appDir, ".state", "tasks", "tree.json"),
    ]) {
      const tree = JSON.parse(await readFile(path, "utf8")) as {
        tasks: Record<string, Record<string, unknown>>;
      };
      expect(
        tree.tasks[
          "wait-compact-machines-agentpool-run-28809049156-review-20260707"
        ],
      ).toMatchObject({
        parent_id: "aks-feature-compact-loop",
        state: "blocked",
        goal: "Preserve exact same-spec compact rerun result 28809049156.",
        blocker: {
          condition: "Blocked on exact run 28809049156 review.",
          category: "external-wait",
          owner: "aks-explorer",
          resume_condition:
            "Resume when run 28809049156 is ready for exact review.",
          resume_at: "2099-06-26T00:00:00.000Z",
          next_check_at: "2099-06-26T12:00:00.000Z",
          fallback_at: "2099-06-27T00:00:00.000Z",
          fallback_action: "Escalate if the run is still not reviewable.",
        },
      });
    }
  });

  test("blocked upsert-holder requires --blocker-owner", async () => {
    const fixture = await makeFixture();

    const result = await runCompactOrganizer(
      [
        "upsert-holder",
        "wait-compact-missing-owner-check-20260708",
        "--target",
        "runtime",
        "--parent",
        "aks-feature-compact-loop",
        "--state",
        "blocked",
        "--goal",
        "Preserve exact compact wait without owner should fail.",
        "--output",
        "../aks-rp-e2e/evidence/archive/missing-owner-check.md",
        "--acceptance",
        "blocked holders require explicit blocker owner",
        "--conflict-scope",
        "feature:test",
        "--blocker",
        "Blocked on exact review surface.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Blocked tasks require --blocker-owner",
    );
  });

  test("bind-task updates feature-compact-loop taskId to an existing holder", async () => {
    const fixture = await makeFixture();

    const result = await runCompactOrganizer(
      [
        "bind-task",
        "secops",
        "--task-id",
        "wait-secops-identity-sp-workflow-secret-contract-return-20260704",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      beforeTaskId?: string | null;
      afterTaskId?: string | null;
      taskExists?: { durable?: boolean; runtime?: boolean };
    };
    expect(parsed.beforeTaskId).toBe(
      "hold-compact-secops-identity-pair-published-workflow-secret-frontier-20260707c",
    );
    expect(parsed.afterTaskId).toBe(
      "wait-secops-identity-sp-workflow-secret-contract-return-20260704",
    );
    expect(parsed.taskExists).toMatchObject({ durable: true, runtime: true });

    const state = JSON.parse(
      await readFile(
        join(fixture.appDir, ".state", "feature-compact-loop", "state.json"),
        "utf8",
      ),
    ) as {
      features: Record<string, Record<string, unknown>>;
    };
    expect(state.features.secops?.taskId).toBe(
      "wait-secops-identity-sp-workflow-secret-contract-return-20260704",
    );
  });
});
