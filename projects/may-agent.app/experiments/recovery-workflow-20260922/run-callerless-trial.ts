import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Author-side assembly and oracle; never included in an agent prompt.
const HOST = "/app/projects/may-agent";
const HERE = dirname(import.meta.path);
const APPS = resolve(HERE, "../../../..");
const outputRoot = resolve(process.argv[2]);
const preflight = process.argv.includes("--preflight");
assert.equal(existsSync(outputRoot), false, "Evidence is immutable; choose a new output directory");
mkdirSync(outputRoot, { recursive: true });
const runtimeRoot = mkdtempSync(join(outputRoot, "runtime-"));
const persistDir = join(runtimeRoot, "state");
const workspace = join(runtimeRoot, "workspace");
const projectsRoot = join(workspace, "projects");
const sourceRoot = join(workspace, "source");
const socketPath = join(runtimeRoot, "control.sock");
const reportRoot = join(persistDir, "evaluation", "reports");
for (const path of [persistDir, sourceRoot, projectsRoot, join(workspace, "orders"), join(workspace, "scratch")]) mkdirSync(path, { recursive: true });
// Environment belongs only to this subprocess; no live allowance/state is read or reset.
process.env.MAY_PERSIST_DIR = persistDir;
process.env.MAY_CONTROL_SOCKET = socketPath;
process.env.EVALUATION_REPORT_ROOT = reportRoot;
process.env.EVALUATION_AUTO_REVIEW_ENABLED = "true";
delete process.env.EVALUATION_AUTO_REVIEW_REVIEWER;
delete process.env.EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS;
delete process.env.EVALUATION_ASSESSMENT_CALLS_PER_INTERVAL;
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const json = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const files = (p: string): string[] => existsSync(p) ? readdirSync(p).flatMap(n => { const f = join(p, n); return statSync(f).isDirectory() ? files(f) : [f]; }) : [];
const git = (p: string, args: string[]) => execFileSync("git", args, { cwd: p, encoding: "utf8" }).trim();
assert.equal(git(HOST, ["rev-parse", "HEAD"]), "20049916b79d2ba2d2265edf5eeb605ff0e59c05");
for (const id of ["evaluation", "may"]) cpSync(join(APPS, "projects", id + ".app"), join(projectsRoot, id + ".app"), { recursive: true, filter: p => !p.includes("/generated/") && !p.includes("/reports/") });
cpSync(join(APPS, "shared"), join(workspace, "shared"), { recursive: true });
symlinkSync("/app/node_modules", join(runtimeRoot, "node_modules"));
cpSync(join(HERE, "unknown-fixture", "deliver.ts"), join(sourceRoot, "deliver.ts"));
cpSync(join(HERE, "unknown-fixture", "README.md"), join(workspace, "README.md"));
const fixtureAppDir = join(projectsRoot, "recovery.app");
cpSync(join(HERE, "fixture-projects", "recovery.app"), fixtureAppDir, { recursive: true });
cpSync(join(HERE, "unknown-fixture", "deliver-order.ts"), join(fixtureAppDir, "agents/owner-agent/workflows/deliver-order.ts"));

const { Type, defineApp } = await import(HOST + "/packages/sdk/src/index.ts");
const { default: evaluation } = await import(join(projectsRoot, "evaluation.app/app.ts"));
const { default: may } = await import(join(projectsRoot, "may.app/app.ts"));
const { SubagentManager } = await import(HOST + "/src/lib/manager.ts");
const { createModelRegistry } = await import(HOST + "/src/app/model-registry.ts");
const { createReadTool } = await import(HOST + "/src/lib/tools/read.ts");
const { createBashTool } = await import(HOST + "/src/lib/tools/bash.ts");
const { createEditTool } = await import(HOST + "/src/lib/tools/edit.ts");
const { createWriteTool } = await import(HOST + "/src/lib/tools/write.ts");
const { createFinishTool } = await import(HOST + "/src/lib/tools/lifecycle.ts");
const { createWorkflowTool } = await import(HOST + "/src/lib/workflow-tool.ts");
const { buildRuntimeCtx } = await import(HOST + "/src/lib/runtime-ctx.ts");
const { createAppTaskReadTool } = await import(HOST + "/src/app/app-task-read-tool.ts");
const { createTaskExecutionBackends } = await import(HOST + "/src/app/composition/task-execution.ts");
const { EventBus } = await import(HOST + "/src/app/core/events/bus.ts");
const { HostCapacity } = await import(HOST + "/src/app/core/scheduling/host-capacity.ts");
const { AppRegistry } = await import(HOST + "/src/app/core/apps/registry.ts");
const { AppTaskResourceStore } = await import(HOST + "/src/app/core/state/app-task-resource-store.ts");
const { startAppInboxRuntime } = await import(HOST + "/src/app/composition/app-inbox-runtime.ts");
const { closeInstalledAppTaskRuntimes, installAppTaskRuntimes } = await import(HOST + "/src/app/core/tasks/app-task-runtime.ts");
const { createAppTaskCapability } = await import(HOST + "/src/app/core/tasks/app-task-capability.ts");
const { attachEventPersistence } = await import(HOST + "/src/app/daemon-events.ts");
const { getDb, closeDb } = await import(HOST + "/src/lib/requests.ts");
const { attachControlSocket } = await import(HOST + "/packages/control/src/server.ts");
const { HumanTaskService } = await import(HOST + "/src/app/human-task-service.ts");
const { getEventView } = await import(HOST + "/src/app/core/events/interface.ts");
const { createRuntimeAppRead } = await import(HOST + "/src/app/core/reads/app-read.ts");
const { sendPublicReadCommand } = await import(join(projectsRoot, "evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.ts"));

const fixture = defineApp({ id: "recovery", version: 1, agent: "owner-agent", workspace: { kind: "local", localPath: workspace },
  inputSchema: Type.Object({ kind: Type.Literal("order-delivery"), data: Type.Object({ taskId: Type.String(), sourceRoot: Type.String(), orderPath: Type.String(), outputPath: Type.String() }, { additionalProperties: false }) }),
  tasks: { maxConcurrent: 1 }, task: ({ input }: any) => ({ kind: "desired", intent: { id: input.data.taskId, parentId: "root", outcome: "Produce the exact delivery document for the supplied order", acceptance: ["Delivery matches the workspace order contract", "Return checked document path and contents"], input: { ...input.data, requiredReading: join(workspace, "README.md") }, workflow: "deliver-order" } }),
});
const db = getDb(persistDir);
const store = AppTaskResourceStore.fromDb(db, "recovery");
store.bootstrapSnapshot({ project: "recovery", project_lifecycle: "active", root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }, "isolated-callerless-trial");
const bus = new EventBus();
attachEventPersistence({ bus, persistDir });
const events: any[] = [];
bus.listen((e: any) => events.push(structuredClone(e)));
const manager = new SubagentManager({ persistDir, projectRoot: workspace, bus });
let invocationCount = 0;
const invocations: any[] = [];
const prompts: any[] = [];
const startedAt = Date.now();
const deadline = startedAt + 480_000;
const proxy: any = new Proxy(manager, { get(target, key) {
  if (key === "callAgent" || key === "callAgentDefinition") return async (who: any, prompt: string, options: any) => {
    const name = typeof who === "string" ? who : who.name;
    prompts.push({ name, prompt, options, at: Date.now() });
    assert.equal(preflight, false, "Preflight stops before paid judgment");
    assert.ok(invocationCount < 6 && Date.now() < deadline, "Trial invocation/time ceiling reached");
    if (invocationCount === 0) for (const secret of ["author-manifest.json", "source-before.ts"]) assert.equal(prompt.includes(secret), false, `Initial author diagnosis leaked: ${secret}`);
    const index = ++invocationCount;
    const result = await (target[key] as any).call(target, who, prompt, options);
    invocations.push({ index, name, result });
    return result;
  };
  const value = (target as any)[key]; return typeof value === "function" ? value.bind(target) : value;
}});
const taskTool = createAppTaskReadTool({ bus, scope: () => [...manager.activeSessions.values()].find((s: any) => s.taskBinding)?.taskBinding });
const configuredModel = "gpt-5.6-sol";
const { fallbackModel: _fallback, ...model } = createModelRegistry()[configuredModel];
const common = readFileSync("/app/shared/common-sense.md", "utf8");
const authority = `\n\nIsolated execution workspace: ${workspace}. All Tasks, evidence, public reads (${socketPath}) and reports (${reportRoot}) refer only to this fixture. Read ${join(workspace, "README.md")} for operation authority. You may inspect fixture runtime evidence at ${persistDir}, edit only ${sourceRoot}, and write probes only in ${join(workspace, "scratch")}. Do not write runtime stores, actual delivery outputs, orders, workflows, or files outside this workspace. No live systems, deployment, credentials, Telegram, network actions or installation changes. Source edits in the fixture are directly authorized; no production application is authorized. Use existing Task identities and ordinary controls. This grants no authority to revise another creator's Task. Other installed tools/skills may not be available; use the supplied tools.`;
for (const [name, id] of [["evaluator", "evaluation"], ["may", "may"], ["owner-agent", "recovery"]]) {
  const agentDir = join(projectsRoot, id + ".app/agents", name);
  const runtimeCtx = buildRuntimeCtx({ bus, persistDir, projectRoot: workspace, projectsRoot, agentsRoot: join(projectsRoot, id + ".app/agents"), sharedRoot: join(workspace, "shared"), agentName: name });
  const systemPrompt = common + "\n\n" + readFileSync(join(agentDir, "AGENTS.md"), "utf8") + authority;
  writeFileSync(join(outputRoot, `system-prompt-${name}.txt`), systemPrompt);
  manager.register({ name, description: `Installed ${name} profile in isolated fixture`, model, apiKey: model.apiKey, projectRoot: workspace, projectId: id, agentDir, agentRelativeDir: `projects/${id}.app/agents/${name}`, sharedRoot: join(workspace, "shared"), systemPrompt,
    tools: [createReadTool(workspace), createBashTool(workspace, { defaultTimeout: 30 }), createEditTool(workspace), createWriteTool(workspace), taskTool,
      createWorkflowTool({ manager: proxy, workflowDir: join(agentDir, "workflows"), persistDir, agentName: name, projectId: id, runtimeCtx, read: createRuntimeAppRead({ getDb: () => db } as any), executionPaths: { appDir: join(projectsRoot, id + ".app"), projectDir: workspace, workspaceDir: workspace } }),
      createFinishTool({ agentName: name, projectRoot: workspace, persistDir })], timeoutMs: 90_000 });
}
// Only storage/workspace configuration differs; mapping, subscriptions, task policy,
// workflow bodies, publication and conversation entry remain production definitions.
const registry = new AppRegistry(async () => [
  { appDir: fixtureAppDir, definition: fixture },
  { appDir: join(projectsRoot, "evaluation.app"), definition: evaluation },
  { appDir: join(projectsRoot, "may.app"), definition: { ...may, observers: [], workspace: { kind: "local", localPath: workspace } } },
]);
await registry.reload();
const backends = createTaskExecutionBackends({ manager: proxy, bus, persistDir });
const options = { projectsRoot, projectRoot: workspace, persistDir, agentsRoot: join(runtimeRoot, "agents"), sharedRoot: join(workspace, "shared"), bus, hostCapacity: new HostCapacity(1), installControllers: true, appRegistry: registry, appRegistrySnapshot: registry.snapshot(), ...backends };
await installAppTaskRuntimes(options, { deferRecovery: true });
const appTasks = createAppTaskCapability({ bus, runtime: options });
const inbox = await startAppInboxRuntime({ registry, db, bus, persistDir, schedulesEnabled: false, scanIntervalMs: 60_000,
  attachTask: appTasks.attach, admitConversation: appTasks.admitConversation, admitConversationChange: appTasks.admitConversationChange, stopConversationTurn: appTasks.stopTurn,
  admitTaskEvent: (a: any) => appTasks.admitEvent(a), wakeAdmittedTasks: appTasks.wake, hasTaskTarget: appTasks.has,
  previewTaskEvent: (a: any) => appTasks.previewEvent(a), previewTaskEventRoutes: (a: any) => appTasks.previewEventRoutes(a), readDependency: (a: any) => appTasks.readDependency(a),
});
const humanTasks = new HumanTaskService(db, registry);
const socket = await attachControlSocket({ socketPath, getSessionId: () => "isolated-callerless", getStatus: () => [], emitEvent: () => { throw Error("No raw event injection"); }, subscribeEvents: () => () => {}, agentName: "may", instance: "isolated-trial",
  listApps: (id: string) => humanTasks.listApps(id), listTasks: (o: any) => humanTasks.listTasks(o), getTask: (o: any) => humanTasks.getTask(o),
  listAppTasks: (appId: string, options: any) => appTasks.list({ appId, options }), getAppTask: (appId: string, taskId: string, options: any) => appTasks.get({ appId, taskId, options }), getEvent: (id: number) => getEventView(db, id),
});
const sourceBefore = readFileSync(join(sourceRoot, "deliver.ts"));
writeFileSync(join(outputRoot, "source-before.ts"), sourceBefore);
writeFileSync(join(outputRoot, "harness-executed.ts"), readFileSync(import.meta.path));
json(join(outputRoot, "author-manifest.json"), { appsHead: git(APPS, ["rev-parse", "HEAD"]), hostHead: git(HOST, ["rev-parse", "HEAD"]), harnessHash: hash(readFileSync(import.meta.path)), configuredModel, preflight, maxInvocations: 6, observationMs: 480_000, allowance: { interval: "profile default 86400000", calls: "default 1", reportRoot }, schedulesEnabled: false, capacity: 1, socketPath, sourceBeforeHash: hash(sourceBefore), fault: "catalog object treated as array", sourceHashes: files(projectsRoot).filter(p => /\.(ts|md|json)$/.test(p)).map(p => ({ path: p, sha256: hash(readFileSync(p)) })) });
const orderPath = join(workspace, "orders/original.json"), outputPath = join(workspace, "orders/delivery.json");
json(orderPath, { orderId: "order-715", lines: [{ sku: "paper", quantity: 3 }, { sku: "ink", quantity: 2 }], catalog: { paper: { unitCents: 125 }, ink: { unitCents: 499 } } });
const wait = async (predicate: () => boolean, until = deadline) => { while (Date.now() < until) { if (predicate()) return true; await Bun.sleep(50); } return false; };
let receipt: any = {};
try {
  const preflightReads = await sendPublicReadCommand({ type: "apps.list" });
  json(join(outputRoot, "preflight-public-read.json"), preflightReads);
  assert.ok(JSON.stringify(preflightReads).includes("evaluation"));
  // Healthy worker control uses the same faulty helper on the empty-order path;
  // no alternate repair implementation is introduced and its output is verified.
  const controlOrder = join(workspace, "orders/control.json"), controlOutput = join(workspace, "orders/control-delivery.json");
  json(controlOrder, { orderId: "control-empty", lines: [], catalog: {} });
  inbox.host.admit({ id: "healthy-input", appId: "recovery", source: { kind: "system", id: "healthy-control" }, input: { kind: "order-delivery", data: { taskId: "healthy-control", sourceRoot, orderPath: controlOrder, outputPath: controlOutput } } });
  assert.ok(await wait(() => inbox.host.get("healthy-input")?.status === "done", Date.now() + 30_000), "Healthy control failed");
  assert.deepEqual(JSON.parse(readFileSync(controlOutput, "utf8")), { orderId: "control-empty", totalCents: 0, lineCount: 0 });
  inbox.host.admit({ id: "original-input", appId: "recovery", source: { kind: "system", id: "callerless-original" }, input: { kind: "order-delivery", data: { taskId: "original-order", sourceRoot, orderPath, outputPath } } });
  assert.ok(await wait(() => events.some(e => e.type === "project.task.reconciled" && e.data?.taskId === "original-order"), Date.now() + 30_000), "Original did not settle");
  const failedEvent = events.find(e => e.type === "project.task.reconciled" && e.data?.taskId === "original-order");
  json(join(outputRoot, "first-failure-event.json"), failedEvent);
  json(join(outputRoot, "first-task.json"), store.readTask("original-order"));
  writeFileSync(join(outputRoot, "first-execution.json"), readFileSync(outputPath + ".execution.json"));
  json(join(outputRoot, "public-original.json"), await sendPublicReadCommand({ type: "task.get", appId: "recovery", taskId: "original-order" }));
  if (preflight) await wait(() => prompts.length > 0 || events.some(e => e.type === "project.task.reconciled" && e.data?.project === "evaluation"), Date.now() + 15_000);
  else await wait(() => {
    const published = events.some(e => e.type === "evaluation.task_report_published");
    const considered = events.some(e => e.type === "project.task.reconciled" && e.data?.project === "may");
    return published && considered && store.readTask("original-order")?.status.phase === "converged" && manager.activeSessions.size === 0;
  });
  const original = store.readTask("original-order");
  const published = events.filter(e => e.type === "evaluation.task_report_published");
  receipt = { classification: preflight ? "preflight-only" : original?.status.phase === "converged" ? "restored-needs-independent-verification" : "unresolved-route-or-judgment", original, originalInput: inbox.host.get("original-input"), healthy: store.readTask("healthy-control"), published, outputExists: existsSync(outputPath) };
} catch (error) { receipt = { classification: "harness-error", error: error instanceof Error ? error.stack : String(error) }; process.exitCode = 1; }
finally {
  inbox.close();
  await closeInstalledAppTaskRuntimes(bus);
  socket.close();
  writeFileSync(join(outputRoot, "source-after.ts"), readFileSync(join(sourceRoot, "deliver.ts")));
  prompts.forEach((p, i) => json(join(outputRoot, `prompt-${i + 1}.json`), p));
  json(join(outputRoot, "events.json"), events);
  const schemas: any = {}, rows: any = {};
  for (const table of ["events", "app_tasks", "app_task_attempts", "app_inbox_items", "workflow_runs", "sessions"]) {
    schemas[table] = db.prepare(`PRAGMA table_info(${table})`).all();
    if (schemas[table].length) rows[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  json(join(outputRoot, "runtime-snapshot.json"), { schemas, rows });
  json(join(outputRoot, "receipt.json"), { ...receipt, startedAt, endedAt: Date.now(), elapsedMs: Date.now() - startedAt, invocationCount, invocations, runtimeRoot, persistDir, workspace, socketPath, reportRoot, preflight, noManualPostAdmissionAdvancement: true });
  closeDb(persistDir);
  // Do not traverse the dependency symlink or hash the mutable SQLite/WAL files.
  const evidence = [...files(persistDir), ...files(workspace), ...readdirSync(outputRoot).map(n => join(outputRoot, n)).filter(p => statSync(p).isFile())].filter(p => !/\.(db|db-wal|db-shm)$/.test(p) && !p.endsWith("evidence-manifest.json"));
  json(join(outputRoot, "evidence-manifest.json"), [...new Set(evidence)].map(path => ({ path, sha256: hash(readFileSync(path)), bytes: readFileSync(path).length })));
  console.log(JSON.stringify({ ...receipt, invocationCount, elapsedMs: Date.now() - startedAt, outputRoot }));
}
