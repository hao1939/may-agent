import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readSessionMessages,
  readMemoryEntries,
  appendSessionMessage,
  appendMemoryEntry,
  ensureSessionDir,
  RegistryStore,
  sessionJsonlPath,
  sessionMetaPath,
  memoryPath,
} from "../src/lib/persistence.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

describe("JSONL corruption handling", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-jsonl-corruption-"));
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("readSessionMessages skips corrupted lines and returns valid ones", () => {
    const sessionId = "test-session";
    ensureSessionDir(persistDir, sessionId);

    const validMsg: AgentMessage = {
      role: "user",
      content: [{ type: "text", text: "hello" }],
      timestamp: Date.now(),
    } as AgentMessage;

    // Write a mix of valid and corrupted lines
    const filePath = sessionJsonlPath(persistDir, sessionId);
    const lines = [
      JSON.stringify(validMsg),
      "this is not valid json {{{",
      JSON.stringify({ ...validMsg, content: [{ type: "text", text: "world" }] }),
      "",  // empty line after trim won't appear
    ];
    writeFileSync(filePath, lines.join("\n"), "utf-8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const messages = readSessionMessages(persistDir, sessionId);

    expect(messages).toHaveLength(2);
    expect(messages[0].content[0].text).toBe("hello");
    expect(messages[1].content[0].text).toBe("world");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("corrupted JSONL");

    warnSpy.mockRestore();
  });

  it("readMemoryEntries skips corrupted lines and returns valid ones", () => {
    const agentName = "test-agent";

    // Write a mix of valid and corrupted memory entries
    const filePath = memoryPath(persistDir, agentName);
    mkdirSync(join(persistDir, "memory"), { recursive: true });

    const validEntry = {
      task: "test task",
      status: "done",
      duration: "5s",
      summary: "completed",
      timestamp: Date.now(),
    };

    const lines = [
      JSON.stringify(validEntry),
      "corrupted line here!!!",
      JSON.stringify({ ...validEntry, task: "second task" }),
    ];
    writeFileSync(filePath, lines.join("\n"), "utf-8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const entries = readMemoryEntries(persistDir, agentName);

    expect(entries).toHaveLength(2);
    expect(entries[0].task).toBe("test task");
    expect(entries[1].task).toBe("second task");
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it("readSessionMessages returns empty array for all-corrupted file", () => {
    const sessionId = "all-corrupted";
    ensureSessionDir(persistDir, sessionId);

    const filePath = sessionJsonlPath(persistDir, sessionId);
    writeFileSync(filePath, "bad1\nbad2\nbad3", "utf-8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const messages = readSessionMessages(persistDir, sessionId);
    expect(messages).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(3);

    warnSpy.mockRestore();
  });

  it("readMemoryEntries with limit still works after skipping corrupted lines", () => {
    const agentName = "limited-agent";
    mkdirSync(join(persistDir, "memory"), { recursive: true });

    const filePath = memoryPath(persistDir, agentName);
    const entries = [];
    for (let i = 0; i < 5; i++) {
      entries.push(JSON.stringify({
        task: `task-${i}`,
        status: "done",
        duration: "1s",
        summary: null,
        timestamp: Date.now() + i,
      }));
    }
    // Insert corruption in the middle
    entries.splice(2, 0, "corrupt!");
    writeFileSync(filePath, entries.join("\n"), "utf-8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Request last 3 entries (out of 5 valid ones)
    const result = readMemoryEntries(persistDir, agentName, 3);
    expect(result).toHaveLength(3);
    expect(result[0].task).toBe("task-2");
    expect(result[1].task).toBe("task-3");
    expect(result[2].task).toBe("task-4");

    warnSpy.mockRestore();
  });
});

describe("RegistryStore atomic writes", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-atomic-"));
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("persists session data correctly through per-session meta.json", () => {
    const store = new RegistryStore(persistDir);

    // Save a session
    store.saveSession("s1", {
      agent: "test",
      task: "task 1",
      status: "running",
      startedAt: Date.now(),
    });

    // Create a second store instance that reads from the same dir
    const store2 = new RegistryStore(persistDir);
    const data = store2.getRegistry();

    expect(data.sessions["s1"]).toBeDefined();
    expect(data.sessions["s1"].task).toBe("task 1");
  });

  it("does not leave .tmp files after successful write", () => {
    const store = new RegistryStore(persistDir);
    store.saveSession("s1", {
      agent: "test",
      task: "task 1",
      status: "running",
      startedAt: Date.now(),
    });

    const tmpPath = sessionMetaPath(persistDir, "s1") + ".tmp";
    expect(existsSync(tmpPath)).toBe(false);
  });
});
