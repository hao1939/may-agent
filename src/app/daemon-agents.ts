import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { importRuntimeModule } from "../lib/runtime-import.js";
import { listRuntimeAgentDirectories } from "./loader/agent-discovery.js";
import { loadAgentConfig, validateAgentConfig } from "./loader/agent-config.js";
import { buildTools } from "./loader/toolset-loader.js";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import type { ModelWithApiKey } from "../lib/types.js";
import type { AgentLoaderOptions } from "./agent-loader.js";
import { generateAutoHeartbeats, getAgentCrons, loadAgents, getAgentSessionId } from "./agent-loader.js";
import { installProjectApps, startProjectAppWatcher } from "./loader/project-app-loader.js";

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
  opts.bus.emit({
    type: "info",
    message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}`,
  });

  const agentSources = listRuntimeAgentDirectories(opts.agentsRoot, opts.projectsRoot);
  // Build a map from agentsRoot -> projectId for project-app agent directories.
  // Global agents/ has no projectId (undefined), project-app dirs have one.
  const projectIdByAgentsRoot = new Map<string, string | undefined>();
  for (const agent of agentSources) {
    if (!projectIdByAgentsRoot.has(agent.agentsRoot)) {
      projectIdByAgentsRoot.set(agent.agentsRoot, agent.projectId);
    }
  }
  const heartbeatRoots = [...projectIdByAgentsRoot.entries()];
  const agentRootByName = new Map(agentSources.map((agent) => [agent.name, agent.agentsRoot]));
  const autoHeartbeats = heartbeatRoots.flatMap(([root, pid]) => generateAutoHeartbeats(root, pid));
  if (autoHeartbeats.length > 0) {
    const mayCron = getAgentCrons().get("may");
    if (mayCron) {
      for (const entry of autoHeartbeats) {
        mayCron.addSyntheticEntry(entry);
      }
      opts.bus.emit({
        type: "info",
        message: `[auto-heartbeat] Generated ${autoHeartbeats.length} heartbeat(s): ${autoHeartbeats.map((e) => e.agent).join(", ")}`,
      });
    }
  }

  // App brings its own agent — register from local agent.json when not already loaded
  const registerOwnerAgent = async (ownerName: string, appDir: string): Promise<boolean> => {
    const agentDir = resolve(appDir, "agents", ownerName);
    const config = loadAgentConfig(agentDir, opts.bus);
    if (!config) {
      opts.bus.emit({
        type: "info",
        message: `[project-app] No valid agent.json at ${agentDir} for owner "${ownerName}"`,
      });
      return false;
    }

    const errors = validateAgentConfig(config, opts.models, opts.agentsRoot);
    if (errors.length > 0) {
      opts.bus.emit({
        type: "info",
        message: `[project-app] Agent config errors for ${ownerName}: ${errors.map((e) => e.message).join(", ")}`,
      });
      return false;
    }

    const model = opts.models[config.model];
    const knowledgeDir = resolve(agentDir, "knowledge");
    const workspace = resolve(agentDir, "workspace");

    opts.manager.register({
      name: config.name,
      description: config.description,
      domain: config.domain,
      model,
      tools: await buildTools(config, {
        ...loaderOpts,
        agentsRoot: resolve(appDir, "agents"),
        globalAgentsRoot: opts.agentsRoot,
        agentDir,
        getAgentSessionId,
        getAgentCrons: () => getAgentCrons(),
        setAgentCron: (name, cron) => getAgentCrons().set(name, cron),
        addCleanup: () => {},
      }),
      agentDir,
      knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
      workspace: existsSync(workspace) ? workspace : undefined,
      projectRoot: opts.projectRoot,
      apiKey: model.apiKey,
      memoryLimit: config.memoryLimit,
      compaction: config.compaction,
      contextFiles: config.context_files?.map((f) => resolve(agentDir, f)),
    });

    opts.bus.emit({
      type: "info",
      message: `[project-app] Auto-registered owner agent "${ownerName}" from ${agentDir}`,
    });
    return true;
  };

  const projectAppOpts = {
    projectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    manager: opts.manager,
    bus: opts.bus,
    agentCrons: getAgentCrons(),
    registerOwnerAgent,
  };

  const appResult = await installProjectApps(projectAppOpts);
  if (appResult.installed.length > 0) {
    opts.bus.emit({
      type: "info",
      message: `[project-app] Installed ${appResult.installed.length} app(s), ${appResult.entries} trigger(s): ${appResult.installed.map((app) => `${app.id}->${app.owner}`).join(", ")}`,
    });
  }
  startProjectAppWatcher(projectAppOpts);

  // Cron subscribe + start is handled by cron-startup.ts in one centralized
  // loop after all crons (agent-level and app-level) are created and loaded.

  let failures = 0;
  const heartbeatFiles = autoHeartbeats
    .map((entry) => {
      const agentRoot = agentRootByName.get(entry.agent!) ?? opts.agentsRoot;
      const agentWfDir = join(agentRoot, entry.agent!, "workflows");
      return join(agentWfDir, `${entry.agent}-heartbeat.ts`);
    })
    .filter((file) => existsSync(file));

  for (const file of heartbeatFiles) {
    try {
      await importRuntimeModule(file);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      opts.bus.emit({
        type: "info",
        message: `[startup-check] ⚠️ WORKFLOW BROKEN: ${file.split("/").slice(-3).join("/")} — ${msg}`,
      });
      console.error(`[startup-check] BROKEN WORKFLOW: ${file}\n  ${msg}`);
    }
  }
  if (failures > 0) {
    opts.bus.emit({
      type: "info",
      message: `[startup-check] ⚠️ ${failures} heartbeat workflow(s) failed to load! Heartbeats will NOT fire for those agents.`,
    });
  }

  return { loaderOpts };
}
