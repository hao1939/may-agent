import { describe, expect, it, mock } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgents, type AgentLoaderOptions, type AgentRegistryRuntime } from "./agent-registry-loader.ts";

function tempRoot(): string {
  const root = join(tmpdir(), `agent-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function makeAgentJson(name: string, model = "test-model") {
  return JSON.stringify({ name, description: `${name} agent`, domain: "test", model, tools: [] });
}

function makeOpts(root: string, agentsRoot: string, projectsRoot: string): AgentLoaderOptions {
  const registered = new Map<string, any>();
  return {
    agentsRoot,
    sharedRoot: join(root, "shared"),
    projectsRoot,
    projectRoot: root,
    persistDir: join(root, ".state"),
    models: {
      "test-model": { model: "test-model", apiKey: "test-key" } as any,
    },
    manager: {
      register: mock((def: any) => registered.set(def.name, def)),
      hasAgent: (name: string) => registered.has(name),
    } as any,
    bus: {
      emit: mock(() => {}),
      on: mock(() => {}),
    } as any,
    cronEnabled: false,
  };
}

function makeRuntime(): AgentRegistryRuntime {
  return {
    getAgentSessionId: () => undefined,
    getAgentCrons: () => new Map(),
    setAgentCron: () => {},
    addCleanup: () => {},
  };
}

describe("agent registry loader", () => {
  it("App-local agent silently overrides a global stub with the same name", async () => {
    const root = tempRoot();
    try {
      // Create global agents/evaluator with agent.json
      const globalAgentsRoot = join(root, "agents");
      const globalEvalDir = join(globalAgentsRoot, "evaluator");
      mkdirSync(globalEvalDir, { recursive: true });
      writeFileSync(join(globalEvalDir, "agent.json"), makeAgentJson("evaluator"));

      // Create App-local agents: projects/evaluation.app/agents/evaluator
      const projectsRoot = join(root, "projects");
      const appDir = join(projectsRoot, "evaluation.app");
      const appLocalEvalDir = join(appDir, "agents", "evaluator");
      mkdirSync(appLocalEvalDir, { recursive: true });
      writeFileSync(join(appDir, "app.ts"), "export default {};");
      writeFileSync(join(appLocalEvalDir, "agent.json"), makeAgentJson("evaluator"));

      const opts = makeOpts(root, globalAgentsRoot, projectsRoot);
      const runtime = makeRuntime();
      const result = await loadAgents(opts, runtime);

      // Should register evaluator once (from App-local App, overriding global)
      expect(result.added).toContain("evaluator");

      // Should NOT emit agent.config_invalid event
      const emitCalls = (opts.bus.emit as any).mock.calls;
      const configInvalidEvents = emitCalls.filter((c: any) => c[0]?.type === "agent.config_invalid");
      expect(configInvalidEvents).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("still errors on duplicate names within the same scope", async () => {
    const root = tempRoot();
    try {
      // Create two App-local agents with the same name
      const globalAgentsRoot = join(root, "agents");
      mkdirSync(globalAgentsRoot, { recursive: true });

      const projectsRoot = join(root, "projects");

      // First App-local definition
      const appDir1 = join(projectsRoot, "alpha.app");
      const agentDir1 = join(appDir1, "agents", "shared-agent");
      mkdirSync(agentDir1, { recursive: true });
      writeFileSync(join(appDir1, "app.ts"), "export default {};");
      writeFileSync(join(agentDir1, "agent.json"), makeAgentJson("shared-agent"));

      // Second App-local definition with same agent name
      const appDir2 = join(projectsRoot, "beta.app");
      const agentDir2 = join(appDir2, "agents", "shared-agent");
      mkdirSync(agentDir2, { recursive: true });
      writeFileSync(join(appDir2, "app.ts"), "export default {};");
      writeFileSync(join(agentDir2, "agent.json"), makeAgentJson("shared-agent"));

      const opts = makeOpts(root, globalAgentsRoot, projectsRoot);
      const runtime = makeRuntime();
      await loadAgents(opts, runtime);

      // Should emit agent.config_invalid since both are project-scoped (same scope)
      const emitCalls = (opts.bus.emit as any).mock.calls;
      const configInvalidEvents = emitCalls.filter((c: any) => c[0]?.type === "agent.config_invalid");
      expect(configInvalidEvents).toHaveLength(1);
      expect(configInvalidEvents[0][0].data.errors[0].message).toContain("Duplicate agent name");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("global-only agents load without issues", async () => {
    const root = tempRoot();
    try {
      const globalAgentsRoot = join(root, "agents");
      const agentDir = join(globalAgentsRoot, "solo");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, "agent.json"), makeAgentJson("solo"));

      const projectsRoot = join(root, "projects");
      mkdirSync(projectsRoot, { recursive: true });

      const opts = makeOpts(root, globalAgentsRoot, projectsRoot);
      const runtime = makeRuntime();
      const result = await loadAgents(opts, runtime);

      expect(result.added).toContain("solo");

      const emitCalls = (opts.bus.emit as any).mock.calls;
      const configInvalidEvents = emitCalls.filter((c: any) => c[0]?.type === "agent.config_invalid");
      expect(configInvalidEvents).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
