import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelWithApiKey } from "../../lib/types.js";
import { VALID_TOOL_PRESETS } from "../../lib/tool-preset-registry.js";
import type { EventBus } from "../event-bus.js";
import type { SkillActivationRule } from "../../lib/skills.js";

export interface AgentConfig {
  name: string;
  description: string;
  domain: string;
  model: string; // key into models map
  tools: string[]; // preset names: "coding", "agents", "workflow", etc.
  memoryLimit?: number;
  /** Enable automatic context compaction for long-running sessions. */
  compaction?: boolean;
  /** Block direct delegation to specific agents via agents tool. */
  delegateDeny?: { agents: string[]; hint: string };
  /** Narrow deterministic skill activation for task classes that cannot rely on model retrieval. */
  skillActivationRules?: SkillActivationRule[];
  /** @deprecated Volatile context should be injected at session time, not in system prompt. */
  context_files?: string[];
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

  if (config.skillActivationRules !== undefined) {
    if (!Array.isArray(config.skillActivationRules)) {
      errors.push({
        agent: name,
        field: "skillActivationRules",
        message: '"skillActivationRules" must be an array',
      });
    } else if (config.skillActivationRules.length > 16) {
      errors.push({
        agent: name,
        field: "skillActivationRules",
        message: '"skillActivationRules" supports at most 16 rules',
      });
    } else {
      const skillName = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
      for (const [index, rule] of config.skillActivationRules.entries()) {
        if (!rule || typeof rule !== "object") {
          errors.push({
            agent: name,
            field: `skillActivationRules[${index}]`,
            message: "rule must be an object",
          });
          continue;
        }
        if (typeof rule.skill !== "string" || !skillName.test(rule.skill)) {
          errors.push({
            agent: name,
            field: `skillActivationRules[${index}].skill`,
            message: "skill must be a canonical skill name",
          });
        }
        if (typeof rule.pattern !== "string" || !rule.pattern.trim() || rule.pattern.length > 512) {
          errors.push({
            agent: name,
            field: `skillActivationRules[${index}].pattern`,
            message: "pattern must contain 1 to 512 characters",
          });
          continue;
        }
        try {
          new RegExp(rule.pattern, "i");
        } catch (error) {
          errors.push({
            agent: name,
            field: `skillActivationRules[${index}].pattern`,
            message: `invalid regular expression: ${error instanceof Error ? error.message : String(error)}`,
          });
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
