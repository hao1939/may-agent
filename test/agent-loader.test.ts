import { describe, it, expect } from "vitest";
import { validateAgentConfig, type AgentConfig } from "../run/agent-loader.js";
import { resolve } from "node:path";

const AGENTS_ROOT = resolve(import.meta.dirname, "..", "agents");

const fakeModels = {
  opus: { id: "opus", provider: "anthropic" },
  gpt52: { id: "gpt52", provider: "openai" },
  gemini3pro: { id: "gemini3pro", provider: "openai" },
  kimi: { id: "kimi", provider: "openai" },
};

describe("validateAgentConfig", () => {
  it("accepts a valid config", () => {
    const config: AgentConfig = {
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: "opus",
      tools: ["read-write", "exec"],
      systemPromptFiles: ["knowledge/domain.md"],
    };
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    expect(errors).toEqual([]);
  });

  it("rejects missing required fields", () => {
    const config = { tools: ["exec"] } as unknown as AgentConfig;
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    const fields = errors.map((e) => e.field);
    expect(fields).toContain("name");
    expect(fields).toContain("description");
    expect(fields).toContain("domain");
    expect(fields).toContain("model");
  });

  it("rejects unknown model", () => {
    const config: AgentConfig = {
      name: "test",
      description: "test",
      domain: "test",
      model: "nonexistent-model",
      tools: ["exec"],
    };
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    expect(errors.some((e) => e.field === "model" && e.message.includes("nonexistent-model"))).toBe(true);
  });

  it("rejects unknown tool presets", () => {
    const config: AgentConfig = {
      name: "test",
      description: "test",
      domain: "test",
      model: "opus",
      tools: ["read-write", "fly-to-moon"],
    };
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    expect(errors.some((e) => e.field === "tools" && e.message.includes("fly-to-moon"))).toBe(true);
  });

  it("rejects missing system prompt files", () => {
    const config: AgentConfig = {
      name: "coder",
      description: "test",
      domain: "test",
      model: "opus",
      tools: ["exec"],
      systemPromptFiles: ["knowledge/nonexistent.md"],
    };
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    expect(errors.some((e) => e.field === "systemPromptFiles")).toBe(true);
  });

  it("rejects missing shared knowledge files", () => {
    const config: AgentConfig = {
      name: "coder",
      description: "test",
      domain: "test",
      model: "opus",
      tools: ["exec"],
      sharedKnowledge: ["nonexistent.md"],
    };
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    expect(errors.some((e) => e.field === "sharedKnowledge")).toBe(true);
  });

  it("validates all existing agent.json files", () => {
    // This test ensures all committed agent.json files are valid
    const { readdirSync, readFileSync, existsSync } = require("node:fs");
    const entries = readdirSync(AGENTS_ROOT, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "shared") continue;
      const configPath = resolve(AGENTS_ROOT, entry.name, "agent.json");
      if (!existsSync(configPath)) continue;

      const raw = readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw) as AgentConfig;
      const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
      expect(errors, `agent "${config.name}" has validation errors`).toEqual([]);
    }
  });
});
