import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SubagentManager } from "../../lib/index.js";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../lib/handler-context.js";
import type { CronEntry } from "../../lib/cron-tool.js";
import { buildSessionHelpers } from "../../lib/runtime-ctx.js";
import { buildAgentSDK } from "../../lib/sdk-impl.js";
import { Cron } from "../cron.js";
import type { EventBus } from "../event-bus.js";

let hotReloadImportSeq = 0;

export interface AgentHandlerLoaderOptions {
  agentsRoot: string;
  persistDir: string;
  projectRoot: string;
  manager: SubagentManager;
  bus: EventBus;
  agentCrons: Map<string, Cron>;
}

export async function loadHandlersForAgentCrons(
  opts: AgentHandlerLoaderOptions,
): Promise<{ registered: string[]; errors: string[] }> {
  const { agentsRoot, persistDir, projectRoot, manager, bus } = opts;
  const registered: string[] = [];
  const errors: string[] = [];

  for (const [agentName, cron] of opts.agentCrons) {
    const entries = cron.getEntries();
    const handlersNeeded = entries.filter((e) => e.handler);

    if (handlersNeeded.length === 0) continue;

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

    const byFile = new Map<string, CronEntry[]>();
    for (const entry of handlersNeeded) {
      const file = entry.handler!;
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file)!.push(entry);
    }

    for (const [handlerFile, fileEntries] of byFile) {
      const modulePath = resolveHandlerModule(agentsRoot, agentName, handlerFile);
      if (!modulePath) {
        const handlerDir = resolve(agentsRoot, agentName, "handlers");
        const msg = `Handler file not found: ${handlerDir}/${handlerFile}.(js|ts)`;
        errors.push(msg);
        bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
        continue;
      }

      try {
        const mod: HandlerModule = await import(withFreshImportToken(modulePath));
        if (typeof mod.create !== "function") {
          const msg = `Handler ${modulePath} does not export create()`;
          errors.push(msg);
          bus.emit({ type: "info", message: `[handler] ⚠️ ${msg}` });
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
      }
    }

    cron.setHandlerResolver(async (entryName: string, entry: CronEntry): Promise<boolean> => {
      if (!entry.handler) return false;

      const modulePath = resolveHandlerModule(agentsRoot, agentName, entry.handler);
      if (!modulePath) {
        const handlerDir = resolve(agentsRoot, agentName, "handlers");
        bus.emit({
          type: "info",
          message: `[handler] ⚠️ Handler file not found for "${entryName}": ${handlerDir}/${entry.handler}.(js|ts)`,
        });
        return false;
      }

      try {
        const mod: HandlerModule = await import(withFreshImportToken(modulePath));
        if (typeof mod.create !== "function") {
          bus.emit({
            type: "info",
            message: `[handler] ⚠️ Handler ${modulePath} does not export create() — cannot resolve "${entryName}"`,
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
        bus.emit({
          type: "info",
          message: `[handler] ⚠️ Failed to dynamically import handler for "${entryName}": ${errMsg}`,
        });
        return false;
      }
    });
  }

  return { registered, errors };
}

function resolveHandlerModule(agentsRoot: string, agentName: string, handlerFile: string): string | null {
  const handlerDir = resolve(agentsRoot, agentName, "handlers");
  const jsPath = resolve(handlerDir, `${handlerFile}.js`);
  const tsPath = resolve(handlerDir, `${handlerFile}.ts`);
  if (existsSync(jsPath)) return jsPath;
  if (existsSync(tsPath)) return tsPath;
  return null;
}

function createHotReloadHandler(modulePath: string, ctx: HandlerContext, entry: CronEntry) {
  const entrySnapshot = { ...entry };
  return async (event?: TriggerEvent) => {
    const freshMod: HandlerModule = await import(withFreshImportToken(modulePath));
    if (typeof freshMod.create !== "function") {
      throw new Error(`Handler ${modulePath} no longer exports create()`);
    }
    const fn = freshMod.create(ctx, entrySnapshot);
    return fn(event);
  };
}

function withFreshImportToken(modulePath: string): string {
  hotReloadImportSeq += 1;
  return `${modulePath}?t=${Date.now()}-${hotReloadImportSeq}`;
}
