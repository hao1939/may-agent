import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  execute,
  retryWorkflowAttentionAction,
  runRequiredRepositoryCheck,
} from "./normalize-scenario-frontier";

async function workspace(input: {
  missingAdapterFiles: string[];
  strictPassed?: boolean;
  activeSpecCount?: number;
  unreferencedPlainScenarioFiles?: string[];
  unpairedAdapterFiles?: string[];
  scenarioSignalCounts?: Partial<{
    hasCheckModeGuard: number;
    hasExecuteFlag: number;
    hasMutationGateEnv: number;
    writesArchiveEvidence: number;
    hasCleanupSignal: number;
    mentionsSharedFixture: number;
    hasHardCodedSubscriptionDefault: number;
  }>;
  reviewedQualityLiveCoverage?: {
    activeSpecCount: number;
    reviewedSpecCount: number;
    representedSpecCount: number;
    incompleteSpecIds: string[];
  };
  reportRows?: unknown[];
  files?: Record<string, string>;
  specLoopSpecs?: Record<string, Record<string, unknown>>;
  remainingSpecReferencedPlainScenarioUnits?: unknown[];
  remainingRepoPlainScenarioFiles?: unknown[];
  tasks?: Record<string, Record<string, unknown>>;
  resources?: Record<string, unknown>;
  receipts?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  attempts?: Record<string, unknown>;
  repositoryCheckExitCode?: number;
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
      receipts: input.receipts ?? {},
      conditions: input.conditions ?? {},
      attempts: input.attempts ?? {},
    }),
  );
  if (input.specLoopSpecs) {
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "spec-loop", "state.json"),
      JSON.stringify({
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 5,
        cursor: 0,
        prioritySpecIds: [],
        specs: input.specLoopSpecs,
      }),
    );
  }
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    JSON.stringify({ tasks: input.tasks ?? {}, resources: {}, receipts: {} }),
  );
  const activeSpecCount = input.activeSpecCount ?? 1;
  const scenarioSignalCounts = {
    hasCheckModeGuard: activeSpecCount,
    hasExecuteFlag: activeSpecCount,
    hasMutationGateEnv: activeSpecCount,
    writesArchiveEvidence: activeSpecCount,
    hasCleanupSignal: activeSpecCount,
    mentionsSharedFixture: 0,
    hasHardCodedSubscriptionDefault: 0,
    ...(input.scenarioSignalCounts ?? {}),
  };
  const reportRows =
    input.reportRows ??
    Array.from({ length: activeSpecCount }, (_, index) => ({
      specId: `spec.feature-a.case-${String.fromCharCode(97 + index)}`,
    }));
  await writeFile(
    join(projectDir, "scripts", "check-scenario-tests.ts"),
    [
      "const report = {",
      "  generatedAt: '2026-07-20T00:00:00Z',",
      `  activeSpecCount: ${JSON.stringify(activeSpecCount)},`,
      "  directVitestImplementationCount: 1,",
      "  referencedPlainActiveSpecCount: 1,",
      "  referencedPlainScenarioCount: 1,",
      "  repoPlainScenarioFileCount: 1,",
      `  missingAdapterFiles: ${JSON.stringify(input.missingAdapterFiles)},`,
      `  unreferencedPlainScenarioFiles: ${JSON.stringify(input.unreferencedPlainScenarioFiles ?? [])},`,
      `  unpairedAdapterFiles: ${JSON.stringify(input.unpairedAdapterFiles ?? [])},`,
      `  reviewedQualityLiveCoverage: ${JSON.stringify(input.reviewedQualityLiveCoverage)},`,
      `  rows: ${JSON.stringify(reportRows)},`,
      `  signalCounts: ${JSON.stringify({ scenarios: scenarioSignalCounts, adapters: {} })}`,
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
    join(projectDir, "scripts", "repository-check.ts"),
    [
      "console.log('repository regression checks complete');",
      ...(input.repositoryCheckExitCode === 0
        ? []
        : [
            "console.error('Runtime/generated data is tracked by git.');",
            "console.error('- evidence/archive/runtime-result.md');",
          ]),
      `process.exit(${input.repositoryCheckExitCode ?? 0});`,
      "",
    ].join("\n"),
  );
  await writeFile(
    join(projectDir, "package.json"),
    JSON.stringify({ scripts: { check: "bun scripts/repository-check.ts" } }),
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
  for (const [relativePath, content] of Object.entries(input.files ?? {})) {
    await mkdir(dirname(join(projectDir, relativePath)), { recursive: true });
    await writeFile(join(projectDir, relativePath), content);
  }
  return { appDir, projectDir };
}

function context(
  appDir: string,
  projectDir: string,
  taskInput?: Record<string, unknown>,
) {
  const input = taskInput ?? {};
  const read = (name: string) =>
    JSON.parse(
      readFileSync(join(appDir, ".state", "tasks", name), "utf8"),
    ) as Record<string, any>;
  const state = read("state.json");
  const tree = read("tree.json");
  const resources = state.resources ?? {};
  const tasks = tree.tasks ?? {};
  const attempts = Object.values(state.attempts ?? {}) as Record<string, any>[];
  const latestAttempt = (taskId: string) =>
    attempts
      .filter((attempt) => attempt.taskId === taskId)
      .sort((left, right) =>
        String(right.startedAt ?? "").localeCompare(
          String(left.startedAt ?? ""),
        ),
      )[0];
  const live = Object.entries({ ...tasks, ...resources }).flatMap(
    ([taskId, value]: [string, any]) => {
      const task = tasks[taskId] ?? {};
      const resource = resources[taskId] ?? {};
      const spec = resource.spec ?? task;
      const status = resource.status ?? task;
      const phase = String(status.phase ?? status.state ?? "pending");
      if (["done", "closed", "converged"].includes(phase)) return [];
      const attempt = latestAttempt(taskId);
      return [
        {
          taskId,
          parentId: String(
            spec.parentId ?? task.parent_id ?? "scenario-normalization",
          ),
          generation: Number(
            resource.metadata?.generation ?? task.generation ?? 1,
          ),
          status: phase,
          outcome: String(spec.outcome ?? task.outcome ?? "fixture task"),
          ...(typeof spec.agent === "string" || typeof task.agent === "string"
            ? { agent: String(spec.agent ?? task.agent) }
            : {}),
          ...(typeof spec.workflow === "string" ||
          typeof task.workflow === "string"
            ? { workflow: String(spec.workflow ?? task.workflow) }
            : {}),
          input: spec.input ?? task.input ?? {},
          priority: spec.priority ?? task.priority,
          ...(typeof spec.category === "string" ||
          typeof task.category === "string"
            ? { category: String(spec.category ?? task.category) }
            : {}),
          ...(task.readiness && typeof task.readiness === "object"
            ? {
                readiness: {
                  state: String(task.readiness.state ?? "not-applicable"),
                  reason: String(task.readiness.reason ?? "test fixture"),
                  relatedTaskIds: Array.isArray(task.readiness.related_ids)
                    ? task.readiness.related_ids
                    : [],
                },
              }
            : {}),
          conditions: (status.conditionIds ?? task.condition_ids ?? []).flatMap(
            (conditionId: string) => {
              const condition = state.conditions?.[conditionId];
              const spec = condition?.spec ?? condition ?? {};
              return [
                {
                  id: conditionId,
                  type: String(spec.type ?? "fixture.condition"),
                  subject: String(spec.subject ?? `task:${taskId}`),
                  expected: spec.expected ?? { state: "completed" },
                  ...(typeof spec.agent === "string"
                    ? { agent: spec.agent }
                    : {}),
                },
              ];
            },
          ),
          latestAttempt: attempt
            ? {
                handler: String(attempt.handler ?? ""),
                failureReason: String(attempt.failureReason ?? ""),
              }
            : undefined,
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
      parentId: String(receipt.parentId ?? "scenario-normalization"),
      generation: Number(receipt.metadata?.generation ?? 1),
      status: "done",
      outcome: String(receipt.outcome ?? "fixture receipt"),
      input: receipt.input ?? {},
      conditions: [],
      hasLiveChildren: false,
      evidence: receipt.evidence ?? [],
      summary: receipt.summary,
      completedAt: receipt.completedAt ?? "2026-01-01T00:00:00Z",
    }),
  );
  return {
    input,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "scenario-normalization",
      generation: 1,
      resourceVersion: 1,
      agent: "aks-explorer",
      mode: "maintain",
      outcome: "Normalize the scenario frontier",
      acceptance: ["The current scenario frontier is accounted for."],
      input,
      children: { live, completed },
      events: {
        items: [
          {
            observedAt: "2026-08-21T00:00:00.000Z",
            event: {
              type: "project.task.tick",
              target: {
                project: "aks-rp-e2e",
                taskId: "scenario-normalization",
              },
              data: { desiredRunnableLeaves: { min: 3, max: 5 } },
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
      output: join(projectDir, "evidence", "archive"),
    },
    done: (message: string, output?: unknown) => ({
      id: "workflow:test",
      kind: "workflow",
      status: "done",
      summary: message,
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
        latestFailureReason: "needs-agent",
      }),
    ).toBeNull();
  });

  test("declares bounded owner work for missing adapters without changing state", async () => {
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
          parentId: "scenario-normalization",
          agent: "aks-explorer",
          workflow: "spec-live-reconciliation",
          priority: "P1",
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
          parentId: "scenario-normalization",
          agent: "aks-explorer",
          workflow: "spec-live-reconciliation",
          priority: "P1",
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
          action.parentId === "scenario-normalization",
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
    expect(String(result.output.evidence.at(-1))).toContain(
      "evidence-truncated:",
    );
    expect(
      result.output.evidence.filter((entry: string) => entry.startsWith("row:"))
        .length,
    ).toBeLessThan(30);
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

  test("does not count an ops descendant against domain live execution capacity", async () => {
    const currentPaths = ["b", "c", "d", "e", "f", "g"].map(
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
        "ops/authorize-old-case-a": {
          id: "ops/authorize-old-case-a",
          parent_id: parentId,
          phase: "running",
          input: {},
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0].input.scenarioTestPath).toBe(
      currentPaths[4],
    );
    expect(result.output.summary).toContain(
      "live execution capacity for 4/5 occupied slot(s)",
    );
  });

  test("keeps a needs-agent handoff in capacity after its row leaves inventory", async () => {
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
          failureReason: "needs-agent",
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

  test("does not treat a generic waiting child as a source-normalization owner", async () => {
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
    expect(result.output.actions).toMatchObject([
      {
        kind: "create-task",
        input: {
          scenarioTestPath: "features/feature-a/tests/case-a.ts",
          representedTaskIds: ["domain/existing-case-a"],
        },
      },
    ]);
    expect(result.output.summary).toContain(
      "observed 0 actionable and 1 waiting",
    );
    expect(result.output.evidence).toContain(
      "plain-row:features/feature-a/tests/case-a.ts;specs=spec.feature-a.case-a;actionable=0;waiting=1;residue=0;branches=0",
    );
  });

  test("does not let a product wait hide separate source normalization work", async () => {
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

    expect(result.output.actions).toMatchObject([
      {
        kind: "create-task",
        input: {
          scenarioTestPath,
          representedTaskIds: ["domain/publish-case-a"],
        },
      },
    ]);
    expect(result.output.summary).toContain(
      "observed 0 actionable and 1 waiting",
    );
  });

  test("keeps an external adjudication wait while creating source normalization work", async () => {
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

    expect(result.output.actions).toMatchObject([
      {
        kind: "create-task",
        input: {
          scenarioTestPath,
          representedTaskIds: ["domain/escalate-case-a"],
        },
      },
    ]);
    expect(result.output.summary).toContain(
      "observed 0 actionable and 1 waiting",
    );
    expect(result.output.evidence).toContain(
      `plain-row:${scenarioTestPath};specs=spec.feature-a.case-a;actionable=0;waiting=1;residue=0;branches=0`,
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
          parentId: "scenario-normalization",
          agent: "aks-explorer",
          workflow: "spec-live-reconciliation",
          priority: "P1",
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
      "declared-normalization-actions:1",
    );
    expect(result.output.evidence).toContain("actionable-plain-rows:0");
    expect(result.output.evidence).toContain("waiting-plain-rows:0");
    expect(result.output.evidence).toContain(
      "plain-row:features/feature-a/tests/case-a.ts;specs=spec.feature-a.case-a;actionable=0;waiting=0;residue=0;branches=0",
    );
  });

  test("returns needs-agent when file-layout is complete but unpaired/unreferenced direct-carrier gaps remain", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 3,
      unreferencedPlainScenarioFiles: [
        "features/feature-a/tests/legacy-shared.ts",
      ],
      unpairedAdapterFiles: [
        "features/feature-a/tests/case-a.diagnostics.test.ts",
      ],
      scenarioSignalCounts: {
        hasCheckModeGuard: 2,
        hasExecuteFlag: 3,
        hasMutationGateEnv: 1,
        writesArchiveEvidence: 0,
        hasCleanupSignal: 0,
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output.state).toBe("needs-agent");
    expect(result.output.summary).toContain(
      "completed file-layout normalization",
    );
    expect(result.output.summary).toContain(
      "broader direct-carrier normalization remains incomplete",
    );
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "active-specs:3",
        "strict-passed:true",
        "unreferenced-plain-scenario-files:1",
        "unpaired-adapter-files:1",
        "scenario-signal-counts:hasCheckModeGuard:2,hasCleanupSignal:0,hasExecuteFlag:3,hasHardCodedSubscriptionDefault:0,hasMutationGateEnv:1,mentionsSharedFixture:0,writesArchiveEvidence:0",
      ]),
    );
  });

  test("keeps structural 0/0 nonterminal while reviewed/live coverage is missing", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 2,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output.state).toBe("needs-agent");
    expect(result.output.summary).toContain(
      "per-spec reviewed-quality/live-proof coverage is active:2,reviewed:0,represented:0,incomplete:2",
    );
  });

  test("does not treat stale spec-loop pass or terminal rows as current-source quality live proof", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 2,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      specLoopSpecs: {
        "spec.feature-a.case-a": {
          status: "pass",
          attempts: 1,
          lastRunId: "101",
          lastResultPath: "result-a.json",
          updatedAt: "2026-07-20T00:00:00Z",
        },
        "spec.feature-a.case-b": {
          status: "done",
          attempts: 1,
          lastRunId: "102",
          lastResultPath: "result-b.json",
          updatedAt: "2026-07-20T00:00:00Z",
          terminalDisposition: true,
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output.state).toBe("needs-agent");
    expect(result.output.summary).toContain(
      "per-spec reviewed-quality/live-proof coverage is active:2,reviewed:0,represented:0,incomplete:2",
    );
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "quality-live-incomplete-spec:spec.feature-a.case-a",
        "quality-live-incomplete-spec:spec.feature-a.case-b",
      ]),
    );
  });

  test("converges once structural gaps and reviewed/live coverage are complete even if raw scenario counts are uneven", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 2,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      scenarioSignalCounts: {
        hasCheckModeGuard: 2,
        hasExecuteFlag: 1,
        hasMutationGateEnv: 0,
        writesArchiveEvidence: 0,
        hasCleanupSignal: 0,
      },
      reviewedQualityLiveCoverage: {
        activeSpecCount: 2,
        reviewedSpecCount: 2,
        representedSpecCount: 2,
        incompleteSpecIds: [],
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain(
      "strict inventory reports zero missing adapter files",
    );
  });

  test("keeps the frontier open while current quality siblings are still live", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      reviewedQualityLiveCoverage: {
        activeSpecCount: 1,
        reviewedSpecCount: 1,
        representedSpecCount: 1,
        incompleteSpecIds: [],
      },
      resources: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          spec: {
            parentId: "group/scenario-normalization",
            workflow: "spec-live-reconciliation",
            input: {
              loopId: "scenario-normalization",
              normalizationScope: "quality",
              specId: "spec.feature-a.case-a",
              allowTerminalDisposition: false,
            },
          },
          status: {
            phase: "running",
          },
        },
      },
    });
    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;
    expect(result.output.state).toBe("waiting");
    expect(result.output.summary).toContain(
      "still represent active same-spec work or exact waits under group/scenario-normalization",
    );
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "open-quality-coverage-tasks:1",
        "open-quality-coverage-task:domain/reconcile-direct-scenario-quality-feature-a-case-a",
      ]),
    );
  });

  test("keeps the frontier open when current quality coverage tasks exhaust capacity without new actions", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: [
            "https://learn.microsoft.com/azure/aks/example-scenario",
          ],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("already represented by a live quality holder");',
          "});",
        ].join("\n"),
      },
      reviewedQualityLiveCoverage: {
        activeSpecCount: 1,
        reviewedSpecCount: 0,
        representedSpecCount: 0,
        incompleteSpecIds: ["spec.feature-a.case-a"],
      },
      resources: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          spec: {
            parentId: "group/scenario-normalization",
            workflow: "spec-live-reconciliation",
            input: {
              loopId: "scenario-normalization",
              workKey: "features/feature-a/tests/case-a.test.ts",
              normalizationScope: "quality",
              specId: "spec.feature-a.case-a",
              allowTerminalDisposition: false,
            },
          },
          status: {
            phase: "waiting",
            conditionIds: ["pipeline-run-101-completed"],
          },
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("waiting");
    expect(result.output.summary).toContain(
      "no new bounded repair was declared from this pass",
    );
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "repository-check-command:bun run check",
        "repository-check-status:passed",
        "quality-normalization-rows:1",
        "declared-quality-actions:0",
        "open-quality-coverage-tasks:1",
        "open-quality-coverage-task:domain/reconcile-direct-scenario-quality-feature-a-case-a",
      ]),
    );
  });

  test("keeps the frontier open when new quality actions are declared alongside live holders", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 2,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
        {
          specId: "spec.feature-a.case-b",
          specFile: "features/feature-a/specs/case-b.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-b.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: [
            "https://learn.microsoft.com/azure/aks/example-scenario",
          ],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/specs/case-b.json": JSON.stringify({
          id: "spec.feature-a.case-b",
          probeRef: "features/feature-a/tests/case-b.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-b.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: [
            "https://learn.microsoft.com/azure/aks/example-scenario",
          ],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("already represented by a live quality holder");',
          "});",
        ].join("\n"),
        "features/feature-a/tests/case-b.test.ts": [
          'import { test } from "vitest";',
          'test("case-b", async () => {',
          '  console.log("needs a new bounded quality repair");',
          "});",
        ].join("\n"),
      },
      reviewedQualityLiveCoverage: {
        activeSpecCount: 2,
        reviewedSpecCount: 0,
        representedSpecCount: 0,
        incompleteSpecIds: ["spec.feature-a.case-a", "spec.feature-a.case-b"],
      },
      resources: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          spec: {
            parentId: "group/scenario-normalization",
            workflow: "spec-live-reconciliation",
            input: {
              loopId: "scenario-normalization",
              workKey: "features/feature-a/tests/case-a.test.ts",
              normalizationScope: "quality",
              specId: "spec.feature-a.case-a",
              allowTerminalDisposition: false,
            },
          },
          status: {
            phase: "waiting",
            conditionIds: ["pipeline-run-101-completed"],
          },
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("waiting");
    expect(result.output.summary).toContain(
      "declared 1 bounded quality-normalization task action(s)",
    );
    expect(result.output.summary).toContain(
      "still represent active same-spec work or exact waits",
    );
    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0]).toMatchObject({
      kind: "create-task",
      parentId: "scenario-normalization",
      workflow: "spec-live-reconciliation",
    });
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "repository-check-command:bun run check",
        "repository-check-status:passed",
        "quality-normalization-rows:2",
        "declared-quality-actions:1",
        "open-quality-coverage-tasks:1",
        "open-quality-coverage-task:domain/reconcile-direct-scenario-quality-feature-a-case-a",
      ]),
    );
  });

  test("does not converge when the required full repository check fails", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 1,
      specLoopSpecs: {
        "spec.feature-a.case-a": {
          status: "pass",
          attempts: 1,
          lastRunId: "101",
          lastResultPath: "result-a.json",
          lastPrUrl: null,
          updatedAt: "2026-07-20T00:00:00Z",
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("needs-agent");
    expect(result.output.summary).toContain(
      "required full repository check failed",
    );
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "repository-check-command:bun run check",
        "repository-check-status:failed",
        "repository-check-exit:1",
        expect.stringContaining("evidence/archive/runtime-result.md"),
      ]),
    );
  });

  test("records the required full repository check before converging", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reviewedQualityLiveCoverage: {
        activeSpecCount: 1,
        reviewedSpecCount: 1,
        representedSpecCount: 1,
        incompleteSpecIds: [],
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("converged");
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "repository-check-command:bun run check",
        "repository-check-status:passed",
        "repository-check-exit:0",
      ]),
    );
  });

  test("keeps structural 0/0 plus repository-check pass nonterminal when direct-carrier quality gaps remain", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 2,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: true,
          },
        },
        {
          specId: "spec.feature-a.case-b",
          specFile: "features/feature-a/specs/case-b.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-b.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: false,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceScenario: { id: "Scenario_A" },
          sourceRefs: [
            "https://learn.microsoft.com/azure/aks/example-scenario",
          ],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/specs/case-b.json": JSON.stringify({
          id: "spec.feature-a.case-b",
          probeRef: "features/feature-a/tests/case-b.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-b.test.ts",
          },
          featureId: "feature-a",
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { execFile } from "node:child_process";',
          'import { promisify } from "node:util";',
          'import path from "node:path";',
          "const run = promisify(execFile);",
          'const projectRoot = path.resolve(new URL("../../..", import.meta.url).pathname);',
          'await run("bun", [path.join(projectRoot, "features/feature-a/tests/case-a.ts"), "--execute"]);',
          'const subscriptionId = process.env.AKS_RP_E2E_SUBSCRIPTION_ID || "11111111-1111-1111-1111-111111111111";',
          "console.log(subscriptionId);",
        ].join("\n"),
        "features/feature-a/tests/case-b.test.ts": [
          'import { test } from "vitest";',
          'test("case-b", async () => {',
          '  console.log("standalone but missing documented grounding and cleanup ownership");',
          "});",
        ].join("\n"),
      },
      specLoopSpecs: {
        "spec.feature-a.case-a": {
          status: "pass",
          attempts: 1,
          lastRunId: "101",
          lastResultPath: "result-a.json",
          updatedAt: "2026-07-20T00:00:00Z",
        },
        "spec.feature-a.case-b": {
          status: "pending",
          attempts: 1,
          lastRunId: "102",
          lastResultPath: "result-b.json",
          updatedAt: "2026-07-20T00:00:00Z",
          terminalDisposition: true,
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          parentId: "scenario-normalization",
          agent: "aks-explorer",
          workflow: "spec-live-reconciliation",
          input: {
            normalizationScope: "quality",
            scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
            specId: "spec.feature-a.case-a",
            allowTerminalDisposition: false,
          },
        },
        {
          kind: "create-task",
          parentId: "scenario-normalization",
          agent: "aks-explorer",
          workflow: "spec-live-reconciliation",
          input: {
            normalizationScope: "quality",
            scenarioTestPath: "features/feature-a/tests/case-b.test.ts",
            specId: "spec.feature-a.case-b",
            allowTerminalDisposition: false,
          },
        },
      ],
    });
    expect(result.output.actions[0].acceptance).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "execute the scenario in-process on the Vitest surface",
        ),
        expect.stringContaining(
          "official Learn, Azure REST API specs, and checked-in design docs",
        ),
        expect.stringContaining(
          "private/local filesystem paths cannot be required carrier inputs",
        ),
      ]),
    );
    expect(result.output.summary).toContain(
      "quality-normalization inventory still has 2 row(s)",
    );
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "repository-check-command:bun run check",
        "repository-check-status:passed",
        "quality-normalization-rows:2",
        "quality-structural-rows:2",
        "quality-live-proof-gap-rows:2",
        "declared-quality-actions:2",
        expect.stringContaining(
          "quality-row:features/feature-a/tests/case-a.test.ts;specs=spec.feature-a.case-a;issues=current-source-staging-live-proof,hard-coded-target-fallback,migration-only-scaffolding",
        ),
        expect.stringContaining(
          "quality-row:features/feature-a/tests/case-b.test.ts;specs=spec.feature-a.case-b;issues=current-source-staging-live-proof,missing-cleanup-or-fixture-ownership,missing-learn-api-grounding",
        ),
      ]),
    );
  });

  test("keeps the controller live when a quality row only has terminal-disposition residue", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: false,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("standalone but still missing explicit grounding and cleanup ownership");',
          "});",
        ].join("\n"),
      },
      receipts: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          parentId: "group/scenario-normalization",
          summary:
            "spec.feature-a.case-a retained reviewed terminal disposition blocked/reviewed-exception without a new ADO pass.",
          evidence: [
            "terminal-disposition-spec:spec.feature-a.case-a",
            "terminal-disposition-status:blocked",
            "terminal-disposition-spec-state:reviewed-exception",
            "integrated-commit:stale-terminal-receipt",
          ],
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("converged");
    expect(result.output.summary).toContain(
      "quality-normalization inventory still has 1 row(s)",
    );
    expect(result.output.actions).toMatchObject([
      {
        kind: "create-task",
        parentId: "scenario-normalization",
        agent: "aks-explorer",
        workflow: "spec-live-reconciliation",
        input: {
          normalizationScope: "quality",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          specId: "spec.feature-a.case-a",
          allowTerminalDisposition: false,
        },
      },
    ]);
  });

  test("does not create a second revision while the stable work key still has an exact pipeline wait", async () => {
    const scenarioTestPath = "features/feature-a/tests/case-a.test.ts";
    const taskId =
      "domain/reconcile-direct-scenario-quality-feature-a-case-a-old-revision";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      scenarioSignalCounts: {
        hasCleanupSignal: 0,
      },
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath,
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: false,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: scenarioTestPath,
          implementation: {
            type: "typescript-vitest",
            path: scenarioTestPath,
          },
          featureId: "feature-a",
        }),
        [scenarioTestPath]: [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("standalone carrier awaiting live proof");',
          "});",
        ].join("\n"),
      },
      resources: {
        [taskId]: {
          metadata: { id: taskId, generation: 1, resourceVersion: 8 },
          spec: {
            parentId: "group/scenario-normalization",
            agent: "aks-explorer",
            workflow: "spec-live-reconciliation",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioTestPath,
              workRevision: "old-revision",
              scenarioTestPath,
              specId: "spec.feature-a.case-a",
              specIds: ["spec.feature-a.case-a"],
              allowTerminalDisposition: false,
              qualityIssueCodes: [
                "current-source-staging-live-proof",
                "missing-cleanup-or-fixture-ownership",
                "missing-learn-api-grounding",
              ],
            },
          },
          status: {
            phase: "attention",
            conditionIds: ["pipeline-run-123-completed"],
          },
        },
      },
    });

    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;

    expect(result.output.actions).toEqual([]);
    expect(result.output.evidence).toContain(
      "live-execution-capacity:1/5;pipeline-waits=1;owner-handoffs=0",
    );
  });

  test("recreates live-proof work for terminal-only quality receipts even when structural quality issues already occupy the frontier", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 2,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: false,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: true,
          },
        },
        {
          specId: "spec.feature-a.case-b",
          specFile: "features/feature-a/specs/case-b.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-b.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: ["https://learn.microsoft.com/azure/example"],
        }),
        "features/feature-a/specs/case-b.json": JSON.stringify({
          id: "spec.feature-a.case-b",
          probeRef: "features/feature-a/tests/case-b.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-b.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: ["https://learn.microsoft.com/azure/example"],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("case-a still falls back to a hard-coded target");',
          "});",
        ].join("\n"),
        "features/feature-a/tests/case-b.test.ts": [
          'import { test } from "vitest";',
          'test("case-b", async () => {',
          '  console.log("case-b is structurally normalized but still lacks live proof");',
          "});",
        ].join("\n"),
      },
      receipts: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-b": {
          parentId: "group/scenario-normalization",
          summary:
            "spec.feature-a.case-b retained reviewed terminal disposition blocked/reviewed-exception without a new ADO pass.",
          evidence: [
            "terminal-disposition-spec:spec.feature-a.case-b",
            "integrated-commit:stale-terminal-receipt",
          ],
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("converged");
    expect(result.output.evidence).toEqual(
      expect.arrayContaining([
        "quality-structural-rows:1",
        "quality-live-proof-gap-rows:2",
        "quality-live-incomplete-spec:spec.feature-a.case-a",
        "quality-live-incomplete-spec:spec.feature-a.case-b",
      ]),
    );
    expect(result.output.actions).toMatchObject([
      {
        kind: "create-task",
        input: {
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          qualityIssueCodes: expect.arrayContaining([
            "hard-coded-target-fallback",
            "current-source-staging-live-proof",
          ]),
          allowTerminalDisposition: false,
        },
      },
      {
        kind: "create-task",
        input: {
          scenarioTestPath: "features/feature-a/tests/case-b.test.ts",
          qualityIssueCodes: ["current-source-staging-live-proof"],
          allowTerminalDisposition: false,
        },
      },
    ]);
  });

  test("skips an immutable completed quality task id while selecting another unrepresented row", async () => {
    const qualityRow = (name: string) => ({
      specId: `spec.feature-a.${name}`,
      specFile: `features/feature-a/specs/${name}.json`,
      featureId: "feature-a",
      scenarioTestPath: `features/feature-a/tests/${name}.test.ts`,
      adapterPath: "",
      directVitestImplementation: true,
      scenarioSignals: {
        hasCheckModeGuard: true,
        hasExecuteFlag: true,
        hasMutationGateEnv: true,
        writesArchiveEvidence: true,
        hasCleanupSignal: false,
        mentionsSharedFixture: false,
        hasHardCodedSubscriptionDefault: false,
      },
    });
    const spec = (name: string) =>
      JSON.stringify({
        id: `spec.feature-a.${name}`,
        probeRef: `features/feature-a/tests/${name}.test.ts`,
        implementation: {
          type: "typescript-vitest",
          path: `features/feature-a/tests/${name}.test.ts`,
        },
        featureId: "feature-a",
        sourceRefs: ["https://learn.microsoft.com/azure/example"],
      });
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 2,
      repositoryCheckExitCode: 0,
      reportRows: [qualityRow("case-a"), qualityRow("case-b")],
      files: {
        "features/feature-a/specs/case-a.json": spec("case-a"),
        "features/feature-a/specs/case-b.json": spec("case-b"),
        "features/feature-a/tests/case-a.test.ts": "// case-a quality row\n",
        "features/feature-a/tests/case-b.test.ts": "// case-b quality row\n",
      },
    });
    const taskInput = { requiredRepositoryCheckCommand: "bun run check" };
    const initial = (await execute(
      context(ws.appDir, ws.projectDir, taskInput),
    )) as any;
    const completedId = initial.output.actions.find(
      (action: any) =>
        action.input.scenarioTestPath ===
        "features/feature-a/tests/case-a.test.ts",
    ).id;
    const statePath = join(ws.appDir, ".state", "tasks", "state.json");
    const state = JSON.parse(await Bun.file(statePath).text());
    state.receipts[completedId] = {
      parentId: "scenario-normalization",
      summary:
        "Immutable completed receipt for the same stable quality task id.",
      evidence: [],
    };
    await writeFile(statePath, JSON.stringify(state));

    const result = (await execute(
      context(ws.appDir, ws.projectDir, taskInput),
    )) as any;

    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0].id).not.toBe(completedId);
    expect(result.output.actions[0].input.scenarioTestPath).toBe(
      "features/feature-a/tests/case-b.test.ts",
    );
    expect(result.output.evidence).toContain(
      "completed-receipt-represented-quality-rows:1",
    );
  });

  test("upgrades active quality leaves that still allow terminal disposition", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: ["https://learn.microsoft.com/azure/example"],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("case-a needs an active no-terminal live-proof holder");',
          "});",
        ].join("\n"),
      },
      tasks: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          id: "domain/reconcile-direct-scenario-quality-feature-a-case-a",
          item_type: "task",
          parent_id: "group/scenario-normalization",
          phase: "running",
          generation: 1,
          workflow: "spec-live-reconciliation",
          condition_ids: [],
          input: {
            loopId: "scenario-normalization",
            normalizationScope: "quality",
            workKey: "features/feature-a/tests/case-a.test.ts",
            scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
            specId: "spec.feature-a.case-a",
            specIds: ["spec.feature-a.case-a"],
            originDevCommit: "old-origin-dev",
            qualityIssueCodes: [],
          },
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "update-task",
          taskId: "domain/reconcile-direct-scenario-quality-feature-a-case-a",
          input: expect.objectContaining({
            allowTerminalDisposition: false,
            qualityIssueCodes: ["current-source-staging-live-proof"],
          }),
          acceptance: expect.arrayContaining([
            expect.stringContaining("terminal disposition is forbidden"),
          ]),
        }),
      ]),
    );
  });

  test("counts ancestor-reachable accepted passes as current-source live coverage when integrated paths remain equivalent", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: ["https://learn.microsoft.com/azure/example"],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("case-a has already passed on an ancestor-integrated commit");',
          "});",
        ].join("\n"),
      },
      receipts: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          parentId: "group/scenario-normalization",
          summary: "spec.feature-a.case-a passed exact staging run 123.",
          evidence: [
            "spec:spec.feature-a.case-a",
            "source-commit:SOURCE_COMMIT_PLACEHOLDER",
            "integrated-commit:INTEGRATED_COMMIT_PLACEHOLDER",
            "integrated-path:features/feature-a/specs/case-a.json",
            "integrated-path:features/feature-a/tests/case-a.test.ts",
            "pipeline-run:123",
          ],
        },
      },
    });
    spawnSync("git", ["init"], { cwd: ws.projectDir, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "test@example.com"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["config", "user.name", "Test User"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["add", "."], { cwd: ws.projectDir, encoding: "utf8" });
    spawnSync("git", ["commit", "-m", "initial"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    const integratedCommit = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    }).stdout.trim();
    await writeFile(
      join(ws.projectDir, "README.md"),
      "later unrelated change\n",
    );
    spawnSync("git", ["add", "README.md"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["commit", "-m", "later unrelated change"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    const statePath = join(ws.appDir, ".state", "tasks", "state.json");
    const state = JSON.parse(await Bun.file(statePath).text());
    state.receipts[
      "domain/reconcile-direct-scenario-quality-feature-a-case-a"
    ].evidence = [
      "spec:spec.feature-a.case-a",
      `source-commit:${integratedCommit}`,
      `integrated-commit:${integratedCommit}`,
      "integrated-path:features/feature-a/specs/case-a.json",
      "integrated-path:features/feature-a/tests/case-a.test.ts",
      "pipeline-run:123",
    ];
    await writeFile(statePath, JSON.stringify(state));
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.summary).toContain("Scenario frontier converged");
  });

  test("reconstructs proof paths for direct-integration receipts after an unrelated dev advance", async () => {
    const specFile = "features/feature-a/specs/case-a.json";
    const scenarioTestPath = "features/feature-a/tests/case-a.test.ts";
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile,
          featureId: "feature-a",
          scenarioTestPath,
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        [specFile]: JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: scenarioTestPath,
          implementation: { type: "typescript-vitest", path: scenarioTestPath },
          featureId: "feature-a",
          sourceRefs: ["https://learn.microsoft.com/azure/example"],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        [scenarioTestPath]: [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("direct integration proof");',
          "});",
        ].join("\n"),
      },
      receipts: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          parentId: "group/scenario-normalization",
          summary: "spec.feature-a.case-a passed exact staging run 123.",
          evidence: [
            "spec:spec.feature-a.case-a",
            "source-commit:SOURCE_COMMIT_PLACEHOLDER",
            "integrated-commit:INTEGRATED_COMMIT_PLACEHOLDER",
            "pipeline-run:123",
          ],
          workspace: { baseCommit: "BASE_COMMIT_PLACEHOLDER" },
        },
      },
    });
    spawnSync("git", ["init"], { cwd: ws.projectDir, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "test@example.com"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["config", "user.name", "Test User"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    await writeFile(join(ws.projectDir, "README.md"), "base\n");
    spawnSync("git", ["add", "README.md"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["commit", "-m", "base"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    const baseCommit = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    }).stdout.trim();
    spawnSync("git", ["add", specFile, scenarioTestPath], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["commit", "-m", "integrate tested spec"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    const integratedCommit = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    }).stdout.trim();
    await writeFile(
      join(ws.projectDir, "README.md"),
      "later unrelated change\n",
    );
    spawnSync("git", ["add", "README.md"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["commit", "-m", "later unrelated change"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    const statePath = join(ws.appDir, ".state", "tasks", "state.json");
    const state = JSON.parse(await Bun.file(statePath).text());
    const receipt =
      state.receipts[
        "domain/reconcile-direct-scenario-quality-feature-a-case-a"
      ];
    receipt.evidence = [
      "spec:spec.feature-a.case-a",
      `source-commit:${integratedCommit}`,
      `integrated-commit:${integratedCommit}`,
      "pipeline-run:123",
    ];
    receipt.workspace = { baseCommit };
    await writeFile(statePath, JSON.stringify(state));

    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output).toMatchObject({ state: "converged", actions: [] });
    expect(result.output.summary).toContain("Scenario frontier converged");
  });

  test("invalidates ancestor-reachable accepted passes when an integrated path changed later", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceRefs: ["https://learn.microsoft.com/azure/example"],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("case-a proof becomes stale after this path changes");',
          "});",
        ].join("\n"),
      },
      receipts: {
        "domain/reconcile-direct-scenario-quality-feature-a-case-a": {
          parentId: "group/scenario-normalization",
          summary: "spec.feature-a.case-a passed exact staging run 123.",
          evidence: [
            "spec:spec.feature-a.case-a",
            "source-commit:SOURCE_COMMIT_PLACEHOLDER",
            "integrated-commit:INTEGRATED_COMMIT_PLACEHOLDER",
            "integrated-path:features/feature-a/specs/case-a.json",
            "integrated-path:features/feature-a/tests/case-a.test.ts",
            "pipeline-run:123",
          ],
        },
      },
    });
    spawnSync("git", ["init"], { cwd: ws.projectDir, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "test@example.com"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["config", "user.name", "Test User"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["add", "."], { cwd: ws.projectDir, encoding: "utf8" });
    spawnSync("git", ["commit", "-m", "initial"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    const integratedCommit = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    }).stdout.trim();
    await writeFile(
      join(ws.projectDir, "features", "feature-a", "tests", "case-a.test.ts"),
      [
        'import { test } from "vitest";',
        'test("case-a", async () => {',
        '  console.log("later change invalidates the old live proof");',
        "});",
      ].join("\n"),
    );
    spawnSync("git", ["add", "features/feature-a/tests/case-a.test.ts"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    spawnSync("git", ["commit", "-m", "change tested carrier"], {
      cwd: ws.projectDir,
      encoding: "utf8",
    });
    const statePath = join(ws.appDir, ".state", "tasks", "state.json");
    const state = JSON.parse(await Bun.file(statePath).text());
    state.receipts[
      "domain/reconcile-direct-scenario-quality-feature-a-case-a"
    ].evidence = [
      "spec:spec.feature-a.case-a",
      `source-commit:${integratedCommit}`,
      `integrated-commit:${integratedCommit}`,
      "integrated-path:features/feature-a/specs/case-a.json",
      "integrated-path:features/feature-a/tests/case-a.test.ts",
      "pipeline-run:123",
    ];
    await writeFile(statePath, JSON.stringify(state));
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0]).toMatchObject({
      kind: "create-task",
      input: {
        scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
        qualityIssueCodes: ["current-source-staging-live-proof"],
        allowTerminalDisposition: false,
      },
    });
  });

  test("treats local sourceRefs and sourceScenario only as grounding candidates, not official Learn/API proof", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceScenario: { id: "Scenario_A" },
          sourceRefs: ["/app/sources/aks-rp/example.go"],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("standalone direct carrier with only local candidate grounding");',
          "});",
        ].join("\n"),
      },
      specLoopSpecs: {
        "spec.feature-a.case-a": {
          status: "pass",
          attempts: 1,
          lastRunId: "101",
          lastResultPath: "result-a.json",
          updatedAt: "2026-07-20T00:00:00Z",
        },
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(1);
    expect(result.output.actions[0]).toMatchObject({
      kind: "create-task",
      parentId: "scenario-normalization",
      agent: "aks-explorer",
      workflow: "spec-live-reconciliation",
      input: {
        normalizationScope: "quality",
        scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
        qualityIssueCodes: expect.arrayContaining([
          "missing-learn-api-grounding",
          "current-source-staging-live-proof",
        ]),
        allowTerminalDisposition: false,
      },
    });
    expect(result.output.actions[0].input.qualityIssueDetails).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Spec lacks official Learn/API grounding for the direct .test.ts carrier; candidate facts: sourceRefs=/app/sources/aks-rp/example.go; sourceScenario=Scenario_A.",
        ),
      ]),
    );
  });

  test("accepts only Learn and azure-rest-api-specs refs as official grounding", async () => {
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 1,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows: [
        {
          specId: "spec.feature-a.case-a",
          specFile: "features/feature-a/specs/case-a.json",
          featureId: "feature-a",
          scenarioTestPath: "features/feature-a/tests/case-a.test.ts",
          adapterPath: "",
          directVitestImplementation: true,
          scenarioSignals: {
            hasCheckModeGuard: true,
            hasExecuteFlag: true,
            hasMutationGateEnv: true,
            writesArchiveEvidence: true,
            hasCleanupSignal: true,
            mentionsSharedFixture: false,
            hasHardCodedSubscriptionDefault: false,
          },
        },
      ],
      files: {
        "features/feature-a/specs/case-a.json": JSON.stringify({
          id: "spec.feature-a.case-a",
          probeRef: "features/feature-a/tests/case-a.test.ts",
          implementation: {
            type: "typescript-vitest",
            path: "features/feature-a/tests/case-a.test.ts",
          },
          featureId: "feature-a",
          sourceScenario: { id: "Scenario_A" },
          sourceRefs: [
            "/app/sources/aks-rp/example.go",
            "https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/specification/containerservice/resource-manager/Microsoft.ContainerService/aks/stable/2024-05-01/managedClusters.json",
          ],
          clusterLifecycle: {
            fixtureOwnership: "dedicated",
            sharedClusterFixture: false,
            cleanup: "resource-group-delete",
          },
        }),
        "features/feature-a/tests/case-a.test.ts": [
          'import { test } from "vitest";',
          'test("case-a", async () => {',
          '  console.log("standalone direct carrier with official grounding");',
          "});",
        ].join("\n"),
      },
      reviewedQualityLiveCoverage: {
        activeSpecCount: 1,
        reviewedSpecCount: 1,
        representedSpecCount: 1,
        incompleteSpecIds: [],
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
    });
    expect(result.output.evidence).toEqual(
      expect.arrayContaining(["quality-normalization-rows:0"]),
    );
  });

  test("prioritizes a terminal-only live-proof gap within the five-slot quality frontier ahead of lower-priority structural rows", async () => {
    const structuralRows = Array.from({ length: 6 }, (_, index) => ({
      specId: `spec.feature-${index}.case-a`,
      specFile: `features/feature-${index}/specs/case-a.json`,
      featureId: `feature-${index}`,
      scenarioTestPath: `features/feature-${index}/tests/case-a.test.ts`,
      adapterPath: "",
      directVitestImplementation: true,
      scenarioSignals: {
        hasCheckModeGuard: true,
        hasExecuteFlag: true,
        hasMutationGateEnv: true,
        writesArchiveEvidence: true,
        hasCleanupSignal: true,
        mentionsSharedFixture: false,
        hasHardCodedSubscriptionDefault: false,
      },
    }));
    const liveGapRow = {
      specId: "spec.feature-gap.case-a",
      specFile: "features/feature-gap/specs/case-a.json",
      featureId: "feature-gap",
      scenarioTestPath: "features/feature-gap/tests/case-a.test.ts",
      adapterPath: "",
      directVitestImplementation: true,
      scenarioSignals: {
        hasCheckModeGuard: true,
        hasExecuteFlag: true,
        hasMutationGateEnv: true,
        writesArchiveEvidence: true,
        hasCleanupSignal: true,
        mentionsSharedFixture: false,
        hasHardCodedSubscriptionDefault: false,
      },
    };
    const reportRows = [...structuralRows, liveGapRow];
    const files = Object.fromEntries(
      reportRows.flatMap((row: any) => {
        const specBody =
          row.specId === "spec.feature-gap.case-a"
            ? {
                id: row.specId,
                probeRef: row.scenarioTestPath,
                implementation: {
                  type: "typescript-vitest",
                  path: row.scenarioTestPath,
                },
                featureId: row.featureId,
                sourceRefs: ["https://learn.microsoft.com/azure/example"],
                clusterLifecycle: {
                  fixtureOwnership: "dedicated",
                  sharedClusterFixture: false,
                  cleanup: "resource-group-delete",
                },
              }
            : {
                id: row.specId,
                probeRef: row.scenarioTestPath,
                implementation: {
                  type: "typescript-vitest",
                  path: row.scenarioTestPath,
                },
                featureId: row.featureId,
                clusterLifecycle: {
                  fixtureOwnership: "dedicated",
                  sharedClusterFixture: false,
                  cleanup: "resource-group-delete",
                },
              };
        const scenarioText =
          row.specId === "spec.feature-gap.case-a"
            ? [
                'import { test } from "vitest";',
                'test("case-a", async () => {',
                '  console.log("live gap only; no structural issue remains");',
                "});",
              ].join("\n")
            : 'import "vitest-scenario-adapter";';
        return [
          [row.specFile, JSON.stringify(specBody)],
          [row.scenarioTestPath, scenarioText],
        ];
      }),
    );
    const ws = await workspace({
      missingAdapterFiles: [],
      strictPassed: true,
      activeSpecCount: 7,
      unreferencedPlainScenarioFiles: [],
      unpairedAdapterFiles: [],
      repositoryCheckExitCode: 0,
      reportRows,
      files,
      reviewedQualityLiveCoverage: {
        activeSpecCount: 7,
        reviewedSpecCount: 6,
        representedSpecCount: 6,
        incompleteSpecIds: ["spec.feature-gap.case-a"],
      },
    });
    const result = (await execute(
      context(ws.appDir, ws.projectDir, {
        requiredRepositoryCheckCommand: "bun run check",
      }),
    )) as any;
    expect(result.output.state).toBe("converged");
    expect(result.output.actions).toHaveLength(5);
    const selectedPaths = new Set(
      result.output.actions.map(
        (action: { input: { scenarioTestPath: string } }) =>
          action.input.scenarioTestPath,
      ),
    );
    expect(selectedPaths.size).toBe(5);
    expect(selectedPaths.has("features/feature-gap/tests/case-a.test.ts")).toBe(
      true,
    );
    expect(result.output.summary).toContain(
      "quality-normalization inventory still has 7 row(s)",
    );
  });

  test("reuses project locked dependencies before checking a detached clean snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "scenario-check-setup-"));
    const projectDir = join(root, "project");
    const snapshotDir = join(root, "snapshot");
    await mkdir(join(projectDir, "node_modules", "test-only"), {
      recursive: true,
    });
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(
      join(projectDir, "node_modules", "test-only", "package.json"),
      JSON.stringify({ name: "test-only", main: "index.js" }),
    );
    await writeFile(
      join(projectDir, "node_modules", "test-only", "index.js"),
      "module.exports = { value: 'project-node-modules' };\n",
    );
    await writeFile(
      join(snapshotDir, "package.json"),
      JSON.stringify({
        name: "scenario-check-setup",
        scripts: {
          check:
            'bun -e "const mod = require(\\"test-only\\"); if (mod.value !== \\\"project-node-modules\\\") process.exit(1); console.log(mod.value);"',
        },
      }),
    );

    const result = await runRequiredRepositoryCheck(
      projectDir,
      snapshotDir,
      "bun run check",
      join(root, "repository-check-owner.json"),
    );

    expect(result.status).toBe(0);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        `repository-check-dependency-source:project-node_modules:${join(projectDir, "node_modules")}`,
        `repository-check-setup-command:ln -s ${join(projectDir, "node_modules")} ${join(snapshotDir, "node_modules")}`,
        "repository-check-setup-status:passed",
        "repository-check-setup-exit:0",
        "repository-check-status:passed",
      ]),
    );
  });

  test("installs locked dependencies when no deterministic project dependency source exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "scenario-check-install-"));
    const projectDir = join(root, "project");
    const snapshotDir = join(root, "snapshot");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(snapshotDir, "deps", "test-only"), {
      recursive: true,
    });
    await writeFile(
      join(snapshotDir, "deps", "test-only", "package.json"),
      JSON.stringify({ name: "test-only", version: "1.0.0", main: "index.js" }),
    );
    await writeFile(
      join(snapshotDir, "deps", "test-only", "index.js"),
      "module.exports = { value: 'installed-locally' };\n",
    );
    await writeFile(
      join(snapshotDir, "package.json"),
      JSON.stringify({
        name: "scenario-check-setup",
        dependencies: { "test-only": "file:./deps/test-only" },
        scripts: {
          check:
            'bun -e "const mod = require(\\"test-only\\"); if (mod.value !== \\\"installed-locally\\\") process.exit(1); console.log(mod.value);"',
        },
      }),
    );
    const initialInstall = spawnSync("bun", ["install"], {
      cwd: snapshotDir,
      encoding: "utf8",
      env: {
        ...process.env,
        TMPDIR: root,
        BUN_INSTALL_CACHE_DIR: join(root, ".bun-cache"),
      },
    });
    expect(initialInstall.status, initialInstall.stderr).toBe(0);
    await rm(join(snapshotDir, "node_modules"), {
      recursive: true,
      force: true,
    });

    const result = await runRequiredRepositoryCheck(
      projectDir,
      snapshotDir,
      "bun run check",
      join(root, "repository-check-owner.json"),
    );

    expect(result.status).toBe(0);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        "repository-check-setup-command:bun install --frozen-lockfile",
        "repository-check-setup-status:passed",
        "repository-check-setup-exit:0",
        "repository-check-status:passed",
      ]),
    );
  });

  test("keeps the daemon event loop responsive while the repository check runs", async () => {
    const root = await mkdtemp(join(tmpdir(), "scenario-check-responsive-"));
    const projectDir = join(root, "project");
    let controlTimerFired = false;
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, "package.json"),
      JSON.stringify({
        name: "scenario-check-responsive",
        scripts: { check: 'bun -e "await Bun.sleep(150)"' },
      }),
    );
    const controlTimer = setTimeout(() => {
      controlTimerFired = true;
    }, 20);
    try {
      const result = await runRequiredRepositoryCheck(
        projectDir,
        projectDir,
        "bun run check",
        join(root, "repository-check-owner.json"),
      );
      expect(result.status).toBe(0);
      expect(controlTimerFired).toBe(true);
    } finally {
      clearTimeout(controlTimer);
      await rm(root, { recursive: true, force: true });
    }
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
            agent: "aks-explorer",
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
        agent: "aks-explorer",
        workflow: "spec-live-reconciliation",
      },
    ]);
  });

  test("moves stored routine normalization leaves out of the incident lane", async () => {
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
          metadata: { id: taskId, generation: 3, resourceVersion: 7 },
          spec: {
            parentId: "group/scenario-normalization",
            agent: "aks-explorer",
            workflow: "spec-live-reconciliation",
            priority: "P0",
            input: {
              loopId: "scenario-normalization",
              workKey: scenarioTestPath,
              scenarioTestPath,
              specId: "spec.feature-a.case-a",
              specIds: ["spec.feature-a.case-a"],
            },
          },
          status: { phase: "waiting" },
        },
      },
    });

    const result = (await execute(context(ws.appDir, ws.projectDir))) as any;

    expect(result.output.actions).toContainEqual({
      kind: "update-task",
      taskId,
      expectedGeneration: 3,
      priority: "P1",
    });
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
          parentId: "scenario-normalization",
          agent: "aks-explorer",
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
          parentId: "scenario-normalization",
          agent: "aks-explorer",
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
            agent: "aks-explorer",
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
            agent: "app-ops",
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
          parentId: "scenario-normalization",
          agent: "aks-explorer",
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
