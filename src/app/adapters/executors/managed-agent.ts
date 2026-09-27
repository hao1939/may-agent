import { taskExecutionContext } from "./task-context.js";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { taskAgentResultSchema as appTaskAgentResultSchema } from "@may-agent/sdk";
import type { TaskAttempt } from "@may-agent/sdk";
import type { SubagentManager } from "../../../lib/index.js";
import type { SubagentDefinition } from "../../../lib/types.js";
import { projectAppTaskChildPromptContext } from "../../core/tasks/app-task-context.js";
import { APP_TASK_RECOVERY_OWNER } from "../../core/tasks/session-binding.js";
import { childEventTrace } from "../../core/events/bus.js";
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
    ...(reconciliationEvents.items.length || reconciliationEvents.continuedInputs?.length
      ? ["", "## New Events", "```json", JSON.stringify(reconciliationEvents, null, 2), "```"]
      : []),
  ].join("\n");

  const taskContext = taskExecutionContext(input, definitions);
  const agentOptions = {
    taskContext,
    contextPrompt: "Pursue the assignment in the current Task decision brief and return the result required by finish().",
    taskBinding: taskContext.taskBinding,
    signal: attempt.signal,
    sessionStarted: input.sessionStarted,
    source: "app-task-agent",
    projectId: descriptor.id,
    recoveryOwner: APP_TASK_RECOVERY_OWNER,
    trace,
    requireFinish: true,
    outputSchema: appTaskAgentResultSchema,
    toolPolicy: "full" as const,
    timeout: input.executionTimeoutMs,
    executionRoot: input.executionPaths.workspaceDir,
  };
  const definition = definitions?.get(attempt.role.agent);
  const dispatchAgent = () => definition
    ? manager.callAgentDefinition(definition, prompt, agentOptions)
    : manager.callAgent(attempt.role.agent, prompt, agentOptions);
  const residueGuard = await beginCanonicalAgentResidueGuard(input.executionPaths);
  let restoredAgentResidue: string[] = [];
  let result: Awaited<ReturnType<typeof dispatchAgent>>;
  try {
    result = await dispatchAgent();
  } finally {
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
