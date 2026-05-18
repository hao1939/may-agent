import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface AgentDirectory {
  name: string;
  dir: string;
  agentsRoot: string;
  projectId?: string;
  projectDir?: string;
}

function listAgentDirectoriesInRoot(agentsRoot: string, project?: { projectId: string; projectDir: string }): AgentDirectory[] {
  if (!existsSync(agentsRoot)) return [];
  const agents: AgentDirectory[] = [];
  for (const entry of readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared" || entry.name === "gym") continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    agents.push({
      name: entry.name,
      dir: resolve(agentsRoot, entry.name),
      agentsRoot: resolve(agentsRoot),
      projectId: project?.projectId,
      projectDir: project?.projectDir,
    });
  }
  return agents;
}

export function listAgentDirectories(agentsRoot: string): AgentDirectory[] {
  return listAgentDirectoriesInRoot(resolve(agentsRoot));
}

export function listProjectAgentDirectories(projectsRoot: string): AgentDirectory[] {
  if (!existsSync(projectsRoot)) return [];
  const agents: AgentDirectory[] = [];
  for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const projectDir = resolve(projectsRoot, entry.name);
    const agentsRoot = resolve(projectDir, "agents");
    if (!existsSync(resolve(projectDir, "project.md")) || !existsSync(agentsRoot)) continue;
    agents.push(...listAgentDirectoriesInRoot(agentsRoot, { projectId: entry.name, projectDir }));
  }
  return agents;
}

export function listRuntimeAgentDirectories(agentsRoot: string, projectsRoot?: string): AgentDirectory[] {
  return [
    ...listAgentDirectories(agentsRoot),
    ...(projectsRoot ? listProjectAgentDirectories(projectsRoot) : []),
  ];
}

function configuredNameForDirectory(agentDir: AgentDirectory): string | null {
  const configPath = resolve(agentDir.dir, "agent.json");
  if (!existsSync(configPath)) return null;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as { name?: string; disabled?: boolean };
    if (config.disabled) return null;
    return config.name ?? agentDir.name;
  } catch {
    return agentDir.name;
  }
}

export function listConfiguredAgentNames(agentsRoot: string, projectsRoot?: string): string[] {
  const names = new Set<string>();
  for (const agentDir of listRuntimeAgentDirectories(agentsRoot, projectsRoot)) {
    const name = configuredNameForDirectory(agentDir);
    if (name) names.add(name);
  }
  return [...names].sort();
}

export function agentProjectRoot(agentDir: AgentDirectory, fallbackProjectRoot: string): string {
  return agentDir.projectDir ?? fallbackProjectRoot;
}

export function agentRelativeDir(agentDir: AgentDirectory): string {
  return agentDir.projectDir
    ? "projects/" + agentDir.projectId + "/agents/" + agentDir.name
    : "agents/" + agentDir.name;
}

export function agentsRootForAgentDir(agentDir: AgentDirectory): string {
  return agentDir.agentsRoot ?? dirname(agentDir.dir);
}
