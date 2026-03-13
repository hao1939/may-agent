/**
 * Dynamic agent loader.
 *
 * Scans agents/ for agent.json configs and registers them with SubagentManager.
 * Tool presets map strings like "coding", "agents", "workflow" to actual tool
 * constructors. Adding a new agent = create agents/<name>/agent.json + restart
 * (or send reload_agents command).
 *
 * Convention-based paths:
 *   agents/<name>/knowledge/   → knowledgeDir
 *   agents/<name>/workspace/   → workspace
 *   agents/<name>/workflows/   → workflowDir (if exists)
 *
 * System prompt is assembled from convention files:
 *   agents/<name>/SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, knowledge/INDEX.md
 * No config-driven prompt injection — agent.json is purely operational.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
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
  createFinishTool,
} from "../lib/index.js";
import { createAgentGrowthTools } from "../lib/tools/agent-growth.js";
import type { EventBus } from "./event-bus.js";
import { Cron } from "./cron.js";

// ── Agent config schema (agent.json) ────────────────────────────────────

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
    try {
      fn();
    } catch {
      /* best-effort */
    }
  }
  agentCleanups.delete(agentName);
}

// ── Protected path guard (P53 enforcement) ─────────────────────────────

/**
 * Files that agents may NOT write/edit in other agents' directories.
 * These are identity-critical files — only the owning agent (or human) may modify them.
 */
const PROTECTED_FILENAMES = new Set(["SOUL.md", "agent.json", "LESSONS.md"]);

/**
 * Strings that trigger bash command blocking (P53 bash guard).
 * Any bash command containing these substrings is blocked to prevent
 * bypassing write/edit protections via shell commands (e.g. echo "..." > SOUL.md).
 */
const BASH_PROTECTED_STRINGS = ["SOUL.md", "agent.json", "LESSONS.md", "philosophy.md"];

/** Agents exempt from bash command P53 blocking (system supervisors). */
const BASH_GUARD_EXEMPT_AGENTS = new Set(["may"]);

/**
 * Check whether a resolved absolute path targets a protected file in another agent's directory.
 * Returns a block message if the write should be denied, or null if allowed.
 */
export function checkProtectedPath(
  absolutePath: string,
  agentName: string,
  agentsRoot: string,
): string | null {
  const rel = relative(agentsRoot, absolutePath);
  // Path must be inside agentsRoot and not escape it
  if (rel.startsWith("..") || rel.startsWith(sep + sep)) return null;

  const parts = rel.split(sep);
  // Must be at least agents/<name>/<file>
  if (parts.length < 2) return null;

  const targetAgent = parts[0];
  const fileName = parts[parts.length - 1];

  // Allow writes to own agent directory
  if (targetAgent === agentName) return null;
  // Allow writes to shared/ directory
  if (targetAgent === "shared") return null;
  // Allow writes to .lab/ directory (sandbox/fork for agent growth system)
  if (targetAgent === ".lab") return null;

  // Block writes to protected files in other agents' directories
  if (PROTECTED_FILENAMES.has(fileName)) {
    return `⚠️ WRITE BLOCKED (P53): Cannot modify ${fileName} in agents/${targetAgent}/. ` +
      `Only the owning agent or a human may edit identity-critical files ` +
      `(${[...PROTECTED_FILENAMES].join(", ")}). ` +
      `You are "${agentName}" — you may only modify these files in agents/${agentName}/.`;
  }

  return null;
}

/**
 * Check if a bash command references protected identity files.
 * Returns a block message if the command should be denied, or null if allowed.
 */
export function checkBashCommand(command: string, agentName: string): string | null {
  // Exempt agents (system supervisors) bypass bash guard
  if (BASH_GUARD_EXEMPT_AGENTS.has(agentName)) return null;

  for (const protectedStr of BASH_PROTECTED_STRINGS) {
    if (command.includes(protectedStr)) {
      return `⚠️ BASH BLOCKED (P53): Command references identity file "${protectedStr}". ` +
        `Agents cannot mention identity files (${BASH_PROTECTED_STRINGS.join(", ")}) in bash commands. ` +
        `This prevents bypassing write protections via shell. ` +
        `Use the read() tool to read these files. You may NOT edit them via bash.`;
    }
  }

  return null;
}

/**
 * Wrap write, edit, and bash tools with guards that enforce P53/P70 protections.
 * - write/edit: blocks cross-agent modifications to identity-critical files.
 * - bash: blocks commands that reference identity file names (prevents shell bypass).
 */
function wrapToolsWithPathGuard(
  tools: AgentTool[],
  agentName: string,
  agentsRoot: string,
  projectRoot: string,
): AgentTool[] {
  return tools.map((tool) => {
    // Wrap bash tool with P53 command scanner
    if (tool.name === "bash") {
      return {
        ...tool,
        execute: async (
          toolCallId: string,
          params: unknown,
          signal?: AbortSignal,
        ) => {
          const p = params as { command?: string };
          if (p.command) {
            const blockMessage = checkBashCommand(p.command, agentName);
            if (blockMessage) {
              return {
                content: [{ type: "text" as const, text: blockMessage }],
                details: undefined,
              };
            }
          }
          return tool.execute(toolCallId, params, signal);
        },
      };
    }

    // Wrap write/edit tools with P53 path guard
    if (tool.name !== "write" && tool.name !== "edit") return tool;

    return {
      ...tool,
      execute: async (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
      ) => {
        const p = params as { path?: string };
        if (p.path) {
          const absolutePath = resolve(projectRoot, p.path);
          const blockMessage = checkProtectedPath(absolutePath, agentName, agentsRoot);
          if (blockMessage) {
            return {
              content: [{ type: "text" as const, text: blockMessage }],
              details: undefined,
            };
          }
        }
        return tool.execute(toolCallId, params, signal);
      },
    };
  });
}

function buildTools(config: AgentConfig, opts: AgentLoaderOptions): AgentTool[] {
  const { projectRoot, persistDir, manager, bus } = opts;
  const agentDir = resolve(opts.agentsRoot, config.name);
  const tools: AgentTool[] = [];

  for (const preset of config.tools) {
    switch (preset) {
      case "coding":
        // Full coding toolset: read + bash + edit + write
        tools.push(...createCodingTools(projectRoot, { agentName: config.name }));
        break;

      case "read-write": {
        // Legacy preset — maps to coding tools (read + bash + edit + write)
        tools.push(...createCodingTools(projectRoot, { agentName: config.name }));
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
        bus.emit({
          type: "info",
          message: `[loader] Preset "${preset}" for agent "${config.name}" is deprecated — bash is included in "coding" preset`,
        });
        break;

      case "claude-code":
        tools.push(
          createClaudeCodeTool({
            cwd: projectRoot,
            maxOutputLength: 80_000,
          }),
        );
        break;

      case "gemini-cli":
        tools.push(
          createGeminiCliTool({
            cwd: projectRoot,
            maxOutputLength: 80_000,
          }),
        );
        break;

      case "agents": {
        // V2 agents tool — 5 actions: call, send, list, peek, cancel
        const denyConfig = config.delegateDeny;
        tools.push(
          manager.createAgentsTool({
            getCallerSessionId: () => agentSessionIds.get(config.name),
            getCallerAgentName: () => config.name,
            callDeny: denyConfig ? { agents: denyConfig.agents, hint: denyConfig.hint } : undefined,
            agentsRoot: opts.agentsRoot,
            triggerHeartbeat: (agentName: string) => {
              // All heartbeat entries live in May's cron.json
              // Entry names: "heartbeat" (for may), "heartbeat-{agent}" (for others)
              for (const cron of agentCrons.values()) {
                if (cron.triggerNow(`heartbeat-${agentName}`)) return true;
                if (cron.triggerNow("heartbeat") && agentName === "may") return true;
              }
              return false;
            },
          }),
        );
        break;
      }

      case "workflow": {
        const workflowDir = resolve(agentDir, "workflows");
        tools.push(
          createWorkflowTool({
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
          }),
        );
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
            opts.projectRoot,
            (msg) => {
              bus.emit({ type: "text", agent: config.name, text: msg, channel: "chat" });
              bus.emit({ type: "prompt", message: config.name, channel: "chat" });
            },
          );
          cron.load();
          agentCrons.set(config.name, cron);
        }
        tools.push(
          createCronTool({
            configPath: cronPath,
            onConfigChange: () => cron!.reload(),
            cronEnabled: opts.cronEnabled,
          }),
        );
        break;
      }

      case "scrape":
        tools.push(createScrapeTool());
        break;

      case "finish": {
        const sharedDir = resolve(opts.agentsRoot, "shared");
        const lessonsPath = resolve(sharedDir, "lessons.jsonl");
        tools.push(
          createFinishTool({
            lessonsPath,
            agentName: config.name,
            getTask: () => {
              const sid = agentSessionIds.get(config.name);
              return sid ?? "unknown-task";
            },
          }),
        );
        break;
      }

      case "agent-growth": {
        tools.push(
          ...createAgentGrowthTools({
            agentsRoot: opts.agentsRoot,
            manager,
            persistDir: opts.persistDir,
            loadAgent: (agentDir) => {
              const config = loadAgentConfig(agentDir, opts.bus);
              if (!config) return;
              const model = opts.models[config.model];
              const knowledgeDir = resolve(agentDir, "knowledge");
              const workspace = resolve(agentDir, "workspace");

              manager.register({
                name: config.name,
                description: config.description,
                domain: config.domain,
                model,
                tools: buildTools(config, opts),
                knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
                workspace: existsSync(workspace) ? workspace : undefined,
                projectRoot: opts.projectRoot,
                apiKey: (model as any).apiKey,
                memoryLimit: config.memoryLimit,
              });
            },
            reloadAgent: (name) => {
              const agentDir = resolve(opts.agentsRoot, name);
              const config = loadAgentConfig(agentDir, opts.bus);
              if (!config) return;
              const model = opts.models[config.model];
              const knowledgeDir = resolve(agentDir, "knowledge");
              const workspace = resolve(agentDir, "workspace");

              manager.register({
                name: config.name,
                description: config.description,
                domain: config.domain,
                model,
                tools: buildTools(config, opts),
                knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
                workspace: existsSync(workspace) ? workspace : undefined,
                projectRoot: opts.projectRoot,
                apiKey: (model as any).apiKey,
                memoryLimit: config.memoryLimit,
              });
            },
          }),
        );
        break;
      }

      default:
        bus.emit({
          type: "info",
          message: `[loader] Unknown tool preset "${preset}" for agent "${config.name}" — skipping`,
        });
    }
  }

  return wrapToolsWithPathGuard(tools, config.name, opts.agentsRoot, projectRoot);
}

// ── Validation ──────────────────────────────────────────────────────────

const VALID_TOOL_PRESETS = new Set([
  "coding",
  "read-write",
  "read-only",
  "exec",
  "exec-readonly",
  "exec-master",
  "claude-code",
  "gemini-cli",
  "agents",
  "workflow",
  "background-exec",
  "socket-watch",
  "cron",
  "scrape",
  "agent-growth",
  "verify_skill",
  "finish",
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

    manager.register({
      name: config.name,
      description: config.description,
      domain: config.domain,
      model,
      tools: buildTools(config, opts),
      knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
      workspace: existsSync(workspace) ? workspace : undefined,
      projectRoot,
      apiKey: (model as any).apiKey,
      memoryLimit: config.memoryLimit,
      compaction: config.compaction,
    });

    if (isUpdate) {
      updated.push(config.name);
    } else {
      added.push(config.name);
    }
  }

  // Report validation errors as warnings — skip bad agents, don't crash
  if (allErrors.length > 0) {
    const report = allErrors.map((e) => `  ${e.agent}.${e.field}: ${e.message}`).join("\n");
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
export async function loadAgentHandlers(
  opts: AgentLoaderOptions & {
    /** Function to get an agent's active session ID (for followUp). */
    getSessionId: (agentName: string) => string | null;
  },
): Promise<{ registered: string[]; errors: string[] }> {
  const { agentsRoot, persistDir, projectRoot, manager, bus } = opts;
  const registered: string[] = [];
  const errors: string[] = [];

  for (const [agentName, cron] of agentCrons) {
    const entries = cron.getEntries();
    const handlersNeeded = entries.filter((e) => e.handler);

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
