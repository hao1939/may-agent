/**
 * Dynamic agent loader.
 *
 * Scans agents/ for agent.json configs and registers them with SubagentManager.
 * Tool presets map strings like "read-write", "exec", "subagents" to actual tool
 * constructors. Adding a new agent = create agents/<name>/agent.json + restart
 * (or send reload_agents command).
 *
 * Convention-based paths:
 *   agents/<name>/knowledge/   → knowledgeDir
 *   agents/<name>/workspace/   → workspace
 *   agents/<name>/workflows/   → workflowDir (if exists)
 *   agents/<name>/skills/      → skillsDirs (per-agent skills, always included)
 *
 * Skill resolution:
 *   When agent.json includes `"skills": ["file-safety", "error-handling"]`, each
 *   skill name is resolved to `agents/shared/skills/{name}/` and added to skillsDirs.
 *   This gives agents explicit, opt-in control over which shared skills they receive.
 *
 *   Backward compatibility: if `skills` is absent (undefined), ALL shared skills
 *   are loaded (the entire `agents/shared/skills/` directory), preserving the
 *   pre-Phase-1 behavior. An empty array (`"skills": []`) means *no* shared
 *   skills — only per-agent skills from `agents/<name>/skills/`.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Model } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import {
  SubagentManager,
  createCodingTools,
  createReadTool,
  createWorkflowTool,
  createBackgroundExecTool,
  createSocketWatchTool,
  createClaudeCodeTool,
  createGeminiCliTool,
  createCronTool,
  createScrapeTool,
} from "../lib/index.js";
import type { EventBus } from "./event-bus.js";
import { Cron } from "./cron.js";

// ── Agent config schema (agent.json) ────────────────────────────────────

export interface AgentConfig {
  name: string;
  description: string;
  domain: string;
  model: string; // key into models map
  tools: string[]; // preset names: "read-write", "exec", "subagents", etc.
  systemPromptFiles?: string[]; // relative to agent dir
  sharedKnowledge?: string[]; // filenames in agents/shared/
  memoryLimit?: number;
  /** Maximum assistant turns before session is forcibly wrapped up. */
  maxTurns?: number;
  /** Block direct delegation to specific agents via subagents tool. */
  delegateDeny?: { agents: string[]; hint: string };
  /**
   * Explicit list of shared skills to load from agents/shared/skills/{name}/.
   *
   * - Present + non-empty: only listed skills are loaded (selective opt-in).
   * - Present + empty (`[]`): no shared skills loaded (per-agent skills only).
   * - Absent (undefined): ALL shared skills loaded (backward-compatible default).
   */
  skills?: string[];
}

// ── Loader options ──────────────────────────────────────────────────────

export interface AgentLoaderOptions {
  agentsRoot: string;
  projectRoot: string;
  persistDir: string;
  models: Record<string, Model<any>>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
}

// ── Track active session IDs for subagent/workflow tools ────────────────

/** Per-agent session ID tracking. Updated by onSessionStart callback. */
const agentSessionIds = new Map<string, string>();

export function getAgentSessionId(name: string): string | undefined {
  return agentSessionIds.get(name);
}

export function setAgentSessionId(name: string, sid: string): void {
  agentSessionIds.set(name, sid);
}

// ── Tool factories ──────────────────────────────────────────────────────

/** Per-agent cleanup functions. Called when agent sessions end. */
const agentCleanups = new Map<string, Array<() => void>>();

/** Per-agent cron instances. Created for agents with the "cron" tool preset. */
const agentCrons = new Map<string, Cron>();

/** Get all cron instances (for starting/stopping from may.ts). */
export function getAgentCrons(): Map<string, Cron> {
  return agentCrons;
}

/** Register a cleanup function for an agent. */
function addCleanup(agentName: string, fn: () => void): void {
  const existing = agentCleanups.get(agentName);
  if (existing) {
    existing.push(fn);
  } else {
    agentCleanups.set(agentName, [fn]);
  }
}

/** Run all cleanup functions for an agent and clear the list. */
export function runAgentCleanup(agentName: string): void {
  const fns = agentCleanups.get(agentName);
  if (!fns) return;
  for (const fn of fns) {
    try { fn(); } catch { /* best-effort */ }
  }
  agentCleanups.delete(agentName);
}

function buildTools(
  config: AgentConfig,
  opts: AgentLoaderOptions,
): AgentTool[] {
  const { projectRoot, persistDir, manager, bus } = opts;
  const agentDir = resolve(opts.agentsRoot, config.name);
  const tools: AgentTool[] = [];

  for (const preset of config.tools) {
    switch (preset) {
      case "coding":
        // Full coding toolset: read + bash + edit + write
        tools.push(...createCodingTools(projectRoot));
        break;

      case "read-write": {
        // Legacy preset — maps to coding tools (read + bash + edit + write)
        tools.push(...createCodingTools(projectRoot));
        break;
      }

      case "read-only": {
        tools.push(createReadTool(projectRoot) as any);
        break;
      }

      case "exec":
      case "exec-readonly":
      case "exec-master":
        // Legacy exec presets — now no-ops (bash is included in coding tools)
        // Agents should use "coding" preset instead
        bus.emit({ type: "info", message: `[loader] Preset "${preset}" for agent "${config.name}" is deprecated — bash is included in "coding" preset` });
        break;

      case "claude-code":
        tools.push(createClaudeCodeTool({
          cwd: projectRoot,
          maxOutputLength: 80_000,
        }));
        break;

      case "gemini-cli":
        tools.push(createGeminiCliTool({
          cwd: projectRoot,
          maxOutputLength: 80_000,
        }));
        break;

      case "agents": {
        // V2 agents tool — 5 actions: call, list, peek, steer, cancel
        const denyConfig = config.delegateDeny;
        tools.push(manager.createAgentsTool({
          getCallerSessionId: () => agentSessionIds.get(config.name),
          getCallerAgentName: () => config.name,
          callDeny: denyConfig ? { agents: denyConfig.agents, hint: denyConfig.hint } : undefined,
        }));
        break;
      }

      case "workflow": {
        const workflowDir = resolve(agentDir, "workflows");
        tools.push(createWorkflowTool({
          manager,
          workflowDir,
          persistDir,
          callerSessionId: () => {
            const sid = agentSessionIds.get(config.name);
            if (!sid) throw new Error(`No active ${config.name} session`);
            return sid;
          },
          onEvent: (event) => {
            const label = `workflow:${config.name}`;
            if (event.type === "workflow_start") {
              bus.emit({ type: "info", message: `[${label}] Starting: ${event.workflow}` });
            } else if (event.type === "workflow_done") {
              bus.emit({ type: "info", message: `[${label}] Done: ${event.summary.slice(0, 100)}` });
            } else if (event.type === "workflow_escalate") {
              bus.emit({ type: "info", message: `[${label}] Escalated: ${event.reason}` });
            } else if (event.type === "step_start") {
              bus.emit({ type: "info", message: `[${label}] Step: ${event.step}` });
            }
          },
        }));
        break;
      }


      case "background-exec": {
        const bgExec = createBackgroundExecTool({
          cwd: projectRoot,
          denyMessage: "Do not explore outside the project root. Use relative paths.",
          allowAgentSpawn: true, // Coach agents need to spawn coachee processes
        });
        tools.push(bgExec.tool);
        addCleanup(config.name, bgExec.cleanup);
        break;
      }

      case "socket-watch": {
        const sw = createSocketWatchTool({
          manager,
          getSessionId: () => {
            const sid = agentSessionIds.get(config.name);
            if (!sid) throw new Error(`No active ${config.name} session`);
            return sid;
          },
        });
        tools.push(sw.tool);
        addCleanup(config.name, sw.cleanup);
        break;
      }

      case "cron": {
        const cronPath = resolve(agentDir, "cron.json");
        let cron = agentCrons.get(config.name);
        if (!cron) {
          cron = new Cron(
            cronPath,
            manager,
            () => {
              const sid = agentSessionIds.get(config.name);
              if (!sid) throw new Error(`No active ${config.name} session`);
              return sid;
            },
            (msg) => bus.emit({ type: "info", message: `[cron:${config.name}] ${msg}` }),
          );
          cron.load();
          agentCrons.set(config.name, cron);
        }
        tools.push(createCronTool({
          configPath: cronPath,
          onConfigChange: () => cron!.reload(),
          cronEnabled: opts.cronEnabled,
        }));
        break;
      }

      case "scrape":
        tools.push(createScrapeTool());
        break;

      default:
        bus.emit({ type: "info", message: `[loader] Unknown tool preset "${preset}" for agent "${config.name}" — skipping` });
    }
  }

  return tools;
}

// ── Resolve system prompt files ─────────────────────────────────────────

function resolvePromptFiles(config: AgentConfig, agentsRoot: string): string[] {
  const agentDir = resolve(agentsRoot, config.name);
  const files: string[] = [];

  // Shared knowledge files first
  if (config.sharedKnowledge) {
    for (const filename of config.sharedKnowledge) {
      files.push(resolve(agentsRoot, "shared", filename));
    }
  }

  // Agent-specific system prompt files (relative to agent dir)
  if (config.systemPromptFiles) {
    for (const relPath of config.systemPromptFiles) {
      files.push(resolve(agentDir, relPath));
    }
  }

  return files;
}

// ── Skill resolution ────────────────────────────────────────────────────

/**
 * Resolve skill directories for an agent based on its `skills` config.
 *
 * Resolution strategy:
 *   1. If `config.skills` is undefined (absent from agent.json):
 *      → Load ALL shared skills: [agents/shared/skills/]
 *      This preserves backward compatibility for agents that haven't
 *      adopted the explicit skills array yet.
 *
 *   2. If `config.skills` is an array (even empty):
 *      → Load ONLY the named skills: [agents/shared/skills/file-safety/, ...]
 *      An empty array means "no shared skills" — the agent only gets
 *      its per-agent skills from agents/<name>/skills/ (handled by manager.ts).
 *
 * Per-agent skills (agents/<name>/skills/) are always included by
 * manager.ts's resolveSystemPrompt(), independent of this function.
 *
 * @returns Array of absolute directory paths to pass as skillsDirs, or undefined
 *          if no directories should be added.
 */
function resolveSkillsDirs(
  config: AgentConfig,
  agentsRoot: string,
  bus: EventBus,
): string[] | undefined {
  const sharedSkillsDir = resolve(agentsRoot, "shared", "skills");

  // Case 1: No skills field → backward-compatible: load ALL shared skills
  if (config.skills === undefined) {
    return existsSync(sharedSkillsDir) ? [sharedSkillsDir] : undefined;
  }

  // Case 2: Explicit skills array → resolve each to its specific directory
  if (!Array.isArray(config.skills)) {
    bus.emit({
      type: "info",
      message: `[loader] Agent "${config.name}" has invalid "skills" (expected array) — falling back to all shared skills`,
    });
    return existsSync(sharedSkillsDir) ? [sharedSkillsDir] : undefined;
  }

  // Empty array: agent explicitly opts out of shared skills
  if (config.skills.length === 0) {
    return undefined;
  }

  // Resolve each skill name to agents/shared/skills/{name}/
  const dirs: string[] = [];
  for (const skillName of config.skills) {
    const skillDir = resolve(sharedSkillsDir, skillName);
    if (existsSync(skillDir)) {
      dirs.push(skillDir);
    } else {
      bus.emit({
        type: "info",
        message: `[loader] Agent "${config.name}" references skill "${skillName}" but ${skillDir} does not exist — skipping`,
      });
    }
  }

  return dirs.length > 0 ? dirs : undefined;
}

// ── Validation ──────────────────────────────────────────────────────────

const VALID_TOOL_PRESETS = new Set([
  "coding", "read-write", "read-only", "exec", "exec-readonly", "exec-master",
  "claude-code", "gemini-cli",
  "agents", "workflow", "background-exec", "socket-watch", "cron", "scrape",
]);

const REQUIRED_FIELDS: (keyof AgentConfig)[] = ["name", "description", "domain", "model", "tools"];

export interface ValidationError {
  agent: string;
  field: string;
  message: string;
}

/**
 * Validate an agent config. Returns errors (empty array = valid).
 */
export function validateAgentConfig(
  config: AgentConfig,
  models: Record<string, any>,
  agentsRoot: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const name = config.name || "<unnamed>";

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      errors.push({ agent: name, field, message: `Missing required field "${field}"` });
    }
  }

  // Model must exist in the models map
  if (config.model && !models[config.model]) {
    errors.push({ agent: name, field: "model", message: `Unknown model "${config.model}"` });
  }

  // Tool presets must be valid
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

  // System prompt files should exist
  if (config.systemPromptFiles) {
    const agentDir = resolve(agentsRoot, config.name);
    for (const relPath of config.systemPromptFiles) {
      const absPath = resolve(agentDir, relPath);
      if (!existsSync(absPath)) {
        errors.push({ agent: name, field: "systemPromptFiles", message: `File not found: ${relPath}` });
      }
    }
  }

  // Shared knowledge files should exist
  if (config.sharedKnowledge) {
    for (const filename of config.sharedKnowledge) {
      const absPath = resolve(agentsRoot, "shared", filename);
      if (!existsSync(absPath)) {
        errors.push({ agent: name, field: "sharedKnowledge", message: `Shared file not found: ${filename}` });
      }
    }
  }

  // Validate skill names reference existing directories
  if (config.skills !== undefined) {
    if (!Array.isArray(config.skills)) {
      errors.push({ agent: name, field: "skills", message: `"skills" must be an array of skill names` });
    } else {
      const sharedSkillsDir = resolve(agentsRoot, "shared", "skills");
      for (const skillName of config.skills) {
        if (typeof skillName !== "string") {
          errors.push({ agent: name, field: "skills", message: `Skill name must be a string, got ${typeof skillName}` });
          continue;
        }
        const skillDir = resolve(sharedSkillsDir, skillName);
        if (!existsSync(skillDir)) {
          errors.push({ agent: name, field: "skills", message: `Shared skill not found: ${skillName} (expected ${skillDir})` });
        }
      }
    }
  }

  return errors;
}

// ── Load and register agents ────────────────────────────────────────────

function loadAgentConfig(agentDir: string, bus: EventBus): AgentConfig | null {
  const configPath = resolve(agentDir, "agent.json");
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as AgentConfig;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[loader] Failed to parse ${configPath}: ${msg}` });
    return null;
  }
}

export interface LoadResult {
  added: string[];
  updated: string[];
}

/**
 * Scan agents/ directory, load and validate agent.json configs, register with manager.
 * Re-registers existing agents so config changes (model, tools, etc.)
 * take effect on next session. Active sessions keep their old config.
 * Throws on validation errors (fail-fast prevents running with broken config).
 */
export function loadAgents(opts: AgentLoaderOptions): LoadResult {
  const { agentsRoot, projectRoot, models, manager } = opts;
  const added: string[] = [];
  const updated: string[] = [];
  const allErrors: ValidationError[] = [];

  const entries = readdirSync(agentsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared") continue; // shared/ is not an agent

    const agentDir = resolve(agentsRoot, entry.name);
    const config = loadAgentConfig(agentDir, opts.bus);
    if (!config) continue;

    // Validate before registering
    const errors = validateAgentConfig(config, models, agentsRoot);
    if (errors.length > 0) {
      allErrors.push(...errors);
      continue;
    }

    const isUpdate = manager.hasAgent(config.name);

    const model = models[config.model];
    const knowledgeDir = resolve(agentDir, "knowledge");
    const workspace = resolve(agentDir, "workspace");

    // Resolve shared skills: explicit list or all-shared fallback
    const skillsDirs = resolveSkillsDirs(config, agentsRoot, opts.bus);

    manager.register({
      name: config.name,
      description: config.description,
      domain: config.domain,
      model,
      tools: buildTools(config, opts),
      systemPromptFiles: resolvePromptFiles(config, agentsRoot),
      knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
      workspace: existsSync(workspace) ? workspace : undefined,
      skillsDirs,
      projectRoot,
      apiKey: (model as any).apiKey,
      memoryLimit: config.memoryLimit,
      maxTurns: config.maxTurns,
    });

    if (isUpdate) {
      updated.push(config.name);
    } else {
      added.push(config.name);
    }
  }

  // Report validation errors as warnings — skip bad agents, don't crash
  if (allErrors.length > 0) {
    const report = allErrors
      .map((e) => `  ${e.agent}.${e.field}: ${e.message}`)
      .join("\n");
    opts.bus.emit({ type: "info", message: `[loader] Skipped agents with config errors:\n${report}` });
  }

  return { added, updated };
}

/**
 * Reload: scan agent.json files, register new agents and update existing ones.
 * Active sessions keep their old config; only new sessions use the updated definition.
 * Returns { added, updated, errors } — errors are reported but don't crash.
 */
export function reloadAgents(opts: AgentLoaderOptions): { added: string[]; updated: string[]; errors: string[] } {
  try {
    const result = loadAgents(opts);
    return { ...result, errors: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { added: [], updated: [], errors: [msg] };
  }
}

// ── Agent handler auto-discovery ──────────────────────────────────────────

import type { HandlerContext, HandlerModule } from "../lib/handler-context.js";
import type { CronEntry } from "../lib/cron-tool.js";

/**
 * Auto-discover and register JS handlers for cron entries.
 *
 * For each agent with a cron, scans its cron.json for entries with a `handler`
 * field. The handler field names a file in agents/<name>/handlers/<handler>.js.
 * The file must export { create } conforming to HandlerModule.
 *
 * Call this after loadAgents() completes.
 */
export async function loadAgentHandlers(opts: AgentLoaderOptions & {
  /** Function to get an agent's active session ID (for followUp). */
  getSessionId: (agentName: string) => string | null;
}): Promise<{ registered: string[]; errors: string[] }> {
  const { agentsRoot, persistDir, projectRoot, manager, bus } = opts;
  const registered: string[] = [];
  const errors: string[] = [];

  for (const [agentName, cron] of agentCrons) {
    const entries = cron.getEntries();
    const handlersNeeded = entries.filter(e => e.handler);

    if (handlersNeeded.length === 0) continue;

    // Build a HandlerContext for this agent
    const ctx: HandlerContext = {
      manager,
      persistDir,
      projectRoot,
      agentsRoot,
      agentName,
      getSessionId: () => opts.getSessionId(agentName),
      log: (msg) => bus.emit({ type: "info", message: msg }),
      notify: (msg) => {
        bus.emit({ type: "text", agent: agentName, text: msg, channel: "chat" });
        bus.emit({ type: "prompt", message: agentName, channel: "chat" });
      },
      triggerNow: (entryName: string) => cron.triggerNow(entryName),
    };

    // Group entries by handler file (multiple entries can share one handler file)
    const byFile = new Map<string, CronEntry[]>();
    for (const entry of handlersNeeded) {
      const file = entry.handler!;
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file)!.push(entry);
    }

    for (const [handlerFile, fileEntries] of byFile) {
      // Resolve handler: look for .js (compiled) first, then .ts  
      const handlerDir = resolve(agentsRoot, agentName, "handlers");
      const jsPath = resolve(handlerDir, `${handlerFile}.js`);
      const tsPath = resolve(handlerDir, `${handlerFile}.ts`);

      // We need the compiled .js version. If only .ts exists, that's an error.
      let modulePath: string;
      if (existsSync(jsPath)) {
        modulePath = jsPath;
      } else if (existsSync(tsPath)) {
        // Try tsx import via the .ts path — Node with tsx loader can handle it
        modulePath = tsPath;
      } else {
        const msg = `Handler file not found: ${handlerDir}/${handlerFile}.(js|ts)`;
        errors.push(msg);
        bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
        continue;
      }

      try {
        const mod: HandlerModule = await import(modulePath);
        if (typeof mod.create !== "function") {
          const msg = `Handler ${modulePath} does not export create()`;
          errors.push(msg);
          bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
          continue;
        }

        for (const entry of fileEntries) {
          const fn = mod.create(ctx, entry);
          cron.registerHandler(entry.name, fn);
          registered.push(`${agentName}:${entry.name}`);
          bus.emit({ type: "info", message: `[handler] Registered ${agentName}:${entry.name} → ${handlerFile}.ts` });
        }
      } catch (err) {
        const msg = `Failed to import handler ${modulePath}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
      }
    }
  }

  return { registered, errors };
}
