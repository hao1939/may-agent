/**
 * Tests for the checkpoint tool (Common Sense P3.5).
 *
 * Covers: writing checkpoints, reading back, per-agent latest pointer,
 * step counter, error handling, and JSONL append behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  createCheckpointTool,
  readCheckpoints,
  readLatestCheckpoint,
  readLatestCheckpointForAgent,
} from "../src/lib/tools/checkpoint.js";

const TEST_DIR = resolve(import.meta.dirname, ".test-checkpoint-state");

describe("checkpoint tool", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("writes a checkpoint and reads it back", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-001",
      agentName: "test-agent",
      persistDir: TEST_DIR,
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
    const entries = readCheckpoints(TEST_DIR, "sess-001");
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
      persistDir: TEST_DIR,
    });

    await tool.execute("tc1", { summary: "Step 1" });
    await tool.execute("tc2", { summary: "Step 2", data: { progress: 50 } });
    await tool.execute("tc3", { summary: "Step 3", data: { progress: 100 } });

    const entries = readCheckpoints(TEST_DIR, "sess-002");
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
      persistDir: TEST_DIR,
    });

    await tool.execute("tc1", { summary: "First" });
    await tool.execute("tc2", { summary: "Second" });

    const latest = readLatestCheckpoint(TEST_DIR, "sess-003");
    expect(latest).not.toBeNull();
    expect(latest!.summary).toBe("Second");
    expect(latest!.step).toBe(2);
  });

  it("readLatestCheckpointForAgent returns cross-session latest", async () => {
    // First session
    const tool1 = createCheckpointTool({
      sessionId: "sess-A",
      agentName: "agent-x",
      persistDir: TEST_DIR,
    });
    await tool1.execute("tc1", { summary: "Session A work" });

    // Second session (same agent)
    const tool2 = createCheckpointTool({
      sessionId: "sess-B",
      agentName: "agent-x",
      persistDir: TEST_DIR,
    });
    await tool2.execute("tc1", { summary: "Session B work" });

    // Latest for agent should be from session B
    const latest = readLatestCheckpointForAgent(TEST_DIR, "agent-x");
    expect(latest).not.toBeNull();
    expect(latest!.sessionId).toBe("sess-B");
    expect(latest!.summary).toBe("Session B work");
  });

  it("returns null for non-existent checkpoints", () => {
    expect(readCheckpoints(TEST_DIR, "nonexistent")).toEqual([]);
    expect(readLatestCheckpoint(TEST_DIR, "nonexistent")).toBeNull();
    expect(readLatestCheckpointForAgent(TEST_DIR, "nonexistent")).toBeNull();
  });

  it("rejects empty summary", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-err",
      agentName: "test-agent",
      persistDir: TEST_DIR,
    });

    const result = await tool.execute("tc1", { summary: "" });
    expect(result.content[0].text).toContain("error");

    // No file should be written
    const entries = readCheckpoints(TEST_DIR, "sess-err");
    expect(entries).toHaveLength(0);
  });

  it("works with data omitted", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-nodata",
      agentName: "test-agent",
      persistDir: TEST_DIR,
    });

    const result = await tool.execute("tc1", { summary: "No data checkpoint" });
    expect(result.content[0].text).toContain("Checkpoint #1 saved");

    const entries = readCheckpoints(TEST_DIR, "sess-nodata");
    expect(entries).toHaveLength(1);
    expect(entries[0].data).toEqual({});
  });

  it("supports function-based sessionId and agentName", async () => {
    const currentSession = "sess-dyn-1";
    const currentAgent = "agent-dyn";

    const tool = createCheckpointTool({
      sessionId: () => currentSession,
      agentName: () => currentAgent,
      persistDir: TEST_DIR,
    });

    await tool.execute("tc1", { summary: "Dynamic session" });

    const entries = readCheckpoints(TEST_DIR, "sess-dyn-1");
    expect(entries).toHaveLength(1);
    expect(entries[0].sessionId).toBe("sess-dyn-1");
    expect(entries[0].agentName).toBe("agent-dyn");
  });

  it("writes valid JSONL format", async () => {
    const tool = createCheckpointTool({
      sessionId: "sess-jsonl",
      agentName: "test-agent",
      persistDir: TEST_DIR,
    });

    await tool.execute("tc1", { summary: "Line 1" });
    await tool.execute("tc2", { summary: "Line 2" });

    const filePath = resolve(TEST_DIR, "checkpoints", "sess-jsonl.jsonl");
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
      persistDir: TEST_DIR,
    });

    const result = await tool.execute("tc1", {
      summary: "With data",
      data: { foo: 1, bar: "baz" },
    });

    expect(result.content[0].text).toContain("foo");
    expect(result.content[0].text).toContain("bar");
  });
});
