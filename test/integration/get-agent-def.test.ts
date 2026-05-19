import { describe, it, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { SubagentManager } from "../../src/lib/manager.js";
import type { SubagentDefinition } from "../../src/lib/types.js";
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

function makeDef(overrides: Partial<SubagentDefinition> = {}): SubagentDefinition {
  return {
    name: "alpha",
    description: "Alpha agent",
    domain: "testing",
    systemPrompt: "You are alpha.",
    model: fakeModel(),
    tools: [],
    apiKey: "fake-key",
    ...overrides,
  };
}

describe("SubagentManager.getAgentDefinition()", () => {
  it("returns the definition for a registered agent", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    const def = makeDef({ name: "coder" });
    manager.register(def);

    const result = manager.getAgentDefinition("coder");
    expect(result).toBeDefined();
    expect(result!.name).toBe("coder");
  });

  it("returns undefined for a name that was never registered", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    manager.register(makeDef({ name: "alpha" }));

    const result = manager.getAgentDefinition("nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns correct fields matching the originally registered definition", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    const def = makeDef({
      name: "builder",
      description: "Builds things",
      domain: "construction",
      systemPrompt: "You build stuff.",
      timeoutMs: 5000,
      workspace: "/tmp/builder-ws",
    });
    manager.register(def);

    const result = manager.getAgentDefinition("builder")!;
    expect(result.name).toBe("builder");
    expect(result.description).toBe("Builds things");
    expect(result.domain).toBe("construction");
    expect(result.systemPrompt).toBe("You build stuff.");
    expect(result.timeoutMs).toBe(5000);
    expect(result.workspace).toBe("/tmp/builder-ws");
    expect(result.model.id).toBe("test-model");
    expect(result.tools).toEqual([]);
  });

  it("returns the latest definition when an agent is re-registered", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    manager.register(makeDef({ name: "agent-x", description: "Version 1" }));
    expect(manager.getAgentDefinition("agent-x")!.description).toBe("Version 1");

    manager.register(makeDef({ name: "agent-x", description: "Version 2" }));
    const result = manager.getAgentDefinition("agent-x")!;
    expect(result.description).toBe("Version 2");
  });

  it("returns SubagentDefinition | undefined (type safety)", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    manager.register(makeDef({ name: "typed" }));

    // Found case: result is SubagentDefinition
    const found = manager.getAgentDefinition("typed");
    expect(found).toBeDefined();
    // Verify the returned object satisfies SubagentDefinition shape
    const def: SubagentDefinition | undefined = found;
    expect(def!.name).toBe("typed");
    expect(typeof def!.description).toBe("string");
    expect(typeof def!.domain).toBe("string");
    expect(def!.model).toBeDefined();
    expect(Array.isArray(def!.tools)).toBe(true);

    // Not-found case: result is undefined
    const missing = manager.getAgentDefinition("ghost");
    expect(missing).toBeUndefined();
    const undef: SubagentDefinition | undefined = missing;
    expect(undef).toBeUndefined();
  });
});
