import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { taskAgentResultSchema as appTaskAgentResultSchema } from "@may-agent/sdk";
import type { TaskAttempt } from "@may-agent/sdk";
import type { SubagentManager } from "../../../lib/index.js";
import type { SubagentDefinition } from "../../../lib/types.js";
import { projectAppTaskChildPromptContext } from "../../core/tasks/app-task-context.js";
import { APP_TASK_RECOVERY_OWNER } from "../../core/tasks/session-binding.js";
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
  "When a New Event contains an App request with a supplied dependency observation, treat that exact read-only observation (kind, id, status, summary, facts, response, and result when present) as complete authority for the dependency in this attempt. Decide from it or preserve the responsible App and exact Task boundary; do not inspect Host-private task state, generated task-tree or Kanban projections, or substitute a deeper or different task. This restriction is request-scoped and does not weaken supported diagnostics when no dependency observation was supplied.";

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
    "Keep working through needed turns and tool calls toward the current input's outcome, using the Task goal, acceptance and facts. Do not edit Host task storage.",
    "Finish exactly once with finish().result when current work has an answer, a meaningful wait, or an honest failure report. This ends the attempt, not the Task. The tool schema is authoritative.",
    "Return state converged only when facts support the answer or completed work for the input considered. Include a direct response when a caller is owed one. An unrelated open child does not prevent an answer.",
    "Return state incomplete to report that this attempt could not finish the work. Include facts, partial work and unresolved effects; no actions, Conditions or dependencies. Set report:true for a new caller-relevant update after an earlier report; omit for unchanged failures. The assignment remains pending for another paced attempt. Only its assigning owner can revise or close it.",
    "Do not finish merely because one useful step or model turn ended.",
    "Put machine-readable domain decisions in result; explain them in summary. A waiting Task may retain a decision for later review.",
    "Return state waiting for a saved wait, new exact Condition or typed App dependency. Omit unchanged waits; code retains them. Omit response. Set report:true with summary and facts for a new caller-relevant blocker or update; omit for quiet waits.",
    "For another Task's work, return a stable dependency { id, appId, input }. Your App may own it. Add taskId to continue an exact Task. Runtime publishes and correlates it; do not publish app.input.requested yourself.",
    "Choose appId and input.kind from the Installed App catalog in this prompt. Satisfy its requiredData paths and fixedData literals, use dataTypes for any listed field, describe the desired outcome, constraints, and acceptance proof in input.data, and leave Task, workflow, executor, schedule, retry, and session choices to that App.",
    "Parent links organize work and scope reads/actions; they do not block execution or subscribe to child outcomes. Use typed dependencies when an answer is required.",
    "Delegate useful independent work with clear acceptance. Feedback returns while its Task stays open; other input can be answered meanwhile. dependsOn gates all execution: do not use it for follow-up.",
    "app.dependency.updated: blocked reports a waiting update or failure, not an answer; its wait stays open. Execution errors are facts, not accepted results. Open Waits retains the latest selected report; repeated errors stay in history. done returns the exact answer or owner closure.",
    "Task actions only update or unblock existing Tasks, using the schema, expected generations, and real task IDs. Do not mutate the current task with an action; your result advances it. Accepted outcomes remain facts; closure is a separate owner control.",
    "Keep facts concise and include the artifact/session paths needed to inspect the result. Code handles persistence, scheduling and result return; do not poll merely to keep follow-through alive.",
    "A Condition records a wait for a known fact; requestedAction does not contact its owner or perform that action. reviewAfterMs schedules reconsideration, not a notification or repair.",
    "Treat feedback as input: preferences, corrections, or claims to verify. Address the human's concern using this Task's goal, observed facts and Open Waits. Existing obligations remain; create different work only for a changed goal.",
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
        outcome: task.outcome,
        acceptance: task.acceptance,
        input: task.input ?? {},
        children: projectAppTaskChildPromptContext(input.childContext),
        waits: attempt.waits,
        paths: input.executionPaths,
        declaredOutputs: attempt.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
        ...(attempt.previousAttempt ? { previousAttempt: attempt.previousAttempt } : {}),
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
