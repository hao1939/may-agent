/**
 * End-to-end scenarios for the sub-agent system.
 * Runs against the real model proxy at localhost:4000.
 *
 * Usage: npx tsx test/scenarios.ts
 */

import { SubagentManager, createReadTool, createWriteTool, createExecTool } from "../src/lib/index.js";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getModel } from "@mariozechner/pi-ai";
import type { AgentEvent } from "@mariozechner/pi-agent-core";

const model = {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "claude-opus-4.6",
  baseUrl: "http://localhost:4000",
};

// ── Helpers ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

function makeManager() {
  const persistDir = mkdtempSync(join(tmpdir(), "may-scenario-"));
  return { manager: new SubagentManager({ persistDir }), persistDir };
}

// ── Scenario 1: Simple single agent ────────────────────────────────────

async function scenario1_singleAgent() {
  console.log("\n=== Scenario 1: Single agent, no tools ===");

  const { manager } = makeManager();

  manager.register({
    name: "helper",
    description: "Answers questions",
    domain: "qa",
    systemPrompt: "You are a helpful assistant. Keep responses to one sentence.",
    model,
    tools: [],
    apiKey: "not-needed",
  });

  const sid = manager.run("helper", "What is 7 * 8?");
  const result = await manager.waitFor(sid);

  assert(result.status === "done", `status is done (got: ${result.status})`);
  assert(result.lastAssistantText !== null, "got a response");
  assert(
    result.lastAssistantText!.includes("56"),
    `response mentions 56 (got: ${result.lastAssistantText?.slice(0, 100)})`,
  );
  assert(result.turnsUsed !== undefined && result.turnsUsed > 0, `turns used > 0 (got: ${result.turnsUsed})`);
}

// ── Scenario 2: Agent with exec tool ───────────────────────────────────

async function scenario2_agentWithExec() {
  console.log("\n=== Scenario 2: Agent with exec tool ===");

  const { manager, persistDir } = makeManager();
  const projectRoot = join(tmpdir(), "scenario2-project-" + Date.now());
  mkdtempSync(projectRoot + "-");

  manager.register({
    name: "runner",
    description: "Runs commands",
    domain: "ops",
    systemPrompt: "You are a command runner. When asked to run a command, use the exec tool. Keep responses short.",
    model,
    tools: [createExecTool({ cwd: "/tmp" })],
    apiKey: "not-needed",
  });

  const sid = manager.run("runner", "Run `echo hello_world` and tell me the output.");
  const result = await manager.waitFor(sid);

  assert(result.status === "done", `status is done (got: ${result.status}, error: ${result.error})`);
  assert(result.lastAssistantText?.includes("hello_world") ?? false, `response includes hello_world`);
}

// ── Scenario 3: Supervisor delegates to coder ──────────────────────────

async function scenario3_delegation() {
  console.log("\n=== Scenario 3: Supervisor delegates to coder ===");

  const { manager, persistDir } = makeManager();
  const workDir = mkdtempSync(join(tmpdir(), "scenario3-work-"));

  // Register coder — can write files
  manager.register({
    name: "coder",
    description: "Writes files",
    domain: "coding",
    systemPrompt: `You write files when asked. Your working directory is ${workDir}. Use the write tool to create files with absolute paths.`,
    model,
    tools: [createWriteTool(), createReadTool()],
    apiKey: "not-needed",
  });

  // Register supervisor — can only delegate
  manager.register({
    name: "supervisor",
    description: "Delegates to coder",
    domain: "supervision",
    systemPrompt:
      "You are a supervisor. You CANNOT write files yourself. " +
      'For any file-writing task, use agents.call("coder", task). ' +
      "After the call, report what the coder did.",
    model,
    tools: [manager.createAgentsTool()],
    apiKey: "not-needed",
  });

  const sid = manager.run(
    "supervisor",
    `Create a file at ${workDir}/greeting.txt containing "Hello from the sub-agent system!"`,
  );

  // Collect events
  const events: string[] = [];
  try {
    manager.subscribe(sid, (e: AgentEvent) => {
      if (e.type === "tool_execution_start") {
        events.push(`tool: ${e.toolName}`);
      }
    });
  } catch {
    // session may have already completed
  }

  const result = await manager.waitFor(sid);

  assert(result.status === "done", `supervisor status is done (got: ${result.status}, error: ${result.error})`);

  // Check the file was actually created
  const filePath = join(workDir, "greeting.txt");
  const fileExists = existsSync(filePath);
  assert(fileExists, `greeting.txt was created`);

  if (fileExists) {
    const content = readFileSync(filePath, "utf-8");
    assert(content.includes("Hello"), `file contains greeting (got: ${content.slice(0, 80)})`);
  }

  // Verify supervisor used the subagents tool
  assert(
    events.some((e) => e.includes("subagents")),
    `supervisor used subagents tool`,
  );

  rmSync(workDir, { recursive: true, force: true });
}

// ── Scenario 4: Status, progress, result after completion ──────────────

async function scenario4_lifecycle() {
  console.log("\n=== Scenario 4: Session lifecycle (status, progress, result) ===");

  const { manager } = makeManager();

  manager.register({
    name: "worker",
    description: "Does tasks",
    domain: "work",
    systemPrompt: "You are a worker. Answer questions briefly.",
    model,
    tools: [createExecTool({ cwd: "/tmp" })],
    apiKey: "not-needed",
  });

  const sid = manager.run("worker", "Run `date` and tell me today's date.");

  // Status should show running (might be fast though)
  const statusBefore = manager.status();
  // It might already be done, so just check the structure
  assert(Array.isArray(statusBefore), "status() returns an array");

  const result = await manager.waitFor(sid);
  assert(result.status === "done", `status is done (got: ${result.status})`);

  // After completion, session count should be 0 (removed from active)
  assert(manager.getSessionCount() === 0, `active session count is 0 after completion`);

  // progress() should still work (reads from archive)
  const messages = manager.progress(sid);
  assert(messages.length > 0, `progress() returns archived messages (got ${messages.length})`);

  // result() should still work (reads from archive)
  const archivedResult = manager.result(sid);
  assert(archivedResult.sessionId === sid, `result() returns correct sessionId from archive`);

  // waitFor() again should return the cached promise
  const result2 = await manager.waitFor(sid);
  assert(result2.sessionId === sid, `second waitFor() returns same result`);
}

// ── Scenario 5: Cancel a running session ───────────────────────────────

async function scenario5_cancel() {
  console.log("\n=== Scenario 5: Cancel a running session ===");

  const { manager } = makeManager();

  manager.register({
    name: "slow",
    description: "Slow worker",
    domain: "work",
    systemPrompt: "You are very thorough. When asked to count, count very slowly, one number per line, up to 1000.",
    model,
    tools: [],
    apiKey: "not-needed",
  });

  const sid = manager.run("slow", "Count from 1 to 1000, one per line.");

  // Give it a moment to start streaming
  await new Promise((r) => setTimeout(r, 2000));

  // Cancel
  manager.cancel(sid);

  const result = await manager.waitFor(sid);
  assert(
    result.status === "error" || result.status === "done",
    `status is error or done after cancel (got: ${result.status})`,
  );
}

// ── Scenario 6: Multiple concurrent sessions ──────────────────────────

async function scenario6_concurrent() {
  console.log("\n=== Scenario 6: Multiple concurrent sessions ===");

  const { manager } = makeManager();

  manager.register({
    name: "math",
    description: "Math helper",
    domain: "math",
    systemPrompt: "You answer math questions. Give just the number, nothing else.",
    model,
    tools: [],
    apiKey: "not-needed",
  });

  const s1 = manager.run("math", "What is 3 + 4?");
  const s2 = manager.run("math", "What is 10 * 10?");
  const s3 = manager.run("math", "What is 144 / 12?");

  assert(manager.getSessionCount() >= 1, `at least 1 active session (some may finish fast)`);

  const [r1, r2, r3] = await Promise.all([manager.waitFor(s1), manager.waitFor(s2), manager.waitFor(s3)]);

  assert(r1.status === "done", `session 1 done`);
  assert(r2.status === "done", `session 2 done`);
  assert(r3.status === "done", `session 3 done`);

  assert(r1.lastAssistantText?.includes("7") ?? false, `3+4=7 (got: ${r1.lastAssistantText?.slice(0, 50)})`);
  assert(r2.lastAssistantText?.includes("100") ?? false, `10*10=100 (got: ${r2.lastAssistantText?.slice(0, 50)})`);
  assert(r3.lastAssistantText?.includes("12") ?? false, `144/12=12 (got: ${r3.lastAssistantText?.slice(0, 50)})`);

  assert(manager.getSessionCount() === 0, `all sessions cleaned up`);
}

// ── Scenario 7: Event subscription ─────────────────────────────────────

async function scenario7_events() {
  console.log("\n=== Scenario 7: Event subscription ===");

  const { manager } = makeManager();

  manager.register({
    name: "talker",
    description: "Talks",
    domain: "chat",
    systemPrompt: "Say exactly: 'The quick brown fox jumps over the lazy dog.' Nothing else.",
    model,
    tools: [],
    apiKey: "not-needed",
  });

  const sid = manager.run("talker", "Say the pangram.");

  const eventTypes: string[] = [];
  let gotText = false;
  manager.subscribe(sid, (e: AgentEvent) => {
    if (!eventTypes.includes(e.type)) eventTypes.push(e.type);
    if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta") {
      gotText = true;
    }
  });

  await manager.waitFor(sid);

  assert(eventTypes.includes("message_start"), `received message_start event`);
  assert(eventTypes.includes("message_update"), `received message_update events`);
  assert(eventTypes.includes("message_end"), `received message_end event`);
  assert(gotText, `received text_delta in message_update`);
}

// ── (Scenario 8 removed: turn limit enforcement was removed) ──────────

// ── Scenario 9: Memory persistence across sessions ─────────────────────

async function scenario9_memory() {
  console.log("\n=== Scenario 9: Memory persists across sessions ===");

  const { manager, persistDir } = makeManager();

  manager.register({
    name: "rememberer",
    description: "Answers questions",
    domain: "qa",
    systemPrompt: "You are a helpful assistant. Keep responses short.",
    model,
    tools: [],
    apiKey: "not-needed",
  });

  // Run first session
  const s1 = manager.run("rememberer", "What color is the sky?");
  await manager.waitFor(s1);

  // Run second session
  const s2 = manager.run("rememberer", "What is 2+2?");
  await manager.waitFor(s2);

  // Check that memory entries exist
  const memPath = manager.getMemoryPath("rememberer");
  assert(existsSync(memPath), `memory file exists at ${memPath}`);

  const memContent = readFileSync(memPath, "utf-8");
  const lines = memContent.trim().split("\n").filter(Boolean);
  assert(lines.length >= 2, `at least 2 memory entries (got: ${lines.length})`);
}

// ── Scenario 10: Coder with read + write + exec ────────────────────────

async function scenario10_coderTools() {
  console.log("\n=== Scenario 10: Coder reads, writes, and executes ===");

  const { manager } = makeManager();
  const workDir = mkdtempSync(join(tmpdir(), "scenario10-"));

  // Pre-create a file for the coder to read
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(workDir, "input.txt"), "The answer is 42.\n");

  manager.register({
    name: "coder",
    description: "Reads, writes, and runs commands",
    domain: "coding",
    systemPrompt: `You are a coder. Your working directory is ${workDir}. Use absolute paths with that prefix.`,
    model,
    tools: [createReadTool(), createWriteTool(), createExecTool({ cwd: workDir })],
    apiKey: "not-needed",
  });

  const sid = manager.run(
    "coder",
    `Read the file ${workDir}/input.txt, then create a new file ${workDir}/output.txt that says "Confirmed: <content of input.txt>".`,
  );

  const result = await manager.waitFor(sid);
  assert(result.status === "done", `coder finished (got: ${result.status}, error: ${result.error})`);

  const outputPath = join(workDir, "output.txt");
  assert(existsSync(outputPath), `output.txt was created`);

  if (existsSync(outputPath)) {
    const content = readFileSync(outputPath, "utf-8");
    assert(content.includes("42"), `output.txt references 42 (got: ${content.slice(0, 100)})`);
  }

  rmSync(workDir, { recursive: true, force: true });
}

// ── Run all ────────────────────────────────────────────────────────────

console.log("Running sub-agent system scenarios...");

await scenario1_singleAgent();
await scenario2_agentWithExec();
await scenario3_delegation();
await scenario4_lifecycle();
await scenario5_cancel();
await scenario6_concurrent();
await scenario7_events();
await scenario9_memory();
await scenario10_coderTools();

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
