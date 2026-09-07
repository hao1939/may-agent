import type {
  AgentMessage,
  AgentTool,
  BeforeToolCallContext as PiBeforeToolCallContext,
} from "@earendil-works/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEvent,
  type StreamFunction,
  type TSchema,
} from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/compat";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createCompactionTransform, type CompactionInfo } from "./compaction.js";
import { formatBoundedSkillCatalog, invokeCatalogSkill, parseExplicitSkill, type MaySkill } from "./skills.js";
import type { SubagentDefinition } from "./types.js";
import { composeGuards, toGuardContext, type BeforeToolCallHook } from "./tools/compose-guards.js";
import { createCommitGuard } from "./tools/commit-guard.js";
import { createFinishGuard } from "./tools/finish-guard.js";
import { createPathHallucinationGuard } from "./tools/path-hallucination-guard.js";
import { createReadDedupGuard } from "./tools/read-dedup-guard.js";
import { createScrapeDedupGuard } from "./tools/scrape-dedup-guard.js";
import { createSessionReadGuard } from "./tools/session-read-guard.js";
import { createWorkflowFinishTool } from "./tools/workflow-finish.js";
import { createReadTool } from "./tools/read.js";
import { createBashTool } from "./tools/bash.js";
import { createEditTool } from "./tools/edit.js";
import { createWriteTool } from "./tools/write.js";
import { createAgentRun, type AgentRunnerConfig, type AgentRuntimeListener } from "./agent-runner.js";
import { extractFinishParams, type FinishParams } from "./agent-result.js";
import {
  classifyTerminalAssistantFailure,
  extractLastAssistantError,
  extractLastAssistantText,
  isRetryableEmptyAssistantFailure,
} from "./manager-utils.js";
import {
  boundedWorkflowFinishPrompt,
  recoverCapturedWorkflowFinish,
  shouldAttemptWorkflowFinishRecovery,
  shouldRequestBoundedWorkflowFinish,
  workflowFinishRecoveryPrompt,
} from "./workflow-finish-recovery.js";
import { runWithAgentSessionContext } from "./agent-session-context.js";
import type { ToolPolicy } from "./session-policy.js";

const CHAT_TOOL_DENYLIST = new Set([
  "bash",
  "background_exec",
  "checkpoint",
  "cron",
  "edit",
  "finish",
  "scrape_webpage",
  "workflow",
  "write",
]);

const READONLY_TOOL_ALLOWLIST = new Set(["finish", "query_db", "read", "scrape_webpage", "system_status", "tasks"]);

const DEPUTY_TOOL_ALLOWLIST = new Set([
  "agents",
  "conversation_context",
  "finish",
  "message",
  "query_db",
  "read",
  "run_cli_agent",
  "scrape_webpage",
  "system_status",
  "tasks",
]);

// An App owner must return durable ownership changes through its fenced
// disposition. These tools create asynchronous work or lifecycle state
// outside that admission boundary and belong only to compatibility sessions.
const APP_OWNER_TOOL_DENYLIST = new Set(["background_exec", "checkpoint", "cron", "message"]);

const SEQUENTIAL_TOOL_NAMES = new Set([
  "agents",
  "background_exec",
  "bash",
  "checkpoint",
  "cron",
  "edit",
  "finish",
  "message",
  "run_cli_agent",
  "workflow",
  "write",
]);

export const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 300_000;
export const GITHUB_COPILOT_IDE_TOKEN_EXPIRED =
  "Github_copilotException - IDE token expired: unauthorized: token expired";

const GITHUB_COPILOT_IDE_TOKEN_EXPIRED_PATTERN =
  /Github_copilotException\s*-\s*IDE token expired:\s*unauthorized:\s*token expired/i;

type ModelWithDeclaredFallback = Parameters<StreamFunction>[0] & {
  fallbackModel?: Parameters<StreamFunction>[0];
};

export function isGithubCopilotIdeTokenExpired(message: AssistantMessage): boolean {
  return (
    message.stopReason === "error" &&
    typeof message.errorMessage === "string" &&
    GITHUB_COPILOT_IDE_TOKEN_EXPIRED_PATTERN.test(message.errorMessage)
  );
}

function streamFailureMessage(model: Parameters<StreamFunction>[0], error: unknown): AssistantMessage {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage,
    timestamp: Date.now(),
  };
}

/**
 * Switch once to a model's independent fallback when GitHub Copilot immediately
 * reports its IDE credential expired. The caller's context and options objects are
 * reused unchanged, preserving transcript/session ownership across the provider hop.
 */
export function withGithubCopilotIdeTokenRecovery(stream: StreamFunction): StreamFunction {
  return (model, context, options) => {
    const recovered = createAssistantMessageEventStream();
    void (async () => {
      const primary = model as ModelWithDeclaredFallback;
      const response = stream(primary, context, options);
      let firstEvent = true;
      for await (const event of response) {
        if (
          firstEvent &&
          event.type === "error" &&
          primary.provider === "github-copilot" &&
          primary.fallbackModel &&
          isGithubCopilotIdeTokenExpired(event.error)
        ) {
          const fallbackResponse = stream(primary.fallbackModel, context, options);
          for await (const fallbackEvent of fallbackResponse) {
            recovered.push(fallbackEvent as AssistantMessageEvent);
          }
          return;
        }
        firstEvent = false;
        recovered.push(event as AssistantMessageEvent);
      }
    })().catch((error) => {
      const failure = streamFailureMessage(model, error);
      recovered.push({ type: "error", reason: "error", error: failure });
    });
    return recovered;
  };
}

const boundedStreamSimple: typeof streamSimple = withGithubCopilotIdeTokenRecovery((model, context, options) =>
  streamSimple(model, context, {
    ...options,
    signal: options?.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(DEFAULT_MODEL_REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(DEFAULT_MODEL_REQUEST_TIMEOUT_MS),
    timeoutMs: options?.timeoutMs ?? DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    maxRetries: options?.maxRetries ?? 1,
  }),
);

export type PreparedAgentExecution = {
  definition: SubagentDefinition;
  sessionId: string;
  task: string;
  prompt: string;
  requireFinish: boolean;
  outputSchema?: TSchema;
  activatedSkill?: MaySkill;
  skillActivation?: "explicit";
  systemPrompt: string;
  tools: AgentTool[];
  runner: AgentRunnerConfig;
};

export type AgentPreparationOptions = {
  definition: SubagentDefinition;
  projectRoot: string;
  sessionId: string;
  task: string;
  persistentChat?: boolean;
  skill?: string;
  requireFinish?: boolean;
  outputSchema?: TSchema;
  toolPolicy?: ToolPolicy;
  /** Override the registered agent's filesystem tools for this execution only. */
  executionRoot?: string;
  promptTimestamp?: string;
  chatContext?: string;
  createFinish?: () => AgentTool;
  /** Create a durable checkpoint capability scoped to this exact execution. */
  createCheckpoint?: () => AgentTool;
  /** Exact durable owner for local bash setsid process groups. */
  bashProcessGroupOwner?: { persistDir: string; sessionId: string };
  onGuard?: (observation: { context: PiBeforeToolCallContext; guard: string; block: boolean; reason: string }) => void;
  onCompact?: (info: CompactionInfo, messages: AgentMessage[]) => void;
  onNotice?: (message: string) => void;
};

function definitionForExecution(options: AgentPreparationOptions): SubagentDefinition {
  const root = options.executionRoot;
  if (!root && !options.bashProcessGroupOwner) return options.definition;
  const executionRoot = root ?? options.definition.projectRoot ?? options.projectRoot;
  const agentName = options.definition.name;
  const tools = options.definition.tools.map((tool) => {
    switch (tool.name) {
      case "read":
        return root ? createReadTool(executionRoot) : tool;
      case "bash":
        return createBashTool(executionRoot, { processGroupOwner: options.bashProcessGroupOwner });
      case "edit":
        return root ? createEditTool(executionRoot, { agentName, projectRoot: executionRoot }) : tool;
      case "write":
        return root ? createWriteTool(executionRoot, { agentName, projectRoot: executionRoot }) : tool;
      default:
        return tool;
    }
  });
  return { ...options.definition, ...(root ? { projectRoot: executionRoot } : {}), tools };
}

export type DirectAgentExecutionResult = {
  status: "done" | "error" | "interrupted";
  messages: AgentMessage[];
  lastAssistantText: string | null;
  error?: string;
  finishResult?: FinishParams;
  structuredResult?: unknown;
  durationMs: number;
};

export type DirectAgentExecutionOptions = {
  initialMessages?: AgentMessage[];
  timeoutMs?: number;
  onObservation?: AgentRuntimeListener;
};

export function normalizeExecutionSchema(schema: TSchema | undefined): TSchema | undefined {
  if (schema === undefined) return undefined;
  try {
    const normalized = JSON.parse(JSON.stringify(schema));
    if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
      throw new Error("schema must serialize to a JSON object");
    }
    return normalized as TSchema;
  } catch (error) {
    throw new Error(
      `Workflow output schema must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolveAgentDir(definition: SubagentDefinition, projectRoot: string): string | undefined {
  if (definition.agentDir) return definition.agentDir;
  if (definition.knowledgeDir) return dirname(definition.knowledgeDir);
  if (definition.workspace) return dirname(definition.workspace);
  return join(definition.projectRoot ?? projectRoot, "agents", definition.name);
}

function loadPromptFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path, "utf-8").trim();
  return text || undefined;
}

function runtimeEnvironment(
  definition: SubagentDefinition,
  projectRoot: string,
  agentDir: string | undefined,
  tools: AgentTool[],
  timestamp: string,
): string {
  const root = definition.projectRoot ?? projectRoot;
  const relative = (path: string | undefined): string | undefined =>
    path && root && path.startsWith(root) ? path.slice(root.length + 1) : path;
  const toolNames = tools.map((tool) => tool.name).filter(Boolean);
  const lines = ["# Runtime Environment", `- Project root: ${root}`];
  const relAgentDir = relative(agentDir);
  const relWorkspace = relative(definition.workspace);
  const relKnowledge = relative(definition.knowledgeDir);
  if (relAgentDir) lines.push(`- Agent directory: ${relAgentDir}`);
  if (relWorkspace) lines.push(`- Workspace: ${relWorkspace} (scratch/runtime work)`);
  if (relKnowledge) {
    lines.push(`- Knowledge: ${relKnowledge} (read on demand; start with INDEX.md when needed)`);
  }
  lines.push("- Already in context: shared/common-sense.md and this agent's AGENTS.md when present.");
  lines.push(
    "- Prompt precedence: common-sense is the shared default; this agent's AGENTS.md is the role-specific identity layer and takes precedence for agent-specific behavior.",
  );
  if (toolNames.length > 0) lines.push(`- Available tools: ${toolNames.join(", ")}`);
  lines.push(`- Current time: ${timestamp}`);
  lines.push("", "All paths are relative to project root unless absolute paths are explicitly provided.");
  return lines.join("\n");
}

function resolveTools(options: AgentPreparationOptions, requireFinish: boolean): AgentTool[] {
  const { definition } = options;
  let tools = options.persistentChat
    ? definition.tools.filter((tool) => !CHAT_TOOL_DENYLIST.has(tool.name))
    : definition.tools;
  if (
    (options.toolPolicy === "full" || options.toolPolicy === "full-no-tasks") &&
    !options.persistentChat &&
    !tools.some((tool) => tool.name === "checkpoint")
  ) {
    const checkpoint = options.createCheckpoint?.();
    if (checkpoint) tools = [...tools, checkpoint];
  }
  if (options.toolPolicy === "full-no-tasks") {
    tools = tools.filter((tool) => tool.name !== "tasks");
  } else if (options.toolPolicy === "readonly") {
    tools = tools.filter((tool) => READONLY_TOOL_ALLOWLIST.has(tool.name));
  } else if (
    options.toolPolicy === "deputy" ||
    options.toolPolicy === "app-agent-deputy" ||
    options.toolPolicy === "app-owner-deputy"
  ) {
    tools = tools.filter((tool) => DEPUTY_TOOL_ALLOWLIST.has(tool.name));
  }
  if (
    options.toolPolicy === "app-agent-full" ||
    options.toolPolicy === "app-agent-deputy" ||
    options.toolPolicy === "app-owner-full" ||
    options.toolPolicy === "app-owner-deputy"
  ) {
    tools = tools.filter((tool) => !APP_OWNER_TOOL_DENYLIST.has(tool.name));
  }
  if (!requireFinish) return applyToolExecutionPolicy(tools);

  const scopedFinish = options.executionRoot ? options.createFinish?.() : undefined;
  const baseFinish =
    scopedFinish ??
    tools.find((tool) => tool.name === "finish") ??
    definition.tools.find((tool) => tool.name === "finish") ??
    options.createFinish?.();
  if (!baseFinish) {
    throw new Error(`Agent ${definition.name} requires finish() but no finish capability was supplied`);
  }
  const finish = createWorkflowFinishTool(baseFinish, options.outputSchema);
  const index = tools.findIndex((tool) => tool.name === "finish");
  return applyToolExecutionPolicy(
    index < 0 ? [...tools, finish] : tools.map((tool, offset) => (offset === index ? finish : tool)),
  );
}

function applyToolExecutionPolicy(tools: AgentTool[]): AgentTool[] {
  return tools.map((tool) => (SEQUENTIAL_TOOL_NAMES.has(tool.name) ? { ...tool, executionMode: "sequential" } : tool));
}

function bindToolsToSession(tools: AgentTool[], agentName: string, sessionId: string): AgentTool[] {
  return tools.map((tool) => {
    const execute = tool.execute.bind(tool);
    return {
      ...tool,
      execute: (...args: Parameters<AgentTool["execute"]>) =>
        runWithAgentSessionContext(agentName, sessionId, () => execute(...args)),
    } as AgentTool;
  });
}

function buildGuards(definition: SubagentDefinition, projectRoot: string): BeforeToolCallHook[] {
  const named =
    (guardName: string, guard: BeforeToolCallHook): BeforeToolCallHook =>
    async (context, signal) => {
      const result = await guard(context, signal);
      return result ? { ...result, guardName: result.guardName ?? guardName } : undefined;
    };
  return [
    named("path-hallucination", createPathHallucinationGuard()),
    named("finish-evidence", createFinishGuard()),
    named("commit", createCommitGuard(definition.name, projectRoot)),
    named("read-dedup", createReadDedupGuard()),
    named("session-read", createSessionReadGuard()),
    named("scrape-dedup", createScrapeDedupGuard()),
  ];
}

function resolveSystemPrompt(options: AgentPreparationOptions, tools: AgentTool[], requireFinish: boolean): string {
  const { definition, projectRoot } = options;
  let base = definition.systemPrompt;
  if (base === undefined) {
    const agentDir = resolveAgentDir(definition, projectRoot);
    const sections: string[] = [];
    const shared = loadPromptFile(join(definition.sharedRoot ?? join(projectRoot, "shared"), "common-sense.md"));
    if (shared) sections.push(shared);
    if (agentDir) {
      const identity = loadPromptFile(join(agentDir, "AGENTS.md"));
      if (identity) sections.push(identity);
    }
    if (definition.skillCatalog && tools.some((tool) => tool.name === "read")) {
      const catalog = formatBoundedSkillCatalog(definition.skillCatalog);
      if (catalog.text) sections.push(catalog.text);
      if (catalog.omitted.length > 0) {
        options.onNotice?.(
          `[skills] ${definition.name}: omitted ${catalog.omitted.length} skill(s) from prompt budget: ${catalog.omitted.join(", ")}`,
        );
      }
    }
    sections.push(
      runtimeEnvironment(definition, projectRoot, agentDir, tools, options.promptTimestamp ?? new Date().toISOString()),
    );
    base = `<system_instructions>\n${sections.join("\n\n")}\n</system_instructions>`;
  }

  if (requireFinish) {
    const resultInstruction = options.outputSchema
      ? "The finish() call must include the required schema-validated result payload."
      : "Use the standard finish() fields; no caller-defined result payload is required.";
    base += `\n\n<workflow_completion>\nThis is a workflow step. Complete it only by calling finish() as your final action. ${resultInstruction} A prose-only response is not a successful workflow result.\n</workflow_completion>`;
  }
  if (options.persistentChat && options.chatContext) {
    base += `\n\n<chat_runtime_context>\n${options.chatContext}\n</chat_runtime_context>`;
  }
  return base;
}

/**
 * Resolve one agent turn into a model prompt, capability set, guards, and
 * compaction policy. This layer has no EventBus, database, task, schedule, or
 * session-persistence dependency; durable and direct callers add those around
 * the returned runner configuration.
 */
export function prepareAgentExecution(options: AgentPreparationOptions): PreparedAgentExecution {
  const definition = definitionForExecution(options);
  options = { ...options, definition, projectRoot: options.executionRoot ?? options.projectRoot };
  const parsedSkill = parseExplicitSkill(options.task);
  const skillName = options.skill ?? parsedSkill.skill;
  const task = parsedSkill.skill ? parsedSkill.task : options.task;
  if (skillName && !task) throw new Error(`Skill "${skillName}" requires a task`);
  const activation = skillName ? invokeCatalogSkill(options.definition.skillCatalog, skillName, task) : undefined;
  const outputSchema = normalizeExecutionSchema(options.outputSchema);
  const requireFinish = options.requireFinish === true || outputSchema !== undefined;
  const normalizedOptions = { ...options, outputSchema };
  const tools = bindToolsToSession(
    resolveTools(normalizedOptions, requireFinish),
    options.definition.name,
    options.sessionId,
  );
  const guards = buildGuards(options.definition, options.definition.projectRoot ?? options.projectRoot);
  const composed = guards.length ? composeGuards(...guards) : undefined;
  const beforeToolCall = composed
    ? async (context: PiBeforeToolCallContext, signal?: AbortSignal) => {
        const result = await composed(toGuardContext(context), signal);
        if (result) {
          options.onGuard?.({
            context,
            guard: result.guardName ?? "unknown",
            block: result.block,
            reason: result.reason,
          });
        }
        return result;
      }
    : undefined;

  let compactInfo: CompactionInfo | undefined;
  const compact =
    options.persistentChat || options.definition.compaction
      ? createCompactionTransform(options.definition.model, {
          onCompact: (info) => {
            compactInfo = info;
          },
        })
      : undefined;
  const transformContext = compact
    ? async (messages: AgentMessage[]) => {
        compactInfo = undefined;
        const compacted = await compact(messages);
        if (compacted !== messages) messages.splice(0, messages.length, ...compacted);
        if (compactInfo) options.onCompact?.(compactInfo, messages);
        return messages;
      }
    : undefined;
  const systemPrompt = resolveSystemPrompt(normalizedOptions, tools, requireFinish);

  return {
    definition: options.definition,
    sessionId: options.sessionId,
    task,
    prompt: activation?.prompt ?? task,
    requireFinish,
    outputSchema,
    activatedSkill: activation?.skill,
    skillActivation: activation ? "explicit" : undefined,
    systemPrompt,
    tools,
    runner: {
      streamFn: boundedStreamSimple,
      sessionId: options.sessionId,
      initialState: {
        systemPrompt,
        model: options.definition.model,
        tools,
      },
      beforeToolCall,
      transformContext,
      getApiKey: options.definition.apiKey ? () => options.definition.apiKey! : undefined,
    },
  };
}

/** Execute one prepared turn without durable-session or autonomous infrastructure. */
export async function executePreparedAgent(
  prepared: PreparedAgentExecution,
  options: DirectAgentExecutionOptions = {},
): Promise<DirectAgentExecutionResult> {
  const startedAt = Date.now();
  const agent = createAgentRun(prepared.runner);
  if (options.initialMessages) agent.state.messages = [...options.initialMessages] as any;
  const unsubscribe = options.onObservation ? agent.subscribe(options.onObservation) : undefined;
  let boundedFinishRequested = false;
  let toolCalls = 0;
  const unsubscribeBoundedFinish = prepared.requireFinish
    ? agent.subscribe((event) => {
        if (event.type !== "tool_execution_start") return;
        toolCalls++;
        if (
          !shouldRequestBoundedWorkflowFinish(true, toolCalls, boundedFinishRequested, {
            admittedTimeoutMs: options.timeoutMs,
            elapsedMs: Date.now() - startedAt,
          })
        )
          return;
        boundedFinishRequested = true;
        agent.steer({
          role: "user",
          content: [{ type: "text", text: boundedWorkflowFinishPrompt(prepared.outputSchema) }],
        } as any);
      })
    : undefined;
  let timedOut = false;
  let error: string | undefined;
  const timer = options.timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        agent.cancel();
      }, options.timeoutMs)
    : undefined;

  try {
    let recoveredThrownFailure = false;
    try {
      await agent.prompt(prepared.prompt);
      await agent.waitForIdle();
    } catch (initialCause) {
      const initialError = initialCause instanceof Error ? initialCause.message : String(initialCause);
      const messages = agent.state.messages as AgentMessage[];
      const captured = prepared.requireFinish
        ? await recoverCapturedWorkflowFinish({
            sessionId: prepared.sessionId,
            messages,
            tools: prepared.tools,
            reason: initialError,
          })
        : { disposition: "ineligible" as const };
      if (captured.disposition === "recovered" || captured.disposition === "already-committed") {
        recoveredThrownFailure = true;
      } else if (
        prepared.requireFinish &&
        !extractFinishParams(messages as any[]) &&
        shouldAttemptWorkflowFinishRecovery(initialError)
      ) {
        recoveredThrownFailure = true;
        try {
          await agent.prompt(workflowFinishRecoveryPrompt(prepared.outputSchema, captured.error ?? initialError));
          await agent.waitForIdle();
        } catch (recoveryCause) {
          const recoveryError = recoveryCause instanceof Error ? recoveryCause.message : String(recoveryCause);
          throw new Error(
            `Initial workflow prompt failed: ${initialError}; bounded finish recovery failed: ${recoveryError}`,
            { cause: recoveryCause },
          );
        }
      } else {
        throw initialCause;
      }
    }
    if (prepared.requireFinish && !recoveredThrownFailure) {
      const messages = agent.state.messages as AgentMessage[];
      const terminalError = extractLastAssistantError(messages) ?? classifyTerminalAssistantFailure(messages);
      if (!extractFinishParams(messages as any[])) {
        if (shouldAttemptWorkflowFinishRecovery(terminalError)) {
          if (isRetryableEmptyAssistantFailure(terminalError)) {
            messages.pop();
          }
          await agent.prompt(workflowFinishRecoveryPrompt(prepared.outputSchema, terminalError));
          await agent.waitForIdle();
        } else if (!terminalError) {
          await agent.prompt(
            "This workflow step has not returned its structured result. Call finish() now with all required fields" +
              (prepared.outputSchema ? ", including the schema-validated result payload." : "."),
          );
          await agent.waitForIdle();
        }
      }
    }
  } catch (cause) {
    error = timedOut
      ? `Agent timed out after ${options.timeoutMs}ms`
      : cause instanceof Error
        ? cause.message
        : String(cause);
  } finally {
    if (timer) clearTimeout(timer);
    if (typeof unsubscribe === "function") unsubscribe();
    if (typeof unsubscribeBoundedFinish === "function") unsubscribeBoundedFinish();
  }

  const messages = agent.state.messages as AgentMessage[];
  const finishResult = extractFinishParams(messages as any[]) ?? undefined;
  const assistantError = !finishResult ? extractLastAssistantError(messages) : undefined;
  const terminalFailure = !finishResult ? classifyTerminalAssistantFailure(messages) : undefined;
  error ??= assistantError ?? terminalFailure;
  if (!error && prepared.requireFinish && !finishResult) {
    error = "Workflow agent step ended without calling finish() after one corrective prompt";
  }
  if (!error && prepared.outputSchema && finishResult && finishResult.result === undefined) {
    error = "Workflow agent step completed without the required schema-backed finish().result payload";
  }
  const assistantText = finishResult?.summary ?? extractLastAssistantText(messages);
  if (!error && !finishResult && !assistantText) {
    error = "Agent ended without producing a response";
  }
  const status = timedOut ? "interrupted" : finishResult?.status === "failure" || error ? "error" : "done";

  return {
    status,
    messages,
    lastAssistantText: assistantText,
    ...(error ? { error } : {}),
    ...(finishResult ? { finishResult, structuredResult: finishResult.result } : {}),
    durationMs: Date.now() - startedAt,
  };
}
