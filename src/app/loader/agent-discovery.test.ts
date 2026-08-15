import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  agentProjectRoot,
  agentRelativeDir,
  listAgentDirectories,
  listProjectAgentDirectories,
  resolveRuntimeAgentDirectory,
} from "./agent-discovery.ts";

function tempRoot(): string {
  const root = join(tmpdir(), `agent-discovery-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

describe("project-local agent discovery", () => {
  it("ignores runtime workspace directories without agent.json", () => {
    const root = tempRoot();
    try {
      const agentsRoot = join(root, "agents");
      mkdirSync(join(agentsRoot, "scout", "workspace", "digest"), { recursive: true });
      mkdirSync(join(agentsRoot, "may"), { recursive: true });
      writeFileSync(join(agentsRoot, "may", "agent.json"), JSON.stringify({ name: "may", model: "test", tools: [] }));

      expect(listAgentDirectories(agentsRoot).map((agent) => agent.name)).toEqual(["may"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers canonical App-local agents under sibling .app projects", () => {
    const root = tempRoot();
    try {
      const domainProject = join(root, "aks-rp-e2e");
      const appProject = join(root, "aks-rp-e2e.app");
      const agentDir = join(appProject, "agents", "aks-explorer");
      mkdirSync(domainProject, { recursive: true });
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(domainProject, "README.md"), "# AKS RP E2E\n");
      writeFileSync(join(appProject, "app.ts"), "export default {};\n");
      writeFileSync(join(appProject, "project.md"), "# aks-rp-e2e app\n");
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({
          name: "aks-explorer",
          model: "test",
          tools: [],
        }),
      );

      const agents = listProjectAgentDirectories(root);
      expect(agents.map((agent) => agent.dir)).toEqual([agentDir]);
      expect(agents[0]?.projectId).toBe("aks-rp-e2e");
      expect(agentProjectRoot(agents[0], "fallback")).toBe(domainProject);
      expect(agentRelativeDir(agents[0])).toBe("projects/aks-rp-e2e.app/agents/aks-explorer");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires the canonical app.ts frame for App-local agents", () => {
    const root = tempRoot();
    try {
      const appProject = join(root, "evaluation.app");
      const agentDir = join(appProject, "agents", "evaluator");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(appProject, "app.ts"), "export default {} as unknown;\n");
      writeFileSync(join(agentDir, "agent.json"), JSON.stringify({ name: "evaluator", model: "test", tools: [] }));

      const agents = listProjectAgentDirectories(root);
      expect(agents.map((agent) => agent.dir)).toEqual([agentDir]);
      expect(agents[0]?.projectId).toBe("evaluation");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves app-local agents ahead of global agents with the same configured name", () => {
    const root = tempRoot();
    try {
      const globalAgentDir = join(root, "agents", "arc");
      const appAgentDir = join(root, "projects", "may-agent.app", "agents", "arc");
      mkdirSync(globalAgentDir, { recursive: true });
      mkdirSync(appAgentDir, { recursive: true });
      writeFileSync(join(globalAgentDir, "agent.json"), JSON.stringify({ name: "arc", model: "test", tools: [] }));
      writeFileSync(join(root, "projects", "may-agent.app", "app.ts"), "export default {};\n");
      writeFileSync(join(appAgentDir, "agent.json"), JSON.stringify({ name: "arc", model: "test", tools: [] }));

      expect(resolveRuntimeAgentDirectory(join(root, "agents"), "arc", join(root, "projects"))?.dir).toBe(appAgentDir);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
