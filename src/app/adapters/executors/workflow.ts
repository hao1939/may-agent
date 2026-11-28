import { ExecutionDeferredError } from "@may-agent/sdk/app";
import { taskExecutionContext } from "./task-context.js";
import { basename, join } from "node:path";
import type { TaskVerifier as AppTaskVerifier } from "@may-agent/sdk/app";
import type { SubagentManager } from "../../../lib/manager.js";
import type { SubagentDefinition } from "@may-agent/sdk/runtime";
import { captureAgentDefinitions } from "./agent-definitions.js";
import { buildRuntimeCtx } from "../../../lib/runtime-ctx.js";
import {
  inspectWorkflowDefinition,
  runWorkflowDirect,
  WorkflowHandlerUnavailable,
  WorkflowExecutionFailure,
} from "../../../lib/workflow-tool.js";
import { createRuntimeAppRead } from "../../core/reads/app-read.js";
import { readMetricView } from "../reporting/metric-read.js";
import { projectAppTaskChildPromptContext } from "../../core/tasks/app-task-context.js";
import { APP_TASK_RECOVERY_OWNER } from "../../core/tasks/session-binding.js";
import { EVENT_RECORD_ONLY, childEventTrace, type AgentEvent, type EventBus } from "../../core/events/bus.js";
import { normalizeTaskHandlerResult, type TaskCapabilityRun } from "../../core/tasks/result.js";
import type { TaskDefinitionSource, TaskWorkflowInput, TaskWorkflowRunner } from "../../core/tasks/execution.js";
import { getWorkflowRun } from "../../../lib/db/workflows.js";
import { localAgentDir } from "../discovery/local-agents.js";
import { translateHostedBlockedContribution, translateHostedExecutionResult } from "./hosted-result-settlement.js";

const MAX_INLINE_WORKFLOW_FACT_BYTES = 8192;

type WorkflowFactsStorage = { facts: unknown; projected: boolean };

function workflowFactsForTaskStorage(facts: unknown, runId: string): WorkflowFactsStorage {
  let bytes: number;
  if (
    Array.isArray(facts)
    && facts.length < 32
    && facts.every((fact) => typeof fact === "string" && fact.trim().length > 0)
  ) {
    bytes = facts.reduce((total, fact) => total + Buffer.byteLength(fact, "utf8"), 0);
  } else {
    try {
      bytes = Buffer.byteLength(JSON.stringify(facts), "utf8");
    } catch {
      bytes = Buffer.byteLength("[unserializable]", "utf8");
    }
  }
  if (bytes <= MAX_INLINE_WORKFLOW_FACT_BYTES) return { facts, projected: false };
  return {
    facts: [`workflow-contribution-facts:see workflow-run:${runId} (exceeds 8192-byte Task facts bound)`],
    projected: true,
  };
}

function workflowRunRetainsFacts(persistDir: string, runId: string): boolean {
  const payload = getWorkflowRun(persistDir, runId)?.result_payload;
  if (!payload || payload.state !== "available") return false;
  if (payload.kind === "facts") return true;
  return payload.kind === "result"
    && payload.value !== null
    && typeof payload.value === "object"
    && Object.hasOwn(payload.value, "facts");
}

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
    execute: (attempt) => executeTaskWorkflow(attempt, input.manager, input.bus, definitions),
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

const EXPLICIT_RECONCILE_KEYS = new Set([
  "state",
  "summary",
  "facts",
  "result",
  "response",
  "conditions",
  "requests",
  "actions",
  "communication",
  "inputKeys",
  "acceptedLiveEventIds",
  "reviewAt",
  "report",
  "continue",
  "acceptanceBasis",
]);

function appWorkflowRuntimePaths(
  opts: TaskDefinitionSource,
  descriptor: { appDir: string },
  agentName: string,
): {
  agentsRoot: string;
  workflowDir: string;
} {
  const runtime = requireWorkflowRuntimeOptions(opts);
  const sourceAppDir = join(opts.projectsRoot, basename(descriptor.appDir));
  const appAgentDir = localAgentDir(sourceAppDir, agentName);
  const globalAgentDir = join(runtime.agentsRoot, agentName);
  const agentDir = appAgentDir ?? globalAgentDir;
  return {
    agentsRoot: appAgentDir ? join(sourceAppDir, "agents") : runtime.agentsRoot,
    workflowDir: join(agentDir, "workflows"),
  };
}

async function executeTaskWorkflow(
  input: TaskWorkflowInput,
  manager: SubagentManager,
  bus: EventBus,
  definitions: ReadonlyMap<string, SubagentDefinition> | undefined,
): Promise<TaskCapabilityRun> {
  const opts = input.source;
  const { descriptor, capability, attempt, event } = input;
  const taskDetail = attempt.task;
  const reconciliationEvents = attempt.events;
  const runtime = requireWorkflowRuntimeOptions(opts);
  const agentName = capability.agent ?? attempt.role.agent;
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
        taskId: taskDetail.id,
        generation: taskDetail.generation,
        resourceVersion: attempt.resourceVersion,
        agent: attempt.role.agent,
        handler: input.handler,

        outcome: taskDetail.outcome,
        acceptance: taskDetail.acceptance,
        input: taskDetail.input ?? {},
        children: projectAppTaskChildPromptContext(input.childContext),
        waits: attempt.waits,
        paths: input.executionPaths,
        declaredOutputs: attempt.declaredOutputPaths,
        ...(attempt.previousAttempt ? { previousAttempt: attempt.previousAttempt } : {}),
      },
      null,
      2,
    ),
    "```",
    ...(reconciliationEvents.items.length || reconciliationEvents.continuedInputs?.length
      ? ["", "## Assigned Attempt Input", "```json", JSON.stringify(reconciliationEvents, null, 2), "```"]
      : []),
  ].join("\n");

  bus.emit({
    [EVENT_RECORD_ONLY]: true,
    type: "handler.workflow_dispatched",
    source: `agent:${agentName}`,
    owner: `agent:${attempt.role.agent}`,
    target: { appId: descriptor.id },
    data: {
      handler: input.handler,
      workflow: capability.workflow,
      source: agentName,
      projectId: descriptor.id,
      recoveryOwner: APP_TASK_RECOVERY_OWNER,
      taskId: taskDetail.id,
      taskGeneration: taskDetail.generation,
      workflowRunId: null,
      status: "started",
    },
    ...(trace ? { trace } : {}),
  } as AgentEvent);

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
    const taskContext = taskExecutionContext(input, definitions);
    const attemptCountRow = runtimeCtx
      .getDb()
      .prepare(
        "SELECT COUNT(*) AS n FROM app_task_attempts WHERE app_id = ? AND task_id = ? AND task_generation = ?",
      )
      .get(descriptor.id, taskDetail.id, taskDetail.generation) as { n?: number } | null;
    const attemptNumber = Math.max(1, Number(attemptCountRow?.n ?? 1));
    const { result, runId, verifier } = await runWorkflowDirect({
      workflowName: capability.workflow,
      task,
      manager,
      agentDefinitions: definitions,
      runtimeCtx,
      read: createRuntimeAppRead({
        readContract: attempt.read.contract,
        getDb: runtimeCtx.getDb,
        persistDir: runtime.persistDir,
        readMetric: async (id) => readMetricView(runtimeCtx.metrics, id),
        taskRead: attempt.read.tasks,
      }),
      agentName,
      persistDir: runtime.persistDir,
      workflowDir: paths.workflowDir,
      projectId: descriptor.id,
      attemptNumber,
      ...taskContext,
      taskContext,
      trace,
      workflowInput: { prompt: task, data: taskDetail.input ?? {} },
      executionTimeoutMs: input.executionTimeoutMs,
      executionTimeoutLimitMs: input.executionTimeoutLimitMs,
      signal: attempt.signal,
    });
    const done = result.type === "done";
    const summary = done ? result.summary : result.reason;
    const storedWorkflowFacts = workflowFactsForTaskStorage(result.facts, runId);
    const missingProjectedFacts = !done
      && storedWorkflowFacts.projected
      && !workflowRunRetainsFacts(runtime.persistDir, runId);
    const diagnosticFacts: string[] = [];
    // A deliberate blocker is not a transport retry, but its diagnostic
    // context must remain visible to the same Task and its caller. The shared
    // settlement boundary admits this evidence with the contribution facts.
    if (result.type === "blocked" && result.context !== undefined) {
      const context = JSON.stringify(result.context);
      diagnosticFacts.push(
        Buffer.byteLength(context, "utf8") <= 8192
          ? `workflow-blocker-context:${context}`
          : `workflow-blocker-context:see workflow-run:${runId} (exceeds 8192-byte Task facts bound)`,
      );
    }
    const outputRec =
      done && result.output !== null && typeof result.output === "object" && !Array.isArray(result.output)
        ? (result.output as Record<string, unknown>)
        : undefined;
    const isExplicitReconcileResult =
      done &&
      outputRec !== undefined &&
      typeof outputRec.state === "string" &&
      typeof outputRec.summary === "string" &&
      Array.isArray(outputRec.facts) &&
      Object.keys(outputRec).every((key) => EXPLICIT_RECONCILE_KEYS.has(key));
    const translatedDoneRun =
      done && !isExplicitReconcileResult
        ? translateHostedExecutionResult(
            {
              id: runId,
              status: "done",
              summary,
              ...(result.output !== undefined ? { output: result.output } : {}),
              facts:
                result.facts !== undefined && !(Array.isArray(result.facts) && result.facts.length === 0)
                  ? storedWorkflowFacts.facts
                  : [summary],
            },
            input,
          )
        : null;
    const handlerResult = done
      ? isExplicitReconcileResult
        ? normalizeTaskHandlerResult(
            result.output,
            { type: "done", summary, runId },
            {
              validateAction: input.descriptor.app.tasks?.validateAction,
              validateCondition: input.descriptor.app.tasks?.validateCondition,
            },
          )
        : translatedDoneRun!.handlerResult
      : missingProjectedFacts
        ? {
            state: "error" as const,
            resultRejected: true as const,
            summary:
              "Blocked workflow facts exceed the inline Task bound, but the combined workflow output/facts payload was not retained; return a durable artifact reference instead of oversized inline facts",
            facts: [`workflow-run:${runId}`],
            actions: [],
          }
        : translateHostedBlockedContribution(
            input,
            { summary, output: result.output, facts: result.facts, runId },
            {
              diagnosticFacts,
              storageFacts: storedWorkflowFacts.facts,
            },
          ).handlerResult;
    bus.emit({
      [EVENT_RECORD_ONLY]: true,
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${attempt.role.agent}`,
      target: { appId: descriptor.id },
      data: {
        handler: input.handler,
        workflow: capability.workflow,
        source: agentName,
        projectId: descriptor.id,
        taskId: taskDetail.id,
        taskGeneration: taskDetail.generation,
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
      ...(translatedDoneRun?.hostCompletion ? { hostCompletion: translatedDoneRun.hostCompletion } : {}),
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
    if (error instanceof ExecutionDeferredError) throw error;
    const summary = error instanceof Error ? error.message : String(error);
    const unavailable = error instanceof WorkflowHandlerUnavailable;
    const runId = error instanceof WorkflowExecutionFailure ? error.execution.id ?? null : null;
    bus.emit({
      [EVENT_RECORD_ONLY]: true,
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${attempt.role.agent}`,
      target: { appId: descriptor.id },
      data: {
        handler: input.handler,
        workflow: capability.workflow,
        source: agentName,
        projectId: descriptor.id,
        taskId: taskDetail.id,
        taskGeneration: taskDetail.generation,
        workflowRunId: runId,
        status: "blocked",
        reason: summary,
      },
      ...(trace ? { trace } : {}),
    } as unknown as AgentEvent);
    return {
      handlerResult: {
        state: "error",
        summary,
        facts: runId ? [`workflow-run:${runId}`] : [],
        actions: [],
      },
      runId,
      ...(unavailable ? { unavailable: true } : {}),
      ...(!unavailable ? { executionFailed: true } : {}),
    };
  }
}
