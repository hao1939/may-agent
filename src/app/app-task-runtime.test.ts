import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type AppDefinition, type AppRequest, type TaskExecutor } from "@may-agent/sdk";
import { openDatabase } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { EVENT_ROW_ID, EventBus, type AgentEvent } from "./event-bus.js";
import { startAppInboxRuntime } from "./app-inbox-runtime.js";
import { claimAppInboxItem, createAppInboxItem, waitAppInboxClaim } from "./app-inbox-store.js";
import { AppRegistry } from "./app-registry.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  admitTaskAppDependencies,
  appTaskAgentProtocol,
  appTaskDependencyCatalog,
  applyCanonicalAgentResidueCleanup,
  attachLoadedAppTask,
  beginCanonicalAgentResidueGuard,
  closeInstalledAppTaskRuntimes,
  consumePersistedTerminalAgentResult,
  DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION,
  finishCanonicalAgentResidueGuard,
  hasDeployReceiptWake,
  installAppTaskRuntimes,
  normalizeTaskHandlerResult,
  planCanonicalAgentResidueCleanup,
  previewLoadedCanonicalAppTaskEvent,
  projectAppTaskChildPromptContext,
  projectAppTaskWaitPromptContext,
  projectAppTaskReconciliationEvents,
  readLoadedAppTaskView,
  recoverInstalledAppTasks,
  rejectConvergedDirectAgentResidue,
} from "./app-task-runtime.js";
import {
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  markAppTaskAttention,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  recordAppTaskAttemptSession,
  taskReconciliationConfig,
} from "./app-task-reconciler.js";
import { readTaskState, saveTaskState } from "./app-task-store.js";
import { HostCapacity } from "./host-capacity.js";
import { getDb } from "../lib/requests.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import {
  addSessionBashProcessGroup,
  readSessionBashProcessGroups,
  readSessionMeta,
  writeSessionMeta,
} from "../lib/persistence.js";

const roots: string[] = [];
const buses: EventBus[] = [];

function eventBus(): EventBus {
  const bus = new EventBus();
  buses.push(bus);
  return bus;
}

function fixture() {
  const root = join(tmpdir(), `app-task-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const projectsRoot = join(root, "projects");
  const appDir = join(projectsRoot, "sample.app");
  mkdirSync(join(appDir, "agents", "owner"), { recursive: true });
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    JSON.stringify({
      root_task_id: "root",
      groups: {
        root: {
          id: "root",
          parent_id: null,
          state: "backlog",
          agent: "sample-owner",
          children: ["operations"],
        },
        operations: {
          id: "operations",
          parent_id: "root",
          state: "backlog",
          children: [],
        },
      },
    }),
  );
  return { root, projectsRoot, appDir };
}

function definition(): AppDefinition {
  return defineApp({
    id: "sample",
    version: 1,
    agent: "sample-owner",
    inputSchema: Type.Object({}, { additionalProperties: true }),
    workspace: { kind: "local", localPath: "." },
    tasks: {
      subscriptions: ["sample.work"],
      resolve(event) {
        const itemId = String(event.data.itemId ?? "");
        return itemId
          ? {
              id: `work/${itemId}`,
              parentId: "operations",
              outcome: `Process ${itemId}`,
              acceptance: ["Work converges"],
              mode: "achieve",
              agent: "sample-owner",
            }
          : null;
      },
    },
  });
}

function options(f: ReturnType<typeof fixture>, bus: EventBus) {
  return {
    projectsRoot: f.projectsRoot,
    projectRoot: f.root,
    persistDir: join(f.root, "state"),
    manager: { hasAgent: () => true } as never,
    bus,
    hostCapacity: new HostCapacity(2),
  };
}

function activateTaskResources(
  config: ReturnType<typeof taskReconciliationConfig>,
  persistDir: string,
  appId = "sample",
): AppTaskResourceStore {
  const tree = readTaskState(config);
  tree.project ||= appId;
  const finalLifecycle = tree.project_lifecycle === "paused" ? "paused" : "active";
  tree.project_lifecycle = "paused";
  const sourceRevision = `test:${appId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const staging = AppTaskResourceStore.fromDb(getDb(persistDir), appId);
  staging.importPausedSnapshot(tree, sourceRevision);
  staging.activate(sourceRevision);
  staging.setProjectLifecycle(finalLifecycle);
  rmSync(config.statePath, { force: true });
  const active = AppTaskResourceStore.activeFromDb(getDb(persistDir), appId);
  if (!active) throw new Error(`expected active resource store for ${appId}`);
  config.resourceStore = active;
  return active;
}

afterEach(async () => {
  await Promise.all(buses.splice(0).map((bus) => closeInstalledAppTaskRuntimes(bus)));
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function gitResidueFixture() {
  const root = join(tmpdir(), `app-task-residue-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Test"]);
  writeFileSync(join(root, "tracked.txt"), "tracked baseline\n");
  writeFileSync(join(root, "concurrent-index.txt"), "index baseline\n");
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-m", "baseline"]);
  return root;
}

describe("canonical direct-agent residue cleanup", () => {
  it("restores agent file and index edits that remain unchanged since planning", () => {
    const projectDir = gitResidueFixture();
    writeFileSync(join(projectDir, "preexisting.txt"), "preexisting baseline\n");
    const guard = beginCanonicalAgentResidueGuard({ appDir: projectDir, projectDir, workspaceDir: projectDir });

    writeFileSync(join(projectDir, "tracked.txt"), "agent edit\n");
    writeFileSync(join(projectDir, "preexisting.txt"), "agent changed preexisting\n");
    writeFileSync(join(projectDir, "created.txt"), "agent created\n");
    execFileSync("git", ["-C", projectDir, "add", "tracked.txt"]);

    const plan = planCanonicalAgentResidueCleanup(guard);
    const restored = applyCanonicalAgentResidueCleanup(plan);

    expect(restored).toContain("file:tracked.txt");
    expect(restored).toContain("file:preexisting.txt");
    expect(restored).toContain("file:created.txt");
    expect(restored).toContain("index");
    expect(readFileSync(join(projectDir, "tracked.txt"), "utf8")).toBe("tracked baseline\n");
    expect(readFileSync(join(projectDir, "preexisting.txt"), "utf8")).toBe("preexisting baseline\n");
    expect(existsSync(join(projectDir, "created.txt"))).toBe(false);
    expect(execFileSync("git", ["-C", projectDir, "status", "--porcelain"], { encoding: "utf8" })).toBe(
      "?? preexisting.txt\n",
    );
  });

  it("preserves concurrent file and index edits while applying other planned cleanup", () => {
    const projectDir = gitResidueFixture();
    const guard = beginCanonicalAgentResidueGuard({ appDir: projectDir, projectDir, workspaceDir: projectDir });

    writeFileSync(join(projectDir, "tracked.txt"), "agent edit\n");
    writeFileSync(join(projectDir, "created.txt"), "agent created\n");
    execFileSync("git", ["-C", projectDir, "add", "tracked.txt"]);
    const plan = planCanonicalAgentResidueCleanup(guard);

    writeFileSync(join(projectDir, "tracked.txt"), "concurrent file edit\n");
    writeFileSync(join(projectDir, "concurrent-index.txt"), "concurrent index edit\n");
    execFileSync("git", ["-C", projectDir, "add", "concurrent-index.txt"]);
    const restored = applyCanonicalAgentResidueCleanup(plan);

    expect(restored).toEqual(["file:created.txt"]);
    expect(readFileSync(join(projectDir, "tracked.txt"), "utf8")).toBe("concurrent file edit\n");
    expect(execFileSync("git", ["-C", projectDir, "diff", "--cached", "--name-only"], { encoding: "utf8" })).toBe(
      "concurrent-index.txt\ntracked.txt\n",
    );
  });

  it("rejects only converged direct-agent results whose edits were restored", () => {
    const converged = {
      state: "converged" as const,
      summary: "claimed convergence",
      evidence: ["agent-result"],
      actions: [],
    };
    expect(rejectConvergedDirectAgentResidue(converged, ["file:tracked.txt"])).toMatchObject({
      state: "error",
      evidence: ["agent-result", "agent-residue-restored:file:tracked.txt"],
    });
    expect(rejectConvergedDirectAgentResidue(converged, [])).toBe(converged);

    const worktree = join(projectDirForBypass(), "workflow-output.txt");
    writeFileSync(worktree, "mutation-capable output\n");
    expect(finishCanonicalAgentResidueGuard(null)).toEqual([]);
    expect(readFileSync(worktree, "utf8")).toBe("mutation-capable output\n");
  });
});

describe("App Task agent prompt context", () => {
  it("recognizes deploy context only from the exact typed receipt wake", () => {
    const events = (reason: string) =>
      ({
        items: [
          {
            eventId: 1,
            observedAt: "2026-08-25T00:00:00.000Z",
            event: {
              type: "runtime.deploy.observed",
              data: { reason },
            },
          },
        ],
        throughEventId: 1,
        truncated: false,
      }) as any;

    expect(hasDeployReceiptWake(events("restart-aware-deploy-receipt"))).toBe(
      true,
    );
    expect(
      hasDeployReceiptWake(
        events("please inspect the restart-aware deploy receipt"),
      ),
    ).toBe(false);
  });

  it("keeps the schema-enforced bounded-agent protocol below four kilobytes", () => {
    const protocol = appTaskAgentProtocol("may");

    expect(Buffer.byteLength(protocol, "utf8")).toBeLessThanOrEqual(4 * 1_024);
    expect(protocol).toContain("bounded agent for one Task attempt owned by App may");
    expect(protocol).not.toContain("accountable owner");
    expect(protocol).toContain("Finish exactly once with finish().result");
    expect(protocol).toContain("Return state waiting only for an exact observable Condition");
    expect(protocol).toContain("Runtime publishes and correlates it");
    expect(protocol).not.toContain("Converged example");
  });

  it("makes a supplied dependency observation complete authority without exposing Host-private refinement", () => {
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain("treat that exact read-only observation");
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain(
      "as complete authority for the dependency in this attempt",
    );
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain(
      "do not inspect Host-private task state, generated task-tree or Kanban projections",
    );
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain(
      "do not inspect Host-private task state, generated task-tree or Kanban projections, or substitute a deeper or different task",
    );
    expect(DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION).toContain("This restriction is request-scoped");
    expect(readFileSync(new URL("./app-task-runtime.ts", import.meta.url), "utf8")).toContain(
      "DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION,",
    );
  });

  it("shows only installed accountable Apps and their accepted input contracts", () => {
    const f = fixture();
    const bus = eventBus();
    const target = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      description: "Owns evidence-based evaluation outcomes.",
      inputSchema: Type.Union([
        Type.Object({ kind: Type.Literal("owner-review"), data: Type.Record(Type.String(), Type.Unknown()) }),
        Type.Object({ kind: Type.Literal("deep-eval"), data: Type.Record(Type.String(), Type.Unknown()) }),
      ]),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "review",
          parentId: "evaluation",
          outcome: "Review evidence",
          acceptance: ["Evidence is reviewed"],
          mode: "achieve" as const,
        },
      }),
      tasks: {},
    });
    const source = { ...definition(), id: "may" };
    const catalog = appTaskDependencyCatalog(
      {
        ...options(f, bus),
        appRegistrySnapshot: {
          id: "catalog:1",
          generation: 1,
          entries: [
            { appDir: f.appDir, definition: source },
            { appDir: join(f.projectsRoot, "evaluation.app"), definition: target },
          ],
        },
      },
      "may",
    );

    expect(catalog).toEqual([
      {
        appId: "evaluation",
        description: "Owns evidence-based evaluation outcomes.",
        inputs: [
          { kind: "deep-eval", requiredData: [], dataTypes: {}, fixedData: {} },
          { kind: "owner-review", requiredData: [], dataTypes: {}, fixedData: {} },
        ],
      },
    ]);
  });

  it("summarizes required paths, field shapes, and fixed data without copying the full schema", () => {
    const f = fixture();
    const bus = eventBus();
    const target = defineApp({
      id: "operations",
      version: 1,
      agent: "operator",
      inputSchema: Type.Union([
        Type.Object({
          kind: Type.Literal("general-operation"),
          data: Type.Object({
            outcome: Type.String(),
            evidence: Type.Array(Type.String()),
            constraints: Type.Optional(Type.Array(Type.String())),
          }),
        }),
        Type.Object({
          kind: Type.Literal("specialized-operation"),
          data: Type.Object({
            outcome: Type.String(),
            context: Type.Object({ callerApp: Type.Literal("alpha-project"), callerTask: Type.String() }),
          }),
        }),
      ]),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "operation",
          parentId: "operations",
          outcome: "Perform the operation",
          acceptance: ["Done"],
          mode: "achieve" as const,
        },
      }),
      tasks: {},
    });

    expect(
      appTaskDependencyCatalog(
        {
          ...options(f, bus),
          appRegistrySnapshot: {
            id: "catalog:shapes",
            generation: 1,
            entries: [{ appDir: join(f.projectsRoot, "operations.app"), definition: target }],
          },
        },
        "may",
      )[0]?.inputs,
    ).toEqual([
      {
        kind: "general-operation",
        requiredData: ["evidence", "outcome"],
        dataTypes: { constraints: "string[]", evidence: "string[]", outcome: "string" },
        fixedData: {},
      },
      {
        kind: "specialized-operation",
        requiredData: ["context", "context.callerApp", "context.callerTask", "outcome"],
        dataTypes: {
          context: "object",
          "context.callerApp": "string",
          "context.callerTask": "string",
          outcome: "string",
        },
        fixedData: { "context.callerApp": "alpha-project" },
      },
    ]);
  });

  it("does not advertise an input resolver without an active Task policy", () => {
    const f = fixture();
    const bus = eventBus();
    const target = defineApp({
      id: "incomplete",
      version: 1,
      agent: "incomplete-owner",
      inputSchema: Type.Object({ kind: Type.Literal("review"), data: Type.Record(Type.String(), Type.Unknown()) }),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "review",
          parentId: "incomplete",
          outcome: "Review evidence",
          acceptance: ["Reviewed"],
          mode: "achieve" as const,
        },
      }),
    });

    expect(
      appTaskDependencyCatalog(
        {
          ...options(f, bus),
          appRegistrySnapshot: {
            id: "catalog:incomplete",
            generation: 1,
            entries: [{ appDir: join(f.projectsRoot, "incomplete.app"), definition: target }],
          },
        },
        "may",
      ),
    ).toEqual([]);
  });

  it("lets an App reject Conditions it cannot meaningfully observe", () => {
    const normalized = normalizeTaskHandlerResult(
      {
        state: "waiting",
        summary: "Waiting for an invented human event",
        evidence: [],
        conditions: [{ id: "approval", type: "human-decision", subject: "id:approval", expected: true }],
      },
      { type: "done", summary: "done", runId: "run-1" },
      {
        validateCondition: () => "is not observable by this App",
      },
    );

    expect(normalized).toMatchObject({
      state: "error",
      summary: "Handler result was rejected: conditions[0] is not observable by this App",
    });
  });

  it("keeps parent prompts bounded while preserving child identity and state", () => {
    const hiddenDetail = "exact-child-detail-" + "x".repeat(8_000);
    const context: Parameters<typeof projectAppTaskChildPromptContext>[0] = {
      live: Array.from({ length: 16 }, (_, index) => ({
        taskId: `live-${index}`,
        parentId: "parent",
        generation: 1,
        phase: "waiting",
        outcome: `Resolve child ${index} ${"o".repeat(800)}`,
        agent: "sample-owner",
        input: { hiddenDetail },
        conditions: [
          {
            id: `condition-${index}`,
            type: "external.state",
            subject: `child:${index}`,
            expected: { hiddenDetail },
          },
        ],
        readiness: {
          state: "condition-blocked",
          reason: `Waiting for child ${index} ${"r".repeat(800)}`,
          relatedTaskIds: [`condition-${index}`],
        },
        hasLiveChildren: false,
        summary: `Still waiting ${"s".repeat(800)}`,
        evidence: Array.from({ length: 4 }, () => `evidence-${"e".repeat(800)}`),
      })),
      completed: Array.from({ length: 8 }, (_, index) => ({
        taskId: `done-${index}`,
        parentId: "parent",
        generation: 1,
        outcome: `Complete child ${index} ${"o".repeat(800)}`,
        agent: "sample-owner",
        input: { hiddenDetail },
        conditions: [],
        hasLiveChildren: false,
        summary: `Completed ${"s".repeat(800)}`,
        evidence: Array.from({ length: 4 }, () => `evidence-${"e".repeat(800)}`),
        completedAt: "2026-08-20T00:00:00.000Z",
      })),
    };

    const projected = projectAppTaskChildPromptContext(context);
    const encoded = JSON.stringify(projected);

    expect(encoded.length).toBeLessThan(40_000);
    expect(encoded).not.toContain("exact-child-detail");
    expect(encoded).not.toContain("external.state");
    expect(projected.live[0]).toMatchObject({
      taskId: "live-0",
      generation: 1,
      phase: "waiting",
      agent: "sample-owner",
    });
    expect(projected.live[0]).not.toHaveProperty("owner");
    expect(projected.completed[0]).toMatchObject({
      taskId: "done-0",
      generation: 1,
      agent: "sample-owner",
    });
    expect(projected.completed[0]).not.toHaveProperty("owner");
  });

  it("shows the executor the exact accepted wait before it judges feedback", () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const taskIntent = {
      id: "work/focused-feedback",
      parentId: "operations",
      outcome: "Resolve the human concern on this Task",
      acceptance: ["The concern is resolved"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent: taskIntent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: taskIntent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    createAppInboxItem(getDb(persistDir), {
      id: "existing-proof",
      appId: "gym",
      source: { kind: "app", id: "sample" },
      input: { kind: "probe", data: { value: "compare current behavior" } },
      now: 1,
    });
    const dependencyClaim = claimAppInboxItem(getDb(persistDir), "existing-proof", "gym", 1_000, 2);
    if (!dependencyClaim) throw new Error("expected dependency claim");
    expect(
      waitAppInboxClaim(
        getDb(persistDir),
        dependencyClaim,
        { kind: "task", id: "runtime/regression-run/existing-proof" },
        { now: 3 },
      ),
    ).toBe(true);
    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "Gym is comparing current behavior",
        evidence: ["comparison requested"],
        conditions: [
          {
            id: "app-request:existing-proof",
            type: "app.dependency.completed",
            subject: "id:existing-proof",
            expected: { field: "status", equals: "done" },
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });

    expect(
      projectAppTaskWaitPromptContext(
        { ...options(f, bus), persistDir },
        {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: false,
        },
        taskIntent.id,
      ),
    ).toMatchObject({
      open: [
        {
          conditionId: "app-request:existing-proof",
          type: "app.dependency.completed",
          state: "unknown",
          dependency: {
            requestId: "existing-proof",
            appId: "gym",
            status: "handling",
            resolvedTaskId: "runtime/regression-run/existing-proof",
          },
        },
      ],
    });
  });
});

function projectDirForBypass(): string {
  const root = join(tmpdir(), `app-task-workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(root, { recursive: true });
  return root;
}

describe("canonical App task runtime", () => {
  it("rejects a dependency that is not accepted by the installed App contract", () => {
    const f = fixture();
    const bus = eventBus();
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/invalid-owner",
        parentId: "operations",
        outcome: "Choose one installed accountable App",
        acceptance: ["The target accepts the typed input"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/invalid-owner",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const target = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      inputSchema: Type.Object({
        kind: Type.Literal("owner-review"),
        data: Type.Record(Type.String(), Type.Unknown()),
      }),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "review",
          parentId: "evaluation",
          outcome: "Review evidence",
          acceptance: ["Reviewed"],
          mode: "achieve" as const,
        },
      }),
      tasks: {},
    });
    const opts = {
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "dependency:1",
        generation: 1,
        entries: [{ appDir: join(f.projectsRoot, "evaluation.app"), definition: target }],
      },
    };

    expect(() =>
      admitTaskAppDependencies({
        opts,
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: true,
        },
        claim,
        dependencies: [{ id: "review", appId: "evaluation", input: { kind: "invented", data: {} } }],
      }),
    ).toThrow("input is not accepted by installed App evaluation");
  });

  it("rejects a dependency when the configured registry has no target Apps", () => {
    const f = fixture();
    const bus = eventBus();
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/missing-owner",
        parentId: "operations",
        outcome: "Use one installed accountable App",
        acceptance: ["The target is installed"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/missing-owner",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      admitTaskAppDependencies({
        opts: {
          ...options(f, bus),
          appRegistrySnapshot: { id: "empty:1", generation: 1, entries: [] },
        },
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: true,
        },
        claim,
        dependencies: [{ id: "review", appId: "evaluation", input: { kind: "review", data: {} } }],
      }),
    ).toThrow("targets unavailable App evaluation");
  });

  it("does not publish a dependency requested from a stale task result", () => {
    const f = fixture();
    const bus = eventBus();
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/stale-dependency",
        parentId: "operations",
        outcome: "Use current evidence before requesting review",
        acceptance: ["Only a current result can request review"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/stale-dependency",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskTrigger(config, claim.taskId, {
      type: "app.dependency.completed",
      eventId: 42,
      data: { kind: "app", id: "earlier-review" },
    });

    const emitted: AgentEvent[] = [];
    bus.subscribe((event) => emitted.push(event));
    expect(() =>
      admitTaskAppDependencies({
        opts: options(f, bus),
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: true,
        },
        claim,
        dependencies: [
          {
            id: "new-review",
            appId: "evaluation",
            input: { kind: "deep-scan", data: { reason: "stale-snapshot" } },
          },
        ],
      }),
    ).toThrow("newer Task evidence is pending");
    expect(emitted.filter((event) => event.type === "app.input.requested")).toEqual([]);
    expect(readTaskState(config).taskTriggers?.[claim.taskId]?.event).toMatchObject({ eventId: 42 });
  });

  it("accepts a recovered frozen Condition route after its task has already left the wait", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    writeFileSync(
      join(f.appDir, "app.js"),
      `export default {
        id: "sample", version: 1, agent: "sample-owner",
        inputSchema: { type: "object", properties: {} },
        tasks: {}
      };\n`,
    );
    const stateDir = join(f.appDir, ".state", "tasks");
    mkdirSync(stateDir, { recursive: true });
    const seed = JSON.parse(readFileSync(join(f.appDir, "tasks", "seed.json"), "utf8"));
    writeFileSync(join(stateDir, "state.json"), `${JSON.stringify({ ...seed, project_lifecycle: "paused" })}\n`);
    activateTaskResources(
      taskReconciliationConfig({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
      }),
      persistDir,
    );
    const registry = new AppRegistry(f.projectsRoot);
    await registry.reload();
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: registry.snapshot(),
    });

    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: { type: "pipeline-run.state", data: { pipelineRunId: "42", state: "completed" } },
        intent: null,
        conditionTaskIds: ["retired-task"],
      }),
    ).toMatchObject({
      accepted: true,
      route: "direct",
      note: expect.stringContaining("already observed: retired-task"),
    });
  });

  it("preserves event time through Runtime preview so stale level observations stay blocked", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const intent = {
      id: "work/credential",
      parentId: "operations",
      outcome: "Wait for a fresh credential observation",
      acceptance: ["A fresh ready observation is received"],
      mode: "maintain" as const,
    };
    const observed = observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    if (observed.kind === "completed") throw new Error("expected observed task");
    const claim = claimObservedAppTask(config, {
      taskId: observed.taskId,
      appAgent: "sample-owner",
      handler: "owner:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claimed task");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "Waiting for credential readiness",
      conditions: [
        {
          id: "credential-ready:xhs",
          type: "credential.state",
          subject: "credential:xhs",
          expected: { field: "state", equals: "ready" },
        },
      ],
    });
    const establishedAt = Date.parse(
      readTaskState(config).conditions?.["credential-ready:xhs"]?.status.observedAt ?? "",
    );
    expect(Number.isFinite(establishedAt)).toBeTrue();
    activateTaskResources(config, persistDir);
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:condition-time",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const observation = (timestamp: number): AgentEvent => ({
      type: "credential.state",
      timestamp,
      data: { credential: "xhs", state: "ready" },
    });
    expect(
      previewLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: observation(establishedAt - 1),
      }),
    ).toEqual([]);
    expect(
      previewLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: observation(establishedAt + 1),
      }),
    ).toEqual([intent.id]);
  });

  it("carries a deterministic cross-App result back as the parent's next Event", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const evaluationDir = join(f.projectsRoot, "evaluation.app");
    mkdirSync(join(evaluationDir, "tasks"), { recursive: true });
    writeFileSync(
      join(evaluationDir, "tasks", "seed.json"),
      JSON.stringify({
        root_task_id: "root",
        groups: {
          root: { id: "root", parent_id: null, state: "backlog", agent: "evaluator", children: [] },
        },
      }),
    );
    writeFileSync(
      join(f.appDir, "app.js"),
      `export default {
        id: "sample", version: 1, agent: "sample-owner",
        inputSchema: { type: "object", properties: {} },
        tasks: {}
      };\n`,
    );
    writeFileSync(
      join(evaluationDir, "app.js"),
      `export default {
        id: "evaluation", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", additionalProperties: false, required: ["kind", "data"],
          properties: {
            kind: { const: "deep-scan" },
            data: { type: "object", additionalProperties: false, required: ["reason"], properties: { reason: { type: "string" } } }
          }
        },
        task(input) {
          return {
            kind: "desired",
            intent: {
              id: "review/" + input.id,
              parentId: "root",
              outcome: "Complete independent review",
              acceptance: ["Review accepted"],
              mode: "achieve"
            }
          };
        },
        tasks: {}
      };\n`,
    );

    const stateDir = join(f.appDir, ".state", "tasks");
    mkdirSync(stateDir, { recursive: true });
    const seed = JSON.parse(readFileSync(join(f.appDir, "tasks", "seed.json"), "utf8"));
    writeFileSync(
      join(stateDir, "state.json"),
      `${JSON.stringify({ ...seed, project_lifecycle: "paused" }, null, 2)}\n`,
    );
    activateTaskResources(
      taskReconciliationConfig({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
      }),
      persistDir,
    );

    const registry = new AppRegistry(f.projectsRoot);
    await registry.reload();
    const evaluationConfig = taskReconciliationConfig({
      appDir: evaluationDir,
      projectDir: evaluationDir,
      owner: "evaluator",
      maxConcurrent: 1,
    });
    const evaluationState = readTaskState(evaluationConfig);
    evaluationState.project_lifecycle = "paused";
    saveTaskState(evaluationConfig, evaluationState, { projectLifecycleReason: "pause deterministic test owner" });
    activateTaskResources(evaluationConfig, persistDir, "evaluation");
    observeAppTaskIntent(evaluationConfig, {
      intent: {
        id: "review/current",
        parentId: "root",
        outcome: "Review the current evidence",
        acceptance: ["The accepted human decision is applied"],
        mode: "achieve",
        agent: "evaluator",
      },
      appAgent: "evaluator",
    });
    const waitingTarget = claimObservedAppTask(evaluationConfig, {
      taskId: "review/current",
      appAgent: "evaluator",
      handler: "agent:evaluator",
      reason: "await-human-decision",
    });
    if (waitingTarget.kind !== "claimed") throw new Error("expected target Task claim");
    deferAppTask(evaluationConfig, waitingTarget, {
      disposition: "waiting",
      summary: "Waiting for the human decision",
      conditions: [
        {
          id: "original-decision",
          type: "session.end",
          subject: "session:original-decision",
          expected: "done",
        },
      ],
    });
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: registry.snapshot(),
    });

    let nextEventId = 1;
    const dependencyEvents: Array<Record<string, unknown>> = [];
    const dependencyRequests: Array<Record<string, unknown>> = [];
    const conditionPreviews: string[][] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
    });
    bus.subscribe((event) => {
      if (event.type === "app.input.requested") {
        dependencyRequests.push(event as unknown as Record<string, unknown>);
      }
      if (event.type === "app.dependency.completed" && event.data.kind === "app") {
        dependencyEvents.push(event as unknown as Record<string, unknown>);
      }
    });
    const db = openDatabase(":memory:");
    applyDbSchema(db);
    let attachedDependencyTaskId: string | undefined;
    let attachedDependencyTaskCount = 0;
    const inbox = await startAppInboxRuntime({
      registry,
      db,
      bus,
      attachTask: async (input) => {
        const taskId = input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id;
        attachedDependencyTaskId ??= taskId;
        attachedDependencyTaskCount += 1;
        return attachLoadedAppTask({ ...input, bus });
      },
      readDependency: async ({ appDir, dependency }) => {
        const task = readLoadedAppTaskView({ bus, appDir, taskId: dependency.id });
        return task
          ? {
              kind: "task",
              id: dependency.id,
              status: task.status,
              summary: task.summary,
              response: task.response,
              result: task.result,
              evidence: task.evidence,
            }
          : null;
      },
      previewTaskEvent: ({ appId, event, targetedTaskId }) => {
        const taskIds = previewLoadedCanonicalAppTaskEvent({ bus, appId, event, targetedTaskId });
        if (event.type === "app.dependency.completed") conditionPreviews.push(taskIds);
        return taskIds;
      },
      admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
        admitLoadedCanonicalAppTaskEvent({ bus, appId, event, intent, targetedTaskId, conditionTaskIds }),
      scanIntervalMs: 10_000,
    });

    try {
      const sampleStore = AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample");
      if (!sampleStore) throw new Error("expected sample resource authority");
      const config = taskReconciliationConfig({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        resourceStore: sampleStore,
      });
      observeAppTaskIntent(config, {
        intent: {
          id: "work/cross-app-roundtrip",
          parentId: "operations",
          outcome: "Use one independent review",
          acceptance: ["The review result is considered"],
          mode: "achieve",
          agent: "sample-owner",
        },
        appAgent: "sample-owner",
      });
      const initial = claimObservedAppTask(config, {
        taskId: "work/cross-app-roundtrip",
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "test",
      });
      if (initial.kind !== "claimed") throw new Error("expected initial claim");
      const descriptor = {
        id: "sample",
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        app: definition(),
        reconciliationPaused: true,
        resourceStore: sampleStore,
      };
      const conditions = admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim: initial,
        dependencies: [
          {
            id: "review",
            appId: "evaluation",
            taskId: "review/current",
            input: { kind: "deep-scan", data: { reason: "parent-needs-review" } },
          },
        ],
      });
      expect(
        deferAppTask(config, initial, {
          disposition: "waiting",
          summary: "Waiting for the independent review",
          conditions,
        }).status,
      ).toBe("applied");

      const requestId = conditions[0]!.subject.slice("id:".length);
      const attachmentDeadline = Date.now() + 5_000;
      while (!attachedDependencyTaskId && Date.now() < attachmentDeadline) await Bun.sleep(5);
      if (!attachedDependencyTaskId) throw new Error("expected child App request to attach to a Task");
      expect(attachedDependencyTaskId).toBe("review/current");
      expect(readTaskState(evaluationConfig).taskTriggers?.["review/current"]?.event).toMatchObject({
        type: "app.task.requested",
        data: {
          taskId: "review/current",
          request: {
            input: { kind: "deep-scan", data: { reason: "parent-needs-review" } },
          },
        },
      });
      expect(
        Object.keys(readTaskState(evaluationConfig).resources ?? {}).filter((id) => id.startsWith("review/")),
      ).toEqual(["review/current"]);
      createAppInboxItem(getDb(persistDir), {
        id: requestId,
        appId: "evaluation",
        targetTaskId: "review/current",
        source: { kind: "app", id: "sample" },
        input: { kind: "deep-scan", data: { reason: "parent-needs-review" } },
      });

      expect(
        recordAppTaskTrigger(config, initial.taskId, {
          type: "message.created",
          data: { message: "Review the current dependency without replacing it" },
        }),
      ).toEqual({ kind: "recorded" });
      const checkpointReview = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "checkpoint-review",
      });
      if (checkpointReview.kind !== "claimed") throw new Error("expected checkpoint review claim");
      const reused = admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim: checkpointReview,
        existingConditions: conditions,
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/current",
            input: { kind: "deep-scan", data: { reason: "parent-needs-review " } },
          },
        ],
      });
      expect(reused).toEqual(conditions);
      expect(
        deferAppTask(config, checkpointReview, {
          disposition: "waiting",
          summary: "The original independent review remains in progress",
          conditions: reused,
        }).status,
      ).toBe("applied");
      expect(readTaskState(config).resources?.[initial.taskId]?.status.conditionIds).toEqual([conditions[0]!.id]);
      await Bun.sleep(10);
      expect(dependencyRequests).toHaveLength(1);
      expect(attachedDependencyTaskCount).toBe(1);

      expect(
        recordAppTaskTrigger(config, initial.taskId, {
          type: "message.created",
          data: { message: "Add one distinct second review" },
        }),
      ).toEqual({ kind: "recorded" });
      const expandedReview = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "second-review-requested",
      });
      if (expandedReview.kind !== "claimed") throw new Error("expected expanded review claim");
      const expanded = admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim: expandedReview,
        existingConditions: conditions,
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/current",
            input: { kind: "deep-scan", data: { reason: "parent-needs-review " } },
          },
          {
            id: "second-independent-review",
            appId: "evaluation",
            input: { kind: "deep-scan", data: { reason: "a-distinct-review" } },
          },
        ],
      });
      expect(expanded[0]).toEqual(conditions[0]);
      expect(expanded[1]?.subject).not.toBe(conditions[0]?.subject);
      expect(
        deferAppTask(config, expandedReview, {
          disposition: "waiting",
          summary: "Waiting for both independent reviews",
          conditions: expanded,
        }).status,
      ).toBe("applied");
      const secondAttachmentDeadline = Date.now() + 5_000;
      while (attachedDependencyTaskCount < 2 && Date.now() < secondAttachmentDeadline) await Bun.sleep(5);
      expect(dependencyRequests).toHaveLength(2);
      expect(attachedDependencyTaskCount).toBe(2);

      const firstDependencyReadyDeadline = Date.now() + 5_000;
      while (!inbox.host.get(requestId)?.waitingOn && Date.now() < firstDependencyReadyDeadline) await Bun.sleep(5);
      expect(inbox.host.get(requestId)).toMatchObject({
        status: "handling",
        waitingOn: { kind: "task", id: attachedDependencyTaskId },
      });

      const resumedTarget = claimObservedAppTask(evaluationConfig, {
        taskId: attachedDependencyTaskId,
        appAgent: "evaluator",
        handler: "agent:evaluator",
        reason: "typed-human-feedback",
      });
      if (resumedTarget.kind !== "claimed") throw new Error(`expected resumed target claim, got ${resumedTarget.kind}`);
      expect(resumedTarget.events).toHaveLength(1);
      expect(resumedTarget.events[0]?.event).toMatchObject({
        type: "app.task.requested",
        data: {
          request: { input: { kind: "deep-scan", data: { reason: "parent-needs-review" } } },
        },
      });
      completeAppTask(evaluationConfig, resumedTarget, {
        summary: "Independent review completed",
        response: "The dependency result is ready for the parent.",
        result: { disposition: "accepted", score: 0.92 },
        evidence: ["review:accepted"],
      });
      bus.emit({
        type: "app.dependency.completed",
        source: "test:evaluation-task",
        owner: "app:evaluation",
        data: { kind: "task", id: attachedDependencyTaskId },
      });
      const deadline = Date.now() + 5_000;
      while (!readTaskState(config).taskTriggers?.[initial.taskId] && Date.now() < deadline) {
        await Bun.sleep(5);
      }
      expect(dependencyEvents).toHaveLength(1);
      expect(conditionPreviews).toContainEqual([initial.taskId]);
      expect(inbox.host.get(requestId)).toMatchObject({
        status: "done",
        result: {
          summary: "Independent review completed",
          response: "The dependency result is ready for the parent.",
          result: { disposition: "accepted", score: 0.92 },
          evidence: ["review:accepted"],
        },
      });

      const resumed = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "dependency-completed",
      });
      if (resumed.kind !== "claimed") throw new Error(`expected resumed claim, got ${resumed.kind}`);
      expect(resumed.events).toHaveLength(1);
      expect(resumed.events[0]?.event).toMatchObject({
        type: "app.dependency.completed",
        data: {
          kind: "app",
          id: requestId,
          status: "done",
          summary: "Independent review completed",
          response: "The dependency result is ready for the parent.",
          result: { disposition: "accepted", score: 0.92 },
          evidence: ["review:accepted"],
        },
      });
    } finally {
      inbox.close();
      db.close();
    }
  });

  it("rejects replacement of an open App request before emitting duplicate work", () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const emitted: Array<Record<string, unknown>> = [];
    bus.subscribe((event) => emitted.push(event as unknown as Record<string, unknown>));
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/cross-app-conflict",
        parentId: "operations",
        outcome: "Use one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/cross-app-conflict",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
    };
    const first = admitTaskAppDependencies({
      opts: { ...options(f, bus), persistDir },
      descriptor,
      claim,
      dependencies: [{ id: "review", appId: "evaluation", input: { kind: "deep-scan", data: { reason: "original" } } }],
    });
    const requestId = first[0]!.subject.slice("id:".length);
    createAppInboxItem(getDb(persistDir), {
      id: requestId,
      appId: "evaluation",
      source: { kind: "app", id: "sample" },
      input: { kind: "deep-scan", data: { reason: "original" } },
    });
    const emittedBeforeConflict = emitted.length;

    expect(() =>
      admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim,
        existingConditions: first,
        dependencies: [
          {
            id: "replacement-review",
            appId: "evaluation",
            input: { kind: "deep-scan", data: { reason: "changed" } },
          },
        ],
      }),
    ).toThrow(`would replace open request ${requestId}`);
    expect(emitted).toHaveLength(emittedBeforeConflict);
  });

  it("reuses a create-work request when the agent reports its resolved Task", () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/reuse-created-task",
        parentId: "operations",
        outcome: "Reuse one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/reuse-created-task",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
    };
    const dependency = { kind: "deep-scan", data: { reason: "original" } };
    const first = admitTaskAppDependencies({
      opts: { ...options(f, bus), persistDir },
      descriptor,
      claim,
      dependencies: [{ id: "review", appId: "evaluation", input: dependency }],
    });
    const requestId = first[0]!.subject.slice("id:".length);
    const db = getDb(persistDir);
    createAppInboxItem(db, {
      id: requestId,
      appId: "evaluation",
      source: { kind: "app", id: "sample" },
      input: dependency,
      now: 1,
    });
    const requestClaim = claimAppInboxItem(db, requestId, "test", 1_000, 2);
    if (!requestClaim) throw new Error("expected request claim");
    expect(
      waitAppInboxClaim(db, requestClaim, { kind: "task", id: "review/resolved" }, { now: 3 }),
    ).toBe(true);

    expect(
      admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim,
        existingConditions: first,
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/resolved",
            input: { kind: "deep-scan", data: { reason: "agent restatement is not authority" } },
          },
        ],
      }),
    ).toEqual(first);
  });

  it("reattaches an exact live request from the same Task generation after recovery", () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const emitted: Array<Record<string, unknown>> = [];
    bus.subscribe((event) => emitted.push(event as unknown as Record<string, unknown>));
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/reattach-request",
        parentId: "operations",
        outcome: "Recover one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/reattach-request",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "recovery",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const requestId = "appdep_existing";
    const requestInput = { kind: "deep-scan", data: { reason: "original" } };
    const db = getDb(persistDir);
    createAppInboxItem(db, {
      id: requestId,
      appId: "evaluation",
      source: { kind: "app", id: "sample" },
      input: requestInput,
      idempotencyKey: `task-dependency:sample:${claim.taskId}:${claim.generation}:review:existing`,
      now: 1,
    });
    const requestClaim = claimAppInboxItem(db, requestId, "test", 1_000, 2);
    if (!requestClaim) throw new Error("expected request claim");
    expect(
      waitAppInboxClaim(db, requestClaim, { kind: "task", id: "review/resolved" }, { now: 3 }),
    ).toBe(true);
    const emittedBeforeReuse = emitted.length;

    expect(
      admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: false,
        },
        claim,
        existingConditions: [],
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/resolved",
            input: { kind: "deep-scan", data: { reason: "restated" } },
          },
        ],
      }),
    ).toEqual([
      {
        id: `app-request:${requestId}`,
        type: "app.dependency.completed",
        subject: `id:${requestId}`,
        expected: { field: "status", equals: "done" },
      },
    ]);
    expect(emitted).toHaveLength(emittedBeforeReuse);
  });

  it("turns a typed child App dependency into deterministic input and an exact completion Condition", () => {
    const f = fixture();
    const bus = eventBus();
    const emitted: Array<Record<string, unknown>> = [];
    bus.subscribe((event) => {
      emitted.push(event as unknown as Record<string, unknown>);
    });
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/cross-app",
        parentId: "operations",
        outcome: "Use one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/cross-app",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
    };

    const conditions = admitTaskAppDependencies({
      opts: options(f, bus),
      descriptor,
      claim,
      dependencies: [
        {
          id: "review",
          appId: "evaluation",
          taskId: "review/current",
          input: { kind: "deep-scan", data: { reason: "sample-review" } },
        },
      ],
    });
    const requested = emitted.find((event) => event.type === "app.input.requested");
    expect(requested).toMatchObject({
      source: "app-task:sample",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        targetTaskId: "review/current",
        input: { kind: "deep-scan", data: { reason: "sample-review" } },
        source: { kind: "app", id: "sample" },
      },
    });
    const requestId = (requested?.data as { requestId?: string } | undefined)?.requestId;
    expect(requestId).toMatch(/^appdep_[a-f0-9]{24}$/);
    expect(conditions).toEqual([
      {
        id: `app-request:${requestId}`,
        type: "app.dependency.completed",
        subject: `id:${requestId}`,
        expected: { field: "status", equals: "done" },
      },
    ]);
  });

  it("projects the exact ordered claimed event batch into workflow context", () => {
    const f = fixture();
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const observedAt = ["2026-08-19T00:00:01.000Z", "2026-08-19T00:00:02.000Z"];
    const intent = {
      id: "work/event-context",
      parentId: "operations",
      outcome: "Receive the exact event context",
      acceptance: ["The workflow sees the ordered events"],
      mode: "maintain" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const initial = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "workflow:sample",
      reason: "test",
    });
    if (initial.kind !== "claimed") throw new Error("expected initial claim");

    const tree = readTaskState(config);
    tree.taskTriggers = {
      [intent.id]: {
        taskId: intent.id,
        taskGeneration: initial.generation,
        resourceVersion: 2,
        event: { type: "sample.second", eventId: 12, data: { value: "second" } },
        events: [
          {
            event: { type: "sample.first", eventId: 11, data: { value: "first" } },
            observedAt: observedAt[0]!,
          },
          {
            event: { type: "sample.second", eventId: 12, data: { value: "second" } },
            observedAt: observedAt[1]!,
          },
        ],
        observedAt: observedAt[1]!,
      },
    };
    tree.attempts![initial.attemptId]!.state = "completed";
    tree.resources![intent.id]!.status = {
      ...tree.resources![intent.id]!.status,
      phase: "pending",
      currentAttemptId: undefined,
    };
    saveTaskState(config, tree);

    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "workflow:sample",
      reason: "event",
    });
    if (claim.kind !== "claimed") throw new Error("expected event claim");

    expect(projectAppTaskReconciliationEvents(claim)).toEqual({
      items: [
        {
          eventId: 11,
          observedAt: observedAt[0],
          event: { type: "sample.first", data: { value: "first" } },
        },
        {
          eventId: 12,
          observedAt: observedAt[1],
          event: { type: "sample.second", data: { value: "second" } },
        },
      ],
      throughEventId: 12,
      truncated: false,
    });
  });

  it("does not rewrite App task state for high-volume session progress", async () => {
    const f = fixture();
    const bus = eventBus();
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:progress",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/progress",
        parentId: "operations",
        outcome: "Process progress",
        acceptance: ["Work converges"],
        mode: "achieve",
        agent: "sample-owner",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/progress",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-progress")).toBe(true);

    const before = readFileSync(config.statePath, "utf8");
    for (let index = 0; index < 100; index += 1) {
      bus.emit({
        type: "tool_call",
        sessionId: "session-progress",
        agent: "sample-owner",
        tool: "read",
        args: { index },
      });
    }
    expect(readFileSync(config.statePath, "utf8")).toBe(before);
  });

  it("limits successful-session recovery reads to the session's bound App", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const foreignAppDir = join(f.projectsRoot, "foreign.app");
    mkdirSync(join(foreignAppDir, "agents", "foreign-owner"), { recursive: true });
    mkdirSync(join(foreignAppDir, "tasks"), { recursive: true });
    writeFileSync(
      join(foreignAppDir, "tasks", "seed.json"),
      JSON.stringify({
        root_task_id: "root",
        groups: {
          root: { id: "root", parent_id: null, state: "backlog", owner: "foreign-owner", children: [] },
        },
      }),
    );
    const foreignDefinition = defineApp({
      id: "foreign",
      version: 1,
      owner: "foreign-owner",
      inputSchema: Type.Object({}, { additionalProperties: true }),
      workspace: { kind: "local", localPath: "." },
      tasks: { subscriptions: [] },
    });
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:scoped-session-recovery",
        generation: 1,
        entries: [
          { appDir: f.appDir, definition: definition() },
          { appDir: foreignAppDir, definition: foreignDefinition },
        ],
      },
    });

    const sessionId = "session-bound-to-sample";
    writeSessionMeta(persistDir, sessionId, {
      agent: "sample-owner",
      task: [
        "Owner reconciliation",
        "## Reconciliation Task",
        "```json",
        JSON.stringify({ appId: "sample", taskId: "work/scoped", generation: 1 }),
        "```",
      ].join("\n"),
      status: "done",
      startedAt: Date.now() - 100,
      endedAt: Date.now(),
      source: "app-task-owner",
      projectId: "sample",
      kind: "call",
    });

    const foreignStatePath = join(foreignAppDir, ".state", "tasks", "state.json");
    const failures: string[] = [];
    bus.subscribe((event) => {
      if (event.type === "subscriber.failed") failures.push(String(event.data.error ?? ""));
    });
    mkdirSync(join(foreignAppDir, ".state", "tasks"), { recursive: true });
    writeFileSync(foreignStatePath, "not valid JSON");
    try {
      bus.emit({
        type: "session.end",
        agent: "sample-owner",
        sessionId,
        status: "done",
        projectId: "sample",
        data: { sessionId, agent: "sample-owner", status: "done", projectId: "sample" },
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      rmSync(foreignStatePath, { force: true });
    }

    expect(failures).toEqual([]);
  });

  it("does not discover or import App definitions independently", async () => {
    const f = fixture();
    const bus = eventBus();
    writeFileSync(join(f.appDir, "app.ts"), `throw new Error("the task runtime must not import app.ts");`);

    expect(await installAppTaskRuntimes(options(f, bus))).toEqual({ installed: [] });

    const result = await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    expect(result.installed).toHaveLength(1);
    expect(result.installed[0]).toMatchObject({
      id: "sample",
      appDir: f.appDir,
      agent: "sample-owner",
    });
  });

  it("installs an activated resource-backed App without recreating state.json", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const legacyConfig = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(legacyConfig, {
      intent: {
        id: "work/resource-dependency",
        parentId: "operations",
        outcome: "Read one resource-backed dependency",
        acceptance: ["Dependency reads do not parse legacy state"],
        mode: "achieve",
        agent: "sample-owner",
      },
      appAgent: "sample-owner",
      admissionKey: "attach:resource-dependency",
    });
    const tree = readTaskState(legacyConfig);
    tree.project = "sample";
    tree.project_lifecycle = "paused";
    saveTaskState(legacyConfig, tree, { projectLifecycleReason: "test migration pause" });

    const store = AppTaskResourceStore.fromDb(getDb(persistDir), "sample");
    store.importPausedSnapshot(tree, "test-source-revision");
    store.activate("test-source-revision");
    store.setProjectLifecycle("active");
    rmSync(legacyConfig.statePath);

    const result = await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:resource-store",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    expect(result.installed).toHaveLength(1);
    expect(result.installed[0]?.resourceStore?.isActive()).toBeTrue();
    expect(result.installed[0]?.reconciliationPaused).toBeFalse();
    expect(existsSync(legacyConfig.statePath)).toBeFalse();

    expect(
      await createAppTaskCapability({ bus }).readDependency({
        appDir: f.appDir,
        dependency: { kind: "task", id: "work/resource-dependency" },
      }),
    ).toMatchObject({ id: "work/resource-dependency", status: "pending" });
    expect(existsSync(legacyConfig.statePath)).toBeFalse();
  });

  it("bootstraps a brand-new App directly into resource authority", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const statePath = projectRuntimePaths(f.appDir).taskStatePath;

    const result = await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:new-resource-store",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const store = result.installed[0]?.resourceStore;
    expect(store?.isActive()).toBeTrue();
    expect(store?.projectLifecycle()).toBe("active");
    expect(store?.sourceRevision()).toMatch(/^seed:[0-9a-f]{64}$/);
    expect(store?.readSnapshot().root_task_id).toBe("root");
    expect(existsSync(statePath)).toBeFalse();
  });

  it("refuses an existing legacy App until its resource cutover is complete", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const legacy = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });

    await expect(
      installAppTaskRuntimes({
        ...options(f, bus),
        persistDir,
        appRegistrySnapshot: {
          id: "boot:retained-legacy-store",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      }),
    ).rejects.toThrow("complete the guarded resource cutover");
    expect(existsSync(legacy.statePath)).toBeTrue();
    expect(AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample")).toBeNull();
  });

  it("yields readiness inside one large reconciliation after claim persistence", async () => {
    const f = fixture();
    const bus = eventBus();
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const retainedEvidence = "x".repeat(4 * 1024 * 1024);
    const seeded = readTaskState(config);
    seeded.receipts = {
      historical: {
        metadata: { id: "historical", generation: 1, resourceVersion: 1 },
        specHash: "historical",
        parentId: "operations",
        outcome: "Preserve retained evidence",
        acceptance: ["Evidence remains immutable"],
        agent: "sample-owner",
        handler: "agent:sample-owner",
        summary: "Historical receipt",
        evidence: [retainedEvidence],
        acceptanceBasis: { method: "agent-judgment", evidence: ["historical"] },
        failureFingerprints: [],
        completedAt: "2026-08-19T00:00:00.000Z",
      },
    };
    saveTaskState(config, seeded);
    activateTaskResources(config, join(f.root, "state"));

    let readinessTurnObserved = false;
    let ownerObservedReadinessTurn: boolean | undefined;
    let ownerCalls = 0;
    bus.subscribe((event) => {
      if (event.type !== "project.task.reconcile.started" || event.data.taskId !== "work/large-state") return;
      setTimeout(() => {
        readinessTurnObserved = true;
      }, 0);
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      manager: {
        hasAgent: () => true,
        async callAgent() {
          ownerCalls += 1;
          ownerObservedReadinessTurn = readinessTurnObserved;
          return {
            sessionId: "large-state-owner",
            status: "done",
            structuredResult: {
              state: "waiting",
              summary: "Waiting on an exact external fact",
              evidence: ["large-state-owner-dispatched"],
              actions: [],
              conditions: [
                {
                  id: "large-state-proof",
                  type: "project.state",
                  subject: "project:sample",
                  expected: { field: "ready", equals: true },
                },
              ],
            },
            lastAssistantText: "Waiting on an exact external fact",
            messages: [],
            duration: "0s",
            outputDir: "",
          };
        },
      } as never,
      appRegistrySnapshot: {
        id: "boot:large-state-yield",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/large-state",
          parentId: "operations",
          outcome: "Reconcile one task without starving readiness",
          acceptance: ["Readiness gets a turn after durable claim persistence"],
          mode: "achieve",
          agent: "sample-owner",
        },
      },
      idempotencyKey: "attach:large-state",
      request: {
        id: "request-large-state",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    const deadline = Date.now() + 2_000;
    while (ownerCalls === 0 && Date.now() < deadline) await Bun.sleep(5);
    expect(ownerCalls).toBe(1);
    expect(ownerObservedReadinessTurn).toBe(true);
    expect(readTaskState(config).receipts?.historical?.evidence).toEqual([retainedEvidence]);
  });

  it("does not create task worktrees while startup installs and recovers work", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    execFileSync("git", ["init", "-b", "main", f.appDir], { stdio: "ignore" });
    execFileSync("git", ["-C", f.appDir, "config", "user.email", "test@example.com"]);
    execFileSync("git", ["-C", f.appDir, "config", "user.name", "Test"]);
    execFileSync("git", ["-C", f.appDir, "add", "."]);
    execFileSync("git", ["-C", f.appDir, "commit", "-m", "baseline"], { stdio: "ignore" });

    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/retry-workspace",
        parentId: "operations",
        outcome: "Retry a task workspace only after startup is ready",
        acceptance: ["No task worktree exists before explicit recovery"],
        mode: "achieve",
        agent: "sample-owner",
        executor: "codex",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/retry-workspace",
      appAgent: "sample-owner",
      handler: "executor:codex",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected workspace claim");
    markAppTaskAttention(config, claim, {
      summary: "workspace preparation failed",
      reason: "WorkspacePreparationFailed",
    });
    activateTaskResources(config, persistDir);

    let openControllerGate = () => {};
    const controllerGate = new Promise<void>((resolve) => {
      openControllerGate = resolve;
    });
    const worktreeRoot = join(f.root, "worktrees", "sample");
    await installAppTaskRuntimes(
      {
        ...options(f, bus),
        persistDir,
        startAfter: controllerGate,
        appRegistrySnapshot: {
          id: "boot:deferred-recovery",
          generation: 1,
          entries: [
            {
              appDir: f.appDir,
              definition: {
                ...definition(),
                workspace: { kind: "git", localPath: ".", branch: "main" },
              },
            },
          ],
        },
      },
      { deferRecovery: true },
    );

    expect(existsSync(worktreeRoot)).toBe(false);
    expect(readTaskState(config).resources?.["work/retry-workspace"]?.status.phase).toBe("attention");

    await recoverInstalledAppTasks(bus);

    expect(existsSync(worktreeRoot)).toBe(false);
    expect(readTaskState(config).resources?.["work/retry-workspace"]?.status).toMatchObject({
      phase: "pending",
      observedGeneration: 0,
    });
    openControllerGate();
    await closeInstalledAppTaskRuntimes(bus);
  });

  it("releases a fresh previous-runtime attempt and requeues it through bounded task capacity", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const runtimeOptions = {
      ...options(f, bus),
      persistDir,
      manager: { hasAgent: () => true, hasActiveSession: () => false } as never,
      appRegistrySnapshot: {
        id: "boot:fresh-session",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    };
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/resumable",
        parentId: "operations",
        outcome: "Resume exact task session",
        acceptance: ["Session is fenced once"],
        mode: "achieve",
        agent: "sample-owner",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/resumable",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-resumable")).toBe(true);
    const previousRuntimeTree = readTaskState(config);
    const previousAttempt = previousRuntimeTree.attempts?.[claim.attemptId];
    if (!previousAttempt?.lease) throw new Error("expected leased attempt");
    previousAttempt.runtimeId = "previous-runtime";
    previousAttempt.lease.runtimeId = "previous-runtime";
    saveTaskState(config, previousRuntimeTree);
    activateTaskResources(config, persistDir);
    writeSessionMeta(persistDir, "session-resumable", {
      agent: "sample-owner",
      task: "resume",
      status: "running",
      startedAt: Date.now(),
      source: "app-task-owner",
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
      kind: "call",
    });

    const recovered = await installAppTaskRuntimes(runtimeOptions, { includeFreshLeases: true });

    expect(recovered.installed).toHaveLength(1);
    expect(readTaskState(config).resources?.["work/resumable"]?.status).toMatchObject({
      phase: "pending",
      observedGeneration: 0,
    });
    expect(readSessionMeta(persistDir, "session-resumable")?.status).toBe("interrupted");
  });

  it("drains an orphaned setsid owner's exact process group before replacement recovery", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const intent = {
      id: "work/orphan-owner",
      parentId: "operations",
      outcome: "Recover orphan agent session",
      acceptance: ["Replacement ownership cannot overlap stale process mutation"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected orphan agent claim");
    expect(recordAppTaskAttemptSession(config, claim, "owner-old")).toBe(true);
    const previousRuntimeTree = readTaskState(config);
    const previousAttempt = previousRuntimeTree.attempts?.[claim.attemptId];
    if (!previousAttempt?.lease) throw new Error("expected leased orphan agent attempt");
    previousAttempt.runtimeId = "previous-runtime";
    previousAttempt.lease.runtimeId = "previous-runtime";
    previousAttempt.lease.expiresAt = new Date(Date.now() - 1_000).toISOString();
    saveTaskState(config, previousRuntimeTree);
    writeSessionMeta(persistDir, "owner-old", {
      agent: "sample-owner",
      task: "Recover orphan agent session",
      status: "running",
      startedAt: Date.now() - 60_000,
      source: "app-task-owner",
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
      kind: "call",
    });

    const staleMutation = join(f.root, "superseded-owner-mutation");
    const stalePgidPath = join(f.root, "superseded-owner-pgid");
    const staleCommand = `trap '' TERM; sleep 3; printf stale > ${JSON.stringify(staleMutation)}; sleep 30`;
    const externalReaper = spawn(
      "/usr/bin/python3",
      [
        "-c",
        [
          "import os, sys",
          "pid = os.fork()",
          "if pid == 0:",
          "    os.setsid()",
          "    with open(sys.argv[2], 'w') as pgid_file:",
          "        pgid_file.write(f'{os.getpid()}\\n')",
          "    os.execl('/bin/bash', 'bash', '-c', sys.argv[1])",
          "os.waitpid(pid, 0)",
        ].join("\n"),
        staleCommand,
        stalePgidPath,
      ],
      { stdio: "ignore" },
    );
    const externalReaperExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      externalReaper.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const stalePgidDeadline = Date.now() + 2_000;
    let stalePgid = 0;
    while (stalePgid <= 0 && Date.now() < stalePgidDeadline) {
      if (existsSync(stalePgidPath)) stalePgid = Number(readFileSync(stalePgidPath, "utf8").trim());
      if (stalePgid <= 0) await Bun.sleep(5);
    }
    expect(stalePgid).toBeGreaterThan(0);
    expect(
      Number(execFileSync("ps", ["-o", "pgid=", "-p", String(externalReaper.pid)], { encoding: "utf8" }).trim()),
    ).not.toBe(stalePgid);
    addSessionBashProcessGroup(persistDir, "owner-old", stalePgid);
    expect(readSessionBashProcessGroups(persistDir, "owner-old")).toEqual([stalePgid]);
    execFileSync("git", ["init", "-b", "main", f.root], { stdio: "ignore" });
    activateTaskResources(config, persistDir);

    let replacementCalls = 0;
    let preReplacementState:
      | { groupDead: boolean; pgids: number[]; mutated: boolean; sessionStatus?: string; resultPersisted: boolean }
      | undefined;
    try {
      await installAppTaskRuntimes({
        ...options(f, bus),
        persistDir,
        manager: {
          hasAgent: () => true,
          hasActiveSession: () => false,
          cancel: () => {
            throw new Error("startup recovery should drain the persisted agent session directly");
          },
          async callAgent() {
            let groupDead = true;
            for (const entry of readdirSync("/proc")) {
              if (!/^\d+$/.test(entry)) continue;
              try {
                const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
                const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
                if (Number(fields[2]) === stalePgid && fields[0] !== "Z") {
                  groupDead = false;
                  break;
                }
              } catch {
                // A process may exit while /proc is being scanned.
              }
            }
            preReplacementState = {
              groupDead,
              pgids: readSessionBashProcessGroups(persistDir, "owner-old"),
              mutated: existsSync(staleMutation),
              sessionStatus: readSessionMeta(persistDir, "owner-old")?.status,
              resultPersisted: existsSync(join(persistDir, "sessions", "owner-old", "result.json")),
            };
            replacementCalls += 1;
            return {
              sessionId: "owner-replacement",
              status: "done",
              structuredResult: {
                state: "converged",
                summary: "replacement owner completed",
                evidence: ["replacement terminal result"],
                actions: [],
              },
              lastAssistantText: "replacement owner completed",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as never,
        appRegistrySnapshot: {
          id: "boot:orphan-owner",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      });

      const replacementDeadline = Date.now() + 2_000;
      while (replacementCalls === 0 && Date.now() < replacementDeadline) await Bun.sleep(5);
      expect(replacementCalls).toBe(1);
      expect(preReplacementState).toEqual({
        groupDead: true,
        pgids: [],
        mutated: false,
        sessionStatus: "interrupted",
        resultPersisted: true,
      });

      const receiptDeadline = Date.now() + 2_000;
      while (!readTaskState(config).receipts?.[intent.id] && Date.now() < receiptDeadline) await Bun.sleep(5);
      const terminalReceipt = JSON.stringify(readTaskState(config).receipts?.[intent.id]);
      expect(terminalReceipt).not.toBeUndefined();
      expect(await externalReaperExit).toEqual({ code: 0, signal: null });
      await Bun.sleep(700);
      expect(existsSync(staleMutation)).toBe(false);
      expect(JSON.stringify(readTaskState(config).receipts?.[intent.id])).toBe(terminalReceipt);
    } finally {
      try {
        process.kill(-stalePgid, "SIGKILL");
      } catch {
        // Recovery already drained the exact orphaned group.
      }
      externalReaper.kill("SIGKILL");
    }
  });

  it("fails startup recovery closed when a durable owner process group cannot be confirmed drained", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const intent = {
      id: "work/undrained-owner",
      parentId: "operations",
      outcome: "Do not overlap an undrained owner",
      acceptance: ["Recovery remains fenced until exact process-group exit is confirmed"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected undrained agent claim");
    expect(recordAppTaskAttemptSession(config, claim, "owner-undrained")).toBe(true);
    const previousRuntimeTree = readTaskState(config);
    const previousAttempt = previousRuntimeTree.attempts?.[claim.attemptId];
    if (!previousAttempt?.lease) throw new Error("expected leased undrained attempt");
    previousAttempt.runtimeId = "previous-runtime";
    previousAttempt.lease.runtimeId = "previous-runtime";
    previousAttempt.lease.expiresAt = new Date(Date.now() - 1_000).toISOString();
    saveTaskState(config, previousRuntimeTree);
    writeSessionMeta(persistDir, "owner-undrained", {
      agent: "sample-owner",
      task: "Do not overlap an undrained owner",
      status: "running",
      startedAt: Date.now() - 60_000,
      source: "app-task-owner",
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
      kind: "call",
    });
    addSessionBashProcessGroup(persistDir, "owner-undrained", 424_242);
    execFileSync("git", ["init", "-b", "main", f.root], { stdio: "ignore" });
    activateTaskResources(config, persistDir);

    let replacementCalls = 0;
    let sessionEndEvents = 0;
    bus.subscribe((event) => {
      if (event.type === "session.end" && event.sessionId === "owner-undrained") sessionEndEvents += 1;
    });
    await expect(
      installAppTaskRuntimes({
        ...options(f, bus),
        persistDir,
        drainPersistedBashProcessGroups: () => false,
        manager: {
          hasAgent: () => true,
          hasActiveSession: () => false,
          cancel: () => undefined,
          async callAgent() {
            replacementCalls += 1;
            throw new Error("replacement must remain fenced");
          },
        } as never,
        appRegistrySnapshot: {
          id: "boot:undrained-owner",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      }),
    ).rejects.toThrow("did not exit after bounded SIGTERM/SIGKILL drain");

    expect(replacementCalls).toBe(0);
    expect(sessionEndEvents).toBe(0);
    expect(readSessionMeta(persistDir, "owner-undrained")?.status).toBe("running");
    expect(existsSync(join(persistDir, "sessions", "owner-undrained", "result.json"))).toBe(false);
    expect(readSessionBashProcessGroups(persistDir, "owner-undrained")).toEqual([424_242]);
    const afterRecovery = readTaskState(config);
    expect(afterRecovery.resources?.[intent.id]?.status.phase).toBe("running");
    expect(afterRecovery.resources?.[intent.id]?.status.currentAttemptId).toBe(claim.attemptId);
    expect(afterRecovery.receipts?.[intent.id]).toBeUndefined();
  });

  it("admits desired attachments and resolved events through the one loaded generation", async () => {
    const f = fixture();
    const bus = eventBus();
    const installed = await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const request: Readonly<AppRequest> = {
      id: "request-1",
      source: { kind: "human", id: "operator" },
      input: { kind: "sample", data: {} },
    };
    const attached = await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/attached",
          parentId: "operations",
          outcome: "Process attached work",
          acceptance: ["Work converges"],
          mode: "achieve",
          agent: "sample-owner",
        },
      },
      idempotencyKey: "attach:request-1",
      request,
    });
    expect(attached.taskId).toBe("work/attached");
    expect(
      readLoadedAppTaskView({
        bus,
        appDir: f.appDir,
        taskId: "work/attached",
      }),
    ).toMatchObject({ id: "work/attached", status: "pending" });

    const intent = definition().tasks!.resolve!({
      type: "sample.work",
      data: { itemId: "event" },
    })!;
    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: {
          type: "sample.work",
          source: "test",
          owner: "agent:sample-owner",
          data: { itemId: "event" },
        },
        intent,
      }),
    ).toMatchObject({ accepted: true, route: "direct" });
    expect(
      readLoadedAppTaskView({
        bus,
        appDir: f.appDir,
        taskId: "work/event",
      }),
    ).toMatchObject({ id: "work/event", status: "pending" });
  });

  it("atomically consumes live input incorporated by a registered executor", async () => {
    const f = fixture();
    const bus = eventBus();
    let nextEventId = 1;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
    });
    const published: AgentEvent[] = [];
    bus.subscribe((event) => {
      if (event.type === "sample.progress") published.push(event);
    });
    let calls = 0;
    let sawLiveFeedback = false;
    let wakeFirstAttempt = () => {};
    const firstAttemptReady = new Promise<void>((resolve) => {
      wakeFirstAttempt = resolve;
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        reviewer: async (attempt) => {
          calls += 1;
          expect(attempt.appId).toBe("sample");
          expect(attempt.task.id).toBe("work/registered-executor");
          expect(attempt.cwd).toBe(f.appDir);
          expect(attempt.declaredOutputPaths).toEqual([]);
          expect(attempt.children).toEqual({ live: [], completed: [] });
          expect(
            await attempt.publish(`pass-${calls}`, {
              type: "sample.progress",
              data: { pass: calls },
            }),
          ).toMatchObject({ eventId: expect.any(Number) });
          if (calls === 1) {
            await new Promise<void>((resolve) => {
              const unsubscribe = attempt.onEvent((event, accept) => {
                if (event.type !== "sample.feedback") return;
                sawLiveFeedback = true;
                accept();
                unsubscribe();
                resolve();
              });
              wakeFirstAttempt();
            });
          } else {
            expect(attempt.events.items.some((item) => item.event.type === "sample.feedback")).toBeTrue();
          }
          return {
            state: "converged",
            summary: "Registered executor completed the Task",
            evidence: [`test:reviewer:${calls}`],
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:registered-executor",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/registered-executor",
          parentId: "operations",
          outcome: "Run one replaceable executor",
          acceptance: ["The registered executor returns evidence"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "reviewer",
        },
      },
      idempotencyKey: "attach:registered-executor",
      request: {
        id: "request-registered-executor",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    await firstAttemptReady;
    const feedback = {
      type: "sample.feedback",
      source: "human",
      owner: "agent:sample-owner",
      target: { appId: "sample", taskId: "work/registered-executor" },
      data: { instruction: "include this review" },
    } as AgentEvent;
    bus.emit(feedback);

    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    config.resourceStore = AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")!;
    const deadline = Date.now() + 2_000;
    while (!readTaskState(config).receipts?.["work/registered-executor"] && Date.now() < deadline) {
      await Bun.sleep(5);
    }
    expect(calls).toBe(1);
    expect(sawLiveFeedback).toBeTrue();
    expect(published).toHaveLength(1);
    expect(readTaskState(config).receipts?.["work/registered-executor"]).toMatchObject({
      handler: "executor:reviewer",
      executor: "reviewer",
      summary: "Registered executor completed the Task",
      evidence: ["test:reviewer:1"],
    });
  });

  it("starts new work from a reloaded definition while an old attempt is still running", async () => {
    const f = fixture();
    const bus = eventBus();
    const started: string[] = [];
    let releaseOld = () => {};
    const oldBlocked = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    const app = definition();
    const concurrentApp = {
      ...app,
      tasks: { ...app.tasks!, maxConcurrent: 2 },
    } as AppDefinition;
    const runtimeOptions = {
      ...options(f, bus),
      stateProjectsRoot: join(f.root, "canonical-projects"),
      executors: {
        reviewer: async (attempt: Parameters<TaskExecutor>[0]) => {
          started.push(attempt.task.id);
          if (attempt.task.id === "work/before-reload") await oldBlocked;
          return { state: "converged" as const, summary: "done", evidence: ["test:reload"] };
        },
      },
    };

    const installedRelease = await installAppTaskRuntimes({
      ...runtimeOptions,
      appRegistrySnapshot: {
        id: "boot:stable-controller:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: concurrentApp }],
      },
    });
    expect(installedRelease.installed[0]?.stateAppDir).toBe(join(f.root, "canonical-projects", "sample.app"));

    const attach = (taskId: string) =>
      attachLoadedAppTask({
        bus,
        appDir: f.appDir,
        appId: "sample",
        attachment: {
          kind: "desired",
          intent: {
            id: taskId,
            parentId: "operations",
            outcome: `Run ${taskId}`,
            acceptance: ["Executor returns"],
            mode: "achieve",
            agent: "sample-owner",
            executor: "reviewer",
          },
        },
        idempotencyKey: `attach:${taskId}`,
        request: {
          id: `request:${taskId}`,
          source: { kind: "human", id: "operator" },
          input: { kind: "test", data: {} },
        },
      });

    await attach("work/before-reload");
    while (!started.includes("work/before-reload")) await Bun.sleep(1);

    await expect(
      installAppTaskRuntimes({
        ...runtimeOptions,
        appRegistrySnapshot: { id: "boot:stable-controller:remove", generation: 2, entries: [] },
      }),
    ).rejects.toThrow("Cannot remove App sample while it has unfinished Tasks");

    await installAppTaskRuntimes({
      ...runtimeOptions,
      appRegistrySnapshot: {
        id: "boot:stable-controller:2",
        generation: 3,
        entries: [{ appDir: f.appDir, definition: concurrentApp }],
      },
    });
    await attach("work/after-reload");

    const deadline = Date.now() + 1_000;
    while (!started.includes("work/after-reload") && Date.now() < deadline) await Bun.sleep(5);
    expect(started).toEqual(["work/before-reload", "work/after-reload"]);
    releaseOld();
  });

  it("lets a registered executor replace a built-in CLI adapter", async () => {
    const f = fixture();
    const bus = eventBus();
    let cliRequests = 0;
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "cli.task.requested") return;
      cliRequests += 1;
      return { accepted: true, by: "unexpected-cli-runner", route: "direct" };
    });
    let calls = 0;

    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        codex: async (attempt) => {
          calls += 1;
          expect(attempt.task.executor).toBe("codex");
          return {
            state: "converged",
            summary: "Replacement Codex adapter completed the Task",
            evidence: ["test:replacement-codex"],
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:replacement-executor",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/replacement-executor",
          parentId: "operations",
          outcome: "Use the Host-provided Codex adapter",
          acceptance: ["The replacement adapter returns evidence"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "codex",
        },
      },
      idempotencyKey: "attach:replacement-executor",
      request: {
        id: "request-replacement-executor",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    config.resourceStore = AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")!;
    const deadline = Date.now() + 2_000;
    while (!readTaskState(config).receipts?.["work/replacement-executor"] && Date.now() < deadline) {
      await Bun.sleep(5);
    }
    expect(calls).toBe(1);
    expect(cliRequests).toBe(0);
    expect(readTaskState(config).receipts?.["work/replacement-executor"]).toMatchObject({
      handler: "executor:codex",
      executor: "codex",
      summary: "Replacement Codex adapter completed the Task",
      evidence: ["test:replacement-codex"],
    });
  });

  it("coalesces an exact-task event storm into bounded fresh reconciliations", async () => {
    const f = fixture();
    const bus = eventBus();
    let nextEventId = 1;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
    });
    let calls = 0;
    const followUpBatchSizes: number[] = [];
    let releaseFirst = () => {};
    let announceFirst = () => {};
    const firstStarted = new Promise<void>((resolve) => {
      announceFirst = resolve;
    });
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        storm: async (attempt) => {
          calls += 1;
          if (calls === 1) {
            announceFirst();
            await firstBlocked;
          } else {
            followUpBatchSizes.push(
              attempt.events.items.filter((item) => item.event.type === "sample.feedback").length,
            );
          }
          return {
            state: "converged",
            summary: "Event storm was reconciled",
            evidence: [`test:storm:${calls}`],
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:event-storm",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/event-storm",
          parentId: "operations",
          outcome: "Reconcile every exact feedback event",
          acceptance: ["Every linked event is observed"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "storm",
        },
      },
      idempotencyKey: "attach:event-storm",
      request: {
        id: "request-event-storm",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    await firstStarted;
    const admissions = [];
    for (let index = 0; index < 64; index++) {
      const feedback = {
        type: "sample.feedback",
        source: "test",
        owner: "agent:sample-owner",
        target: { appId: "sample", taskId: "work/event-storm" },
        data: { index },
      } as AgentEvent;
      // Model the durable EventHub boundary: persistence assigns the row id
      // before the exact Task route links and wakes the owner.
      Object.defineProperty(feedback, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
      admissions.push(
        admitLoadedCanonicalAppTaskEvent({
          bus,
          appId: "sample",
          event: feedback,
          intent: null,
          targetedTaskId: "work/event-storm",
        }),
      );
    }
    releaseFirst();
    expect(admissions).toHaveLength(64);
    expect(admissions.every((admission) => admission?.accepted && admission.route === "direct")).toBeTrue();

    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    config.resourceStore = AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")!;
    const deadline = Date.now() + 3_000;
    while (!readTaskState(config).receipts?.["work/event-storm"] && Date.now() < deadline) await Bun.sleep(5);

    expect(calls).toBe(3);
    expect(followUpBatchSizes).toEqual([32, 32]);
    expect(readTaskState(config).receipts?.["work/event-storm"]).toMatchObject({
      handler: "executor:storm",
      summary: "Event storm was reconciled",
      evidence: ["test:storm:3"],
    });
  });

  it("admits a Codex CLI result through the same fenced Task lifecycle", async () => {
    const f = fixture();
    const bus = eventBus();
    let cliRequests = 0;
    const prompts: string[] = [];
    bus.subscribeDurableRoute((event) => {
      if (event.type !== "cli.task.requested") return;
      cliRequests += 1;
      const data = event.data;
      prompts.push(readFileSync(data.promptPath, "utf8"));
      writeFileSync(
        data.resultPath,
        JSON.stringify({ state: "converged", summary: "Codex completed the Task", evidence: ["test:codex"] }),
      );
      setImmediate(() => {
        if (cliRequests === 1) {
          const feedback = {
            type: "sample.feedback",
            source: "test",
            owner: "agent:sample-owner",
            target: { appId: "sample", taskId: "work/codex-executor" },
            data: { instruction: "include the late review" },
          } as AgentEvent;
          admitLoadedCanonicalAppTaskEvent({
            bus,
            appId: "sample",
            event: feedback,
            intent: null,
            targetedTaskId: "work/codex-executor",
          });
          bus.emit(feedback);
        }
        bus.emit({
          type: "cli.task.completed",
          source: "cli-task-runner",
          owner: data.sourceOwner,
          data: {
            taskId: data.taskId,
            tool: "codex",
            resultPath: data.resultPath,
            eventsPath: data.eventsPath,
            exitCode: 0,
            summary: "Codex completed the Task",
          },
        });
      });
      return { accepted: true, by: "test-cli-runner", route: "direct" };
    });
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:cli-executor",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/codex-executor",
          parentId: "operations",
          outcome: "Let Codex complete one bounded Task",
          acceptance: ["Codex returns admitted evidence"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "codex",
        },
      },
      idempotencyKey: "attach:codex-executor",
      request: {
        id: "request-codex-executor",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    config.resourceStore = AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")!;
    const deadline = Date.now() + 2_000;
    while (!readTaskState(config).receipts?.["work/codex-executor"] && Date.now() < deadline) await Bun.sleep(5);
    expect(cliRequests).toBe(2);
    expect(prompts[0]).toContain('"executor": "codex"');
    expect(prompts[1]).toContain("sample.feedback");
    expect(readTaskState(config).receipts?.["work/codex-executor"]).toMatchObject({
      handler: "executor:codex",
      executor: "codex",
      summary: "Codex completed the Task",
      evidence: expect.arrayContaining(["test:codex"]),
    });
  });

  it("keeps task admission durable while paused without starting reconciliation", async () => {
    const f = fixture();
    const bus = eventBus();
    const seedPath = join(f.appDir, "tasks", "seed.json");
    const seed = JSON.parse(await Bun.file(seedPath).text());
    const stateDir = join(f.appDir, ".state", "tasks");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      join(stateDir, "state.json"),
      `${JSON.stringify({ ...seed, project_lifecycle: "paused" }, null, 2)}\n`,
    );
    activateTaskResources(
      taskReconciliationConfig({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
      }),
      join(f.root, "state"),
    );
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:paused",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const request: Readonly<AppRequest> = {
      id: "request-paused",
      source: { kind: "human", id: "operator" },
      input: { kind: "sample", data: {} },
    };
    const attached = await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/paused-attachment",
          parentId: "operations",
          outcome: "Retain work while paused",
          acceptance: ["Work runs after resume"],
          mode: "achieve",
        },
      },
      idempotencyKey: "attach:paused",
      request,
    });
    expect(attached.taskId).toBe("work/paused-attachment");

    const largePayload = "x".repeat(128 * 1024);
    const event = {
      type: "sample.work",
      source: "test",
      owner: "agent:sample-owner",
      timestamp: 1_787_500_000_000,
      data: { itemId: "paused-event", payload: largePayload },
    } as AgentEvent;
    Object.defineProperty(event, EVENT_ROW_ID, { value: 42, configurable: true });
    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event,
        intent: {
          id: "work/paused-event",
          parentId: "operations",
          outcome: "Retain event work while paused",
          acceptance: ["Work runs after resume"],
          mode: "achieve",
        },
      }),
    ).toMatchObject({ accepted: true, route: "direct" });
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: attached.taskId })).toMatchObject({
      id: "work/paused-attachment",
      status: "pending",
    });
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: "work/paused-event" })).toMatchObject({
      id: "work/paused-event",
      status: "pending",
    });
    const persisted = readTaskState(
      taskReconciliationConfig({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        resourceStore: AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")!,
      }),
      { taskIds: ["work/paused-event"] },
    ).taskTriggers?.["work/paused-event"]?.event;
    expect(persisted).toMatchObject({
      type: "sample.work",
      eventId: 42,
      timestamp: 1_787_500_000_000,
      data: { itemId: "paused-event", payload: largePayload },
    });
    expect(persisted).not.toHaveProperty("payload");
    expect(JSON.stringify(persisted).split(largePayload).length - 1).toBe(1);
  });

  it("recovers one persisted terminal direct-agent result despite a fresh renewed lease", () => {
    const f = fixture();
    const persistDir = join(f.root, ".state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const intent = {
      id: "work/terminal",
      parentId: "operations",
      outcome: "Recover terminal owner result",
      acceptance: ["Result is applied once"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "auto",
      reason: "test",
      isAgentRunnable: () => true,
    });
    if (claim.kind !== "claimed") throw new Error("expected direct-agent claim");
    recordAppTaskAttemptSession(config, claim, "session-terminal");
    const attempt = readTaskState(config).attempts![claim.attemptId];
    expect(attempt.handler).toBe("agent:sample-owner");
    expect(Date.parse(attempt.lease!.expiresAt)).toBeGreaterThan(Date.now());

    mkdirSync(join(persistDir, "sessions", "session-terminal"), { recursive: true });
    writeFileSync(
      join(persistDir, "sessions", "session-terminal", "result.json"),
      JSON.stringify({
        status: "done",
        finishParams: {
          status: "success",
          result: {
            state: "waiting",
            summary: "one child remains",
            evidence: ["session:session-terminal"],
            actions: [
              {
                kind: "create-task",
                id: "work/terminal-child",
                parentId: intent.id,
                outcome: "Complete recovered child",
                acceptance: ["Child converges"],
              },
            ],
          },
        },
      }),
    );
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
    };
    expect(
      consumePersistedTerminalAgentResult({
        persistDir,
        config,
        descriptor,
        taskId: intent.id,
        sessionId: "session-terminal",
      }),
    ).toMatchObject({ state: "waiting", actionsApplied: ["created work/terminal-child"] });
    expect(
      consumePersistedTerminalAgentResult({
        persistDir,
        config,
        descriptor,
        taskId: intent.id,
        sessionId: "session-terminal",
      }),
    ).toBeNull();
    expect(readTaskState(config)).toMatchObject({
      resources: { [intent.id]: { status: { phase: "waiting" } } },
      attempts: { [claim.attemptId]: { state: "completed", sessionId: "session-terminal" } },
      tasks: { "work/terminal-child": { parent_id: intent.id } },
    });
  });

  it("rejects an invalid persisted terminal result without crashing recovery", () => {
    const f = fixture();
    const persistDir = join(f.root, ".state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const intent = {
      id: "work/invalid-terminal",
      parentId: "operations",
      outcome: "Recover safely",
      acceptance: ["Invalid terminal output is retried"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "auto",
      reason: "test",
      isAgentRunnable: () => true,
    });
    if (claim.kind !== "claimed") throw new Error("expected direct-agent claim");
    recordAppTaskAttemptSession(config, claim, "session-invalid-terminal");

    mkdirSync(join(persistDir, "sessions", "session-invalid-terminal"), { recursive: true });
    const duplicateAction = {
      kind: "create-task",
      id: "work/duplicate-child",
      parentId: intent.id,
      outcome: "Complete child",
      acceptance: ["Child converges"],
    };
    writeFileSync(
      join(persistDir, "sessions", "session-invalid-terminal", "result.json"),
      JSON.stringify({
        status: "done",
        finishParams: {
          status: "success",
          result: {
            state: "waiting",
            summary: "invalid duplicate actions",
            evidence: ["session:session-invalid-terminal"],
            actions: [duplicateAction, duplicateAction],
          },
        },
      }),
    );

    let rejection = "";
    expect(
      consumePersistedTerminalAgentResult({
        persistDir,
        config,
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: false,
        },
        taskId: intent.id,
        sessionId: "session-invalid-terminal",
        onRejected: (error) => {
          rejection = error instanceof Error ? error.message : String(error);
        },
      }),
    ).toBeNull();
    expect(rejection).toContain("multiple actions for work/duplicate-child");
    expect(readTaskState(config)).toMatchObject({
      resources: { [intent.id]: { status: { phase: "running" } } },
      attempts: { [claim.attemptId]: { state: "running", sessionId: "session-invalid-terminal" } },
    });
  });
});
