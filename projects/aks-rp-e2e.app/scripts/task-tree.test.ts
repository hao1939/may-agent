import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "task-tree.ts",
);

async function runTaskTree(
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

async function makeFixture(options?: {
  projectJson?: Record<string, unknown>;
}) {
  const root = await mkdtemp(join(tmpdir(), "aks-task-tree-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");

  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });

  await writeFile(
    join(appDir, "project.json"),
    `${JSON.stringify(
      options?.projectJson ?? {
        id: "aks-rp-e2e.app",
        policy: { maxConcurrent: 5 },
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        active_task_id: "active-task",
        active_task_ids: ["active-task"],
        tasks: {
          project: {
            id: "project",
            state: "active",
            children: ["active-task", "backlog-task"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "active-task": {
            id: "active-task",
            parent_id: "project",
            state: "active",
            kind: "domain_leaf",
            priority: "P2",
            owner: "aks-explorer",
            children: [],
            goal: "Existing active task.",
            outputs: ["evidence/archive/active-task.md"],
            acceptance: ["reviewed"],
            forbidden: [],
            conflict_scope: ["feature:active"],
            depends_on: [],
          },
          "backlog-task": {
            id: "backlog-task",
            parent_id: "project",
            state: "backlog",
            kind: "domain_leaf",
            priority: "P2",
            owner: "aks-explorer",
            children: [],
            goal: "Runnable backlog task.",
            outputs: ["evidence/archive/backlog-task.md"],
            acceptance: ["reviewed"],
            forbidden: [],
            conflict_scope: ["feature:backlog"],
            depends_on: [],
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  return { root, appDir, projectDir };
}

describe("task-tree CLI", () => {
  test("assign honors project policy maxConcurrent by default when --max and env are absent", async () => {
    const fixture = await makeFixture();

    const result = await runTaskTree(["assign", "backlog-task"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      taskId?: string;
      worker?: string;
    };
    expect(parsed.taskId).toBe("backlog-task");
    expect(parsed.worker).toBe("aks-explorer");
  });

  test("falls back to 1 without hidden policy assumptions when project.json has no policy.maxConcurrent", async () => {
    const fixture = await makeFixture({
      projectJson: {
        id: "aks-rp-e2e.app",
      },
    });

    const result = await runTaskTree(["assign", "backlog-task"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Worker capacity is full (1)",
    );
  });

  test("MAX_CONCURRENT env still overrides project policy when --max is omitted", async () => {
    const fixture = await makeFixture();

    const result = await runTaskTree(["assign", "backlog-task"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
      MAX_CONCURRENT: "1",
    });

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Worker capacity is full (1)",
    );
  });

  test("repair-rollups normalizes legacy focus approval state to blocked wait", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks.project.children.push("focus-needs-approval");
    tree.tasks["focus-needs-approval"] = {
      id: "focus-needs-approval",
      parent_id: "project",
      state: "needs_approval",
      status: "needs_approval",
      kind: "focus_plan",
      priority: "P1",
      owner: "aks-explorer",
      children: [],
      goal: "Propose a bounded focus plan.",
      outputs: ["tasks/tree.json"],
      acceptance: ["human approval decision is applied"],
      context: {
        needs_approval: true,
      },
      updated_at: "2026-07-10T05:58:00.000Z",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const repaired = await runTaskTree(["repair-rollups"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      changed: true,
      repairedLegacyFocusApprovalStates: ["focus-needs-approval"],
    });

    const updatedTree = JSON.parse(await readFile(treePath, "utf8"));
    const focus = updatedTree.tasks["focus-needs-approval"];
    expect(focus.state).toBe("blocked");
    expect(focus.status).toBeUndefined();
    expect(focus.blocker).toMatchObject({
      category: "human-approval",
      owner: "human",
      waiting_for: {
        type: "project.approval.submitted",
        approvalKind: "focus-plan",
        taskId: "focus-needs-approval",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "project.approval.submitted",
      },
    });
    expect(focus.blocker.fallback_at).toBeTruthy();
    expect(focus.context.needs_approval).toBe(true);
  });

  test("show surfaces context rollup_summary when the root task field is stale", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks.project.rollup_summary =
      "stale repo-local VM prerelease parity sweep";
    tree.tasks.project.context = {
      rollup_summary: "truthful blocked-only approval wait stewardship summary",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const shown = await runTaskTree(["show", "project"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(shown.exitCode).toBe(0);
    const parsed = JSON.parse(shown.stdout) as {
      rollup_summary?: string;
      context?: { rollup_summary?: string };
    };
    expect(parsed.rollup_summary).toBe(
      "truthful blocked-only approval wait stewardship summary",
    );
    expect(parsed.context?.rollup_summary).toBe(
      "truthful blocked-only approval wait stewardship summary",
    );
  });

  test("mark-done refuses to close an active started attempt", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf-8")) as {
      tasks: Record<string, Record<string, unknown>>;
    };
    tree.tasks["active-task"].trace = {
      current_attempt_id: "attempt-active-1",
      worker_started_attempt_id: "attempt-active-1",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const result = await runTaskTree(
      [
        "mark-done",
        "active-task",
        "--resolution",
        "replaced",
        "--summary",
        "owner cleanup should not close an active assignment",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "active with current started attempt attempt-active-1",
    );
  });

  test("mark-done accepts explicit task revision and attempt correlation", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf-8")) as {
      tasks: Record<string, Record<string, unknown>>;
    };
    tree.tasks.project.children.push("review-task");
    tree.tasks["review-task"] = {
      id: "review-task",
      parent_id: "project",
      state: "review",
      revision: 2,
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Reviewed task awaiting accepted close.",
      outputs: ["evidence/archive/review-task.md"],
      acceptance: ["review accepted"],
      forbidden: [],
      conflict_scope: ["feature:review"],
      depends_on: [],
      trace: {
        current_attempt_id: "attempt-review-2",
      },
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const missingCorrelation = await runTaskTree(
      [
        "mark-done",
        "review-task",
        "--summary",
        "accepted review without correlation should fail",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(missingCorrelation.exitCode).toBe(1);
    expect(
      `${missingCorrelation.stdout}${missingCorrelation.stderr}`,
    ).toContain("requires taskRevision 2");

    const correlated = await runTaskTree(
      [
        "mark-done",
        "review-task",
        "--summary",
        "accepted review with explicit correlation succeeds",
        "--task-revision",
        "2",
        "--attempt-id",
        "attempt-review-2",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(correlated.exitCode).toBe(0);
    const parsed = JSON.parse(correlated.stdout) as {
      state?: string;
      done_at?: string;
      context?: { acceptance_note?: string };
      trace?: { review_summary?: string };
    };
    expect(parsed.state).toBe("done");
    expect(parsed.done_at).toBeTruthy();
    expect(parsed.context?.acceptance_note).toBe(
      "accepted review with explicit correlation succeeds",
    );
    expect(parsed.trace?.review_summary).toBe(
      "accepted review with explicit correlation succeeds",
    );
  });

  test("defaults ops-prefixed added tasks to app-ops owner", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "ops/review-future-window",
        "--parent",
        "project",
        "--goal",
        "Recheck one exact blocked-frontier review window.",
        "--output",
        "evidence/archive/ops-review-future-window.md",
        "--acceptance",
        "review window remains truthfully represented",
        "--state",
        "blocked",
        "--blocker",
        "Wait until the review window opens.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);
    expect(JSON.parse(add.stdout).owner).toBe("app-ops");

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["ops/review-future-window"].owner).toBe("app-ops");
  });

  test("add and update-text support structured blocker resume metadata", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "blocked-task",
        "--parent",
        "project",
        "--goal",
        "Wait for operator proof.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "proof reviewed",
        "--state",
        "blocked",
        "--blocker",
        "Waiting for returned operator proof.",
        "--blocker-category",
        "external-wait",
        "--blocker-owner",
        "human",
        "--resume-condition",
        "Resume when proof lands.",
        "--resume-at",
        "2099-06-26T00:00:00.000Z",
        "--next-check-at",
        "2099-06-26T12:00:00.000Z",
        "--fallback-at",
        "2099-06-27T00:00:00.000Z",
        "--fallback-action",
        "Escalate if proof has not landed.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);
    expect(JSON.parse(add.stdout).blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      category: "external-wait",
      owner: "human",
      waiting_for: {
        type: "blocker.resolved",
        taskId: "blocked-task",
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-app-ops-review",
        trigger: "project.owner.requested",
      },
      observation_method:
        "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
      resume_condition: "Resume when proof lands.",
      resume_at: "2099-06-26T00:00:00.000Z",
      next_check_at: "2099-06-26T12:00:00.000Z",
      fallback_at: "2099-06-27T00:00:00.000Z",
      fallback_action: "Escalate if proof has not landed.",
    });

    const update = await runTaskTree(
      [
        "update-text",
        "blocked-task",
        "--resume-at",
        "2099-06-27T00:00:00.000Z",
        "--next-check-at",
        "2099-06-27T12:00:00.000Z",
        "--fallback-at",
        "2099-06-28T00:00:00.000Z",
        "--fallback-action",
        "Escalate again if proof has not landed.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(update.exitCode).toBe(0);
    expect(JSON.parse(update.stdout).blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      resume_at: "2099-06-27T00:00:00.000Z",
      next_check_at: "2099-06-27T12:00:00.000Z",
      fallback_at: "2099-06-28T00:00:00.000Z",
      fallback_action: "Escalate again if proof has not landed.",
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["blocked-task"].blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      resume_at: "2099-06-27T00:00:00.000Z",
      next_check_at: "2099-06-27T12:00:00.000Z",
      fallback_at: "2099-06-28T00:00:00.000Z",
      fallback_action: "Escalate again if proof has not landed.",
    });

    const refresh = await runTaskTree(
      [
        "update-text",
        "blocked-task",
        "--next-check-at",
        "2099-06-29T12:00:00.000Z",
        "--fallback-at",
        "2099-06-30T00:00:00.000Z",
        "--fallback-action",
        "Escalate once more if proof has not landed.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(refresh.exitCode).toBe(0);
    expect(JSON.parse(refresh.stdout).blocker).toMatchObject({
      condition: "Waiting for returned operator proof.",
      resume_at: "2099-06-29T12:00:00.000Z",
      next_check_at: "2099-06-29T12:00:00.000Z",
      fallback_at: "2099-06-30T00:00:00.000Z",
      fallback_action: "Escalate once more if proof has not landed.",
    });
  });

  test("update-text supports full structured blocker replacement via --blocker-json", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "capacity-wait",
        "--parent",
        "project",
        "--goal",
        "Keep exact capacity wait.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "capacity wait stays truthful",
        "--state",
        "blocked",
        "--blocker-json",
        '{"condition":"Blocked only while exact westus2 capacity members remain unchanged.","category":"external-wait","owner":"human","resume_condition":"Resume only when reviewed westus2 capacity recovery arrives.","resume_at":"2026-07-10T18:00:00Z","blocked_at":"2026-07-03T02:47:04.593Z","waiting_for":{"type":"azure.capacity.available","taskId":"capacity-wait","sourceRunId":"28676489009"},"observed_by":{"workflow":"project-planner","schedule":"blocked-frontier-owner-review","trigger":"project.owner.requested"},"observation_method":"Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.","next_check_at":"2026-07-10T18:00:00Z","fallback_at":"2026-07-11T18:00:00Z","fallback_action":"Refresh with reviewed evidence or escalate."}',
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);
    expect(JSON.parse(add.stdout).blocker.waiting_for).toMatchObject({
      type: "azure.capacity.available",
      taskId: "capacity-wait",
      sourceRunId: "28676489009",
    });

    const update = await runTaskTree(
      [
        "update-text",
        "capacity-wait",
        "--blocker-json",
        '{"condition":"Blocked only while exact westus2 capacity members remain unchanged.","category":"external-wait","owner":"human","resume_condition":"Resume only when reviewed westus2 capacity recovery arrives.","resume_at":"2026-07-10T18:00:00Z","blocked_at":"2026-07-03T02:47:04.593Z","waiting_for":{"type":"azure.capacity.available","taskId":"capacity-wait"},"observed_by":{"workflow":"project-planner","schedule":"blocked-frontier-owner-review","trigger":"project.owner.requested"},"observation_method":"Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.","next_check_at":"2026-07-10T18:00:00Z","fallback_at":"2026-07-11T18:00:00Z","fallback_action":"Refresh with reviewed evidence or escalate."}',
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(update.exitCode).toBe(0);
    expect(JSON.parse(update.stdout).blocker.waiting_for).toMatchObject({
      type: "azure.capacity.available",
      taskId: "capacity-wait",
    });
    expect(
      JSON.parse(update.stdout).blocker.waiting_for.sourceRunId,
    ).toBeUndefined();

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["capacity-wait"].blocker.waiting_for).toMatchObject({
      type: "azure.capacity.available",
      taskId: "capacity-wait",
    });
    expect(
      tree.tasks["capacity-wait"].blocker.waiting_for.sourceRunId,
    ).toBeUndefined();
  });

  test("update-text with only --blocker preserves existing structured wait metadata", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "approval-wait",
        "--parent",
        "project",
        "--goal",
        "Keep exact approval wait.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "approval wait stays truthful",
        "--state",
        "blocked",
        "--blocker-json",
        '{"condition":"Waiting for returned approval.","category":"external-wait","owner":"human","resume_condition":"Resume when the returned approval lands.","resume_at":"2026-07-10T18:00:00Z","waiting_for":{"type":"project.approval.submitted","taskId":"approval-wait","pathId":"focus-terminal-frontier-finality-reconciliation-20260714"},"observed_by":{"workflow":"project-planner","trigger":"project.approval.submitted"},"observation_method":"Planner handles the returned approval event.","next_check_at":"2026-07-10T18:00:00Z","fallback_at":"2026-07-11T18:00:00Z","fallback_action":"Refresh with reviewed evidence or escalate."}',
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);

    const update = await runTaskTree(
      [
        "update-text",
        "approval-wait",
        "--blocker",
        "Waiting for the same returned approval after a readout refresh.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(update.exitCode).toBe(0);
    expect(JSON.parse(update.stdout).blocker).toMatchObject({
      condition:
        "Waiting for the same returned approval after a readout refresh.",
      category: "external-wait",
      owner: "human",
      waiting_for: {
        type: "project.approval.submitted",
        taskId: "approval-wait",
        pathId: "focus-terminal-frontier-finality-reconciliation-20260714",
      },
      observed_by: {
        workflow: "project-planner",
        trigger: "project.approval.submitted",
      },
      resume_condition: "Resume when the returned approval lands.",
      next_check_at: "2026-07-10T18:00:00Z",
      fallback_at: "2026-07-11T18:00:00Z",
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["approval-wait"].blocker.waiting_for).toMatchObject({
      type: "project.approval.submitted",
      taskId: "approval-wait",
      pathId: "focus-terminal-frontier-finality-reconciliation-20260714",
    });
  });

  test("repair-blocked-contracts backfills generic wait and observer fields", async () => {
    const fixture = await makeFixture();

    const runtimePaths = projectRuntimePaths(fixture.appDir);

    const add = await runTaskTree(
      [
        "add",
        "github-wait",
        "--parent",
        "project",
        "--goal",
        "Wait for same-run evidence.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "same-run evidence reviewed",
        "--state",
        "blocked",
        "--blocker",
        "Blocked until GitHub Actions run 28702280698 reaches terminal state and returns authoritative logs. Resume: Resume when run 28702280698 is terminal with reviewed same-run logs.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);
    expect(JSON.parse(add.stdout).blocker).toMatchObject({
      condition:
        "Blocked until GitHub Actions run 28702280698 reaches terminal state and returns authoritative logs.",
      waiting_for: {
        type: "blocker.resolved",
        taskId: "github-wait",
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-app-ops-review",
      },
      resume_condition:
        "Resume when run 28702280698 is terminal with reviewed same-run logs.",
    });

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      treePath: runtimePaths.taskTreePath,
      repairedCount: 0,
      unchanged: ["github-wait"],
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["github-wait"].blocker).toMatchObject({
      condition:
        "Blocked until GitHub Actions run 28702280698 reaches terminal state and returns authoritative logs.",
      owner: "aks-explorer",
      waiting_for: {
        type: "blocker.resolved",
        taskId: "github-wait",
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-app-ops-review",
      },
      resume_condition:
        "Resume when run 28702280698 is terminal with reviewed same-run logs.",
    });
    expect(tree.tasks["github-wait"].blocker.next_check_at).toBeTruthy();
    expect(tree.tasks["github-wait"].blocker.fallback_at).toBeTruthy();
    expect(tree.tasks["github-wait"].blocker.fallback_action).toContain(
      "owner recovery",
    );
  });

  test("repair-blocked-contracts does not infer Azure DevOps waits from blocked text", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "ado-wait",
        "--parent",
        "project",
        "--goal",
        "Wait for planned set result.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "ADO result reviewed",
        "--state",
        "blocked",
        "--blocker",
        "Blocked until Azure DevOps run 171186535 returns planned set artifacts. Resume: Resume when ADO run 171186535 is terminal and artifacts are reviewed.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["ado-wait"].blocker).toMatchObject({
      waiting_for: {
        type: "blocker.resolved",
        taskId: "ado-wait",
      },
    });
    expect(tree.tasks["ado-wait"].blocker.waiting_for.runUrl).toBeUndefined();
  });

  test("repair-blocked-contracts dry run sees no missing wait-target on already-normalized ADO waits", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["planner-ado-wait"] = {
      id: "planner-ado-wait",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Preserve the exact compact bootstrap-profile same-path wait until ADO run 171477458 returns artifacts.",
      outputs: ["tasks/tree.json"],
      acceptance: ["ADO result reviewed"],
      blocker: {
        condition:
          "Preserve the exact compact bootstrap-profile same-path wait until ADO run 171477458 returns artifacts for spec.bootstrap-profile-byo-acr.cache-direct-cache-switch.",
        category: "external-wait",
        owner: "aks-explorer",
        blocked_at: "2026-07-09T00:35:52.527Z",
        waiting_for: {
          type: "environment.available",
          taskId: "planner-ado-wait",
          sourceRunId: "171477458",
        },
        observed_by: {
          workflow: "project-planner",
          schedule: "blocked-frontier-app-ops-review",
          trigger: "project.owner.requested",
        },
        observation_method:
          "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
        next_check_at: "2026-07-09T00:45:52.527Z",
        resume_condition:
          "Resume only when run 171477458 returns accessible artifacts or proves an exact artifact-recovery blocker that changes the next action.",
        fallback_at: "2026-07-10T00:35:52.527Z",
        fallback_action:
          "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.",
      },
      trace: {
        created_at: "2026-07-09T00:35:52.527Z",
        created_by: "task-tree-tool",
        blocked_contract_seeded_at: "2026-07-09T00:35:52.527Z",
        blocked_contract_seeded_by: "project-planner",
      },
    };
    tree.tasks.project.children.push("planner-ado-wait");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const repaired = await runTaskTree(
      ["repair-blocked-contracts", "--dry-run"],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      repairedCount: 0,
      unchanged: ["planner-ado-wait"],
    });
  });

  test("repair-blocked-contracts does not misclassify GitHub artifact-recovery owner waits as run-completion waits", async () => {
    const fixture = await makeFixture();

    const add = await runTaskTree(
      [
        "add",
        "github-owner-return",
        "--parent",
        "project",
        "--goal",
        "Wait for owner artifact recovery.",
        "--output",
        "tasks/tree.json",
        "--acceptance",
        "owner response reviewed",
        "--state",
        "blocked",
        "--blocker",
        "Blocked on the returned owner/runtime response for already-sent artifact-recovery handoff for terminal GitHub run 28672036322. Resume: Resume when recovered same-run artifacts/logs, reviewed workflow-surface diagnosis, or exact decline/reroute returns.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(add.exitCode).toBe(0);
    expect(JSON.parse(add.stdout).blocker).toMatchObject({
      waiting_for: {
        type: "blocker.resolved",
        taskId: "github-owner-return",
      },
    });

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(tree.tasks["github-owner-return"].blocker).toMatchObject({
      waiting_for: {
        type: "blocker.resolved",
        taskId: "github-owner-return",
      },
    });

    tree.tasks["github-owner-return-existing"] = {
      id: "github-owner-return-existing",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Wait for owner artifact recovery.",
      outputs: ["tasks/tree.json"],
      acceptance: ["owner response reviewed"],
      blocker: {
        condition:
          "Blocked on the returned owner/runtime response for already-sent artifact-recovery handoff for terminal GitHub run 28672036322.",
        category: "external-wait",
        owner: "human",
        blocked_at: "2026-07-10T20:37:41.364Z",
        waiting_for: {
          type: "github.workflow_run.completed",
          runId: "28672036322",
          taskId: "github-owner-return-existing",
        },
        observed_by: {
          workflow: "project-planner",
          schedule: "blocked-frontier-app-ops-review",
          trigger: "project.owner.requested",
        },
        observation_method:
          "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
        resume_condition:
          "Resume when recovered same-run artifacts/logs, reviewed workflow-surface diagnosis, or exact decline/reroute returns.",
        next_check_at: "2026-07-11T18:00:00Z",
        fallback_at: "2026-07-12T18:00:00Z",
        fallback_action: "Refresh or escalate.",
      },
    };
    tree.tasks.project.children.push("github-owner-return-existing");
    await writeFile(
      resolveTaskTreePath(fixture.appDir),
      `${JSON.stringify(tree, null, 2)}\n`,
    );

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      repairedCount: 0,
      unchanged: ["github-owner-return", "github-owner-return-existing"],
    });

    const repairedTree = JSON.parse(
      await readFile(resolveTaskTreePath(fixture.appDir), "utf8"),
    );
    expect(
      repairedTree.tasks["github-owner-return-existing"].blocker,
    ).toMatchObject({
      waiting_for: {
        type: "github.workflow_run.completed",
        runId: "28672036322",
        taskId: "github-owner-return-existing",
      },
    });
  });

  test("repair-blocked-contracts does not rewrite mismatched wait types from prose", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["ado-migrated-wait"] = {
      id: "ado-migrated-wait",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Wait for Azure DevOps run 171186535.",
      outputs: ["tasks/tree.json"],
      acceptance: ["ADO result reviewed"],
      blocker: {
        condition:
          "Azure DevOps pipeline run 171186535 is still executing for the planned staging pass.",
        category: "external-wait",
        owner: "human",
        blocked_at: "2026-07-07T12:30:42.557Z",
        waiting_for: {
          type: "github.workflow_run.completed",
          runId: "171186535",
          taskId: "ado-migrated-wait",
        },
        observed_by: {
          workflow: "project-planner",
          trigger: "project.owner.requested",
        },
        observation_method:
          "Scheduled blocked-frontier owner review checks the stated wait condition.",
        next_check_at: "2026-07-07T12:46:42.845Z",
        resume_condition:
          "Resume when ADO run 171186535 completes and artifacts can be reviewed.",
        fallback_at: "2026-07-08T12:36:42.845Z",
        fallback_action:
          "If the wait is still true at fallback time, refresh or escalate.",
      },
    };
    tree.tasks.project.children.push("ado-migrated-wait");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      repairedCount: 0,
      unchanged: ["ado-migrated-wait"],
    });

    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["ado-migrated-wait"].blocker.owner).toBe("human");
    expect(
      updated.tasks["ado-migrated-wait"].blocker.waiting_for,
    ).toMatchObject({
      type: "github.workflow_run.completed",
      runId: "171186535",
    });
  });

  test("repair-blocked-contracts corrects Azure DevOps wait owner", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["ado-owner-wait"] = {
      id: "ado-owner-wait",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Wait for Azure DevOps run 171186535.",
      outputs: ["tasks/tree.json"],
      acceptance: ["ADO result reviewed"],
      blocker: {
        condition:
          "Azure DevOps pipeline run 171186535 is still executing for the planned staging pass.",
        category: "external-wait",
        owner: "human",
        blocked_at: "2026-07-07T12:30:42.557Z",
        waiting_for: {
          type: "ado.pipeline_run.completed",
          runId: "171186535",
          taskId: "ado-owner-wait",
        },
        observed_by: {
          workflow: "project-planner",
          trigger: "project.owner.requested",
        },
        observation_method:
          "Scheduled blocked-frontier owner review checks the stated wait condition.",
        next_check_at: "2026-07-07T12:46:42.845Z",
        resume_condition:
          "Resume when ADO run 171186535 completes and artifacts can be reviewed.",
        fallback_at: "2026-07-08T12:36:42.845Z",
        fallback_action:
          "If the wait is still true at fallback time, refresh or escalate.",
      },
    };
    tree.tasks.project.children.push("ado-owner-wait");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      repaired: ["ado-owner-wait"],
    });

    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["ado-owner-wait"].blocker.owner).toBe("ado");
    expect(updated.tasks["ado-owner-wait"].blocker.waiting_for.type).toBe(
      "ado.pipeline_run.completed",
    );
  });

  test("repair-blocked-contracts does not treat plain runtime run ids as GitHub waits", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["runtime-recovery-wait"] = {
      id: "runtime-recovery-wait",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Wait for runtime recovery after run 171186535.",
      outputs: ["tasks/tree.json"],
      acceptance: ["runtime recovery reviewed"],
      blocker: {
        condition:
          "Run 171186535 reached deep live execution but failed on a runtime/platform update path; wait for material platform recovery before rerun.",
        category: "external-wait",
        owner: "aks-explorer",
        blocked_at: "2026-07-07T14:30:00.000Z",
        waiting_for: {
          type: "github.workflow_run.completed",
          runId: "171186535",
          taskId: "runtime-recovery-wait",
        },
        observed_by: {
          workflow: "project-planner",
          trigger: "project.owner.requested",
        },
        observation_method:
          "Scheduled blocked-frontier owner review checks the stated wait condition.",
        next_check_at: "2026-07-07T14:40:00.000Z",
        resume_condition:
          "Resume when runtime/platform recovery changes this surface.",
        fallback_at: "2026-07-08T14:30:00.000Z",
        fallback_action: "Refresh or escalate.",
      },
    };
    tree.tasks.project.children.push("runtime-recovery-wait");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      repairedCount: 0,
      unchanged: ["runtime-recovery-wait"],
    });

    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(
      updated.tasks["runtime-recovery-wait"].blocker.waiting_for,
    ).toMatchObject({
      type: "github.workflow_run.completed",
      runId: "171186535",
      taskId: "runtime-recovery-wait",
    });
  });

  test("repair-blocked-contracts does not turn completed ADO evidence into an ADO wait", async () => {
    const fixture = await makeFixture();
    const treePath = resolveTaskTreePath(fixture.appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["kms-invalid-sku-wait"] = {
      id: "kms-invalid-sku-wait",
      parent_id: "project",
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal: "Wait for material Key Vault SKU contract change.",
      outputs: ["tasks/tree.json"],
      acceptance: ["SKU frontier remains exact"],
      blocker: {
        condition:
          "Blocked on the repaired same-path rerun for spec.kms.v2plus-enable-pmk-from-v2-public: Azure DevOps run 171208533 preserved the Key Vault request/response and returned HTTP 400 BadRequest 'The key vault sku is invalid.' This closes the diagnostics gap and leaves the current branch as a provider/environment rejection with no truthful unchanged rerun.",
        category: "external-wait",
        owner: "ado",
        resume_condition:
          "Resume only when a reviewed same-surface signal changes this exact Key Vault create contract on staging.",
      },
    };
    tree.tasks.project.children.push("kms-invalid-sku-wait");
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`);

    const repaired = await runTaskTree(["repair-blocked-contracts"], {
      ...process.env,
      APP_DIR: fixture.appDir,
      PROJECT_DIR: fixture.projectDir,
      WORKER: "aks-explorer",
    });

    expect(repaired.exitCode).toBe(0);
    expect(JSON.parse(repaired.stdout)).toMatchObject({
      repaired: ["kms-invalid-sku-wait"],
    });

    const updated = JSON.parse(await readFile(treePath, "utf8"));
    expect(updated.tasks["kms-invalid-sku-wait"].blocker.owner).toBe("ado");
    expect(
      updated.tasks["kms-invalid-sku-wait"].blocker.waiting_for,
    ).toMatchObject({
      type: "blocker.resolved",
      taskId: "kms-invalid-sku-wait",
    });
  });
});
