/**
 * Host-free direct workflow runner for Gym, CLI debugging, and standalone runs.
 *
 * Composes the portable workflow invocation kernel with `runDirectAgent` and
 * `buildWorkflowCatalog`. Intentionally constructs no SQLite database,
 * EventBus, SubagentManager, schedule, or daemon state.
 */

import type { TSchema } from "typebox";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  AgentCallOptions,
  AppRead,
  CallOptions,
  TaskDetail,
  WorkflowContext,
} from "@may-agent/sdk";
import { createTestAppRead } from "@may-agent/sdk/testing";
import {
  createWorkflowAllowance,
  resolveCallable,
  runWorkflowInvocation,
  type NormalizedWorkflowContribution,
  type PreparedCatalog,
  type WorkflowExecutableModule,
  type WorkflowExecutionAllowance,
  type WorkflowKernelOutcome,
  type WorkflowKernelStepControl,
  type WorkflowLogEntry,
  type WorkflowRunReport,
  type WorkflowStepInvocationResult,
  type WorkflowStepTrace,
} from "../../packages/sdk/src/workflow-kernel.js";
import { agentExecutionResult, enforceStructuredWorkflowResult } from "../lib/execution-handoff.js";
import type { ModelWithApiKey, TaskResult } from "../lib/types.js";
import { buildWorkflowCatalog, findWorkflow } from "../lib/workflow-catalog.js";
import { validateOperationAllowance } from "../lib/workflow-finish-recovery.js";
import { readAgentConfigFile, type AgentConfig } from "./loader/agent-config.js";
import {
  listRuntimeAgentDirectories,
  resolveRuntimeAgentDirectory,
  type AgentDirectory,
} from "./loader/agent-discovery.js";
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
  workflow: "nested agent steps do not expose hosted workflow dispatch",
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
): ToolDenial[] {
  return configuredTools.flatMap((name) => {
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
  /** Provide an imported workflow module, `target` ("agent" or "owner/workflow"), or owning `agentName` + `workflowName`. */
  module?: WorkflowExecutableModule<TInput>;
  target?: string;
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
  /** Optional tool restriction ("readonly") for this execution scope. */
  tools?: "full" | "readonly";
  /** Optional caller-side output schema for root prompt targets. */
  outputSchema?: TSchema;
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

export type DirectRunOptions<TInput = unknown> = DirectWorkflowRunOptions<TInput>;
export type DirectRunResult = DirectWorkflowRunResult;

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

type DirectPromptDefinition = {
  source: AgentDirectory;
  config?: AgentConfig;
};

async function buildDirectCatalog(
  options: DirectWorkflowRunOptions<any>,
  callerOwner: string,
  explicitWorkflowDir?: string,
): Promise<PreparedCatalog<DirectPromptDefinition>> {
  // An App-local agentsRoot can also appear through projectsRoot. Keep its
  // project metadata instead of treating that duplicate path as a global root.
  const dirs = [...new Map(
    listRuntimeAgentDirectories(options.agentsRoot, options.projectsRoot).map((dir) => [resolve(dir.dir), dir]),
  ).values()];
  const callerSource =
    (explicitWorkflowDir
      ? dirs.find((dir) => resolve(dir.dir, "workflows") === resolve(explicitWorkflowDir))
      : undefined) ??
    resolveRuntimeAgentDirectory(options.agentsRoot, callerOwner) ??
    resolveRuntimeAgentDirectory(options.agentsRoot, callerOwner, options.projectsRoot);
  const callerProjectId = callerSource?.projectId;

  const prompts = new Map<string, { owner: string; definition: DirectPromptDefinition }>();
  const proceduresByOwner = new Map<string, ReadonlyMap<string, WorkflowExecutableModule>>();
  const diagnostics: string[] = [];

  for (const agentDir of dirs) {
    // Enforce App-local boundary isolation: only include global agents or agents in the same App projectId.
    if (agentDir.projectId && agentDir.projectId !== callerProjectId) {
      continue;
    }
    const config = readAgentConfigFile(agentDir.dir);
    if (!config) continue;
    const existing = prompts.get(config.name);
    // Prompt and procedure definitions must come from the same admitted owner.
    if (existing?.definition.source.projectId && !agentDir.projectId) continue;
    if (existing && existing.definition.source.projectId === agentDir.projectId) {
      throw new Error(`Ambiguous callable owner "${config.name}": ${existing.definition.source.dir}, ${agentDir.dir}`);
    }
    prompts.set(config.name, { owner: config.name, definition: { source: agentDir, config } });
    const wfCatalog = await buildWorkflowCatalog(join(agentDir.dir, "workflows"));
    proceduresByOwner.set(config.name, wfCatalog.workflows);
    for (const diag of wfCatalog.diagnostics) {
      diagnostics.push(diag);
    }
  }

  if (explicitWorkflowDir) {
    const explicitCatalog = await buildWorkflowCatalog(explicitWorkflowDir);
    if (explicitCatalog.workflows.size > 0 || !proceduresByOwner.has(callerOwner)) {
      proceduresByOwner.set(callerOwner, explicitCatalog.workflows);
    }
    for (const diag of explicitCatalog.diagnostics) {
      if (!diagnostics.includes(diag)) diagnostics.push(diag);
    }
  }

  for (const fixtureAgent of Object.keys(options.agentFixtures ?? {})) {
    if (!prompts.has(fixtureAgent)) {
      prompts.set(fixtureAgent, {
        owner: fixtureAgent,
        definition: {
          source: {
            name: fixtureAgent,
            dir: join(options.agentsRoot, fixtureAgent),
            agentsRoot: options.agentsRoot,
            relativeDir: `agents/${fixtureAgent}`,
          },
        },
      });
    }
  }

  return {
    prompts,
    proceduresByOwner,
    diagnostics,
  };
}

/**
 * Run a workflow end-to-end without booting Host SQLite, EventBus, or SubagentManager.
 */
export async function runDirectWorkflow<TInput = unknown>(
  options: DirectWorkflowRunOptions<TInput>,
  internal?: {
    depth: number;
    allowance?: WorkflowExecutionAllowance;
    catalog?: PreparedCatalog<DirectPromptDefinition>;
    callerOwner?: string;
    tools?: "full" | "readonly";
  },
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

  let callerOwner = internal?.callerOwner ?? options.agentName ?? "direct-agent";
  if (!internal && !options.agentName && options.target) {
    callerOwner = options.target.includes("/")
      ? options.target.slice(0, options.target.indexOf("/")).trim()
      : options.target.trim();
  }
  const workflowDir = resolveWorkflowDir({ ...options, agentName: callerOwner });
  const wfCatalog = !options.module && workflowDir ? await buildWorkflowCatalog(workflowDir) : undefined;
  const preparedCatalog =
    internal?.catalog ?? (await buildDirectCatalog({ ...options, agentName: callerOwner }, callerOwner, workflowDir));

  let targetModule = options.module;
  if (!targetModule) {
    const requestedTarget = options.target?.trim() ?? options.workflowName?.trim();
    if (!requestedTarget) {
      throw new Error("runDirect requires `module`, `target`, or (`workflowName` and resolvable `workflowDir`/`agentName`)");
    }
    if (options.target) {
      const resolved = resolveCallable(callerOwner, requestedTarget, preparedCatalog);
      callerOwner = resolved.owner;
      if (resolved.kind === "code") {
        targetModule = resolved.module as WorkflowExecutableModule<TInput>;
      } else {
        targetModule = {
          name: resolved.name,
          description: `Direct prompt invocation for ${resolved.name}`,
          async execute(ctx) {
            return options.outputSchema
              ? ctx.call(resolved.name, ctx.input, {
                  schema: options.outputSchema,
                  ...(options.tools ? { tools: options.tools } : {}),
                })
              : ctx.call(resolved.name, ctx.input, {
                  ...(options.tools ? { tools: options.tools } : {}),
                });
          },
        };
      }
    } else {
      if (!wfCatalog) {
        throw new Error("runDirectWorkflow requires either `module` or (`workflowName` and resolvable `workflowDir`/`agentName`)");
      }
      const found = findWorkflow(wfCatalog, requestedTarget);
      if (!found.workflow) {
        throw new Error(found.error ?? `Workflow "${requestedTarget}" not found`);
      }
      targetModule = found.workflow as WorkflowExecutableModule<TInput>;
    }
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

  const executePromptStep = async (
    agent: string,
    prompt: string,
    callOpts: (CallOptions<TSchema> & { schema?: TSchema }) | undefined,
    stepControl: { signal: AbortSignal; timeoutMs: number; deadlineAt: number; stepIndex: number },
  ): Promise<WorkflowStepInvocationResult> => {
    const operationAllowance = validateOperationAllowance(callOpts?.operationAllowance);
    const fixture = options.agentFixtures?.[agent];
    if (fixture) {
      return fixture({ agent, task: prompt, options: callOpts, ...stepControl });
    }
    const promptDef = preparedCatalog.prompts?.get(agent)?.definition;
    if (!promptDef) {
      throw new Error(`Agent "${agent}" was not found under ${options.agentsRoot}`);
    }
    const config = promptDef.config ?? readAgentConfigFile(promptDef.source.dir);
    if (!config) {
      throw new Error(`Agent "${agent}" is disabled or has no agent.json`);
    }
    const denials = options.resolveToolDenials
      ? options.resolveToolDenials(agent, config.tools)
      : defaultDirectToolDenials(config.tools);
    const effectivePrompt = callOpts?.skill
      ? `Apply skill "${callOpts.skill}" when relevant.\n\n${prompt}`
      : prompt;

    const directRun = await executeAgent({
      agentName: agent,
      agentSource: promptDef.source,
      agentConfig: config,
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
      drainProcessGroup: options.drainProcessGroup,
      timeoutMs: stepControl.timeoutMs,
      deadlineAt: stepControl.deadlineAt,
      signal: stepControl.signal,
      onNotice: options.onNotice,
    });

    const transcriptPath = join(directRun.sessionPath, "session.jsonl");
    childSessions.push({
      stepIndex: stepControl.stepIndex,
      agent,
      sessionId: directRun.sessionId,
      transcriptPath,
    });
    const taskResult = enforceStructuredWorkflowResult(
      directResultToTaskResult(directRun),
      Boolean(callOpts?.schema),
    );
    const mapped = agentExecutionResult(taskResult);
    return {
      ...mapped,
      sessionId: directRun.sessionId,
      transcriptPath,
      cleanupConfirmed: directRun.cleanupConfirmed,
    };
  };

  const executeCodeStep = async (
    wfName: string,
    targetMod: WorkflowExecutableModule,
    targetOwner: string,
    wfInput: unknown,
    stepControl: WorkflowKernelStepControl,
    callOpts?: CallOptions<TSchema> & { schema?: TSchema },
  ): Promise<WorkflowStepInvocationResult> => {
    if (depth + 1 > maxDepth) {
      throw new Error(`Maximum workflow nesting depth (${maxDepth}) exceeded`);
    }
    const sub = await runDirectWorkflow(
      {
        ...options,
        executionId: undefined,
        module: targetMod,
        workflowName: wfName,
        input: wfInput,
        signal: stepControl.signal,
        timeoutMs: stepControl.timeoutMs,
        deadlineAt: stepControl.deadlineAt,
        traceDir: undefined,
      },
      {
        depth: depth + 1,
        allowance: stepControl.allowance,
        catalog: preparedCatalog,
        callerOwner: targetOwner,
        tools: callOpts?.tools,
      },
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
  };

  const outcome: WorkflowKernelOutcome = await runWorkflowInvocation(targetModule, {
    executionId: internal ? undefined : options.executionId,
    input: options.input,
    taskOwned: Boolean(options.task || options.reconciliation),
    tools: internal?.tools ?? options.tools,
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
    resolveTargetKind: (target) => {
      try {
        const resolved = resolveCallable(callerOwner, target, preparedCatalog);
        return resolved.kind === "prompt" ? "agent" : "workflow";
      } catch {
        return typeof target === "string" && target.includes("/") ? "workflow" : "agent";
      }
    },
    callTarget: async (target, input, callOpts, stepControl) => {
      const resolved = resolveCallable(callerOwner, target, preparedCatalog);
      if (resolved.kind === "prompt") {
        if (typeof input !== "string") {
          throw new Error(`Prompt target "${target}" requires a string prompt input`);
        }
        return executePromptStep(resolved.name, input, callOpts, stepControl);
      }
      return executeCodeStep(resolved.name, resolved.module, resolved.owner, input, stepControl, callOpts);
    },
    callAgent: (agent, prompt, callOpts, stepControl) =>
      executePromptStep(agent, prompt, callOpts, stepControl),
    runWorkflow: async (wfName, wfInput, stepControl) => {
      const resolved = resolveCallable(callerOwner, wfName, preparedCatalog);
      if (resolved.kind !== "code") {
        throw new Error(`Callable target "${wfName}" is not a code procedure`);
      }
      return executeCodeStep(
        resolved.name,
        resolved.module,
        resolved.owner,
        wfInput,
        stepControl,
        stepControl.options,
      );
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

/**
 * Unified standalone entrypoint for both prompt agents ("alex") and code procedures ("tech-lead/verified-coder").
 */
export const runDirect = runDirectWorkflow;
