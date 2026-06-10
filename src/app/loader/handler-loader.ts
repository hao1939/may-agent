import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createWorkflowHandler, SubagentManager } from "../../lib/index.js";
import type { HandlerContext, HandlerModule, EventEnvelope } from "../../lib/handler-context.js";
import type { CronEntry, WorkflowBackedHandler } from "../../lib/cron-tool.js";
import { buildSessionHelpers } from "../../lib/runtime-ctx.js";
import { buildAgentSDK } from "../../lib/sdk-impl.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { Cron } from "../cron.js";
import type { EventBus } from "../event-bus.js";

export interface AgentHandlerLoaderOptions {
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  persistDir: string;
  projectRoot: string;
  manager: SubagentManager;
  bus: EventBus;
  agentCrons: Map<string, Cron>;
}

type CronWithConfigPath = Cron & { getConfigPath?: () => string; hasHandler?: (jobName: string) => boolean };

export async function loadHandlersForAgentCrons(
  opts: AgentHandlerLoaderOptions,
): Promise<{ registered: string[]; errors: string[] }> {
  const { agentsRoot, sharedRoot, projectsRoot, persistDir, projectRoot, manager, bus } = opts;
  const registered: string[] = [];
  const errors: string[] = [];

  for (const [agentName, cron] of opts.agentCrons) {
    const entries = cron.getEntries();
    const handlersNeeded = entries.filter((e) => e.handler && !(cron as CronWithConfigPath).hasHandler?.(e.name));

    const sessionHelpers = buildSessionHelpers({ bus, persistDir, projectRoot, agentsRoot, sharedRoot, projectsRoot, agentName });
    const sdk = buildAgentSDK({
      bus,
      persistDir,
      projectRoot,
      agentsRoot,
      sharedRoot,
      projectsRoot,
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

    for (const entry of handlersNeeded) {
      const workflow = workflowHandler(entry);
      if (!workflow) continue;
      cron.registerHandler(entry.name, createWorkflowBackedHandler(ctx, entry, workflow));
      registered.push(`${agentName}:${entry.name}`);
      bus.emit({
        type: "info",
        message: `[handler] Registered ${agentName}:${entry.name} → workflow:${workflow.agent ? `${workflow.agent}/` : ""}${workflow.workflow}`,
      });
    }

    const byFile = new Map<string, CronEntry[]>();
    for (const entry of handlersNeeded) {
      if (typeof entry.handler !== "string") continue;
      const file = entry.handler;
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file)!.push(entry);
    }

    for (const [handlerFile, fileEntries] of byFile) {
      const handlerDir = resolveHandlerDir(agentsRoot, agentName, cron as CronWithConfigPath);
      const modulePath = resolveHandlerModule(handlerDir, handlerFile);
      if (!modulePath) {
        const msg = `Handler file not found: ${handlerDir}/${handlerFile}.(js|ts)`;
        errors.push(msg);
        bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
        for (const entry of fileEntries) {
          bus.emit({
            type: "handler.load-failed",
            source: "handler-loader",
            owner: `agent:${agentName}`,
            data: { handler: entry.name, agent: agentName, path: `${handlerDir}/${handlerFile}.(js|ts)`, error: msg },
          });
        }
        continue;
      }

      try {
        const mod = await importRuntimeModule<HandlerModule>(modulePath);
        if (typeof mod.create !== "function") {
          const msg = `Handler ${modulePath} does not export create()`;
          errors.push(msg);
          bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
          for (const entry of fileEntries) {
            bus.emit({
              type: "handler.load-failed",
              source: "handler-loader",
              owner: `agent:${agentName}`,
              data: { handler: entry.name, agent: agentName, path: modulePath, error: msg },
            });
          }
          continue;
        }

        for (const entry of fileEntries) {
          cron.registerHandler(entry.name, createHotReloadHandler(modulePath, ctx, entry));
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
        for (const entry of fileEntries) {
          bus.emit({
            type: "handler.load-failed",
            source: "handler-loader",
            owner: `agent:${agentName}`,
            data: { handler: entry.name, agent: agentName, path: modulePath, error: msg },
          });
        }
      }
    }

    cron.setHandlerResolver(async (entryName: string, entry: CronEntry): Promise<boolean> => {
      if (!entry.handler) return false;
      const workflow = workflowHandler(entry);
      if (workflow) {
        cron.registerHandler(entryName, createWorkflowBackedHandler(ctx, entry, workflow));
        bus.emit({
          type: "info",
          message: `[handler] Dynamically registered ${agentName}:${entryName} → workflow:${workflow.agent ? `${workflow.agent}/` : ""}${workflow.workflow}`,
        });
        return true;
      }
      if (typeof entry.handler !== "string") return false;

      const handlerDir = resolveHandlerDir(agentsRoot, agentName, cron as CronWithConfigPath);
      const modulePath = resolveHandlerModule(handlerDir, entry.handler);
      if (!modulePath) {
        const loadMsg = `Handler file not found for "${entryName}": ${handlerDir}/${entry.handler}.(js|ts)`;
        bus.emit({
          type: "info",
          message: `[handler] ⚠️ ${loadMsg}`,
        });
        bus.emit({
          type: "handler.load-failed",
          source: "handler-loader",
          owner: `agent:${agentName}`,
          data: { handler: entryName, agent: agentName, path: `${handlerDir}/${entry.handler}.(js|ts)`, error: loadMsg },
        });
        return false;
      }

      try {
        const mod = await importRuntimeModule<HandlerModule>(modulePath);
        if (typeof mod.create !== "function") {
          const createMsg = `Handler ${modulePath} does not export create() — cannot resolve "${entryName}"`;
          bus.emit({
            type: "info",
            message: `[handler] ⚠️ ${createMsg}`,
          });
          bus.emit({
            type: "handler.load-failed",
            source: "handler-loader",
            owner: `agent:${agentName}`,
            data: { handler: entryName, agent: agentName, path: modulePath, error: createMsg },
          });
          return false;
        }

        cron.registerHandler(entryName, createHotReloadHandler(modulePath, ctx, entry));
        bus.emit({
          type: "info",
          message: `[handler] Dynamically registered ${agentName}:${entryName} → ${entry.handler}.ts (post-startup)`,
        });
        return true;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const dynMsg = `Failed to dynamically import handler for "${entryName}": ${errMsg}`;
        bus.emit({
          type: "info",
          message: `[handler] ⚠️ ${dynMsg}`,
        });
        bus.emit({
          type: "handler.load-failed",
          source: "handler-loader",
          owner: `agent:${agentName}`,
          data: { handler: entryName, agent: agentName, path: modulePath, error: dynMsg },
        });
        return false;
      }
    });
  }

  return { registered, errors };
}

function workflowHandler(entry: CronEntry): WorkflowBackedHandler | undefined {
  const handler = entry.handler;
  return handler && typeof handler === "object" && typeof handler.workflow === "string" ? handler : undefined;
}

function createWorkflowBackedHandler(ctx: HandlerContext, entry: CronEntry, handler: WorkflowBackedHandler) {
  return createWorkflowHandler({
    workflow: handler.workflow,
    source: handler.agent ?? entry.agent ?? ctx.agentName,
    projectId: handler.projectId,
    task: handler.task,
    includeEvent: handler.includeEvent,
  })(ctx as any, entry as any);
}

function resolveHandlerDir(agentsRoot: string, agentName: string, cron: CronWithConfigPath): string {
  const configPath = typeof cron.getConfigPath === "function" ? cron.getConfigPath() : "";
  if (configPath) return resolve(dirname(configPath), "handlers");
  return resolve(agentsRoot, agentName, "handlers");
}

function resolveHandlerModule(handlerDir: string, handlerFile: string): string | null {
  const jsPath = resolve(handlerDir, `${handlerFile}.js`);
  const tsPath = resolve(handlerDir, `${handlerFile}.ts`);
  if (existsSync(jsPath)) return jsPath;
  if (existsSync(tsPath)) return tsPath;
  return null;
}

function createHotReloadHandler(modulePath: string, ctx: HandlerContext, entry: CronEntry) {
  const entrySnapshot = { ...entry };
  return async (event?: EventEnvelope) => {
    const freshMod = await importRuntimeModule<HandlerModule>(modulePath);
    if (typeof freshMod.create !== "function") {
      throw new Error(`Handler ${modulePath} no longer exports create()`);
    }
    const fn = freshMod.create(ctx, entrySnapshot);
    return fn(event);
  };
}
