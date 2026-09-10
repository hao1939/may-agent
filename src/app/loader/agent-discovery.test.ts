import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  agentProjectRoot,
  listAgentDirectories,
  listConfiguredAgentNames,
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
      const domainProject = join(root, "alpha-project");
      const appProject = join(root, "alpha-project.app");
      const agentDir = join(appProject, "agents", "aks-explorer");
      mkdirSync(domainProject, { recursive: true });
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(domainProject, "README.md"), "# Alpha Project\n");
      writeFileSync(join(appProject, "app.ts"), "export default {};\n");
      writeFileSync(join(appProject, "project.md"), "# alpha-project app\n");
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
      expect(agents[0]?.projectId).toBe("alpha-project");
      expect(agentProjectRoot(agents[0], "fallback")).toBe(domainProject);
      expect(agents[0].relativeDir).toBe("projects/alpha-project.app/agents/aks-explorer");
      // The live installation controls discovery even when code is pinned to a release.
      const canonicalRoot = join(root, "installation");
      mkdirSync(join(canonicalRoot, "alpha-project.app"), { recursive: true });
      const marker = join(canonicalRoot, "alpha-project.app", ".disabled");
      writeFileSync(marker, "");
      expect(listProjectAgentDirectories(root, canonicalRoot)).toEqual([]);
      expect(listConfiguredAgentNames(join(root, "agents"), root, canonicalRoot)).toEqual([]);
      rmSync(marker);
      expect(listConfiguredAgentNames(join(root, "agents"), root, canonicalRoot)).toEqual(["aks-explorer"]);
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
