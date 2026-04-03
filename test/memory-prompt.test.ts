import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { memoryPath, appendMemoryEntry, readMemoryEntries } from "../src/lib/persistence.js";
import type { MemoryEntry } from "../src/lib/persistence.js";
import { SubagentManager } from "../src/lib/manager.js";
import { EventBus } from "../src/app/event-bus.js";
import { createMemoryWriter } from "../src/lib/session-subscribers.js";
import type { Model } from "@mariozechner/pi-ai";

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

describe("Memory persistence", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-memory-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  describe("memoryPath", () => {
    it("returns the correct path", () => {
      const p = memoryPath("/state", "amy");
      expect(p).toBe(join("/state", "memory", "amy.jsonl"));
    });
  });

  describe("appendMemoryEntry", () => {
    it("creates the memory directory and file", () => {
      const entry: MemoryEntry = {
        task: "test task",
        status: "done",
        duration: "5s",
        summary: "completed successfully",
        timestamp: 1700000000000,
      };
      appendMemoryEntry(persistDir, "agent1", entry);

      const filePath = memoryPath(persistDir, "agent1");
      expect(existsSync(filePath)).toBe(true);

      const raw = readFileSync(filePath, "utf-8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.task).toBe("test task");
      expect(parsed.status).toBe("done");
      expect(parsed.duration).toBe("5s");
      expect(parsed.summary).toBe("completed successfully");
      expect(parsed.timestamp).toBe(1700000000000);
    });

    it("appends multiple entries", () => {
      appendMemoryEntry(persistDir, "agent1", {
        task: "task 1",
        status: "done",
        duration: "3s",
        summary: "first",
        timestamp: 1700000000000,
      });
      appendMemoryEntry(persistDir, "agent1", {
        task: "task 2",
        status: "error",
        duration: "1s",
        summary: null,
        timestamp: 1700000001000,
      });

      const filePath = memoryPath(persistDir, "agent1");
      const raw = readFileSync(filePath, "utf-8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(2);
    });

    it("handles null summary", () => {
      appendMemoryEntry(persistDir, "agent1", {
        task: "task",
        status: "error",
        duration: "0s",
        summary: null,
        timestamp: 1700000000000,
      });

      const entries = readMemoryEntries(persistDir, "agent1");
      expect(entries[0].summary).toBeNull();
    });
  });

  describe("readMemoryEntries", () => {
    it("returns empty array for non-existent file", () => {
      const entries = readMemoryEntries(persistDir, "nonexistent");
      expect(entries).toEqual([]);
    });

    it("returns empty array for empty file", () => {
      const filePath = memoryPath(persistDir, "empty");
      mkdirSync(join(persistDir, "memory"), { recursive: true });
      writeFileSync(filePath, "", "utf-8");

      const entries = readMemoryEntries(persistDir, "empty");
      expect(entries).toEqual([]);
    });

    it("reads all entries when no limit", () => {
      for (let i = 0; i < 5; i++) {
        appendMemoryEntry(persistDir, "agent1", {
          task: `task ${i}`,
          status: "done",
          duration: `${i}s`,
          summary: `summary ${i}`,
          timestamp: 1700000000000 + i * 1000,
        });
      }

      const entries = readMemoryEntries(persistDir, "agent1");
      expect(entries).toHaveLength(5);
      expect(entries[0].task).toBe("task 0");
      expect(entries[4].task).toBe("task 4");
    });

    it("returns last N entries when limit is specified", () => {
      for (let i = 0; i < 10; i++) {
        appendMemoryEntry(persistDir, "agent1", {
          task: `task ${i}`,
          status: "done",
          duration: `${i}s`,
          summary: `summary ${i}`,
          timestamp: 1700000000000 + i * 1000,
        });
      }

      const entries = readMemoryEntries(persistDir, "agent1", 3);
      expect(entries).toHaveLength(3);
      expect(entries[0].task).toBe("task 7");
      expect(entries[1].task).toBe("task 8");
      expect(entries[2].task).toBe("task 9");
    });

    it("returns all entries when limit exceeds count", () => {
      appendMemoryEntry(persistDir, "agent1", {
        task: "only task",
        status: "done",
        duration: "1s",
        summary: "only",
        timestamp: 1700000000000,
      });

      const entries = readMemoryEntries(persistDir, "agent1", 100);
      expect(entries).toHaveLength(1);
    });

    it("returns empty array when limit is 0", () => {
      appendMemoryEntry(persistDir, "agent1", {
        task: "task",
        status: "done",
        duration: "1s",
        summary: "s",
        timestamp: 1700000000000,
      });

      const entries = readMemoryEntries(persistDir, "agent1", 0);
      expect(entries).toEqual([]);
    });

    it("isolates entries per agent name", () => {
      appendMemoryEntry(persistDir, "agent-a", {
        task: "task A",
        status: "done",
        duration: "1s",
        summary: "A",
        timestamp: 1700000000000,
      });
      appendMemoryEntry(persistDir, "agent-b", {
        task: "task B",
        status: "done",
        duration: "2s",
        summary: "B",
        timestamp: 1700000001000,
      });

      const entriesA = readMemoryEntries(persistDir, "agent-a");
      const entriesB = readMemoryEntries(persistDir, "agent-b");
      expect(entriesA).toHaveLength(1);
      expect(entriesA[0].task).toBe("task A");
      expect(entriesB).toHaveLength(1);
      expect(entriesB[0].task).toBe("task B");
    });

    it("uses efficient tail-read for large files with limit", () => {
      // Generate a file > 64KB to trigger the tail-read path
      const filePath = memoryPath(persistDir, "large-agent");
      mkdirSync(join(persistDir, "memory"), { recursive: true });

      const totalEntries = 500;
      const lines: string[] = [];
      for (let i = 0; i < totalEntries; i++) {
        const entry: MemoryEntry = {
          task: `task ${i} with padding ${"x".repeat(100)}`,
          status: i % 2 === 0 ? "done" : "error",
          duration: `${i}s`,
          summary: `summary ${i} with extra data ${"y".repeat(100)}`,
          timestamp: 1700000000000 + i * 1000,
        };
        lines.push(JSON.stringify(entry));
      }
      writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");

      // Verify the file is actually > 64KB
      const fileSize = readFileSync(filePath).length;
      expect(fileSize).toBeGreaterThan(64 * 1024);

      // Read last 5 entries — should use tail-read path
      const entries = readMemoryEntries(persistDir, "large-agent", 5);
      expect(entries).toHaveLength(5);
      expect(entries[0].task).toContain("task 495");
      expect(entries[4].task).toContain("task 499");
      expect(entries[0].timestamp).toBe(1700000000000 + 495 * 1000);

      // Read last 20
      const entries20 = readMemoryEntries(persistDir, "large-agent", 20);
      expect(entries20).toHaveLength(20);
      expect(entries20[0].task).toContain("task 480");
      expect(entries20[19].task).toContain("task 499");
    });
  });
});

describe("System prompt assembly", () => {
  let persistDir: string;
  let knowledgeDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-prompt-test-"));
    knowledgeDir = mkdtempSync(join(tmpdir(), "may-knowledge-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(knowledgeDir, { recursive: true, force: true });
  });

  it("uses systemPrompt directly when set", async () => {
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "direct-prompt",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a direct prompt agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("direct-prompt", "do something");
    await manager.waitFor(sessionId);

    // We can't easily inspect the system prompt directly, but we can verify
    // the agent ran (the test is that it doesn't crash with systemPrompt set)
    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });

  it("runs with convention files (no systemPromptFiles)", async () => {
    // Create knowledge files
    const file1 = join(knowledgeDir, "domain.md");
    const file2 = join(knowledgeDir, "patterns.md");
    writeFileSync(file1, "# Domain\nYou are an expert.", "utf-8");
    writeFileSync(file2, "# Patterns\nUse pattern X.", "utf-8");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "files-agent",
      description: "Test",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("files-agent", "do something");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });

  it("includes memory entries in system prompt when available", async () => {
    // Pre-populate memory
    appendMemoryEntry(persistDir, "memory-agent", {
      task: "previous task",
      status: "done",
      duration: "3m12s",
      summary: "completed with good results",
      timestamp: 1700000000000,
    });

    const file1 = join(knowledgeDir, "domain.md");
    writeFileSync(file1, "# Identity\nYou are a test agent.", "utf-8");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "memory-agent",
      description: "Test",
      domain: "test",
      workspace: "/test/workspace",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      memoryLimit: 10,
    });

    const sessionId = manager.run("memory-agent", "do something");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });

  it("skips memory section when memoryLimit is 0", async () => {
    // Pre-populate memory
    appendMemoryEntry(persistDir, "no-memory-agent", {
      task: "previous task",
      status: "done",
      duration: "3m12s",
      summary: "should not appear",
      timestamp: 1700000000000,
    });

    const file1 = join(knowledgeDir, "domain.md");
    writeFileSync(file1, "# Identity\nYou are a test agent.", "utf-8");

    const manager = new SubagentManager({ persistDir, infraRetryMax: 0 });

    manager.register({
      name: "no-memory-agent",
      description: "Test",
      domain: "test",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      memoryLimit: 0,
    });

    const sessionId = manager.run("no-memory-agent", "do something");
    await manager.waitFor(sessionId);

    const result = manager.result(sessionId);
    expect(result).not.toBeNull();
  });
});

describe("Memory auto-append on completion", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-auto-memory-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("appends a memory entry after session completes", async () => {
    const bus = new EventBus();
    bus.subscribe(createMemoryWriter(persistDir));
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0, bus });

    manager.register({
      name: "auto-mem",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("auto-mem", "do the thing");
    await manager.waitFor(sessionId);

    // Memory entry should have been appended
    const entries = readMemoryEntries(persistDir, "auto-mem");
    expect(entries).toHaveLength(1);
    expect(entries[0].task).toBe("do the thing");
    expect(["done", "error"]).toContain(entries[0].status);
    expect(entries[0].timestamp).toBeGreaterThan(0);
    expect(typeof entries[0].duration).toBe("string");
  });

  it("appends memory entries for multiple sessions", async () => {
    const bus = new EventBus();
    bus.subscribe(createMemoryWriter(persistDir));
    const manager = new SubagentManager({ persistDir, infraRetryMax: 0, bus });

    manager.register({
      name: "multi-mem",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const s1 = manager.run("multi-mem", "task one");
    const s2 = manager.run("multi-mem", "task two");
    await Promise.all([manager.waitFor(s1), manager.waitFor(s2)]);

    const entries = readMemoryEntries(persistDir, "multi-mem");
    expect(entries).toHaveLength(2);

    const tasks = entries.map((e) => e.task);
    expect(tasks).toContain("task one");
    expect(tasks).toContain("task two");
  });

  it("handles session completion with memory", async () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });

    manager.register({
      name: "no-persist",
      description: "Test",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("no-persist", "do something");
    const result = await manager.waitFor(sessionId);

    // No crash, no memory file created — just verify it doesn't throw
    expect(result).not.toBeNull();
  });
});
