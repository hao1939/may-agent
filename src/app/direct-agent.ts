import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  executePreparedAgent,
  prepareAgentExecution,
  type DirectAgentExecutionResult,
} from "../lib/agent-execution.js";
import { generateId } from "../lib/manager-utils.js";
import { discoverAgentSkills } from "../lib/skills.js";
import { createCodingTools } from "../lib/tools/coding.js";
import { createFinishTool } from "../lib/tools/lifecycle.js";
import { createReadTool } from "../lib/tools/read.js";
import { createBackgroundExecTool } from "../lib/background-exec.js";
import { createScrapeTool } from "../lib/scrape.js";
import type { ModelWithApiKey, SubagentDefinition } from "../lib/types.js";
import { resolveRuntimeAgentDirectory, type AgentDirectory } from "./loader/agent-discovery.js";
import type { AgentConfig } from "./loader/agent-config.js";

const DIRECT_CAPABILITIES = new Set(["coding", "read-only", "scrape", "finish", "background-exec"]);

export type DirectAgentRunOptions = {
  agentName: string;
  task: string;
  projectRoot: string;
  workRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot?: string;
  globalAgentsRoot?: string;
  outputRoot: string;
  models: Record<string, ModelWithApiKey>;
  timeoutMs?: number;
  onNotice?: (message: string) => void;
};

export type DirectAgentRunResult = DirectAgentExecutionResult & {
  sessionId: string;
  sessionPath: string;
  systemPrompt: string;
  model: string;
  unavailableCapabilities: string[];
};

function resolveAgentSource(options: DirectAgentRunOptions): AgentDirectory {
  const explicit = resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName);
  const source = explicit ?? resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName, options.projectsRoot);
  if (!source) {
    throw new Error(`Agent "${options.agentName}" was not found under ${options.agentsRoot}`);
  }
  return source;
}

function readAgentConfig(source: AgentDirectory): AgentConfig {
  const path = join(source.dir, "agent.json");
  const config = JSON.parse(readFileSync(path, "utf8")) as AgentConfig & {
    disabled?: boolean;
  };
  if (config.disabled) throw new Error(`Agent "${config.name || source.name}" is disabled`);
  for (const field of ["name", "description", "domain", "model", "tools"] as const) {
    if (!config[field]) throw new Error(`Agent config ${path} is missing ${field}`);
  }
  return config;
}

async function loadDirectLocalTools(source: AgentDirectory, options: DirectAgentRunOptions): Promise<AgentTool[]> {
  const toolsDir = join(source.dir, "tools");
  if (!existsSync(toolsDir)) return [];
  const tools: AgentTool[] = [];
  for (const entry of readdirSync(toolsDir).sort()) {
    if (!entry.endsWith(".ts") && !entry.endsWith(".js")) continue;
    const path = join(toolsDir, entry);
    const module = await import(pathToFileURL(path).href);
    if (typeof module.default !== "function") {
      options.onNotice?.(`Skipping ${path}: expected a default tool factory`);
      continue;
    }
    const tool = await module.default({
      projectRoot: options.workRoot,
      agentRoot: source.dir,
      persistDir: options.outputRoot,
    });
    if (tool && typeof tool.name === "string") tools.push(tool);
  }
  return tools;
}

async function buildDirectTools(
  config: AgentConfig,
  source: AgentDirectory,
  options: DirectAgentRunOptions,
): Promise<{ tools: AgentTool[]; cleanup: Array<() => void>; unavailable: string[] }> {
  const tools: AgentTool[] = [];
  const cleanup: Array<() => void> = [];
  const unavailable: string[] = [];
  for (const capability of config.tools) {
    switch (capability) {
      case "coding":
        tools.push(...createCodingTools(options.workRoot, { agentName: config.name }));
        break;
      case "read-only":
        tools.push(createReadTool(options.workRoot) as AgentTool);
        break;
      case "scrape":
        tools.push(createScrapeTool());
        break;
      case "finish":
        tools.push(
          createFinishTool({
            agentName: config.name,
            projectRoot: options.workRoot,
            persistDir: options.outputRoot,
          }),
        );
        break;
      case "background-exec": {
        const background = createBackgroundExecTool({
          cwd: options.workRoot,
          denyMessage: "Do not explore outside the scenario work root.",
          allowAgentSpawn: false,
        });
        tools.push(background.tool);
        cleanup.push(background.cleanup);
        break;
      }
      case "query_db":
      case "query-db":
        unavailable.push(capability);
        break;
      default:
        if (!DIRECT_CAPABILITIES.has(capability)) unavailable.push(capability);
        break;
    }
  }
  tools.push(...(await loadDirectLocalTools(source, options)));
  return { tools, cleanup, unavailable: [...new Set(unavailable)].sort() };
}

/**
 * Load and run one agent directly. This adapter intentionally does not create
 * EventBus, SQLite, SubagentManager, schedules, task state, or recovery.
 */
export async function runDirectAgent(options: DirectAgentRunOptions): Promise<DirectAgentRunResult> {
  const source = resolveAgentSource(options);
  const config = readAgentConfig(source);
  if (config.name !== options.agentName) {
    throw new Error(`Agent directory ${source.dir} declares ${config.name}, not ${options.agentName}`);
  }
  const model = options.models[config.model];
  if (!model) throw new Error(`Agent ${config.name} uses unknown model ${config.model}`);
  const { tools, cleanup, unavailable } = await buildDirectTools(config, source, options);
  for (const capability of unavailable) {
    options.onNotice?.(`Direct run omits hosted capability "${capability}" for agent ${config.name}`);
  }

  const knowledgeDir = join(source.dir, "knowledge");
  const workspace = join(source.dir, "workspace");
  const skillCatalog = await discoverAgentSkills({
    agentDir: source.dir,
    appLocal:
      source.projectId !== undefined ||
      resolve(options.agentsRoot) !== resolve(options.globalAgentsRoot ?? join(options.projectRoot, "agents")),
    globalAgentDir: resolve(options.globalAgentsRoot ?? join(options.projectRoot, "agents"), config.name),
    sharedRoot: options.sharedRoot,
  });
  for (const diagnostic of skillCatalog.diagnostics) options.onNotice?.(diagnostic);

  const definition: SubagentDefinition = {
    name: config.name,
    description: config.description,
    domain: config.domain,
    model,
    tools,
    agentDir: source.dir,
    knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
    workspace: existsSync(workspace) ? workspace : undefined,
    projectRoot: options.workRoot,
    apiKey: model.apiKey,
    memoryLimit: config.memoryLimit,
    compaction: config.compaction,
    skillCatalog,
  };

  const sessionId = generateId("direct");
  const sessionPath = resolve(options.outputRoot, "sessions", sessionId);
  mkdirSync(sessionPath, { recursive: true });
  const transcriptPath = join(sessionPath, "session.jsonl");
  const prepared = prepareAgentExecution({
    definition,
    projectRoot: options.projectRoot,
    sessionId,
    task: options.task,
    createFinish: () =>
      createFinishTool({
        agentName: config.name,
        projectRoot: options.workRoot,
        persistDir: options.outputRoot,
      }),
    onNotice: options.onNotice,
  });
  writeFileSync(
    join(sessionPath, "meta.json"),
    `${JSON.stringify(
      {
        sessionId,
        agent: config.name,
        model: config.model,
        kind: "direct",
        unavailableCapabilities: unavailable,
      },
      null,
      2,
    )}\n`,
  );

  try {
    const result = await executePreparedAgent(prepared, {
      timeoutMs: options.timeoutMs,
      onObservation: (event) => {
        if (event.type === "message_end" && "message" in event) {
          appendFileSync(transcriptPath, `${JSON.stringify((event as { message: AgentMessage }).message)}\n`);
        }
      },
    });
    return {
      ...result,
      sessionId,
      sessionPath,
      systemPrompt: prepared.systemPrompt,
      model: config.model,
      unavailableCapabilities: unavailable,
    };
  } finally {
    for (const close of cleanup) close();
  }
}
