import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createWorkflowHandler, SubagentManager } from "../../lib/index.js";
import type {
  HandlerContext,
  HandlerModule,
  HandlerSDK,
  EventEnvelope,
  WorkflowHandlerContext,
} from "../../lib/handler-context.js";
import type { CronEntry, WorkflowBackedHandler } from "../../lib/cron-tool.js";
import { buildSessionHelpers } from "../../lib/runtime-ctx.js";
import { buildAgentSDK } from "../../lib/sdk-impl.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { Cron, type CronHandler } from "../cron.js";
import type { EventBus } from "../event-bus.js";

export interface AgentHandlerLoaderOptions {
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  persistDir: string;
  projectRoot: string;
  manager: SubagentManager;
  bus: EventBus;
  agentCrons: ReadonlyMap<string, Cron>;
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

    const sessionHelpers = buildSessionHelpers({
      bus,
      persistDir,
      projectRoot,
      agentsRoot,
      sharedRoot,
      projectsRoot,
      agentName,
    });
    const fullSdk = buildAgentSDK({
      bus,
      persistDir,
      projectRoot,
      agentsRoot,
      sharedRoot,
      projectsRoot,
      agentName,
      manager,
    });
    const sdk: HandlerSDK = {
      emit: fullSdk.emit,
      getDb: fullSdk.getDb,
      query: fullSdk.query,
      metrics: fullSdk.metrics,
      log: fullSdk.log,
      message: fullSdk.message,
      paths: fullSdk.paths,
    };
    const ctx: HandlerContext = {
      sdk,
      agentName,
      triggerNow: (entryName: string) => cron.triggerNow(entryName),
      ...sessionHelpers,
    };
    const workflowCtx: WorkflowHandlerContext = { ...ctx, sdk: fullSdk };

    // Startup and late resolution share preparation and diagnostics, not publication.
    async function prepareHandlers(entries: readonly CronEntry[]) {
      const result = { handlers: new Map<CronEntry, CronHandler>(), errors: [] as string[] };
      for (const entry of entries) {
        const workflow = workflowHandler(entry);
        if (!workflow) continue;
        result.handlers.set(entry, createWorkflowBackedHandler(workflowCtx, entry, workflow));
      }

      const byFile = new Map<string, CronEntry[]>();
      for (const entry of entries) {
        if (!entry.handler || typeof entry.handler !== "string") continue;
        const file = entry.handler;
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file)!.push(entry);
      }

      for (const [handlerFile, fileEntries] of byFile) {
        const handlerDir = resolveHandlerDir(agentsRoot, agentName, cron as CronWithConfigPath);
        const modulePath = resolveHandlerModule(handlerDir, handlerFile);
        if (!modulePath) {
          const msg = `Handler file not found: ${handlerDir}/${handlerFile}.(js|ts)`;
          result.errors.push(msg);
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
            result.errors.push(msg);
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
            result.handlers.set(entry, createReloadableHandler(modulePath, ctx, entry));
          }
        } catch (err) {
          const msg = `Failed to import handler ${modulePath}: ${err instanceof Error ? err.message : String(err)}`;
          result.errors.push(msg);
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
      return result;
    }

    const initial = await prepareHandlers(handlersNeeded);
    for (const [entry, handler] of initial.handlers) {
      cron.registerHandler(entry.name, handler);
      registered.push(`${agentName}:${entry.name}`);
      const workflow = workflowHandler(entry);
      const target = workflow
        ? `workflow:${workflow.agent ? `${workflow.agent}/` : ""}${workflow.workflow}`
        : `${entry.handler}.ts (reloadable)`;
      bus.emit({ type: "info", message: `[handler] Registered ${agentName}:${entry.name} → ${target}` });
    }
    errors.push(...initial.errors);
    cron.setHandlerResolver(async (entry) => {
      const result = await prepareHandlers([entry]);
      return result.handlers.get(entry);
    });
  }

  return { registered, errors };
}

function workflowHandler(entry: CronEntry): WorkflowBackedHandler | undefined {
  const handler = entry.handler;
  return handler && typeof handler === "object" && typeof handler.workflow === "string" ? handler : undefined;
}

function createWorkflowBackedHandler(ctx: WorkflowHandlerContext, entry: CronEntry, handler: WorkflowBackedHandler) {
  return createWorkflowHandler({
    workflow: handler.workflow,
    source: handler.agent ?? entry.agent ?? ctx.agentName,
    sessionSource: entry.category === "heartbeat" ? "heartbeat" : undefined,
    projectId: handler.projectId,
    task: handler.task,
    includeEvent: handler.includeEvent,
  })(ctx, entry);
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

function createReloadableHandler(modulePath: string, ctx: HandlerContext, entry: CronEntry) {
  const entrySnapshot = { ...entry };
  return async (event?: EventEnvelope) => {
    const module = await importRuntimeModule<HandlerModule>(modulePath);
    if (typeof module.create !== "function") {
      throw new Error(`Handler ${modulePath} no longer exports create()`);
    }
    const fn = module.create(ctx, entrySnapshot);
    return fn(event);
  };
}
