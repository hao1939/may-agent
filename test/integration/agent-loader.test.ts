import { describe, it, expect } from "bun:test";
import {
  generateAutoHeartbeats,
  listConfiguredAgentNames,
  listProjectAgentDirectories,
  loadAgentConfig,
  loadHandlersForAgentCrons,
  loadAgents,
  validateAgentConfig,
  type AgentConfig,
} from "../../src/app/agent-loader.js";
import { findFleetToolPresetIssues, findUnhandledToolPresets, VALID_TOOL_PRESETS } from "../../src/lib/tool-preset-registry.js";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const AGENTS_ROOT = "/app/agents";

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
        sharedRoot: join(root, "shared"),
        projectsRoot: join(root, "projects"),
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

describe("agent loader boundaries", () => {
  it("emits agent.config_invalid when agent.json cannot be parsed", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-config-"));
    try {
      const agentDir = join(root, "broken");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, "agent.json"), "{");

      const events: Array<{ type: string; agent?: string; message?: string; data?: Record<string, unknown> }> = [];
      const config = loadAgentConfig(agentDir, { emit: (event: any) => events.push(event) } as any);

      expect(config).toBeNull();
      expect(events.some((event) => event.type === "agent.config_invalid" && event.data?.agent === "broken")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers configured agent names and skips disabled configs", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-discovery-"));
    try {
      const agentsRoot = join(root, "agents");
      const alphaDir = join(agentsRoot, "alpha");
      const betaDir = join(agentsRoot, "beta");
      mkdirSync(alphaDir, { recursive: true });
      mkdirSync(betaDir, { recursive: true });
      writeFileSync(join(alphaDir, "agent.json"), JSON.stringify({ name: "z-alpha" }));
      writeFileSync(join(betaDir, "agent.json"), JSON.stringify({ name: "beta", disabled: true }));

      expect(listConfiguredAgentNames(agentsRoot)).toEqual(["z-alpha"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });


  it("discovers project-local agent names", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-project-discovery-"));
    try {
      const agentsRoot = join(root, "agents");
      const projectsRoot = join(root, "projects");
      const projectDir = join(projectsRoot, "aks-rp-e2e");
      const projectAgentDir = join(projectDir, "agents", "aks-explorer");
      mkdirSync(agentsRoot, { recursive: true });
      mkdirSync(projectAgentDir, { recursive: true });
      writeFileSync(join(projectDir, "project.md"), "---\nid: aks-rp-e2e\n---\n");
      writeFileSync(join(projectAgentDir, "agent.json"), JSON.stringify({ name: "aks-explorer" }));

      expect(listConfiguredAgentNames(agentsRoot, projectsRoot)).toEqual(["aks-explorer"]);
      expect(listProjectAgentDirectories(projectsRoot).map((agent) => agent.name)).toEqual(["aks-explorer"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("loads project-local agents with the project directory as projectRoot", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-project-agent-"));
    try {
      const agentsRoot = join(root, "agents");
      const sharedRoot = join(root, "shared");
      const projectsRoot = join(root, "projects");
      const projectDir = join(projectsRoot, "aks-rp-e2e");
      const projectAgentDir = join(projectDir, "agents", "aks-explorer");
      mkdirSync(agentsRoot, { recursive: true });
      mkdirSync(sharedRoot, { recursive: true });
      mkdirSync(join(projectAgentDir, "workspace"), { recursive: true });
      writeFileSync(join(projectDir, "project.md"), "---\nid: aks-rp-e2e\nowner: aks-explorer\n---\n");
      writeFileSync(
        join(projectAgentDir, "agent.json"),
        JSON.stringify({
          name: "aks-explorer",
          description: "Project-local AKS explorer",
          domain: "AKS e2e",
          model: "opus",
          tools: ["query_db"],
        }),
      );

      const registered: any[] = [];
      const manager = {
        hasAgent: () => false,
        register: (def: any) => registered.push(def),
      };

      const result = await loadAgents({
        agentsRoot,
        projectRoot: root,
        sharedRoot,
        projectsRoot,
        persistDir: join(root, ".state"),
        models: { opus: { id: "opus", provider: "test", apiKey: "test" } } as any,
        manager: manager as any,
        bus: { emit: () => undefined } as any,
        cronEnabled: false,
      });

      expect(result.added).toEqual(["aks-explorer"]);
      expect(registered[0].agentDir).toBe(projectAgentDir);
      expect(registered[0].workspace).toBe(join(projectAgentDir, "workspace"));
      expect(registered[0].projectRoot).toBe(projectDir);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("warns when cron.json exists but agent.json tools[] omits \"cron\" (F2)", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-cron-ignored-"));
    try {
      const agentsRoot = join(root, "agents");
      const sharedRoot = join(root, "shared");
      const agentDir = join(agentsRoot, "silenced");
      mkdirSync(agentDir, { recursive: true });
      mkdirSync(sharedRoot, { recursive: true });
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({
          name: "silenced",
          description: "agent with cron.json but no cron tool",
          domain: "test",
          model: "opus",
          tools: ["query_db"], // no "cron"
        }),
      );
      writeFileSync(join(agentDir, "cron.json"), JSON.stringify([{ name: "forgotten", handler: "x", intervalMs: 60000 }]));

      const events: any[] = [];
      const manager = { hasAgent: () => false, register: () => undefined };

      await loadAgents({
        agentsRoot,
        projectRoot: root,
        sharedRoot,
        projectsRoot: join(root, "projects"),
        persistDir: join(root, ".state"),
        models: { opus: { id: "opus", provider: "test", apiKey: "test" } } as any,
        manager: manager as any,
        bus: { emit: (e: any) => events.push(e) } as any,
        cronEnabled: false,
      });

      const warning = events.find(
        (e) => e.type === "info" && typeof e.message === "string" && e.message.includes("silenced") && e.message.includes("IGNORED"),
      );
      expect(warning).toBeDefined();
      expect(warning.message).toContain("cron.json");
      expect(warning.message).toContain("Add \"cron\" to tools");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does NOT warn when cron.json exists and \"cron\" is in tools[]", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-cron-ok-"));
    try {
      const agentsRoot = join(root, "agents");
      const sharedRoot = join(root, "shared");
      const agentDir = join(agentsRoot, "enabled");
      mkdirSync(agentDir, { recursive: true });
      mkdirSync(sharedRoot, { recursive: true });
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({
          name: "enabled",
          description: "agent with cron.json and cron tool",
          domain: "test",
          model: "opus",
          tools: ["cron"],
        }),
      );
      writeFileSync(join(agentDir, "cron.json"), JSON.stringify([]));

      const events: any[] = [];
      const manager = { hasAgent: () => false, register: () => undefined };

      await loadAgents({
        agentsRoot,
        projectRoot: root,
        sharedRoot,
        projectsRoot: join(root, "projects"),
        persistDir: join(root, ".state"),
        models: { opus: { id: "opus", provider: "test", apiKey: "test" } } as any,
        manager: manager as any,
        bus: { emit: (e: any) => events.push(e) } as any,
        cronEnabled: false,
      });

      const warning = events.find(
        (e) => e.type === "info" && typeof e.message === "string" && e.message.includes("IGNORED"),
      );
      expect(warning).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("generates conventional heartbeat entries only when no explicit heartbeat exists", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-heartbeat-"));
    try {
      const agentsRoot = join(root, "agents");
      const alphaDir = join(agentsRoot, "alpha");
      const betaDir = join(agentsRoot, "beta");
      mkdirSync(join(alphaDir, "workflows"), { recursive: true });
      mkdirSync(join(betaDir, "workflows"), { recursive: true });
      writeFileSync(join(alphaDir, "agent.json"), JSON.stringify({ name: "alpha" }));
      writeFileSync(join(alphaDir, "workflows", "alpha-heartbeat.ts"), "export default {};");
      writeFileSync(join(betaDir, "agent.json"), JSON.stringify({ name: "beta" }));
      writeFileSync(join(betaDir, "workflows", "beta-heartbeat.ts"), "export default {};");
      writeFileSync(join(betaDir, "cron.json"), JSON.stringify([{ name: "heartbeat-beta" }]));

      const entries = generateAutoHeartbeats(agentsRoot);

      expect(entries.map((entry) => entry.name)).toEqual(["heartbeat-alpha"]);
      expect(entries[0].handlerConfig).toMatchObject({ workflow: "alpha-heartbeat", agent: "alpha" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("hot-reloads handler modules on each invocation", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-loader-handlers-"));
    try {
      const agentDir = join(root, "agents", "alpha");
      const handlersDir = join(agentDir, "handlers");
      mkdirSync(handlersDir, { recursive: true });
      const handlerPath = join(handlersDir, "sample.ts");
      writeFileSync(handlerPath, `export function create() { return async () => "v1"; }`);

      const handlers = new Map<string, () => Promise<string>>();
      const cron = {
        getEntries: () => [{ name: "sample-entry", handler: "sample" }],
        registerHandler: (name: string, handler: () => Promise<string>) => handlers.set(name, handler),
        setHandlerResolver: () => undefined,
        triggerNow: () => false,
      };

      const result = await loadHandlersForAgentCrons({
        agentsRoot: join(root, "agents"),
        persistDir: join(root, ".state"),
        projectRoot: root,
        manager: { callAgent: async () => ({}) } as any,
        bus: { emit: () => undefined } as any,
        agentCrons: new Map([["alpha", cron as any]]),
      });

      expect(result.errors).toEqual([]);
      expect(result.registered).toEqual(["alpha:sample-entry"]);
      expect(await handlers.get("sample-entry")!()).toBe("v1");

      writeFileSync(handlerPath, `export function create() { return async () => "v2"; }`);

      expect(await handlers.get("sample-entry")!()).toBe("v2");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
