import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface AgentDirectory {
  name: string;
  dir: string;
  agentsRoot: string;
  projectId?: string;
  projectDir?: string;
  relativeDir?: string;
}

function listAgentDirectoriesInRoot(
  agentsRoot: string,
  project?: { projectId: string; projectDir: string; relativeAgentsRoot?: string },
): AgentDirectory[] {
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
      relativeDir: project?.relativeAgentsRoot ? `${project.relativeAgentsRoot}/${entry.name}` : undefined,
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

    if (entry.name.endsWith(".app")) {
      const appDir = resolve(projectsRoot, entry.name);
      const projectId = entry.name.slice(0, -".app".length);
      const domainDir = resolve(projectsRoot, projectId);
      const projectDir = existsSync(domainDir) ? domainDir : appDir;
      const hasAppFrame = existsSync(resolve(appDir, "project.md")) || existsSync(resolve(appDir, "app.ts"));
      if (!hasAppFrame) continue;
      const agentsRoot = resolve(appDir, "agents");
      if (!existsSync(agentsRoot)) continue;
      agents.push(
        ...listAgentDirectoriesInRoot(agentsRoot, {
          projectId,
          projectDir,
          relativeAgentsRoot: `projects/${entry.name}/agents`,
        }),
      );
      continue;
    }

    const projectDir = resolve(projectsRoot, entry.name);
    const hasProjectFrame = existsSync(resolve(projectDir, "project.md")) || existsSync(resolve(projectDir, ".app", "project.md"));
    if (!hasProjectFrame) continue;
    for (const agentsRoot of [resolve(projectDir, "agents"), resolve(projectDir, ".app", "agents")]) {
      if (!existsSync(agentsRoot)) continue;
      agents.push(...listAgentDirectoriesInRoot(agentsRoot, { projectId: entry.name, projectDir }));
    }
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

export function resolveRuntimeAgentDirectory(
  agentsRoot: string,
  agentName: string,
  projectsRoot?: string,
): AgentDirectory | null {
  let selected: AgentDirectory | null = null;
  for (const agentDir of listRuntimeAgentDirectories(agentsRoot, projectsRoot)) {
    if (configuredNameForDirectory(agentDir) !== agentName) continue;
    if (!selected || (!selected.projectId && agentDir.projectId)) {
      selected = agentDir;
    }
  }
  return selected;
}

export function agentProjectRoot(agentDir: AgentDirectory, fallbackProjectRoot: string): string {
  return agentDir.projectDir ?? fallbackProjectRoot;
}

export function agentRelativeDir(agentDir: AgentDirectory): string {
  if (agentDir.relativeDir) return agentDir.relativeDir;
  return agentDir.projectDir
    ? "projects/" + agentDir.projectId + "/agents/" + agentDir.name
    : "agents/" + agentDir.name;
}

export function agentsRootForAgentDir(agentDir: AgentDirectory): string {
  return agentDir.agentsRoot ?? dirname(agentDir.dir);
}
