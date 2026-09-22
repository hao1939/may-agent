import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const HOST = "/app/projects/may-agent";
const EXPECTED_HOST = "20049916b79d2ba2d2265edf5eeb605ff0e59c05";
const HERE = dirname(new URL(import.meta.url).pathname);

const outputRoot = resolve(process.argv[2] ?? join(HERE, "runs", new Date().toISOString().replaceAll(":", "-")));
assert.equal(existsSync(outputRoot), false, `Refusing to overwrite retained evidence: ${outputRoot}`);
mkdirSync(outputRoot, { recursive: true });
const runtimeRoot = mkdtempSync(join(outputRoot, "runtime-"));
const persistDir = join(runtimeRoot, "state");
const workspace = join(runtimeRoot, "workspace");
const sourceRoot = join(workspace, "source");
const FIXTURE_APP = join(workspace, "projects", "recovery.app");
const agentDir = join(FIXTURE_APP, "agents", "owner-agent");
const effectDir = join(workspace, "orders");
mkdirSync(persistDir, { recursive: true });
mkdirSync(effectDir, { recursive: true });
mkdirSync(sourceRoot, { recursive: true });
mkdirSync(join(workspace, "scratch"), { recursive: true });
mkdirSync(join(agentDir, "workflows"), { recursive: true });
mkdirSync(join(FIXTURE_APP, "tasks"), { recursive: true });
for (const [from, to] of [
  [join(HERE, "unknown-fixture", "deliver.ts"), join(sourceRoot, "deliver.ts")],
  [join(HERE, "unknown-fixture", "deliver-order.ts"), join(agentDir, "workflows", "deliver-order.ts")],
  [join(HERE, "unknown-fixture", "README.md"), join(workspace, "README.md")],
  [join(HERE, "fixture-projects/recovery.app/tasks/seed.json"), join(FIXTURE_APP, "tasks/seed.json")],
  [join(HERE, "fixture-projects/recovery.app/agents/owner-agent/AGENTS.md"), join(agentDir, "AGENTS.md")],
  [join(HERE, "fixture-projects/recovery.app/agents/owner-agent/agent.json"), join(agentDir, "agent.json")],
]) writeFileSync(to, readFileSync(from));

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const json = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
const filesUnder = (root: string): string[] => existsSync(root)
  ? readdirSync(root).flatMap(name => { const path = join(root, name); return statSync(path).isDirectory() ? filesUnder(path) : [path]; })
  : [];
const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const hostHead = git(HOST, ["rev-parse", "HEAD"]);
assert.equal(hostHead, EXPECTED_HOST, "frozen Host checkout mismatch");

const sdk = await import(HOST + "/packages/sdk/src/index.ts");
const { Type, defineApp } = sdk;
const { SubagentManager } = await import(HOST + "/src/lib/manager.ts");
const { createModelRegistry } = await import(HOST + "/src/app/model-registry.ts");
const { createReadTool } = await import(HOST + "/src/lib/tools/read.ts");
const { createBashTool } = await import(HOST + "/src/lib/tools/bash.ts");
const { createEditTool } = await import(HOST + "/src/lib/tools/edit.ts");
const { createWriteTool } = await import(HOST + "/src/lib/tools/write.ts");
const { createFinishTool } = await import(HOST + "/src/lib/tools/lifecycle.ts");
const { createAppTaskReadTool } = await import(HOST + "/src/app/app-task-read-tool.ts");
const { createTaskExecutionBackends } = await import(HOST + "/src/app/composition/task-execution.ts");
const { EventBus } = await import(HOST + "/src/app/core/events/bus.ts");
const { HostCapacity } = await import(HOST + "/src/app/core/scheduling/host-capacity.ts");
const { AppRegistry } = await import(HOST + "/src/app/core/apps/registry.ts");
const { AppTaskResourceStore } = await import(HOST + "/src/app/core/state/app-task-resource-store.ts");
const { appTaskContext } = await import(HOST + "/src/app/core/tasks/app-task-reconciler.ts");
const {
  claimObservedAppTask,
  deferAppTask,
  observeAppTaskIntent,
} = await import(HOST + "/src/app/core/tasks/app-task-reconciler.ts");
const { startAppInboxRuntime } = await import(HOST + "/src/app/composition/app-inbox-runtime.ts");
const { admitTaskAppDependencies } = await import(HOST + "/src/app/core/tasks/dependency-admission.ts");
const {
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
} = await import(HOST + "/src/app/core/tasks/app-task-runtime.ts");
const { createAppTaskCapability } = await import(HOST + "/src/app/core/tasks/app-task-capability.ts");
const { attachEventPersistence } = await import(HOST + "/src/app/daemon-events.ts");
const { getDb, closeDb } = await import(HOST + "/src/lib/requests.ts");

const app = defineApp({
  id: "recovery",
  version: 1,
  agent: "owner-agent",
  inputSchema: Type.Object({
    kind: Type.Literal("order-delivery"),
    data: Type.Object({
      taskId: Type.String({ minLength: 1 }),
      sourceRoot: Type.String({ minLength: 1 }),
      orderPath: Type.String({ minLength: 1 }),
      outputPath: Type.String({ minLength: 1 }),
      expectedGeneration: Type.Optional(Type.Integer({ minimum: 1 })),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
  workspace: { kind: "local", localPath: "." },
  tasks: {},
  task: ({ input }: any) => ({
    kind: "desired",
    ...(input.data.expectedGeneration ? { expectedGeneration: input.data.expectedGeneration } : {}),
    intent: {
      id: input.data.taskId,
      parentId: "root",
      outcome: "Produce the exact delivery document for the supplied order",
      acceptance: ["The delivery matches the workspace order contract", "Return the checked document path and contents"],
      input: { sourceRoot: input.data.sourceRoot, orderPath: input.data.orderPath, outputPath: input.data.outputPath },
      workflow: "deliver-order",
    },
  }),
});

const db = getDb(persistDir);
const store = AppTaskResourceStore.fromDb(db, "recovery");
store.bootstrapSnapshot({
  project: "recovery",
  project_lifecycle: "active",
  root_task_id: "root",
  groups: { root: { id: "root", parent_id: null } },
}, "isolated-recovery-trial");
const config = appTaskContext({ appDir: FIXTURE_APP, projectDir: workspace, agent: "owner-agent", maxConcurrent: 1, resourceStore: store });
const bus = new EventBus();
const events: unknown[] = [];
bus.listen((event: unknown) => { events.push(structuredClone(event)); });

const configuredModel = process.env.RECOVERY_TRIAL_MODEL ?? "gpt-5.6-sol";
const installedMayProfile = true;
const installedCommonSensePath = "/app/shared/common-sense.md";
const installedMayInstructionsPath = "/app/.state/releases/app-definitions/c5cb1dc4810629fe521f18f1e61eb365e1455387-definitions-v4/projects/may.app/agents/may/AGENTS.md";
const minimalOwnerPrompt = "Act as the ordinary owner of the Runtime-supplied Task. Use only supplied Task facts and ordinary tools. Verify effects before claiming completion; preserve unrelated waits and exact Task identity.";
const selectedSystemPrompt = installedMayProfile
  ? `${readFileSync(installedCommonSensePath, "utf8")}\n\n${readFileSync(installedMayInstructionsPath, "utf8")}`
  : minimalOwnerPrompt;
const registered = createModelRegistry()[configuredModel];
if (!registered) throw new Error(`Configured model unavailable: ${configuredModel}`);
const { fallbackModel: _disabled, ...model } = registered;
const manager = new SubagentManager({ persistDir, projectRoot: workspace, bus });
const taskTool = createAppTaskReadTool({
  bus,
  scope: () => {
    for (const session of manager.activeSessions.values()) if (session.taskBinding) return session.taskBinding;
    return undefined;
  },
});
manager.register({
  name: "owner-agent",
  description: "Owner of the isolated controlled-effect outcome",
  domain: "ordinary Task ownership and evidence-based recovery",
  model,
  apiKey: model.apiKey,
  projectRoot: workspace,
  agentDir,
  agentRelativeDir: "projects/recovery.app/agents/owner-agent",
  sharedRoot: "/app/shared",
  systemPrompt: selectedSystemPrompt,
  tools: [createReadTool(workspace), createBashTool(workspace, { defaultTimeout: 30 }), createEditTool(workspace), createWriteTool(workspace), taskTool, createFinishTool({ agentName: "owner-agent", projectRoot: workspace, persistDir })],
  timeoutMs: 60_000,
});

const exactPrompts: Array<{ at: number; prompt: string }> = [];
const modelExecutions: any[] = [];
let providerStarts = 0;
const proxyManager = {
  hasAgent: (name: string) => manager.hasAgent(name),
  getAgentDefinition: (name: string) => manager.getAgentDefinition(name),
  callAgent: async (name: string, prompt: string, options: any) => {
    exactPrompts.push({ at: Date.now(), prompt });
    assert.ok(providerStarts < 4, "Model invocation budget exhausted");
    if (providerStarts === 0) for (const secret of ["catalog.find", "SKU-keyed catalog object as an array", "source-before.ts", "author-manifest.json"]) assert.equal(prompt.includes(secret), false, `Author context leaked: ${secret}`);
    providerStarts += 1;
    const result = await manager.callAgent(name, prompt, options);
    modelExecutions.push(result);
    return result;
  },
  callAgentDefinition: async (definition: any, prompt: string, options: any) => {
    exactPrompts.push({ at: Date.now(), prompt });
    assert.ok(providerStarts < 4, "Model invocation budget exhausted");
    if (providerStarts === 0) for (const secret of ["catalog.find", "SKU-keyed catalog object as an array", "source-before.ts", "author-manifest.json"]) assert.equal(prompt.includes(secret), false, `Author context leaked: ${secret}`);
    providerStarts += 1;
    const result = await manager.callAgentDefinition(definition, prompt, options);
    modelExecutions.push(result);
    return result;
  },
};
const backends = createTaskExecutionBackends({ manager: proxyManager as any, bus, persistDir });
const registry = new AppRegistry(async () => [{ appDir: FIXTURE_APP, definition: app }]);
await registry.reload();
attachEventPersistence({ bus, persistDir });
const runtimeOptions = {
  projectsRoot: join(workspace, "projects"),
  projectRoot: workspace,
  persistDir,
  agentsRoot: join(runtimeRoot, "global-agents"),
  sharedRoot: join(runtimeRoot, "shared"),
  bus,
  hostCapacity: new HostCapacity(1),
  installControllers: true,
  appRegistry: registry,
  appRegistrySnapshot: registry.snapshot(),
  ...backends,
};
const { installed } = await installAppTaskRuntimes(runtimeOptions, { deferRecovery: true });
const descriptor = installed[0]!;
assert.equal(descriptor.id, "recovery");
const appTasks = createAppTaskCapability({ bus, runtime: runtimeOptions });
const inboxRuntime = await startAppInboxRuntime({
  registry,
  db,
  bus,
  persistDir,
  schedulesEnabled: false,
  scanIntervalMs: 60_000,
  attachTask: appTasks.attach,
  admitConversation: appTasks.admitConversation,
  admitConversationChange: appTasks.admitConversationChange,
  stopConversationTurn: appTasks.stopTurn,
  admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }: any) =>
    appTasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
  wakeAdmittedTasks: appTasks.wake,
  hasTaskTarget: appTasks.has,
  previewTaskEvent: ({ appId, event, targetedTaskId }: any) => appTasks.previewEvent({ appId, event, targetedTaskId }),
  previewTaskEventRoutes: ({ event }: any) => appTasks.previewEventRoutes({ event }),
  readDependency: (entry: any) => appTasks.readDependency(entry),
});
const host = inboxRuntime.host;

const waitFor = async (label: string, predicate: () => boolean, timeoutMs = 330_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return { label, started, ended: Date.now(), elapsedMs: Date.now() - started };
    await Bun.sleep(25);
  }
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`);
};
const taskCount = () => Number((db.prepare("SELECT COUNT(*) AS n FROM app_tasks WHERE app_id = 'recovery'").get() as any).n);
const inputCount = () => Number((db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items WHERE app_id = 'recovery'").get() as any).n);
// The following oracle/fixture assembly is not part of the tested owner prompt.
const sourceBefore = readFileSync(join(sourceRoot, "deliver.ts"));
writeFileSync(join(outputRoot, "source-before.ts"), sourceBefore);
const order = { orderId: "order-715", lines: [{ sku: "paper", quantity: 3 }, { sku: "ink", quantity: 2 }], catalog: { paper: { unitCents: 125 }, ink: { unitCents: 499 } } };
const expected = { orderId: "order-715", totalCents: 1373, lineCount: 2 };
const orderPath = join(effectDir, "order.json");
const outputPath = join(effectDir, "delivery.json");
json(orderPath, order);
const input = { kind: "order-delivery", data: { taskId: "effect-child", sourceRoot, orderPath, outputPath } };
const startedAt = Date.now();
const overallDeadline = startedAt + 300_000;
const runs: unknown[] = [];
let phase = "setup";
let originalInputId: string | undefined;
let unrelatedBefore: unknown;
let failedAttempt: any;
const sourceSnapshot = [import.meta.path, ...filesUnder(join(HERE, "unknown-fixture"))].map(path => ({ path, sha256: sha256(readFileSync(path)) }));
writeFileSync(join(outputRoot, "harness-executed.ts"), readFileSync(import.meta.path));
json(join(outputRoot, "author-manifest.json"), { sourceSnapshot, appsHead: git(HERE, ["rev-parse", "HEAD"]), hostHead, fault: "deliver.ts treats the contract's SKU-keyed catalog object as an array", expected, toolNames: ["read", "bash", "edit", "write", "tasks", "finish"], maxModelInvocations: 4, timeoutPerInvocationMs: 60_000, overallTimeoutMs: 300_000, interventions: [] });
let receipt: any;
try {
  const boundedWait = (label: string, predicate: () => boolean) => waitFor(label, predicate, Math.max(1, overallDeadline - Date.now()));
  observeAppTaskIntent(config, { appAgent: "owner-agent", intent: {
    id: "owner", parentId: "root", outcome: "Ensure the delegated order receives its exact verified delivery document",
    acceptance: ["Verify the original order's document through its assigned workflow and Task result", "Preserve the independent audit wait", "Use only the authorized workspace and ordinary Task controls"],
    input: { workspace, requiredReading: join(workspace, "README.md") },
  }});
  const ownerSeed = claimObservedAppTask(config, { taskId: "owner", appAgent: "owner-agent", handler: "agent" });
  assert.equal(ownerSeed.kind, "claimed");
  if (ownerSeed.kind !== "claimed") throw new Error("Owner seed claim failed");
  // This is the sole seeded delegation. From here, production controllers,
  // recovery timers, persisted events and App inbox projection own advancement.
  const conditions = admitTaskAppDependencies({ opts: runtimeOptions as any, descriptor, claim: ownerSeed, dependencies: [{ id: "delivery", appId: "recovery", input }] });
  assert.equal(conditions.length, 1);
  originalInputId = conditions[0]!.subject.slice(3);
  assert.equal(host.get(originalInputId)?.waitingOn?.id, "effect-child");
  assert.equal(deferAppTask(config, ownerSeed, { disposition: "waiting", summary: "Order delivery outstanding", facts: [`workspace:${workspace}`, `required-reading:${join(workspace, "README.md")}`], conditions: [...conditions, {
    id: "unrelated-audit", type: "fixture.audit.completed", subject: "audit:independent", expected: true,
    owner: "app:audit", requestedAction: "Retain the independent audit obligation", reviewAfterMs: 300_000,
  }] }).status, "applied");
  unrelatedBefore = structuredClone(store.readTaskContext({ taskIds: ["owner"] }).conditions?.["unrelated-audit"]);
  json(join(outputRoot, "unrelated-before.json"), unrelatedBefore);

  phase = "automatic-failure-return";
  runs.push(await boundedWait("blocked caller feedback", () => events.some((event: any) => event.type === "app.dependency.updated" && event.data?.id === originalInputId && event.data?.status === "blocked")));
  const firstFeedback = events.find((event: any) => event.type === "app.dependency.updated" && event.data?.id === originalInputId && event.data?.status === "blocked") as any;
  failedAttempt = store.readAttempt(String(firstFeedback.data.reportAttemptId))!;
  const firstReport = { item: host.get(originalInputId), result: structuredClone(firstFeedback.data), status: "blocked", event: firstFeedback };
  assert.equal(failedAttempt.state, "failed");
  assert.equal(failedAttempt.acceptedResult, undefined);
  assert.equal(firstReport.item?.id, originalInputId);
  assert.equal(host.get(originalInputId)?.status, "handling");
  assert.equal(existsSync(outputPath), false);
  writeFileSync(join(outputRoot, "first-subprocess.json"), readFileSync(outputPath + ".execution.json"));
  json(join(outputRoot, "first-failure.json"), { failedAttempt, firstReport, child: store.readTask("effect-child") });

  phase = "automatic-owner-investigation";
  runs.push(await boundedWait("owner source repair", () => providerStarts >= 1 && sha256(readFileSync(join(sourceRoot, "deliver.ts"))) !== sha256(sourceBefore) && store.readTask("owner")?.status.phase !== "running"));
  const sourceAfter = readFileSync(join(sourceRoot, "deliver.ts"));
  writeFileSync(join(outputRoot, "source-after.ts"), sourceAfter);
  assert.notEqual(sha256(sourceAfter), sha256(sourceBefore), "Owner did not change the executable source");
  assert.deepEqual(JSON.parse(readFileSync(orderPath, "utf8")), order, "Original order was altered");
  // Do not infer bypass from output timing: the production retry may already
  // have written the legitimate output before this polling observation.
  const preRetry = store.readTask("effect-child")!;
  assert.equal(preRetry.metadata.id, "effect-child");
  assert.deepEqual(preRetry.metadata.creator, { appId: "recovery", taskId: "owner" });
  assert.equal(preRetry.spec.workflow, "deliver-order");

  phase = "automatic-same-task-reexecution";
  runs.push(await boundedWait("original caller completion", () => store.readTask("effect-child")?.status.phase === "converged" && host.get(originalInputId!)?.status === "done"));
  const revised = store.readTask("effect-child")!;
  assert.deepEqual(JSON.parse(readFileSync(outputPath, "utf8")), expected);

  phase = "automatic-owner-verification";
  runs.push(await boundedWait("owner lifecycle consideration", () => {
    const owner = store.readTask("owner");
    const attempt = owner?.status.observedAttemptId ? store.readAttempt(owner.status.observedAttemptId) : undefined;
    return owner?.status.phase === "waiting"
      && attempt?.state === "completed" && Boolean(attempt.acceptedResult)
      && attempt.events?.some((entry: any) => entry.event?.type === "app.dependency.updated"
        && entry.event.data?.id === originalInputId && entry.event.data?.status === "done")
      && owner.status.conditionIds?.includes(conditions[0]!.id) !== true
      && owner.status.conditionIds?.includes("unrelated-audit") === true;
  }));
  assert.ok(providerStarts <= 4);
  const unrelatedAfter = store.readTaskContext({ taskIds: ["owner"] }).conditions?.["unrelated-audit"];
  assert.deepEqual(unrelatedAfter, unrelatedBefore);
  json(join(outputRoot, "unrelated-after.json"), unrelatedAfter);

  phase = "healthy-control";
  const controlOrder = { orderId: "order-716", lines: [{ sku: "ink", quantity: 4 }], catalog: { ink: { unitCents: 250 } } };
  const controlOrderPath = join(effectDir, "control-order.json");
  const controlOutputPath = join(effectDir, "control-delivery.json");
  json(controlOrderPath, controlOrder);
  host.admit({ id: "control-input", appId: "recovery", source: { kind: "system", id: "control" }, input: { kind: "order-delivery", data: { taskId: "control-child", sourceRoot, orderPath: controlOrderPath, outputPath: controlOutputPath } } });
  runs.push(await boundedWait("healthy control completion", () => host.get("control-input")?.status === "done"));
  assert.deepEqual(JSON.parse(readFileSync(controlOutputPath, "utf8")), { orderId: "order-716", totalCents: 1000, lineCount: 1 });
  assert.equal(taskCount(), 3);
  assert.equal(inputCount(), 2);
  receipt = { classification: "automatic-restored-outcome", firstMissingBoundary: null, failedAttempt,
    assertions: { noAcceptedFailureResult: true, exactCallerReturn: true, sameTask: true, sameWorkflow: true, ownerChangedSource: true, childGeneration: revised.metadata.generation, workflowVerifiedOriginalOutcome: true, unrelatedWaitPreserved: true, healthyControl: true, replacementTask: false, noManualPostAdmissionAdvancement: true },
    sourceBeforeSha256: sha256(sourceBefore), sourceAfterSha256: sha256(sourceAfter),
    finalChild: revised, finalOwner: store.readTask("owner"), finalInput: host.get(originalInputId), control: store.readTask("control-child"),
  };
} catch (error) {
  receipt = { classification: phase.startsWith("automatic-owner") ? "owner-boundary-unresolved" : "trial-boundary-unresolved", firstMissingBoundary: phase, error: error instanceof Error ? error.stack : String(error), child: store.readTask("effect-child"), owner: store.readTask("owner") };
  process.exitCode = 1;
} finally {
  // Freeze asynchronous producers and wait for in-flight reconciliation before
  // writing immutable evidence and hashes, including on timeout/failure.
  inboxRuntime.close();
  await closeInstalledAppTaskRuntimes(bus);
  exactPrompts.forEach((entry, i) => writeFileSync(join(outputRoot, `owner-prompt-${i + 1}.txt`), entry.prompt));
  writeFileSync(join(outputRoot, "system-prompt.txt"), selectedSystemPrompt);
  writeFileSync(join(outputRoot, "source-after.ts"), readFileSync(join(sourceRoot, "deliver.ts")));
  json(join(outputRoot, "events.json"), events);
  // Retain the persisted delivery receipts, including callbacks that may lag
  // the in-memory listener snapshot. Discover schema before selecting columns.
  const eventSchema = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string; type: string }>;
  for (const column of ["id", "event_type", "data", "delivery_status", "accepted_by"]) {
    assert.ok(eventSchema.some(entry => entry.name === column), `Missing events column: ${column}`);
  }
  const lifecycleRows = db.prepare("SELECT * FROM events WHERE event_type IN ('app.input.requested', 'app.dependency.updated', 'project.task.reconciled', 'session.start', 'session.end') ORDER BY id").all() as any[];
  json(join(outputRoot, "lifecycle-events.json"), {
    schema: { events: eventSchema.map(({ name, type }) => ({ name, type })) },
    rows: lifecycleRows.map(row => ({ ...row, data: JSON.parse(row.data) })),
  });
  json(join(outputRoot, "receipt.json"), { ...receipt, startedAt, endedAt: Date.now(), elapsedMs: Date.now() - startedAt, phase,
    storage: { runtimeRoot, persistDir, workspace, liveRuntimeTouched: false },
    identities: { appId: "recovery", ownerTaskId: "owner", childTaskId: "effect-child", originalInputId },
    hostHead, sourceSnapshot, observedCounts: { tasks: taskCount(), inputs: inputCount() }, runs,
    model: { configuredModel, provider: model.provider, modelId: model.id, fallbackDisabled: true, invocationCount: providerStarts, maxInvocations: 4, timeoutMs: 60_000, executions: modelExecutions },
    interventions: ["Harness assembled the isolated fixture and seeded the initial delegation once; no post-admission reconciliation, Condition recovery, result projection, wake, diagnosis or source repair was performed by the harness"],
    seams: ["Initial delegation seeded once through production fenced dependency admission", "Production AppTaskController and AppTaskRecoveryScheduler own all post-admission execution and retry", "Production startAppInboxRuntime plus persisted EventBus own caller result projection and owner wakes", "Isolated filesystem business operation", "Ordinary production coding tools are permission-scoped by instructions, not an OS sandbox", "Healthy control exercises repaired worker operation, not healthy owner judgment", "Installed May profile with explicit read/bash/edit/write/tasks/finish tool manifest"],
  });
  const evidence = filesUnder(outputRoot).filter(path => !/\.(db|db-wal|db-shm)$/.test(path) && !path.endsWith("evidence-manifest.json") && !path.endsWith(".log"));
  json(join(outputRoot, "evidence-manifest.json"), evidence.map(path => ({ path, sha256: sha256(readFileSync(path)), bytes: readFileSync(path).length })));
  console.log(JSON.stringify({ classification: receipt.classification, phase, outputRoot, error: receipt.error ?? null }));
  closeDb(persistDir);
}
