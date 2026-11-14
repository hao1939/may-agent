/**
 * Host-free direct workflow & standalone target runner for CLI, Gym, and scripts.
 *
 * Composes the portable workflow invocation kernel with `runDirectAgent`,
 * `runCliAgent`, and `buildWorkflowCatalog`. Intentionally constructs no SQLite
 * database, EventBus, SubagentManager, schedule, or daemon state.
 */

import type { TSchema } from "typebox";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  AgentCallOptions,
  AppRead,
  CallOptions,
  TaskDetail,
  WorkflowContext,
} from "@may-agent/sdk";
import { createTestAppRead } from "@may-agent/sdk/testing";
import {
  WorkflowUnconfirmedCleanupError,
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
} from "../../workflow-kernel.js";
import {
  runCliAgent,
  type CliAgentInput,
  type CliAgentOptions,
  type CliAgentResult,
} from "../lib/cli-agent.js";
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
import { createModelRegistry } from "./model-registry.js";
import {
  prepareDirectAgentExecution,
  resolveDirectToolPolicy,
  runDirectAgent,
  type AgentExecutionManifest,
  type DirectAgentRunOptions,
  type DirectAgentRunResult,
  type ToolDenial,
} from "./direct-agent.js";

export {
  prepareDirectAgentExecution,
  resolveDirectToolPolicy,
  runDirectAgent,
  type AgentExecutionManifest,
  type DirectAgentRunOptions,
  type DirectAgentRunResult,
  type ToolDenial,
};

export const DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS = 4;
export const DEFAULT_DIRECT_WORKFLOW_MAX_DEPTH = 3;

const DIRECT_HOST_TOOL_DENIALS: Readonly<Record<string, string>> = {
  agents: "isolated direct workflow runs do not dispatch hosted supporting agents",
  message: "isolated direct workflow runs must not notify real users or agents",
  cron: "isolated direct workflow runs must not change autonomous schedules",
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
  /** Optional explicit App directory scope (e.g. `"alpha.app"`) to lock resolution and catalog admission. */
  appScope?: string;
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
  /** Custom native CLI runner (defaults to `runCliAgent`). */
  runCli?: (input: CliAgentInput, opts: CliAgentOptions) => Promise<CliAgentResult>;
  /** Custom tool denial policy for real child agent runs. */
  resolveToolDenials?: (agentName: string, configuredTools: readonly string[]) => ToolDenial[];
  /** Optional tool restriction ("readonly") for this execution scope. */
  tools?: "full" | "readonly";
  /** Optional caller-side output schema enforced in addition to any module outputSchema. */
  outputSchema?: TSchema;
  /** Optional prompt-target skill selection when root target resolves to a prompt agent. */
  skill?: string;
  /** Optional prompt-target finite tool-operation allowance when root target resolves to a prompt agent. */
  operationAllowance?: number;
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
  /** Retained output directory path when `--out`/`outputRoot` was supplied or when scratch cleanup was unconfirmed. */
  outputRoot?: string;
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

function collectDeduplicatedRuntimeAgentDirs(options: {
  agentsRoot: string;
  projectsRoot?: string;
  globalAgentsRoot?: string;
}): { dirs: AgentDirectory[]; byPath: Map<string, AgentDirectory> } {
  const rawDirs = [
    ...(options.globalAgentsRoot && resolve(options.globalAgentsRoot) !== resolve(options.agentsRoot)
      ? listRuntimeAgentDirectories(options.globalAgentsRoot)
      : []),
    ...listRuntimeAgentDirectories(options.agentsRoot, options.projectsRoot, options.projectsRoot),
  ];
  const byPath = new Map<string, AgentDirectory>();
  for (const dir of rawDirs) {
    const key = resolve(dir.dir);
    const prev = byPath.get(key);
    if (!prev || (!prev.projectId && dir.projectId)) {
      byPath.set(key, dir);
    }
  }
  return { dirs: [...byPath.values()], byPath };
}

function validateExplicitAppScopeAlignment(
  explicitProjectId: string,
  options: DirectWorkflowRunOptions<any>,
  byPath: ReadonlyMap<string, AgentDirectory>,
  explicitWorkflowDir?: string,
): void {
  const globalRoot = options.globalAgentsRoot ? resolve(options.globalAgentsRoot) : undefined;
  const resolvedAgentsRoot = resolve(options.agentsRoot);
  if (!globalRoot || resolvedAgentsRoot !== globalRoot) {
    const expectedAppAgentsRoot = options.projectsRoot
      ? resolve(options.projectsRoot, `${explicitProjectId}.app`, "agents")
      : undefined;
    const rootsInApp = [...byPath.values()].some(
      (dir) => resolve(dir.agentsRoot) === resolvedAgentsRoot && dir.projectId === explicitProjectId,
    );
    const rootsInOtherApp = [...byPath.values()].find(
      (dir) =>
        resolve(dir.agentsRoot) === resolvedAgentsRoot &&
        dir.projectId &&
        dir.projectId !== explicitProjectId,
    );
    if (
      rootsInOtherApp ||
      (expectedAppAgentsRoot && resolvedAgentsRoot !== expectedAppAgentsRoot && !rootsInApp)
    ) {
      throw new Error(
        `Conflicting App scope "${explicitProjectId}.app" for agentsRoot "${options.agentsRoot}"`,
      );
    }
  }
  if (explicitWorkflowDir) {
    const wfOwnerDir = [...byPath.values()].find(
      (dir) => resolve(dir.dir, "workflows") === resolve(explicitWorkflowDir),
    );
    if (wfOwnerDir?.projectId && wfOwnerDir.projectId !== explicitProjectId) {
      throw new Error(
        `Conflicting App scope "${explicitProjectId}.app" for workflowDir "${explicitWorkflowDir}" (belongs to "${wfOwnerDir.projectId}.app")`,
      );
    }
  }
}

function resolveWorkflowDir(options: DirectWorkflowRunOptions<any>): string | undefined {
  const explicitApp = options.appScope?.trim()
    ? options.appScope.trim().endsWith(".app")
      ? options.appScope.trim()
      : `${options.appScope.trim()}.app`
    : undefined;
  const explicitProjectId = explicitApp ? explicitApp.slice(0, -".app".length) : undefined;
  const { dirs, byPath } = collectDeduplicatedRuntimeAgentDirs(options);
  if (explicitProjectId) {
    validateExplicitAppScopeAlignment(explicitProjectId, options, byPath, options.workflowDir);
  }
  if (options.workflowDir) return resolve(options.workflowDir);
  if (!options.agentName) return undefined;

  // Prefer the already-selected agentsRoot first, recovering its projectId metadata from byPath:
  const directInAgentsRoot = resolveRuntimeAgentDirectory(options.agentsRoot, options.agentName);
  if (directInAgentsRoot) {
    const hydrated = byPath.get(resolve(directInAgentsRoot.dir)) ?? directInAgentsRoot;
    if (!explicitProjectId || !hydrated.projectId || hydrated.projectId === explicitProjectId) {
      return join(hydrated.dir, "workflows");
    }
  }

  let selected: AgentDirectory | undefined;
  for (const agentDir of dirs) {
    if (explicitProjectId && agentDir.projectId && agentDir.projectId !== explicitProjectId) {
      continue;
    }
    try {
      const cfg = readAgentConfigFile(agentDir.dir);
      if (!cfg || cfg.name !== options.agentName) continue;
      if (!selected || (!selected.projectId && agentDir.projectId)) {
        selected = agentDir;
      }
    } catch {
      // Malformed config will be surfaced as a catalog diagnostic.
    }
  }
  return selected ? join(selected.dir, "workflows") : undefined;
}

type DirectPromptDefinition = {
  source: AgentDirectory;
  config?: AgentConfig;
};

type DirectCatalogState = PreparedCatalog<DirectPromptDefinition> & {
  prompts: Map<string, { owner: string; definition: DirectPromptDefinition }>;
  proceduresByOwner: Map<string, ReadonlyMap<string, WorkflowExecutableModule>>;
  diagnostics: string[];
  pendingImports: number;
};

async function buildDirectPromptCatalog(
  options: DirectWorkflowRunOptions<any>,
  callerOwner: string,
  explicitWorkflowDir?: string,
  signal?: AbortSignal,
): Promise<DirectCatalogState> {
  signal?.throwIfAborted();
  const explicitApp = options.appScope?.trim()
    ? options.appScope.trim().endsWith(".app")
      ? options.appScope.trim()
      : `${options.appScope.trim()}.app`
    : undefined;
  const explicitProjectId = explicitApp ? explicitApp.slice(0, -".app".length) : undefined;

  // Include both globalAgentsRoot and agentsRoot + unfiltered projectsRoot before
  // deduplicating so every directory retains its true projectId metadata before App filtering.
  const { dirs, byPath: dedupedByPath } = collectDeduplicatedRuntimeAgentDirs(options);
  if (explicitProjectId) {
    validateExplicitAppScopeAlignment(explicitProjectId, options, dedupedByPath, explicitWorkflowDir);
  }

  const rawCallerSource =
    (explicitWorkflowDir
      ? dirs.find((dir) => resolve(dir.dir, "workflows") === resolve(explicitWorkflowDir))
      : undefined) ??
    resolveRuntimeAgentDirectory(options.agentsRoot, callerOwner) ??
    (explicitApp ? undefined : resolveRuntimeAgentDirectory(options.agentsRoot, callerOwner, options.projectsRoot));
  const callerSource = rawCallerSource ? (dedupedByPath.get(resolve(rawCallerSource.dir)) ?? rawCallerSource) : undefined;
  const callerProjectId = explicitProjectId ?? callerSource?.projectId;

  const prompts = new Map<string, { owner: string; definition: DirectPromptDefinition }>();
  const proceduresByOwner = new Map<string, ReadonlyMap<string, WorkflowExecutableModule>>();
  const diagnostics: string[] = [];

  for (const agentDir of dirs) {
    signal?.throwIfAborted();
    // Enforce App-local boundary isolation: only include global agents or agents in the same App projectId.
    if (agentDir.projectId && agentDir.projectId !== callerProjectId) {
      continue;
    }
    let config: ReturnType<typeof readAgentConfigFile>;
    try {
      config = readAgentConfigFile(agentDir.dir);
    } catch (error) {
      diagnostics.push(`${join(agentDir.dir, "agent.json")}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!config) continue;
    const existing = prompts.get(config.name);
    // Prompt and procedure definitions must come from the same admitted owner.
    if (existing?.definition.source.projectId && !agentDir.projectId) continue;
    if (existing && existing.definition.source.projectId === agentDir.projectId) {
      throw new Error(`Ambiguous callable owner "${config.name}": ${existing.definition.source.dir}, ${agentDir.dir}`);
    }
    prompts.set(config.name, { owner: config.name, definition: { source: agentDir, config } });
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
    pendingImports: 0,
  };
}

/**
 * Run a workflow or target end-to-end without booting Host SQLite, EventBus, or SubagentManager.
 */
export async function runDirectWorkflow<TInput = unknown>(
  options: DirectWorkflowRunOptions<TInput>,
  internal?: {
    depth: number;
    allowance?: WorkflowExecutionAllowance;
    catalog?: DirectCatalogState;
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
      workflow: options.module?.name ?? options.target ?? options.workflowName ?? "unknown",
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
  const inferredRootOwner = !internal && !options.agentName && options.target;
  if (inferredRootOwner) {
    callerOwner = options.target!.includes("/")
      ? options.target!.slice(0, options.target!.indexOf("/")).trim()
      : options.target!.trim();
  }
  const initialOwner = callerOwner;
  const workflowDir = resolveWorkflowDir({
    ...options,
    agentName: inferredRootOwner && !options.target!.includes("/") ? undefined : callerOwner,
  });
  let preparedCatalog: DirectCatalogState = internal?.catalog ?? {
    prompts: new Map(),
    proceduresByOwner: new Map(),
    diagnostics: [],
    pendingImports: 0,
  };

  const ensureOwnerProcedures = async (owner: string, signal?: AbortSignal): Promise<void> => {
    if (preparedCatalog.proceduresByOwner.has(owner)) return;
    const ownerDir =
      owner === initialOwner && workflowDir
        ? workflowDir
        : preparedCatalog.prompts.get(owner)?.definition.source.dir
          ? join(preparedCatalog.prompts.get(owner)!.definition.source.dir, "workflows")
          : undefined;
    if (!ownerDir) return;
    const loaded = await buildWorkflowCatalog(ownerDir, signal, {
      onImportStart: () => {
        preparedCatalog.pendingImports += 1;
      },
      onImportSettled: () => {
        preparedCatalog.pendingImports -= 1;
      },
    });
    signal?.throwIfAborted();
    preparedCatalog.proceduresByOwner.set(owner, loaded.workflows);
    for (const diag of loaded.diagnostics) {
      if (!preparedCatalog.diagnostics.includes(diag)) preparedCatalog.diagnostics.push(diag);
    }
  };

  const loadTargetOwnerProcedures = async (target: string, signal?: AbortSignal): Promise<void> => {
    const normalized = typeof target === "string" ? target.trim() : "";
    if (!normalized) return;
    const slash = normalized.indexOf("/");
    if (slash !== -1) {
      const owner = normalized.slice(0, slash).trim();
      if (owner) await ensureOwnerProcedures(owner, signal);
      return;
    }
    if (inferredRootOwner && normalized === callerOwner) {
      // Do not import procedures on a bare prompt target when no caller agentName was supplied.
      return;
    }
    await ensureOwnerProcedures(callerOwner, signal);
  };

  const isNativeCliFallback = (name: string): name is "codex" | "claude" => {
    const trimmed = name.trim();
    if (trimmed !== "codex" && trimmed !== "claude") return false;
    if (preparedCatalog.proceduresByOwner.get(callerOwner)?.has(trimmed)) return false;
    if (preparedCatalog.prompts.has(trimmed)) return false;
    return true;
  };

  let targetModule = options.module;
  let catalogCapturedAtRoot = false;
  const rootStartedAt = Date.now();
  let preparedAllowance: WorkflowExecutionAllowance | undefined = internal?.allowance;
  if (!targetModule) {
    const requestedTarget = options.target?.trim() ?? options.workflowName?.trim();
    if (!requestedTarget) {
      throw new Error("runDirect requires `module`, `target`, or (`workflowName` and resolvable `workflowDir`/`agentName`)");
    }
    if (!options.target && !workflowDir) {
      throw new Error("runDirectWorkflow requires either `module` or (`workflowName` and resolvable `workflowDir`/`agentName`)");
    }

    const prepNow = rootStartedAt;
    let prepAllowance: WorkflowExecutionAllowance | undefined = internal?.allowance;
    let prepTimeoutMs: number | undefined;
    const makePrepFailureReport = (
      effectiveError: Error,
      status: WorkflowRunReport["status"],
      unconfirmed?: string[],
    ): DirectWorkflowRunResult => {
      const endedAt = Date.now();
      const executionId =
        internal === undefined && options.executionId
          ? options.executionId
          : `wr_${prepNow}_${Math.random().toString(36).slice(2, 6)}`;
      const report: WorkflowRunReport = {
        workflow: requestedTarget,
        executionId,
        started: false,
        status,
        startedAt: prepNow,
        endedAt,
        durationMs: endedAt - prepNow,
        input: options.input,
        error: {
          name: effectiveError.name,
          message: effectiveError.message,
          ...(effectiveError.stack ? { stack: effectiveError.stack } : {}),
        },
        steps: [],
        stepsTruncated: 0,
        logs: [],
        logsTruncated: 0,
        limits: {
          timeoutMs: prepTimeoutMs ?? 0,
          deadlineAt: prepAllowance?.deadlineAt ?? endedAt,
          ...(prepAllowance?.maxConcurrentCalls !== undefined
            ? { maxConcurrentCalls: prepAllowance.maxConcurrentCalls }
            : {}),
        },
        cleanup: unconfirmed ? { confirmed: false, unconfirmed } : { confirmed: true },
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
        status,
        error: effectiveError,
        report,
        ...(reportPath ? { reportPath } : {}),
        childSessions: [],
      };
    };

    if (!prepAllowance && !options.signal?.aborted) {
      try {
        const created = createWorkflowAllowance({
          timeoutMs: options.timeoutMs,
          deadlineAt: options.deadlineAt,
          maxConcurrentCalls: options.maxConcurrentCalls ?? DEFAULT_DIRECT_WORKFLOW_MAX_CONCURRENT_CALLS,
          now: prepNow,
        });
        prepAllowance = created;
        prepTimeoutMs = created.timeoutMs;
      } catch (allowanceErr) {
        return makePrepFailureReport(
          allowanceErr instanceof Error ? allowanceErr : new Error(String(allowanceErr)),
          "error",
        );
      }
    } else if (prepAllowance) {
      prepTimeoutMs = Math.max(0, prepAllowance.deadlineAt - prepNow);
    }
    const prepController = new AbortController();
    let prepTimer: ReturnType<typeof setTimeout> | undefined;
    const onParentPrepAbort = () => {
      prepController.abort(options.signal?.reason ?? new Error(`Direct target "${requestedTarget}" cancelled before start`));
    };
    if (options.signal?.aborted) {
      onParentPrepAbort();
    } else if (options.signal) {
      options.signal.addEventListener("abort", onParentPrepAbort, { once: true });
    }
    if (prepAllowance && !prepController.signal.aborted) {
      const waitMs = Math.max(0, prepAllowance.deadlineAt - Date.now());
      prepTimer = setTimeout(() => {
        prepController.abort(
          new Error(
            prepAllowance.deadlineReason ??
              `Workflow "${requestedTarget}" timed out after ${prepTimeoutMs ?? waitMs}ms`,
          ),
        );
      }, waitMs);
      prepTimer.unref?.();
    }

    try {
      if (options.target) {
        if (!internal?.catalog) {
          preparedCatalog = await buildDirectPromptCatalog(
            { ...options, agentName: callerOwner },
            callerOwner,
            workflowDir,
            prepController.signal,
          );
          catalogCapturedAtRoot = true;
        }
        await loadTargetOwnerProcedures(requestedTarget, prepController.signal);
        if (isNativeCliFallback(requestedTarget)) {
          targetModule = {
            name: requestedTarget,
            description: `Direct CLI executor invocation for ${requestedTarget}`,
            ...(options.tools === "readonly" ? { readonly: true } : {}),
            async execute(ctx) {
              return options.outputSchema
                ? ctx.call(requestedTarget, ctx.input, {
                    schema: options.outputSchema,
                    ...(options.tools ? { tools: options.tools } : {}),
                  })
                : ctx.call(requestedTarget, ctx.input, {
                    ...(options.tools ? { tools: options.tools } : {}),
                  });
            },
          };
        } else {
          const resolved = resolveCallable(callerOwner, requestedTarget, preparedCatalog);
          if (resolved.kind === "code") {
            callerOwner = resolved.owner;
            targetModule = resolved.module as WorkflowExecutableModule<TInput>;
          } else {
            targetModule = {
              name: resolved.name,
              description: `Direct prompt invocation for ${resolved.name}`,
              ...(options.tools === "readonly" ? { readonly: true } : {}),
              async execute(ctx) {
                const baseOpts = {
                  ...(options.tools ? { tools: options.tools } : {}),
                  ...(options.skill ? { skill: options.skill } : {}),
                  ...(options.operationAllowance !== undefined
                    ? { operationAllowance: options.operationAllowance }
                    : {}),
                };
                return options.outputSchema
                  ? ctx.call(resolved.name, ctx.input, { ...baseOpts, schema: options.outputSchema })
                  : ctx.call(resolved.name, ctx.input, baseOpts);
              },
            };
          }
        }
      } else {
        const wfCatalog = await buildWorkflowCatalog(workflowDir!, prepController.signal, {
          onImportStart: () => {
            preparedCatalog.pendingImports += 1;
          },
          onImportSettled: () => {
            preparedCatalog.pendingImports -= 1;
          },
        });
        preparedCatalog.proceduresByOwner.set(initialOwner, wfCatalog.workflows);
        for (const diag of wfCatalog.diagnostics) {
          if (!preparedCatalog.diagnostics.includes(diag)) preparedCatalog.diagnostics.push(diag);
        }
        const found = findWorkflow(wfCatalog, requestedTarget);
        if (!found.workflow) {
          throw new Error(found.error ?? `Workflow "${requestedTarget}" not found`);
        }
        targetModule = found.workflow as WorkflowExecutableModule<TInput>;
      }
      preparedAllowance = prepAllowance;
    } catch (prepErr) {
      if (prepController.signal.aborted || preparedCatalog.pendingImports > 0) {
        const executionId =
          internal === undefined && options.executionId
            ? options.executionId
            : `wr_${prepNow}_${Math.random().toString(36).slice(2, 6)}`;
        const unconfirmed =
          preparedCatalog.pendingImports > 0
            ? [`workflow:${requestedTarget} (${executionId})`]
            : undefined;
        const effectiveError = unconfirmed
          ? new WorkflowUnconfirmedCleanupError(requestedTarget, unconfirmed, prepErr)
          : prepErr instanceof Error
            ? prepErr
            : new Error(String(prepErr));
        const status: WorkflowRunReport["status"] =
          !unconfirmed && options.signal?.aborted ? "interrupted" : "error";
        const result = makePrepFailureReport(effectiveError, status, unconfirmed);
        result.report.executionId = executionId;
        if (result.reportPath) {
          writeFileSync(result.reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
        }
        return result;
      }
      if (prepErr && typeof prepErr === "object" && !("cleanupConfirmed" in prepErr)) {
        try {
          Object.defineProperty(prepErr, "cleanupConfirmed", {
            value: preparedCatalog.pendingImports === 0,
            enumerable: false,
            configurable: true,
          });
        } catch {
          // Ignore frozen error objects.
        }
      }
      throw prepErr;
    } finally {
      clearTimeout(prepTimer);
      options.signal?.removeEventListener("abort", onParentPrepAbort);
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
  const executeCli = options.runCli ?? runCliAgent;

  let rootAllowance = internal?.allowance;
  if (!rootAllowance && !options.signal?.aborted) {
    try {
      const created = createWorkflowAllowance({
        timeoutMs: targetModule.executionTimeoutMs ?? options.timeoutMs,
        deadlineAt: options.deadlineAt,
        maxConcurrentCalls,
        now: rootStartedAt,
      });
      rootAllowance = preparedAllowance
        ? {
            deadlineAt: created.deadlineAt,
            ...(created.deadlineReason ? { deadlineReason: created.deadlineReason } : {}),
            ...(created.maxConcurrentCalls !== undefined
              ? { maxConcurrentCalls: created.maxConcurrentCalls }
              : {}),
            acquireCall: () => preparedAllowance.acquireCall(),
          }
        : created;
    } catch {
      // Pre-start deadline/timeout validation errors are surfaced cleanly by runWorkflowInvocation.
    }
  }

  const executeCliStep = async (
    tool: "codex" | "claude",
    prompt: string,
    callOpts: (CallOptions<TSchema> & { schema?: TSchema }) | undefined,
    stepControl: { signal: AbortSignal; timeoutMs: number; deadlineAt: number; stepIndex: number },
  ): Promise<WorkflowStepInvocationResult> => {
    if (callOpts?.tools === "readonly") {
      throw new Error(
        `Native CLI executor "${tool}" cannot enforce tools: "readonly" because native CLI runners execute with unrestricted sandbox permissions`,
      );
    }
    const cliSessionId = `direct_cli_${Date.now()}_${stepControl.stepIndex}`;
    const executionRoot = resolve(options.workRoot);
    const isObjectSchema =
      Boolean(callOpts?.schema) &&
      typeof callOpts?.schema === "object" &&
      (callOpts.schema as { type?: unknown }).type === "object";
    const cliRun = await executeCli(
      {
        tool,
        prompt,
        mode: "patch",
        sandbox: "danger-full-access",
        cwd: ".",
        timeoutMs: stepControl.timeoutMs,
        ...(isObjectSchema ? { expectedOutput: { format: "json" } } : {}),
      },
      {
        agentName: callerOwner,
        projectRoot: executionRoot,
        persistDir: options.outputRoot,
        sessionId: cliSessionId,
        signal: stepControl.signal,
        drainProcessGroup: options.drainProcessGroup,
      },
    );
    const status = cliRun.status === "completed" ? "done" : "error";
    let parsedOutput: unknown = cliRun.outputText;
    if (status === "done" && callOpts?.schema && typeof cliRun.outputText === "string") {
      try {
        parsedOutput = JSON.parse(cliRun.outputText);
      } catch {
        // Leave raw text so kernel schema check produces a structured schema diagnostic.
      }
    }
    return {
      id: cliRun.taskId,
      kind: "agent",
      status,
      summary: cliRun.summary || cliRun.error || `${tool} ${cliRun.status}`,
      ...(parsedOutput !== undefined ? { output: parsedOutput } : {}),
      facts: {
        tool: cliRun.tool,
        resultPath: cliRun.resultPath,
        eventsPath: cliRun.eventsPath,
        ...(cliRun.nativeSessionId ? { nativeSessionId: cliRun.nativeSessionId } : {}),
      },
      sessionId: cliSessionId,
      transcriptPath: cliRun.eventsPath,
      cleanupConfirmed: cliRun.cleanupConfirmed !== false,
    };
  };

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
        target: undefined,
        workflowName: wfName,
        outputSchema: undefined,
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

  const authoredModule = targetModule;
  let activeScopeSignal: AbortSignal | undefined;
  const outcome: WorkflowKernelOutcome = await runWorkflowInvocation({
    ...authoredModule,
    async execute(ctx) {
      activeScopeSignal = ctx.signal;
      if (!internal?.catalog && !catalogCapturedAtRoot) {
        const captured = await buildDirectPromptCatalog(
          { ...options, agentName: callerOwner },
          callerOwner,
          workflowDir,
          ctx.signal,
        );
        ctx.signal.throwIfAborted();
        for (const [name, entry] of captured.prompts) {
          preparedCatalog.prompts.set(name, entry);
        }
        for (const diag of captured.diagnostics) {
          if (!preparedCatalog.diagnostics.includes(diag)) {
            preparedCatalog.diagnostics.push(diag);
          }
        }
      }
      ctx.signal.throwIfAborted();
      return authoredModule.execute(ctx);
    },
  }, {
    executionId: internal ? undefined : options.executionId,
    startedAt: internal ? undefined : rootStartedAt,
    input: options.input,
    taskOwned: Boolean(options.task || options.reconciliation),
    tools: internal?.tools ?? options.tools,
    outputSchema: internal ? undefined : options.outputSchema,
    signal: options.signal,
    timeoutMs: targetModule.executionTimeoutMs ?? options.timeoutMs,
    deadlineAt: rootAllowance?.deadlineAt ?? options.deadlineAt,
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
    // Native imports cannot be forcibly stopped. Keep uncertainty visible if
    // preparation outlives this invocation, and fence its late continuation.
    confirmCleanup: () => preparedCatalog.pendingImports === 0,
    resolveTargetKind: async (target) => {
      try {
        if (activeScopeSignal) await loadTargetOwnerProcedures(target, activeScopeSignal);
        if (typeof target === "string" && isNativeCliFallback(target)) return "agent";
        const resolved = resolveCallable(callerOwner, target, preparedCatalog);
        return resolved.kind === "prompt" ? "agent" : "workflow";
      } catch {
        return typeof target === "string" && target.includes("/") ? "workflow" : "agent";
      }
    },
    callTarget: async (target, input, callOpts, stepControl) => {
      await loadTargetOwnerProcedures(target, stepControl.signal);
      if (typeof target === "string" && isNativeCliFallback(target)) {
        if (typeof input !== "string" || !input.trim()) {
          throw new Error(`CLI target "${target}" requires a non-empty string prompt input`);
        }
        return executeCliStep(target.trim() as "codex" | "claude", input, callOpts, stepControl);
      }
      const resolved = resolveCallable(callerOwner, target, preparedCatalog);
      if (resolved.kind === "prompt") {
        if (typeof input !== "string") {
          throw new Error(`Prompt target "${target}" requires a string prompt input`);
        }
        return executePromptStep(resolved.name, input, callOpts, stepControl);
      }
      return executeCodeStep(resolved.name, resolved.module, resolved.owner, input, stepControl, callOpts);
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
 * Unified standalone entrypoint for prompt agents ("alex"), code procedures ("tech-lead/verified-coder"), and CLI executors ("codex").
 */
export const runDirect = runDirectWorkflow;

export function inferWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);
  for (;;) {
    if (existsSync(join(current, "projects")) && existsSync(join(current, "shared"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(startDir);
}

function inferCwdAppName(cwd: string, projectsRoot: string): string | undefined {
  const resolvedCwd = resolve(cwd);
  const resolvedProjects = resolve(projectsRoot);
  if (!resolvedCwd.startsWith(`${resolvedProjects}/`)) return undefined;
  const rest = resolvedCwd.slice(resolvedProjects.length + 1);
  const firstSegment = rest.split("/")[0];
  return firstSegment && firstSegment.endsWith(".app") ? firstSegment : undefined;
}

export type RunOptions<TInput = unknown> = Omit<
  DirectWorkflowRunOptions<TInput>,
  "input" | "projectRoot" | "workRoot" | "agentsRoot" | "sharedRoot" | "outputRoot" | "models"
> & {
  /** Optional App disambiguator when two Apps define the same agent name (e.g. `"alex.app"`). */
  app?: string;
  /** Working directory for tools and execution (defaults to `process.cwd()`). */
  cwd?: string;
  input?: TInput;
  projectRoot?: string;
  workRoot?: string;
  agentsRoot?: string;
  sharedRoot?: string;
  outputRoot?: string;
  models?: Record<string, ModelWithApiKey>;
};

export type StandaloneRunOptions<TInput = unknown> = RunOptions<TInput>;
export type RunResult = DirectWorkflowRunResult;

export type TargetSummary = {
  target: string;
  kind: "prompt" | "code" | "cli";
  owner: string;
  app?: string;
  description: string;
};

export type DiscoveredTargetSummary = TargetSummary;

export const DEFAULT_STANDALONE_LIST_TIMEOUT_MS = 15_000;

export async function listTargets(options: {
  cwd?: string;
  projectRoot?: string;
  projectsRoot?: string;
  globalAgentsRoot?: string;
  app?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
} = {}): Promise<TargetSummary[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STANDALONE_LIST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid listStandaloneTargets timeoutMs: ${String(options.timeoutMs)}`);
  }
  options.signal?.throwIfAborted();
  const listController = new AbortController();
  const onParentAbort = () => {
    listController.abort(options.signal?.reason ?? new Error("Target discovery cancelled"));
  };
  if (options.signal) {
    options.signal.addEventListener("abort", onParentAbort, { once: true });
  }
  const timer = setTimeout(() => {
    listController.abort(new Error(`Target discovery timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const cwd = resolve(options.cwd ?? process.cwd());
    const projectRoot = resolve(options.projectRoot ?? inferWorkspaceRoot(cwd));
    const projectsRoot = resolve(options.projectsRoot ?? join(projectRoot, "projects"));
    const globalAgentsRoot = resolve(options.globalAgentsRoot ?? join(projectRoot, "agents"));
    const appFilter = options.app?.trim()
      ? options.app.trim().endsWith(".app")
        ? options.app.trim()
        : `${options.app.trim()}.app`
      : undefined;

    const rawDirs = listRuntimeAgentDirectories(
      globalAgentsRoot,
      projectsRoot,
      projectsRoot,
      appFilter ? [appFilter] : undefined,
    );
    const dedupedByPath = new Map<string, AgentDirectory>();
    for (const dir of rawDirs) {
      const key = resolve(dir.dir);
      const prev = dedupedByPath.get(key);
      if (!prev || (!prev.projectId && dir.projectId)) {
        dedupedByPath.set(key, dir);
      }
    }
    const dirs = [...dedupedByPath.values()];

    const ownersByScope = new Map<string, { dir: AgentDirectory; config: AgentConfig }[]>();
    for (const dir of dirs) {
      listController.signal.throwIfAborted();
      if (appFilter && dir.projectId !== appFilter.slice(0, -".app".length)) {
        continue;
      }
      let config: AgentConfig | null = null;
      try {
        config = readAgentConfigFile(dir.dir);
      } catch {
        continue;
      }
      if (!config) continue;
      const scopeKey = `${dir.projectId ?? ""}:${config.name}`;
      const list = ownersByScope.get(scopeKey) ?? [];
      list.push({ dir, config });
      ownersByScope.set(scopeKey, list);
    }

    const items: DiscoveredTargetSummary[] = [];
    for (const [, entries] of ownersByScope) {
      listController.signal.throwIfAborted();
      // Skip ambiguous owner definitions within the same scope.
      if (entries.length !== 1) continue;
      const { dir, config } = entries[0]!;
      const app = dir.projectId ? `${dir.projectId}.app` : undefined;
      items.push({
        target: config.name,
        kind: "prompt",
        owner: config.name,
        ...(app ? { app } : {}),
        description: config.description,
      });
      const wfDir = join(dir.dir, "workflows");
      if (existsSync(wfDir)) {
        const catalog = await buildWorkflowCatalog(wfDir, listController.signal);
        listController.signal.throwIfAborted();
        for (const wf of catalog.workflows.values()) {
          items.push({
            target: `${config.name}/${wf.name}`,
            kind: "code",
            owner: config.name,
            ...(app ? { app } : {}),
            description: wf.description,
          });
        }
      }
    }
    if (!appFilter) {
      items.push(
        { target: "codex", kind: "cli", owner: "codex", description: "Built-in Codex CLI executor" },
        { target: "claude", kind: "cli", owner: "claude", description: "Built-in Claude CLI executor" },
      );
    }
    return items.sort((a, b) => a.target.localeCompare(b.target));
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}

export const listStandaloneTargets = listTargets;

function normalizeAppDirName(app: string): string {
  const trimmed = app.trim();
  return trimmed.endsWith(".app") ? trimmed : `${trimmed}.app`;
}

function parseTargetAndOptionalAppPrefix(
  rawTarget: string,
  explicitApp?: string,
): { target: string; app?: string } {
  const trimmed = rawTarget.trim();
  const parts = trimmed.split("/").map((p) => p.trim());
  if (parts.length === 3 && parts[0]?.endsWith(".app") && parts[1] && parts[2]) {
    if (explicitApp && normalizeAppDirName(explicitApp) !== parts[0]) {
      throw new Error(
        `Conflicting App scope: target "${rawTarget}" specifies "${parts[0]}" while --app specifies "${explicitApp}"`,
      );
    }
    return { target: `${parts[1]}/${parts[2]}`, app: parts[0] };
  }
  if (parts.length === 2 && parts[0]?.endsWith(".app") && parts[1]) {
    if (explicitApp && normalizeAppDirName(explicitApp) !== parts[0]) {
      throw new Error(
        `Conflicting App scope: target "${rawTarget}" specifies "${parts[0]}" while --app specifies "${explicitApp}"`,
      );
    }
    return { target: parts[1], app: parts[0] };
  }
  return {
    target: trimmed,
    ...(explicitApp?.trim() ? { app: normalizeAppDirName(explicitApp) } : {}),
  };
}

function discoverAgentsRootForTarget(params: {
  target: string;
  explicitApp?: string;
  explicitAgentsRoot?: string;
  agentName?: string;
  cwd: string;
  projectsRoot: string;
  globalAgentsRoot: string;
  agentFixtures?: Record<string, DirectAgentFixtureHandler>;
}): string {
  if (params.explicitAgentsRoot) return resolve(params.explicitAgentsRoot);
  if (params.explicitApp) {
    return resolve(join(params.projectsRoot, normalizeAppDirName(params.explicitApp), "agents"));
  }

  const candidateOwner =
    params.agentName?.trim() ||
    (params.target.includes("/")
      ? params.target.slice(0, params.target.indexOf("/")).trim()
      : params.target.trim());

  if (!candidateOwner || params.agentFixtures?.[candidateOwner]) {
    return params.globalAgentsRoot;
  }

  const dirs = [...new Map(
    listRuntimeAgentDirectories(params.globalAgentsRoot, params.projectsRoot).map((d) => [resolve(d.dir), d]),
  ).values()];

  const matches: AgentDirectory[] = [];
  for (const dir of dirs) {
    try {
      const cfg = readAgentConfigFile(dir.dir);
      if (cfg && cfg.name === candidateOwner) {
        matches.push(dir);
      }
    } catch {
      // Malformed unrelated agent configs are surfaced as diagnostics if their App is selected.
    }
  }

  const appMatches = matches.filter((m) => Boolean(m.projectId));
  if (appMatches.length === 1) {
    return resolve(appMatches[0]!.agentsRoot);
  }
  if (appMatches.length > 1) {
    const cwdApp = inferCwdAppName(params.cwd, params.projectsRoot);
    if (cwdApp) {
      const inCwdApp = appMatches.find((m) => `${m.projectId}.app` === cwdApp);
      if (inCwdApp) return resolve(inCwdApp.agentsRoot);
    }
    const apps = appMatches.map((m) => `${m.projectId}.app`).sort();
    throw new Error(
      `Target owner "${candidateOwner}\" exists in multiple Apps (${apps.join(", ")}); specify "${apps[0]}/${params.target}" or pass --app ${apps[0]}`,
    );
  }
  return params.globalAgentsRoot;
}

/**
 * Run any prompt agent, code procedure, or native CLI executor standalone—either
 * with positional `(target, input, options?)` or an options object `run(options)`—
 * auto-discovering the owning App from `<projectRoot>/projects/*.app` without requiring `--app`.
 */
export async function run<TInput = unknown>(
  target: string,
  input: TInput,
  options?: RunOptions<TInput>,
): Promise<RunResult>;
export async function run<TInput = unknown>(
  options: RunOptions<TInput> & { input: TInput },
): Promise<RunResult>;
export async function run<TInput = unknown>(
  targetOrOptions: string | (RunOptions<TInput> & { input: TInput }),
  maybeInput?: TInput,
  maybeOptions: RunOptions<TInput> = {},
): Promise<RunResult> {
  const isPositional = typeof targetOrOptions === "string";
  const options: RunOptions<TInput> = isPositional ? maybeOptions : targetOrOptions;
  const input = (isPositional ? maybeInput : targetOrOptions.input) as TInput;
  const rawTarget = isPositional ? targetOrOptions : (options.target ?? "");

  const cwd = resolve(options.cwd ?? process.cwd());
  const projectRoot = resolve(options.projectRoot ?? inferWorkspaceRoot(cwd));
  const workRoot = resolve(options.workRoot ?? cwd);
  const projectsRoot = resolve(options.projectsRoot ?? join(projectRoot, "projects"));
  const globalAgentsRoot = resolve(options.globalAgentsRoot ?? join(projectRoot, "agents"));

  const { target: normalizedTarget, app: resolvedApp } = rawTarget
    ? parseTargetAndOptionalAppPrefix(rawTarget, options.app)
    : {
        target: "",
        ...(options.app?.trim() ? { app: normalizeAppDirName(options.app) } : {}),
      };

  const agentsRoot = discoverAgentsRootForTarget({
    target: normalizedTarget,
    explicitApp: resolvedApp,
    explicitAgentsRoot: options.agentsRoot,
    agentName: options.agentName,
    cwd,
    projectsRoot,
    globalAgentsRoot,
    agentFixtures: options.agentFixtures,
  });

  const sharedRoot = resolve(options.sharedRoot ?? join(projectRoot, "shared"));
  const ownsTempOutputRoot = !options.outputRoot;
  const outputRoot = options.outputRoot
    ? resolve(options.outputRoot)
    : mkdtempSync(join(tmpdir(), "may-run-"));
  const models = options.models ?? createModelRegistry();

  let cleanupConfirmed = false;
  try {
    const res = await runDirectWorkflow({
      ...options,
      ...(normalizedTarget ? { target: normalizedTarget } : {}),
      input,
      projectRoot,
      workRoot,
      agentsRoot,
      sharedRoot,
      projectsRoot,
      globalAgentsRoot,
      ...(resolvedApp ? { appScope: resolvedApp } : {}),
      outputRoot,
      models,
    });
    cleanupConfirmed = res.report.cleanup.confirmed === true;
    const retainOutputRoot = !ownsTempOutputRoot || Boolean(options.traceDir) || !cleanupConfirmed;
    return retainOutputRoot ? { ...res, outputRoot } : res;
  } catch (err) {
    cleanupConfirmed =
      Boolean(err) &&
      typeof err === "object" &&
      (err as { cleanupConfirmed?: unknown }).cleanupConfirmed === true;
    if (!cleanupConfirmed && err && typeof err === "object" && !("outputRoot" in err)) {
      try {
        Object.defineProperty(err, "outputRoot", {
          value: outputRoot,
          enumerable: true,
          configurable: true,
        });
      } catch {
        // Ignore frozen error objects.
      }
    }
    throw err;
  } finally {
    if (ownsTempOutputRoot && !options.traceDir && cleanupConfirmed) {
      try {
        rmSync(outputRoot, { recursive: true, force: true });
      } catch {
        // Best-effort scratch cleanup.
      }
    }
  }
}
