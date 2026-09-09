import { basename, join } from "node:path";
import type { TaskVerifier as AppTaskVerifier } from "@may-agent/sdk";
import type { SubagentManager } from "../../../lib/index.js";
import type { SubagentDefinition } from "../../../lib/types.js";
import { captureAgentDefinitions } from "./agent-definitions.js";
import { buildRuntimeCtx } from "../../../lib/runtime-ctx.js";
import {
  inspectWorkflowDefinition,
  runWorkflowDirect,
  WorkflowHandlerUnavailable,
} from "../../../lib/workflow-tool.js";
import { createRuntimeAppRead } from "../../app-read.js";
import { projectAppTaskChildPromptContext } from "../../app-task-context.js";
import { APP_TASK_RECOVERY_OWNER } from "../../app-task-reconciler.js";
import { childEventTrace, type AgentEvent, type EventBus } from "../../event-bus.js";
import { normalizeTaskHandlerResult, type TaskCapabilityRun } from "../../core/tasks/result.js";
import type { TaskDefinitionSource, TaskWorkflowInput, TaskWorkflowRunner } from "../../core/tasks/execution.js";
import { localAgentDir } from "../discovery/local-agents.js";

/** Composition selects the built-in runner. Core does not load workflows. */
export function createTaskWorkflowRunner(
  input: { manager: SubagentManager; bus: EventBus },
  definitions?: ReadonlyMap<string, SubagentDefinition>,
): TaskWorkflowRunner {
  return {
    async inspect({ source, appDir, agent, workflow }) {
      const paths = appWorkflowRuntimePaths(source, { appDir }, agent);
      const inspected = await inspectWorkflowDefinition(paths.workflowDir, workflow);
      return {
        ...inspected,
        verifier: inspected.verifier as Awaited<ReturnType<TaskWorkflowRunner["inspect"]>>["verifier"],
      };
    },
    execute: (attempt) => executeTaskCapability(attempt, input.manager, input.bus, definitions),
    snapshot: () => createTaskWorkflowRunner(input, captureAgentDefinitions(input.manager) ?? definitions),
  };
}

function requireWorkflowRuntimeOptions(opts: TaskDefinitionSource): {
  persistDir: string;
  agentsRoot: string;
  sharedRoot: string;
} {
  if (!opts.persistDir || !opts.agentsRoot || !opts.sharedRoot) {
    throw new Error("App task workflows require persistDir, agentsRoot, and sharedRoot");
  }
  return {
    persistDir: opts.persistDir,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
  };
}

function appWorkflowRuntimePaths(
  opts: TaskDefinitionSource,
  descriptor: { appDir: string },
  agentName: string,
): {
  agentsRoot: string;
  workflowDir: string;
  guardsDir: string;
  sharedGuardsDir: string;
} {
  const runtime = requireWorkflowRuntimeOptions(opts);
  const sourceAppDir = join(opts.projectsRoot, basename(descriptor.appDir));
  const appAgentDir = localAgentDir(sourceAppDir, agentName);
  const globalAgentDir = join(runtime.agentsRoot, agentName);
  const agentDir = appAgentDir ?? globalAgentDir;
  return {
    agentsRoot: appAgentDir ? join(sourceAppDir, "agents") : runtime.agentsRoot,
    workflowDir: join(agentDir, "workflows"),
    guardsDir: join(agentDir, "guards"),
    sharedGuardsDir: join(runtime.sharedRoot, "guards"),
  };
}

async function executeTaskCapability(
  input: TaskWorkflowInput,
  manager: SubagentManager,
  bus: EventBus,
  definitions: ReadonlyMap<string, SubagentDefinition> | undefined,
): Promise<TaskCapabilityRun> {
  const opts = input.source;
  const { descriptor, capability, intent, claim, event } = input;
  const reconciliationEvents = input.attempt.events;
  const runtime = requireWorkflowRuntimeOptions(opts);
  const agentName = capability.agent ?? claim.agent;
  const trace = childEventTrace(event);
  const paths = appWorkflowRuntimePaths(opts, descriptor, agentName);
  const task = [
    capability.task,
    `app: ${descriptor.appDir}`,
    `project: ${descriptor.projectDir}`,
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        resourceVersion: claim.resourceVersion,
        agent: claim.agent,
        handler: claim.handler,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: projectAppTaskChildPromptContext(input.childContext),
        waits: input.attempt.waits,
        paths: input.executionPaths,
        declaredOutputs: input.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(reconciliationEvents.items.length
      ? ["", "## New Events", "```json", JSON.stringify(reconciliationEvents, null, 2), "```"]
      : []),
  ].join("\n");

  bus.emit({
    type: "handler.workflow_dispatched",
    source: `agent:${agentName}`,
    owner: `agent:${claim.agent}`,
    target: { appId: descriptor.id },
    data: {
      handler: claim.handler,
      workflow: capability.workflow,
      source: agentName,
      projectId: descriptor.id,
      recoveryOwner: APP_TASK_RECOVERY_OWNER,
      taskId: claim.taskId,
      taskGeneration: claim.generation,
      workflowRunId: null,
      status: "started",
    },
    ...(trace ? { trace } : {}),
  } as AgentEvent);

  let providerStarted = false;
  try {
    const runtimeCtx = buildRuntimeCtx({
      bus: bus,
      persistDir: runtime.persistDir,
      projectRoot: opts.projectRoot,
      agentsRoot: paths.agentsRoot,
      sharedRoot: runtime.sharedRoot,
      projectsRoot: opts.projectsRoot,
      agentName,
    });
    input.observer?.providerStarted(Buffer.byteLength(task));
    providerStarted = true;
    const { result, runId, verifier } = await runWorkflowDirect({
      workflowName: capability.workflow,
      task,
      manager,
      agentDefinitions: definitions,
      runtimeCtx,
      read: createRuntimeAppRead({
        getDb: runtimeCtx.getDb,
        metrics: runtimeCtx.metrics,
        taskRead: input.taskRead,
      }),
      agentName,
      persistDir: runtime.persistDir,
      workflowDir: paths.workflowDir,
      guardsDir: paths.guardsDir,
      sharedGuardsDir: paths.sharedGuardsDir,
      projectId: descriptor.id,
      taskBinding: {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        attemptId: claim.attemptId,
      },
      recoveryOwner: APP_TASK_RECOVERY_OWNER,
      taskEmitter: input.taskEvents,
      trace,
      executionPaths: input.executionPaths,
      workflowInput: intent.input ?? {},
      reconciliation: {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        resourceVersion: claim.resourceVersion,
        agent: claim.agent,
        owner: claim.agent,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: {
          live: input.childContext.live.map(({ phase, ...child }) => ({
            ...child,
            status: phase === "converged" ? "done" : phase,
          })),
          completed: input.childContext.completed.map((child) => ({
            ...child,
            status: "done" as const,
          })),
        },
        taskSnapshot: {
          live: input.taskSnapshot.live.map(({ phase, ...task }) => ({
            ...task,
            status: phase === "converged" ? "done" : phase,
          })),
          truncated: input.taskSnapshot.truncated,
        },
        events: reconciliationEvents,
      },
      executionTimeoutMs: input.executionTimeoutMs,
      signal: input.attempt.signal,
    });
    const done = result.type === "done";
    const summary = done ? result.summary : result.reason;
    const handlerResult = normalizeTaskHandlerResult(
      done ? result.output : undefined,
      {
        type: done ? "done" : "blocked",
        summary,
        runId,
      },
      {
        allowNeedsAgent: true,
        defaultParentId: input.defaultParentId,
        rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
        validateAction: input.descriptor.app.tasks?.validateAction,
        validateCondition: input.descriptor.app.tasks?.validateCondition,
      },
    );
    // A deliberate blocker is not a transport retry, but its diagnostic
    // context must remain visible to the same Task and its parent. Keep one
    // bounded evidence entry; the full context remains on the workflow run.
    if (result.type === "blocked" && result.context !== undefined) {
      const context = JSON.stringify(result.context);
      handlerResult.evidence.push(
        Buffer.byteLength(context, "utf8") <= 8192
          ? `workflow-blocker-context:${context}`
          : `workflow-blocker-context:see workflow-run:${runId} (exceeds 8192-byte Task evidence bound)`,
      );
    }
    bus.emit({
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${claim.agent}`,
      target: { appId: descriptor.id },
      data: {
        handler: claim.handler,
        workflow: capability.workflow,
        source: agentName,
        projectId: descriptor.id,
        taskId: claim.taskId,
        taskGeneration: claim.generation,
        workflowRunId: runId,
        status: done ? "done" : "blocked",
        disposition: handlerResult.state,
        ...(done ? { summary } : { reason: summary }),
      },
      ...(trace ? { trace } : {}),
    } as unknown as AgentEvent);
    return {
      handlerResult,
      runId,
      ...(!done ? { handlerBlocked: true as const } : {}),
      ...(verifier
        ? {
            verifier: {
              ...verifier,
              verify: verifier.verify as AppTaskVerifier,
            },
          }
        : {}),
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
    const unavailable = error instanceof WorkflowHandlerUnavailable;
    bus.emit({
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${claim.agent}`,
      target: { appId: descriptor.id },
      data: {
        handler: claim.handler,
        workflow: capability.workflow,
        source: agentName,
        projectId: descriptor.id,
        taskId: claim.taskId,
        taskGeneration: claim.generation,
        workflowRunId: null,
        status: "blocked",
        reason: summary,
      },
      ...(trace ? { trace } : {}),
    } as unknown as AgentEvent);
    return {
      handlerResult: {
        state: "error",
        summary,
        evidence: [],
        actions: [],
      },
      runId: null,
      ...(unavailable ? { unavailable: true } : {}),
      ...(!unavailable ? { executionFailed: true } : {}),
    };
  } finally {
    if (providerStarted) input.observer?.providerFinished();
  }
}
