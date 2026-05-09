import { describe, it, expect } from "vitest";
import { loadAgents, validateAgentConfig, type AgentConfig } from "../src/app/agent-loader.js";
import { findFleetToolPresetIssues, findUnhandledToolPresets, VALID_TOOL_PRESETS } from "../src/lib/tool-preset-registry.js";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const AGENTS_ROOT = resolve(import.meta.dirname, "..", "agents");

const fakeModels = {
  opus: { id: "opus", provider: "anthropic" },
  "opus-4.7": { id: "claude-opus-4.7", provider: "github-copilot" },
  "claude-sonnet-4-20250514": { id: "claude-sonnet-4-20250514", provider: "anthropic" },
  gpt52: { id: "gpt52", provider: "openai" },
  "gpt-5.4": { id: "gpt-5.4", provider: "github-copilot" },
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
      if (entry.name.startsWith("_")) continue; // Skip legacy/private directories
      const configPath = resolve(AGENTS_ROOT, entry.name, "agent.json");
      if (!existsSync(configPath)) continue;

      const raw = readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw) as AgentConfig;

      const errors = validateAgentConfig(config, fakeModels, AGENTS_ROOT);
      expect(errors, `agent "${config.name}" has validation errors`).toEqual([]);
    }
  });

  it("has no valid-but-unhandled tool presets", () => {
    expect(findUnhandledToolPresets()).toEqual([]);
  });

  it("has no fleet tool preset drift or legacy archetype inheritance", () => {
    expect(findFleetToolPresetIssues(AGENTS_ROOT)).toEqual([]);
  });

  it("wires every valid preset without falling through to unknown-preset logging", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-presets-"));
    try {
      const agentsRoot = join(root, "agents");
      const agentDir = join(agentsRoot, "all-presets");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({
          name: "all-presets",
          description: "All preset smoke test",
          domain: "test",
          model: "opus",
          tools: [...VALID_TOOL_PRESETS],
        }),
      );

      const messages: string[] = [];
      const manager = {
        hasAgent: () => false,
        register: () => undefined,
        createAgentsTool: () => ({
          name: "agents",
          label: "Agents",
          description: "test",
          parameters: {} as any,
          execute: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
        }),
      };

      await loadAgents({
        agentsRoot,
        projectRoot: root,
        persistDir: join(root, ".state"),
        models: { opus: { id: "opus", provider: "test", apiKey: "test" } } as any,
        manager: manager as any,
        bus: { emit: (event: { message?: string }) => { if (event.message) messages.push(event.message); } } as any,
        cronEnabled: false,
      });

      expect(messages.filter((message) => message.includes("Unknown tool preset"))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
