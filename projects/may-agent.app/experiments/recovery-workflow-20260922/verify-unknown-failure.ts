import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2]);
const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path));
const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const receipt = json(join(root, "receipt.json"));
const first = json(join(root, "first-failure.json"));
const events = json(join(root, "events.json"));
const workspace = receipt.storage.workspace;
const state = receipt.storage.persistDir;

assert.equal(receipt.classification, "automatic-restored-outcome");
assert.equal(receipt.hostHead, "20049916b79d2ba2d2265edf5eeb605ff0e59c05");
assert.equal(receipt.storage.liveRuntimeTouched, false);
assert.ok(receipt.elapsedMs <= 300_000);
assert.ok(receipt.model.invocationCount > 0 && receipt.model.invocationCount <= 4);
assert.equal(receipt.model.fallbackDisabled, true);
assert.equal(receipt.assertions.noManualPostAdmissionAdvancement, true);

const harness = read(resolve(import.meta.dir, "run-unknown-failure-trial.ts"));
for (const forbidden of ["reconcileLoadedAppTaskOnce(", "recoverTaskConditions(", "recoverTaskResults("]) {
  assert.equal(harness.includes(forbidden), false, `Harness manually advances recovery with ${forbidden}`);
}
assert.ok(harness.includes("installControllers: true"));
assert.ok(harness.includes("startAppInboxRuntime"));
assert.ok(harness.includes("attachEventPersistence"));

const sessions = receipt.model.executions.map((result: any) => result.sessionId);
assert.equal(new Set(sessions).size, sessions.length);
const transcripts = sessions.map((id: string) => read(join(state, "sessions", id, "session.jsonl")).trim().split("\n").map(JSON.parse));
const calls = (messages: any[]) => messages.flatMap(message => message.role === "assistant" ? (message.content ?? []).filter((entry: any) => entry.type === "toolCall") : []);
const successful = (messages: any[], call: any) => messages.some(message => message.role === "toolResult" && message.toolCallId === call.id && message.isError !== true);
const firstCalls = calls(transcripts[0]);
const finalCalls = calls(transcripts.at(-1));
const initialPrompt = read(join(root, "owner-prompt-1.txt"));
for (const secret of ["catalog.find", "SKU-keyed catalog object as an array", "source-before.ts", "author-manifest.json", "method-b"]) assert.equal(initialPrompt.includes(secret), false);

const sourcePath = join(workspace, "source/deliver.ts");
const outputPath = join(workspace, "orders/delivery.json");
for (const path of [outputPath + ".execution.json", join(workspace, "orders/order.json"), join(workspace, "README.md")]) {
  assert.ok(firstCalls.some((call: any) => call.name === "read" && call.arguments.path === path && successful(transcripts[0], call)), `Missing successful investigation read: ${path}`);
}
const sourceInspection = firstCalls.find((call: any) =>
  (call.name === "read" && call.arguments.path === sourcePath) ||
  (call.name === "bash" && String(call.arguments.command).includes(join(workspace, "source"))),
);
assert.ok(sourceInspection && successful(transcripts[0], sourceInspection), "Missing successful source inspection");
const edit = firstCalls.find((call: any) => call.name === "edit" && call.arguments.path === sourcePath);
assert.ok(edit && successful(transcripts[0], edit));
const editIndex = transcripts[0].findIndex((message: any) => (message.content ?? []).some((entry: any) => entry.type === "toolCall" && entry.id === edit.id));
for (const call of [
  sourceInspection,
  ...[outputPath + ".execution.json", join(workspace, "orders/order.json"), join(workspace, "README.md")].map(path => firstCalls.find((entry: any) => entry.name === "read" && entry.arguments.path === path)),
]) assert.ok(transcripts[0].findIndex((message: any) => message.role === "toolResult" && message.toolCallId === call.id) < editIndex);
assert.equal(read(join(root, "source-before.ts")).replace(edit.arguments.oldText, edit.arguments.newText), read(join(root, "source-after.ts")));
assert.equal(hash(sourcePath), hash(join(root, "source-after.ts")));
assert.ok(firstCalls.some((call: any) => call.name === "bash" && call.arguments.command.includes("scratch") && successful(transcripts[0], call)));
assert.ok(finalCalls.some((call: any) => call.name === "read" && call.arguments.path === outputPath && successful(transcripts.at(-1), call)));
assert.ok(finalCalls.some((call: any) => call.name === "tasks" && call.arguments.action === "get" && call.arguments.taskId === "effect-child" && successful(transcripts.at(-1), call)));

assert.equal(first.failedAttempt.state, "failed");
assert.equal(first.failedAttempt.acceptedResult, undefined);
assert.equal(first.firstReport.result.reportAttemptId, first.failedAttempt.metadata.id);
assert.equal(first.firstReport.item.id, receipt.identities.originalInputId);
assert.equal(first.firstReport.status, "blocked");
assert.equal(receipt.finalInput.id, receipt.identities.originalInputId);
assert.equal(receipt.finalInput.status, "done");
assert.equal(receipt.finalChild.metadata.generation, 1);
assert.equal(receipt.finalChild.spec.workflow, "deliver-order");
assert.deepEqual(first.child.spec, receipt.finalChild.spec);
assert.deepEqual(json(join(root, "unrelated-before.json")), json(join(root, "unrelated-after.json")));
assert.deepEqual(receipt.finalOwner.status.conditionIds, ["unrelated-audit"]);
// Owner result is free-form. Successful Task/output reads above prove consideration;
// the runtime's retained second prompt proves exact done-feedback delivery below.
const finalPrompt = read(join(root, `owner-prompt-${sessions.length}.txt`));
const finalEventBlock = finalPrompt.split("## New Events\n")[1]?.match(/```json\n([\s\S]*?)\n```/)?.[1];
assert.ok(finalEventBlock, "Missing final owner's retained event context");
assert.ok(JSON.parse(finalEventBlock).items.some((entry: any) => entry.event?.type === "app.dependency.updated"
  && entry.event.data?.id === receipt.identities.originalInputId && entry.event.data?.status === "done"));
assert.ok(receipt.finalOwner.status.observedAttemptId);
assert.equal(receipt.finalOwner.status.phase, "waiting");
assert.deepEqual(json(outputPath), { orderId: "order-715", totalCents: 1373, lineCount: 2 });
assert.deepEqual(json(join(workspace, "orders/control-delivery.json")), { orderId: "order-716", totalCents: 1000, lineCount: 1 });
assert.equal(receipt.control.status.phase, "converged");

const feedback = events.filter((event: any) => event.type === "app.dependency.updated" && event.data?.id === receipt.identities.originalInputId);
assert.deepEqual(feedback.map((event: any) => event.data.status), ["blocked", "done"]);
assert.equal(feedback[0].data.reportAttemptId, first.failedAttempt.metadata.id);
const lifecycle = json(join(root, "lifecycle-events.json")).rows;
const persistedFeedback = lifecycle.filter((event: any) => event.event_type === "app.dependency.updated" && event.data?.id === receipt.identities.originalInputId);
assert.deepEqual(persistedFeedback.map((event: any) => event.data.status), ["blocked", "done"]);
assert.ok(persistedFeedback.every((event: any) => event.delivery_status === "accepted" && event.accepted_by === "app-runtime:events:task:recovery/owner"));
const reconciled = events.filter((event: any) => event.type === "project.task.reconciled" && event.data?.taskId === "effect-child");
assert.deepEqual(reconciled.map((event: any) => event.data.disposition), ["retrying", "converged"]);
assert.equal(reconciled[0].data.attemptId, first.failedAttempt.metadata.id);
assert.equal(reconciled[1].data.attemptId, receipt.finalChild.status.observedAttemptId);

const workflowFiles = readdirSync(join(state, "workflow-runs")).map(id => join(state, "workflow-runs", id, "run.json"));
assert.equal(workflowFiles.length, 3);
const executions = workflowFiles.map(path => ({ path, sha256: hash(path), run: json(path) }));
const brokenRun = executions.find(entry => entry.run.attempt_id === first.failedAttempt.metadata.id)!.run;
assert.equal(brokenRun.status, "error");
assert.equal(brokenRun.result_payload, undefined);
for (const taskId of ["effect-child", "control-child"]) {
  const run = executions.find(entry => entry.run.task_id === taskId && entry.run.status === "done")!.run;
  assert.equal(run.workflow, "deliver-order");
  assert.equal(run.task_generation, 1);
  assert.equal(run.entryContentHash, brokenRun.entryContentHash);
  assert.equal(run.result_payload.value.state, "converged");
}

const executedHarness = join(root, "harness-executed.ts");
assert.equal(hash(executedHarness), receipt.sourceSnapshot[0].sha256);
const manifest = json(join(root, "evidence-manifest.json"));
// The manifest's repository source pointer is intentionally mutable after the
// run; compare its retained snapshot instead. Every generated artifact remains exact.
const generatedEvidence = manifest.filter((entry: any) => entry.path !== receipt.sourceSnapshot[0].path);
const mismatches = generatedEvidence.filter((entry: any) => hash(entry.path) !== entry.sha256 || readFileSync(entry.path).length !== entry.bytes);
assert.deepEqual(mismatches, []);
const costs = transcripts.map((messages: any[], index: number) => ({
  sessionId: sessions[index],
  assistantMessages: messages.filter(message => message.role === "assistant").length,
  totalTokens: messages.reduce((sum, message) => sum + (message.usage?.totalTokens ?? 0), 0),
  reportedCost: messages.reduce((sum, message) => sum + (message.usage?.cost?.total ?? 0), 0),
}));
const result = {
  verdict: "automatic-restoration-verified",
  checks: [
    "production controller/recovery scheduler installed",
    "persisted production inbox lifecycle used",
    "no forbidden post-admission advancement calls",
    "initial context excludes author diagnosis",
    "ordinary investigation reads precede the model-authored source edit",
    "failed workflow had no accepted result and exact blocked caller feedback",
    "same generation and workflow converged through automatic retry",
    "owner accepted attempt consumed successful child result",
    "unrelated wait remained identical",
    "fresh healthy control settled; generated manifest hashes and retained executed-harness snapshot match",
  ],
  costs,
  totalReportedCost: costs.reduce((sum: number, cost: any) => sum + cost.reportedCost, 0),
  elapsedMs: receipt.elapsedMs,
  events: { feedback: feedback.length, childReconciliations: reconciled.length },
  executions,
  limits: receipt.seams,
  interventions: receipt.interventions,
};
writeFileSync(join(root, "verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ verdict: result.verdict, checks: result.checks.length, modelInvocations: sessions.length, totalReportedCost: result.totalReportedCost, elapsedMs: result.elapsedMs }));
