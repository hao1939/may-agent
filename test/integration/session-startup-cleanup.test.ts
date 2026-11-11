import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../../src/lib/db/connection.js";
import { SubagentManager } from "../../src/lib/manager.js";
import {
  addSessionBashProcessGroup,
  appendSessionMessage,
  ensureSessionDir,
  readSessionBashProcessGroups,
  sessionOutputDir,
  writeSessionMeta,
} from "../../src/lib/persistence.js";
import { fakeModel } from "../fixtures/model.js";
import { spawnFixtureProcess } from "../fixtures/owned-process.js";
import { markStaleSession } from "../fixtures/stale-session.js";

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function assistantMessage(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function setupSession(persistDir: string, sessionId: string, messages?: AgentMessage[]): void {
  ensureSessionDir(persistDir, sessionId);
  markStaleSession(persistDir, sessionId);
  mkdirSync(sessionOutputDir(persistDir, sessionId), { recursive: true });
  if (messages) {
    for (const msg of messages) {
      appendSessionMessage(persistDir, sessionId, msg);
    }
  }
}

function registerAgent(manager: SubagentManager, name: string): void {
  manager.register({
    name,
    description: `Agent ${name}`,
    domain: "test",
    systemPrompt: `You are ${name}.`,
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
  });
}

describe("stopped session cleanup", () => {
  let persistDir: string;
  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-session-cleanup-"));
  });
  afterEach(() => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true, force: true });
  });
  it.each(["missing", "done"] as const)(
    "requires ownership evidence before draining descendants with %s metadata",
    async (metadata) => {
      const sessionId = "orphaned-execution";
      markStaleSession(persistDir, sessionId);
      const directory = join(persistDir, "sessions", sessionId);
      writeFileSync(join(directory, "[STARTED]"), "started");
      if (metadata === "done")
        writeSessionMeta(persistDir, sessionId, {
          agent: "worker",
          task: "Retain work",
          status: "done",
          startedAt: 1,
          endedAt: 2,
        });
      const child = spawnFixtureProcess(["--eval", 'console.log("ready"); setInterval(() => {}, 1000);'], {
        detached: true,
      });
      const exited = once(child, "exit");
      try {
        await Promise.race([
          once(child.stdout, "data"),
          exited.then(() => {
            throw new Error("Descendant exited before cleanup");
          }),
        ]);
        addSessionBashProcessGroup(persistDir, sessionId, child.pid!);
        const manager = new SubagentManager({ persistDir });
        expect(manager.cleanupStaleSessions()).toEqual({ interrupted: [] });
        if (metadata === "missing") {
          // A marker supplies liveness, not Task authority. With no retained
          // attempt either, keep descendants until execution evidence is restored.
          expect(readSessionBashProcessGroups(persistDir, sessionId)).toEqual([child.pid!]);
          expect(process.kill(child.pid!, 0)).toBe(true);
          expect(existsSync(join(directory, "[ACTIVE]"))).toBe(true);
          expect(existsSync(join(directory, "[STARTED]"))).toBe(true);
          writeSessionMeta(persistDir, sessionId, {
            agent: "worker",
            task: "Retain work",
            status: "done",
            startedAt: 1,
            endedAt: 2,
          });
          manager.cleanupStaleSessions();
        }
        expect(readSessionBashProcessGroups(persistDir, sessionId)).toEqual([]);
        await exited;
        expect(existsSync(join(directory, "[ACTIVE]"))).toBe(false);
        expect(existsSync(join(directory, "[STARTED]"))).toBe(false);
      } finally {
        child.kill("SIGKILL");
        await exited;
      }
    },
  );

  it("retains interrupted transcripts and never starts another execution", () => {
    const manager = new SubagentManager({ persistDir });
    const id = "stopped";
    writeSessionMeta(persistDir, id, { agent: "worker", task: "Retain the ask", status: "running", startedAt: 1 });
    setupSession(persistDir, id, [userMessage("Keep the complete requirement"), assistantMessage("Partial work")]);
    const transcript = readFileSync(join(persistDir, "sessions", id, "session.jsonl"), "utf8");
    registerAgent(manager, "worker");
    expect(manager.cleanupStaleSessions().interrupted).toHaveLength(1);
    expect(manager.status()).toEqual([]);
    expect(manager.registryStore.getSession(id)).toMatchObject({ status: "interrupted", task: "Retain the ask" });
    expect(readFileSync(join(persistDir, "sessions", id, "session.jsonl"), "utf8")).toBe(transcript);
    expect(manager.cleanupStaleSessions()).toEqual({ interrupted: [] });
    expect(() => manager.run("worker", "Reuse old identity", { sessionId: id })).toThrow(
      "already has execution evidence",
    );
  });
  it("preserves terminal outcomes, exact usage and obsolete lease history during cleanup", () => {
    const manager = new SubagentManager({ persistDir });
    writeSessionMeta(persistDir, "done", {
      agent: "removed-agent",
      task: "Finished work",
      status: "done",
      startedAt: 1,
      endedAt: 2,
    });
    setupSession(persistDir, "done", [assistantMessage("Accepted result")]);
    const legacy = JSON.stringify({ records: { "worker::heartbeat": { lastStatus: "running" } } });
    writeFileSync(join(persistDir, "dispatch-dedup.json"), legacy);
    expect(manager.cleanupStaleSessions()).toEqual({ interrupted: [] });
    expect(manager.result("done")).toMatchObject({ status: "done", lastAssistantText: "Accepted result" });
    expect(readFileSync(join(persistDir, "dispatch-dedup.json"), "utf8")).toBe(legacy);
  });
});
