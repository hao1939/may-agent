/**
 * Tests for the checkpoint tool (Common Sense P3.5).
 *
 * Covers: writing checkpoints, reading back, per-agent latest pointer,
 * step counter, error handling, and JSONL append behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { closeDb } from "../db/connection.js";
import {
  createCheckpointTool,
  readCheckpoints,
  readLatestCheckpoint,
  readLatestCheckpointForAgent,
} from "./checkpoint.js";

let persistDir: string;
let stateRoots: string[];

function freshStateRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "may-checkpoint-"));
  stateRoots.push(root);
  return root;
}

describe("checkpoint tool", () => {
  beforeEach(() => {
    stateRoots = [];
    persistDir = freshStateRoot();
  });

  afterEach(() => {
    for (const root of stateRoots) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the same session ID independent across fresh state roots", async () => {
    for (const stateRoot of [persistDir, freshStateRoot()]) {
      const tool = createCheckpointTool({ persistDir: stateRoot, sessionId: "same-session", agentName: "agent" });
      const result = await tool.execute("save", { summary: "First progress" });
      expect(result.content[0].text).toContain("Checkpoint #1 saved");
      expect(readCheckpoints(stateRoot, "same-session").map((entry) => entry.step)).toEqual([1]);
    }
  });

  it("continues persisted numbering through fresh processes and recreated tools", async () => {
    const options = { persistDir: persistDir, sessionId: "resumed", agentName: "agent" };
    const tool = createCheckpointTool(options);
    await tool.execute("first", { summary: "Before restart" });
    closeDb(persistDir);
    const child = Bun.spawn([process.execPath, "-e", `
      import { createCheckpointTool } from ${JSON.stringify(new URL("./checkpoint.ts", import.meta.url).href)};
      import { closeDb } from ${JSON.stringify(new URL("../db/connection.ts", import.meta.url).href)};
      const options = ${JSON.stringify(options)};
      const result = await createCheckpointTool(options).execute("second", { summary: "After restart" });
      closeDb(options.persistDir);
      console.log(result.content[0].text);
    `], { stdout: "pipe", stderr: "pipe", timeout: 10_000 });
    try {
      const [output, error, status] = await Promise.all([
        new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
      ]);
      expect({ error, status }).toEqual({ error: "", status: 0 });
      expect(output).toContain("Checkpoint #2 saved");
    } finally {
      if (child.exitCode === null) child.kill();
      await child.exited;
    }
    await createCheckpointTool(options).execute("third", { summary: "Recreated tool" });
    await tool.execute("fourth", { summary: "Original tool sees new evidence" });
    expect(readCheckpoints(persistDir, "resumed").map((entry) => entry.step)).toEqual([1, 2, 3, 4]);
    expect(readLatestCheckpointForAgent(persistDir, "agent")?.step).toBe(4);
  });

  it("numbers beyond retained history even if an old process reset its counter", async () => {
    const checkpointDir = resolve(persistDir, "checkpoints");
    mkdirSync(checkpointDir);
    const saved = { sessionId: "legacy", agentName: "agent", summary: "Saved", data: {}, timestamp: 1 };
    const history = [JSON.stringify({ ...saved, step: 5 }), JSON.stringify({ ...saved, step: 1 }), "malformed", ""];
    writeFileSync(resolve(checkpointDir, "legacy.jsonl"), history.join("\n"));
    const tool = createCheckpointTool({ persistDir: persistDir, sessionId: "legacy", agentName: "agent" });
    const result = await tool.execute("next", { summary: "Continue retained progress" });
    expect(result.content[0].text).toContain("Checkpoint #6 saved");
    expect(readCheckpoints(persistDir, "legacy").map((entry) => entry.step)).toEqual([5, 1, 6]);
  });

  it("does not consume a step when persistence fails", async () => {
    const path = resolve(persistDir, "checkpoints");
    writeFileSync(path, "Blocks directory creation");
    const tool = createCheckpointTool({ persistDir: persistDir, sessionId: "retry", agentName: "agent" });
    const failed = await tool.execute("failed", { summary: "Not saved" });
    expect(failed.content[0].text).toContain("checkpoint() error:");
    rmSync(path);
    const saved = await tool.execute("retry", { summary: "Now saved" });
    expect(saved.content[0].text).toContain("Checkpoint #1 saved");
    expect(readCheckpoints(persistDir, "retry").map((entry) => entry.step)).toEqual([1]);
  });

  it("writes a checkpoint and reads it back", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-001",
      agentName: "test-agent",
      persistDir: persistDir,
    });

    const result = await tool.execute("tc1", {
      summary: "Completed step 1",
      data: { filesModified: ["foo.ts"] },
    });

    // Tool should return success
    const text = result.content[0].text;
    expect(text).toContain("Checkpoint #1 saved");
    expect(text).toContain("Completed step 1");

    // Read back via helper
    const entries = readCheckpoints(persistDir, "sess-001");
    expect(entries).toHaveLength(1);
    expect(entries[0].summary).toBe("Completed step 1");
    expect(entries[0].agentName).toBe("test-agent");
    expect(entries[0].sessionId).toBe("sess-001");
    expect(entries[0].step).toBe(1);
    expect(entries[0].data).toEqual({ filesModified: ["foo.ts"] });
    expect(entries[0].timestamp).toBeGreaterThan(0);
  });

  it("appends multiple checkpoints in order", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-002",
      agentName: "test-agent",
      persistDir: persistDir,
    });

    await tool.execute("tc1", { summary: "Step 1" });
    await tool.execute("tc2", { summary: "Step 2", data: { progress: 50 } });
    await tool.execute("tc3", { summary: "Step 3", data: { progress: 100 } });

    const entries = readCheckpoints(persistDir, "sess-002");
    expect(entries).toHaveLength(3);
    expect(entries[0].step).toBe(1);
    expect(entries[1].step).toBe(2);
    expect(entries[2].step).toBe(3);
    expect(entries[2].summary).toBe("Step 3");
  });

  it("readLatestCheckpoint returns last entry", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-003",
      agentName: "test-agent",
      persistDir: persistDir,
    });

    await tool.execute("tc1", { summary: "First" });
    await tool.execute("tc2", { summary: "Second" });

    const latest = readLatestCheckpoint(persistDir, "sess-003");
    expect(latest).not.toBeNull();
    expect(latest!.summary).toBe("Second");
    expect(latest!.step).toBe(2);
  });

  it("readLatestCheckpointForAgent returns cross-session latest", async () => {
    // First session
    const tool1 = createCheckpointTool({
      sessionId: "sess-A",
      agentName: "agent-x",
      persistDir: persistDir,
    });
    await tool1.execute("tc1", { summary: "Session A work" });

    // Second session (same agent)
    const tool2 = createCheckpointTool({
      sessionId: "sess-B",
      agentName: "agent-x",
      persistDir: persistDir,
    });
    await tool2.execute("tc1", { summary: "Session B work" });

    // Latest for agent should be from session B
    const latest = readLatestCheckpointForAgent(persistDir, "agent-x");
    expect(latest).not.toBeNull();
    expect(latest!.sessionId).toBe("sess-B");
    expect(latest!.summary).toBe("Session B work");
  });

  it("returns null for non-existent checkpoints", () => {
    expect(readCheckpoints(persistDir, "nonexistent")).toEqual([]);
    expect(readLatestCheckpoint(persistDir, "nonexistent")).toBeNull();
    expect(readLatestCheckpointForAgent(persistDir, "nonexistent")).toBeNull();
  });

  it("rejects empty summary", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-err",
      agentName: "test-agent",
      persistDir: persistDir,
    });

    const result = await tool.execute("tc1", { summary: "" });
    expect(result.content[0].text).toContain("error");

    // No file should be written
    const entries = readCheckpoints(persistDir, "sess-err");
    expect(entries).toHaveLength(0);
  });

  it("works with data omitted", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-nodata",
      agentName: "test-agent",
      persistDir: persistDir,
    });

    const result = await tool.execute("tc1", { summary: "No data checkpoint" });
    expect(result.content[0].text).toContain("Checkpoint #1 saved");

    const entries = readCheckpoints(persistDir, "sess-nodata");
    expect(entries).toHaveLength(1);
    expect(entries[0].data).toEqual({});
  });

  it("supports function-based sessionId and agentName", async () => {
    let currentSession = "sess-dyn-1";
    let currentAgent = "agent-dyn";

    const tool = createCheckpointTool({
      sessionId: () => currentSession,
      agentName: () => currentAgent,
      persistDir: persistDir,
    });

    await tool.execute("tc1", { summary: "Dynamic session" });

    const entries = readCheckpoints(persistDir, "sess-dyn-1");
    expect(entries).toHaveLength(1);
    expect(entries[0].sessionId).toBe("sess-dyn-1");
    expect(entries[0].agentName).toBe("agent-dyn");
    currentSession = "sess-dyn-2";
    currentAgent = "another-agent";
    await tool.execute("tc2", { summary: "New session" });
    expect(readLatestCheckpoint(persistDir, currentSession)).toMatchObject({ step: 1, agentName: currentAgent });
    currentSession = "sess-dyn-1";
    currentAgent = "agent-dyn";
    await tool.execute("tc3", { summary: "Back to original session" });
    expect(readCheckpoints(persistDir, currentSession).map((entry) => entry.step)).toEqual([1, 2]);
  });

  it("writes valid JSONL format", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-jsonl",
      agentName: "test-agent",
      persistDir: persistDir,
    });

    await tool.execute("tc1", { summary: "Line 1" });
    await tool.execute("tc2", { summary: "Line 2" });

    const filePath = resolve(persistDir, "checkpoints", "sess-jsonl.jsonl");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("data keys appear in response", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-keys",
      agentName: "test-agent",
      persistDir: persistDir,
    });

    const result = await tool.execute("tc1", {
      summary: "With data",
      data: { foo: 1, bar: "baz" },
    });

    expect(result.content[0].text).toContain("foo");
    expect(result.content[0].text).toContain("bar");
  });
});
