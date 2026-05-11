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
 * System prompt is assembled from:
 *   agents/shared/common-sense.md + agents/<name>/AGENTS.md + generated runtime facts
 * The order is intentional: shared defaults first, then agent identity as the
 * more specific layer for role-specific behavior.
 * Domain files, skills, lessons, and knowledge indexes are read on demand.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelWithApiKey } from "../lib/types.js";
import { SubagentManager } from "../lib/index.js";
import type { EventBus } from "./event-bus.js";
import { Cron } from "./cron.js";
import {
  loadAgentConfig,
  validateAgentConfig,
  type AgentConfig,
  type ValidationError,
} from "./loader/agent-config.js";
import { listAgentDirectories } from "./loader/agent-discovery.js";
import { buildTools } from "./loader/toolset-loader.js";

export { loadAgentConfig, validateAgentConfig, type AgentConfig, type ValidationError } from "./loader/agent-config.js";
export { listAgentDirectories, listConfiguredAgentNames } from "./loader/agent-discovery.js";
export { buildTools, loadLocalTools } from "./loader/toolset-loader.js";

// ── Loader options ──────────────────────────────────────────────────────

export interface AgentLoaderOptions {
  agentsRoot: string;
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
}

// ── Track active session IDs for subagent/workflow tools ────────────────

/** Per-agent session ID tracking. Updated by session.start bus event. */
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

// ── Load and register agents ────────────────────────────────────────────

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
export async function loadAgents(opts: AgentLoaderOptions): Promise<LoadResult> {
  const { agentsRoot, projectRoot, models, manager } = opts;
  const added: string[] = [];
  const updated: string[] = [];
  const allErrors: ValidationError[] = [];

  for (const { dir: agentDir } of listAgentDirectories(agentsRoot)) {
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
      tools: await buildTools(config, {
        ...opts,
        getAgentSessionId,
        getAgentCrons,
        setAgentCron: (agentName, cron) => agentCrons.set(agentName, cron),
        addCleanup,
      }),
      agentDir,
      knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
      workspace: existsSync(workspace) ? workspace : undefined,
      projectRoot,
      apiKey: model.apiKey,
      memoryLimit: config.memoryLimit,
      compaction: config.compaction,
      contextFiles: config.context_files?.map((f) => resolve(agentDir, f)),
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
    opts.bus.emit({
      type: "agent.config_invalid",
      owner: "may",
      count: allErrors.length,
      errors: allErrors,
      message: `Skipped agents with config errors:\n${report}`,
      priority: "P0",
    });
  }

  return { added, updated };
}

/**
 * Auto-generate heartbeat cron entries for agents that have a heartbeat
 * workflow but no explicit heartbeat entry in any cron.json.
 *
 * Convention: agents/<name>/workflows/<name>-heartbeat.ts exists → auto-heartbeat.
 * Opt-out: "heartbeat": false in agent.json.
 */
export function generateAutoHeartbeats(agentsRoot: string): CronEntry[] {
  const generated: CronEntry[] = [];
  const entries = readdirSync(agentsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared" || entry.name.startsWith("_")) continue;

    const agentDir = resolve(agentsRoot, entry.name);
    const agentName = entry.name;

    // Check agent.json exists
    const agentJsonPath = resolve(agentDir, "agent.json");
    if (!existsSync(agentJsonPath)) continue;

    // Check opt-out
    try {
      const config = JSON.parse(readFileSync(agentJsonPath, "utf-8"));
      if (config.heartbeat === false) continue;
    } catch { continue; }

    // Check heartbeat workflow exists
    const workflowPath = resolve(agentDir, "workflows", `${agentName}-heartbeat.ts`);
    if (!existsSync(workflowPath)) continue;

    // Check no explicit heartbeat entry already exists (will be checked again by addSyntheticEntry)
    const cronPath = resolve(agentDir, "cron.json");
    if (existsSync(cronPath)) {
      try {
        const cronEntries = JSON.parse(readFileSync(cronPath, "utf-8")) as CronEntry[];
        if (cronEntries.some(e => e.name === `heartbeat-${agentName}` || e.name === "heartbeat")) continue;
      } catch { /* proceed */ }
    }

    // Generate deterministic offset from agent name hash
    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      hash = ((hash << 5) - hash + agentName.charCodeAt(i)) | 0;
    }
    const offsetMs = Math.abs(hash % 1_500_000) + 60_000; // 1-26 min, avoid 0

    generated.push({
      name: `heartbeat-${agentName}`,
      intervalMs: 1_800_000,
      agent: agentName,
      message: `[heartbeat] ${agentName} heartbeat (auto-generated).`,
      enabled: true,
      description: `Auto-generated heartbeat for ${agentName}.`,
      handler: "run-workflow",
      handlerConfig: {
        workflow: `${agentName}-heartbeat`,
        agent: agentName,
        task: `[heartbeat] You are ${agentName}. Read agents/${agentName}/heartbeat.md and work through each section. End with a brief of what you did.`,
        timeoutMs: 1_800_000,
      },
      offsetMs,
      on: ["heartbeat.trigger"],
    });
  }

  return generated;
}

/**
 * Reload: scan agent.json files, register new agents and update existing ones.
 * Active sessions keep their old config; only new sessions use the updated definition.
 * Returns { added, updated, errors } — errors are reported but don't crash.
 */
export async function reloadAgents(
  opts: AgentLoaderOptions,
): Promise<{ added: string[]; updated: string[]; errors: string[] }> {
  try {
    const result = await loadAgents(opts);
    return { ...result, errors: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { added: [], updated: [], errors: [msg] };
  }
}

// ── Agent handler auto-discovery ──────────────────────────────────────────

import type { HandlerContext, HandlerModule, TriggerEvent } from "../lib/handler-context.js";
import type { CronEntry } from "../lib/cron-tool.js";
import { buildRuntimeCtx, buildSessionHelpers } from "../lib/runtime-ctx.js";
import { buildAgentSDK } from "../lib/sdk-impl.js";

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
    const sessionHelpers = buildSessionHelpers({ bus, persistDir, projectRoot, agentsRoot, agentName });
    const sdk = buildAgentSDK({
      bus,
      persistDir,
      projectRoot,
      agentsRoot,
      agentName,
      manager,
      callAgent: (agent, task, callOpts) => manager.callAgent(agent, task, callOpts) as any,
      triggerNow: (name) => cron.triggerNow(name),
    });
    const ctx: HandlerContext = {
      sdk,
      agentName,
      triggerNow: (entryName: string) => cron.triggerNow(entryName),
      ...sessionHelpers,
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
        // Bun handles .ts imports natively
        modulePath = tsPath;
      } else {
        const msg = `Handler file not found: ${handlerDir}/${handlerFile}.(js|ts)`;
        errors.push(msg);
        bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
        continue;
      }

      try {
        // Validate module at startup (fail-fast)
        const mod: HandlerModule = await import(`${modulePath}?t=${Date.now()}`);
        if (typeof mod.create !== "function") {
          const msg = `Handler ${modulePath} does not export create()`;
          errors.push(msg);
          bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
          continue;
        }

        for (const entry of fileEntries) {
          // Hot-reload wrapper: re-import the handler module on each
          // invocation so that code changes take effect without a
          // process restart.  The ?t= cache-buster forces Bun to
          // re-evaluate the file.
          const _modulePath = modulePath; // capture for closure
          const _ctx = ctx; // capture for closure
          const _entry = { ...entry }; // snapshot
          const hotHandler = async (event?: TriggerEvent) => {
            const freshMod: HandlerModule = await import(`${_modulePath}?t=${Date.now()}`);
            if (typeof freshMod.create !== "function") {
              throw new Error(`Handler ${_modulePath} no longer exports create()`);
            }
            const fn = freshMod.create(_ctx, _entry);
            return fn(event);
          };
          cron.registerHandler(entry.name, hotHandler);
          registered.push(`${agentName}:${entry.name}`);
          bus.emit({
            type: "info",
            message: `[handler] Registered ${agentName}:${entry.name} → ${handlerFile}.ts (hot-reload)`,
          });
        }
      } catch (err) {
        const msg = `Failed to import handler ${modulePath}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
      }
    }

    // Set up dynamic handler resolver for this agent's cron.
    // This handles new handler entries added to cron.json after startup.
    const _agentName = agentName;
    const _agentsRoot = agentsRoot;
    const _ctx = ctx;
    const _cron = cron;
    const _bus = bus;
    cron.setHandlerResolver(async (entryName: string, entry: CronEntry): Promise<boolean> => {
      if (!entry.handler) return false;

      const handlerDir = resolve(_agentsRoot, _agentName, "handlers");
      const jsPath = resolve(handlerDir, `${entry.handler}.js`);
      const tsPath = resolve(handlerDir, `${entry.handler}.ts`);

      let modulePath: string;
      if (existsSync(jsPath)) {
        modulePath = jsPath;
      } else if (existsSync(tsPath)) {
        modulePath = tsPath;
      } else {
        _bus.emit({
          type: "info",
          message: `[handler] ⚠️ Handler file not found for "${entryName}": ${handlerDir}/${entry.handler}.(js|ts)`,
        });
        return false;
      }

      try {
        const mod: HandlerModule = await import(`${modulePath}?t=${Date.now()}`);
        if (typeof mod.create !== "function") {
          _bus.emit({
            type: "info",
            message: `[handler] ⚠️ Handler ${modulePath} does not export create() — cannot resolve "${entryName}"`,
          });
          return false;
        }

        const _modulePath = modulePath;
        const _entry = { ...entry };
        const hotHandler = async (event?: TriggerEvent) => {
          const freshMod: HandlerModule = await import(`${_modulePath}?t=${Date.now()}`);
          if (typeof freshMod.create !== "function") {
            throw new Error(`Handler ${_modulePath} no longer exports create()`);
          }
          const fn = freshMod.create(_ctx, _entry);
          return fn(event);
        };

        _cron.registerHandler(entryName, hotHandler);
        _bus.emit({
          type: "info",
          message: `[handler] Dynamically registered ${_agentName}:${entryName} → ${entry.handler}.ts (post-startup)`,
        });
        return true;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        _bus.emit({
          type: "info",
          message: `[handler] ⚠️ Failed to dynamically import handler for "${entryName}": ${errMsg}`,
        });
        return false;
      }
    });
  }

  return { registered, errors };
}
