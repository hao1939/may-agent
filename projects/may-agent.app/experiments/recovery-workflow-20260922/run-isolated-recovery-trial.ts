import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const HOST = "/app/projects/may-agent";
const EXPECTED_HOST = "20049916b79d2ba2d2265edf5eeb605ff0e59c05";
const HERE = dirname(new URL(import.meta.url).pathname);
const FIXTURE_APP = join(HERE, "fixture-projects", "recovery.app");
const outputRoot = resolve(process.argv[2] ?? join(HERE, "runs", new Date().toISOString().replaceAll(":", "-")));
mkdirSync(outputRoot, { recursive: true });
const runtimeRoot = mkdtempSync(join(outputRoot, "runtime-"));
const persistDir = join(runtimeRoot, "state");
const effectDir = join(runtimeRoot, "effect");
mkdirSync(persistDir, { recursive: true });
mkdirSync(effectDir, { recursive: true });

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
const { createFinishTool } = await import(HOST + "/src/lib/tools/lifecycle.ts");
const { createAppTaskReadTool } = await import(HOST + "/src/app/app-task-read-tool.ts");
const { createTaskExecutionBackends } = await import(HOST + "/src/app/composition/task-execution.ts");
const { EventBus } = await import(HOST + "/src/app/core/events/bus.ts");
const { HostCapacity } = await import(HOST + "/src/app/core/scheduling/host-capacity.ts");
const { AppTaskResourceStore } = await import(HOST + "/src/app/core/state/app-task-resource-store.ts");
const { appTaskContext } = await import(HOST + "/src/app/core/tasks/app-task-reconciler.ts");
const {
  claimObservedAppTask,
  deferAppTask,
  observeAppTaskIntent,
} = await import(HOST + "/src/app/core/tasks/app-task-reconciler.ts");
const { admitTaskInput } = await import(HOST + "/src/app/core/state/inbox.ts");
const { AppInboxHost } = await import(HOST + "/src/app/core/inbox/app-inbox-host.ts");
const { appInputFeedbackEvent } = await import(HOST + "/src/app/core/inbox/input-result.ts");
const { admitTaskAppDependencies, recoverTaskConditions } = await import(HOST + "/src/app/core/tasks/dependency-admission.ts");
const {
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} = await import(HOST + "/src/app/core/tasks/app-task-runtime.ts");
const { createAppTaskCapability } = await import(HOST + "/src/app/core/tasks/app-task-capability.ts");
const { getDb, closeDb } = await import(HOST + "/src/lib/requests.ts");

const app = defineApp({
  id: "recovery",
  version: 1,
  agent: "owner-agent",
  inputSchema: Type.Object({
    kind: Type.Literal("controlled-effect"),
    data: Type.Object({
      taskId: Type.String({ minLength: 1 }),
      method: Type.Union([Type.Literal("method-a"), Type.Literal("method-b")]),
      fixtureRoot: Type.String({ minLength: 1 }),
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
      outcome: "Write exactly one delivery marker for the supplied order",
      acceptance: ["The marker count is exactly one", "Return the checked marker path and count"],
      input: { fixtureRoot: input.data.fixtureRoot, method: input.data.method },
      workflow: input.data.method === "method-a" ? "method-a" : "method-b",
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
const config = appTaskContext({ appDir: FIXTURE_APP, projectDir: HERE, agent: "owner-agent", maxConcurrent: 1, resourceStore: store });
const bus = new EventBus();
const events: unknown[] = [];
bus.listen((event: unknown) => { events.push(structuredClone(event)); });

const configuredModel = process.env.RECOVERY_TRIAL_MODEL ?? "gpt-5.6-sol";
const acknowledgmentLost = process.env.RECOVERY_TRIAL_ACK_LOST === "1";
const idempotentOperation = process.env.RECOVERY_TRIAL_IDEMPOTENT === "1";
const installedMayProfile = process.env.RECOVERY_TRIAL_PROFILE === "installed-may";
const installedCommonSensePath = "/app/shared/common-sense.md";
const installedMayInstructionsPath = "/app/.state/releases/app-definitions/c5cb1dc4810629fe521f18f1e61eb365e1455387-definitions-v4/projects/may.app/agents/may/AGENTS.md";
const minimalOwnerPrompt = "Act as the ordinary owner of the Runtime-supplied Task. Use only supplied Task facts and ordinary tools. Verify effects before claiming completion; preserve unrelated waits and exact Task identity.";
const selectedSystemPrompt = installedMayProfile
  ? `${readFileSync(installedCommonSensePath, "utf8")}\n\n${readFileSync(installedMayInstructionsPath, "utf8")}`
  : minimalOwnerPrompt;
const registered = createModelRegistry()[configuredModel];
if (!registered) throw new Error(`Configured model unavailable: ${configuredModel}`);
const { fallbackModel: _disabled, ...model } = registered;
const manager = new SubagentManager({ persistDir, projectRoot: HERE, bus });
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
  projectRoot: HERE,
  agentDir: join(FIXTURE_APP, "agents", "owner-agent"),
  agentRelativeDir: "fixture-projects/recovery.app/agents/owner-agent",
  sharedRoot: "/app/shared",
  systemPrompt: selectedSystemPrompt,
  tools: [createReadTool(HERE), taskTool, createFinishTool({ agentName: "owner-agent", projectRoot: HERE, persistDir })],
  timeoutMs: 180_000,
});

const exactPrompts: Array<{ at: number; prompt: string }> = [];
const modelExecutions: any[] = [];
let providerStarts = 0;
const proxyManager = {
  hasAgent: (name: string) => manager.hasAgent(name),
  getAgentDefinition: (name: string) => manager.getAgentDefinition(name),
  callAgent: async (name: string, prompt: string, options: any) => {
    exactPrompts.push({ at: Date.now(), prompt });
    providerStarts += 1;
    const result = await manager.callAgent(name, prompt, options);
    modelExecutions.push(result);
    return result;
  },
  callAgentDefinition: async (definition: any, prompt: string, options: any) => {
    exactPrompts.push({ at: Date.now(), prompt });
    providerStarts += 1;
    const result = await manager.callAgentDefinition(definition, prompt, options);
    modelExecutions.push(result);
    return result;
  },
};
const backends = createTaskExecutionBackends({ manager: proxyManager as any, bus, persistDir });
const runtimeOptions = {
  projectsRoot: join(HERE, "fixture-projects"),
  projectRoot: HERE,
  persistDir,
  agentsRoot: join(runtimeRoot, "global-agents"),
  sharedRoot: join(runtimeRoot, "shared"),
  bus,
  hostCapacity: new HostCapacity(1),
  installControllers: false,
  appRegistrySnapshot: { id: "isolated-recovery", generation: 1, entries: [{ appDir: FIXTURE_APP, definition: app }] },
  ...backends,
};
const { installed } = await installAppTaskRuntimes(runtimeOptions, { deferRecovery: true });
const descriptor = installed[0]!;
assert.equal(descriptor.id, "recovery");

const reports: unknown[] = [];
const host = new AppInboxHost({
  db,
  apps: [app],
  attachTask: (input: any) => admitTaskInput(config, input),
  readDependency: (input: any) => createAppTaskCapability({ bus }).readDependency({ ...input, appDir: FIXTURE_APP }),
  onRequestUpdated(item: any, result: any, status: string) {
    reports.push({ item: structuredClone(item), result: structuredClone(result), status });
    const event = appInputFeedbackEvent(item, result, status as any);
    if (event) bus.emit(event);
  },
});
bus.subscribe((event: any) => {
  if (event.type !== "app.input.requested" || event.data.appId !== "recovery") return;
  host.admit({
    id: String(event.data.requestId), appId: "recovery", targetTaskId: event.data.targetTaskId,
    source: event.data.source, input: event.data.input, idempotencyKey: String(event.data.idempotencyKey),
  });
  return { accepted: true, by: "isolated-app-inbox", route: "direct" };
});

const dispatch = () => ({ lane: "normal" as const, enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 });
const runTask = async (taskId: string) => {
  const started = Date.now();
  const sessions = await reconcileLoadedAppTaskOnce({ bus, appId: "recovery", taskId, dispatch: dispatch() });
  return { taskId, started, ended: Date.now(), elapsedMs: Date.now() - started, sessions };
};
const taskCount = () => Number((db.prepare("SELECT COUNT(*) AS n FROM app_tasks WHERE app_id = 'recovery'").get() as any).n);
const inputCount = () => Number((db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items WHERE app_id = 'recovery'").get() as any).n);
const effectCount = (root: string) => {
  const path = join(root, "effect.log");
  return { path, count: existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean).length : 0 };
};

const sourceFiles = [
  join(HERE, "implementation-map.md"),
  join(HERE, "run-isolated-recovery-trial.ts"),
  join(FIXTURE_APP, "tasks", "seed.json"),
  join(FIXTURE_APP, "agents", "owner-agent", "AGENTS.md"),
  join(FIXTURE_APP, "agents", "owner-agent", "agent.json"),
  join(FIXTURE_APP, "agents", "owner-agent", "workflows", "method-a.ts"),
  join(FIXTURE_APP, "agents", "owner-agent", "workflows", "method-b.ts"),
  ...(installedMayProfile ? [installedCommonSensePath, installedMayInstructionsPath] : []),
];
const sourceSnapshot = sourceFiles.map(path => ({ path, sha256: sha256(readFileSync(path)), bytes: readFileSync(path).length }));
const startedAt = Date.now();
let phase = "setup";
let failure: string | null = null;
const runs: unknown[] = [];
try {
  observeAppTaskIntent(config, { appAgent: "owner-agent", intent: {
    id: "owner", parentId: "root",
    outcome: "Ensure the delegated order produces exactly one delivery marker",
    acceptance: ["Check the delegated result against the order", "Use an available supported delivery method if the current assignment cannot complete", "Preserve the independent audit wait"],
  }});
  const ownerSeed = claimObservedAppTask(config, { taskId: "owner", appAgent: "owner-agent", handler: "agent" });
  assert.equal(ownerSeed.kind, "claimed");
  if (ownerSeed.kind !== "claimed") throw new Error("owner seed claim failed");
  phase = "dependency-admission";
  const dependencyConditions = admitTaskAppDependencies({
    opts: runtimeOptions as any,
    descriptor,
    claim: ownerSeed,
    dependencies: [{
      id: "delivery", appId: "recovery",
      input: { kind: "controlled-effect", data: { taskId: "effect-child", method: "method-a", fixtureRoot: effectDir } },
    }],
  });
  assert.equal(dependencyConditions.length, 1);
  const originalInputId = dependencyConditions[0]!.subject.slice("id:".length);
  assert.equal(host.get(originalInputId)?.waitingOn?.id, "effect-child");
  assert.deepEqual(store.readTask("effect-child")?.metadata.creator, { appId: "recovery", taskId: "owner" });
  assert.equal(deferAppTask(config, ownerSeed, {
    disposition: "waiting", summary: "Delivery remains outstanding", facts: ["order-root:" + effectDir], conditions: [
      ...dependencyConditions,
      {
        id: "unrelated-audit", type: "fixture.audit.completed", subject: "audit:independent", expected: true,
        owner: "app:audit", requestedAction: "Retain this independent audit obligation", reviewAfterMs: 300_000,
      },
    ],
  }).status, "applied");
  const unrelatedBefore = structuredClone(store.readTaskContext({ taskIds: ["owner"] }).conditions?.["unrelated-audit"]);

  phase = "broken-execution";
  runs.push(await runTask("effect-child"));
  await host.recoverTaskResults();
  const brokenTask = store.readTask("effect-child")!;
  const brokenAttemptId = (reports[0] as any)?.result?.attemptId;
  assert.ok(brokenAttemptId, "failure report must carry the exact attempt id");
  const brokenAttempt = store.readAttempt(brokenAttemptId)!;
  assert.equal(brokenAttempt.state, "failed");
  assert.equal(brokenAttempt.acceptedResult, undefined);
  const effectAfterFailure = effectCount(effectDir);
  assert.equal(effectAfterFailure.count, acknowledgmentLost ? 1 : 0);
  assert.equal(reports.length, 1);
  assert.equal((reports[0] as any).status, "blocked");
  const brokenInput = host.get(originalInputId)!;
  assert.equal(brokenInput.status, "handling");
  assert.equal((reports[0] as any).item.id, brokenInput.id);
  assert.deepEqual(recoverTaskConditions(runtimeOptions as any, descriptor, config, { conditionIds: [dependencyConditions[0]!.id] }), ["owner"]);

  phase = "owner-recovery";
  // The normal callback emits the exact blocked dependency event; the installed
  // router makes it available to the ordinary owner attempt.
  runs.push(await runTask("owner"));
  assert.ok(exactPrompts.length >= 1, "owner model was not invoked");
  exactPrompts.forEach((entry, index) => writeFileSync(join(outputRoot, `owner-prompt-${index + 1}.txt`), entry.prompt));

  let revised = store.readTask("effect-child")!;
  let restoredEffect = effectCount(effectDir);
  const ownerReadEffectByExecution = () => modelExecutions.map(result => {
    if (!result.sessionId) return false;
    const transcript = join(persistDir, "sessions", result.sessionId, "session.jsonl");
    if (!existsSync(transcript)) return false;
    const pending = new Set<string>();
    for (const line of readFileSync(transcript, "utf8").split("\n").filter(Boolean)) {
      const message = JSON.parse(line);
      for (const part of message.content ?? []) {
        if (part.type === "toolCall" && part.name === "read" && part.arguments?.path === effectAfterFailure.path) pending.add(part.id);
      }
      if (message.role === "toolResult" && pending.has(message.toolCallId) && message.isError !== true) return true;
    }
    return false;
  });
  const ownerInspectedEffectBeforeDecision = ownerReadEffectByExecution()[0] ?? false;
  if (acknowledgmentLost) {
    assert.equal(revised.metadata.id, "effect-child");
    assert.equal(restoredEffect.count, 1, "initial effect was not retained");
    phase = "acknowledgment-loss-followup-execution";
    runs.push(await runTask("effect-child"));
    await host.recoverTaskResults();
    restoredEffect = effectCount(effectDir);
    revised = store.readTask("effect-child")!;
    phase = "owner-final-consideration";
    const ownerWakes = recoverTaskConditions(runtimeOptions as any, descriptor, config, { conditionIds: [dependencyConditions[0]!.id] });
    if (ownerWakes.includes("owner")) {
      runs.push(await runTask("owner"));
      exactPrompts.slice(1).forEach((entry, index) => writeFileSync(join(outputRoot, `owner-prompt-${index + 2}.txt`), entry.prompt));
    }
  } else {
    assert.equal(revised.metadata.id, "effect-child");
    assert.equal(revised.metadata.generation, 2);
    assert.equal(revised.metadata.creator?.taskId, "owner");
    assert.equal(revised.spec.workflow, "method-b");
    assert.equal(restoredEffect.count, 0);

    phase = "healthy-revised-execution";
    runs.push(await runTask("effect-child"));
    await host.recoverTaskResults();
    revised = store.readTask("effect-child")!;
    restoredEffect = effectCount(effectDir);
    assert.equal(restoredEffect.count, 1);
    assert.equal(host.get(originalInputId)?.status, "done");
    assert.deepEqual(recoverTaskConditions(runtimeOptions as any, descriptor, config, { conditionIds: [dependencyConditions[0]!.id] }), ["owner"]);
    phase = "owner-final-consideration";
    runs.push(await runTask("owner"));
    assert.ok(exactPrompts.length >= 2, "owner did not receive a final-evidence attempt");
    exactPrompts.slice(1).forEach((entry, index) => writeFileSync(join(outputRoot, `owner-prompt-${index + 2}.txt`), entry.prompt));
  }
  const unrelatedAfter = structuredClone(store.readTaskContext({ taskIds: ["owner"] }).conditions?.["unrelated-audit"]);
  assert.deepEqual(unrelatedAfter, unrelatedBefore);

  phase = "healthy-control";
  const controlRoot = join(runtimeRoot, "control-effect");
  mkdirSync(controlRoot, { recursive: true });
  host.admit({ id: "control-input", appId: "recovery", source: { kind: "system", id: "control" }, input: {
    kind: "controlled-effect", data: { taskId: "control-child", method: "method-b", fixtureRoot: controlRoot },
  }});
  runs.push(await runTask("control-child"));
  await host.recoverTaskResults();
  assert.equal(effectCount(controlRoot).count, 1);
  assert.equal(host.get("control-input")?.status, "done");

  phase = "receipt";
  const workflowRuns = events.filter((event: any) => event.type === "handler.workflow_dispatched");
  const finalInput = host.get(originalInputId);
  const acceptedDelivery = reports.find((report: any) => report.item?.id === originalInputId && report.status === "done") as any;
  const inspectionByExecution = ownerReadEffectByExecution();
  const ownerInspectedEffectAfterRecovery = inspectionByExecution.slice(1).some(Boolean);
  json(join(outputRoot, "events.json"), events);
  json(join(outputRoot, "reports.json"), reports);
  const retainedEvidenceFiles = [
    ...exactPrompts.map((_entry, index) => join(outputRoot, `owner-prompt-${index + 1}.txt`)),
    join(outputRoot, "events.json"), join(outputRoot, "reports.json"),
    ...filesUnder(join(persistDir, "sessions")), ...filesUnder(join(persistDir, "workflow-runs")),
  ];
  const classification = acknowledgmentLost
    ? restoredEffect.count === 1 && revised.status.phase === "converged" ? "restored-outcome-no-duplicate" : restoredEffect.count > 1 ? "unsafe-duplicate-effect" : "safe-unresolved"
    : "restored-outcome";
  const receipt = {
    schemaVersion: 1,
    classification,
    scenario: acknowledgmentLost ? "effect-succeeded-acknowledgment-lost" : "failure-before-effect",
    startedAt, endedAt: Date.now(), elapsedMs: Date.now() - startedAt,
    source: { hostPath: HOST, hostHead, expectedHostHead: EXPECTED_HOST, hostStatus: git(HOST, ["status", "--porcelain=v1"]), capturedBeforeExecution: true, files: sourceSnapshot },
    storage: { temporaryRoot: runtimeRoot, persistDir, database: join(persistDir, "may.db"), liveRuntimeTouched: false, retainedCopy: outputRoot },
    identities: { ownerTaskId: "owner", childTaskId: "effect-child", originalInputId, controlTaskId: "control-child", controlInputId: "control-input" },
    assertions: {
      brokenThrewBeforeStructuredResult: brokenAttempt.state === "failed" && brokenAttempt.acceptedResult === undefined,
      firstReportCorrelated: (reports[0] as any).item.id === originalInputId && (reports[0] as any).status === "blocked",
      sameChildIdentity: revised.metadata.id === "effect-child",
      creatorAuthorizedRevision: revised.metadata.generation === 2 && revised.metadata.creator?.appId === "recovery" && revised.metadata.creator?.taskId === "owner",
      explicitWorkflowChangedByRevision: revised.metadata.generation === 2 && revised.spec.workflow === "method-b",
      configuredOperationGuard: acknowledgmentLost ? idempotentOperation : null,
      acceptedDeliveryReusedExistingEffect: acknowledgmentLost ? acceptedDelivery?.result?.result?.reused === true : null,
      finalInputStatus: finalInput?.status,
      finalChildGeneration: revised.metadata.generation,
      finalChildWorkflow: revised.spec.workflow,
      ownerInspectedEffectBeforeDecision: acknowledgmentLost ? ownerInspectedEffectBeforeDecision : null,
      ownerInspectedEffectAfterRecovery: acknowledgmentLost ? ownerInspectedEffectAfterRecovery : null,
      unrelatedConditionPreserved: JSON.stringify(unrelatedAfter) === JSON.stringify(unrelatedBefore),
      effectAfterFailureCount: effectAfterFailure.count,
      restoredEffectCount: restoredEffect.count,
      controlEffectCount: effectCount(controlRoot).count,
      noDuplicateEffects: restoredEffect.count === 1,
      inputCount: inputCount(), taskCount: taskCount(),
    },
    model: {
      configuredModel, provider: model.provider, modelId: model.id, fallbackDisabled: true,
      invocationCount: providerStarts, timeoutMs: 180_000,
      prompts: exactPrompts.map((entry, index) => ({ path: join(outputRoot, `owner-prompt-${index + 1}.txt`), sha256: sha256(entry.prompt), bytes: Buffer.byteLength(entry.prompt) })),
      executions: modelExecutions.map(result => ({ sessionId: result.sessionId, status: result.status, turnsUsed: result.turnsUsed, error: result.error ?? null, transcriptDir: result.sessionId ? join(persistDir, "sessions", result.sessionId) : null })),
    },
    attempts: { broken: brokenAttempt, revised: store.readTask("effect-child"), owner: store.readTask("owner"), control: store.readTask("control-child") },
    workflowRuns, reports, runs,
    effects: { restored: restoredEffect, control: effectCount(controlRoot) },
    evidence: {
      eventsPath: join(outputRoot, "events.json"), reportsPath: join(outputRoot, "reports.json"),
      runtimeSessionRoot: join(persistDir, "sessions"), workflowRunRoot: join(persistDir, "workflow-runs"),
      files: retainedEvidenceFiles.map(path => ({ path, sha256: sha256(readFileSync(path)), bytes: readFileSync(path).length })),
      note: "Session JSONL retains exact system/user prompts, tool calls/results, model token usage and cost metadata.",
    },
    promptSeparation: { repairInstructionInInitialPrompt: exactPrompts[0]!.prompt.includes("injected persistent workflow defect") || exactPrompts[0]!.prompt.includes("revise effect-child to method-b"), profile: installedMayProfile ? "installed May common-sense + role instructions" : "minimal-generic-owner (not installed May role)", systemPromptSha256: sha256(selectedSystemPrompt), systemPromptBytes: Buffer.byteLength(selectedSystemPrompt), note: "Owner receives production protocol, ordinary order outcome, Task facts, child/wait state and caller report; the harness adds no scenario diagnosis or prescribed repair step." },
    mockedBoundaries: ["The business effect is an append-only temporary effect.log count.", "method-a and method-b are deterministic fixture workflow bodies.", "Production dependency admission is seeded from a fenced owner claim; the initial delegation decision is not a model decision.", "The harness manually invokes one exact installed reconciliation at each observation point instead of running daemon scheduling; automatic wake latency is not proved."],
    productionBoundaries: ["AppInboxHost and admitTaskInput", "installed App Task runtime claim/reconciliation/settlement", "production workflow adapter and runWorkflowDirect", "failure settlement and exact report/answer projection", "SubagentManager provider call", "managed-agent prompt and finish admission", "ordinary read/tasks/finish tools", "creator-authorized tasks update"],
    humanIntervention: "Harness launch only; no intervention in the model attempt.",
  };
  assert.equal(receipt.promptSeparation.repairInstructionInInitialPrompt, false);
  json(join(outputRoot, "receipt.json"), receipt);
  const resultSummary = acknowledgmentLost
    ? `Method A wrote the marker and then threw before a structured result. The owner inspected that marker before its decision: ${ownerInspectedEffectBeforeDecision}; after operation-level recovery: ${ownerInspectedEffectAfterRecovery}. Its selected follow-up left ${restoredEffect.count} marker(s), and the clean method-B control left one. Final child generation/workflow: ${revised.metadata.generation}/${revised.spec.workflow}.`
    : "Method A threw before a structured result. The real owner model revised the same child to method B, and the revised run produced one marker, matching the clean method-B control. A final owner attempt considered the returned evidence.";
  writeFileSync(join(outputRoot, "REPORT.md"), `# Isolated persistent-workflow recovery trial\n\n**Result:** ${receipt.classification}.\n\n${resultSummary} The exact input received a blocked report through the production dependency return, and the independent \`unrelated-audit\` Condition remained byte-for-byte unchanged.\n\nPrimary receipt: \`${join(outputRoot, "receipt.json")}\`\nExact owner prompts: \`${outputRoot}/owner-prompt-*.txt\`\nRuntime transcripts and workflow runs: \`${persistDir}\`\n\nThe receipt identifies the exact agent profile, seeded initial dependency, and manual scheduling seam. It includes source/evidence hashes captured before execution. No live service or production database was touched.\n`);
  console.log(JSON.stringify({ status: receipt.classification, outputRoot, receipt: join(outputRoot, "receipt.json"), runtimeRoot }));
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
  json(join(outputRoot, "failed-run.json"), {
    classification: phase.startsWith("owner") ? "model-or-owner-boundary-failure" : "harness-failure",
    phase, failure, startedAt, endedAt: Date.now(), elapsedMs: Date.now() - startedAt,
    source: { hostHead, capturedBeforeExecution: true, files: sourceSnapshot },
    promptProfile: { installedMayProfile, systemPromptSha256: sha256(selectedSystemPrompt), systemPromptBytes: Buffer.byteLength(selectedSystemPrompt) },
    runtimeRoot, database: join(persistDir, "may.db"), events, reports, runs, exactPrompts,
    evidence: { sessionRoot: join(persistDir, "sessions"), workflowRunRoot: join(persistDir, "workflow-runs") },
    counts: { tasks: taskCount(), inputs: inputCount() },
  });
  console.error(failure);
  process.exitCode = 1;
} finally {
  host.close();
  await closeInstalledAppTaskRuntimes(bus);
  closeDb(persistDir);
  // Deliberately retain runtimeRoot for every success and failure; the receipt names it.
}
