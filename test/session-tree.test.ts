import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import { RegistryStore, archiveSession, ensureSessionDir, appendSessionMessage } from "../src/lib/persistence.js";
import type { SessionTreeNode } from "../src/lib/types.js";
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

let persistDir: string;

beforeEach(() => {
  persistDir = mkdtempSync(join(tmpdir(), "may-tree-test-"));
});

afterEach(() => {
  if (existsSync(persistDir)) {
    rmSync(persistDir, { recursive: true, force: true });
  }
});

describe("getSessionTree()", () => {
  it("returns a single node with no children", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "worker",
      description: "test worker",
      domain: "test",
      systemPrompt: "you are a worker",
      model: fakeModel(),
      tools: [],
    });

    const sid = manager.run("worker", "solo task");
    const tree = manager.getSessionTree(sid);

    expect(tree.sessionId).toBe(sid);
    expect(tree.agent).toBe("worker");
    expect(tree.task).toBe("solo task");
    expect(tree.status).toBe("running");
    expect(tree.children).toEqual([]);
  });

  it("returns a parent with children", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "supervisor",
      description: "supervisor",
      domain: "test",
      systemPrompt: "you are a supervisor",
      model: fakeModel(),
      tools: [],
    });
    manager.register({
      name: "worker",
      description: "worker",
      domain: "test",
      systemPrompt: "you are a worker",
      model: fakeModel(),
      tools: [],
    });

    const parentSid = manager.run("supervisor", "oversee work");
    const child1 = manager.run("worker", "task A", { parentSessionId: parentSid });
    const child2 = manager.run("worker", "task B", { parentSessionId: parentSid });

    const tree = manager.getSessionTree(parentSid);

    expect(tree.sessionId).toBe(parentSid);
    expect(tree.agent).toBe("supervisor");
    expect(tree.children).toHaveLength(2);

    const childIds = tree.children.map((c) => c.sessionId);
    expect(childIds).toContain(child1);
    expect(childIds).toContain(child2);

    const childA = tree.children.find((c) => c.sessionId === child1)!;
    expect(childA.agent).toBe("worker");
    expect(childA.task).toBe("task A");
    expect(childA.status).toBe("running");
    expect(childA.children).toEqual([]);

    const childB = tree.children.find((c) => c.sessionId === child2)!;
    expect(childB.agent).toBe("worker");
    expect(childB.task).toBe("task B");
  });

  it("builds a deeply nested tree (3 levels)", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "root-agent",
      description: "root",
      domain: "test",
      systemPrompt: "root",
      model: fakeModel(),
      tools: [],
    });
    manager.register({
      name: "mid-agent",
      description: "middle",
      domain: "test",
      systemPrompt: "middle",
      model: fakeModel(),
      tools: [],
    });
    manager.register({
      name: "leaf-agent",
      description: "leaf",
      domain: "test",
      systemPrompt: "leaf",
      model: fakeModel(),
      tools: [],
    });

    const rootSid = manager.run("root-agent", "root task");
    const midSid = manager.run("mid-agent", "mid task", { parentSessionId: rootSid });
    const leafSid = manager.run("leaf-agent", "leaf task", { parentSessionId: midSid });

    const tree = manager.getSessionTree(rootSid);

    // Root level
    expect(tree.sessionId).toBe(rootSid);
    expect(tree.agent).toBe("root-agent");
    expect(tree.children).toHaveLength(1);

    // Mid level
    const midNode = tree.children[0];
    expect(midNode.sessionId).toBe(midSid);
    expect(midNode.agent).toBe("mid-agent");
    expect(midNode.children).toHaveLength(1);

    // Leaf level
    const leafNode = midNode.children[0];
    expect(leafNode.sessionId).toBe(leafSid);
    expect(leafNode.agent).toBe("leaf-agent");
    expect(leafNode.task).toBe("leaf task");
    expect(leafNode.children).toEqual([]);
  });

  it("works with mixed active and archived sessions", () => {
    // Set up archived (completed) parent via registry, and an active child via run()
    const registry = new RegistryStore(persistDir);
    const archivedParentSid = "s_archived_parent";
    registry.saveSession(archivedParentSid, {
      agent: "supervisor",
      task: "parent task",
      status: "done",
      startedAt: Date.now() - 10000,
      endedAt: Date.now() - 5000,
    });

    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "worker",
      description: "worker",
      domain: "test",
      systemPrompt: "worker",
      model: fakeModel(),
      tools: [],
    });

    // Start an active child session whose parent is the archived session
    const childSid = manager.run("worker", "child task", { parentSessionId: archivedParentSid });

    // Parent is archived (in registry only), child is active
    const tree = manager.getSessionTree(archivedParentSid);

    expect(tree.sessionId).toBe(archivedParentSid);
    expect(tree.agent).toBe("supervisor");
    expect(tree.status).toBe("completed"); // done maps to completed
    expect(tree.children).toHaveLength(1);

    const childNode = tree.children[0];
    expect(childNode.sessionId).toBe(childSid);
    expect(childNode.agent).toBe("worker");
    expect(childNode.task).toBe("child task");
    expect(childNode.status).toBe("running"); // active session
  });

  it("throws for a non-existent session", () => {
    const manager = new SubagentManager({ persistDir });
    expect(() => manager.getSessionTree("nonexistent")).toThrow('Session "nonexistent" not found');
  });

  it("maps done status to completed", async () => {
    // Manually set up a "done" session via the registry to test status mapping
    // without needing a real LLM
    const registry = new RegistryStore(persistDir);
    registry.saveSession("s_done_1", {
      agent: "worker",
      task: "finished task",
      status: "done",
      startedAt: Date.now() - 1000,
      endedAt: Date.now(),
    });

    const manager = new SubagentManager({ persistDir });
    const tree = manager.getSessionTree("s_done_1");

    expect(tree.status).toBe("completed");
    expect(tree.agent).toBe("worker");
    expect(tree.task).toBe("finished task");
  });

  it("maps interrupted status to cancelled", () => {
    const registry = new RegistryStore(persistDir);
    registry.saveSession("s_int_1", {
      agent: "worker",
      task: "interrupted task",
      status: "interrupted",
      startedAt: Date.now(),
      error: "Process restarted",
    });

    const manager = new SubagentManager({ persistDir });
    const tree = manager.getSessionTree("s_int_1");

    expect(tree.status).toBe("cancelled");
  });

  it("maps error status to cancelled", () => {
    const registry = new RegistryStore(persistDir);
    registry.saveSession("s_err_1", {
      agent: "worker",
      task: "error task",
      status: "error",
      startedAt: Date.now(),
      error: "Something broke",
    });

    const manager = new SubagentManager({ persistDir });
    const tree = manager.getSessionTree("s_err_1");

    expect(tree.status).toBe("cancelled");
  });

  it("maps idle status to running", () => {
    const registry = new RegistryStore(persistDir);
    registry.saveSession("s_idle_1", {
      agent: "persistent-agent",
      task: "long-lived task",
      status: "idle",
      startedAt: Date.now(),
    });

    const manager = new SubagentManager({ persistDir });
    const tree = manager.getSessionTree("s_idle_1");

    expect(tree.status).toBe("running");
  });

  it("includes result for completed archived sessions with messages", () => {
    const registry = new RegistryStore(persistDir);
    const sid = "s_with_result_1";
    registry.saveSession(sid, {
      agent: "worker",
      task: "task with result",
      status: "done",
      startedAt: Date.now() - 5000,
      endedAt: Date.now(),
    });

    // Create session directory and add a message, then archive it
    ensureSessionDir(persistDir, sid);
    appendSessionMessage(persistDir, sid, {
      role: "assistant",
      content: [{ type: "text", text: "Here is the final answer." }],
      timestamp: Date.now(),
    });
    archiveSession(persistDir, sid);

    const manager = new SubagentManager({ persistDir });
    const tree = manager.getSessionTree(sid);

    expect(tree.status).toBe("completed");
    expect(tree.result).toBe("Here is the final answer.");
  });
});
