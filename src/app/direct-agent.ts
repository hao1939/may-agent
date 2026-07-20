import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  executePreparedAgent,
  prepareAgentExecution,
  type DirectAgentExecutionResult,
  type PreparedAgentExecution,
} from "../lib/agent-execution.js";
import { generateId } from "../lib/manager-utils.js";
import { createCodingTools } from "../lib/tools/coding.js";
import { createFinishTool } from "../lib/tools/lifecycle.js";
import { createReadTool } from "../lib/tools/read.js";
import { createBackgroundExecTool } from "../lib/background-exec.js";
import { createScrapeTool } from "../lib/scrape.js";
import type { ModelWithApiKey } from "../lib/types.js";
import { buildAgentDefinition } from "./loader/agent-definition.js";
import { resolveRuntimeAgentDirectory, type AgentDirectory } from "./loader/agent-discovery.js";
import { readAgentConfigFile, validateAgentConfig, type AgentConfig } from "./loader/agent-config.js";
import { loadAgentLocalTools } from "./loader/agent-local-tools.js";

export type ToolDenial = {
  name: string;
  reason: string;
};

export type AgentExecutionManifest = {
  agent: string;
  configuredTools: string[];
  deniedTools: ToolDenial[];
  effectiveTools: string[];
};

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
  toolDenials?: ToolDenial[];
  timeoutMs?: number;
  /** Fixed only when deterministic preparation/evaluation evidence is required. */
  promptTimestamp?: string;
  /** Fixed only when deterministic preparation/evaluation evidence is required. */
  sessionId?: string;
  onNotice?: (message: string) => void;
};

export type DirectAgentRunResult = DirectAgentExecutionResult & {
  sessionId: string;
  sessionPath: string;
  systemPrompt: string;
  model: string;
  executionManifest: AgentExecutionManifest;
};

export type DirectAgentPreparation = {
  prepared: PreparedAgentExecution;
  sessionId: string;
  sessionPath: string;
  model: string;
  executionManifest: AgentExecutionManifest;
  cleanup(): void;
};

function resolveAgentSource(options: DirectAgentRunOptions): AgentDirectory {
  const explicit = resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName);
  const source = explicit ?? resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName, options.projectsRoot);
  if (!source) {
    throw new Error(`Agent "${options.agentName}" was not found under ${options.agentsRoot}`);
  }
  return source;
}

export function resolveDirectToolPolicy(
  agent: string,
  configuredTools: string[],
  denials: ToolDenial[] = [],
): AgentExecutionManifest {
  const configured = new Set(configuredTools);
  const seen = new Set<string>();
  const normalizedDenials = denials.map((denial) => ({
    name: denial.name.trim(),
    reason: denial.reason.trim(),
  }));
  for (const denial of normalizedDenials) {
    if (!denial.name) throw new Error(`Direct run for ${agent} has a tool denial with no name`);
    if (!denial.reason) throw new Error(`Direct run denial for tool "${denial.name}" requires a reason`);
    if (!configured.has(denial.name)) {
      throw new Error(`Direct run denial names unconfigured tool "${denial.name}" for agent ${agent}`);
    }
    if (seen.has(denial.name)) throw new Error(`Direct run denies tool "${denial.name}" more than once`);
    seen.add(denial.name);
  }
  return {
    agent,
    configuredTools: [...configuredTools],
    deniedTools: normalizedDenials,
    effectiveTools: configuredTools.filter((name) => !seen.has(name)),
  };
}

async function buildDirectTools(
  config: AgentConfig,
  source: AgentDirectory,
  options: DirectAgentRunOptions,
  effectiveTools: string[],
): Promise<{ tools: AgentTool[]; cleanup: Array<() => void> }> {
  const tools: AgentTool[] = [];
  const cleanup: Array<() => void> = [];
  for (const capability of effectiveTools) {
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
      default:
        throw new Error(
          `Direct run cannot construct effective tool "${capability}" for agent ${config.name}; ` +
            `the caller must provide an explicit denial or a direct tool implementation`,
        );
    }
  }
  tools.push(
    ...(await loadAgentLocalTools(config.name, source.dir, {
      projectRoot: options.workRoot,
      persistDir: options.outputRoot,
      onNotice: options.onNotice,
    })),
  );
  return { tools, cleanup };
}

/** Prepare one direct run without constructing autonomous infrastructure. */
export async function prepareDirectAgentExecution(options: DirectAgentRunOptions): Promise<DirectAgentPreparation> {
  const source = resolveAgentSource(options);
  const config = readAgentConfigFile(source.dir);
  if (!config) throw new Error(`Agent "${options.agentName}" is disabled or has no agent.json`);
  const configErrors = validateAgentConfig(config, options.models, options.agentsRoot);
  if (configErrors.length > 0) {
    throw new Error(
      `Invalid agent ${options.agentName}: ${configErrors.map((error) => `${error.field}: ${error.message}`).join("; ")}`,
    );
  }
  if (config.name !== options.agentName) {
    throw new Error(`Agent directory ${source.dir} declares ${config.name}, not ${options.agentName}`);
  }
  const model = options.models[config.model];
  if (!model) throw new Error(`Agent ${config.name} uses unknown model ${config.model}`);
  const executionManifest = resolveDirectToolPolicy(config.name, config.tools, options.toolDenials);
  const { tools, cleanup } = await buildDirectTools(config, source, options, executionManifest.effectiveTools);
  const definition = await buildAgentDefinition({
    config,
    source,
    model,
    tools,
    projectRoot: options.workRoot,
    sharedRoot: options.sharedRoot,
    globalAgentsRoot: options.globalAgentsRoot ?? join(options.projectRoot, "agents"),
  });
  for (const diagnostic of definition.skillCatalog?.diagnostics ?? []) options.onNotice?.(diagnostic);

  const sessionId = options.sessionId ?? generateId("direct");
  const sessionPath = resolve(options.outputRoot, "sessions", sessionId);
  const prepared = prepareAgentExecution({
    definition,
    projectRoot: options.projectRoot,
    sessionId,
    task: options.task,
    promptTimestamp: options.promptTimestamp,
    createFinish: () =>
      createFinishTool({
        agentName: config.name,
        projectRoot: options.workRoot,
        persistDir: options.outputRoot,
      }),
    onNotice: options.onNotice,
  });

  return {
    prepared,
    sessionId,
    sessionPath,
    model: config.model,
    executionManifest,
    cleanup: () => {
      for (const close of cleanup) close();
    },
  };
}

/**
 * Load and run one agent directly. This adapter intentionally does not create
 * EventBus, SQLite, SubagentManager, schedules, task state, or recovery.
 */
export async function runDirectAgent(options: DirectAgentRunOptions): Promise<DirectAgentRunResult> {
  const direct = await prepareDirectAgentExecution(options);
  const { prepared, sessionId, sessionPath, executionManifest } = direct;
  mkdirSync(sessionPath, { recursive: true });
  const transcriptPath = join(sessionPath, "session.jsonl");
  writeFileSync(
    join(sessionPath, "meta.json"),
    `${JSON.stringify(
      {
        sessionId,
        agent: prepared.definition.name,
        model: direct.model,
        kind: "direct",
        executionManifest,
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
      model: direct.model,
      executionManifest,
    };
  } finally {
    direct.cleanup();
  }
}
