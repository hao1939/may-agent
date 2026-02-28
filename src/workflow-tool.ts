import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { SubagentManager } from "./manager.js";
import type { TaskResult } from "./types.js";
import type {
  WorkflowContext,
  WorkflowModule,
  WorkflowEvent,
  WorkflowToolResult,
  CompletedStep,
} from "./workflow.js";
import { WorkflowInterrupted } from "./workflow.js";

// ── Tool schema ────────────────────────────────────────────────────────

const WorkflowToolParams = Type.Union([
  Type.Object({
    action: Type.Literal("list"),
  }),
  Type.Object({
    action: Type.Literal("run"),
    name: Type.String({ description: "Workflow name to execute" }),
    task: Type.String({ description: "Task to pass to the workflow" }),
  }),
]);

// ── Helpers ────────────────────────────────────────────────────────────

let importCounter = 0;

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

async function loadWorkflow(filePath: string): Promise<WorkflowModule> {
  // Cache-bust to pick up edits
  const mod = await import(filePath + "?t=" + (++importCounter));
  if (typeof mod.name !== "string") {
    throw new Error(`Workflow file ${filePath} must export a 'name' string`);
  }
  if (typeof mod.execute !== "function") {
    throw new Error(`Workflow file ${filePath} must export an 'execute' function`);
  }
  return {
    name: mod.name,
    description: mod.description ?? "(no description)",
    execute: mod.execute,
  };
}

function listWorkflowFiles(workflowDir: string): string[] {
  try {
    return readdirSync(workflowDir)
      .filter((f) => f.endsWith(".ts"))
      .sort()
      .map((f) => join(workflowDir, f));
  } catch {
    return []; // directory doesn't exist yet
  }
}

// ── WorkflowTool type ──────────────────────────────────────────────────

/**
 * Extended AgentTool returned by createWorkflowTool.
 * Includes a steer() method for routing steering signals into running workflows.
 */
export interface WorkflowTool extends AgentTool<typeof WorkflowToolParams> {
  /**
   * Push a steering signal into the currently running workflow.
   * The next ctx.runAgent() call will check the queue and throw
   * WorkflowInterrupted, returning the agent to slow mode.
   *
   * @returns true if a workflow is currently running and the signal was queued,
   *          false if no workflow is active.
   */
  steer(message: string): boolean;

  /**
   * Whether a workflow is currently executing.
   */
  readonly isRunning: boolean;

  /**
   * The name of the currently running workflow, or null if none.
   */
  readonly activeWorkflow: string | null;
}

// ── createWorkflowTool ─────────────────────────────────────────────────

export interface WorkflowToolOptions {
  /** The SubagentManager to use for running sub-agents inside workflows. */
  manager: SubagentManager;
  /** Path to the agent's workflows/ directory. */
  workflowDir: string;
  /** Optional callback for workflow events. */
  onEvent?: (event: WorkflowEvent) => void;
}

/**
 * Create a WorkflowTool that lets an agent list and run workflows.
 *
 * - `list`: scan the workflowDir, return names + descriptions
 * - `run`: load a workflow by name, build a WorkflowContext, execute it
 *
 * The returned tool has a `steer(message)` method that pushes steering
 * signals into the active workflow's queue. The workflow checks this
 * queue before each `ctx.runAgent()` call and throws WorkflowInterrupted
 * if a signal is present, returning the agent to slow mode.
 */
export function createWorkflowTool(opts: WorkflowToolOptions): WorkflowTool {
  const { manager, workflowDir, onEvent } = opts;

  // Shared state: the steering queue for the currently running workflow.
  // Only one workflow runs at a time per tool instance.
  let activeSteeringQueue: string[] | null = null;
  let activeWorkflowName: string | null = null;

  const tool: WorkflowTool = {
    name: "workflow",
    label: "Workflow",
    description:
      "List available workflows or run a workflow by name. " +
      "Workflows are predefined step sequences that coordinate sub-agents efficiently. " +
      "Use 'list' to see what's available, 'run' to execute one.",
    parameters: WorkflowToolParams,

    steer(message: string): boolean {
      if (!activeSteeringQueue) return false;
      activeSteeringQueue.push(message);
      return true;
    },

    get isRunning(): boolean {
      return activeSteeringQueue !== null;
    },

    get activeWorkflow(): string | null {
      return activeWorkflowName;
    },

    execute: async (_toolCallId, params) => {
      switch (params.action) {
        case "list": {
          const files = listWorkflowFiles(workflowDir);
          const workflows: Array<{ name: string; description: string }> = [];

          for (const filePath of files) {
            try {
              const wf = await loadWorkflow(filePath);
              workflows.push({ name: wf.name, description: wf.description });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              workflows.push({ name: filePath, description: `(load error: ${msg})` });
            }
          }

          const result: WorkflowToolResult = { type: "list", workflows };
          return textResult(JSON.stringify(result, null, 2));
        }

        case "run": {
          // Find the workflow file by name
          const files = listWorkflowFiles(workflowDir);
          let workflow: WorkflowModule | null = null;
          let loadError: string | null = null;

          for (const filePath of files) {
            try {
              const wf = await loadWorkflow(filePath);
              if (wf.name === params.name) {
                workflow = wf;
                break;
              }
            } catch (err) {
              loadError = err instanceof Error ? err.message : String(err);
            }
          }

          if (!workflow) {
            const msg = loadError
              ? `Workflow "${params.name}" not found (load error: ${loadError})`
              : `Workflow "${params.name}" not found`;
            return textResult(JSON.stringify({ type: "error", workflow: params.name, error: msg }));
          }

          // Build the context
          const completedSteps: CompletedStep[] = [];
          const steeringQueue: string[] = [];

          // Register this queue as the active one for steer() calls
          activeSteeringQueue = steeringQueue;
          activeWorkflowName = workflow.name;

          const ctx: WorkflowContext = {
            task: params.task,

            runAgent: async (agentName: string, agentTask: string): Promise<TaskResult> => {
              // Check steering before starting the step
              const steering = steeringQueue.shift();
              if (steering) {
                throw new WorkflowInterrupted(steering, completedSteps);
              }

              const sid = manager.run(agentName, agentTask);
              const stepStartEvent: WorkflowEvent = { type: "step_start", step: agentName, sessionId: sid };
              onEvent?.(stepStartEvent);

              const result = await manager.waitFor(sid);
              const taskResult = result!;

              const step: CompletedStep = { step: agentName, sessionId: sid, result: taskResult };
              completedSteps.push(step);

              const stepDoneEvent: WorkflowEvent = { type: "step_done", step: agentName, sessionId: sid, result: taskResult };
              onEvent?.(stepDoneEvent);

              // Check steering again after the step completes
              // (signal may have arrived while sub-agent was running)
              const steeringAfter = steeringQueue.shift();
              if (steeringAfter) {
                throw new WorkflowInterrupted(steeringAfter, completedSteps);
              }

              return taskResult;
            },

            emit: (event: WorkflowEvent) => {
              onEvent?.(event);
            },

            done: (summary: string) => ({ type: "done" as const, summary }),
            escalate: (reason: string, context?: unknown) => ({ type: "escalate" as const, reason, context }),
          };

          // Execute
          onEvent?.({ type: "workflow_start", workflow: workflow.name, task: params.task });

          try {
            const result = await workflow.execute(ctx);

            // Clear active state
            activeSteeringQueue = null;
            activeWorkflowName = null;

            if (result.type === "done") {
              onEvent?.({ type: "workflow_done", summary: result.summary });
              const toolResult: WorkflowToolResult = { type: "done", workflow: workflow.name, summary: result.summary };
              return textResult(JSON.stringify(toolResult, null, 2));
            }

            // Escalated
            onEvent?.({ type: "workflow_escalate", reason: result.reason });
            const toolResult: WorkflowToolResult = {
              type: "escalated",
              workflow: workflow.name,
              reason: result.reason,
              context: result.context,
            };
            return textResult(JSON.stringify(toolResult, null, 2));
          } catch (err) {
            // Clear active state on any exit path
            activeSteeringQueue = null;
            activeWorkflowName = null;

            if (err instanceof WorkflowInterrupted) {
              const toolResult: WorkflowToolResult = {
                type: "interrupted",
                workflow: workflow.name,
                completedSteps: err.completedSteps,
                steeringMessage: err.steeringMessage,
              };
              return textResult(JSON.stringify(toolResult, null, 2));
            }

            // Workflow code itself crashed
            const msg = err instanceof Error ? err.message : String(err);
            const toolResult: WorkflowToolResult = { type: "error", workflow: workflow.name, error: msg };
            return textResult(JSON.stringify(toolResult, null, 2));
          }
        }

        default: {
          const _exhaustive: never = params;
          return textResult(JSON.stringify({ error: "Unknown action" }));
        }
      }
    },
  };

  return tool;
}
