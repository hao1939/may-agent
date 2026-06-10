import { existsSync } from "node:fs";
import { join } from "node:path";
import { importRuntimeModule } from "../lib/runtime-import.js";
import { listRuntimeAgentDirectories } from "./loader/agent-discovery.js";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import type { ModelWithApiKey } from "../lib/types.js";
import type { AgentLoaderOptions } from "./agent-loader.js";
import {
  generateAutoHeartbeats,
  getAgentCrons,
  loadAgents,
} from "./agent-loader.js";
import { installProjectApps } from "./loader/project-app-loader.js";

export async function prepareDaemonAgents(opts: {
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
}): Promise<{ loaderOpts: AgentLoaderOptions }> {
  const loaderOpts: AgentLoaderOptions = {
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    projectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager: opts.manager,
    bus: opts.bus,
    cronEnabled: opts.cronEnabled,
  };

  const loadResult = await loadAgents(loaderOpts);
  console.log(`[agents] Loaded ${loadResult.added.length}: ${loadResult.added.join(", ")}`);
  opts.bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

  const agentSources = listRuntimeAgentDirectories(opts.agentsRoot, opts.projectsRoot);
  const heartbeatRoots = [...new Set(agentSources.map((agent) => agent.agentsRoot))];
  const agentRootByName = new Map(agentSources.map((agent) => [agent.name, agent.agentsRoot]));
  const autoHeartbeats = heartbeatRoots.flatMap((root) => generateAutoHeartbeats(root));
  if (autoHeartbeats.length > 0) {
    const mayCron = getAgentCrons().get("may");
    if (mayCron) {
      for (const entry of autoHeartbeats) {
        mayCron.addSyntheticEntry(entry);
      }
      opts.bus.emit({ type: "info", message: `[auto-heartbeat] Generated ${autoHeartbeats.length} heartbeat(s): ${autoHeartbeats.map((e) => e.agent).join(", ")}` });
    }
  }

  const appResult = await installProjectApps({
    projectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    manager: opts.manager,
    bus: opts.bus,
    agentCrons: getAgentCrons(),
  });
  if (appResult.installed.length > 0) {
    opts.bus.emit({
      type: "info",
      message: `[project-app] Installed ${appResult.installed.length} app(s), ${appResult.entries} trigger(s): ${appResult.installed.map((app) => `${app.id}->${app.owner}`).join(", ")}`,
    });
  }

  for (const cron of getAgentCrons().values()) {
    cron.subscribeToBus(opts.bus);
  }

  let failures = 0;
  const heartbeatFiles = autoHeartbeats.map((entry) => {
    const agentRoot = agentRootByName.get(entry.agent!) ?? opts.agentsRoot;
    const agentWfDir = join(agentRoot, entry.agent!, "workflows");
    return join(agentWfDir, `${entry.agent}-heartbeat.ts`);
  }).filter((file) => existsSync(file));

  for (const file of heartbeatFiles) {
    try {
      await importRuntimeModule(file);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      opts.bus.emit({ type: "info", message: `[startup-check] ⚠️ WORKFLOW BROKEN: ${file.split("/").slice(-3).join("/")} — ${msg}` });
      console.error(`[startup-check] BROKEN WORKFLOW: ${file}\n  ${msg}`);
    }
  }
  if (failures > 0) {
    opts.bus.emit({ type: "info", message: `[startup-check] ⚠️ ${failures} heartbeat workflow(s) failed to load! Heartbeats will NOT fire for those agents.` });
  }

  return { loaderOpts };
}
