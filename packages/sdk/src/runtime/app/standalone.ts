/**
 * Host-free direct workflow & standalone target runner for CLI, Gym, and scripts.
 *
 * Composes the portable workflow invocation kernel with `runDirectAgent`,
 * `runCliAgent`, and `buildWorkflowCatalog`. Intentionally constructs no SQLite
 * database, EventBus, SubagentManager, schedule, or daemon state.
 */

import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type TSchema } from "typebox";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { AgentCallOptions, AppRead, CallOptions, WorkflowContext } from "@may-agent/sdk/app";
import {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
  createWorkflowAllowance,
  resolveCallable,
  runWorkflowInvocation,
  type NormalizedWorkflowContribution,
  type PreparedCatalog,
  type WorkflowExecutableModule,
  type WorkflowExecutionAllowance,
  type WorkflowKernelOutcome,
  type WorkflowKernelResolvedTarget,
  type WorkflowKernelStepControl,
  type WorkflowLogEntry,
  type WorkflowRunReport,
  type WorkflowStepInvocationResult,
  type WorkflowStepTrace,
} from "../../workflow-kernel.js";
import { ExecutionDeferredError } from "../../workflow.js";
import {
  assertUniqueToolNames,
  executePreparedAgent,
  prepareAgentExecution,
  validateOperationAllowance,
  type DirectAgentExecutionResult,
  type PreparedAgentExecution,
  type ToolPolicy,
} from "../lib/agent-execution.js";
import { runCliAgent, type CliAgentInput, type CliAgentOptions, type CliAgentResult } from "../lib/cli-agent.js";
import { agentExecutionResult, enforceStructuredWorkflowResult, generateId } from "../lib/manager-utils.js";
import type { ModelWithApiKey, TaskResult } from "../lib/manager-utils.js";
import { buildWorkflowCatalog, findWorkflow } from "../lib/runtime-import.js";
import { drainSessionBashProcessGroups } from "../lib/tools/bash.js";
import {
  CallableCatalog,
  canonicalCallableName,
  formatExecutionInput,
  validateCallableInput,
  type CallableDefinition,
  type CallableDescriptor,
  type CallableResult,
} from "../../callable.js";
import { createCodingTools } from "../lib/tools/edit.js";
import { createFinishTool } from "../lib/tools/lifecycle.js";
import { readFileWritePolicy, type FileWritePolicy } from "../lib/tools/path-utils.js";
import { createReadTool } from "../lib/tools/read.js";
import {
  buildAgentDefinition,
  listRuntimeAgentDirectories,
  loadAgentLocalTools,
  readAgentConfigFile,
  resolveRuntimeAgentDirectory,
  validateAgentConfig,
  type AgentConfig,
  type AgentDirectory,
} from "./loader/agent-config.js";
import { createModelRegistry } from "./model-registry.js";

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

export type DirectCapabilityProviderContext = {
  agentName: string;
  capability: string;
  projectRoot: string;
  workRoot: string;
  outputRoot: string;
  sessionId: string;
};

export type DirectCapabilityBinding = {
  tools: AgentTool[];
  cleanup?: () => void;
  cleanupAsync?: () => Promise<boolean>;
};

/** Generic caller binding for explicitly declared capabilities not built into the SDK. */
export type DirectCapabilityProvider = (
  context: DirectCapabilityProviderContext,
) =>
  | AgentTool[]
  | DirectCapabilityBinding
  | Promise<AgentTool[] | DirectCapabilityBinding>;

export type DirectAgentRunOptions = {
  agentName: string;
  /** Trusted source already selected by the invocation's catalog. */
  agentSource?: AgentDirectory;
  /** Complete immutable configuration captured with the callable catalog. */
  agentConfig?: Readonly<AgentConfig>;
  /** Immutable prompt identity captured with the callable catalog. */
  identityText?: string;
  /** Immutable shared prompt captured with the callable catalog. */
  sharedPromptText?: string;
  /** Explicit skill name to activate via the shared skill catalog. */
  skill?: string;
  /** Optional ordinary assignment/context facts appended for model requests. */
  contextMessages?: () => AgentMessage[] | Promise<AgentMessage[]>;
  task: string;
  projectRoot: string;
  /** Explicit installation-layout workspace, possibly separate from projectRoot. */
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
  /** Require finish() termination even when outputSchema is omitted. */
  requireFinish?: boolean;
  /** Per-call capability restriction (for example "readonly"), applied after tool expansion. */
  toolPolicy?: ToolPolicy;
  /** Retired. Supplying this option throws; use timeoutMs or deadlineAt. */
  operationAllowance?: number;
  toolDenials?: ToolDenial[];
  /** Bind services for explicitly declared capabilities that the portable SDK does not implement. */
  capabilityProviders?: Readonly<Record<string, DirectCapabilityProvider>>;
  /** Reports the concrete prompt-session identity before model execution starts. */
  onSessionStarted?: (sessionId: string) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
  deadlineAt?: number;
  /** Fixed only when deterministic preparation/evaluation facts are required. */
  promptTimestamp?: string;
  /** Fixed only when deterministic preparation/evaluation facts are required. */
  sessionId?: string;
  /** Optional override for background process-group draining in tests. */
  drainProcessGroup?: (pgid: number) => Promise<boolean>;
  onNotice?: (message: string) => void;
};

export type DirectAgentRunResult = DirectAgentExecutionResult & {
  sessionId: string;
  sessionPath: string;
  systemPrompt: string;
  model: string;
  executionManifest: AgentExecutionManifest;
  cleanupConfirmed: boolean;
};

export type DirectAgentPreparation = {
  prepared: PreparedAgentExecution;
  sessionId: string;
  sessionPath: string;
  model: string;
  executionManifest: AgentExecutionManifest;
  cleanup(): void;
  cleanupAsync(): Promise<boolean>;
};

function resolveAgentSource(options: DirectAgentRunOptions): AgentDirectory {
  if (options.agentSource) return options.agentSource;
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

type DirectToolResources = {
  cleanupSync: Array<() => void>;
  cleanupAsync: Array<() => Promise<boolean>>;
  cleanupConfirmed: boolean;
  cleanupFinalization?: Promise<boolean>;
};

function cleanupDirectToolResourcesSync(resources: DirectToolResources): void {
  const failures: unknown[] = [];
  for (const close of resources.cleanupSync.splice(0).reverse()) {
    try {
      close();
    } catch (error) {
      resources.cleanupConfirmed = false;
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more direct capability cleanup handlers failed");
  }
}

function cleanupDirectToolResources(resources: DirectToolResources): Promise<boolean> {
  if (resources.cleanupFinalization) return resources.cleanupFinalization;
  resources.cleanupFinalization = Promise.resolve().then(async () => {
    try {
      cleanupDirectToolResourcesSync(resources);
    } catch {
      // The retained flag keeps uncertainty visible after cleanup() followed by cleanupAsync().
    }
    const asyncClosers = resources.cleanupAsync.splice(0).reverse();
    const outcomes = await Promise.all(
      asyncClosers.map(async (close) => {
        try {
          return await close();
        } catch {
          return false;
        }
      }),
    );
    if (!outcomes.every(Boolean)) resources.cleanupConfirmed = false;
    return resources.cleanupConfirmed;
  });
  return resources.cleanupFinalization;
}

async function buildDirectTools(
  config: AgentConfig,
  source: AgentDirectory,
  options: DirectAgentRunOptions,
  sessionId: string,
  effectiveTools: string[],
  fileWritePolicy: FileWritePolicy,
  resources: DirectToolResources,
): Promise<AgentTool[]> {
  const tools: AgentTool[] = [];
  const sources: string[] = [];
  const { cleanupSync, cleanupAsync } = resources;
  const boundCapabilities =
    options.capabilityProviders?.agents && !effectiveTools.includes("agents")
      ? [...effectiveTools, "agents"]
      : effectiveTools;
  for (const capability of boundCapabilities) {
    switch (capability) {
      case "coding":
        tools.push(
          ...createCodingTools(options.workRoot, {
            agentName: config.name,
            fileWritePolicy,
            processGroupOwner: { persistDir: options.outputRoot, sessionId },
          }),
        );
        cleanupAsync.push(() => drainSessionBashProcessGroups(options.outputRoot, sessionId));
        break;
      case "read-only":
        tools.push(createReadTool(options.workRoot) as AgentTool);
        break;
      case "finish":
        tools.push(
          createFinishTool({
            projectRoot: options.workRoot,
          }),
        );
        break;
      default: {
        const provider = options.capabilityProviders?.[capability];
        if (!provider) {
          throw new Error(
            `Direct run cannot construct effective tool "${capability}" for agent ${config.name}; ` +
              `the caller must provide an explicit denial or capability provider`,
          );
        }
        const provided = await provider({
          agentName: config.name,
          capability,
          projectRoot: options.projectRoot,
          workRoot: options.workRoot,
          outputRoot: options.outputRoot,
          sessionId,
        });
        const binding: DirectCapabilityBinding = Array.isArray(provided) ? { tools: provided } : provided;
        if (binding?.cleanup) cleanupSync.push(binding.cleanup);
        if (binding?.cleanupAsync) cleanupAsync.push(binding.cleanupAsync);
        if (!binding || !Array.isArray(binding.tools) || binding.tools.length === 0) {
          throw new Error(
            `Capability provider "${capability}" returned no tools for agent ${config.name}`,
          );
        }
        tools.push(...binding.tools);
        break;
      }
    }
    while (sources.length < tools.length) sources.push(`configured capability "${capability}"`);
  }
  const localTools = await loadAgentLocalTools(config.name, source.dir, {
    projectRoot: options.workRoot,
    persistDir: options.outputRoot,
    onNotice: options.onNotice,
  });
  tools.push(...localTools);
  sources.push(...localTools.map(() => `agent-local tools for "${config.name}"`));
  assertUniqueToolNames(
    tools.map((tool, index) => ({ tool, source: sources[index]! })),
    config.name,
  );
  return tools;
}

/** Prepare one direct run without constructing autonomous infrastructure. */
export async function prepareDirectAgentExecution(options: DirectAgentRunOptions): Promise<DirectAgentPreparation> {
  validateOperationAllowance(options.operationAllowance);
  const source = resolveAgentSource(options);
  const config = options.agentConfig ? structuredClone(options.agentConfig) : readAgentConfigFile(source.dir);
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
  const sessionId = options.sessionId ?? generateId("direct");
  const sessionPath = resolve(options.outputRoot, "sessions", sessionId);
  let executionManifest = resolveDirectToolPolicy(config.name, config.tools, options.toolDenials);
  const fileWritePolicy: FileWritePolicy = {
    ...readFileWritePolicy(options.sharedRoot, options.projectRoot),
    execution: { root: resolve(options.workRoot), sourceRoot: resolve(options.projectRoot) },
  };
  const resources: DirectToolResources = { cleanupSync: [], cleanupAsync: [], cleanupConfirmed: true };
  try {
    const tools = await buildDirectTools(
      config,
      source,
      options,
      sessionId,
      executionManifest.effectiveTools,
      fileWritePolicy,
      resources,
    );
    const definitionSource = options.visibleAgentDir ? { ...source, dir: resolve(options.visibleAgentDir) } : source;
    const definition = await buildAgentDefinition({
      config,
      source: definitionSource,
      model,
      tools,
      projectRoot: options.workRoot,
      sharedRoot: options.sharedRoot,
      globalAgentsRoot: options.globalAgentsRoot ?? join(options.projectRoot, "agents"),
      ...(options.identityText !== undefined ? { identityText: options.identityText } : {}),
      ...(options.sharedPromptText !== undefined ? { sharedPromptText: options.sharedPromptText } : {}),
    });
    definition.fileWritePolicy = fileWritePolicy;
    for (const diagnostic of definition.skillCatalog?.diagnostics ?? []) options.onNotice?.(diagnostic);

    const prepared = prepareAgentExecution({
      definition,
      projectRoot: options.projectRoot,
      sessionId,
      task: options.task,
      ...(options.skill !== undefined ? { skill: options.skill } : {}),
      ...(options.contextMessages !== undefined ? { contextMessages: options.contextMessages } : {}),
      outputSchema: options.outputSchema,
      requireFinish: options.requireFinish === true || options.outputSchema !== undefined,
      toolPolicy: options.toolPolicy,
      promptTimestamp: options.promptTimestamp,
      createFinish: () =>
        createFinishTool({
          projectRoot: options.workRoot,
        }),
      onNotice: options.onNotice,
    });
    // Keep configured capability policy unchanged, but report the concrete tools
    // that the model can actually see after local and schema-driven preparation.
    executionManifest = {
      ...executionManifest,
      effectiveTools: prepared.tools.map((tool) => tool.name),
    };

    return {
      prepared,
      sessionId,
      sessionPath,
      model: config.model,
      executionManifest,
      cleanup: () => cleanupDirectToolResourcesSync(resources),
      cleanupAsync: () => cleanupDirectToolResources(resources),
    };
  } catch (error) {
    const cleanupConfirmed = await cleanupDirectToolResources(resources);
    if (!cleanupConfirmed) {
      throw new WorkflowUnconfirmedCleanupError(options.agentName, [`agent:${options.agentName} (${sessionId})`], error);
    }
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
  let result: Awaited<ReturnType<typeof executePreparedAgent>> | undefined;
  let caught: unknown;
  let cleanupConfirmed = true;
  try {
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
    options.onSessionStarted?.(sessionId);
    result = await executePreparedAgent(prepared, {
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      deadlineAt: options.deadlineAt,
      operationAllowance: options.operationAllowance,
      onObservation: (event) => {
        if (event.type === "message_end" && "message" in event) {
          appendFileSync(transcriptPath, `${JSON.stringify((event as { message: AgentMessage }).message)}\n`);
        }
      },
    });
    try {
      writeFileSync(
        join(sessionPath, "usage.json"),
        JSON.stringify({ sessionId, outcome: result.status, durationMs: result.durationMs, ...result.usage }, null, 2) +
          "\n",
      );
    } catch (error) {
      try {
        options.onNotice?.(`Could not save usage measurements: ${String(error)}`);
      } catch {
        /* optional evidence */
      }
    }
  } catch (err) {
    caught = err;
  } finally {
    try {
      direct.cleanup();
    } catch {
      cleanupConfirmed = false;
    }
    cleanupConfirmed = (await direct.cleanupAsync()) && cleanupConfirmed;
  }
  if (!cleanupConfirmed && caught !== undefined) {
    throw new WorkflowUnconfirmedCleanupError(options.agentName, [`agent:${options.agentName} (${sessionId})`], caught);
  }
  if (caught !== undefined) throw caught;
  return {
    ...result!,
    sessionId,
    sessionPath,
    systemPrompt: prepared.systemPrompt,
    model: direct.model,
    executionManifest,
    cleanupConfirmed,
  };
}

export const DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS = 4;
export const DEFAULT_DIRECT_WORKFLOW_MAX_DEPTH = 3;

const DIRECT_HOST_TOOL_DENIALS: Readonly<Record<string, string>> = {
  agents: "isolated direct workflow runs do not dispatch hosted supporting agents",
  message: "isolated direct workflow runs must not notify real users or agents",
  cron: "isolated direct workflow runs must not change autonomous schedules",
  "cli-delegation": "isolated direct workflow runs do not delegate to external agent CLIs",
  query_db: "isolated direct workflow runs do not expose the production database",
  "query-db": "isolated direct workflow runs do not expose the production database",
  tasks: "isolated direct workflow runs do not expose live Host Task mutations",
};

export function defaultDirectToolDenials(configuredTools: readonly string[]): ToolDenial[] {
  return configuredTools.flatMap((name) => {
    const reason = DIRECT_HOST_TOOL_DENIALS[name];
    return reason ? [{ name, reason }] : [];
  });
}

const CommonKernelAgentsParams = Type.Union([
  Type.Object({
    action: Type.Literal("list"),
  }, { additionalProperties: false }),
  Type.Object({
    action: Type.Literal("call"),
    agent: Type.String({ minLength: 1, description: "Exact canonical app/name or global/name target." }),
    input: Type.Object({
      prompt: Type.String({ minLength: 1 }),
      data: Type.Optional(Type.Unknown()),
    }, { additionalProperties: false }),
    options: Type.Optional(Type.Object({
      timeoutMs: Type.Optional(Type.Number({ minimum: 1 })),
      schema: Type.Optional(Type.Unknown()),
    }, { additionalProperties: false })),
  }, { additionalProperties: false }),
]);

type CommonKernelAgentsCall =
  | { action: "list" }
  | {
      action: "call";
      agent: string;
      input: { prompt: string; data?: unknown };
      options?: { timeoutMs?: number; schema?: TSchema };
    };

/**
 * Built-in agents binding available only inside an admitted common-kernel prompt step.
 * A caller-supplied provider always takes precedence and is executed unchanged.
 */
function createCommonKernelAgentsTool(
  stepControl: WorkflowKernelStepControl,
  listTargets: () => readonly CallableDescriptor[],
  resolveTarget: (
    target: string,
    input: unknown,
    signal: AbortSignal,
  ) => WorkflowKernelResolvedTarget | Promise<WorkflowKernelResolvedTarget>,
): AgentTool {
  return {
    name: "agents",
    label: "List or call contributions",
    description:
      "List the complete captured callable catalog or synchronously call one exact canonical target.",
    parameters: CommonKernelAgentsParams,
    execute: async (_toolCallId, rawParams, signal) => {
      const params = rawParams as CommonKernelAgentsCall;
      if (params.action === "list") {
        const descriptors = listTargets();
        return { content: [{ type: "text", text: JSON.stringify(descriptors) }], details: descriptors };
      }
      if (typeof params.agent !== "string" || !params.agent.trim()) {
        throw new Error('agents action "call" requires a non-empty canonical agent target');
      }
      validateCallableInput(Type.Object({
        prompt: Type.String({ minLength: 1 }),
        data: Type.Optional(Type.Unknown()),
      }, { additionalProperties: false }), params.input);
      const options: CallOptions<TSchema> = {
        ...(params.options?.timeoutMs !== undefined ? { timeoutMs: params.options.timeoutMs } : {}),
        ...(params.options?.schema !== undefined ? { schema: params.options.schema } : {}),
      };
      const target = params.agent;
      const result = await stepControl.callTarget(
        target,
        params.input,
        options,
        signal,
        (nestedControl) => resolveTarget(target, params.input, nestedControl.signal),
      );
      const text = JSON.stringify(result);
      return { content: [{ type: "text", text }], details: result };
    },
  };
}

export type DirectAgentFixtureHandler = (call: {
  agent: string;
  task: string;
  options?: AgentCallOptions & { schema?: TSchema };
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
  stepIndex: number;
}) => WorkflowStepInvocationResult | Promise<WorkflowStepInvocationResult>;

export type WorkflowExecutionEnvironment<TInput = unknown> = {
  workspace?: WorkflowContext["workspace"];
  read?: Partial<AppRead>;
  events?: Partial<WorkflowContext["events"]>;
  metrics?: Partial<WorkflowContext["metrics"]>;
  /** Host/App adapters may pass an already-admitted orchestration context; standalone never creates one. */
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  reviseTask?: WorkflowContext["reviseTask"];
  closeTask?: WorkflowContext["closeTask"];
  applyTaskChanges?: WorkflowContext["applyTaskChanges"];
  readCommunication?: WorkflowContext["readCommunication"];
};

export type DirectWorkflowRunOptions<TInput = unknown> = WorkflowExecutionEnvironment<TInput> & {
  /** Provide an imported workflow module, `target` ("agent" or "owner/workflow"), or owning `agentName` + `workflowName`. */
  module?: WorkflowExecutableModule<TInput>;
  target?: string;
  agentName?: string;
  workflowName?: string;
  workflowDir?: string;
  input: TInput;
  projectRoot: string;
  workRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot?: string;
  globalAgentsRoot?: string;
  /** Optional explicit App directory scope (e.g. `"alpha.app"`) to lock resolution and catalog admission. */
  appScope?: string;
  outputRoot: string;
  /** Optional directory where `<traceDir>/run.json` (`WorkflowRunReport`) is written. */
  traceDir?: string;
  models: Record<string, ModelWithApiKey>;
  /** Optional grouped execution environment supplied by Host or standalone caller. */
  context?: WorkflowExecutionEnvironment<TInput>;
  onCancelActive?: () => void;
  /** Optional deterministic overrides for selected agents during tuning or hybrid tests. */
  agentFixtures?: Record<string, DirectAgentFixtureHandler>;
  /** Custom direct agent runner (defaults to `runDirectAgent`). */
  runAgent?: (options: DirectAgentRunOptions) => Promise<DirectAgentRunResult>;
  /** Custom native CLI runner (defaults to `runCliAgent`). */
  runCli?: (input: CliAgentInput, opts: CliAgentOptions) => Promise<CliAgentResult>;
  /** Custom tool denial policy for real child agent runs. */
  resolveToolDenials?: (agentName: string, configuredTools: readonly string[]) => ToolDenial[];
  /** Generic service bindings for explicitly declared prompt-agent capabilities. */
  capabilityProviders?: Readonly<Record<string, DirectCapabilityProvider>>;
  /** Reports each concrete prompt-session identity before model execution starts. */
  onSessionStarted?: (sessionId: string) => void;
  /** Optional tool restriction ("readonly") for this execution scope. */
  tools?: "full" | "readonly";
  /** Optional caller-side output schema enforced in addition to any module outputSchema. */
  outputSchema?: TSchema;
  /** Optional prompt-target skill selection when root target resolves to a prompt agent. */
  skill?: string;
  /** Retired. Supplying this option throws; use timeoutMs or deadlineAt. */
  operationAllowance?: number;
  drainProcessGroup?: (pgid: number) => Promise<boolean>;
  timeoutMs?: number;
  deadlineAt?: number;
  maxConcurrentCalls?: number;
  maxDepth?: number;
  signal?: AbortSignal;
  executionId?: string;
  onStep?: (step: WorkflowStepTrace) => void;
  onLog?: (entry: WorkflowLogEntry) => void;
  onNotice?: (message: string) => void;
};

export type DirectWorkflowRunResult = {
  ok: boolean;
  started: boolean;
  status: WorkflowRunReport["status"];
  result?: NormalizedWorkflowContribution;
  error?: unknown;
  report: WorkflowRunReport;
  reportPath?: string;
  /** Retained output directory path when `--out`/`outputRoot` was supplied or when scratch cleanup was unconfirmed. */
  outputRoot?: string;
  childSessions: Array<{ stepIndex: number; agent: string; sessionId: string; transcriptPath: string }>;
};

function normalizeFinishStatus(status: string): NonNullable<TaskResult["finishResult"]>["status"] {
  if (status === "done" || status === "blocked" || status === "error") return status;
  return "error";
}

function directResultToTaskResult(run: DirectAgentRunResult): TaskResult {
  const finish = run.finishResult
    ? {
        status: normalizeFinishStatus(run.finishResult.status),
        summary: run.finishResult.summary,
        ...(run.finishResult.output !== undefined ? { output: run.finishResult.output } : {}),
        ...(run.finishResult.facts !== undefined ? { facts: run.finishResult.facts } : {}),
      }
    : undefined;
  return {
    sessionId: run.sessionId,
    status: run.status,
    lastAssistantText: run.lastAssistantText,
    messages: run.messages,
    duration: `${(run.durationMs / 1000).toFixed(1)}s`,
    outputDir: run.sessionPath,
    ...(run.error ? { error: run.error } : {}),
    ...(finish ? { finishResult: finish } : {}),
    ...(run.structuredResult !== undefined ? { structuredResult: run.structuredResult } : {}),
  };
}

function collectDeduplicatedRuntimeAgentDirs(options: {
  agentsRoot: string;
  projectsRoot?: string;
  globalAgentsRoot?: string;
}): { dirs: AgentDirectory[]; byPath: Map<string, AgentDirectory> } {
  const rawDirs = [
    ...(options.globalAgentsRoot && resolve(options.globalAgentsRoot) !== resolve(options.agentsRoot)
      ? listRuntimeAgentDirectories(options.globalAgentsRoot)
      : []),
    ...listRuntimeAgentDirectories(options.agentsRoot, options.projectsRoot, options.projectsRoot),
  ];
  const byPath = new Map<string, AgentDirectory>();
  for (const dir of rawDirs) {
    const key = resolve(dir.dir);
    const prev = byPath.get(key);
    if (!prev || (!prev.projectId && dir.projectId)) {
      byPath.set(key, dir);
    }
  }
  return { dirs: [...byPath.values()], byPath };
}

function validateExplicitAppScopeAlignment(
  explicitProjectId: string,
  options: DirectWorkflowRunOptions<any>,
  byPath: ReadonlyMap<string, AgentDirectory>,
  explicitWorkflowDir?: string,
): void {
  const globalRoot = options.globalAgentsRoot ? resolve(options.globalAgentsRoot) : undefined;
  const resolvedAgentsRoot = resolve(options.agentsRoot);
  if (!globalRoot || resolvedAgentsRoot !== globalRoot) {
    const expectedAppAgentsRoot = options.projectsRoot
      ? resolve(options.projectsRoot, `${explicitProjectId}.app`, "agents")
      : undefined;
    const rootsInApp = [...byPath.values()].some(
      (dir) => resolve(dir.agentsRoot) === resolvedAgentsRoot && dir.projectId === explicitProjectId,
    );
    const rootsInOtherApp = [...byPath.values()].find(
      (dir) => resolve(dir.agentsRoot) === resolvedAgentsRoot && dir.projectId && dir.projectId !== explicitProjectId,
    );
    if (rootsInOtherApp || (expectedAppAgentsRoot && resolvedAgentsRoot !== expectedAppAgentsRoot && !rootsInApp)) {
      throw new Error(`Conflicting App scope "${explicitProjectId}.app" for agentsRoot "${options.agentsRoot}"`);
    }
  }
  if (explicitWorkflowDir) {
    const wfOwnerDir = [...byPath.values()].find(
      (dir) => resolve(dir.dir, "workflows") === resolve(explicitWorkflowDir),
    );
    if (wfOwnerDir?.projectId && wfOwnerDir.projectId !== explicitProjectId) {
      throw new Error(
        `Conflicting App scope "${explicitProjectId}.app" for workflowDir "${explicitWorkflowDir}" (belongs to "${wfOwnerDir.projectId}.app")`,
      );
    }
  }
}

function resolveWorkflowDir(options: DirectWorkflowRunOptions<any>): string | undefined {
  const explicitApp = options.appScope?.trim()
    ? options.appScope.trim().endsWith(".app")
      ? options.appScope.trim()
      : `${options.appScope.trim()}.app`
    : undefined;
  const explicitProjectId = explicitApp ? explicitApp.slice(0, -".app".length) : undefined;
  const { dirs, byPath } = collectDeduplicatedRuntimeAgentDirs(options);
  if (explicitProjectId) {
    validateExplicitAppScopeAlignment(explicitProjectId, options, byPath, options.workflowDir);
  }
  if (options.workflowDir) return resolve(options.workflowDir);
  if (!options.agentName) return undefined;

  // Prefer the already-selected agentsRoot first, recovering its projectId metadata from byPath:
  const directInAgentsRoot = resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName);
  if (directInAgentsRoot) {
    const hydrated = byPath.get(resolve(directInAgentsRoot.dir)) ?? directInAgentsRoot;
    if (!explicitProjectId || !hydrated.projectId || hydrated.projectId === explicitProjectId) {
      return join(hydrated.dir, "workflows");
    }
  }

  let selected: AgentDirectory | undefined;
  for (const agentDir of dirs) {
    if (explicitProjectId && agentDir.projectId && agentDir.projectId !== explicitProjectId) {
      continue;
    }
    try {
      const cfg = readAgentConfigFile(agentDir.dir);
      if (!cfg || cfg.name !== options.agentName) continue;
      if (!selected || (!selected.projectId && agentDir.projectId)) {
        selected = agentDir;
      }
    } catch {
      // Malformed config will be surfaced as a catalog diagnostic.
    }
  }
  return selected ? join(selected.dir, "workflows") : undefined;
}

type DirectPromptDefinition = {
  source: AgentDirectory;
  config: Readonly<AgentConfig>;
  identityText: string;
  sharedPromptText: string;
};

function readPromptSnapshot(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function captureDirectPromptDefinition(
  source: AgentDirectory,
  config: AgentConfig,
  sharedRoot: string,
): DirectPromptDefinition {
  return Object.freeze({
    source: Object.freeze(structuredClone(source)),
    config: Object.freeze(structuredClone(config)),
    identityText: readPromptSnapshot(join(source.dir, "AGENTS.md")),
    sharedPromptText: readPromptSnapshot(join(sharedRoot, "common-sense.md")),
  });
}

type DirectCatalogState = PreparedCatalog<DirectPromptDefinition> & {
  prompts: Map<string, { owner: string; definition: DirectPromptDefinition }>;
  proceduresByOwner: Map<string, ReadonlyMap<string, WorkflowExecutableModule>>;
  diagnostics: string[];
  pendingImports: number;
};

async function buildDirectPromptCatalog(
  options: DirectWorkflowRunOptions<any>,
  _callerOwner: string,
  _explicitWorkflowDir?: string,
  signal?: AbortSignal,
  state: DirectCatalogState = {
    prompts: new Map(),
    proceduresByOwner: new Map(),
    diagnostics: [],
    pendingImports: 0,
  },
  pendingImportState: DirectCatalogState = state,
): Promise<DirectCatalogState> {
  signal?.throwIfAborted();
  const { dirs } = collectDeduplicatedRuntimeAgentDirs(options);
  const { prompts, proceduresByOwner, diagnostics } = state;

  for (const agentDir of dirs) {
    signal?.throwIfAborted();
    let config: ReturnType<typeof readAgentConfigFile>;
    try {
      config = readAgentConfigFile(agentDir.dir);
    } catch (error) {
      diagnostics.push(`${join(agentDir.dir, "agent.json")}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!config) continue;
    const namespace = agentDir.projectId ?? "global";
    const canonicalName = canonicalCallableName(agentDir.projectId, config.name);
    if (prompts.has(canonicalName)) {
      throw new Error(`Duplicate callable canonical name: ${canonicalName}`);
    }
    const promptEntry = {
      owner: namespace,
      definition: captureDirectPromptDefinition(agentDir, config, options.sharedRoot),
    };
    prompts.set(canonicalName, promptEntry);

    const workflowDir = join(agentDir.dir, "workflows");
    if (!existsSync(workflowDir)) continue;
    const loaded = await buildWorkflowCatalog(workflowDir, signal, {
      onImportStart: () => { pendingImportState.pendingImports += 1; },
      onImportSettled: () => { pendingImportState.pendingImports -= 1; },
    });
    const merged = new Map(proceduresByOwner.get(namespace) ?? []);
    for (const workflow of loaded.workflows.values()) {
      const canonicalWorkflowName = canonicalCallableName(agentDir.projectId, workflow.name);
      if (prompts.has(canonicalWorkflowName) || merged.has(workflow.name)) {
        throw new Error(`Duplicate callable canonical name: ${canonicalWorkflowName}`);
      }
      merged.set(workflow.name, workflow);
    }
    proceduresByOwner.set(namespace, merged);
    diagnostics.push(...loaded.diagnostics);
  }

  for (const fixtureAgent of Object.keys(options.agentFixtures ?? {})) {
    const canonicalName = canonicalCallableName(undefined, fixtureAgent);
    if (!prompts.has(canonicalName)) {
      const source = {
        name: fixtureAgent,
        dir: join(options.agentsRoot, fixtureAgent),
        agentsRoot: options.agentsRoot,
        relativeDir: `agents/${fixtureAgent}`,
      };
      prompts.set(canonicalName, {
        owner: "global",
        definition: captureDirectPromptDefinition(source, {
          name: fixtureAgent,
          description: fixtureAgent,
          domain: "fixture",
          model: "fixture",
          tools: [],
        }, options.sharedRoot),
      });
    }
  }

  return state;
}

function buildPreStartFailureResult(params: {
  workflowName: string;
  input: unknown;
  startedAt: number;
  error: Error;
  status: WorkflowRunReport["status"];
  executionId: string;
  traceDir?: string;
  timeoutMs?: number;
  allowance?: WorkflowExecutionAllowance;
  unconfirmed?: string[];
}): DirectWorkflowRunResult {
  const endedAt = Date.now();
  const report: WorkflowRunReport = {
    workflow: params.workflowName,
    executionId: params.executionId,
    started: false,
    status: params.status,
    startedAt: params.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - params.startedAt),
    input: params.input,
    error: {
      name: params.error.name,
      message: params.error.message,
      ...(params.error.stack ? { stack: params.error.stack } : {}),
    },
    steps: [],
    stepsTruncated: 0,
    logs: [],
    logsTruncated: 0,
    limits: {
      timeoutMs: params.timeoutMs ?? 0,
      deadlineAt: params.allowance?.deadlineAt ?? endedAt,
      ...(params.allowance?.maxConcurrentCalls !== undefined
        ? { maxConcurrentCalls: params.allowance.maxConcurrentCalls }
        : {}),
    },
    cleanup: params.unconfirmed ? { confirmed: false, unconfirmed: params.unconfirmed } : { confirmed: true },
    observerErrors: [],
  };
  let reportPath: string | undefined;
  if (params.traceDir) {
    mkdirSync(params.traceDir, { recursive: true });
    reportPath = join(params.traceDir, "run.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return {
    ok: false,
    started: false,
    status: params.status,
    error: params.error,
    report,
    ...(reportPath ? { reportPath } : {}),
    childSessions: [],
  };
}

/**
 * Run a workflow or target end-to-end without booting Host SQLite, EventBus, or SubagentManager.
 */
export async function runDirectWorkflow<TInput = unknown>(
  options: DirectWorkflowRunOptions<TInput>,
  internal?: {
    depth: number;
    allowance?: WorkflowExecutionAllowance;
    catalog?: DirectCatalogState;
    callerOwner?: string;
    tools?: "full" | "readonly";
    /** A public root run may provide an already captured catalog without becoming a nested call. */
    root?: boolean;
  },
): Promise<DirectWorkflowRunResult> {
  validateOperationAllowance(options.operationAllowance);
  const nested = internal !== undefined && internal.root !== true;
  const depth = internal?.depth ?? 1;
  const maxDepth = options.maxDepth ?? DEFAULT_DIRECT_WORKFLOW_MAX_DEPTH;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1) {
    throw new Error("maxDepth must be a positive integer when set");
  }
  if (depth > maxDepth) {
    const depthErr = new Error(`Maximum workflow nesting depth (${maxDepth}) exceeded`);
    const now = Date.now();
    const executionId =
      !nested && options.executionId
        ? options.executionId
        : `wr_${now}_${Math.random().toString(36).slice(2, 6)}`;
    return buildPreStartFailureResult({
      workflowName: options.module?.name ?? options.target ?? options.workflowName ?? "unknown",
      input: options.input,
      startedAt: now,
      error: depthErr,
      status: "error",
      executionId,
      traceDir: options.traceDir,
    });
  }

  let callerOwner = internal?.callerOwner ?? options.agentName ?? "direct-agent";
  const inferredRootOwner = !nested && !options.agentName && options.target;
  if (inferredRootOwner) {
    callerOwner = options.target!.includes("/")
      ? options.target!.slice(0, options.target!.indexOf("/")).trim()
      : options.target!.trim();
  }
  const initialOwner = callerOwner;
  const catalogNamespace = options.appScope?.trim()
    ? options.appScope.trim().replace(/\.app$/, "")
    : "global";
  const workflowDir = resolveWorkflowDir({
    ...options,
    agentName: inferredRootOwner && !options.target!.includes("/") ? undefined : callerOwner,
  });
  let preparedCatalog: DirectCatalogState = internal?.catalog ?? {
    prompts: new Map(),
    proceduresByOwner: new Map(),
    diagnostics: [],
    pendingImports: 0,
  };

  const ensureOwnerProcedures = async (owner: string, signal?: AbortSignal): Promise<void> => {
    if (preparedCatalog.proceduresByOwner.has(owner)) return;
    const ownerDir =
      (owner === initialOwner || owner === catalogNamespace) && workflowDir
        ? workflowDir
        : preparedCatalog.prompts.get(owner)?.definition.source.dir
          ? join(preparedCatalog.prompts.get(owner)!.definition.source.dir, "workflows")
          : undefined;
    if (!ownerDir) return;
    const loaded = await buildWorkflowCatalog(ownerDir, signal, {
      onImportStart: () => {
        preparedCatalog.pendingImports += 1;
      },
      onImportSettled: () => {
        preparedCatalog.pendingImports -= 1;
      },
    });
    signal?.throwIfAborted();
    preparedCatalog.proceduresByOwner.set(owner, loaded.workflows);
    for (const diag of loaded.diagnostics) {
      if (!preparedCatalog.diagnostics.includes(diag)) preparedCatalog.diagnostics.push(diag);
    }
  };

  const loadTargetOwnerProcedures = async (target: string, signal?: AbortSignal): Promise<void> => {
    if (!target || target.trim() !== target) return;
    const slash = target.indexOf("/");
    if (slash !== -1) {
      const owner = target.slice(0, slash);
      if (owner) await ensureOwnerProcedures(owner, signal);
    } else if (!options.target) {
      await ensureOwnerProcedures(callerOwner, signal);
    }
  };

  const isNativeCliFallback = (name: string): name is "codex" | "claude" => {
    const trimmed = name.trim();
    if (trimmed !== "codex" && trimmed !== "claude") return false;
    if (preparedCatalog.proceduresByOwner.get(callerOwner)?.has(trimmed)) return false;
    if (preparedCatalog.prompts.has(trimmed)) return false;
    return true;
  };

  let targetModule = options.module;
  let rootPromptTarget: string | undefined;
  let catalogCapturedAtRoot = false;
  const rootStartedAt = Date.now();
  let preparedAllowance: WorkflowExecutionAllowance | undefined = internal?.allowance;
  if (!targetModule) {
    const requestedTarget = options.target ?? options.workflowName?.trim();
    if (!requestedTarget) {
      throw new Error(
        "runDirect requires `module`, `target`, or (`workflowName` and resolvable `workflowDir`/`agentName`)",
      );
    }
    if (!options.target && !workflowDir) {
      throw new Error(
        "runDirectWorkflow requires either `module` or (`workflowName` and resolvable `workflowDir`/`agentName`)",
      );
    }

    const prepNow = rootStartedAt;
    let prepAllowance: WorkflowExecutionAllowance | undefined = internal?.allowance;
    let prepTimeoutMs: number | undefined;
    const makePrepFailureReport = (
      effectiveError: Error,
      status: WorkflowRunReport["status"],
      unconfirmed?: string[],
    ): DirectWorkflowRunResult =>
      buildPreStartFailureResult({
        workflowName: requestedTarget,
        input: options.input,
        startedAt: prepNow,
        error: effectiveError,
        status,
        executionId:
          !nested && options.executionId
            ? options.executionId
            : `wr_${prepNow}_${Math.random().toString(36).slice(2, 6)}`,
        traceDir: options.traceDir,
        timeoutMs: prepTimeoutMs,
        allowance: prepAllowance,
        unconfirmed,
      });

    if (!prepAllowance && !options.signal?.aborted) {
      try {
        const created = createWorkflowAllowance({
          timeoutMs: options.timeoutMs,
          deadlineAt: options.deadlineAt,
          maxConcurrentCalls: options.maxConcurrentCalls ?? DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS,
          now: prepNow,
        });
        prepAllowance = created;
        prepTimeoutMs = created.timeoutMs;
      } catch (allowanceErr) {
        return makePrepFailureReport(
          allowanceErr instanceof Error ? allowanceErr : new Error(String(allowanceErr)),
          "error",
        );
      }
    } else if (prepAllowance) {
      prepTimeoutMs = Math.max(0, prepAllowance.deadlineAt - prepNow);
    }
    const prepController = new AbortController();
    let prepTimer: ReturnType<typeof setTimeout> | undefined;
    const onParentPrepAbort = () => {
      prepController.abort(
        options.signal?.reason ?? new Error(`Direct target "${requestedTarget}" cancelled before start`),
      );
    };
    if (options.signal?.aborted) {
      onParentPrepAbort();
    } else if (options.signal) {
      options.signal.addEventListener("abort", onParentPrepAbort, { once: true });
    }
    if (prepAllowance && !prepController.signal.aborted) {
      const waitMs = Math.max(0, prepAllowance.deadlineAt - Date.now());
      prepTimer = setTimeout(() => {
        prepController.abort(
          new Error(
            prepAllowance.deadlineReason ??
              `Workflow "${requestedTarget}" timed out after ${prepTimeoutMs ?? waitMs}ms`,
          ),
        );
      }, waitMs);
      prepTimer.unref?.();
    }

    try {
      if (options.target) {
        if (!internal?.catalog) {
          preparedCatalog = await buildDirectPromptCatalog(
            { ...options, agentName: callerOwner },
            callerOwner,
            workflowDir,
            prepController.signal,
            preparedCatalog,
          );
          catalogCapturedAtRoot = true;
        }
        await loadTargetOwnerProcedures(requestedTarget, prepController.signal);
        if (isNativeCliFallback(requestedTarget)) {
          targetModule = {
            name: requestedTarget,
            description: `Direct CLI executor invocation for ${requestedTarget}`,
            ...(options.tools === "readonly" ? { readonly: true } : {}),
            async execute(ctx) {
              return options.outputSchema
                ? ctx.call(requestedTarget, ctx.input, { schema: options.outputSchema })
                : ctx.call(requestedTarget, ctx.input);
            },
          };
        } else {
          const resolved = resolveCallable(callerOwner, requestedTarget, preparedCatalog);
          if (resolved.kind === "code") {
            callerOwner = resolved.owner;
            targetModule = resolved.module as WorkflowExecutableModule<TInput>;
          } else {
            rootPromptTarget = resolved.name;
            targetModule = {
              name: resolved.name,
              description: `Direct prompt invocation for ${resolved.name}`,
              ...(options.tools === "readonly" ? { readonly: true } : {}),
              async execute(ctx) {
                return options.outputSchema
                  ? ctx.call(resolved.name, ctx.input, { schema: options.outputSchema })
                  : ctx.call(resolved.name, ctx.input);
              },
            };
          }
        }
      } else {
        const wfCatalog = await buildWorkflowCatalog(workflowDir!, prepController.signal, {
          onImportStart: () => {
            preparedCatalog.pendingImports += 1;
          },
          onImportSettled: () => {
            preparedCatalog.pendingImports -= 1;
          },
        });
        preparedCatalog.proceduresByOwner.set(catalogNamespace, wfCatalog.workflows);
        for (const diag of wfCatalog.diagnostics) {
          if (!preparedCatalog.diagnostics.includes(diag)) preparedCatalog.diagnostics.push(diag);
        }
        const found = findWorkflow(wfCatalog, requestedTarget);
        if (!found.workflow) {
          throw new Error(found.error ?? `Workflow "${requestedTarget}" not found`);
        }
        targetModule = found.workflow as WorkflowExecutableModule<TInput>;
      }
      preparedAllowance = prepAllowance;
    } catch (prepErr) {
      if (prepController.signal.aborted || preparedCatalog.pendingImports > 0) {
        const executionId =
          !nested && options.executionId
            ? options.executionId
            : `wr_${prepNow}_${Math.random().toString(36).slice(2, 6)}`;
        const unconfirmed =
          preparedCatalog.pendingImports > 0 ? [`workflow:${requestedTarget} (${executionId})`] : undefined;
        const effectiveError = unconfirmed
          ? new WorkflowUnconfirmedCleanupError(requestedTarget, unconfirmed, prepErr)
          : prepErr instanceof Error
            ? prepErr
            : new Error(String(prepErr));
        const status: WorkflowRunReport["status"] = !unconfirmed && options.signal?.aborted ? "interrupted" : "error";
        const result = makePrepFailureReport(effectiveError, status, unconfirmed);
        result.report.executionId = executionId;
        if (result.reportPath) {
          writeFileSync(result.reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
        }
        return result;
      }
      if (prepErr && typeof prepErr === "object" && !("cleanupConfirmed" in prepErr)) {
        try {
          Object.defineProperty(prepErr, "cleanupConfirmed", {
            value: preparedCatalog.pendingImports === 0,
            enumerable: false,
            configurable: true,
          });
        } catch {
          // Ignore frozen error objects.
        }
      }
      throw prepErr;
    } finally {
      clearTimeout(prepTimer);
      options.signal?.removeEventListener("abort", onParentPrepAbort);
    }
  }

  const childSessions: DirectWorkflowRunResult["childSessions"] = [];
  const env = options.context;
  const reconciliation = env?.reconciliation ?? options.reconciliation;
  if (
    env?.reconciliation &&
    options.reconciliation &&
    env.reconciliation.taskId !== options.reconciliation.taskId
  ) {
    throw new Error(
      `Conflicting explicit reconciliation Task IDs: "${env.reconciliation.taskId}" and "${options.reconciliation.taskId}"`,
    );
  }
  if (reconciliation?.task && reconciliation.task.id !== reconciliation.taskId) {
    throw new Error(
      `Conflicting explicit reconciliation Task IDs: taskId "${reconciliation.taskId}" and task.id "${reconciliation.task.id}"`,
    );
  }

  const readOverrides = env?.read ?? options.read;
  const unavailableRead = (name: string) => async () => {
    throw new Error(`${name} read is not configured in standalone mode`);
  };
  const read: AppRead = {
    contract: readOverrides?.contract ?? unavailableRead("read.contract"),
    appResult: readOverrides?.appResult ?? unavailableRead("read.appResult"),
    tasks: {
      list: readOverrides?.tasks?.list ?? unavailableRead("read.tasks.list"),
      get: readOverrides?.tasks?.get ?? unavailableRead("read.tasks.get"),
      ...(readOverrides?.tasks?.created ? { created: readOverrides.tasks.created } : {}),
      ...(readOverrides?.tasks?.workload ? { workload: readOverrides.tasks.workload } : {}),
    },
    execution: readOverrides?.execution ?? unavailableRead("read.execution"),
    metric: readOverrides?.metric ?? unavailableRead("read.metric"),
  };

  const maxConcurrentCalls = options.maxConcurrentCalls ?? DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS;
  const executeAgent = options.runAgent ?? runDirectAgent;
  const executeCli = options.runCli ?? runCliAgent;

  let rootAllowance = internal?.allowance;
  if (!rootAllowance && !options.signal?.aborted) {
    try {
      const created = createWorkflowAllowance({
        timeoutMs: targetModule.executionTimeoutMs ?? options.timeoutMs,
        deadlineAt: options.deadlineAt,
        maxConcurrentCalls,
        now: rootStartedAt,
      });
      rootAllowance = preparedAllowance
        ? {
            deadlineAt: created.deadlineAt,
            ...(created.deadlineReason ? { deadlineReason: created.deadlineReason } : {}),
            ...(created.maxConcurrentCalls !== undefined ? { maxConcurrentCalls: created.maxConcurrentCalls } : {}),
            acquireCall: () => preparedAllowance.acquireCall(),
          }
        : created;
    } catch {
      // Pre-start deadline/timeout validation errors are surfaced cleanly by runWorkflowInvocation.
    }
  }

  const executeCliStep = async (
    tool: "codex" | "claude",
    prompt: string,
    callOpts: (CallOptions<TSchema> & { schema?: TSchema }) | undefined,
    stepControl: { signal: AbortSignal; timeoutMs: number; deadlineAt: number; stepIndex: number },
  ): Promise<WorkflowStepInvocationResult> => {
    const cliSessionId = `direct_cli_${Date.now()}_${stepControl.stepIndex}`;
    const executionRoot = resolve(options.workRoot);
    const isObjectSchema =
      Boolean(callOpts?.schema) &&
      typeof callOpts?.schema === "object" &&
      (callOpts.schema as { type?: unknown }).type === "object";
    const cliRun = await executeCli(
      {
        tool,
        prompt,
        mode: "patch",
        sandbox: "danger-full-access",
        cwd: ".",
        timeoutMs: stepControl.timeoutMs,
        ...(isObjectSchema ? { expectedOutput: { format: "json" } } : {}),
      },
      {
        agentName: callerOwner,
        projectRoot: executionRoot,
        persistDir: options.outputRoot,
        sessionId: cliSessionId,
        signal: stepControl.signal,
        drainProcessGroup: options.drainProcessGroup,
      },
    );
    const status = cliRun.status === "completed" ? "done" : "error";
    let parsedOutput: unknown = cliRun.outputText;
    if (status === "done" && callOpts?.schema && typeof cliRun.outputText === "string") {
      try {
        parsedOutput = JSON.parse(cliRun.outputText);
      } catch {
        // Leave raw text so kernel schema check produces a structured schema diagnostic.
      }
    }
    return {
      id: cliRun.taskId,
      kind: "agent",
      status,
      summary: cliRun.summary || cliRun.error || `${tool} ${cliRun.status}`,
      ...(parsedOutput !== undefined ? { output: parsedOutput } : {}),
      facts: {
        tool: cliRun.tool,
        resultPath: cliRun.resultPath,
        eventsPath: cliRun.eventsPath,
        ...(cliRun.nativeSessionId ? { nativeSessionId: cliRun.nativeSessionId } : {}),
      },
      sessionId: cliSessionId,
      transcriptPath: cliRun.eventsPath,
      cleanupConfirmed: cliRun.cleanupConfirmed !== false,
    };
  };

  let resolveDirectTarget: (
    owner: string,
    target: string,
    input: unknown,
    signal?: AbortSignal,
  ) => Promise<WorkflowKernelResolvedTarget>;

  const captureCallableDescriptors = (excludeWorkflowOnly = false): readonly CallableDescriptor[] => {
    const definitions: CallableDefinition[] = [];
    for (const [name, entry] of preparedCatalog.prompts) {
      if (excludeWorkflowOnly && entry.definition.config.callableFrom === "workflow") continue;
      const slash = name.indexOf("/");
      if (slash === -1) continue;
      definitions.push({
        ...(name.slice(0, slash) !== "global" ? { appId: name.slice(0, slash) } : {}),
        declaredName: name.slice(slash + 1),
        description: entry.definition.config.description,
        async invoke() { return { status: "error", summary: "descriptor only" }; },
      });
    }
    for (const [namespace, workflows] of preparedCatalog.proceduresByOwner) {
      for (const workflow of workflows.values()) {
        definitions.push({
          ...(namespace !== "global" ? { appId: namespace } : {}),
          declaredName: workflow.name,
          description: workflow.description,
          ...(workflow.inputSchema ? { inputSchema: workflow.inputSchema } : {}),
          ...(workflow.outputSchema ? { outputSchema: workflow.outputSchema } : {}),
          async invoke() { return { status: "error", summary: "descriptor only" }; },
        });
      }
    }
    return new CallableCatalog(definitions).list();
  };

  const executePromptStep = async (
    agent: string,
    prompt: string,
    callOpts: (CallOptions<TSchema> & { schema?: TSchema }) | undefined,
    stepControl: WorkflowKernelStepControl,
  ): Promise<WorkflowStepInvocationResult> => {
    const promptDef = preparedCatalog.prompts?.get(agent)?.definition;
    if (!promptDef) {
      throw new Error(`Agent "${agent}" was not found under ${options.agentsRoot}`);
    }
    const config = promptDef.config;
    const fixture = options.agentFixtures?.[agent] ?? options.agentFixtures?.[config.name];
    if (fixture) {
      return fixture({ agent: config.name, task: prompt, options: callOpts, ...stepControl });
    }
    const explicitAgentsProvider = options.capabilityProviders?.agents;
    const configuredDenials = options.resolveToolDenials?.(agent, config.tools);
    const denials = (configuredDenials ?? defaultDirectToolDenials(config.tools)).filter(
      (denial) =>
        denial.name !== "agents" &&
        options.capabilityProviders?.[denial.name] === undefined,
    );
    const capabilityProviders = explicitAgentsProvider
      ? options.capabilityProviders
      : {
          ...options.capabilityProviders,
          agents: () => ({
            tools: [createCommonKernelAgentsTool(
              stepControl,
              () => captureCallableDescriptors(true),
              (target, input, signal) => {
                if (preparedCatalog.prompts?.get(target)?.definition.config.callableFrom === "workflow") {
                  throw new Error(`Callable target "${target}" is restricted to workflow invocations`);
                }
                return resolveDirectTarget(agent, target, input, signal);
              },
            )],
          }),
        };

    const directRun = await executeAgent({
      agentName: config.name,
      agentSource: promptDef.source,
      agentConfig: config,
      identityText: promptDef.identityText,
      sharedPromptText: promptDef.sharedPromptText,
      task: prompt,
      projectRoot: options.projectRoot,
      workRoot: options.workRoot,
      agentsRoot: options.agentsRoot,
      sharedRoot: options.sharedRoot,
      projectsRoot: options.projectsRoot,
      globalAgentsRoot: options.globalAgentsRoot,
      outputRoot: options.outputRoot,
      models: options.models,
      requireFinish: true,
      outputSchema: callOpts?.schema,
      toolPolicy: stepControl.tools,
      toolDenials: denials,
      capabilityProviders,
      onSessionStarted: options.onSessionStarted,
      drainProcessGroup: options.drainProcessGroup,
      timeoutMs: stepControl.timeoutMs,
      deadlineAt: stepControl.deadlineAt,
      signal: stepControl.signal,
      onNotice: options.onNotice,
    });

    const transcriptPath = join(directRun.sessionPath, "session.jsonl");
    childSessions.push({
      stepIndex: stepControl.stepIndex,
      agent,
      sessionId: directRun.sessionId,
      transcriptPath,
    });
    const taskResult = enforceStructuredWorkflowResult(directResultToTaskResult(directRun), Boolean(callOpts?.schema));
    const mapped = agentExecutionResult(taskResult);
    return {
      ...mapped,
      kind: "agent",
      sessionId: directRun.sessionId,
      transcriptPath,
      cleanupConfirmed: directRun.cleanupConfirmed,
    };
  };

  const executeCodeStep = async (
    wfName: string,
    targetMod: WorkflowExecutableModule,
    targetOwner: string,
    wfInput: unknown,
    stepControl: WorkflowKernelStepControl,
    _callOpts?: CallOptions<TSchema> & { schema?: TSchema },
  ): Promise<WorkflowStepInvocationResult> => {
    if (depth + 1 > maxDepth) {
      throw new Error(`Maximum workflow nesting depth (${maxDepth}) exceeded`);
    }
    const sub = await runDirectWorkflow(
      {
        ...options,
        reconciliation,
        executionId: undefined,
        module: targetMod,
        target: undefined,
        workflowName: wfName,
        outputSchema: undefined,
        input: wfInput,
        signal: stepControl.signal,
        timeoutMs: stepControl.timeoutMs,
        deadlineAt: stepControl.deadlineAt,
        traceDir: undefined,
      },
      {
        depth: depth + 1,
        allowance: stepControl.allowance,
        catalog: preparedCatalog,
        callerOwner: targetOwner,
        tools: stepControl.tools,
      },
    );
    for (const session of sub.childSessions) {
      childSessions.push(session);
    }
    if (!sub.ok) {
      const thrown = sub.error instanceof Error ? sub.error : new Error(String(sub.error ?? sub.report.error?.message));
      if (sub.started) {
        (thrown as Error & { executionId?: string }).executionId = sub.report.executionId;
      }
      if (
        thrown instanceof WorkflowAllowanceExhaustedError ||
        thrown instanceof ExecutionDeferredError ||
        thrown instanceof WorkflowUnconfirmedCleanupError
      ) {
        throw thrown;
      }
      if (sub.started && sub.report.status === "error" && sub.report.cleanup.confirmed) {
        return {
          id: sub.report.executionId,
          kind: "workflow",
          status: "error",
          summary: sub.report.error?.message ?? thrown.message,
          cleanupConfirmed: true,
        };
      }
      throw thrown;
    }
    return {
      id: sub.report.executionId,
      kind: "workflow",
      status: sub.result!.type,
      summary: sub.result!.type === "done" ? sub.result!.summary : sub.result!.reason,
      ...(sub.result!.output !== undefined ? { output: sub.result!.output } : {}),
      ...(sub.result!.facts !== undefined ? { facts: sub.result!.facts } : {}),
      cleanupConfirmed: sub.report.cleanup.confirmed,
    };
  };

  let activeScopeSignal: AbortSignal | undefined;
  resolveDirectTarget = async (owner, target, input, signal = activeScopeSignal) => {
    if (
      typeof target !== "string" ||
      !target ||
      /\s/u.test(target) ||
      target.split("/").length !== 2 ||
      target.startsWith("/") ||
      target.endsWith("/")
    ) {
      throw new Error(`Invalid callable target ${JSON.stringify(target)} (expected exact "<app>/<name>" or "global/<name>")`);
    }
    const slash = target.indexOf("/");
    const procedureOwner = target.slice(0, slash);
    if (procedureOwner && procedureOwner.trim() === procedureOwner) {
      await ensureOwnerProcedures(procedureOwner, signal);
    }
    if (target === "codex" || target === "claude") {
      throw new Error(
        `agents action "call" does not expose native CLI target "${target}"; CLI delegation is a separate capability`,
      );
    }
    const resolved = resolveCallable(owner, target, preparedCatalog);
    if (resolved.kind === "prompt") {
      return {
        kind: "agent" as const,
        invoke: async (callOpts, nestedControl) =>
          executePromptStep(resolved.name, formatExecutionInput(input), callOpts, nestedControl),
      };
    }
    return {
      kind: "workflow" as const,
      invoke: (callOpts, nestedControl) =>
        executeCodeStep(resolved.name, resolved.module, resolved.owner, input, nestedControl, callOpts),
    };
  };

  const effectiveWorkspace = env?.workspace ?? options.workspace ?? {
    appRoot: resolve(options.projectRoot),
    projectRoot: resolve(options.workRoot),
    root: resolve(options.workRoot),
    output: resolve(options.workRoot),
  };
  const authoredModule = targetModule;
  const outcome: WorkflowKernelOutcome = await runWorkflowInvocation(
    {
      ...authoredModule,
      async execute(ctx) {
        activeScopeSignal = ctx.signal;
        if (!internal?.catalog && !catalogCapturedAtRoot) {
          const captured = await buildDirectPromptCatalog(
            { ...options, agentName: callerOwner },
            callerOwner,
            workflowDir,
            ctx.signal,
            undefined,
            preparedCatalog,
          );
          ctx.signal.throwIfAborted();
          for (const [name, entry] of captured.prompts) {
            preparedCatalog.prompts.set(name, entry);
          }
          for (const [namespace, workflows] of captured.proceduresByOwner) {
            const merged = new Map(preparedCatalog.proceduresByOwner.get(namespace) ?? []);
            for (const [name, workflow] of workflows) merged.set(name, workflow);
            preparedCatalog.proceduresByOwner.set(namespace, merged);
          }
          for (const diag of captured.diagnostics) {
            if (!preparedCatalog.diagnostics.includes(diag)) {
              preparedCatalog.diagnostics.push(diag);
            }
          }
        }
        ctx.signal.throwIfAborted();
        return authoredModule.execute(ctx);
      },
    },
    {
      executionId: nested ? undefined : options.executionId,
      startedAt: nested ? undefined : rootStartedAt,
      input: options.input,
      taskOwned: Boolean(reconciliation),
      tools: internal?.tools ?? options.tools,
      outputSchema: nested ? undefined : options.outputSchema,
      signal: options.signal,
      timeoutMs: targetModule.executionTimeoutMs ?? options.timeoutMs,
      deadlineAt: rootAllowance?.deadlineAt ?? options.deadlineAt,
      maxConcurrentCalls,
      allowance: rootAllowance,
      read,
      events: (env?.events ?? options.events)
        ? {
            emit:
              (env?.events ?? options.events)!.emit ??
              (async () => {
                throw new Error("events.emit is not configured in runDirectWorkflow");
              }),
            read:
              (env?.events ?? options.events)!.read ??
              (async () => {
                throw new Error("events.read is not configured in runDirectWorkflow");
              }),
            onEvent:
              (env?.events ?? options.events)!.onEvent ??
              (() => {
                throw new Error("events.onEvent is not configured in runDirectWorkflow");
              }),
          }
        : undefined,
      metrics: (env?.metrics ?? options.metrics)
        ? {
            define:
              (env?.metrics ?? options.metrics)!.define ??
              (() => {
                throw new Error("metrics.define is not configured in standalone mode");
              }),
            defineMany:
              (env?.metrics ?? options.metrics)!.defineMany ??
              (() => {
                throw new Error("metrics.defineMany is not configured in standalone mode");
              }),
            record:
              (env?.metrics ?? options.metrics)!.record ??
              (async () => {
                throw new Error("metrics.record is not configured in standalone mode");
              }),
            evaluate:
              (env?.metrics ?? options.metrics)!.evaluate ??
              (() => {
                throw new Error("metrics.evaluate is not configured in standalone mode");
              }),
          }
        : undefined,
      workspace: effectiveWorkspace,
      reconciliation,
      reviseTask: env?.reviseTask ?? options.reviseTask,
      closeTask: env?.closeTask ?? options.closeTask,
      applyTaskChanges: env?.applyTaskChanges ?? options.applyTaskChanges,
      readCommunication: env?.readCommunication ?? options.readCommunication,
      onCancelActive: options.onCancelActive,
      onStep: options.onStep,
      onLog: options.onLog,
      // Native imports cannot be forcibly stopped. Keep uncertainty visible if
      // preparation outlives this invocation, and fence its late continuation.
      confirmCleanup: () => preparedCatalog.pendingImports === 0,
      listTargets: captureCallableDescriptors,
      resolveTarget: async (target, input) => {
        // The synthetic root prompt wrapper was already resolved during preparation;
        // do not import its procedure catalog merely to start that prompt.
        if (rootPromptTarget && target === rootPromptTarget) {
          rootPromptTarget = undefined;
          return {
            kind: "agent" as const,
            invoke: async (callOpts, stepControl) =>
              executePromptStep(target, formatExecutionInput(input), callOpts, {
                ...stepControl,
                tools: options.tools ?? stepControl.tools,
              }),
          };
        }
        if (activeScopeSignal) await loadTargetOwnerProcedures(target, activeScopeSignal);
        if (typeof target === "string" && isNativeCliFallback(target)) {
          return {
            kind: "agent" as const,
            invoke: async (callOpts, stepControl) => {
              if (typeof input !== "string" || !input.trim()) {
                throw new Error(`CLI target "${target}" requires a non-empty string prompt input`);
              }
              return executeCliStep(target.trim() as "codex" | "claude", input, callOpts, stepControl);
            },
          };
        }
        return resolveDirectTarget(callerOwner, target, input);
      },
    },
  );

  let reportPath: string | undefined;
  if (options.traceDir) {
    mkdirSync(options.traceDir, { recursive: true });
    reportPath = join(options.traceDir, "run.json");
    writeFileSync(reportPath, `${JSON.stringify(outcome.report, null, 2)}\n`);
  }

  return {
    ok: outcome.ok,
    started: outcome.started,
    status: outcome.report.status,
    ...(outcome.ok ? { result: outcome.result } : { error: outcome.error }),
    report: outcome.report,
    ...(reportPath ? { reportPath } : {}),
    childSessions,
  };
}

export function inferWorkspaceRoot(startDir: string, launchDir: string = process.cwd()): string {
  for (const candidateStart of [resolve(startDir), resolve(launchDir)]) {
    let current = candidateStart;
    for (;;) {
      if (existsSync(join(current, "projects")) && existsSync(join(current, "shared"))) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return resolve(startDir);
}

export type RunOptions<TInput = unknown> = Omit<
  DirectWorkflowRunOptions<TInput>,
  "input" | "projectRoot" | "workRoot" | "agentsRoot" | "sharedRoot" | "outputRoot" | "models"
> & {
  /** Optional App disambiguator when two Apps define the same agent name (e.g. `"alex.app"`). */
  app?: string;
  /** Working directory for tools and execution (defaults to `process.cwd()`). */
  cwd?: string;
  input?: TInput;
  projectRoot?: string;
  workRoot?: string;
  agentsRoot?: string;
  sharedRoot?: string;
  outputRoot?: string;
  models?: Record<string, ModelWithApiKey>;
};

export type RunResult<T = unknown> = CallableResult<T>;

export type TargetSummary = CallableDescriptor;

type StandaloneCatalogSnapshot = Readonly<{
  routes: ReadonlyMap<string, CanonicalStandaloneRoute>;
  catalog: DirectCatalogState;
}>;

const standaloneCatalogSnapshots = new WeakMap<readonly TargetSummary[], StandaloneCatalogSnapshot>();

export const DEFAULT_STANDALONE_LIST_TIMEOUT_MS = 15_000;

export async function listTargets(
  options: {
    cwd?: string;
    projectRoot?: string;
    projectsRoot?: string;
    globalAgentsRoot?: string;
    sharedRoot?: string;
    app?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<TargetSummary[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STANDALONE_LIST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid listTargets timeoutMs: ${String(options.timeoutMs)}`);
  }
  options.signal?.throwIfAborted();
  const listController = new AbortController();
  const onParentAbort = () => {
    listController.abort(options.signal?.reason ?? new Error("Target discovery cancelled"));
  };
  if (options.signal) {
    options.signal.addEventListener("abort", onParentAbort, { once: true });
  }
  const timer = setTimeout(() => {
    listController.abort(new Error(`Target discovery timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const cwd = resolve(options.cwd ?? process.cwd());
    const projectRoot = resolve(options.projectRoot ?? inferWorkspaceRoot(cwd));
    const projectsRoot = resolve(options.projectsRoot ?? join(projectRoot, "projects"));
    const globalAgentsRoot = resolve(options.globalAgentsRoot ?? join(projectRoot, "agents"));
    const sharedRoot = resolve(options.sharedRoot ?? join(projectRoot, "shared"));
    const appFilter = options.app?.trim()
      ? options.app.trim().endsWith(".app")
        ? options.app.trim()
        : `${options.app.trim()}.app`
      : undefined;

    const rawDirs = listRuntimeAgentDirectories(
      globalAgentsRoot,
      projectsRoot,
      projectsRoot,
      appFilter ? [appFilter] : undefined,
    );
    const dedupedByPath = new Map<string, AgentDirectory>();
    for (const dir of rawDirs) {
      const key = resolve(dir.dir);
      const prev = dedupedByPath.get(key);
      if (!prev || (!prev.projectId && dir.projectId)) {
        dedupedByPath.set(key, dir);
      }
    }
    const dirs = [...dedupedByPath.values()];

    const ownersByScope = new Map<string, { dir: AgentDirectory; config: AgentConfig }[]>();
    for (const dir of dirs) {
      listController.signal.throwIfAborted();
      if (appFilter && dir.projectId !== appFilter.slice(0, -".app".length)) {
        continue;
      }
      let config: AgentConfig | null = null;
      try {
        config = readAgentConfigFile(dir.dir);
      } catch {
        continue;
      }
      if (!config) continue;
      const scopeKey = `${dir.projectId ?? ""}:${config.name}`;
      const list = ownersByScope.get(scopeKey) ?? [];
      list.push({ dir, config });
      ownersByScope.set(scopeKey, list);
    }

    const definitions: CallableDefinition[] = [];
    const routes = new Map<string, CanonicalStandaloneRoute>();
    const capturedCatalog: DirectCatalogState = {
      prompts: new Map(),
      proceduresByOwner: new Map(),
      diagnostics: [],
      pendingImports: 0,
    };
    const unavailable = async () => ({ status: "error" as const, summary: "Discovery descriptor is not executable" });
    for (const [scopeKey, entries] of ownersByScope) {
      listController.signal.throwIfAborted();
      if (entries.length !== 1) {
        throw new Error(
          `Ambiguous callable owner "${scopeKey}": ${entries.map(({ dir }) => dir.dir).sort().join(", ")}`,
        );
      }
      const { dir, config } = entries[0]!;
      definitions.push({
        ...(dir.projectId ? { appId: dir.projectId } : {}),
        declaredName: config.name,
        description: config.description,
        invoke: unavailable,
      });
      const namespace = dir.projectId ?? "global";
      const promptName = canonicalCallableName(dir.projectId, config.name);
      capturedCatalog.prompts.set(promptName, {
        owner: namespace,
        definition: captureDirectPromptDefinition(dir, config, sharedRoot),
      });
      const app = dir.projectId ? `${dir.projectId}.app` : undefined;
      routes.set(promptName, {
        target: config.name,
        agentsRoot: dir.agentsRoot,
        ...(app ? { app } : {}),
      });
      const wfDir = join(dir.dir, "workflows");
      if (existsSync(wfDir)) {
        const catalog = await buildWorkflowCatalog(wfDir, listController.signal);
        listController.signal.throwIfAborted();
        const ambiguity = catalog.diagnostics.find((diagnostic) => diagnostic.includes("Ambiguous agent workflow name"));
        if (ambiguity) {
          throw new Error(`Callable catalog preparation failed: ${ambiguity}`);
        }
        const merged = new Map(capturedCatalog.proceduresByOwner.get(namespace) ?? []);
        for (const wf of catalog.workflows.values()) {
          definitions.push({
            ...(dir.projectId ? { appId: dir.projectId } : {}),
            declaredName: wf.name,
            description: wf.description,
            ...(wf.inputSchema ? { inputSchema: wf.inputSchema } : {}),
            ...(wf.outputSchema ? { outputSchema: wf.outputSchema } : {}),
            invoke: unavailable,
          });
          merged.set(wf.name, wf);
          routes.set(canonicalCallableName(dir.projectId, wf.name), {
            target: `${config.name}/${wf.name}`,
            agentsRoot: dir.agentsRoot,
            ...(app ? { app } : {}),
          });
        }
        capturedCatalog.proceduresByOwner.set(namespace, merged);
        capturedCatalog.diagnostics.push(...catalog.diagnostics);
      }
    }
    const descriptors = [...new CallableCatalog(definitions).list()];
    standaloneCatalogSnapshots.set(descriptors, { routes, catalog: capturedCatalog });
    return descriptors;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}

type CanonicalStandaloneRoute = {
  target: string;
  agentsRoot: string;
  app?: string;
};


/**
 * Run any prompt agent, code procedure, or native CLI executor standalone—either
 * with positional `(target, input, options?)` or an options object `run(options)`—
 * auto-discovering the owning App from `<projectRoot>/projects/*.app` without requiring `--app`.
 */
export async function run<TInput = unknown>(
  target: string,
  input: TInput,
  options?: RunOptions<TInput>,
): Promise<RunResult>;
export async function run<TInput = unknown>(options: RunOptions<TInput> & { input: TInput }): Promise<RunResult>;
export async function run<TInput = unknown>(
  targetOrOptions: string | (RunOptions<TInput> & { input: TInput }),
  maybeInput?: TInput,
  maybeOptions: RunOptions<TInput> = {},
): Promise<RunResult> {
  const isPositional = typeof targetOrOptions === "string";
  const options: RunOptions<TInput> = isPositional ? maybeOptions : targetOrOptions;
  const input = (isPositional ? maybeInput : targetOrOptions.input) as TInput;
  const rawTarget = isPositional ? targetOrOptions : (options.target ?? "");

  const startedAt = Date.now();
  const cwd = resolve(options.cwd ?? process.cwd());
  const projectRoot = resolve(options.projectRoot ?? inferWorkspaceRoot(cwd));
  const workRoot = resolve(options.workRoot ?? cwd);
  const projectsRoot = resolve(options.projectsRoot ?? join(projectRoot, "projects"));
  const globalAgentsRoot = resolve(options.globalAgentsRoot ?? join(projectRoot, "agents"));
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
    return Object.freeze({ status: "error", summary: "Callable timeoutMs must be a positive finite number" });
  }
  const timeoutDeadline = options.timeoutMs === undefined ? undefined : startedAt + options.timeoutMs;
  const deadlineAt = options.deadlineAt === undefined
    ? timeoutDeadline
    : timeoutDeadline === undefined
      ? options.deadlineAt
      : Math.min(options.deadlineAt, timeoutDeadline);
  const preStartError = (error: unknown): RunResult => Object.freeze({
    status: "error",
    summary: error instanceof Error ? error.message : String(error),
  });

  if (!rawTarget || rawTarget !== rawTarget.trim()) {
    return preStartError(`Callable target not found: ${rawTarget}`);
  }
  if (deadlineAt !== undefined && deadlineAt <= startedAt) {
    return preStartError("Callable deadline expired before catalog preparation");
  }
  let descriptors: TargetSummary[];
  try {
    descriptors = await listTargets({
      cwd,
      projectRoot,
      projectsRoot,
      globalAgentsRoot: options.agentsRoot ?? globalAgentsRoot,
      sharedRoot: options.sharedRoot ?? join(projectRoot, "shared"),
      timeoutMs: deadlineAt === undefined
        ? DEFAULT_STANDALONE_LIST_TIMEOUT_MS
        : Math.max(1, Math.min(DEFAULT_STANDALONE_LIST_TIMEOUT_MS, deadlineAt - Date.now())),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return preStartError(error);
  }
  const descriptor = descriptors.find((candidate) => candidate.name === rawTarget);
  const captured = standaloneCatalogSnapshots.get(descriptors);
  const canonicalRoute = captured?.routes.get(rawTarget);
  if (!descriptor || !canonicalRoute || !captured) {
    return preStartError(`Callable target not found: ${rawTarget}`);
  }
  try {
    validateCallableInput(descriptor.inputSchema, input);
  } catch (error) {
    return preStartError(error);
  }

  // Discovery and dispatch share the exact canonical address and the same complete
  // workspace catalog. Selecting one App-owned root must not narrow child discovery.
  const normalizedTarget = rawTarget;
  const agentsRoot = resolve(options.agentsRoot ?? globalAgentsRoot);

  const sharedRoot = resolve(options.sharedRoot ?? join(projectRoot, "shared"));
  const ownsTempOutputRoot = !options.outputRoot;
  const outputRoot = options.outputRoot ? resolve(options.outputRoot) : mkdtempSync(join(tmpdir(), "may-run-"));
  const models = options.models ?? createModelRegistry();

  let cleanupConfirmed = false;
  try {
    const res = await runDirectWorkflow({
      ...options,
      ...(normalizedTarget ? { target: normalizedTarget } : {}),
      input,
      deadlineAt,
      projectRoot,
      workRoot,
      agentsRoot,
      sharedRoot,
      projectsRoot,
      globalAgentsRoot,
      outputRoot,
      models,
    }, {
      root: true,
      depth: 1,
      catalog: captured.catalog,
      callerOwner: rawTarget.slice(0, rawTarget.indexOf("/")),
      ...(options.tools ? { tools: options.tools } : {}),
    });
    cleanupConfirmed = res.report.cleanup.confirmed === true;
    const contribution = res.result ?? (res.report.result?.type === "error" ? res.report.result : undefined);
    const summary = contribution
      ? contribution.type === "done"
        ? contribution.summary
        : contribution.reason
      : res.report.error?.message ?? (res.error instanceof Error ? res.error.message : String(res.error ?? res.status));
    return Object.freeze({
      ...(res.started ? { id: res.report.executionId } : {}),
      status: contribution?.type ?? res.status,
      summary,
      ...(contribution?.output !== undefined ? { output: contribution.output } : {}),
      ...(contribution?.facts !== undefined ? { facts: contribution.facts } : {}),
    });
  } catch (err) {
    cleanupConfirmed =
      Boolean(err) && typeof err === "object" && (err as { cleanupConfirmed?: unknown }).cleanupConfirmed === true;
    if (!cleanupConfirmed && err && typeof err === "object" && !("outputRoot" in err)) {
      try {
        Object.defineProperty(err, "outputRoot", {
          value: outputRoot,
          enumerable: true,
          configurable: true,
        });
      } catch {
        // Ignore frozen error objects.
      }
    }
    throw err;
  } finally {
    if (ownsTempOutputRoot && !options.traceDir && cleanupConfirmed) {
      try {
        rmSync(outputRoot, { recursive: true, force: true });
      } catch {
        // Best-effort scratch cleanup.
      }
    }
  }
}
