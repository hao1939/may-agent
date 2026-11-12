/**
 * Host-free direct workflow runner for Gym, CLI debugging, and standalone runs.
 *
 * Composes the portable workflow invocation kernel with `runDirectAgent` and
 * `buildWorkflowCatalog`. Intentionally constructs no SQLite database,
 * EventBus, SubagentManager, schedule, or daemon state.
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type, type TSchema } from "typebox";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  AgentCallOptions,
  AppRead,
  TaskDetail,
  WorkflowContext,
} from "@may-agent/sdk";
import { createTestAppRead } from "@may-agent/sdk/testing";
import {
  WorkflowUnconfirmedCleanupError,
  createWorkflowAllowance,
  runWorkflowInvocation,
  type NormalizedWorkflowContribution,
  type WorkflowExecutableModule,
  type WorkflowExecutionAllowance,
  type WorkflowKernelOutcome,
  type WorkflowLogEntry,
  type WorkflowRunReport,
  type WorkflowStepInvocationResult,
  type WorkflowStepTrace,
} from "../../packages/sdk/src/workflow-kernel.js";
import { agentExecutionResult } from "../lib/execution-handoff.js";
import type { ModelWithApiKey, TaskResult } from "../lib/types.js";
import { buildWorkflowCatalog, findWorkflow } from "../lib/workflow-catalog.js";
import { validateOperationAllowance } from "../lib/workflow-finish-recovery.js";
import { readAgentConfigFile } from "./loader/agent-config.js";
import { resolveRuntimeAgentDirectory } from "./loader/agent-discovery.js";
import {
  runDirectAgent,
  type DirectAgentRunOptions,
  type DirectAgentRunResult,
  type ToolDenial,
} from "./direct-agent.js";

export const DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS = 4;
export const DEFAULT_DIRECT_WORKFLOW_MAX_DEPTH = 3;

const DIRECT_HOST_TOOL_DENIALS: Readonly<Record<string, string>> = {
  agents: "isolated direct workflow runs do not dispatch hosted supporting agents",
  workflow: "nested agent steps do not expose hosted workflow dispatch unless explicitly enabled",
  message: "isolated direct workflow runs must not notify real users or agents",
  cron: "isolated direct workflow runs must not change autonomous schedules",
  checkpoint: "direct workflow runs do not expose hosted checkpoint storage",
  "cli-delegation": "isolated direct workflow runs do not delegate to external agent CLIs",
  query_db: "isolated direct workflow runs do not expose the production database",
  "query-db": "isolated direct workflow runs do not expose the production database",
  tasks: "isolated direct workflow runs do not expose live Host Task mutations",
};

export function defaultDirectToolDenials(
  configuredTools: readonly string[],
  options: { allowWorkflowTool?: boolean } = {},
): ToolDenial[] {
  return configuredTools.flatMap((name) => {
    if (name === "workflow" && options.allowWorkflowTool) return [];
    const reason = DIRECT_HOST_TOOL_DENIALS[name];
    return reason ? [{ name, reason }] : [];
  });
}

export type DirectAgentFixtureHandler = (call: {
  agent: string;
  task: string;
  options?: AgentCallOptions & { schema?: TSchema };
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
  stepIndex: number;
}) => WorkflowStepInvocationResult | Promise<WorkflowStepInvocationResult>;

export type DirectWorkflowRunOptions<TInput = unknown> = {
  /** Provide either an imported workflow module or owning `agentName` + `workflowName`. */
  module?: WorkflowExecutableModule<TInput>;
  agentName?: string;
  workflowName?: string;
  workflowDir?: string;
  input: TInput;
  projectRoot: string;
  workRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot?: string;
  globalAgentsRoot?: string;
  outputRoot: string;
  /** Optional directory where `<traceDir>/run.json` (`WorkflowRunReport`) is written. */
  traceDir?: string;
  models: Record<string, ModelWithApiKey>;
  /** Optional local Task snapshot for workflows that read `ctx.read.tasks.get` / `ctx.reconciliation`. */
  task?: TaskDetail;
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  workspace?: WorkflowContext["workspace"];
  read?: Partial<AppRead>;
  events?: Partial<WorkflowContext["events"]>;
  metrics?: Partial<WorkflowContext["metrics"]>;
  /** Optional deterministic overrides for selected agents during tuning or hybrid tests. */
  agentFixtures?: Record<string, DirectAgentFixtureHandler>;
  /** Custom direct agent runner (defaults to `runDirectAgent`). */
  runAgent?: (options: DirectAgentRunOptions) => Promise<DirectAgentRunResult>;
  /** Custom tool denial policy for real child agent runs. */
  resolveToolDenials?: (agentName: string, configuredTools: readonly string[]) => ToolDenial[];
  /** Expose sandboxed `workflow` tool inside child agent steps (default: false). */
  allowChildAgentWorkflowTool?: boolean;
  drainProcessGroup?: (pgid: number) => Promise<boolean>;
  timeoutMs?: number;
  deadlineAt?: number;
  maxConcurrentCalls?: number;
  maxDepth?: number;
  signal?: AbortSignal;
  executionId?: string;
  onStep?: (step: WorkflowStepTrace) => void;
  onLog?: (entry: WorkflowLogEntry) => void;
  onNotice?: (message: string) => void;
};

export type DirectWorkflowRunResult = {
  ok: boolean;
  started: boolean;
  status: WorkflowRunReport["status"];
  result?: NormalizedWorkflowContribution;
  error?: unknown;
  report: WorkflowRunReport;
  reportPath?: string;
  childSessions: Array<{ stepIndex: number; agent: string; sessionId: string; transcriptPath: string }>;
};

function normalizeFinishStatus(status: string): NonNullable<TaskResult["finishResult"]>["status"] {
  if (status === "failure" || status === "blocked" || status === "partial" || status === "success") {
    return status;
  }
  return "success";
}

function directResultToTaskResult(run: DirectAgentRunResult): TaskResult {
  const finish = run.finishResult
    ? {
        status: normalizeFinishStatus(run.finishResult.status),
        summary: run.finishResult.summary,
        ...(run.finishResult.deliverables ? { deliverables: run.finishResult.deliverables } : {}),
        ...(run.finishResult.blockers ? { blockers: run.finishResult.blockers } : {}),
        ...(run.finishResult.next_steps ? { next_steps: run.finishResult.next_steps } : {}),
        ...(run.finishResult.result !== undefined ? { result: run.finishResult.result } : {}),
      }
    : undefined;
  return {
    sessionId: run.sessionId,
    status: run.status,
    lastAssistantText: run.lastAssistantText,
    messages: run.messages,
    duration: `${(run.durationMs / 1000).toFixed(1)}s`,
    outputDir: run.sessionPath,
    ...(run.error ? { error: run.error } : {}),
    ...(finish ? { finishResult: finish } : {}),
    ...(run.structuredResult !== undefined ? { structuredResult: run.structuredResult } : {}),
  };
}

function resolveWorkflowDir(options: DirectWorkflowRunOptions<any>): string | undefined {
  if (options.workflowDir) return resolve(options.workflowDir);
  if (!options.agentName) return undefined;
  const dir =
    resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName) ??
    resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName, options.projectsRoot);
  return dir ? join(dir.dir, "workflows") : undefined;
}

function enforceDirectStepCompletion(
  result: TaskResult,
  expectsSchemaPayload: boolean,
): TaskResult {
  if (result.status !== "done") return result;
  if (!result.finishResult) {
    return {
      ...result,
      status: "error",
      error: "Workflow agent step completed without the required finish() result",
    };
  }
  if (expectsSchemaPayload && result.structuredResult === undefined && result.finishResult.result === undefined) {
    return {
      ...result,
      status: "error",
      error: "Workflow agent step completed without the required schema-backed finish().result payload",
    };
  }
  return result;
}

/**
 * Run a workflow end-to-end without booting Host SQLite, EventBus, or SubagentManager.
 */
export async function runDirectWorkflow<TInput = unknown>(
  options: DirectWorkflowRunOptions<TInput>,
  internal?: { depth: number; allowance?: WorkflowExecutionAllowance },
): Promise<DirectWorkflowRunResult> {
  const depth = internal?.depth ?? 1;
  const maxDepth = options.maxDepth ?? DEFAULT_DIRECT_WORKFLOW_MAX_DEPTH;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1) {
    throw new Error("maxDepth must be a positive integer when set");
  }
  if (depth > maxDepth) {
    const depthErr = new Error(`Maximum workflow nesting depth (${maxDepth}) exceeded`);
    const now = Date.now();
    const executionId =
      internal === undefined && options.executionId
        ? options.executionId
        : `wr_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const report: WorkflowRunReport = {
      workflow: options.module?.name ?? options.workflowName ?? "unknown",
      executionId,
      started: false,
      status: "error",
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      input: options.input,
      error: {
        name: depthErr.name,
        message: depthErr.message,
        ...(depthErr.stack ? { stack: depthErr.stack } : {}),
      },
      steps: [],
      stepsTruncated: 0,
      logs: [],
      logsTruncated: 0,
      limits: { timeoutMs: 0, deadlineAt: now },
      cleanup: { confirmed: true },
      observerErrors: [],
    };
    let reportPath: string | undefined;
    if (options.traceDir) {
      mkdirSync(options.traceDir, { recursive: true });
      reportPath = join(options.traceDir, "run.json");
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    return {
      ok: false,
      started: false,
      status: "error",
      error: depthErr,
      report,
      ...(reportPath ? { reportPath } : {}),
      childSessions: [],
    };
  }

  const workflowDir = resolveWorkflowDir(options);
  const catalog = workflowDir ? await buildWorkflowCatalog(workflowDir) : undefined;

  let targetModule = options.module;
  if (!targetModule) {
    if (!options.workflowName || !catalog) {
      throw new Error("runDirectWorkflow requires either `module` or (`workflowName` and resolvable `workflowDir`/`agentName`)");
    }
    const found = findWorkflow(catalog, options.workflowName);
    if (!found.workflow) {
      throw new Error(found.error ?? `Workflow "${options.workflowName}" not found`);
    }
    targetModule = found.workflow as WorkflowExecutableModule<TInput>;
  }

  const childSessions: DirectWorkflowRunResult["childSessions"] = [];
  const taskDetail = options.task;
  const reconciliation: WorkflowContext<TInput>["reconciliation"] | undefined =
    options.reconciliation ??
    (taskDetail
      ? {
          task: taskDetail,
          appId: "direct-app",
          taskId: taskDetail.id,
          generation: taskDetail.generation,
          resourceVersion: taskDetail.resourceVersion ?? 1,
          agent: taskDetail.agent ?? options.agentName ?? "direct-agent",
          owner: taskDetail.agent ?? options.agentName ?? "direct-agent",
          outcome: taskDetail.outcome,
          acceptance: taskDetail.acceptance,
          input: taskDetail.input as TInput,
          children: { live: [], completed: [] },
          waits: { open: [], note: "direct snapshot" },
          taskSnapshot: { live: [], truncated: false },
          events: { items: [], truncated: false },
        }
      : undefined);

  const read: AppRead = createTestAppRead({
    ...options.read,
    tasks: {
      list: options.read?.tasks?.list ?? (async () => ({ items: taskDetail ? [taskDetail] : [] })),
      outcomes:
        options.read?.tasks?.outcomes ??
        (async () => ({
          projection: "outcomes" as const,
          manifestVersion: null,
          sourceCount: 0,
          outcomeCount: 0,
          outcomes: [],
        })),
      get:
        options.read?.tasks?.get ??
        (async (id: string) => {
          if (taskDetail && id === taskDetail.id) return structuredClone(taskDetail);
          throw new Error(`Direct workflow run has no configured Task snapshot for "${id}"`);
        }),
      ...(options.read?.tasks?.workload ? { workload: options.read.tasks.workload } : {}),
    },
  });

  const maxConcurrentCalls =
    options.maxConcurrentCalls ?? DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS;
  const executeAgent = options.runAgent ?? runDirectAgent;

  let rootAllowance = internal?.allowance;
  if (!rootAllowance && !options.signal?.aborted) {
    try {
      rootAllowance = createWorkflowAllowance({
        timeoutMs: targetModule.executionTimeoutMs ?? options.timeoutMs,
        deadlineAt: options.deadlineAt,
        maxConcurrentCalls,
      });
    } catch {
      // Pre-start deadline/timeout validation errors are surfaced cleanly by runWorkflowInvocation.
    }
  }

  const outcome: WorkflowKernelOutcome = await runWorkflowInvocation(targetModule, {
    executionId: internal ? undefined : options.executionId,
    input: options.input,
    taskOwned: Boolean(options.task || options.reconciliation),
    signal: options.signal,
    timeoutMs: targetModule.executionTimeoutMs ?? options.timeoutMs,
    deadlineAt: options.deadlineAt,
    maxConcurrentCalls,
    allowance: rootAllowance,
    read,
    events: options.events
      ? {
          emit:
            options.events.emit ??
            (async () => {
              throw new Error("events.emit is not configured in runDirectWorkflow");
            }),
          read:
            options.events.read ??
            (async () => {
              throw new Error("events.read is not configured in runDirectWorkflow");
            }),
          onEvent:
            options.events.onEvent ??
            (() => {
              throw new Error("events.onEvent is not configured in runDirectWorkflow");
            }),
        }
      : undefined,
    metrics: options.metrics
      ? {
          define: options.metrics.define ?? (() => undefined),
          defineMany: options.metrics.defineMany ?? (() => undefined),
          record: options.metrics.record ?? (async () => undefined),
          evaluate: options.metrics.evaluate ?? (() => []),
        }
      : undefined,
    workspace: options.workspace ?? {
      appRoot: resolve(options.projectRoot),
      projectRoot: resolve(options.workRoot),
      root: resolve(options.workRoot),
      output: resolve(options.workRoot),
    },
    reconciliation,
    onStep: options.onStep,
    onLog: options.onLog,
    callAgent: async (agent, prompt, callOpts, stepControl) => {
      const operationAllowance = validateOperationAllowance(callOpts?.operationAllowance);
      const fixture = options.agentFixtures?.[agent];
      if (fixture) {
        return fixture({ agent, task: prompt, options: callOpts, ...stepControl });
      }
      const agentSource =
        resolveRuntimeAgentDirectory(options.agentsRoot, agent) ??
        resolveRuntimeAgentDirectory(options.agentsRoot, agent, options.projectsRoot);
      if (!agentSource) {
        throw new Error(`Agent "${agent}" was not found under ${options.agentsRoot}`);
      }
      const config = readAgentConfigFile(agentSource.dir);
      if (!config) {
        throw new Error(`Agent "${agent}" is disabled or has no agent.json`);
      }
      const unconfirmedToolWorkflows: string[] = [];
      const childWorkflowTool =
        options.allowChildAgentWorkflowTool && config.tools.includes("workflow")
          ? createDirectWorkflowTool({
              ...options,
              executionId: undefined,
              agentName: agent,
              workflowDir: join(agentSource.dir, "workflows"),
              allowance: rootAllowance,
              depth: depth + 1,
              onUnconfirmedCleanup: (items) => {
                for (const item of items) {
                  if (!unconfirmedToolWorkflows.includes(item)) unconfirmedToolWorkflows.push(item);
                }
              },
            })
          : undefined;
      const denials = options.resolveToolDenials
        ? options.resolveToolDenials(agent, config.tools)
        : defaultDirectToolDenials(config.tools, {
            allowWorkflowTool: Boolean(childWorkflowTool),
          });
      const effectivePrompt = callOpts?.skill
        ? `Apply skill "${callOpts.skill}" when relevant.\n\n${prompt}`
        : prompt;

      let directRun: DirectAgentRunResult;
      try {
        directRun = await executeAgent({
          agentName: agent,
          task: effectivePrompt,
          projectRoot: options.projectRoot,
          workRoot: options.workRoot,
          agentsRoot: options.agentsRoot,
          sharedRoot: options.sharedRoot,
          projectsRoot: options.projectsRoot,
          globalAgentsRoot: options.globalAgentsRoot,
          outputRoot: options.outputRoot,
          models: options.models,
          requireFinish: true,
          outputSchema: callOpts?.schema,
          toolPolicy: callOpts?.tools,
          operationAllowance,
          toolDenials: denials,
          workflowTool: childWorkflowTool,
          drainProcessGroup: options.drainProcessGroup,
          timeoutMs: stepControl.timeoutMs,
          deadlineAt: stepControl.deadlineAt,
          signal: stepControl.signal,
          onNotice: options.onNotice,
        });
      } catch (err) {
        if (unconfirmedToolWorkflows.length > 0 && !(err instanceof WorkflowUnconfirmedCleanupError)) {
          throw new WorkflowUnconfirmedCleanupError(agent, unconfirmedToolWorkflows, err);
        }
        throw err;
      }

      const transcriptPath = join(directRun.sessionPath, "session.jsonl");
      childSessions.push({
        stepIndex: stepControl.stepIndex,
        agent,
        sessionId: directRun.sessionId,
        transcriptPath,
      });
      const taskResult = enforceDirectStepCompletion(
        directResultToTaskResult(directRun),
        Boolean(callOpts?.schema),
      );
      const mapped = agentExecutionResult(taskResult);
      return {
        ...mapped,
        sessionId: directRun.sessionId,
        transcriptPath,
        cleanupConfirmed: directRun.cleanupConfirmed && unconfirmedToolWorkflows.length === 0,
      };
    },
    runWorkflow: async (wfName, wfInput, stepControl) => {
      if (depth + 1 > maxDepth) {
        throw new Error(`Maximum workflow nesting depth (${maxDepth}) exceeded`);
      }
      if (!catalog) {
        throw new Error(`Cannot resolve nested workflow "${wfName}" without a workflowDir`);
      }
      const found = findWorkflow(catalog, wfName);
      if (!found.workflow) {
        throw new Error(found.error ?? `Workflow "${wfName}" not found`);
      }
      const sub = await runDirectWorkflow(
        {
          ...options,
          executionId: undefined,
          module: found.workflow,
          workflowName: wfName,
          input: wfInput,
          signal: stepControl.signal,
          timeoutMs: stepControl.timeoutMs,
          deadlineAt: stepControl.deadlineAt,
          traceDir: undefined,
        },
        { depth: depth + 1, allowance: stepControl.allowance },
      );
      for (const session of sub.childSessions) {
        childSessions.push(session);
      }
      if (!sub.ok) {
        const thrown = sub.error instanceof Error
          ? sub.error
          : new Error(String(sub.error ?? sub.report.error?.message));
        if (sub.started) {
          (thrown as Error & { executionId?: string }).executionId = sub.report.executionId;
        }
        throw thrown;
      }
      return {
        id: sub.report.executionId,
        kind: "workflow",
        status: sub.result!.type,
        summary: sub.result!.type === "done" ? sub.result!.summary : sub.result!.reason,
        ...(sub.result!.output !== undefined ? { output: sub.result!.output } : {}),
        ...(sub.result!.facts !== undefined ? { facts: sub.result!.facts } : {}),
        cleanupConfirmed: sub.report.cleanup.confirmed,
      };
    },
  });

  let reportPath: string | undefined;
  if (options.traceDir) {
    mkdirSync(options.traceDir, { recursive: true });
    reportPath = join(options.traceDir, "run.json");
    writeFileSync(reportPath, `${JSON.stringify(outcome.report, null, 2)}\n`);
  }

  return {
    ok: outcome.ok,
    started: outcome.started,
    status: outcome.report.status,
    ...(outcome.ok ? { result: outcome.result } : { error: outcome.error }),
    report: outcome.report,
    ...(reportPath ? { reportPath } : {}),
    childSessions,
  };
}

const DirectWorkflowToolParams: TSchema = Type.Object({
  action: StringEnum(["list", "run"] as const, {
    description: "'list': show available workflows; 'run': execute a workflow by name.",
  }),
  name: Type.Optional(Type.String({ description: "Workflow name (required for 'run')." })),
  input: Type.Optional(Type.Unknown({ description: "Structured workflow input." })),
  task: Type.Optional(Type.String({ description: "Legacy string input." })),
});

function textToolResult(payload: unknown): AgentToolResult<string> {
  const text = JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }], details: text };
}

/**
 * Create a Host-free `workflow` tool backed by `runDirectWorkflow` so opted-in
 * Gym or direct agent scenarios can test agent-dispatched workflow invocations.
 */
export function createDirectWorkflowTool(
  options: Omit<DirectWorkflowRunOptions<unknown>, "input" | "module" | "workflowName"> & {
    workflowDir: string;
    allowance?: WorkflowExecutionAllowance;
    depth?: number;
    onUnconfirmedCleanup?: (unconfirmed: readonly string[]) => void;
  },
): AgentTool {
  return {
    name: "workflow",
    label: "Workflow",
    description:
      "List available workflows or run a workflow by name in an isolated sandbox. Completion returns id, kind, status, summary and output/facts.",
    parameters: DirectWorkflowToolParams,
    execute: async (_toolCallId, rawParams, signal) => {
      const params = rawParams as {
        action: "list" | "run";
        name?: string;
        input?: unknown;
        task?: string;
      };
      const catalog = await buildWorkflowCatalog(options.workflowDir);
      if (params.action === "list") {
        const workflows = [...catalog.workflows.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((wf) => ({ name: wf.name, description: wf.description }));
        return textToolResult({
          type: "list",
          workflows,
          ...(catalog.diagnostics.length > 0 ? { diagnostics: [...catalog.diagnostics] } : {}),
        });
      }
      if (params.action === "run") {
        const hasInput = Object.hasOwn(params, "input");
        if (!params.name || (!hasInput && !params.task) || (hasInput && params.task !== undefined)) {
          return textToolResult({
            type: "error",
            error: "action 'run' requires 'name' and exactly one of 'input' or legacy 'task'",
          });
        }
        const wfInput = hasInput ? params.input : params.task!;
        const found = findWorkflow(catalog, params.name);
        if (!found.workflow) {
          return textToolResult({
            type: "error",
            workflow: params.name,
            error: found.error ?? `Workflow "${params.name}" not found`,
          });
        }
        const sub = await runDirectWorkflow(
          {
            ...options,
            executionId: undefined,
            module: found.workflow,
            workflowName: params.name,
            input: wfInput,
            signal:
              signal && options.signal
                ? AbortSignal.any([signal, options.signal])
                : (signal ?? options.signal),
          },
          {
            depth: options.depth ?? 1,
            ...(options.allowance ? { allowance: options.allowance } : {}),
          },
        );
        if (!sub.report.cleanup.confirmed) {
          options.onUnconfirmedCleanup?.(
            sub.report.cleanup.unconfirmed ?? [
              `workflow:${params.name} (${sub.report.executionId})`,
            ],
          );
        }
        if (!sub.ok) {
          return textToolResult({
            type: "error",
            workflow: params.name,
            ...(sub.started
              ? { workflowRunId: sub.report.executionId, id: sub.report.executionId, kind: "workflow" }
              : { started: false }),
            status: sub.status,
            summary: sub.report.error?.message ?? "Workflow failed",
            error: sub.report.error?.message ?? "Workflow failed",
          });
        }
        return textToolResult({
          type: sub.result!.type,
          workflow: params.name,
          workflowRunId: sub.report.executionId,
          id: sub.report.executionId,
          kind: "workflow",
          status: sub.result!.type,
          summary: sub.result!.type === "done" ? sub.result!.summary : sub.result!.reason,
          ...(sub.result!.type !== "done" ? { reason: sub.result!.reason } : {}),
          ...(sub.result!.output !== undefined ? { output: sub.result!.output } : {}),
          ...(sub.result!.facts !== undefined ? { facts: sub.result!.facts } : {}),
        });
      }
      return textToolResult({ type: "error", error: `Unknown action: ${String(params.action)}` });
    },
  };
}
