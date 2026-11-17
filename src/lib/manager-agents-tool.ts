import { ExecutionDeferredError, type AppRead } from "@may-agent/sdk/app";
import { Type, type Static } from "typebox";
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
      signal?: AbortSignal;
      timeout?: number;
      taskBinding?: TaskBinding;
      taskContext?: TaskExecutionContext;
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

function createCanonicalAgentsTool(manager: AgentsToolManagerDeps, opts?: CreateAgentsToolOptions): AgentTool {
  // Capture at the first active execution boundary, after configuration has
  // published its generation. Preparation then pins this complete snapshot so
  // list, call, and every descendant use the same definitions.
  let prepared: Promise<CallableCatalog> | undefined;

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
      signal: context.signal,
      timeout: context.timeoutMs,
      taskBinding: session?.taskBinding,
      taskContext: session?.taskContext,
    });
    return { executionId: result.sessionId, report: callableReport(agentExecutionResult(result)) };
  };

  const prepare = (signal: AbortSignal) => {
    prepared ??= (async () => {
      const parentSessionId = opts?.getCallerSessionId?.();
      const taskDefinitions = parentSessionId
        ? manager.activeSessions.get(parentSessionId)?.taskContext?.agentDefinitions
        : undefined;
      const capturedAgents = taskDefinitions
        ? [...taskDefinitions.values()]
        : [...manager.agents.values()].map((registered) => registered.definition);
      const definitions: CallableDefinition[] = [];
      for (const definition of capturedAgents) {
        definitions.push({
          appId: definition.appLocal ? definition.projectId : undefined,
          declaredName: definition.name,
          description: definition.description,
          async invoke(input, context) {
            return invokeAgent(definition, input, context);
          },
        });
      }
      for (const owner of capturedAgents) {
        if (!owner.agentDir) continue;
        const workflowDir = join(owner.agentDir, "workflows");
        const workflows = await buildWorkflowCatalog(workflowDir, signal);
        signal.throwIfAborted();
        for (const workflow of workflows.workflows.values()) {
          const appId = owner.appLocal ? owner.projectId : undefined;
          definitions.push({
            appId,
            declaredName: workflow.name,
            description: workflow.description,
            ...(workflow.inputSchema ? { inputSchema: workflow.inputSchema } : {}),
            ...(workflow.outputSchema ? { outputSchema: workflow.outputSchema } : {}),
            async invoke(input, context) {
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
                workflowDir,
                persistDir: manager.registry.persistDir,
                agentName: owner.name,
                runtimeCtx: opts?.runtimeCtx,
                ...session?.taskContext,
                taskContext: session?.taskContext,
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
              const raw = await runner.run(workflow.name, input.prompt, workflows);
              const result = workflowExecutionResult(raw);
              if (!result) {
                throw new Error(`Workflow callable ${canonicalCallableName(appId, workflow.name)} returned no execution result`);
              }
              return { executionId: result.id, report: callableReport(result) };
            },
          });
        }
      }
      return new CallableCatalog(definitions);
    })();
    return prepared;
  };

  return {
    name: "agents",
    label: "Agents",
    description: "List the complete captured callable catalog or await an exact canonical agent/workflow call using {prompt,data?}.",
    parameters: CanonicalAgentsToolParams,
    execute: async (_toolCallId, rawParams, signal) => {
      const params = rawParams as CanonicalAgentsToolParamsType;
      const executionSignal = signal ?? new AbortController().signal;
      try {
        const catalog = await prepare(executionSignal);
        if (params.action === "list") return textResult(JSON.stringify(catalog.list(), null, 2));
        return textResult(JSON.stringify(await catalog.call(
          params.agent,
          params.input,
          params.options as CallableOptions | undefined,
          { signal: executionSignal },
        ), null, 2));
      } catch (error) {
        if (error instanceof ExecutionDeferredError) {
          return textResult(JSON.stringify(deferredExecutionResult(error)));
        }
        return textResult(JSON.stringify({
          status: "error",
          summary: error instanceof Error ? error.message : String(error),
        }));
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
