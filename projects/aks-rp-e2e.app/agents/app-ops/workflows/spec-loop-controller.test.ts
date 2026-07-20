import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execute } from "./spec-loop-controller";

async function workspace(input: {
  specs?: Record<string, Record<string, unknown>>;
  tasks?: Record<string, Record<string, unknown>>;
  resources?: Record<string, unknown>;
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
      receipts: {},
    }),
  );
  for (const spec of input.catalogSpecs ?? []) {
    const path = join(projectDir, spec.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(spec.content));
  }
  return { appDir, projectDir };
}

function context(appDir: string, projectDir: string) {
  return {
    task: `app: ${appDir}\nproject: ${projectDir}\n## Trigger Event\n\`\`\`json\n${JSON.stringify({ type: "project.task.tick", action: "spec-loop", taskId: "aks-spec-verification-loop" })}\n\`\`\``,
    agent: "aks-explorer",
    done: (message: string, output?: unknown) => ({
      status: "done",
      message,
      output,
    }),
  } as any;
}

describe("spec loop reconciliation workflow", () => {
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

  test("declares bounded owner work without mutating or assigning the graph", async () => {
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
            parentId: "group/spec-verification",
            owner: "aks-explorer",
            input: { specId: "spec.example" },
          },
        ],
      },
    });
    const [action] = result.output.actions;
    expect(action.id).toBe("spec/verify-spec-example");
    expect(Object.keys(action.input).sort()).toEqual([
      "loopTaskId",
      "specId",
      "statePath",
    ]);
    expect(action.outcome).not.toContain("pending");
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
  });

  test("converges while represented review or attention work remains visible", async () => {
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
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [],
      },
    });
    expect(result.output.summary).toContain(
      "represented review/attention task(s)",
    );
    expect(result.output.conditions).toBeUndefined();
  });

  test("treats an existing deterministic spec task as represented even when only tree state and goal are populated", async () => {
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
    expect(result).toMatchObject({
      output: {
        state: "converged",
        actions: [],
      },
    });
    expect(result.output.summary).toContain(
      "represented review/attention task(s)",
    );
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

  test("treats feature-holder waits as representation when the spec catalog maps the row to that feature", async () => {
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
        actions: [],
      },
    });
  });

  test("treats family-scoped waits as representation when the wait token matches the spec family", async () => {
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
        actions: [],
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
            id: "spec/repair-verify-spec-reviewed-disposition-representation",
            parentId: "group/spec-verification",
            owner: "aks-explorer",
            input: { specId: "spec.reviewed" },
          },
        ],
      },
    });
    expect(result.output.actions[0].outcome).toContain(
      "structured reviewed disposition",
    );
    expect(result.output.actions[0].acceptance.join("\n")).toContain(
      "Do not launch an unchanged rerun",
    );
  });
});
