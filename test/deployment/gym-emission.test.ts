import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./installation.js";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { AppTaskResourceStore } from "../../src/app/app-task-resource-store.js";
import { createAppTaskEmitter } from "../../src/app/app-task-emitter.js";
import { appTaskContext, renewAppTaskAttemptLease, type AppTaskClaim } from "../../src/app/app-task-reconciler.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import type { TaskTree } from "../../src/app/app-task-store.js";

const gymUrl = (path: string) => pathToFileURL(join(APP_ROOT, "projects/gym.app", path)).href;
const { taskForGymInput } = await import(gymUrl("app.ts"));
const { canonicalGymTestContext } = await import(gymUrl("agents/gym/workflows/lib/test-context.ts"));
const { regressionEmissionLocalKey, runRegression } = await import(gymUrl("agents/gym/workflows/regression-run.ts"));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function supportedGymAdmissionHarness() {
  const root = mkdtempSync(join(tmpdir(), "may-gym-admission-emitter-"));
  roots.push(root);
  const requestId = "app_scope_binding_golden_1";
  const admittedInput = {
    id: requestId,
    source: { kind: "system" as const, id: "golden-test" },
    input: {
      kind: "run-regression",
      data: {
        benchmark: "may-alignment",
        agent: "may",
        scenario: "may-align-proof-before-adopt",
        trials: 1,
      },
    },
  };
  const attachment = taskForGymInput(admittedInput);
  if (attachment.kind !== "desired") throw new Error("expected desired Gym task attachment");
  const intent = attachment.intent;
  const attemptId = "attempt-gym-scope-golden-1";
  const now = new Date().toISOString();
  const tree: TaskTree = {
    project: "gym",
    project_lifecycle: "paused",
    root_task_id: "gym-system",
    groups: {
      "gym-system": { id: "gym-system", parent_id: null },
      "regression-assurance": {
        id: "regression-assurance",
        parent_id: "gym-system",
      },
    },
    resources: {
      [intent.id]: {
        metadata: { id: intent.id, generation: 1, resourceVersion: 8 },
        spec: {
          outcome: intent.outcome,
          acceptance: intent.acceptance,
          parentId: intent.parentId,
          mode: intent.mode,
          workflow: intent.workflow,
          input: intent.input,
        },
        status: {
          observedGeneration: 0,
          phase: "running",
          currentAttemptId: attemptId,
          updatedAt: now,
        },
      },
    },
    attempts: {
      [attemptId]: {
        metadata: { id: attemptId, resourceVersion: 1 },
        taskId: intent.id,
        taskGeneration: 1,
        specHash: "gym-scope-golden-spec",
        owner: "gym",
        handler: "workflow:regression-run",
        runtimeId: "runtime-gym-scope-golden",
        state: "running",
        reason: "golden supported admission",
        startedAt: now,
        lease: {
          id: "lease-gym-scope-golden",
          version: 1,
          lastActivityAt: now,
          expiresAt: new Date(Date.now() - 1).toISOString(),
          runtimeId: "runtime-gym-scope-golden",
        },
      },
    },
    tasks: {},
  };
  const db = getDb(root);
  const store = AppTaskResourceStore.fromDb(db, "gym");
  store.bootstrapSnapshot(tree, "gym-scope-golden-revision", [intent.id]);
  store.setProjectLifecycle("active");
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const claim: AppTaskClaim = {
    kind: "claimed",
    taskId: intent.id,
    generation: 1,
    resourceVersion: 8,
    specHash: "gym-scope-golden-spec",
    attemptId,
    owner: "gym",
    handler: "workflow:regression-run",
    mode: "achieve",
    intent,
    events: [],
    eventsTruncated: false,
    declaredOutputPaths: [],
  };
  return { root, requestId, admittedInput, intent, attemptId, db, store, bus, claim };
}

describe("installed Gym admission contract", () => {
  it("carries one supported Gym admission through exact scope and a renewed terminal emission fence", async () => {
    const { root, requestId, admittedInput, intent, attemptId, db, store, bus, claim } = supportedGymAdmissionHarness();
    expect(admittedInput).toMatchObject({
      id: requestId,
      input: {
        kind: "run-regression",
        data: {
          benchmark: "may-alignment",
          agent: "may",
          scenario: "may-align-proof-before-adopt",
          trials: 1,
        },
      },
    });
    expect(intent).toMatchObject({
      id: "runtime/regression-run/app_scope_binding_golden_1-5ff43f0edf5508f9",
      workflow: "regression-run",
      input: {
        requestId,
        benchmark: "may-alignment",
        agent: "may",
        scenario: "may-align-proof-before-adopt",
        trials: 1,
      },
    });

    const appDir = join(root, "projects", "gym-scope-fence-test.app");
    const projectDir = join(root, "projects", "gym");
    mkdirSync(appDir, { recursive: true });
    const config = appTaskContext({
      appDir,
      projectDir,
      agent: "gym",
      maxConcurrent: 2,
      resourceStore: store,
    });
    expect(renewAppTaskAttemptLease(config, claim)).toBe(true);

    const emitter = createAppTaskEmitter({ bus, appId: "gym", claim });
    const runDir = join(projectDir, ".state", "benchmarks", "scope_golden");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, "manifest.json"),
      JSON.stringify({
        run_id: "scope_golden",
        benchmark: "may-alignment",
        agent: "may",
        scenarios: ["may-align-proof-before-adopt"],
        trials_per_scenario: 1,
        completed_at: "2026-08-25T00:00:00.000Z",
        trials: [
          {
            scenario: "may-align-proof-before-adopt",
            machine_verdict: "pass",
            label_status: "approved",
          },
        ],
      }),
    );
    const reconciliationTask = {
      appId: "gym",
      taskId: intent.id,
      generation: 1,
      resourceVersion: 8,
      owner: "gym",
      agent: "gym",
      mode: "achieve",
      outcome: intent.outcome,
      acceptance: intent.acceptance,
      input: intent.input,
      children: { live: [], completed: [] },
    };
    const ctx = canonicalGymTestContext({
      task: `## Reconciliation Task\n\n\`\`\`json\n${JSON.stringify(reconciliationTask, null, 2)}\n\`\`\``,
      projectsRoot: join(root, "projects"),
      emit: (event) => emitter.emit(String(event.localKey), event),
    });
    let observedCommand: string[] = [];
    const result = await runRegression(ctx, async (command) => {
      observedCommand = command;
      return { exitCode: 0, stdout: `${runDir}\n`, stderr: "" };
    });

    expect(result).toMatchObject({ status: "done" });
    expect(observedCommand).toEqual([
      "bun",
      "run",
      "loop",
      "--",
      "test",
      "--benchmark",
      "may-alignment",
      "--agent",
      "may",
      "--trials",
      "1",
      "--scenario",
      "may-align-proof-before-adopt",
    ]);
    const terminalKey = regressionEmissionLocalKey(ctx, "completed");
    expect(
      db
        .prepare(
          "SELECT event_type, task_id, attempt_id, data FROM events WHERE event_type = 'gym.regression.completed'",
        )
        .all()
        .map((row: any) => ({ ...row, data: JSON.parse(row.data) })),
    ).toEqual([
      expect.objectContaining({
        event_type: "gym.regression.completed",
        task_id: intent.id,
        attempt_id: attemptId,
        data: expect.objectContaining({
          run_id: "scope_golden",
          emission: {
            appId: "gym",
            taskId: intent.id,
            generation: 1,
            localKey: terminalKey,
          },
        }),
      }),
    ]);
  });

});
