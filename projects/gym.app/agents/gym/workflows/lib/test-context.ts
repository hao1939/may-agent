import { join } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";

type LegacyAgentResult = {
  id?: string;
  sessionId?: string;
  kind?: "agent";
  status?: string;
  summary?: string;
  lastAssistantText?: string;
  output?: unknown;
  structuredResult?: unknown;
};

export type GymTestContextInput = Record<string, unknown> & {
  task?: string;
  projectsRoot?: string;
  appDir?: string;
  read?: WorkflowContext["read"];
  runAgent?: (
    agent: string,
    task: string,
    options?: unknown,
  ) => Promise<LegacyAgentResult>;
  emit?: (event: Record<string, unknown>) => unknown;
  dispatchEvent?: (type: string, data?: Record<string, unknown>) => unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Test-fixture compatibility only; production workflows receive typed context. */
function fencedObject(
  task: string,
  header: string,
  useLast = false,
): Record<string, unknown> {
  const headerIndex = useLast ? task.lastIndexOf(header) : task.indexOf(header);
  if (headerIndex < 0) return {};
  const fenceStart = task.indexOf("```json", headerIndex + header.length);
  if (fenceStart < 0) return {};
  const jsonStart = fenceStart + "```json".length;
  const fenceEnd = task.indexOf("```", jsonStart);
  if (fenceEnd < 0) return {};
  try {
    return record(JSON.parse(task.slice(jsonStart, fenceEnd).trim()));
  } catch {
    return {};
  }
}

function terminalStatus(value: unknown): ExecutionResult["status"] {
  return value === "blocked" || value === "error" || value === "interrupted"
    ? value
    : "done";
}

/** Converts old hand-authored fixtures into the canonical public workflow context. */
export function canonicalGymTestContext(
  input: GymTestContextInput,
): WorkflowContext & { task: string } {
  const projectsRoot = String(input.projectsRoot ?? "/tmp/projects");
  const appRoot = String(input.appDir ?? join(projectsRoot, "gym.app"));
  const projectRoot = join(projectsRoot, "gym");
  let task = String(input.task ?? "");
  const ctx = {
    input: {},
    read: input.read ?? {
      appResult: async () => null,
      tasks: {
        list: async () => ({ items: [] }),
        get: async () => null,
      },
      execution: async () => null,
      metric: async () => null,
    },
    agents: {
      call: async (agent: string, agentTask: string, options?: unknown) => {
        const result = input.runAgent
          ? await input.runAgent(agent, agentTask, options)
          : {
              status: "done",
              sessionId: "agent-test",
              lastAssistantText: "done",
            };
        if (result.id && result.kind === "agent")
          return result as ExecutionResult;
        return {
          id: String(result.sessionId ?? result.id ?? "agent-test"),
          kind: "agent" as const,
          status: terminalStatus(result.status),
          summary: String(
            result.lastAssistantText ??
              result.summary ??
              result.status ??
              "done",
          ),
          ...(result.structuredResult !== undefined
            ? { output: result.structuredResult }
            : result.output !== undefined
              ? { output: result.output }
              : {}),
        };
      },
    },
    workflows: {
      run: async () => ({
        id: "workflow-test",
        kind: "workflow" as const,
        status: "done" as const,
        summary: "done",
      }),
    },
    events: {
      emit: async (event: Record<string, unknown>) => {
        if (event.type === "message.created" && input.dispatchEvent) {
          input.dispatchEvent(event.type, record(event.data));
        } else {
          input.emit?.(event);
        }
      },
      onEvent: () => () => undefined,
    },
    metrics: input.metrics ?? {
      define() {},
      defineMany() {},
      record() {},
      evaluate: () => [],
    },
    workspace: {
      appRoot,
      projectRoot,
      root: String(input.workspaceRoot ?? appRoot),
      output: String(input.outputRoot ?? join(appRoot, ".state", "output")),
    },
    log: input.log ?? { debug() {}, info() {}, warn() {}, error() {} },
    done<T>(summary: string, output?: T): ExecutionResult<T> {
      return {
        id: "workflow-test",
        kind: "workflow",
        status: "done",
        summary,
        ...(output === undefined ? {} : { output }),
      };
    },
    blocked(reason: string, evidence?: unknown): ExecutionResult<never> {
      return {
        id: "workflow-test",
        kind: "workflow",
        status: "blocked",
        summary: reason,
        ...(evidence === undefined ? {} : { evidence }),
      };
    },
  } as WorkflowContext & { task?: string };

  const refresh = () => {
    const packet = fencedObject(task, "## Reconciliation Task");
    const authoredInput = record(packet.input);
    const rawTrigger = fencedObject(task, "## Trigger Event", true);
    const trigger = rawTrigger?.type
      ? {
          type: String(rawTrigger.type),
          data: {
            ...record(rawTrigger.data),
            ...Object.fromEntries(
              Object.entries(rawTrigger).filter(
                ([key]) =>
                  !["type", "data", "target", "source", "owner"].includes(key),
              ),
            ),
          },
          ...(rawTrigger.target ? { target: record(rawTrigger.target) } : {}),
          ...(rawTrigger.source ? { source: String(rawTrigger.source) } : {}),
          ...(rawTrigger.owner ? { owner: String(rawTrigger.owner) } : {}),
        }
      : undefined;
    const rawChildren = record(packet.children);
    const rawTaskSnapshot = record(packet.taskSnapshot);
    ctx.input = authoredInput;
    ctx.reconciliation = {
      appId: String(packet.appId ?? "gym"),
      taskId: String(packet.taskId ?? "test-task"),
      generation: Number(packet.generation ?? 1),
      resourceVersion: Number(packet.resourceVersion ?? 1),
      owner: String(packet.owner ?? "gym"),
      agent: String(packet.agent ?? "gym"),
      mode: packet.mode === "achieve" ? "achieve" : "maintain",
      outcome: String(packet.outcome ?? "Test Gym workflow"),
      acceptance: Array.isArray(packet.acceptance)
        ? packet.acceptance.map(String)
        : ["Test expectation passes"],
      input: authoredInput,
      children: {
        live: Array.isArray(rawChildren.live)
          ? (rawChildren.live as never[])
          : [],
        completed: Array.isArray(rawChildren.completed)
          ? (rawChildren.completed as never[])
          : [],
      },
      taskSnapshot: {
        live: Array.isArray(rawTaskSnapshot.live)
          ? (rawTaskSnapshot.live as never[])
          : [],
        truncated: rawTaskSnapshot.truncated === true,
      },
      events: {
        items: trigger
          ? [
              {
                observedAt: "2026-01-01T00:00:00.000Z",
                event: trigger,
              },
            ]
          : [],
        truncated: false,
      },
    };
  };
  Object.defineProperty(ctx, "task", {
    get: () => task,
    set: (value: unknown) => {
      task = String(value ?? "");
      refresh();
    },
    enumerable: false,
  });
  refresh();
  return ctx as WorkflowContext & { task: string };
}
