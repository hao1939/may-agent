import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export interface AgentDirectory {
  name: string;
  dir: string;
}

export function listAgentDirectories(agentsRoot: string): AgentDirectory[] {
  const agents: AgentDirectory[] = [];
  for (const entry of readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared") continue;
    if (entry.name.startsWith("_")) continue;
    agents.push({ name: entry.name, dir: resolve(agentsRoot, entry.name) });
  }
  return agents;
}

export function listConfiguredAgentNames(agentsRoot: string): string[] {
  const names = new Set<string>();
  for (const entry of readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared" || entry.name === "gym" || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

    const configPath = resolve(agentsRoot, entry.name, "agent.json");
    if (!existsSync(configPath)) continue;

    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8")) as { name?: string; disabled?: boolean };
      if (!config.disabled) names.add(config.name ?? entry.name);
    } catch {
      names.add(entry.name);
    }
  }
  return [...names].sort();
}
