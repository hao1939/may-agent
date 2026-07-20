import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execute } from "./normalize-scenario-frontier";

async function workspace(input: {
  missingAdapterFiles: string[];
  tasks?: Record<string, Record<string, unknown>>;
  resources?: Record<string, unknown>;
}) {
  const root = await mkdtemp(join(tmpdir(), "scenario-frontier-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(join(projectDir, "scripts"), { recursive: true });
  await mkdir(join(projectDir, "features", "feature-a", "specs"), {
    recursive: true,
  });
  await writeFile(
    join(appDir, ".state", "tasks", "state.json"),
    JSON.stringify({ resources: input.resources ?? {} }),
  );
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({ tasks: input.tasks ?? {}, resources: {}, receipts: {} }),
  );
  await writeFile(
    join(projectDir, "scripts", "check-scenario-tests.ts"),
    [
      "const report = {",
      "  generatedAt: '2026-07-20T00:00:00Z',",
      "  directVitestImplementationCount: 1,",
      "  referencedPlainActiveSpecCount: 1,",
      "  referencedPlainScenarioCount: 1,",
      "  repoPlainScenarioFileCount: 1,",
      `  missingAdapterFiles: ${JSON.stringify(input.missingAdapterFiles)}`,
      "};",
      "console.log(JSON.stringify({ report, guard: { passed: false } }));",
      "process.exit(1);",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(projectDir, "features", "feature-a", "specs", "case-a.json"),
    JSON.stringify({
      id: "spec.feature-a.case-a",
      probeRef: "features/feature-a/tests/case-a.ts",
    }),
  );
  await writeFile(
    join(projectDir, "features", "feature-a", "specs", "case-b.json"),
    JSON.stringify({
      id: "spec.feature-a.case-b",
      probeRef: "features/feature-a/tests/case-b.ts",
    }),
  );
  for (const adapter of input.missingAdapterFiles) {
    const legacy = adapter.replace(/\.test\.ts$/, ".ts");
    await mkdir(dirname(join(projectDir, legacy)), { recursive: true });
    await writeFile(join(projectDir, legacy), "// legacy carrier\n");
  }
  return { appDir, projectDir };
}

function context(appDir: string, projectDir: string) {
  return {
    task: [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      "## Trigger Event",
      "```json",
      JSON.stringify({
        type: "project.task.tick",
        target: {
          project: "aks-rp-e2e",
          taskId: "scenario-normalization",
        },
        data: { desiredRunnableLeaves: { min: 3, max: 5 } },
      }),
      "```",
    ].join("\n"),
    agent: "aks-explorer",
    done: (message: string, output?: unknown) => ({
      status: "done",
      message,
      output,
    }),
  } as any;
}

describe("normalize scenario frontier workflow", () => {
  test("declares bounded owner work for missing adapters without mutating state", async () => {
    const ws = await workspace({
      missingAdapterFiles: [
        "features/feature-a/tests/case-a.test.ts",
        "features/feature-a/tests/case-b.test.ts",
      ],
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "group/scenario-normalization",
          owner: "aks-explorer",
          input: {
            adapterPath: "features/feature-a/tests/case-a.test.ts",
            specId: "spec.feature-a.case-a",
          },
        },
        {
          kind: "create-task",
          parentId: "group/scenario-normalization",
          owner: "aks-explorer",
          input: {
            adapterPath: "features/feature-a/tests/case-b.test.ts",
            specId: "spec.feature-a.case-b",
          },
        },
      ],
    });
    expect(result.output.summary).toContain("2 current missing adapter");
  });

  test("declares at most five exact leaves when the red frontier has free capacity", async () => {
    const missingAdapterFiles = ["a", "b", "c", "d", "e", "f"].map(
      (name) => `features/feature-a/tests/case-${name}.test.ts`,
    );
    const ws = await workspace({ missingAdapterFiles });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(5);
    expect(
      result.output.actions.every(
        (action: Record<string, unknown>) =>
          action.parentId === "group/scenario-normalization",
      ),
    ).toBe(true);
    expect(
      new Set(
        result.output.actions.map(
          (action: { input: { adapterPath: string } }) =>
            action.input.adapterPath,
        ),
      ).size,
    ).toBe(5);
  });

  test("subtracts represented leaves from scenario capacity", async () => {
    const missingAdapterFiles = ["a", "b", "c", "d", "e", "f"].map(
      (name) => `features/feature-a/tests/case-${name}.test.ts`,
    );
    const ws = await workspace({
      missingAdapterFiles,
      tasks: {
        "domain/case-a": {
          id: "domain/case-a",
          phase: "running",
          outcome: `Reconcile ${missingAdapterFiles[0]}`,
        },
        "domain/case-b": {
          id: "domain/case-b",
          phase: "running",
          outcome: `Reconcile ${missingAdapterFiles[1]}`,
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(3);
  });

  test("converges when every missing adapter has useful represented work", async () => {
    const ws = await workspace({
      missingAdapterFiles: ["features/feature-a/tests/case-a.test.ts"],
      tasks: {
        "domain/existing-case-a": {
          id: "domain/existing-case-a",
          item_type: "task",
          phase: "running",
          outcome:
            "Reconcile spec.feature-a.case-a from features/feature-a/tests/case-a.test.ts",
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
  });

  test("does not count broad family waits as exact adapter-row work", async () => {
    const adapterPath = "features/feature-a/tests/case-a.test.ts";
    const ws = await workspace({
      missingAdapterFiles: [adapterPath],
      tasks: {
        "wait-shared-underlay-runtime-input-family-feature-a-inclusive": {
          id: "wait-shared-underlay-runtime-input-family-feature-a-inclusive",
          item_type: "task",
          phase: "waiting",
          outcome:
            "Wait for shared underlay inputs before running spec.feature-a.case-a.",
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "group/scenario-normalization",
          owner: "aks-explorer",
          input: {
            adapterPath,
            specId: "spec.feature-a.case-a",
          },
        },
      ],
    });
    expect(result.output.conditions).toBeUndefined();
  });

  test("counts exact repo-ref waits that carry the adapter stem", async () => {
    const ws = await workspace({
      missingAdapterFiles: ["features/feature-a/tests/case-a.test.ts"],
      tasks: {
        "domain/wait-feature-a-case-a-origin-dev-publication-after-next-dev-advance":
          {
            id: "domain/wait-feature-a-case-a-origin-dev-publication-after-next-dev-advance",
            item_type: "task",
            phase: "waiting",
            outcome:
              "Wait for origin/dev to absorb spec.feature-a.case-a publication.",
          },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
  });

  test("does not treat parent or runtime summaries as represented work", async () => {
    const adapterPath = "features/feature-a/tests/case-a.test.ts";
    const ws = await workspace({
      missingAdapterFiles: [adapterPath],
      resources: {
        "scenario-normalization": {
          spec: {
            owner: "aks-explorer",
            outcome: "Normalize scenario adapter gaps",
          },
          status: {
            phase: "waiting",
            summary: `Scenario frontier previously mentioned ${adapterPath}`,
            evidence: [`row:${adapterPath};spec=spec.feature-a.case-a`],
          },
        },
        "runtime/focus-review/plan": {
          spec: {
            owner: "app-ops",
            outcome: `Review focus around ${adapterPath}`,
          },
          status: { phase: "running" },
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "group/scenario-normalization",
          owner: "aks-explorer",
          input: {
            adapterPath,
            specId: "spec.feature-a.case-a",
          },
        },
      ],
    });
    expect(result.output.conditions).toBeUndefined();
  });
});
