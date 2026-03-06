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
 *   agents/<name>/skills/      → skillsDirs
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Model } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import {
  SubagentManager,
  createLinkedTools,
  createExecTool,
  createWorkflowTool,
  createBackgroundExecTool,
  createSocketWatchTool,
  createClaudeCodeTool,
  createGeminiCliTool,
  createCronTool,
  stripCliPromptContent,
} from "../src/index.js";
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
  maxTurns?: number;
  memoryLimit?: number;
  /** Block direct delegation to specific agents via subagents tool. */
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

  // Standard deny patterns for all exec tools
  // `cd /absolute` is allowed only when the target is under projectRoot.
  // Stale-path rewrites are handled by rewriteHallucinatedCommand in createExecTool.
  const allowedRoots = [projectRoot, opts.agentsRoot, persistDir];
  const baseDenyPatterns = [
    /^\s*find\s+\/\s/,
    /^\s*ls\s+\/\s*$/,
    {
      test: (cmd: string) => {
        const m = cmd.match(/^\s*cd\s+(["']?)(\/\S+)\1/);
        if (!m) return false;
        const target = m[2];
        return !allowedRoots.some(r => target === r || target.startsWith(r + '/'));
      },
    },
  ];

  // File-write deny patterns for read-only exec
  const writeDenyPatterns = [
    /\bsed\s+-i\b/,
    /\bcat\s*>[^&]/,
    /<<\s*['"]?\w+['"]?/,
    /\btee\s/,
    /\b(echo|printf)\b[^;|]*(?<![0-9])>{1,2}[^&]/,
    /\bmv\s|\bcp\s|\brm\s/,
    /\bmkdir\b/,
    /\btouch\b/,
    /\bchmod\b|\bchown\b/,
    /\bpython3?\s+-c\b[\s\S]*open\(/,
    /\bnode\s+-e\b/,
    /\bperl\s+-e\b/,
    /\bruby\s+-e\b/,
    /\bgit\s+(reset|checkout)\b/,
  ];

  for (const preset of config.tools) {
    switch (preset) {
      case "read-write": {
        const linked = createLinkedTools({
          projectRoot,
          maxFileLength: 20_000,
        });
        tools.push(linked.read, linked.write);
        break;
      }

      case "read-only": {
        const linked = createLinkedTools({
          projectRoot,
          maxFileLength: 20_000,
        });
        tools.push(linked.read);
        break;
      }

      case "exec":
        tools.push(createExecTool({
          cwd: projectRoot,
          echoCwd: true,
          warnOutsideRoot: projectRoot,
          denyPatterns: baseDenyPatterns,
          denyMessage: "Do not explore outside the project root. Use relative paths.",
        }));
        break;

      case "exec-readonly":
        tools.push(createExecTool({
          cwd: projectRoot,
          echoCwd: true,
          warnOutsideRoot: projectRoot,
          denyPatterns: [...baseDenyPatterns, ...writeDenyPatterns],
          denyMessage: 'You cannot write files. Delegate code changes to coder: subagents.delegate("coder", task)',
        }));
        break;

      case "exec-master":
        tools.push(createExecTool({
          cwd: projectRoot,
          echoCwd: true,
          warnOutsideRoot: projectRoot,
          maxOutputLength: 80_000,
          stripForDenyCheck: stripCliPromptContent,
          denyPatterns: [
            ...baseDenyPatterns,
            ...writeDenyPatterns,
          ],
          denyMessage: "You cannot write files directly. Use claude-code or gemini-cli to implement changes.",
        }));
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

      case "subagents": {
        // Check agent config for delegateDeny
        const denyConfig = config.delegateDeny;
        tools.push(manager.createTool({
          getCallerSessionId: () => agentSessionIds.get(config.name),
          delegateDeny: denyConfig,
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
          denyPatterns: baseDenyPatterns,
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

// ── Validation ──────────────────────────────────────────────────────────

const VALID_TOOL_PRESETS = new Set([
  "read-write", "read-only", "exec", "exec-readonly", "exec-master",
  "claude-code", "gemini-cli",
  "subagents", "workflow", "background-exec", "socket-watch", "cron",
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
 * Re-registers existing agents so config changes (model, tools, maxTurns, etc.)
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
    const workflowDir = resolve(agentDir, "workflows");

    manager.register({
      name: config.name,
      description: config.description,
      domain: config.domain,
      model,
      tools: buildTools(config, opts),
      systemPromptFiles: resolvePromptFiles(config, agentsRoot),
      knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
      workspace: existsSync(workspace) ? workspace : undefined,
      workflowDir: existsSync(workflowDir) ? workflowDir : undefined,
      projectRoot,
      apiKey: "not-needed",
      maxTurns: config.maxTurns,
      memoryLimit: config.memoryLimit,
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

import type { HandlerContext, HandlerModule } from "./handler-context.js";
import type { CronEntry } from "../src/cron-tool.js";

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
