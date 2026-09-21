import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import type { TSchema } from "@earendil-works/pi-ai";
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
  /** Capability bundle names retained from agent.json. */
  configuredTools: string[];
  deniedTools: ToolDenial[];
  /** Concrete model-visible names, including tools injected during preparation. */
  effectiveTools: string[];
};

type DirectToolInventory = {
  tools: AgentTool[];
  cleanup: Array<() => void>;
  concreteToolsByCapability: Map<string, string[]>;
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
  /**
   * Agent files exposed inside an isolated execution root. Configuration and
   * local tools still load from agentsRoot, while prompt identity and skills
   * resolve from this readable copy.
   */
  visibleAgentDir?: string;
  outputRoot: string;
  models: Record<string, ModelWithApiKey>;
  /** Optional caller-owned structured result contract, enforced by finish(). */
  outputSchema?: TSchema;
  /**
   * Hide configured capability bundles or concrete tool names from the model.
   * This controls tool visibility, not process/OS isolation. Supported bundle
   * implementations and agent-local factories run while tools are inventoried.
   */
  toolDenials?: ToolDenial[];
  timeoutMs?: number;
  signal?: AbortSignal;
  deadlineAt?: number;
  /** Fixed only when deterministic preparation/evaluation facts are required. */
  promptTimestamp?: string;
  /** Fixed only when deterministic preparation/evaluation facts are required. */
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
  concreteTools: string[] = configuredTools,
  concreteToolsByCapability: ReadonlyMap<string, string[]> = new Map(
    configuredTools.map((name) => [name, [name]]),
  ),
): AgentExecutionManifest {
  const configured = new Set(configuredTools);
  const concrete = new Set(concreteTools);
  const seen = new Set<string>();
  const deniedConcrete = new Set<string>();
  const normalizedDenials = denials.map((denial) => ({
    name: denial.name.trim(),
    reason: denial.reason.trim(),
  }));
  for (const denial of normalizedDenials) {
    if (!denial.name) throw new Error(`Direct run for ${agent} has a tool denial with no name`);
    if (!denial.reason) throw new Error(`Direct run denial for tool "${denial.name}" requires a reason`);
    if (!configured.has(denial.name) && !concrete.has(denial.name)) {
      throw new Error(`Direct run denial names unknown tool "${denial.name}" for agent ${agent}`);
    }
    if (seen.has(denial.name)) throw new Error(`Direct run denies tool "${denial.name}" more than once`);
    seen.add(denial.name);
    if (configured.has(denial.name)) {
      for (const name of concreteToolsByCapability.get(denial.name) ?? []) deniedConcrete.add(name);
    }
    if (concrete.has(denial.name)) deniedConcrete.add(denial.name);
  }
  return {
    agent,
    configuredTools: [...configuredTools],
    deniedTools: normalizedDenials,
    effectiveTools: concreteTools.filter((name) => !deniedConcrete.has(name)),
  };
}

async function buildDirectTools(
  config: AgentConfig,
  source: AgentDirectory,
  options: DirectAgentRunOptions,
): Promise<DirectToolInventory> {
  const tools: AgentTool[] = [];
  const cleanup: Array<() => void> = [];
  const concreteToolsByCapability = new Map<string, string[]>();
  const deniedCapabilityNames = new Set(
    (options.toolDenials ?? []).map((denial) => denial.name.trim()).filter((name) => config.tools.includes(name)),
  );
  // Build complete inventories for supported bundles before applying denials so
  // overlapping bundle and concrete-name denials validate independently.
  for (const capability of config.tools) {
    const capabilityTools: AgentTool[] = [];
    switch (capability) {
      case "coding":
        capabilityTools.push(...createCodingTools(options.workRoot, { agentName: config.name }));
        break;
      case "read-only":
        capabilityTools.push(createReadTool(options.workRoot) as AgentTool);
        break;
      case "scrape":
        capabilityTools.push(createScrapeTool());
        break;
      case "finish":
        capabilityTools.push(
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
        capabilityTools.push(background.tool);
        cleanup.push(background.cleanup);
        break;
      }
      default:
        if (deniedCapabilityNames.has(capability)) {
          concreteToolsByCapability.set(capability, []);
          continue;
        }
        throw new Error(
          `Direct run cannot construct effective tool "${capability}" for agent ${config.name}; ` +
            `the caller must provide an explicit denial or a direct tool implementation`,
        );
    }
    tools.push(...capabilityTools);
    concreteToolsByCapability.set(
      capability,
      capabilityTools.map((tool) => tool.name),
    );
  }
  // These factories are trusted installation code. A denial can hide their
  // returned tools from the model, but does not sandbox or prevent factory code.
  tools.push(
    ...(await loadAgentLocalTools(config.name, source.dir, {
      projectRoot: options.workRoot,
      persistDir: options.outputRoot,
      onNotice: options.onNotice,
    })),
  );
  return { tools, cleanup, concreteToolsByCapability };
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
  const inventory = await buildDirectTools(config, source, options);
  const cleanup = () => {
    for (const close of inventory.cleanup) close();
  };
  try {
    const availableToolNames = inventory.tools.map((tool) => tool.name);
    // Structured direct calls require prepareAgentExecution() to expose finish,
    // even when finish was not one of the configured capability bundles. Treat
    // that concrete tool as available while validating the caller's policy.
    if (options.outputSchema !== undefined && !availableToolNames.includes("finish")) {
      availableToolNames.push("finish");
    }
    const policy = resolveDirectToolPolicy(
      config.name,
      config.tools,
      options.toolDenials,
      availableToolNames,
      inventory.concreteToolsByCapability,
    );
    const effectiveNames = new Set(policy.effectiveTools);
    const tools = inventory.tools.filter((tool) => effectiveNames.has(tool.name));
    const definitionSource = options.visibleAgentDir ? { ...source, dir: resolve(options.visibleAgentDir) } : source;
    const definition = await buildAgentDefinition({
      config,
      source: definitionSource,
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
      outputSchema: options.outputSchema,
      requireFinish: options.outputSchema !== undefined,
      promptTimestamp: options.promptTimestamp,
      createFinish: () =>
        createFinishTool({
          agentName: config.name,
          projectRoot: options.workRoot,
          persistDir: options.outputRoot,
        }),
      onNotice: options.onNotice,
    });
    const preparedToolNames = prepared.tools.map((tool) => tool.name);
    const deniedPreparedTool = policy.deniedTools.find((denial) => preparedToolNames.includes(denial.name));
    if (deniedPreparedTool) {
      throw new Error(
        `Direct run for ${config.name} requires denied tool "${deniedPreparedTool.name}" during preparation`,
      );
    }
    const executionManifest = { ...policy, effectiveTools: preparedToolNames };

    return {
      prepared,
      sessionId,
      sessionPath,
      model: config.model,
      executionManifest,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
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
      signal: options.signal,
      deadlineAt: options.deadlineAt,
      onObservation: (event) => {
        if (event.type === "message_end" && "message" in event) {
          appendFileSync(transcriptPath, `${JSON.stringify((event as { message: AgentMessage }).message)}\n`);
        }
      },
    });
    try {
      writeFileSync(
        join(sessionPath, "usage.json"),
        JSON.stringify({ sessionId, outcome: result.status, durationMs: result.durationMs, ...result.usage }, null, 2) + "\n",
      );
    } catch (error) {
      try {
        options.onNotice?.(`Could not save usage measurements: ${String(error)}`);
      } catch {
        /* optional evidence */
      }
    }
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
