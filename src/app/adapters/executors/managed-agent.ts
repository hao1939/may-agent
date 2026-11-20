import type { TaskAttempt } from "@may-agent/sdk/app";
import {
  admitTaskResultForSchema,
  taskAgentResultSchema as appTaskAgentResultSchema,
} from "@may-agent/sdk/app";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { createFinishTool } from "@may-agent/sdk/runtime";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { resolvedExecutionRecipient } from "../../../lib/execution-recipient.js";
import type { SubagentManager } from "../../../lib/manager.js";
import type { SubagentDefinition } from "@may-agent/sdk/runtime";
import { childEventTrace } from "../../core/events/bus.js";
import { projectAppTaskChildPromptContext } from "../../core/tasks/app-task-context.js";
import type { TaskAgentInput, TaskAgentRunner } from "../../core/tasks/execution.js";
import { normalizeTaskHandlerResult, type TaskCapabilityRun } from "../../core/tasks/result.js";
import { APP_TASK_RECOVERY_OWNER } from "../../core/tasks/session-binding.js";
import { localAgentDir } from "../discovery/local-agents.js";
import { captureAgentDefinitions } from "./agent-definitions.js";
import { translateHostedBlockedContribution } from "./hosted-result-settlement.js";
import {
  applyCanonicalAgentResidueCleanup,
  beginCanonicalAgentResidueGuard,
  planCanonicalAgentResidueCleanup,
  rejectConvergedDirectAgentResidue,
} from "./agent-workspace.js";
import { taskExecutionContext } from "./task-context.js";

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function capturedAgentDefinition(
  definitions: ReadonlyMap<string, SubagentDefinition> | undefined,
  agent: string,
): SubagentDefinition | undefined {
  const exact = definitions?.get(agent);
  if (exact) return exact;
  const matches = definitions ? [...definitions.values()].filter((definition) => definition.name === agent) : [];
  return matches.length === 1 ? matches[0] : undefined;
}

export function createTaskAgentRunner(
  input: {
    manager: SubagentManager;
    registerLocalAgent?: (agent: string, appDir: string, agentDir?: string) => Promise<boolean>;
  },
  definitions?: ReadonlyMap<string, SubagentDefinition>,
): TaskAgentRunner {
  return {
    ...({ persistDir: input.manager.registryStore?.persistDir } as Record<string, unknown>),
    available: (agent) => (definitions ? capturedAgentDefinition(definitions, agent) !== undefined : input.manager.hasAgent(agent)),
    executionRecipient: (agent) => {
      const definition = definitions ? capturedAgentDefinition(definitions, agent) : input.manager.getAgentDefinition(agent);
      return definition ? resolvedExecutionRecipient(definition) : null;
    },
    async prepare({ source, appId, appDir, agent }) {
      const executor = agent.includes("/") ? agent : `${appId}/${agent}`;
      if (input.manager.hasAgent(executor)) return true;
      const localName = agent.includes("/") ? agent.slice(agent.indexOf("/") + 1) : agent;
      const dir = localAgentDir(join(source.projectsRoot, basename(appDir)), localName);
      if (input.registerLocalAgent) await input.registerLocalAgent(localName, appDir, dir);
      return input.manager.hasAgent(executor);
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
  const definition = capturedAgentDefinition(definitions, agent);
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

function createManagedTaskFinish(input: TaskAgentInput): AgentTool {
  const base = createFinishTool({ projectRoot: input.executionPaths.workspaceDir });
  const managedOutputSchema = Type.Union([
    Type.Unsafe({
      ...structuredClone(appTaskAgentResultSchema),
      description: "Required when status is done: the canonical Task attempt result.",
    }),
    Type.Unknown({
      description: "When status is blocked, unrestricted domain checkpoint output; it is not a Task decision.",
    }),
  ], {
    description:
      "For status=done, return the canonical Task attempt result. For status=blocked, any domain checkpoint output is allowed.",
  });
  const parameters = Type.Object(
    {
      status: Type.Union([Type.Literal("done"), Type.Literal("blocked")], {
        description: "done requires canonical Task output; blocked retains unrestricted checkpoint output.",
      }),
      summary: Type.String({ pattern: "\\S" }),
      output: Type.Optional(managedOutputSchema),
      facts: Type.Optional(Type.Unknown()),
    },
    { additionalProperties: false },
  );
  return {
    ...base,
    description:
      `${base.description} Done output must satisfy the Task result contract; blocked output remains domain checkpoint data.`,
    parameters,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const raw = (params && typeof params === "object" && !Array.isArray(params) ? params : {}) as Record<
        string,
        unknown
      >;
      const isFlatTaskResult =
        raw.status === undefined &&
        typeof raw.state === "string" &&
        ["waiting", "converged", "incomplete"].includes(raw.state);
      const report = isFlatTaskResult
        ? {
            status: "done" as const,
            summary: typeof raw.summary === "string" ? raw.summary : "",
            output: raw,
          }
        : (raw as { status?: unknown; output?: unknown });
      if (report.status === "done") {
        const schemaAdmission = admitTaskResultForSchema(appTaskAgentResultSchema, report.output);
        if (!schemaAdmission?.ok) {
          return {
            content: [{
              type: "text" as const,
              text: `finish() error: ${schemaAdmission?.error ?? "Done output must satisfy the Task result contract"}`,
            }],
            details: undefined,
          };
        }
        const admitted = normalizeTaskHandlerResult(
          schemaAdmission.result,
          { type: "done", summary: "", runId: null },
          {
            validateAction: input.descriptor.app.tasks?.validateAction,
            validateCondition: input.descriptor.app.tasks?.validateCondition,
          },
        );
        const problem = admitted.resultRejected
          ? admitted.summary
          : (input.validateResult?.(admitted as import("@may-agent/sdk/app").TaskReconcileResult) ?? null);
        if (problem) {
          return { content: [{ type: "text" as const, text: `finish() error: ${problem}` }], details: undefined };
        }
      }
      return base.execute(toolCallId, report, signal, onUpdate);
    },
  };
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
    ...(attempt.events.communication?.length
      ? [
          "This Task handles communication through saved input context. Use communication changes in finish() to publish a message, accept/refine an ask, or record its disposition. Select inputId from events.inputs; infra retains the recipient and delivery route. Keep the original human promise when requesting a contribution from another Task. A message does not imply fulfillment or convergence: use ordinary waiting/continue/requests/Conditions while work remains. Request records alone do not schedule execution. Keep background work quiet unless a useful message is owed. Read every assigned Request in events.communication before working. Close a Request only with its own explanation and evidence. An open Request requires continuing work or a real wait, and prevents convergence. Use requests plus request Conditions to commission independent work and receive its result; the original human promise stays here.",
        ]
      : []),
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
          "Choose the accountable App by responsibility. These are the currently installed App request targets:",
          "```json",
          JSON.stringify(dependencyCatalog, null, 2),
          "```",
        ]
      : []),
    ...(reconciliationEvents.items.length || reconciliationEvents.continuedInputs?.length
      ? ["", "## Assigned Attempt Input", "```json", JSON.stringify(reconciliationEvents, null, 2), "```"]
      : []),
  ].join("\n");

  const taskContext = taskExecutionContext(input, definitions);
  const admissionOptions = {
    validateAction: input.descriptor.app.tasks?.validateAction,
    validateCondition: input.descriptor.app.tasks?.validateCondition,
  };
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
    createFinish: () => createManagedTaskFinish(input),
    toolPolicy: "full" as const,
    timeout: input.executionTimeoutMs,
    executionRoot: input.executionPaths.workspaceDir,
  };
  const definition = capturedAgentDefinition(definitions, attempt.role.agent);
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
  if (done && result.finishResult?.status === "blocked") {
    return translateHostedBlockedContribution(input, {
      summary:
        firstNonEmptyString(result.finishResult.summary, result.lastAssistantText, result.error) ??
        `Agent session ${result.sessionId || "unknown"} returned no blocker summary`,
      output: result.finishResult.output,
      facts: result.finishResult.facts,
      runId: result.sessionId || null,
    });
  }
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
      admissionOptions,
    ),
    restoredAgentResidue,
  );
  return {
    handlerResult,
    runId: result.sessionId || null,
    ...(!done ? { executionFailed: true } : {}),
  };
}
