import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelWithApiKey } from "../../lib/types.js";
import { VALID_TOOL_PRESETS } from "../../lib/tool-preset-registry.js";
import { validProtectedFileWrites } from "../../lib/tools/cross-edit-guard.js";
import type { EventBus } from "../core/events/bus.js";

export interface AgentConfig {
  name: string;
  description: string;
  domain: string;
  model: string; // key into models map
  tools: string[]; // preset names: "coding", "agents", "workflow", etc.
  /** Reviewed installation-relative protected files this execution may write. No names, globs or directory grants. */
  protectedFileWrites?: string[];
  memoryLimit?: number;
  /** Enable automatic context compaction for long-running sessions. */
  compaction?: boolean;
  /** Block direct delegation to specific agents via agents tool. */
  delegateDeny?: { agents: string[]; hint: string };
  /** @deprecated Volatile context should be injected at session time, not in system prompt. */
  context_files?: string[];
  /** @deprecated Ignored compatibility field from pre-catalog snapshots. */
  skillActivationRules?: unknown;
}

export interface ValidationError {
  agent: string;
  field: string;
  message: string;
}

const REQUIRED_FIELDS: (keyof AgentConfig)[] = ["name", "description", "domain", "model", "tools"];

export function validateAgentConfig(
  config: AgentConfig,
  models: Record<string, ModelWithApiKey>,
  _agentsRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const name = config.name || "<unnamed>";

  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      errors.push({ agent: name, field, message: `Missing required field "${field}"` });
    }
  }

  if (config.model && !models[config.model]) {
    errors.push({ agent: name, field: "model", message: `Unknown model "${config.model}"` });
  }

  if (config.protectedFileWrites !== undefined && !validProtectedFileWrites(config.protectedFileWrites)) {
    errors.push({ agent: name, field: "protectedFileWrites", message: "Expected exact installation-relative file paths without traversal, globs or directory grants" });
  }

  if (config.tools) {
    if (!Array.isArray(config.tools)) {
      errors.push({ agent: name, field: "tools", message: `"tools" must be an array` });
    } else {
      for (const preset of config.tools) {
        if (!VALID_TOOL_PRESETS.has(preset)) {
          errors.push({ agent: name, field: "tools", message: `Unknown tool preset "${preset}"` });
        }
      }
    }
  }

  return errors;
}

/** Read an agent definition without reporting through hosted infrastructure. */
export function readAgentConfigFile(agentDir: string): AgentConfig | null {
  const configPath = resolve(agentDir, "agent.json");
  if (!existsSync(configPath)) return null;
  const raw = readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as AgentConfig & { disabled?: boolean };
  return config.disabled ? null : config;
}

export function loadAgentConfig(agentDir: string, bus: EventBus): AgentConfig | null {
  const configPath = resolve(agentDir, "agent.json");

  try {
    return readAgentConfigFile(agentDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[loader] Failed to parse ${configPath}: ${msg}` });
    bus.emit({
      type: "agent.config_invalid",
      source: "loader",
      owner: "agent:may",
      urgency: "immediate",
      data: {
        agent: agentDir.split(/[\\/]/).pop() || "<unknown>",
        count: 1,
        message: `Failed to parse ${configPath}: ${msg}`,
        priority: "P0",
      },
    });
    return null;
  }
}
