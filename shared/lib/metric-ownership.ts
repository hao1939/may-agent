import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_OWNER = "may";

export function listConfiguredAgents(agentsRoot: string): Set<string> {
  try {
    return new Set(readdirSync(agentsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_") && entry.name !== "shared" && entry.name !== "gym")
      .map(entry => {
        const agentJson = join(agentsRoot, entry.name, "agent.json");
        if (!existsSync(agentJson)) return null;
        try {
          const config = JSON.parse(readFileSync(agentJson, "utf8")) as { name?: string; disabled?: boolean };
          if (config.disabled) return null;
          return config.name ?? entry.name;
        } catch {
          return entry.name;
        }
      })
      .filter((name): name is string => Boolean(name)));
  } catch {
    return new Set();
  }
}

export function resolveMetricOwner(
  metricId: string,
  configuredAgents: Set<string>,
  explicitOwner?: string | null,
  projectOwner?: string | null,
): string {
  if (explicitOwner?.trim()) return explicitOwner.trim();
  if (projectOwner?.trim()) return projectOwner.trim();
  const prefix = metricId.split(".")[0];
  return configuredAgents.has(prefix) ? prefix : DEFAULT_OWNER;
}
