import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { taskAgentResultSchema as appTaskAgentResultSchema } from "@may-agent/sdk";
import type { TaskAttempt } from "@may-agent/sdk";
import type { SubagentManager } from "../../../lib/index.js";
import type { SubagentDefinition } from "../../../lib/types.js";
import { projectAppTaskChildPromptContext } from "../../app-task-context.js";
import { APP_TASK_RECOVERY_OWNER } from "../../app-task-reconciler.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import { childEventTrace, EVENT_ROW_ID, type AgentEvent } from "../../core/events/bus.js";
import { normalizeTaskHandlerResult, type TaskCapabilityRun } from "../../core/tasks/result.js";
import type { TaskAgentRunner, TaskAgentInput } from "../../core/tasks/execution.js";
import { localAgentDir } from "../discovery/local-agents.js";
import { captureAgentDefinitions } from "./agent-definitions.js";
import {
  beginCanonicalAgentResidueGuard,
  planCanonicalAgentResidueCleanup,
  applyCanonicalAgentResidueCleanup,
  rejectConvergedDirectAgentResidue,
  hasDeployReceiptWake,
  readDeployReceiptForTask,
  deployReceiptPrompt,
} from "./agent-workspace.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export function createTaskAgentRunner(
  input: {
    manager: SubagentManager;
    registerLocalAgent?: (agent: string, appDir: string, agentDir?: string) => Promise<boolean>;
  },
  definitions?: ReadonlyMap<string, SubagentDefinition>,
): TaskAgentRunner {
  return {
    available: (agent) => (definitions ? definitions.has(agent) : input.manager.hasAgent(agent)),
    async prepare({ source, appDir, agent }) {
      if (input.manager.hasAgent(agent)) return true;
      const dir = localAgentDir(join(source.projectsRoot, basename(appDir)), agent);
      return (
        (input.registerLocalAgent ? await input.registerLocalAgent(agent, appDir, dir) : false) ||
        input.manager.hasAgent(agent)
      );
    },
    role: (agent) => taskAttemptRole(definitions, agent),
    execute: (attempt) => executeTaskAgent(attempt, input.manager, definitions),
    snapshot: () => createTaskAgentRunner(input, captureAgentDefinitions(input.manager) ?? definitions),
  };
}

const MAX_TASK_ROLE_INSTRUCTIONS_BYTES = 48 * 1024;

function taskAttemptRole(
  definitions: ReadonlyMap<string, SubagentDefinition> | undefined,
  agent: string,
): TaskAttempt["role"] {
  const definition = definitions?.get(agent);
  let instructions = definition?.systemPrompt?.trim() ?? "";
  const identityPath = definition?.agentDir ? join(definition.agentDir, "AGENTS.md") : "";
  if (!instructions && identityPath && existsSync(identityPath)) {
    instructions = readFileSync(identityPath, "utf8").trim();
  }
  if (!instructions) instructions = `Act as the selected May agent ${agent}.`;
  if (Buffer.byteLength(instructions) > MAX_TASK_ROLE_INSTRUCTIONS_BYTES) {
    instructions = `${instructions.slice(0, MAX_TASK_ROLE_INSTRUCTIONS_BYTES)}\n\n[Selected agent instructions truncated by Runtime.]`;
  }
  return { agent, instructions };
}

export const DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION =
  "When a New Event contains an App request with a supplied dependency observation, treat that exact read-only observation (kind, id, status, summary, evidence, response, and result when present) as complete authority for the dependency in this attempt. Decide from it or preserve the responsible App and exact Task boundary; do not inspect Host-private task state, generated task-tree or Kanban projections, or substitute a deeper or different task. This restriction is request-scoped and does not weaken supported diagnostics when no dependency observation was supplied.";

export function hasSuppliedDependencyObservation(events: { items?: readonly unknown[] }): boolean {
  return (events.items ?? []).some((item) => {
    if (!isRecord(item) || !isRecord(item.event)) return false;
    const event = item.event;
    if (event.type !== "app.task.requested" || !isRecord(event.data) || !isRecord(event.data.request)) return false;
    return isRecord(event.data.request.dependency) && Object.keys(event.data.request.dependency).length > 0;
  });
}

/** Compact agent rules; the finish tool schema enforces field-level detail. */
export function appTaskAgentProtocol(appId: string): string {
  return [
    `You are the agent pursuing one Task goal owned by App ${appId}.`,
    "Keep working through as many internal turns and tool calls as needed to satisfy the task outcome and acceptance. Use current evidence and tools; do not edit Host task storage.",
    "Finish exactly once with finish().result only when the Task is complete or genuinely waiting for something external. The tool schema is authoritative. A successful session without result does not resolve the task.",
    "Return state converged only when current evidence satisfies this task. Include a direct response when a caller is owed one.",
    "Do not finish merely because one useful step or model turn ended.",
    "For App-defined machine-readable state or a domain decision, include result as an object; keep its human explanation in summary. A waiting Task may preserve a current decision there for its next reconciliation.",
    "Return state waiting only for an exact observable Condition, a live direct child, or a typed App dependency. Omit response while waiting; put operational progress in summary. Otherwise keep working now.",
    "For another App outcome, return a stable dependency { id, appId, input }. To continue an exact existing Task in that App, also include taskId. Runtime publishes and correlates it; do not publish app.input.requested yourself.",
    "Choose appId and input.kind from the Installed App catalog in this prompt. Satisfy its requiredData paths and fixedData literals, use dataTypes for any listed field, describe the desired outcome, constraints, and acceptance proof in input.data, and leave Task, workflow, executor, schedule, retry, and session choices to that App.",
    "Required decomposition creates direct children and keeps this task waiting. A successor is independent work after this task already converged. dependsOn expresses execution order.",
    "Task actions must use the schema, expected generations, and real task IDs. Do not mutate the current task with an action; your result advances it. Completed receipts are immutable.",
    "After first acceptance-critical evidence, checkpoint a concise summary, next step, and exact artifact/session paths. Refresh only when those facts change, then finish promptly.",
    "For unresolved human work, give an exact useful response or a bounded wait with reviewAfterMs of at least 60000. Do not expose delivery or Host internals.",
    "Treat new feedback as evidence for this Task. Address the human's actual concern against its goal and Open Waits, preserve a live relevant dependency by identity, and create different work only when the existing Task cannot fulfill the requested outcome.",
    DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION,
  ].join("\n");
}

const MAX_LIVE_TASK_EVENT_TEXT = 8 * 1024;

/** Compact live hint; the same event remains in the next durable Task batch. */
export function liveTaskEventMessage(event: AgentEvent): string {
  const projected = canonicalAppEvent(event);
  const eventId = Number((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
  const text = JSON.stringify({
    ...(Number.isSafeInteger(eventId) && eventId > 0 ? { eventId } : {}),
    event: projected,
  });
  const bounded = text.length <= MAX_LIVE_TASK_EVENT_TEXT ? text : `${text.slice(0, MAX_LIVE_TASK_EVENT_TEXT - 3)}...`;
  return [
    "A new durable event was addressed to this Task while you were working.",
    "Use it now when relevant; Runtime will also retain it for the next fenced reconciliation pass.",
    bounded,
  ].join("\n");
}

async function executeTaskAgent(
  input: TaskAgentInput,
  manager: SubagentManager,
  definitions: ReadonlyMap<string, SubagentDefinition> | undefined,
): Promise<TaskCapabilityRun> {
  const { descriptor, attempt, event } = input;
  const task = attempt.task;
  const reconciliationEvents = attempt.events;
  const trace = childEventTrace(event);
  const dependencyCatalog = input.dependencies;
  const prompt = [
    appTaskAgentProtocol(descriptor.id),
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify(
      {
        appId: descriptor.id,
        taskId: task.id,
        generation: task.generation,
        resourceVersion: attempt.resourceVersion,
        agent: attempt.role.agent,
        mode: task.mode ?? "achieve",
        outcome: task.outcome,
        acceptance: task.acceptance,
        input: task.input ?? {},
        children: projectAppTaskChildPromptContext(input.childContext),
        waits: attempt.waits,
        paths: input.executionPaths,
        declaredOutputs: attempt.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(dependencyCatalog.length
      ? [
          "",
          "## Installed Apps",
          "Choose the accountable App by responsibility. These are the currently installed typed dependency targets:",
          "```json",
          JSON.stringify(dependencyCatalog, null, 2),
          "```",
        ]
      : []),
    ...(hasDeployReceiptWake(reconciliationEvents) || readDeployReceiptForTask(input.executionPaths.projectDir, task.id)
      ? ["", ...deployReceiptPrompt(input.executionPaths.projectDir, task.id)]
      : []),
    ...(reconciliationEvents.items.length
      ? ["", "## New Events", "```json", JSON.stringify(reconciliationEvents, null, 2), "```"]
      : []),
  ].join("\n");

  const agentOptions = {
    source: "app-task-agent",
    projectId: descriptor.id,
    recoveryOwner: APP_TASK_RECOVERY_OWNER,
    trace,
    requireFinish: true,
    outputSchema: appTaskAgentResultSchema,
    toolPolicy: hasSuppliedDependencyObservation(reconciliationEvents) ? ("full-no-tasks" as const) : ("full" as const),
    timeout: input.executionTimeoutMs,
    executionRoot: input.executionPaths.workspaceDir,
  };
  const dispatchAgent = async () =>
    typeof manager.run === "function" && typeof manager.waitFor === "function" && typeof manager.progress === "function"
      ? await (async () => {
          attempt.signal.throwIfAborted();
          const definition = definitions?.get(attempt.role.agent);
          const runOptions = {
            source: agentOptions.source,
            kind: "call" as const,
            projectId: agentOptions.projectId,
            taskBinding: {
              appId: descriptor.id,
              taskId: task.id,
              generation: task.generation,
              attemptId: attempt.attemptId,
            },
            recoveryOwner: agentOptions.recoveryOwner,
            trace: agentOptions.trace,
            requireFinish: agentOptions.requireFinish,
            outputSchema: agentOptions.outputSchema,
            toolPolicy: agentOptions.toolPolicy,
            timeoutMs: agentOptions.timeout,
            executionRoot: agentOptions.executionRoot,
          };
          const sessionId = definition
            ? manager.runDefinition(definition, prompt, runOptions)
            : manager.run(attempt.role.agent, prompt, runOptions);
          input.sessionStarted(sessionId);
          const cancelSession = () => {
            try {
              manager.cancel(sessionId);
            } catch {
              // The session may finish between Task cancellation and abort.
            }
          };
          attempt.signal.addEventListener("abort", cancelSession, { once: true });
          if (attempt.signal.aborted) cancelSession();
          const unsubscribe = attempt.onEvent((incoming) => {
            try {
              const event = incoming as AgentEvent;
              manager.send(sessionId, liveTaskEventMessage(event), { trace: childEventTrace(event) });
            } catch {
              // The session may finish between event admission and this
              // optional live hint. Durable Task input remains authoritative.
            }
          });
          try {
            const waited = await manager.waitFor(sessionId);
            return {
              ...waited,
              messages: manager.progress(sessionId, 1000),
            };
          } finally {
            unsubscribe();
            attempt.signal.removeEventListener("abort", cancelSession);
          }
        })()
      : await manager.callAgent(attempt.role.agent, prompt, agentOptions);
  const residueGuard = await beginCanonicalAgentResidueGuard(input.executionPaths);
  let restoredAgentResidue: string[] = [];
  let result: Awaited<ReturnType<typeof dispatchAgent>>;
  try {
    input.observer?.providerStarted(Buffer.byteLength(prompt));
    result = await dispatchAgent();
  } finally {
    input.observer?.providerFinished();
    const cleanupPlan = await planCanonicalAgentResidueCleanup(residueGuard);
    restoredAgentResidue = await applyCanonicalAgentResidueCleanup(cleanupPlan);
  }
  const done = result.status === "done";
  const handlerResult = rejectConvergedDirectAgentResidue(
    normalizeTaskHandlerResult(
      done ? result.structuredResult : undefined,
      {
        type: done ? "done" : "blocked",
        summary:
          firstNonEmptyString(result.finishResult?.summary, result.lastAssistantText, result.error) ??
          `Agent session ${result.sessionId || "unknown"} returned no result`,
        runId: result.sessionId || null,
      },
      {
        allowNeedsAgent: false,
        defaultParentId: input.defaultParentId,
        rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
        validateAction: input.descriptor.app.tasks?.validateAction,
        validateCondition: input.descriptor.app.tasks?.validateCondition,
      },
    ),
    restoredAgentResidue,
  );
  return {
    handlerResult,
    runId: result.sessionId || null,
    ...(!done ? { executionFailed: true } : {}),
  };
}
