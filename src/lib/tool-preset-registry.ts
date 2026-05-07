import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Tool preset registry.
 *
 * Keep the config allowlist and loader wiring conformance in one small place.
 * A preset in VALID_TOOL_PRESETS must either have a buildTools() case or be
 * removed from agent.json/docs.
 */

export const VALID_TOOL_PRESETS = new Set([
  "coding",
  "read-only",
  "agents",
  "workflow",
  "background-exec",
  "cron",
  "scrape",
  "finish",
  "checkpoint",
  "system-status",
  "system_status",
  "message",
  "query_db",
  "query-db",
]);

export const HANDLED_TOOL_PRESETS = new Set([
  "coding",
  "read-only",
  "agents",
  "workflow",
  "background-exec",
  "cron",
  "scrape",
  "finish",
  "checkpoint",
  "system-status",
  "system_status",
  "message",
  "query_db",
  "query-db",
]);

export function findUnhandledToolPresets(): string[] {
  return [...VALID_TOOL_PRESETS].filter((preset) => !HANDLED_TOOL_PRESETS.has(preset)).sort();
}

export interface ToolPresetConfigIssue {
  agent: string;
  field: "extends" | "tools";
  message: string;
  preset?: string;
}

export function findFleetToolPresetIssues(agentsRoot: string): ToolPresetConfigIssue[] {
  const issues: ToolPresetConfigIssue[] = [];
  if (!existsSync(agentsRoot)) {
    return [{ agent: "<fleet>", field: "tools", message: `Agents root not found: ${agentsRoot}` }];
  }

  const entries = readdirSync(agentsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared" || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const agentJson = resolve(agentsRoot, entry.name, "agent.json");
    if (!existsSync(agentJson)) continue;

    let config: { name?: string; extends?: string; tools?: unknown };
    try {
      config = JSON.parse(readFileSync(agentJson, "utf-8"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      issues.push({ agent: entry.name, field: "tools", message: `Invalid agent.json: ${message}` });
      continue;
    }

    const agent = config.name || entry.name;
    if (config.extends) {
      issues.push({
        agent,
        field: "extends",
        message: "`extends` / archetype inheritance is legacy; each agent must declare a complete agent.json",
      });
    }

    if (!Array.isArray(config.tools)) {
      issues.push({ agent, field: "tools", message: "`tools` must be an array" });
      continue;
    }

    for (const preset of config.tools) {
      if (typeof preset !== "string") {
        issues.push({ agent, field: "tools", message: `Tool preset must be a string: ${String(preset)}` });
        continue;
      }
      if (!VALID_TOOL_PRESETS.has(preset)) {
        issues.push({ agent, field: "tools", preset, message: `Unknown tool preset "${preset}"` });
      } else if (!HANDLED_TOOL_PRESETS.has(preset)) {
        issues.push({ agent, field: "tools", preset, message: `Tool preset "${preset}" is valid but not wired at runtime` });
      }
    }
  }

  return issues;
}
