import { ExecutionDeferredError, type AppRead } from "@may-agent/sdk/app";
import { Type, type Static, type TSchema } from "typebox";
/** Canonical catalog-backed agent/workflow list and awaited call tool. */

import type { AgentMessage, AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { RegisteredAgent } from "@may-agent/sdk/runtime";
import type { SubagentDefinition, TaskResult } from "@may-agent/sdk/runtime";
import type { PersistedSession, TaskBinding } from "./persistence.js";
import {
  CallableCatalog,
  ExecutionInputSchema,
  agentExecutionResult,
  buildWorkflowCatalog,
  canonicalCallableName,
  deferredExecutionResult,
  workflowExecutionResult,
  type CallableDefinition,
  type CallableInvocationContext,
  type CallableOptions,
  type ExecutionInput,
  type ExecutionScope,
  type WorkflowCatalog,
  type WorkflowModule,
} from "@may-agent/sdk/runtime";
import type { RuntimeCtx } from "./runtime-ctx.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import { createWorkflowRunner } from "./workflow-tool.js";
import type { WorkflowEvent } from "./workflow.js";
import type { EventTrace } from "../app/core/events/bus.js";
import { join } from "node:path";

// ── Manager interface ──────────────────────────────────────────────────
// Instead of importing the full SubagentManager class (circular dependency),
// we define only the methods/properties the agents tool needs.

export interface AgentsToolManagerDeps {
  agents: ReadonlyMap<string, RegisteredAgent>;
  activeSessions: ReadonlyMap<
    string,
    {
      workflowRunId?: string;
      projectId?: string;
      trace?: EventTrace;
      taskBinding?: TaskBinding;
      taskContext?: TaskExecutionContext;
      agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
      callableCatalogScope?: object;
      executionScope?: ExecutionScope;
    }
  >;
  callAgentDefinition(
    definition: SubagentDefinition,
    task: string,
    opts?: {
      parentSessionId?: string;
      workflowRunId?: string;
      projectId?: string;
      source?: string;
      trace?: EventTrace;
      parseSkillCommand?: boolean;
      requireFinish?: boolean;
      outputSchema?: TSchema;
      signal?: AbortSignal;
      timeout?: number;
      taskBinding?: TaskBinding;
      taskContext?: TaskExecutionContext;
      agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
      callableCatalogScope?: object;
    },
  ): Promise<TaskResult & { messages: AgentMessage[] }>;
  registry: {
    persistDir: string;
    getSession(sessionId: string): PersistedSession | null;
  };
}

export interface CreateAgentsToolOptions {
  /** Returns the current caller's session ID for parent→child linking. */
  getCallerSessionId?: () => string | undefined;
  /** Optional runtime context for executing workflows through action: "call". */
  runtimeCtx?: RuntimeCtx;
  /** Optional App read factory for workflows invoked through action: "call". */
  createRead?: (taskContext?: TaskExecutionContext) => AppRead;
  onWorkflowEvent?: (event: WorkflowEvent) => void;
}

// ── Main export ────────────────────────────────────────────────────────

const CanonicalAgentsToolParams = Type.Union([
  Type.Object({ action: Type.Literal("list") }, { additionalProperties: false }),
  Type.Object(
    {
      action: Type.Literal("call"),
      agent: Type.String({ description: "Exact canonical name returned by list." }),
      input: ExecutionInputSchema,
      options: Type.Optional(
        Type.Object(
          {
            timeoutMs: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
            schema: Type.Optional(Type.Unknown()),
          },
          { additionalProperties: false },
        ),
      ),
    },
    { additionalProperties: false },
  ),
]);

type CanonicalAgentsToolParamsType = Static<typeof CanonicalAgentsToolParams>;

function callablePrompt(input: ExecutionInput): string {
  return input.data === undefined
    ? input.prompt
    : `${input.prompt}\n\nAssignment data (JSON):\n${JSON.stringify(input.data, null, 2)}`;
}

function callableReport(result: ReturnType<typeof agentExecutionResult> | NonNullable<ReturnType<typeof workflowExecutionResult>>) {
  return {
    status: result.status,
    summary: result.summary,
    ...(result.output !== undefined ? { output: result.output } : {}),
    ...(result.facts !== undefined ? { facts: result.facts } : {}),
  };
}

// Tool instances are loaded with agent definitions, but catalog snapshots belong
// to one live execution tree. A Task context is shared by every descendant in
// that tree; direct callers fall back to their live execution scope/session.
type PreparedCallable =
  | { kind: "agent"; appId?: string; definition: SubagentDefinition }
  | {
      kind: "workflow";
      appId?: string;
      owner: SubagentDefinition;
      agentDefinitions: ReadonlyMap<string, SubagentDefinition>;
      workflowDir: string;
      workflows: WorkflowCatalog;
      workflow: WorkflowModule;
    };

const preparedCatalogs = new WeakMap<object, WeakMap<object, Promise<readonly PreparedCallable[]>>>();

function catalogCache(manager: AgentsToolManagerDeps): WeakMap<object, Promise<readonly PreparedCallable[]>> {
  let cache = preparedCatalogs.get(manager);
  if (!cache) {
    cache = new WeakMap();
    preparedCatalogs.set(manager, cache);
  }
  return cache;
}

function createCanonicalAgentsTool(manager: AgentsToolManagerDeps, opts?: CreateAgentsToolOptions): AgentTool {

  const lineage = (sessionId: string) => {
    const active = manager.activeSessions.get(sessionId);
    const persisted = manager.registry.getSession(sessionId);
    return {
      workflowRunId: active?.workflowRunId ?? persisted?.workflowRunId,
      projectId: active?.projectId ?? persisted?.projectId,
      trace: active?.trace,
    };
  };

  const invokeAgent = async (
    definition: SubagentDefinition,
    input: ExecutionInput,
    context: CallableInvocationContext,
    agentDefinitions: ReadonlyMap<string, SubagentDefinition>,
    callableCatalogScope: object,
    outputSchema?: TSchema,
  ) => {
    const parentSessionId = opts?.getCallerSessionId?.();
    if (!parentSessionId || !manager.activeSessions.has(parentSessionId)) {
      throw new Error("Callable agent invocation requires its live caller session");
    }
    const parent = lineage(parentSessionId);
    const session = manager.activeSessions.get(parentSessionId);
    const result = await manager.callAgentDefinition(definition, callablePrompt(input), {
      parentSessionId,
      workflowRunId: parent.workflowRunId,
      projectId: parent.projectId,
      source: "agents.call",
      trace: parent.trace,
      parseSkillCommand: false,
      requireFinish: true,
      outputSchema,
      signal: context.signal,
      timeout: context.timeoutMs,
      taskBinding: session?.taskBinding,
      taskContext: session?.taskContext,
      agentDefinitions: session?.taskContext?.agentDefinitions ?? agentDefinitions,
      callableCatalogScope: session?.taskContext ?? callableCatalogScope,
    });
    return { executionId: result.sessionId, report: callableReport(agentExecutionResult(result)) };
  };

  const invokeWorkflow = async (
    entry: Extract<PreparedCallable, { kind: "workflow" }>,
    input: ExecutionInput,
    context: CallableInvocationContext,
    workflowCatalogsByOwner: ReadonlyMap<string, WorkflowCatalog>,
    callableCatalogScope: object,
  ) => {
    const parentSessionId = opts?.getCallerSessionId?.();
    if (!parentSessionId || !manager.activeSessions.has(parentSessionId)) {
      throw new Error("Callable workflow invocation requires its live caller session");
    }
    const session = manager.activeSessions.get(parentSessionId);
    if (session?.taskBinding && !session.taskContext) {
      throw new Error("Current Task execution context is unavailable");
    }
    const parent = lineage(parentSessionId);
    const runner = createWorkflowRunner({
      manager: manager as any,
      workflowDir: entry.workflowDir,
      persistDir: manager.registry.persistDir,
      agentName: entry.owner.name,
      canonicalOwner: canonicalCallableName(entry.appId, entry.owner.name),
      runtimeCtx: opts?.runtimeCtx,
      ...session?.taskContext,
      taskContext: session?.taskContext,
      agentDefinitions: session?.taskContext?.agentDefinitions ?? entry.agentDefinitions,
      workflowCatalogsByOwner,
      callableCatalogScope: session?.taskContext ?? callableCatalogScope,
      read: opts?.createRead ? opts.createRead(session?.taskContext) : undefined,
      callerSessionId: parentSessionId,
      projectId: parent.projectId,
      trace: parent.trace,
      onEvent: opts?.onWorkflowEvent,
      signal: session?.executionScope
        ? AbortSignal.any([context.signal, session.executionScope.signal])
        : context.signal,
      executionTimeoutMs: context.timeoutMs,
      workflowInput: input,
    });
    const raw = await runner.run(entry.workflow.name, input.prompt, entry.workflows);
    const result = workflowExecutionResult(raw);
    if (!result) {
      throw new Error(`Workflow callable ${canonicalCallableName(entry.appId, entry.workflow.name)} returned no execution result`);
    }
    return { executionId: result.id, report: callableReport(result) };
  };

  const prepare = (
    cacheKey: object,
    capturedAgents: readonly SubagentDefinition[],
    signal: AbortSignal,
  ): Promise<readonly PreparedCallable[]> => {
    const cache = catalogCache(manager);
    const existing = cache.get(cacheKey);
    if (existing) return existing;
    const pending = (async () => {
      const entries: PreparedCallable[] = [];
      const agentDefinitions = new Map(capturedAgents.map((definition) => [
        canonicalCallableName(definition.appLocal ? definition.projectId : undefined, definition.name),
        definition,
      ]));
      for (const definition of capturedAgents) {
        entries.push({
          kind: "agent",
          ...(definition.appLocal ? { appId: definition.projectId } : {}),
          definition,
        });
      }
      for (const owner of capturedAgents) {
        if (!owner.agentDir) continue;
        const workflowDir = join(owner.agentDir, "workflows");
        const workflows = await buildWorkflowCatalog(workflowDir, signal);
        signal.throwIfAborted();
        for (const workflow of workflows.workflows.values()) {
          entries.push({
            kind: "workflow",
            ...(owner.appLocal ? { appId: owner.projectId } : {}),
            owner,
            agentDefinitions,
            workflowDir,
            workflows,
            workflow,
          });
        }
      }
      return entries;
    })();
    cache.set(cacheKey, pending);
    void pending.catch(() => {
      if (cache.get(cacheKey) === pending) cache.delete(cacheKey);
    });
    return pending;
  };

  const bindCatalog = (entries: readonly PreparedCallable[], callableCatalogScope: object, outputSchema?: TSchema) => {
    const agentDefinitions = new Map(entries.flatMap((entry) => entry.kind === "agent"
      ? [[canonicalCallableName(entry.appId, entry.definition.name), entry.definition] as const]
      : []));
    const workflowCatalogsByOwner = new Map<string, WorkflowCatalog>();
    for (const entry of entries) {
      if (entry.kind === "workflow") {
        workflowCatalogsByOwner.set(canonicalCallableName(entry.appId, entry.owner.name), entry.workflows);
      }
    }
    return new CallableCatalog(entries.map((entry): CallableDefinition => {
      if (entry.kind === "agent") {
        return {
          appId: entry.appId,
          declaredName: entry.definition.name,
          description: entry.definition.description,
          invoke: (input, context) => invokeAgent(
            entry.definition,
            input,
            context,
            agentDefinitions,
            callableCatalogScope,
            outputSchema,
          ),
        };
      }
      return {
        appId: entry.appId,
        declaredName: entry.workflow.name,
        description: entry.workflow.description,
        ...(entry.workflow.inputSchema ? { inputSchema: entry.workflow.inputSchema } : {}),
        ...(entry.workflow.outputSchema ? { outputSchema: entry.workflow.outputSchema } : {}),
        invoke: (input, context) => invokeWorkflow(
          entry,
          input,
          context,
          workflowCatalogsByOwner,
          callableCatalogScope,
        ),
      };
    }));
  };

  return {
    name: "agents",
    label: "Agents",
    description: "List the complete captured callable catalog or await an exact canonical agent/workflow call using {prompt,data?}.",
    parameters: CanonicalAgentsToolParams,
    execute: async (_toolCallId, rawParams, signal) => {
      const params = rawParams as CanonicalAgentsToolParamsType;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        if (params.action !== "list" && params.action !== "call") {
          throw new Error(`Unknown agents action: ${String((params as { action?: unknown }).action)}`);
        }
        const parentSessionId = opts?.getCallerSessionId?.();
        const session = parentSessionId ? manager.activeSessions.get(parentSessionId) : undefined;
        if (!parentSessionId || !session) {
          throw new Error("Callable catalog preparation requires its live caller session");
        }
        const requestedTimeout = params.action === "call" ? params.options?.timeoutMs : undefined;
        if (requestedTimeout !== undefined && (!Number.isFinite(requestedTimeout) || requestedTimeout <= 0)) {
          throw new Error("Call timeoutMs must be a positive finite number");
        }
        const deadlineAt = Math.min(
          requestedTimeout === undefined ? Infinity : Date.now() + requestedTimeout,
          session.executionScope?.workDeadlineAt ?? Infinity,
        );
        const timeoutController = Number.isFinite(deadlineAt) ? new AbortController() : undefined;
        if (timeoutController) {
          const remaining = Math.max(0, deadlineAt - Date.now());
          timeout = setTimeout(
            () => timeoutController.abort(new Error(`Callable catalog preparation timed out after ${remaining}ms`)),
            remaining,
          );
          timeout.unref?.();
        }
        const inheritedSignal = session.executionScope?.workSignal;
        const signals = [signal, inheritedSignal, timeoutController?.signal].filter(
          (candidate): candidate is AbortSignal => candidate !== undefined,
        );
        if (signals.length === 0) {
          throw new Error("Callable catalog preparation requires a bounded execution signal");
        }
        const executionSignal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals);
        executionSignal.throwIfAborted();
        const taskDefinitions = session.taskContext?.agentDefinitions;
        const capturedDefinitions = taskDefinitions ?? session.agentDefinitions;
        const capturedAgents = capturedDefinitions
          ? [...capturedDefinitions.values()]
          : [...manager.agents.values()].map((registered) => registered.definition);
        const cacheKey = session.taskContext ?? session.callableCatalogScope ?? session.executionScope ?? session;
        const outputSchema = params.action === "call" ? params.options?.schema as TSchema | undefined : undefined;
        const catalog = bindCatalog(await prepare(cacheKey, capturedAgents, executionSignal), cacheKey, outputSchema);
        executionSignal.throwIfAborted();
        if (params.action === "list") return textResult(JSON.stringify(catalog.list(), null, 2));
        const remainingTimeout = Number.isFinite(deadlineAt) ? Math.max(1, deadlineAt - Date.now()) : undefined;
        return textResult(JSON.stringify(await catalog.call(
          params.agent,
          params.input,
          params.options as CallableOptions | undefined,
          { signal: executionSignal, ...(remainingTimeout !== undefined ? { timeoutMs: remainingTimeout } : {}) },
        ), null, 2));
      } catch (error) {
        if (error instanceof ExecutionDeferredError) {
          return textResult(JSON.stringify(deferredExecutionResult(error)));
        }
        return textResult(JSON.stringify({
          status: "error",
          summary: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
  };
}

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

/**
 * Create the canonical `agents` list/call tool. Definitions are captured when
 * the tool is created so discovery and dispatch share one pinned catalog.
 */
export function createAgentsTool(manager: AgentsToolManagerDeps, opts?: CreateAgentsToolOptions): AgentTool {
  return createCanonicalAgentsTool(manager, opts);
}
