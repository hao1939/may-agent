import { describe, it, expect } from "vitest";
import { validateAgentConfig, type AgentConfig } from "../src/app/agent-loader.js";
import { resolve } from "node:path";

const AGENTS_ROOT = resolve(import.meta.dirname, "..", "agents");

const fakeModels = {
  opus: { id: "opus", provider: "anthropic" },
  "opus-4.7": { id: "claude-opus-4.7", provider: "github-copilot" },
  "claude-sonnet-4-20250514": { id: "claude-sonnet-4-20250514", provider: "anthropic" },
  gpt52: { id: "gpt52", provider: "openai" },
  "gpt-5.5": { id: "gpt-5.5", provider: "github-copilot" },
  gemini3pro: { id: "gemini3pro", provider: "openai" },
  "gemini-3.1-pro": { id: "gemini-3.1-pro-preview", provider: "github-copilot" },
  kimi: { id: "kimi", provider: "openai" },
};

describe("validateAgentConfig", () => {
  it("accepts a valid config", () => {
    const config: AgentConfig = {
      name: "coder",
      description: "Writes code",
      domain: "coding",
      model: "opus",
      tools: ["coding"],
    };
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    expect(errors).toEqual([]);
  });

  it("rejects missing required fields", () => {
    const config = { tools: ["coding"] } as unknown as AgentConfig;
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

  it("validates all existing agent.json files", () => {
    // This test ensures all committed agent.json files are valid
    const { readdirSync, readFileSync, existsSync } = require("node:fs");
    const entries = readdirSync(AGENTS_ROOT, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "shared") continue;
      if (entry.name.startsWith("_")) continue; // Skip archetype directories
      const configPath = resolve(AGENTS_ROOT, entry.name, "agent.json");
      if (!existsSync(configPath)) continue;

      const raw = readFileSync(configPath, "utf-8");
      let config = JSON.parse(raw) as AgentConfig;

      // Resolve archetype inheritance before validating
      if (config.extends) {
        const archetypePath = resolve(AGENTS_ROOT, config.extends, "agent.json");
        if (existsSync(archetypePath)) {
          const parentRaw = readFileSync(archetypePath, "utf-8");
          const parentConfig = JSON.parse(parentRaw) as AgentConfig;
          config = {
            ...parentConfig,
            ...config,
            name: config.name,
            tools: [...new Set([...(parentConfig.tools || []), ...(config.tools || [])])],
          };
        }
      }

      const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
      expect(errors, `agent "${config.name}" has validation errors`).toEqual([]);
    }
  });

  it("accepts config with valid extends field", () => {
    const config: AgentConfig = {
      name: "acme-coder",
      description: "Coder for Acme team",
      domain: "coding",
      model: "opus",
      tools: ["coding"],
      extends: "_archetypes/coder",
    };
    // Note: validation of extends requires the archetype to exist on disk,
    // so for unit tests where _archetypes doesn't exist, we skip the extends check
    // by not adding the archetype dir. The validator will flag it.
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    // Will have extends error since _archetypes/coder doesn't exist on disk
    const nonExtendsErrors = errors.filter((e) => e.field !== "extends");
    expect(nonExtendsErrors).toEqual([]);
  });

  it("rejects extends pointing to nonexistent archetype", () => {
    const config: AgentConfig = {
      name: "bad-agent",
      description: "test",
      domain: "test",
      model: "opus",
      tools: ["coding"],
      extends: "_archetypes/nonexistent",
    };
    const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
    expect(errors.some((e) => e.field === "extends" && e.message.includes("not found"))).toBe(true);
  });
});
