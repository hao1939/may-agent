import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2]);
const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path));
const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const receipt = json(join(root, "receipt.json"));
const initial = json(join(root, "initial-receipt.json"));
const first = json(join(root, "first-failure.json"));
const workspace = receipt.storage.workspace;
const state = receipt.storage.persistDir;
const sessions = receipt.model.executions.map((r: any) => r.sessionId);
assert.equal(sessions.length, 2);
const transcripts = sessions.map((id: string) => read(join(state, "sessions", id, "session.jsonl")).trim().split("\n").map(JSON.parse));
const calls = (messages: any[]) => messages.flatMap(m => m.role === "assistant" ? (m.content ?? []).filter((c: any) => c.type === "toolCall") : []);
const successful = (messages: any[], call: any) => messages.some(m => m.role === "toolResult" && m.toolCallId === call.id && m.isError !== true);
const firstCalls = calls(transcripts[0]);
const finalCalls = calls(transcripts[1]);
const initialPrompt = read(join(root, "owner-prompt-1.txt"));
for (const secret of ["catalog.find", "SKU-keyed catalog object as an array", "source-before.ts", "author-manifest.json", "method-b"]) assert.equal(initialPrompt.includes(secret), false);
const sourcePath = join(workspace, "source/deliver.ts");
const outputPath = join(workspace, "orders/delivery.json");
for (const path of [sourcePath, outputPath + ".execution.json", join(workspace, "orders/order.json"), join(workspace, "README.md")]) {
  assert.ok(firstCalls.some((c: any) => c.name === "read" && c.arguments.path === path && successful(transcripts[0], c)), `Missing successful investigation read: ${path}`);
}
const edit = firstCalls.find((c: any) => c.name === "edit" && c.arguments.path === sourcePath);
assert.ok(edit && successful(transcripts[0], edit));
const editIndex = transcripts[0].findIndex((m: any) => (m.content ?? []).some((c: any) => c.type === "toolCall" && c.id === edit.id));
for (const path of [sourcePath, outputPath + ".execution.json", join(workspace, "orders/order.json"), join(workspace, "README.md")]) {
  const call = firstCalls.find((c: any) => c.name === "read" && c.arguments.path === path);
  assert.ok(transcripts[0].findIndex((m: any) => m.role === "toolResult" && m.toolCallId === call.id) < editIndex);
}
assert.equal(read(join(root, "source-before.ts")).replace(edit.arguments.oldText, edit.arguments.newText), read(join(root, "source-after.ts")));
assert.equal(hash(sourcePath), hash(join(root, "source-after.ts")));
assert.ok(firstCalls.some((c: any) => c.name === "bash" && c.arguments.command.includes("probe verified") && successful(transcripts[0], c)));
assert.ok(finalCalls.some((c: any) => c.name === "read" && c.arguments.path === outputPath && successful(transcripts[1], c)));
assert.ok(finalCalls.some((c: any) => c.name === "tasks" && c.arguments.action === "get" && c.arguments.taskId === "effect-child" && successful(transcripts[1], c)));
assert.equal(first.failedAttempt.state, "failed");
assert.equal(first.failedAttempt.acceptedResult, undefined);
assert.equal(first.firstReport.result.attemptId, first.failedAttempt.metadata.id);
assert.equal(first.firstReport.item.id, receipt.identities.originalInputId);
assert.equal(first.firstReport.status, "blocked");
assert.equal(receipt.finalInput.id, receipt.identities.originalInputId);
assert.equal(receipt.finalInput.status, "done");
assert.equal(receipt.finalChild.metadata.generation, 1);
assert.equal(receipt.finalChild.spec.workflow, "deliver-order");
assert.deepEqual(first.child.spec, receipt.finalChild.spec);
assert.deepEqual(json(join(root, "unrelated-before.json")), json(join(root, "unrelated-after.json")));
assert.deepEqual(receipt.finalOwner.status.conditionIds, ["unrelated-audit"]);
assert.deepEqual(json(outputPath), { orderId: "order-715", totalCents: 1373, lineCount: 2 });
assert.deepEqual(json(join(workspace, "orders/control-delivery.json")), { orderId: "order-716", totalCents: 1000, lineCount: 1 });
assert.equal(receipt.control.status.phase, "converged");
const workflowFiles = readdirSync(join(state, "workflow-runs")).map(id => join(state, "workflow-runs", id, "run.json"));
assert.equal(workflowFiles.length, 3);
const executions = workflowFiles.map(path => ({ path, sha256: hash(path), run: json(path) }));
const brokenRun = executions.find(e => e.run.attempt_id === first.failedAttempt.metadata.id)!.run;
assert.equal(brokenRun.status, "error");
assert.equal(brokenRun.result_payload, undefined);
for (const taskId of ["effect-child", "control-child"]) {
  const run = executions.find(e => e.run.task_id === taskId && e.run.status === "done")!.run;
  assert.equal(run.workflow, "deliver-order");
  assert.equal(run.task_generation, 1);
  assert.equal(run.entryContentHash, brokenRun.entryContentHash);
  assert.equal(run.result_payload.value.state, "converged");
}
const costs = transcripts.map((messages: any[], i: number) => ({ sessionId: sessions[i], assistantMessages: messages.filter(m => m.role === "assistant").length, totalTokens: messages.reduce((sum, m) => sum + (m.usage?.totalTokens ?? 0), 0), reportedCost: messages.reduce((sum, m) => sum + (m.usage?.cost?.total ?? 0), 0) }));
const files = ["receipt.json", "initial-receipt.json", "continuation-receipt.json", "first-failure.json", "first-subprocess.json", "owner-prompt-1.txt", "continuation-owner-prompt-1.txt", "system-prompt.txt", "source-before.ts", "source-after.ts", "unrelated-before.json", "unrelated-after.json"].map(name => ({ path: join(root, name), sha256: hash(join(root, name)) }));
const result = { verdict: "bounded-restoration-verified-with-harness-interventions", checks: ["initial context excludes diagnosis", "successful ordinary investigation reads precede exact model edit", "model edit accounts for complete source diff", "scratch probe then same Task workflow settlement", "exact failed attempt and caller input", "same generation and identical Task specification", "final owner inspected actual delivery and Task", "unrelated wait identical", "healthy control settled", "three workflow executions; no replacement Task"], costs, totalReportedCost: costs.reduce((sum: number, c: any) => sum + c.reportedCost, 0), elapsedToControlMs: receipt.runs.at(-1).ended - initial.startedAt, files, executions, limits: receipt.seams, interventions: receipt.interventions };
writeFileSync(join(root, "verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ verdict: result.verdict, checks: result.checks.length, totalReportedCost: result.totalReportedCost, elapsedToControlMs: result.elapsedToControlMs }));
