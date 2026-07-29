import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  execute,
  retryWorkflowAttentionAction,
} from "./normalize-scenario-frontier";

async function workspace(input: {
  missingAdapterFiles: string[];
  strictPassed?: boolean;
  remainingSpecReferencedPlainScenarioUnits?: unknown[];
  remainingRepoPlainScenarioFiles?: unknown[];
  tasks?: Record<string, Record<string, unknown>>;
  resources?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  attempts?: Record<string, unknown>;
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
    JSON.stringify({
      resources: input.resources ?? {},
      conditions: input.conditions ?? {},
      attempts: input.attempts ?? {},
    }),
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
      "const guard = {",
      `  passed: ${JSON.stringify(input.strictPassed ?? false)},`,
      `  remainingSpecReferencedPlainScenarioUnits: ${JSON.stringify(
        input.remainingSpecReferencedPlainScenarioUnits ?? [],
      )},`,
      `  remainingRepoPlainScenarioFiles: ${JSON.stringify(
        input.remainingRepoPlainScenarioFiles ?? [],
      )},`,
      "};",
      "console.log(JSON.stringify({ report, guard }));",
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
  test("requeues the same learned workflow after execution or owner-verification failure", () => {
    expect(
      retryWorkflowAttentionAction({
        id: "domain/normalize-case-a",
        generation: 3,
        state: "attention",
        parentId: "group/scenario-normalization",
        workflow: "spec-live-reconciliation",
        input: {},
        conditionIds: [],
        latestAttemptHandler: "workflow:spec-live-reconciliation",
        latestFailureReason: "HandlerExecutionFailed",
      }),
    ).toEqual({
      kind: "unblock-task",
      taskId: "domain/normalize-case-a",
      expectedGeneration: 3,
      reason: expect.stringContaining("same spec-live-reconciliation task"),
    });
    expect(
      retryWorkflowAttentionAction({
        id: "domain/normalize-case-a",
        generation: 3,
        state: "attention",
        parentId: "group/scenario-normalization",
        workflow: "spec-live-reconciliation",
        input: {},
        conditionIds: [],
        latestAttemptHandler: "owner:aks-explorer",
        latestFailureReason: "handler-blocked",
      }),
    ).toEqual({
      kind: "unblock-task",
      taskId: "domain/normalize-case-a",
      expectedGeneration: 3,
      reason: expect.stringContaining("accountable-owner result"),
    });
    expect(
      retryWorkflowAttentionAction({
        id: "domain/normalize-case-a",
        generation: 3,
        state: "attention",
        parentId: "group/scenario-normalization",
        workflow: "spec-live-reconciliation",
        input: {},
        conditionIds: [],
        latestAttemptHandler: "workflow:spec-live-reconciliation",
        latestFailureReason: "needs-owner",
      }),
    ).toBeNull();
  });

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
          workflow: "spec-live-reconciliation",
          priority: "P0",
          outputs: [
            "evidence/archive/",
            "features/feature-a/tests/case-a.test.ts",
          ],
          input: {
            adapterPath: "features/feature-a/tests/case-a.test.ts",
            specId: "spec.feature-a.case-a",
          },
        },
        {
          kind: "create-task",
          parentId: "group/scenario-normalization",
          owner: "aks-explorer",
          workflow: "spec-live-reconciliation",
          priority: "P0",
          outputs: [
            "evidence/archive/",
            "features/feature-a/tests/case-b.test.ts",
          ],
          input: {
            adapterPath: "features/feature-a/tests/case-b.test.ts",
            specId: "spec.feature-a.case-b",
          },
        },
      ],
    });
    expect(result.output.summary).toContain("2 current missing adapter");
    expect(result.output.actions[0].id).toMatch(
      /^domain\/reconcile-scenario-adapter-feature-a-tests-case-a-[a-f0-9]{8}$/,
    );
    expect(result.output.actions[0].input).toMatchObject({
      loopId: "scenario-normalization",
      workKey: "features/feature-a/tests/case-a.test.ts",
      workRevision: expect.any(String),
    });
    expect(result.output.actions[0].acceptance).toEqual(
      expect.arrayContaining([
        expect.stringContaining("integrate directly into dev"),
      ]),
    );
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

  test("caps overflow-sized missing-adapter evidence at the workflow limit", async () => {
    const missingAdapterFiles = Array.from(
      { length: 30 },
      (_, index) =>
        `features/feature-a/tests/case-${String(index + 1).padStart(2, "0")}.test.ts`,
    );
    const ws = await workspace({ missingAdapterFiles });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(5);
    expect(result.output.evidence).toHaveLength(32);
    expect(result.output.evidence.at(-1)).toBe(
      "evidence-truncated:8-row(s)-omitted-to-stay-within-32",
    );
    expect(
      result.output.evidence.filter((entry: string) => entry.startsWith("row:"))
        .length,
    ).toBe(22);
    expect(result.output.summary).toContain("30 current missing adapter");
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
          input: {
            loopId: "scenario-normalization",
            workKey: missingAdapterFiles[0],
          },
        },
        "domain/case-b": {
          id: "domain/case-b",
          phase: "running",
          input: {
            loopId: "scenario-normalization",
            workKey: missingAdapterFiles[1],
          },
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(3);
  });

  test("does not let an exact wait consume actionable scenario capacity", async () => {
    const missingAdapterFiles = ["a", "b", "c", "d", "e", "f"].map(
      (name) => `features/feature-a/tests/case-${name}.test.ts`,
    );
    const ws = await workspace({
      missingAdapterFiles,
      tasks: {
        "domain/wait-case-a": {
          id: "domain/wait-case-a",
          phase: "waiting",
          input: {
            loopId: "scenario-normalization",
            workKey: missingAdapterFiles[0],
          },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(5);
    expect(result.output.summary).toContain("1 waiting");
  });

  test("does not let a dependency-blocked pending leaf consume actionable capacity", async () => {
    const scenarioPaths = ["a", "b", "c", "d", "e", "f"].map(
      (name) => `features/feature-a/tests/case-${name}.ts`,
    );
    const blockedTaskId = "domain/blocked-case-a";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: scenarioPaths.map(
        (scenarioTestPath, index) => ({
          scenarioTestPath,
          adapterPath: scenarioTestPath.replace(/\.ts$/, ".test.ts"),
          specIds: [`spec.feature-a.case-${index}`],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        }),
      ),
      tasks: {
        [blockedTaskId]: {
          id: blockedTaskId,
          phase: "pending",
          readiness: {
            state: "dependency-blocked",
            reason: "Waiting for domain/prerequisite-a",
          },
          input: {
            loopId: "scenario-normalization",
            workKey: scenarioPaths[0],
          },
        },
        ...Object.fromEntries(
          scenarioPaths.slice(1, 5).map((scenarioTestPath, index) => [
            `domain/running-plain-${index + 1}`,
            {
              id: `domain/running-plain-${index + 1}`,
              phase: "running",
              input: {
                loopId: "scenario-normalization",
                workKey: scenarioTestPath,
              },
            },
          ]),
        ),
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0].input.scenarioTestPath).toBe(
      scenarioPaths[5],
    );
    expect(result.output.summary).toContain(
      "observed 4 actionable and 1 waiting",
    );
  });

  test("counts a terminal pipeline wait until its waiting task reconciles", async () => {
    const missingAdapterFiles = ["a", "b", "c", "d", "e", "f"].map(
      (name) => `features/feature-a/tests/case-${name}.test.ts`,
    );
    const waitConditionId = "pipeline-run-42-completed";
    const ws = await workspace({
      missingAdapterFiles,
      resources: {
        "domain/wait-case-a": {
          spec: {
            parentId: "scenario-normalization",
            input: {
              loopId: "scenario-normalization",
              workKey: missingAdapterFiles[0],
              adapterPath: missingAdapterFiles[0],
              specId: "spec.feature-a.case-a",
            },
          },
          status: {
            phase: "waiting",
            conditionIds: [waitConditionId],
          },
        },
      },
      conditions: {
        [waitConditionId]: {
          status: { state: "true" },
        },
      },
      tasks: Object.fromEntries(
        missingAdapterFiles.slice(1, 5).map((adapterPath, index) => [
          `domain/running-case-${index + 1}`,
          {
            id: `domain/running-case-${index + 1}`,
            phase: "running",
            input: {
              loopId: "scenario-normalization",
              workKey: adapterPath,
            },
          },
        ]),
      ),
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain(
      "counted 1 exact pipeline-backed wait(s) and 0 pending owner-adjudication handoff(s) against live execution capacity for 5/5 occupied slot(s)",
    );
    expect(result.output.evidence).toContain(
      "live-execution-capacity:5/5;pipeline-waits=1;owner-handoffs=0",
    );
  });

  test("counts exact pipeline waits against plain-carrier live execution capacity", async () => {
    const scenarioPaths = ["a", "b", "c", "d", "e", "f"].map(
      (name) => `features/feature-a/tests/case-${name}.ts`,
    );
    const waitConditionId = "pipeline-run-77-completed";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: scenarioPaths.map(
        (scenarioTestPath, index) => ({
          scenarioTestPath,
          adapterPath: scenarioTestPath.replace(/\.ts$/, ".test.ts"),
          specIds: [`spec.feature-a.case-${index}`],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        }),
      ),
      resources: {
        "domain/wait-case-a": {
          spec: {
            parentId: "scenario-normalization",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioPaths[0],
              scenarioTestPath: scenarioPaths[0],
            },
          },
          status: {
            phase: "waiting",
            conditionIds: [waitConditionId],
          },
        },
      },
      conditions: {
        [waitConditionId]: {
          status: { state: "unknown" },
        },
      },
      tasks: Object.fromEntries(
        scenarioPaths.slice(1, 5).map((scenarioTestPath, index) => [
          `domain/running-plain-${index + 1}`,
          {
            id: `domain/running-plain-${index + 1}`,
            phase: "running",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioTestPath,
            },
          },
        ]),
      ),
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain(
      "counted 1 exact pipeline-backed wait(s) and 0 pending owner-adjudication handoff(s) against live execution capacity for 5/5 occupied slot(s)",
    );
    expect(result.output.evidence).toContain(
      "live-execution-capacity:5/5;pipeline-waits=1;owner-handoffs=0",
    );
  });

  test("keeps a pipeline wait in capacity after its row leaves strict inventory", async () => {
    const currentPaths = ["b", "c", "d", "e", "f", "g"].map(
      (name) => `features/feature-a/tests/case-${name}.ts`,
    );
    const waitConditionId = "pipeline-run-88-completed";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: currentPaths.map(
        (scenarioTestPath, index) => ({
          scenarioTestPath,
          adapterPath: scenarioTestPath.replace(/\.ts$/, ".test.ts"),
          specIds: [`spec.feature-a.case-${index + 1}`],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        }),
      ),
      resources: {
        "domain/wait-old-case-a": {
          spec: {
            parentId: "group/scenario-normalization",
            input: {
              loopId: "scenario-normalization",
              workKey: "features/feature-a/tests/case-a.ts",
            },
          },
          status: {
            phase: "waiting",
            conditionIds: [waitConditionId],
          },
        },
      },
      tasks: Object.fromEntries(
        currentPaths.slice(0, 4).map((scenarioTestPath, index) => [
          `domain/running-current-${index + 1}`,
          {
            id: `domain/running-current-${index + 1}`,
            phase: "running",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioTestPath,
            },
          },
        ]),
      ),
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(0);
    expect(result.output.summary).toContain(
      "counted 1 exact pipeline-backed wait(s) and 0 pending owner-adjudication handoff(s) against live execution capacity for 5/5 occupied slot(s)",
    );
  });

  test("counts an active repair child in scenario live capacity", async () => {
    const currentPaths = ["b", "c", "d", "e", "f"].map(
      (name) => `features/feature-a/tests/case-${name}.ts`,
    );
    const parentId = "domain/normalize-old-case-a";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: currentPaths.map(
        (scenarioTestPath, index) => ({
          scenarioTestPath,
          adapterPath: scenarioTestPath.replace(/\.ts$/, ".test.ts"),
          specIds: [`spec.feature-a.case-${index + 1}`],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        }),
      ),
      resources: {
        [parentId]: {
          spec: {
            parentId: "group/scenario-normalization",
            input: {
              loopId: "scenario-normalization",
              workKey: "features/feature-a/tests/case-a.ts",
            },
          },
          status: { phase: "waiting" },
        },
      },
      tasks: {
        ...Object.fromEntries(
          currentPaths.slice(0, 3).map((scenarioTestPath, index) => [
            `domain/running-current-${index + 1}`,
            {
              id: `domain/running-current-${index + 1}`,
              phase: "running",
              input: {
                loopId: "scenario-normalization",
                workKey: scenarioTestPath,
              },
            },
          ]),
        ),
        "domain/repair-old-case-a": {
          id: "domain/repair-old-case-a",
          parent_id: parentId,
          phase: "running",
          input: {},
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0].input.scenarioTestPath).toBe(
      currentPaths[3],
    );
    expect(result.output.summary).toContain(
      "live execution capacity for 4/5 occupied slot(s)",
    );
  });

  test("keeps a needs-owner handoff in capacity after its row leaves inventory", async () => {
    const currentPaths = ["b", "c", "d", "e", "f", "g"].map(
      (name) => `features/feature-a/tests/case-${name}.ts`,
    );
    const ownerHandoffTaskId = "domain/owner-handoff-old-case-a";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: currentPaths.map(
        (scenarioTestPath, index) => ({
          scenarioTestPath,
          adapterPath: scenarioTestPath.replace(/\.ts$/, ".test.ts"),
          specIds: [`spec.feature-a.case-${index + 1}`],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        }),
      ),
      resources: {
        [ownerHandoffTaskId]: {
          metadata: { generation: 1 },
          spec: {
            parentId: "group/scenario-normalization",
            workflow: "spec-live-reconciliation",
            input: {
              loopId: "scenario-normalization",
              workKey: "features/feature-a/tests/case-a.ts",
            },
          },
          status: { phase: "attention" },
        },
      },
      attempts: {
        "owner-handoff": {
          taskId: ownerHandoffTaskId,
          startedAt: "2026-07-28T00:00:00Z",
          handler: "workflow:spec-live-reconciliation",
          failureReason: "needs-owner",
        },
      },
      tasks: Object.fromEntries(
        currentPaths.slice(0, 4).map((scenarioTestPath, index) => [
          `domain/running-current-${index + 1}`,
          {
            id: `domain/running-current-${index + 1}`,
            phase: "running",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioTestPath,
            },
          },
        ]),
      ),
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(0);
    expect(result.output.summary).toContain(
      "1 pending owner-adjudication handoff(s)",
    );
    expect(result.output.summary).toContain(
      "live execution capacity for 5/5 occupied slot(s)",
    );
  });

  test("converges when every missing adapter has useful represented work", async () => {
    const ws = await workspace({
      missingAdapterFiles: ["features/feature-a/tests/case-a.test.ts"],
      tasks: {
        "domain/existing-case-a": {
          id: "domain/existing-case-a",
          item_type: "task",
          phase: "running",
          input: {
            loopId: "scenario-normalization",
            workKey: "features/feature-a/tests/case-a.test.ts",
          },
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
  });

  test("treats current scenario-normalization direct children as represented missing-adapter work", async () => {
    const ws = await workspace({
      missingAdapterFiles: ["features/feature-a/tests/case-a.test.ts"],
      resources: {
        "domain/existing-case-a": {
          spec: {
            parentId: "scenario-normalization",
            input: {
              adapterPath: "features/feature-a/tests/case-a.test.ts",
              specId: "spec.feature-a.case-a",
            },
          },
          status: {
            phase: "running",
          },
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain("observed 1 actionable");
  });

  test("treats current scenario-normalization direct children as represented plain-carrier work", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath: "features/feature-a/tests/case-a.ts",
          adapterPath: "features/feature-a/tests/case-a.test.ts",
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      resources: {
        "domain/existing-case-a": {
          spec: {
            parentId: "scenario-normalization",
            input: {
              scenarioTestPath: "features/feature-a/tests/case-a.ts",
              specId: "spec.feature-a.case-a",
            },
          },
          status: {
            phase: "waiting",
          },
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain(
      "observed 0 actionable and 1 waiting",
    );
    expect(result.output.evidence).toContain(
      "plain-row:features/feature-a/tests/case-a.ts;specs=spec.feature-a.case-a;actionable=0;waiting=1;residue=0;branches=unchecked",
    );
  });

  test("treats an exact project-level plain-carrier successor as represented work", async () => {
    const scenarioTestPath = "features/feature-a/tests/case-a.ts";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath,
          adapterPath: "features/feature-a/tests/case-a.test.ts",
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      resources: {
        "domain/publish-case-a": {
          spec: {
            parentId: "project",
            input: {
              plainCarrierPath: scenarioTestPath,
              specId: "spec.feature-a.case-a",
            },
          },
          status: { phase: "waiting" },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    expect(result.output.summary).toContain(
      "observed 0 actionable and 1 waiting",
    );
  });

  test("treats an exact project-level successor keyed by legacy and normalized carrier paths as represented work", async () => {
    const scenarioTestPath = "features/feature-a/tests/case-a.ts";
    const adapterPath = "features/feature-a/tests/case-a.test.ts";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath,
          adapterPath,
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      resources: {
        "domain/escalate-case-a": {
          spec: {
            parentId: "project",
            input: {
              legacyCarrierPath: scenarioTestPath,
              normalizedCarrierPath: adapterPath,
              specId: "spec.feature-a.case-a",
            },
          },
          status: { phase: "waiting" },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    expect(result.output.summary).toContain(
      "observed 0 actionable and 1 waiting",
    );
    expect(result.output.evidence).toContain(
      `plain-row:${scenarioTestPath};specs=spec.feature-a.case-a;actionable=0;waiting=1;residue=0;branches=unchecked`,
    );
  });

  test("does not let an unrelated project-level task hide a plain-carrier row by spec id alone", async () => {
    const scenarioTestPath = "features/feature-a/tests/case-a.ts";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath,
          adapterPath: "features/feature-a/tests/case-a.test.ts",
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      resources: {
        "domain/unrelated-case-a": {
          spec: {
            parentId: "project",
            input: { specId: "spec.feature-a.case-a" },
          },
          status: { phase: "waiting" },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toMatchObject([
      {
        kind: "create-task",
        input: { scenarioTestPath },
      },
    ]);
    expect(result.output.actions[0].id).toMatch(
      /^domain\/normalize-plain-scenario-carrier-feature-a-tests-case-a\.ts-[a-f0-9]{8}$/,
    );
  });

  test("declares bounded plain-carrier normalization work when strict inventory stays red without missing adapters", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath: "features/feature-a/tests/case-a.ts",
          adapterPath: "features/feature-a/tests/case-a.test.ts",
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      remainingRepoPlainScenarioFiles: ["features/plain/test-a.ts"],
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "group/scenario-normalization",
          owner: "aks-explorer",
          workflow: "spec-live-reconciliation",
          priority: "P0",
          outputs: [
            "evidence/archive/",
            "features/feature-a/tests/case-a.test.ts",
          ],
          input: {
            scenarioTestPath: "features/feature-a/tests/case-a.ts",
            adapterPath: "features/feature-a/tests/case-a.test.ts",
            specId: "spec.feature-a.case-a",
            specIds: ["spec.feature-a.case-a"],
          },
        },
      ],
    });
    expect(result.output.summary).toContain("remains strict-red");
    expect(result.output.summary).toContain("zero missing adapter files");
    expect(result.output.summary).toContain(
      "bounded plain-carrier normalization task action",
    );
    expect(result.output.evidence).toContain("strict-passed:false");
    expect(result.output.evidence).toContain(
      "remaining-spec-referenced-plain-scenario-units:1",
    );
    expect(result.output.evidence).toContain(
      "remaining-repo-plain-scenario-files:1",
    );
    expect(result.output.evidence).toContain(
      "plain-row:features/feature-a/tests/case-a.ts;specs=spec.feature-a.case-a;actionable=0;waiting=0;residue=0;branches=0",
    );
  });

  test("retries an attention leaf on the same task after workflow execution failed", async () => {
    const scenarioTestPath = "features/feature-a/tests/case-a.ts";
    const taskId = "domain/normalize-case-a";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath,
          adapterPath: "features/feature-a/tests/case-a.test.ts",
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      resources: {
        [taskId]: {
          metadata: { generation: 2 },
          spec: {
            parentId: "group/scenario-normalization",
            workflow: "spec-live-reconciliation",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioTestPath,
              scenarioTestPath,
              specId: "spec.feature-a.case-a",
            },
          },
          status: { phase: "attention" },
        },
      },
      attempts: {
        attempt: {
          taskId,
          startedAt: "2026-07-26T05:00:00Z",
          handler: "workflow:spec-live-reconciliation",
          failureReason: "HandlerExecutionFailed",
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toEqual([
      {
        kind: "unblock-task",
        taskId,
        expectedGeneration: 2,
        reason: expect.stringContaining("same spec-live-reconciliation task"),
      },
    ]);
  });

  test("fills plain-carrier capacity from disjoint feature scopes first", async () => {
    const row = (featureId: string, caseId: string) => ({
      scenarioTestPath: `features/${featureId}/tests/${caseId}.ts`,
      adapterPath: `features/${featureId}/tests/${caseId}.test.ts`,
      specIds: [`spec.${featureId}.${caseId}`],
      featureIds: [featureId],
      activeSpecCount: 1,
    });
    const representedPath = "features/feature-a/tests/running.ts";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        row("feature-a", "running"),
        row("feature-a", "case-a"),
        row("feature-a", "case-b"),
        row("feature-b", "case-a"),
        row("feature-c", "case-a"),
        row("feature-d", "case-a"),
        row("feature-e", "case-a"),
      ],
      resources: {
        "domain/feature-a-running": {
          metadata: { generation: 1 },
          spec: {
            parentId: "group/scenario-normalization",
            workflow: "spec-live-reconciliation",
            input: {
              loopId: "scenario-normalization",
              workKey: representedPath,
              scenarioTestPath: representedPath,
            },
          },
          status: { phase: "running" },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    const selectedPaths = result.output.actions.map(
      (action: any) => action.input.scenarioTestPath,
    );

    expect(selectedPaths).toEqual([
      "features/feature-b/tests/case-a.ts",
      "features/feature-c/tests/case-a.ts",
      "features/feature-d/tests/case-a.ts",
      "features/feature-e/tests/case-a.ts",
    ]);
  });

  test("rebinds a pending spec-backed normalization leaf that lost its workflow", async () => {
    const scenarioTestPath = "features/feature-a/tests/case-a.ts";
    const taskId =
      "domain/normalize-plain-scenario-carrier-feature-a-tests-case-a.ts";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath,
          adapterPath: "features/feature-a/tests/case-a.test.ts",
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      remainingRepoPlainScenarioFiles: [scenarioTestPath],
      resources: {
        [taskId]: {
          metadata: { id: taskId, generation: 2, resourceVersion: 4 },
          spec: {
            parentId: "group/scenario-normalization",
            owner: "aks-explorer",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioTestPath,
              scenarioTestPath,
              specId: "spec.feature-a.case-a",
              specIds: ["spec.feature-a.case-a"],
            },
          },
          status: { phase: "pending" },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toEqual([
      {
        kind: "update-task",
        taskId,
        expectedGeneration: 2,
        owner: "aks-explorer",
        workflow: "spec-live-reconciliation",
      },
    ]);
  });

  test("renews a still-red row with a revision-qualified id after a completed receipt", async () => {
    const scenarioTestPath = "features/feature-a/tests/case-a.ts";
    const completedId =
      "domain/normalize-plain-scenario-carrier-feature-a-tests-case-a.ts";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [
        {
          scenarioTestPath,
          adapterPath: "features/feature-a/tests/case-a.test.ts",
          specIds: ["spec.feature-a.case-a"],
          featureIds: ["feature-a"],
          activeSpecCount: 1,
        },
      ],
      remainingRepoPlainScenarioFiles: [scenarioTestPath],
    });
    await writeFile(
      join(ws.appDir, ".state", "tasks", "state.json"),
      JSON.stringify({
        resources: {},
        conditions: {},
        receipts: { [completedId]: { metadata: { id: completedId } } },
      }),
    );

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0]).toMatchObject({
      kind: "create-task",
      input: { scenarioTestPath },
    });
    expect(result.output.actions[0].id).not.toBe(completedId);
    expect(result.output.actions[0].id).toMatch(/-[a-f0-9]{8}$/);
  });

  test("continues with repository-only plain carriers after spec references are normalized", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: false,
      remainingSpecReferencedPlainScenarioUnits: [],
      remainingRepoPlainScenarioFiles: ["features/feature-a/tests/case-a.ts"],
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "group/scenario-normalization",
          owner: "aks-explorer",
          workflow: "domain-task-execution",
          input: {
            target: "staging",
            normalizationScope: "repository-only",
            scenarioTestPath: "features/feature-a/tests/case-a.ts",
            adapterPath: "features/feature-a/tests/case-a.test.ts",
            specIds: [],
          },
        },
      ],
    });
    expect(result.output.summary).toContain("remains strict-red");
    expect(result.output.summary).toContain(
      "1 repository-only plain scenario file",
    );
    expect(result.output.evidence).toContain(
      "repo-plain-row:features/feature-a/tests/case-a.ts;specs=unknown;actionable=0;waiting=0;residue=0;branches=0",
    );
    expect(result.output.actions[0].acceptance).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "remainingSpecReferencedPlainScenarioUnits and remainingRepoPlainScenarioFiles",
        ),
        expect.stringContaining("move the required behavior"),
        expect.stringContaining("Preserve input.target"),
      ]),
    );
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
            input: {
              loopId: "scenario-normalization",
              workKey: "features/feature-a/tests/case-a.test.ts",
            },
          },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
  });

  test("converges when every red row is covered by exact waits", async () => {
    const missingAdapterFiles = ["a", "b", "c", "d", "e"].map(
      (name) => `features/feature-a/tests/case-${name}.test.ts`,
    );
    const tasks = Object.fromEntries(
      missingAdapterFiles.map((adapterPath, index) => [
        `domain/wait-case-${index}`,
        {
          id: `domain/wait-case-${index}`,
          item_type: "task",
          phase: "waiting",
          input: {
            loopId: "scenario-normalization",
            workKey: adapterPath,
          },
        },
      ]),
    );
    const ws = await workspace({ missingAdapterFiles, tasks });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain(
      "observed 0 actionable and 5 waiting",
    );
    expect(result.output.evidence).not.toContain(
      "frontier-underfilled:actionable=0;desiredMin=3;waitOnlyRows=5",
    );
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
