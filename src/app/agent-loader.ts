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
 * Domain files, skills, lessons, and knowledge indexes are read on demand.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelWithApiKey } from "../lib/types.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import {
  SubagentManager,
  createCodingTools,
  createReadTool,
  createWorkflowTool,
  createBackgroundExecTool,
  createCronTool,
  createScrapeTool,
  createSystemStatusTool,
  createQueryDbTool,
  createFinishTool,
  createCheckpointTool,
} from "../lib/index.js";

import { createMessageTool } from "../lib/tools/message-tool.js";
import { VALID_TOOL_PRESETS } from "../lib/tool-preset-registry.js";
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
  /** @deprecated Volatile context should be injected at session time, not in system prompt. */
  context_files?: string[];
  /** Maximum state-changing operations (bash, write, edit, commit) per session. */
}

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

// ── Protected path guard (P53 enforcement) ─────────────────────────────

/**
 * Files that agents may NOT write/edit in other agents' directories.
 * These are identity-critical files — only the owning agent (or human) may modify them.
 *
 * LESSONS.md is intentionally NOT protected: it's learned behavior, not identity.
 * Coach needs to edit any agent's LESSONS.md (Growth Cycle + direct edits).
 * Bob's consolidation cron needs cross-agent LESSONS.md access for cleanup.
 * Protecting LESSONS.md blocked Coach 31+ times and forced heavyweight
 * fork-verify-promote cycles for single-line lesson additions.
 */

// ── Bash command guard removed ──────────────────────────────────────────
// P53 bash command scanning was removed per Hao's directive (2026-03-14):
// "bash guard is against our idea of freedom and creativity. Instead, give
//  agents free bash access. For safety, create specialist agents without bash."
// Cross-edit protection remains via write/edit tool path guards (checkCrossEditGuard in cross-edit-guard.ts).

async function buildTools(config: AgentConfig, opts: AgentLoaderOptions): Promise<AgentTool[]> {
  const { projectRoot, persistDir, manager, bus } = opts;
  const agentDir = resolve(opts.agentsRoot, config.name);
  const tools: AgentTool[] = [createQueryDbTool(persistDir)];

  for (const preset of config.tools) {
    switch (preset) {
      case "query_db":
      case "query-db":
        // query_db is a core read-only runtime tool, loaded for every agent.
        break;

      case "coding":
        // Full coding toolset: read + bash + edit + write
        tools.push(...createCodingTools(projectRoot, { agentName: config.name }));
        break;

      case "read-only": {
        tools.push(createReadTool(projectRoot) as any);
        break;
      }

      case "agents": {
        // Agents cooperation tool — actions: call, fork, message, list, peek, cancel, context, requests
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
            bus: opts.bus,
          }),
        );
        break;
      }

      case "message": {
        // v2: `message` is the canonical async inter-agent communication tool.
        // (Replaced legacy `notify` and `message-only` presets in v0.3.)
        tools.push(
          createMessageTool({
            agentName: config.name,
            agentsRoot: opts.agentsRoot,
            persistDir,
            emit: (event) => bus.emit(event as any),
            getCallerSessionId: () => agentSessionIds.get(config.name),
            triggerHeartbeat: (agentName: string) => {
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
        const sharedWorkflowDir = resolve(opts.agentsRoot, "shared", "workflows");
        tools.push(
          createWorkflowTool({
            manager,
            workflowDir,
            sharedWorkflowDir,
            persistDir,
            agentName: config.name,
            runtimeCtx: buildRuntimeCtx({ bus, persistDir, projectRoot, agentsRoot: opts.agentsRoot, agentName: config.name }),
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
              bus.emit({ type: "message.created", from: config.name, to: "human", content: msg } as any);
            },
            (event) => bus.emit(event),
          );
          cron.load();
          agentCrons.set(config.name, cron);
        }
        tools.push(
          createCronTool({
            configPath: cronPath,
            agentName: config.name,
            onConfigChange: () => cron!.reload(),
            cronEnabled: opts.cronEnabled,
          }),
        );
        break;
      }

      case "scrape":
        tools.push(createScrapeTool());
        break;

      case "system-status":
      case "system_status": {
        tools.push(createSystemStatusTool(opts.persistDir, opts.agentsRoot));
        break;
      }

      case "finish": {
        tools.push(
          createFinishTool({
            agentName: config.name,
            projectRoot,
            persistDir,
          }),
        );
        break;
      }

      case "checkpoint": {
        // Session ID and agent name are not known at registration time —
        // use placeholders that get resolved at runtime. The manager
        // injects both via mutable refs before each session starts.
        let currentSessionId = "unknown";
        let currentAgentName = "unknown";
        tools.push(
          createCheckpointTool({
            sessionId: () => currentSessionId,
            agentName: () => currentAgentName,
            persistDir,
          }),
        );
        // Store setters on the tool for the manager to call at session start
        const cpTool = tools[tools.length - 1] as any;
        cpTool._setSessionId = (id: string) => {
          currentSessionId = id;
        };
        cpTool._setAgentName = (name: string) => {
          currentAgentName = name;
        };
        break;
      }

      default:
        bus.emit({
          type: "info",
          message: `[loader] Unknown tool preset "${preset}" for agent "${config.name}" — skipping`,
        });
    }
  }

  // Load local tools from agents/<name>/tools/
  const localTools = await loadLocalTools(config.name, agentDir, opts);
  tools.push(...localTools);

  return tools;
}

/**
 * Scan agents/<name>/tools/ for .ts files and dynamically import them.
 * Each file must default-export a ToolFactory function.
 * Errors are logged and skipped — one bad tool doesn't kill the agent.
 */
async function loadLocalTools(agentName: string, agentDir: string, opts: AgentLoaderOptions): Promise<AgentTool[]> {
  const toolsDir = resolve(agentDir, "tools");
  if (!existsSync(toolsDir)) return [];

  const tools: AgentTool[] = [];
  const entries = readdirSync(toolsDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of entries) {
    const filePath = resolve(toolsDir, file);
    try {
      const mod = await import(`${filePath}?t=${Date.now()}`);
      const factory = mod.default;
      if (typeof factory !== "function") {
        opts.bus.emit({
          type: "info",
          message: `[loader] Skipping ${agentName}/tools/${file} — no default export function`,
        });
        continue;
      }
      const tool = await factory({
        projectRoot: opts.projectRoot,
        agentRoot: agentDir,
        persistDir: opts.persistDir,
      });
      if (tool && typeof tool.name === "string") {
        tools.push(tool);
        opts.bus.emit({
          type: "info",
          message: `[loader] Loaded local tool "${tool.name}" for ${agentName}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      opts.bus.emit({
        type: "info",
        message: `[loader] ⚠️ Failed to load ${agentName}/tools/${file}: ${msg}`,
      });
    }
  }

  return tools;
}

// ── Validation ──────────────────────────────────────────────────────────

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
  models: Record<string, ModelWithApiKey>,
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
    const config = JSON.parse(raw) as AgentConfig;
    return config;
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
export async function loadAgents(opts: AgentLoaderOptions): Promise<LoadResult> {
  const { agentsRoot, projectRoot, models, manager } = opts;
  const added: string[] = [];
  const updated: string[] = [];
  const allErrors: ValidationError[] = [];

  const entries = readdirSync(agentsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared") continue; // shared/ is not an agent
    if (entry.name.startsWith("_")) continue; // Skip legacy/private directories

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
      tools: await buildTools(config, opts),
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
