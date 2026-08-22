import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execute } from "./spec-loop-controller";

async function workspace(input: {
  specs?: Record<string, Record<string, unknown>>;
  tasks?: Record<string, Record<string, unknown>>;
  resources?: Record<string, unknown>;
  receipts?: Record<string, unknown>;
  catalogSpecs?: Array<{ path: string; content: Record<string, unknown> }>;
}) {
  const root = await mkdtemp(join(tmpdir(), "spec-loop-v2-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(appDir, ".state", "spec-loop", "state.json"),
    JSON.stringify({
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 5,
      cursor: 0,
      prioritySpecIds: [],
      specs: input.specs ?? {},
    }),
  );
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({
      tasks: input.tasks ?? {},
      resources: input.resources ?? {},
      receipts: input.receipts ?? {},
    }),
  );
  await writeFile(
    join(appDir, ".state", "tasks", "state.json"),
    JSON.stringify({
      tasks: input.tasks ?? {},
      resources: input.resources ?? {},
      receipts: input.receipts ?? {},
    }),
  );
  const catalogSpecs =
    input.catalogSpecs ??
    Object.keys(input.specs ?? {}).map((specId) => ({
      path: `features/test/specs/${specId.replace(/[^A-Za-z0-9_.-]+/g, "-")}.json`,
      content: { id: specId },
    }));
  for (const spec of catalogSpecs) {
    const path = join(projectDir, spec.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(spec.content));
  }
  git(projectDir, "init", "-b", "dev");
  git(projectDir, "config", "user.name", "Test User");
  git(projectDir, "config", "user.email", "test@example.com");
  git(projectDir, "add", ".");
  git(projectDir, "commit", "-m", "catalog");
  git(
    projectDir,
    "update-ref",
    "refs/remotes/origin/dev",
    git(projectDir, "rev-parse", "HEAD"),
  );
  return { appDir, projectDir };
}

function git(projectDir: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd: projectDir,
    encoding: "utf8",
  }).trim();
}

function context(appDir: string, projectDir: string, resourceVersion = 1) {
  const read = (name: string) =>
    JSON.parse(
      readFileSync(join(appDir, ".state", "tasks", name), "utf8"),
    ) as Record<string, any>;
  const tree = read("tree.json");
  const state = read("state.json");
  const tasks = { ...(tree.tasks ?? {}), ...(state.tasks ?? {}) };
  const resources = state.resources ?? {};
  const live = Object.entries({ ...tasks, ...resources }).flatMap(
    ([taskId, value]: [string, any]) => {
      const task = tasks[taskId] ?? {};
      const resource = resources[taskId] ?? {};
      const spec = resource.spec ?? task;
      const status = resource.status ?? task;
      const phase = String(status.phase ?? status.state ?? "pending");
      return ["done", "closed", "converged"].includes(phase)
        ? []
        : [
            {
              taskId,
              parentId: String(
                spec.parentId ?? task.parent_id ?? "aks-spec-verification-loop",
              ),
              generation: Number(
                resource.metadata?.generation ?? task.generation ?? 1,
              ),
              status: phase,
              outcome: String(spec.outcome ?? task.goal ?? "fixture task"),
              input: spec.input ?? task.input ?? {},
              conditions: [],
              hasLiveChildren: false,
              evidence: status.evidence ?? [],
              summary: status.summary,
            },
          ];
    },
  );
  const completed = Object.entries(state.receipts ?? {}).map(
    ([taskId, receipt]: [string, any]) => ({
      taskId,
      parentId: String(receipt.parentId ?? "aks-spec-verification-loop"),
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
    input: { frontierLimit: 5, maxConcurrent: 80 },
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "aks-spec-verification-loop",
      generation: 1,
      resourceVersion,
      owner: "app-ops",
      mode: "maintain",
      outcome: "Maintain spec verification",
      acceptance: [],
      input: { frontierLimit: 5, maxConcurrent: 80 },
      children: { live, completed },
      events: {
        items: [
          {
            observedAt: "2026-08-21T00:00:00.000Z",
            event: {
              type: "project.task.tick",
              data: {
                action: "spec-loop",
                taskId: "aks-spec-verification-loop",
                maxConcurrent: 80,
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

describe("spec loop reconciliation workflow", () => {
  test("reconciles added and retired catalog identities before selecting work", async () => {
    const ws = await workspace({
      specs: {
        "spec.retired": {
          status: "pass",
          attempts: 1,
          lastRunId: "41",
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      catalogSpecs: [
        {
          path: "features/current/specs/current.json",
          content: { id: "spec.current" },
        },
      ],
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toMatchObject([
      { input: { specId: "spec.current" } },
    ]);
    const persisted = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(Object.keys(persisted.specs)).toEqual(["spec.current"]);
  });

  test("uses clean origin dev instead of a dirty canonical catalog", async () => {
    const catalogPath = "features/current/specs/current.json";
    const ws = await workspace({
      specs: {
        "spec.current": {
          status: "pass",
          attempts: 1,
          lastRunId: "42",
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      catalogSpecs: [{ path: catalogPath, content: { id: "spec.current" } }],
    });
    const sourceCommit = git(ws.projectDir, "rev-parse", "HEAD");
    await writeFile(
      join(ws.projectDir, catalogPath),
      JSON.stringify({ id: "spec.dirty-local-only" }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    expect(result.output.evidence).toContain(
      `spec-loop-catalog-source:origin/dev@${sourceCommit}`,
    );
    const persisted = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(Object.keys(persisted.specs)).toEqual(["spec.current"]);
  });

  test("does not reconcile from an untrusted project checkout", async () => {
    const ws = await workspace({
      specs: {
        "spec.current": {
          status: "pass",
          attempts: 1,
          lastRunId: "42",
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
    });
    git(ws.projectDir, "update-ref", "-d", "refs/remotes/origin/dev");
    await mkdir(join(ws.projectDir, "features/current/specs"), {
      recursive: true,
    });
    await writeFile(
      join(ws.projectDir, "features/current/specs/dirty.json"),
      JSON.stringify({ id: "spec.dirty-local-only" }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({
      state: "needs-owner",
      evidence: ["spec-loop-catalog-source:project-dir@untrusted"],
    });
    const persisted = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(Object.keys(persisted.specs)).toEqual(["spec.current"]);
  });

  test("converges when every spec has a passing result", async () => {
    const ws = await workspace({
      specs: {
        "spec.example": {
          status: "pass",
          attempts: 1,
          lastRunId: "42",
          lastResultPath: "result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
    });
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: { state: "converged", actions: [] },
    });
  });

  test("declares bounded owner work without changing or assigning the graph", async () => {
    const ws = await workspace({
      specs: {
        "spec.example": {
          status: "pending",
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            parentId: "aks-spec-verification-loop",
            owner: "aks-explorer",
            workflow: "spec-live-reconciliation",
            input: { specId: "spec.example" },
          },
        ],
      },
    });
    const [action] = result.output.actions;
    expect(action.id).toMatch(/^spec\/verify-spec-example-[a-f0-9]{10}$/);
    expect(Object.keys(action.input).sort()).toEqual([
      "loopId",
      "specId",
      "statePath",
      "workKey",
      "workRevision",
    ]);
    expect(action.outcome).not.toContain("pending");
    const acceptance = action.acceptance.join("\n");
    expect(acceptance).toContain("self-contained for staging");
    expect(acceptance).toContain("nearby good and bad same-family examples");
    expect(acceptance).toContain("shared runner helpers");
    expect(acceptance).toContain("target-environment wiring");
    expect(acceptance).toContain("REST/API helpers");
    expect(acceptance).toContain("mounted private AKS RP source");
    expect(acceptance).toContain("branch/commit ADO will run");
    expect(acceptance).toContain("A fast no-cluster pass is inconclusive");
    expect(acceptance).toContain("require a fresh ADO live run");
    expect(acceptance).toContain("structured backend, run id");
    expect(acceptance).toContain("terminal with no artifacts");
    expect(acceptance).toContain("same-spec child assertions");
    expect(acceptance).toContain(
      "Reviewer acceptance of an artifact review is not the same as a passing spec",
    );
    expect(acceptance).toContain("structured state");
  });

  test("converges when work is already represented", async () => {
    const ws = await workspace({
      specs: {
        "spec.example": {
          status: "running",
          taskId: "existing-spec-task",
          attempts: 1,
          lastRunId: "42",
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      tasks: {
        "existing-spec-task": {
          id: "existing-spec-task",
          item_type: "task",
          phase: "running",
        },
      },
    });
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [],
      },
    });
  });

  test("declares only free capacity after represented work", async () => {
    const specs = Object.fromEntries(
      ["one", "two", "three", "four", "five", "six"].map((name) => [
        `spec.${name}`,
        {
          status: "pending",
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      ]),
    );
    const ws = await workspace({
      specs,
      tasks: {
        "spec/verify-spec-one": {
          id: "spec/verify-spec-one",
          item_type: "task",
          phase: "running",
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(4);
    expect(result.output.actions).toSatisfy(
      (actions: Array<Record<string, unknown>>) =>
        actions.every((action) => action.dependsOn === undefined),
    );
  });

  test("keeps refilling when an exact wait covers another spec", async () => {
    const specs = Object.fromEntries(
      ["one", "two", "three", "four", "five", "six"].map((name) => [
        `spec.${name}`,
        {
          status: "pending",
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      ]),
    );
    const ws = await workspace({
      specs,
      tasks: {
        "wait/spec-one": {
          id: "wait/spec-one",
          phase: "waiting",
          input: {
            loopId: "aks-spec-verification-loop",
            workKey: "spec.one",
          },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(5);
    expect(result.output.summary).toContain("1 waiting");
  });

  test("uses frontierLimit instead of stale maxConcurrent values", async () => {
    const specs = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const name = `case-${index + 1}`;
        return [
          `spec.${name}`,
          {
            status: "pending",
            attempts: 0,
            lastRunId: null,
            lastResultPath: null,
            lastPrUrl: null,
            updatedAt: "2026-07-19T00:00:00Z",
          },
        ];
      }),
    );
    const ws = await workspace({
      specs,
      tasks: {
        "spec/verify-spec-case-1": {
          id: "spec/verify-spec-case-1",
          item_type: "task",
          phase: "running",
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(4);
    expect(result.output.actions).toSatisfy((actions: Array<any>) =>
      actions.every((action) => action.dependsOn === undefined),
    );
  });

  test("keeps holderless ledger rows queued when the actionable frontier is full", async () => {
    const representedSpecs = ["one", "two", "three", "four", "five"];
    const specs = Object.fromEntries(
      [...representedSpecs, "six", "seven", "reviewed"].map((name) => [
        `spec.${name}`,
        {
          status: "pending",
          taskId: null,
          attempts: name === "reviewed" ? 1 : 0,
          lastRunId: name === "reviewed" ? "42" : null,
          lastResultPath: name === "reviewed" ? "result.json" : null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
          ...(name === "reviewed"
            ? {
                review: {
                  classification: "reviewed_nonlive_source_grounded_wait",
                  reviewedAt: "2026-07-19T00:00:00Z",
                },
                successorDisposition: "reviewed_nonlive_source_grounded_wait",
                successorEvidencePath: "evidence/archive/spec-reviewed.md",
                resumeCondition: "Resume after the execution posture changes.",
                terminalDisposition: false,
              }
            : {}),
        },
      ]),
    );
    const tasks = Object.fromEntries(
      representedSpecs.map((name) => [
        `holder-${name}`,
        {
          id: `holder-${name}`,
          item_type: "task",
          phase: "running",
          input: {
            loopId: "aks-spec-verification-loop",
            workKey: `spec.${name}`,
          },
        },
      ]),
    );
    const ws = await workspace({ specs, tasks });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toEqual([]);
    expect(result.output.summary).toContain(
      "selected 0 of 3 holderless row(s) for 0 available frontier slot(s)",
    );
  });

  test("bounds a hundreds-row ledger and continues deterministically after a child transition", async () => {
    const specs = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => {
        const specId = `spec.case-${String(index + 1).padStart(3, "0")}`;
        return [
          specId,
          {
            status: "pending",
            attempts: 0,
            lastRunId: null,
            lastResultPath: null,
            lastPrUrl: null,
            updatedAt: "2026-07-19T00:00:00Z",
          },
        ];
      }),
    );
    const ws = await workspace({
      specs,
      tasks: {
        "holder-case-001": {
          id: "holder-case-001",
          phase: "running",
          input: {
            loopId: "aks-spec-verification-loop",
            workKey: "spec.case-001",
          },
        },
        "wait-case-002": {
          id: "wait-case-002",
          phase: "waiting",
          input: {
            loopId: "aks-spec-verification-loop",
            workKey: "spec.case-002",
          },
        },
      },
    });

    const first = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const firstSpecIds = first.output.actions.map(
      (action: any) => action.input.specId,
    );
    expect(firstSpecIds).toEqual([
      "spec.case-003",
      "spec.case-004",
      "spec.case-005",
      "spec.case-006",
    ]);
    expect(first.output.actions.length).toBeLessThanOrEqual(5);
    expect(first.output.actions.length).toBeLessThanOrEqual(16);
    expect(firstSpecIds).not.toContain("spec.case-001");
    expect(firstSpecIds).not.toContain("spec.case-002");

    const statePath = join(ws.appDir, ".state", "spec-loop", "state.json");
    const state = JSON.parse(await readFile(statePath, "utf8"));
    for (const specId of firstSpecIds) {
      state.specs[specId] = {
        ...state.specs[specId],
        status: "pass",
        lastRunId: `completed-${specId}`,
        updatedAt: "2026-07-20T00:00:00Z",
      };
    }
    await writeFile(statePath, JSON.stringify(state));

    const second = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(
      second.output.actions.map((action: any) => action.input.specId),
    ).toEqual([
      "spec.case-007",
      "spec.case-008",
      "spec.case-009",
      "spec.case-010",
    ]);
    expect(second.output.actions.length).toBeLessThanOrEqual(5);
    expect(second.output.actions.length).toBeLessThanOrEqual(16);
  });

  test("replaces an attention-only holder with bounded runnable work", async () => {
    const ws = await workspace({
      specs: {
        "spec.example": {
          status: "pending",
          taskId: "existing-spec-task",
          attempts: 1,
          lastRunId: "42",
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      tasks: {
        "existing-spec-task": {
          id: "existing-spec-task",
          item_type: "task",
          phase: "attention",
          outcome: "Repair the malformed result for spec.example.",
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "aks-spec-verification-loop",
          owner: "aks-explorer",
          workflow: "spec-live-reconciliation",
          input: { specId: "spec.example" },
        },
      ],
    });
    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0].dependsOn).toBeUndefined();
    expect(result.output.conditions).toBeUndefined();
  });

  test("replaces an unknown deterministic review holder with bounded runnable work", async () => {
    const ws = await workspace({
      specs: {
        "spec.kms.v2plus-pmk-migrate-cmk-private-kv-lifecycle": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      tasks: {
        "spec/verify-spec-kms-v2plus-pmk-migrate-cmk-private-kv-lifecycle": {
          id: "spec/verify-spec-kms-v2plus-pmk-migrate-cmk-private-kv-lifecycle",
          item_type: "task",
          state: "review",
          goal: "Reconcile spec.kms.v2plus-pmk-migrate-cmk-private-kv-lifecycle to a passing live result, an exact wait, or a reviewed terminal disposition.",
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "aks-spec-verification-loop",
          owner: "aks-explorer",
          workflow: "spec-live-reconciliation",
          input: {
            specId: "spec.kms.v2plus-pmk-migrate-cmk-private-kv-lifecycle",
          },
        },
      ],
    });
    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0].dependsOn).toBeUndefined();
  });

  test("treats holder-backed live tasks as representation when ledger taskId is stale or null", async () => {
    const ws = await workspace({
      specs: {
        "spec.example": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      tasks: {
        "wait-spec-example-holder": {
          id: "wait-spec-example-holder",
          item_type: "task",
          phase: "waiting",
          outcome:
            "Preserve the exact wait for spec.example until the external signal changes.",
          conflict_scope: ["spec:spec.example"],
          input: {
            loopId: "aks-spec-verification-loop",
            workKey: "spec.example",
          },
        },
      },
    });
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [],
      },
    });
  });

  test("does not let a feature holder represent spec-loop work", async () => {
    const ws = await workspace({
      specs: {
        "spec.kms.v2-custom-vnet-public-kv-lifecycle": {
          status: "pending",
          taskId: null,
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      catalogSpecs: [
        {
          path: "features/kms-etcd-encryption/specs/kms-v2-custom-vnet-public-kv.json",
          content: { id: "spec.kms.v2-custom-vnet-public-kv-lifecycle" },
        },
      ],
      tasks: {
        "hold-compact-kms-holder": {
          id: "hold-compact-kms-holder",
          item_type: "task",
          phase: "waiting",
          outcome: "Preserve the kms-etcd-encryption split frontier.",
          conflict_scope: ["feature:kms-etcd-encryption"],
        },
      },
    });
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [
          { input: { specId: "spec.kms.v2-custom-vnet-public-kv-lifecycle" } },
        ],
      },
    });
  });

  test("does not infer representation from family-scoped prose", async () => {
    const ws = await workspace({
      specs: {
        "spec.ccp-security-patch.windows2022-prod-mtc": {
          status: "pending",
          taskId: null,
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      tasks: {
        "wait-ccp-family-holder": {
          id: "wait-ccp-family-holder",
          item_type: "task",
          phase: "waiting",
          outcome:
            "Preserve the shared ccp security patch owner-response frontier.",
          conflict_scope: ["spec-loop-followup:pending:ccp-security-patch"],
        },
      },
    });
    expect(await execute(context(ws.appDir, ws.projectDir))).toMatchObject({
      output: {
        state: "converged",
        actions: [
          { input: { specId: "spec.ccp-security-patch.windows2022-prod-mtc" } },
        ],
      },
    });
  });

  test("omits Conditions when creating follow-up work for only the unrepresented rows", async () => {
    const ws = await workspace({
      specs: {
        "spec.represented": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
        "spec.unrepresented": {
          status: "pending",
          taskId: null,
          attempts: 0,
          lastRunId: null,
          lastResultPath: null,
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
        },
      },
      tasks: {
        "wait-spec-represented-holder": {
          id: "wait-spec-represented-holder",
          item_type: "task",
          phase: "waiting",
          outcome: "Hold spec.represented until reviewed evidence changes.",
          input: {
            loopId: "aks-spec-verification-loop",
            workKey: "spec.represented",
          },
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            input: { specId: "spec.unrepresented" },
          },
        ],
      },
    });
    expect(result).not.toHaveProperty("output.conditions");
  });

  test("routes unrepresented reviewed dispositions to representation repair instead of generic rerun work", async () => {
    const ws = await workspace({
      specs: {
        "spec.reviewed": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: "result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
          review: {
            classification: "reviewed_nonlive_source_grounded_wait",
            reviewedAt: "2026-07-19T00:00:00Z",
          },
          successorDisposition: "reviewed_nonlive_source_grounded_wait",
          successorEvidencePath: "evidence/archive/spec-reviewed.md",
          resumeCondition:
            "Resume only after the reviewed execution posture changes.",
          terminalDisposition: false,
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [
          {
            kind: "create-task",
            parentId: "aks-spec-verification-loop",
            owner: "aks-explorer",
            workflow: "domain-task-execution",
            input: { specId: "spec.reviewed" },
          },
        ],
      },
    });
    expect(result.output.actions[0].id).toStartWith(
      "spec/repair-verify-spec-reviewed-disposition-representation-73475cb40a-",
    );
    expect(result.output.actions[0].outcome).toContain(
      "structured reviewed disposition",
    );
    const acceptance = result.output.actions[0].acceptance.join("\n");
    expect(acceptance).toContain("Do not launch an unchanged rerun");
    expect(acceptance).toContain(
      "a GitHub Actions auth or workflow failure cannot justify a terminal disposition after the project moved to ADO",
    );
    expect(acceptance).toContain(
      "marked not-a-current-direct-child-or-receipt in representationReview as stale history",
    );
  });

  test("preserves a live suffixed holder when the immutable stable id already completed", async () => {
    const specId = "spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease";
    const baseId =
      "spec/verify-spec-rp-cluster-lifecycle-new-vnet-lifecycle-vm-prerelease-338c423d16";
    const liveHolderId = `${baseId}-86cda5b4ed`;
    const spec = {
      status: "pending",
      attempts: 0,
      lastRunId: null,
      updatedAt: "2026-08-18T10:00:00Z",
      inputFingerprint: "current-revision",
    };
    const taskInput = {
      loopId: "aks-spec-verification-loop",
      workKey: specId,
      specId,
      workRevision: "338c423d16",
    };
    const ws = await workspace({
      specs: { [specId]: spec },
      tasks: {
        [liveHolderId]: {
          id: liveHolderId,
          phase: "waiting",
          input: taskInput,
        },
      },
      receipts: {
        [baseId]: {
          taskId: baseId,
          input: taskInput,
          completedAt: "2026-08-18T09:00:00Z",
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    expect(result.output.summary).toContain("1 waiting");
    expect(result.output.actions).not.toContainEqual(
      expect.objectContaining({ id: baseId }),
    );
  });

  test("treats an exact-revision completion receipt as represented when an older receipt is outside the bounded projection", async () => {
    const specId = "spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease";
    const completedHolderId =
      "spec/verify-spec-rp-cluster-lifecycle-new-vnet-lifecycle-vm-prerelease-338c423d16-86cda5b4ed";
    const ws = await workspace({
      specs: {
        [specId]: {
          status: "pending",
          attempts: 0,
          lastRunId: null,
          updatedAt: "2026-08-18T10:00:00Z",
          inputFingerprint: "current-revision",
        },
      },
      receipts: {
        [completedHolderId]: {
          taskId: completedHolderId,
          input: {
            loopId: "aks-spec-verification-loop",
            workKey: specId,
            specId,
            workRevision: "338c423d16",
          },
          completedAt: "2026-08-18T10:43:39Z",
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    expect(result.output.summary).toContain(
      "1 exact-revision completion receipt",
    );

    await writeFile(
      join(ws.appDir, ".state", "tasks", "state.json"),
      JSON.stringify({ tasks: {}, resources: {}, receipts: {} }),
    );
    const boundedResult = (await execute(
      context(ws.appDir, ws.projectDir, 2),
    )) as any;
    expect(boundedResult.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(boundedResult.output.summary).toContain(
      "1 exact-revision completion receipt",
    );
    expect(boundedResult.output.actions).not.toContainEqual(
      expect.objectContaining({ id: completedHolderId }),
    );
  });

  test("uses a fresh task identity when the deterministic repair identity already completed", async () => {
    const baseId =
      "spec/repair-verify-spec-reviewed-disposition-representation-73475cb40a";
    const ws = await workspace({
      specs: {
        "spec.reviewed": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: "result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
          review: {
            classification: "reviewed_nonlive_source_grounded_wait",
            reviewedAt: "2026-07-19T00:00:00Z",
          },
          successorDisposition: "reviewed_nonlive_source_grounded_wait",
          successorEvidencePath: "evidence/archive/spec-reviewed.md",
          resumeCondition:
            "Resume only after the reviewed execution posture changes.",
          terminalDisposition: false,
        },
      },
      receipts: {
        [baseId]: { taskId: baseId, completedAt: "2026-07-20T00:00:00Z" },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0]).toMatchObject({
      kind: "create-task",
      input: { specId: "spec.reviewed" },
    });
    expect(result.output.actions[0].id).toStartWith(`${baseId}-`);
    expect(result.output.actions[0].id).not.toBe(baseId);
  });

  test("changes a repair identity with the bounded parent projection even when an omitted receipt is invisible", async () => {
    const baseId =
      "spec/repair-verify-spec-reviewed-disposition-representation-73475cb40a";
    const ws = await workspace({
      specs: {
        "spec.reviewed": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: "result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
          review: {
            classification: "reviewed_nonlive_source_grounded_wait",
            reviewedAt: "2026-07-19T00:00:00Z",
          },
          successorDisposition: "reviewed_nonlive_source_grounded_wait",
          successorEvidencePath: "evidence/archive/spec-reviewed.md",
          resumeCondition:
            "Resume only after the reviewed execution posture changes.",
          terminalDisposition: false,
        },
      },
    });

    const first = (await execute(context(ws.appDir, ws.projectDir, 41))) as any;
    const second = (await execute(
      context(ws.appDir, ws.projectDir, 42),
    )) as any;

    expect(first.output.actions[0].id).toStartWith(`${baseId}-`);
    expect(second.output.actions[0].id).toStartWith(`${baseId}-`);
    expect(first.output.actions[0].id).not.toBe(baseId);
    expect(second.output.actions[0].id).not.toBe(first.output.actions[0].id);
  });

  test("imports newer project mirror rows before deciding reviewed disposition repair work", async () => {
    const ws = await workspace({
      specs: {
        "spec.reviewed": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: "result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
          review: {
            classification: "reviewed_nonlive_source_grounded_wait",
            reviewedAt: "2026-07-19T00:00:00Z",
          },
          successorDisposition: "reviewed_nonlive_source_grounded_wait",
          successorEvidencePath: "evidence/archive/spec-reviewed.md",
          resumeCondition:
            "Resume only after the reviewed execution posture changes.",
          terminalDisposition: false,
        },
      },
    });
    await mkdir(join(ws.projectDir, ".state", "spec-loop"), {
      recursive: true,
    });
    await writeFile(
      join(ws.projectDir, ".state", "spec-loop", "state.json"),
      JSON.stringify({
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 5,
        cursor: 0,
        prioritySpecIds: [],
        specs: {
          "spec.reviewed": {
            status: "pending",
            taskId: null,
            attempts: 1,
            lastRunId: "42",
            lastResultPath: "result.json",
            lastPrUrl: null,
            updatedAt: "2026-07-20T00:00:00Z",
            review: {
              classification: "reviewed_nonlive_source_grounded_wait",
              reviewedAt: "2026-07-20T00:00:00Z",
            },
            successorDisposition: "reviewed_nonlive_source_grounded_wait",
            successorEvidencePath: "evidence/archive/spec-reviewed.md",
            resumeCondition:
              "Resume only after the reviewed execution posture changes.",
            terminalDisposition: true,
          },
        },
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    const persisted = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(persisted.specs["spec.reviewed"]?.terminalDisposition).toBe(true);
  });

  test("preserves reviewed terminal disposition through catalog refresh for nonterminal source-grounded specs", async () => {
    const ws = await workspace({
      specs: {
        "spec.reviewed": {
          status: "pending",
          taskId: null,
          attempts: 1,
          lastRunId: "42",
          lastResultPath: "result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-20T00:00:00Z",
          review: {
            classification: "reviewed_nonlive_source_grounded_wait",
            reviewedAt: "2026-07-20T00:00:00Z",
          },
          successorDisposition: "reviewed_nonlive_source_grounded_wait",
          successorEvidencePath: "evidence/archive/spec-reviewed.md",
          resumeCondition:
            "Resume only after the reviewed execution posture changes.",
          terminalDisposition: true,
        },
      },
      catalogSpecs: [
        {
          path: "features/test/specs/spec-reviewed.json",
          content: {
            id: "spec.reviewed",
            status: "draft",
            specState: "source-grounded",
          },
        },
      ],
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    const persisted = JSON.parse(
      await readFile(
        join(ws.appDir, ".state", "spec-loop", "state.json"),
        "utf8",
      ),
    );
    expect(persisted.specs["spec.reviewed"]?.terminalDisposition).toBe(true);
  });

  test("replaces an old-shape attention disposition repair with bounded repair work", async () => {
    const ws = await workspace({
      specs: {
        "spec.network-acns.retina-enterprise-k8s-upgrade": {
          status: "pending",
          taskId: null,
          attempts: 3,
          lastRunId: "ado-1",
          lastResultPath: "runs/result.json",
          lastPrUrl: null,
          updatedAt: "2026-07-19T00:00:00Z",
          review: {
            classification: "reviewed_nonlive_source_grounded_wait",
            reviewedAt: "2026-07-19T00:00:00Z",
          },
          successorDisposition: "reviewed_nonlive_source_grounded_wait",
          successorEvidencePath: "evidence/archive/retina.md",
          resumeCondition:
            "Resume only after the staging execution posture changes.",
          terminalDisposition: false,
        },
      },
      tasks: {
        "spec/repair-verify-spec-network-acns-retina-enterprise-k8s-upgrade-disposition-representation":
          {
            id: "spec/repair-verify-spec-network-acns-retina-enterprise-k8s-upgrade-disposition-representation",
            phase: "attention",
            input: {
              loopTaskId: "aks-spec-verification-loop",
              specId: "spec.network-acns.retina-enterprise-k8s-upgrade",
              statePath:
                "/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json",
            },
          },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "aks-spec-verification-loop",
          owner: "aks-explorer",
          workflow: "domain-task-execution",
          input: {
            specId: "spec.network-acns.retina-enterprise-k8s-upgrade",
          },
        },
      ],
    });
    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0].dependsOn).toBeUndefined();
  });
});
