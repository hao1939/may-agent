import type {
  AgentMessage,
  AgentTool,
  BeforeToolCallContext as PiBeforeToolCallContext,
} from "@earendil-works/pi-agent-core";
import type { TSchema } from "@earendil-works/pi-ai";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createCompactionTransform, type CompactionInfo } from "./compaction.js";
import { formatBoundedSkillCatalog, invokeCatalogSkill, parseExplicitSkill, type MaySkill } from "./skills.js";
import type { SubagentDefinition } from "./types.js";
import { composeGuards, toGuardContext, type BeforeToolCallHook } from "./tools/compose-guards.js";
import { createCommitGuard } from "./tools/commit-guard.js";
import { createCompletenessGuard } from "./tools/completeness-guard.js";
import { createEmptyArgsGuard } from "./tools/empty-args-guard.js";
import { createFinishGuard } from "./tools/finish-guard.js";
import { createPathHallucinationGuard } from "./tools/path-hallucination-guard.js";
import { createReadDedupGuard } from "./tools/read-dedup-guard.js";
import { createScrapeDedupGuard } from "./tools/scrape-dedup-guard.js";
import { createSessionReadGuard } from "./tools/session-read-guard.js";
import { createToolSchemaGuard } from "./tools/tool-schema-guard.js";
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
} from "./manager-utils.js";

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

const READONLY_TOOL_ALLOWLIST = new Set(["finish", "query_db", "read", "scrape_webpage", "system_status"]);

export type PreparedAgentExecution = {
  definition: SubagentDefinition;
  task: string;
  prompt: string;
  requireFinish: boolean;
  outputSchema?: TSchema;
  activatedSkill?: MaySkill;
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
  toolPolicy?: "full" | "readonly";
  /** Override the registered agent's filesystem tools for this execution only. */
  executionRoot?: string;
  promptTimestamp?: string;
  chatContext?: string;
  createFinish?: () => AgentTool;
  dynamicApiKey?: () => string;
  onGuard?: (observation: { context: PiBeforeToolCallContext; guard: string; block: boolean; reason: string }) => void;
  onCompact?: (info: CompactionInfo, messages: AgentMessage[]) => void;
  onNotice?: (message: string) => void;
};

function definitionForExecution(options: AgentPreparationOptions): SubagentDefinition {
  const root = options.executionRoot;
  if (!root) return options.definition;
  const agentName = options.definition.name;
  const tools = options.definition.tools.map((tool) => {
    switch (tool.name) {
      case "read":
        return createReadTool(root);
      case "bash":
        return createBashTool(root);
      case "edit":
        return createEditTool(root, { agentName, projectRoot: root });
      case "write":
        return createWriteTool(root, { agentName, projectRoot: root });
      default:
        return tool;
    }
  });
  return { ...options.definition, projectRoot: root, tools };
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
  if (options.toolPolicy === "readonly") {
    tools = tools.filter((tool) => READONLY_TOOL_ALLOWLIST.has(tool.name));
  }
  if (!requireFinish) return tools;

  const baseFinish =
    tools.find((tool) => tool.name === "finish") ??
    definition.tools.find((tool) => tool.name === "finish") ??
    options.createFinish?.();
  if (!baseFinish) {
    throw new Error(`Agent ${definition.name} requires finish() but no finish capability was supplied`);
  }
  const finish = createWorkflowFinishTool(baseFinish, options.outputSchema);
  const index = tools.findIndex((tool) => tool.name === "finish");
  return index < 0 ? [...tools, finish] : tools.map((tool, offset) => (offset === index ? finish : tool));
}

function buildGuards(definition: SubagentDefinition, projectRoot: string): BeforeToolCallHook[] {
  const named =
    (guardName: string, guard: BeforeToolCallHook): BeforeToolCallHook =>
    async (context, signal) => {
      const result = await guard(context, signal);
      return result ? { ...result, guardName: result.guardName ?? guardName } : undefined;
    };
  return [
    named("empty-args", createEmptyArgsGuard()),
    named("tool-schema", createToolSchemaGuard()),
    named("path-hallucination", createPathHallucinationGuard()),
    named("completeness", createCompletenessGuard(definition.name)),
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
    const shared = loadPromptFile(join(projectRoot, "shared", "common-sense.md"));
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
  const tools = resolveTools(normalizedOptions, requireFinish);
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
    task,
    prompt: activation?.prompt ?? task,
    requireFinish,
    outputSchema,
    activatedSkill: activation?.skill,
    systemPrompt,
    tools,
    runner: {
      initialState: {
        systemPrompt,
        model: options.definition.model,
        tools,
      },
      beforeToolCall,
      transformContext,
      getApiKey:
        options.definition.apiKey === "dynamic"
          ? options.dynamicApiKey
          : options.definition.apiKey
            ? () => options.definition.apiKey!
            : undefined,
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
  let timedOut = false;
  let error: string | undefined;
  const timer = options.timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        agent.cancel();
      }, options.timeoutMs)
    : undefined;

  try {
    await agent.prompt(prepared.prompt);
    await agent.waitForIdle();
    if (prepared.requireFinish) {
      const messages = agent.state.messages as AgentMessage[];
      const terminalError = extractLastAssistantError(messages) ?? classifyTerminalAssistantFailure(messages);
      if (!extractFinishParams(messages as any[]) && !terminalError) {
        await agent.prompt(
          "This workflow step has not returned its structured result. Call finish() now with all required fields" +
            (prepared.outputSchema ? ", including the schema-validated result payload." : "."),
        );
        await agent.waitForIdle();
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
  }

  const messages = agent.state.messages as AgentMessage[];
  const finishResult = extractFinishParams(messages as any[]) ?? undefined;
  const assistantError = extractLastAssistantError(messages);
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
