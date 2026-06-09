import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readSessionMessages,
  ensureSessionDir,
  RegistryStore,
  sessionJsonlPath,
  sessionMetaPath,
} from "./persistence.js";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

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
      "", // empty line after trim won't appear
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
