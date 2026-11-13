import { Type } from "typebox";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SubagentManager } from "../../src/lib/index.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readSessionMeta } from "../../src/lib/persistence.js";

import { fakeModel } from "../fixtures/model.js";

// Minimal fake model that satisfies the Model interface

describe("Registry persistence", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-agent-test-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("keeps registered agent definitions in-memory on the manager without writing registry.json", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "test-agent",
      description: "A test agent",
      domain: "testing",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
    });

    // Agent config is in-memory — no registry.json on disk
    expect(existsSync(join(persistDir, "registry.json"))).toBe(false);
    expect(manager.hasAgent("test-agent")).toBe(true);
    expect(manager.getAgentDefinition("test-agent")).toMatchObject({
      name: "test-agent",
      description: "A test agent",
      domain: "testing",
      systemPrompt: "You are a test agent.",
    });
    expect(manager.listAgents()).toEqual([
      { name: "test-agent", description: "A test agent", domain: "testing" },
    ]);
  });

  it("retains supported definition fields and replaces or unregisters cleanly", () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "full-agent",
      description: "Full config agent",
      domain: "research",
      workspace: "/path/to/workspace",
      model: fakeModel(),
      tools: [],
      timeoutMs: 600000,
    });

    expect(manager.getAgentDefinition("full-agent")).toMatchObject({
      domain: "research",
      workspace: "/path/to/workspace",
      timeoutMs: 600000,
    });

    manager.register({
      name: "full-agent",
      description: "Updated config agent",
      domain: "research",
      model: fakeModel(),
      tools: [],
    });
    expect(manager.getAgentDefinition("full-agent")?.description).toBe("Updated config agent");
    expect(manager.getAgentDefinition("full-agent")?.workspace).toBeUndefined();

    manager.unregister("full-agent");
    expect(manager.hasAgent("full-agent")).toBe(false);
    expect(manager.getAgentDefinition("full-agent")).toBeUndefined();
  });

  it("agent definitions are in-memory only — not shared across manager instances", () => {
    const manager1 = new SubagentManager({ persistDir });
    manager1.register({
      name: "persisted-agent",
      description: "Survives restart",
      domain: "persistence",
      systemPrompt: "I persist",
      model: fakeModel(),
      tools: [],
    });

    const manager2 = new SubagentManager({ persistDir });
    expect(manager2.hasAgent("persisted-agent")).toBe(false);

    manager2.register({
      name: "persisted-agent",
      description: "Survives restart",
      domain: "persistence",
      systemPrompt: "I persist",
      model: fakeModel(),
      tools: [],
    });
    expect(manager2.hasAgent("persisted-agent")).toBe(true);
  });

  it("records session as meta.json on run and updates on completion", async () => {
    const manager = new SubagentManager({ persistDir });

    manager.register({
      name: "runner",
      description: "Runs tasks",
      domain: "running",
      systemPrompt: "You are a runner.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("runner", "do something");

    // Session should have a meta.json immediately
    const metaBefore = readSessionMeta(persistDir, sessionId);
    expect(metaBefore).toBeDefined();
    expect(metaBefore!.status).toBe("running");
    expect(metaBefore!.agent).toBe("runner");
    expect(metaBefore!.task).toBe("do something");

    // Wait for it to complete (fake model — will end as done or error)
    await manager.waitFor(sessionId);

    // Session meta.json should be updated (may be in history now)
    const metaAfter = readSessionMeta(persistDir, sessionId);
    expect(metaAfter).toBeDefined();
    expect(["done", "error"]).toContain(metaAfter!.status);
    expect(metaAfter!.endedAt).toBeDefined();
  });

  it("persists the workflow finish requirement and output schema for recovery", async () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "workflow-worker",
      description: "Runs structured workflow steps",
      domain: "workflow",
      systemPrompt: "Complete the workflow step.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });
    const outputSchema = Type.Object({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]) });

    const sessionId = manager.run("workflow-worker", "review", {
      requireFinish: true,
      outputSchema,
      toolPolicy: "readonly",
      recoveryOwner: "app-task-reconciler",
    });
    const meta = readSessionMeta(persistDir, sessionId);

    expect(meta?.requireFinish).toBe(true);
    expect(meta?.outputSchema).toMatchObject({ type: "object" });
    expect(meta?.toolPolicy).toBe("readonly");
    expect(meta?.recoveryOwner).toBe("app-task-reconciler");

    manager.cancel(sessionId);
    await manager.waitFor(sessionId);
  });

  it("persists the App-owner capability boundary for recovery", async () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "app-owner",
      description: "Owns App input",
      domain: "app",
      systemPrompt: "Handle one App request.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("app-owner", "handle request", {
      requireFinish: true,
      toolPolicy: "app-owner-deputy",
      recoveryOwner: "app-inbox",
    });
    const meta = readSessionMeta(persistDir, sessionId);

    expect(meta?.toolPolicy).toBe("app-owner-deputy");
    expect(meta?.recoveryOwner).toBe("app-inbox");

    manager.cancel(sessionId);
    await manager.waitFor(sessionId);
  });

  it("works with a fresh persistDir (no prior state)", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });

    // Should work fine, just no file created
    manager.register({
      name: "ephemeral",
      description: "No persistence",
      domain: "ephemeral",
      systemPrompt: "Temp",
      model: fakeModel(),
      tools: [],
    });

    const status = manager.status();
    expect(status).toEqual([]);
  });
});
