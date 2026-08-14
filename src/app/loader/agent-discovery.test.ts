import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { agentProjectRoot, agentRelativeDir, listAgentDirectories, listProjectAgentDirectories, resolveRuntimeAgentDirectory } from "./agent-discovery.ts";

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

  it("discovers legacy embedded project-app agents under .app/agents", () => {
    const root = tempRoot();
    try {
      const project = join(root, "alpha-project");
      mkdirSync(join(project, ".app", "agents", "aks-explorer"), { recursive: true });
      writeFileSync(join(project, ".app", "project.md"), "---\nid: alpha-project\nowner: aks-explorer\nstatus: active\n---\n");
      writeFileSync(join(project, ".app", "agents", "aks-explorer", "agent.json"), JSON.stringify({
        name: "aks-explorer",
        model: "test",
        tools: [],
      }));

      expect(listProjectAgentDirectories(root).map((agent) => agent.dir)).toEqual([
        join(project, ".app", "agents", "aks-explorer"),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers Project App V3 agents under sibling .app projects", () => {
    const root = tempRoot();
    try {
      const domainProject = join(root, "alpha-project");
      const appProject = join(root, "alpha-project.app");
      const agentDir = join(appProject, "agents", "aks-explorer");
      mkdirSync(domainProject, { recursive: true });
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(domainProject, "README.md"), "# AKS RP E2E\n");
      writeFileSync(join(appProject, "app.ts"), "export default {};\n");
      writeFileSync(join(appProject, "project.md"), "# alpha-project app\n");
      writeFileSync(join(agentDir, "agent.json"), JSON.stringify({
        name: "aks-explorer",
        model: "test",
        tools: [],
      }));

      const agents = listProjectAgentDirectories(root);
      expect(agents.map((agent) => agent.dir)).toEqual([agentDir]);
      expect(agents[0]?.projectId).toBe("alpha-project");
      expect(agentProjectRoot(agents[0], "fallback")).toBe(domainProject);
      expect(agentRelativeDir(agents[0])).toBe("projects/alpha-project.app/agents/aks-explorer");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers owner agents for App inboxes without a legacy Project App module", () => {
    const root = tempRoot();
    try {
      const appProject = join(root, "evaluation.app");
      const agentDir = join(appProject, "agents", "evaluator");
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(appProject, "inbox.ts"), "export default {} as unknown;\n");
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({ name: "evaluator", model: "test", tools: [] }),
      );

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
