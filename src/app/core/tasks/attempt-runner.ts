import {
  admitTaskVerificationResult as admitAppTaskVerificationResult,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskReconcileResult as AppTaskHandlerResult,
  type TaskIntent as AppTaskIntent,
  type TaskAction,
} from "@may-agent/sdk";
import { join } from "node:path";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import type { EventEnvelope } from "../events/bus.js";
import { childEventTrace, type AgentEvent, type EventBus } from "../events/bus.js";
import { completeConversationTaskTurn, isConversationTask } from "../state/conversation-task-turns.js";
import { appTaskExecutionPaths, withAppTaskWorkspace, type AppTaskExecutionPaths } from "./app-task-output-paths.js";
import {
  assertAppTaskClaimCurrent,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  expiredAgentSessionAppTaskAttempt,
  failAppTaskAttempt,
  hasPendingAppTaskFacts,
  isAppTaskActionStaleError,
  markAppTaskAttention,
  readAppTaskChildContext,
  readAppTaskLiveSnapshot,
  readPendingAppTaskTrigger,
  recordAppTaskAttemptWorkspace,
  releaseStaleAppTaskResult,
  releaseTerminalSessionExpiredAppTaskAttempt,
  reportAppTaskFailure,
  type AppTaskClaim,
} from "./app-task-reconciler.js";
import { ResourceTaskMutationStaleError, type AppTaskContext } from "./app-task-store.js";
import {
  hasLiveAppTaskSession,
  interruptSupersededActionSessions,
  interruptSupersededAgentSession,
  runRegisteredTaskExecutor,
  runTaskAgent,
  runTaskCapability,
  runTaskExecutorAttempt,
} from "./attempt-execution.js";
import { type AppTaskDispatch } from "./controller.js";
import {
  admitTaskAppDependencies,
  mergeTaskConditions,
  openTaskAppDependencyConditions,
  recoverTaskConditions,
} from "./dependency-admission.js";
import type { AppTaskExecutionObserver } from "./execution.js";
import { type TaskCapabilityRun } from "./result.js";
import {
  appTaskConfig,
  standaloneAppTaskAdmissionDescriptors,
  type AppTaskRuntimeDescriptor,
} from "./runtime-definition.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";
import type { PreparedTaskWorkspace } from "./workspace.js";

export type AppTaskTiming = {
  dispatch: AppTaskDispatch;
  claimMs?: number;
  contextBuildMs?: number;
  providerStartMs?: number;
  providerMs?: number;
  resultPersistenceMs: number;
  promptBytes?: number;
  attemptId?: string;
  generation?: number;
  outcome?: "completed" | "failed";
};

export async function runTaskAttempt(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  taskId: string;
  dispatch: AppTaskDispatch;
  reason?: string;
  reportTiming: (timing: AppTaskTiming) => void;
}): Promise<string[]> {
  const { opts, descriptor } = input;

  const timing: AppTaskTiming = {
    dispatch: input.dispatch,
    resultPersistenceMs: 0,
    outcome: "completed",
  };
  let providerStartedAt: number | undefined;
  const observer: AppTaskExecutionObserver = {
    providerStarted(promptBytes) {
      const now = Date.now();
      timing.promptBytes = promptBytes;
      timing.providerStartMs = Math.max(0, now - input.dispatch.startedAt);
      providerStartedAt = now;
    },
    providerFinished() {
      if (providerStartedAt !== undefined) timing.providerMs = Math.max(0, Date.now() - providerStartedAt);
    },
  };
  const persistResult = <T,>(operation: () => T): T => {
    const startedAt = performance.now();
    try {
      try {
        return operation();
      } catch (error) {
        if (!(error instanceof ResourceTaskMutationStaleError)) throw error;
        // The failed transaction applied nothing. Re-read current resources
        // and recheck every claim/action fence once, without rerunning the
        // handler or replaying provider effects. Semantic staleness is not
        // transaction contention and must still return to reconciliation.
        return operation();
      }
    } finally {
      timing.resultPersistenceMs += Math.max(0, performance.now() - startedAt);
    }
  };
  let activeConfig: ReturnType<typeof appTaskConfig> | undefined;
  let activeClaim: AppTaskClaim | undefined;
  let cleanupFailed = false;
  const prepareSupersededSessions = (sessionIds: string[]) => {
    try {
      interruptSupersededActionSessions(opts, input.taskId, sessionIds);
    } catch (error) {
      cleanupFailed = true;
      throw error;
    }
  };

  try {
    const config = appTaskConfig(descriptor);
    activeConfig = config;
    const claimStartedAt = performance.now();
    const primary = claimObservedAppTask(config, {
      taskId: input.taskId,
      appAgent: descriptor.agent,
      handler: "auto",
      reason: input.reason ?? "task-controller",
      recoverSessionHandoff: (attempt) => opts.sessions?.handoff(attempt),
    });
    timing.claimMs = Math.max(0, performance.now() - claimStartedAt);
    if (primary.kind !== "claimed") {
      if (primary.kind === "busy") {
        const active = primary.attemptId ? config.resourceStore.readAttempt(primary.attemptId) : null;
        const leaseCheckAt = Date.now();
        const sessionActivity =
          active?.sessionId && opts.persistDir
            ? {
                sessionId: active.sessionId,
                lastActivityAt: opts.sessions?.lastActivityAt(active.sessionId) ?? null,
              }
            : undefined;
        const expired = expiredAgentSessionAppTaskAttempt(config, input.taskId, leaseCheckAt, sessionActivity);
        const sessionId = expired?.sessionId;
        const session = sessionId && opts.persistDir ? opts.sessions?.read(sessionId) : null;
        const terminalStatus =
          session?.status === "done" || session?.status === "error" || session?.status === "interrupted"
            ? session.status
            : null;
        if (expired && sessionId && terminalStatus && !hasLiveAppTaskSession(opts, sessionId)) {
          // A session artifact is facts, not an accepted Task result. Drain
          // the exact old execution before retrying through normal settlement.
          interruptSupersededAgentSession(opts, sessionId, "Retrying an uncommitted Task attempt", input.taskId);
          const released = releaseTerminalSessionExpiredAppTaskAttempt(
            config,
            { ...expired, sessionId, terminalStatus },
            `Expired reconciliation ${input.taskId} lost its synchronous caller after agent session completion`,
            leaseCheckAt,
            sessionActivity,
          );
          if (released.released) {
            emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.recovery.requeued", input.taskId, {
              route: "task-controller",
              reason: "terminal-agent-session-expired-lease",
              attemptId: expired.attemptId,
              factsSessionId: sessionId,
              terminalStatus,
            });
            return [input.taskId];
          }
        }
      }
      const skip =
        primary.kind === "busy"
          ? { reason: "attempt-active", attemptId: primary.attemptId }
          : primary.kind === "waiting"
            ? primary.dependencyIds?.length
              ? { reason: "dependencies-open", dependencyIds: primary.dependencyIds }
              : { reason: "conditions-open", conditionIds: primary.conditionIds }
            : primary.kind === "attention"
              ? { reason: "attention-required", generation: primary.generation, summary: primary.summary }
              : { reason: "already-completed", generation: primary.generation };
      emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.reconcile.skipped", input.taskId, {
        route: "task-controller",
        ...skip,
      });
      return [];
    }
    activeClaim = primary;
    timing.attemptId = primary.attemptId;
    timing.generation = primary.generation;
    for (const sessionId of primary.supersededSessionIds ?? []) {
      interruptSupersededAgentSession(
        opts,
        sessionId,
        `Task ${primary.taskId} superseded an orphaned agent session while recovering the current generation`,
        primary.taskId,
      );
    }
    const intent = primary.intent;
    const conversation = isConversationTask(config, primary.taskId);
    const event = primary.trigger as EventEnvelope | undefined;
    const contextStartedAt = performance.now();
    const childContext = readAppTaskChildContext(config, primary.taskId);
    const taskSnapshot = readAppTaskLiveSnapshot(config, primary.taskId);
    timing.contextBuildMs = Math.max(0, performance.now() - contextStartedAt);
    let executionPaths = appTaskExecutionPaths(descriptor.appDir, descriptor.projectDir);
    const declaredOutputPaths = primary.declaredOutputPaths;
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
      route: "task-controller",
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      owner: primary.agent,
    });

    // Claiming a task rewrites the canonical state plus its disposable route and
    // read projections. On large retained trees that synchronous durability
    // boundary is substantial. Yield before agent/workflow association can
    // perform another state rewrite, so HTTP readiness and accepted event
    // ingress get an observable turn inside one reconciliation (not merely
    // between separate claims).
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const workflowKey = primary.handler.startsWith("workflow:") ? primary.handler.slice("workflow:".length) : "";
    const executorKey = primary.handler.startsWith("executor:")
      ? primary.handler.slice("executor:".length)
      : primary.handler.startsWith("cli:")
        ? primary.handler.slice("cli:".length)
        : "";
    let taskWorkspace: PreparedTaskWorkspace | undefined;
    let workspaceFinalized = false;
    const finalizeWorkspace = async (outcome: "accepted" | "waiting" | "failed") => {
      if (!taskWorkspace || workspaceFinalized) return { ok: true as const };
      try {
        const finalized = await opts.workspaces!.finalize(taskWorkspace, outcome);
        workspaceFinalized = true;
        persistResult(() => recordAppTaskAttemptWorkspace(config, primary, finalized.metadata));
        return finalized;
      } catch (error) {
        workspaceFinalized = true;
        taskWorkspace.metadata.disposition = "retained-for-recovery";
        persistResult(() => recordAppTaskAttemptWorkspace(config, primary, taskWorkspace!.metadata));
        return {
          ok: false as const,
          metadata: taskWorkspace.metadata,
          reason: `Task workspace finalization failed and was retained for recovery: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    };
    let primaryResult: TaskCapabilityRun | undefined;
    const workflowWorkspace =
      workflowKey && opts.workflows
        ? (
            await opts.workflows.inspect({
              source: opts,
              appDir: descriptor.appDir,
              agent: primary.agent,
              workflow: workflowKey,
            })
          ).workspace
        : undefined;
    const workflowNeedsWorktree =
      workflowWorkspace === "task" || (typeof workflowWorkspace === "object" && workflowWorkspace.kind === "task");
    // Both execution paths share workspace lineage, admission fencing, and
    // failure handling. Only the workflow may override the App's base branch.
    if (!conversation && (workflowNeedsWorktree || (executorKey && descriptor.app.workspace?.kind === "git"))) {
      try {
        if (descriptor.app.workspace?.kind !== "git") {
          throw new Error(`Workflow ${workflowKey} requires a task worktree but app workspace is not Git`);
        }
        if (!opts.workspaces) throw new Error("Task workspace backend is not installed");
        const previous = Object.values(
          config.resourceStore.readTaskContext({ taskIds: [primary.taskId] }).attempts ?? {},
        )
          .filter(
            (attempt) =>
              attempt.taskId === primary.taskId &&
              attempt.taskGeneration === primary.generation &&
              attempt.workspace?.kind === "task-worktree",
          )
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]?.workspace;
        taskWorkspace = await opts.workspaces.prepare({
          repoDir: descriptor.projectDir,
          workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
          taskId: primary.taskId,
          generation: primary.generation,
          baseBranch:
            typeof workflowWorkspace === "object"
              ? workflowWorkspace.baseBranch
              : (descriptor.app.workspace.branch ?? "dev"),
          previous,
        });
        executionPaths = withAppTaskWorkspace(executionPaths, taskWorkspace.metadata.path);
        if (!recordAppTaskAttemptWorkspace(config, primary, taskWorkspace.metadata)) {
          throw new Error(`Task attempt ${primary.attemptId} became stale while preparing its workspace`);
        }
      } catch (error) {
        primaryResult = {
          handlerResult: {
            state: "error",
            summary: `Task workspace preparation failed: ${error instanceof Error ? error.message : String(error)}`,
            facts: [],
            actions: [],
          },
          runId: null,
          workspacePreparationFailed: true,
        };
      }
    }
    if (conversation) {
      primaryResult = await runTaskExecutorAttempt({
        opts,
        descriptor,
        claim: primary,
        executionPaths,
        declaredOutputPaths,
        childContext,
        event,
        execute: async (attempt) => {
          if (!descriptor.app.conversation || !opts.conversations)
            throw new Error(`App ${descriptor.id} Conversation executor is unavailable`);
          const registry = opts.appRegistrySnapshot ?? opts.appRegistry?.snapshot();
          if (!registry) throw new Error("Conversation execution requires an installed App registry");
          try {
            observer.providerStarted(0);
            const proposal = await opts.conversations.execute({
              config,
              claim: primary,
              app: descriptor.app,
              registry,
              signal: attempt.signal,
              getTaskApp(appId) {
                const entry = registry.entries.find(({ definition }) => definition.id === appId);
                if (!entry?.definition.tasks || !opts.persistDir)
                  throw new Error(`App ${appId} has no installed Task capability`);
                const target =
                  appId === descriptor.id
                    ? descriptor
                    : standaloneAppTaskAdmissionDescriptors({
                        persistDir: opts.persistDir,
                        projectsRoot: opts.projectsRoot,
                        entries: [entry],
                      }).get(appId)!;
                return { app: target.app, config: appTaskConfig(target) };
              },
            });
            return {
              handlerResult: {
                state: "converged",
                summary: proposal.decision.summary,
                response: proposal.decision.response,
                result: { conversation: proposal.decision },
                facts: proposal.decision.facts ?? [],
                actions: [],
              },
              runId: primary.attemptId,
              conversation: proposal,
            };
          } finally {
            observer.providerFinished();
          }
        },
      });
    } else if (workflowKey) {
      primaryResult ??= await runTaskCapability({
        opts,
        descriptor,
        capability: {
          workflow: workflowKey,
          agent: primary.agent,
          task: `Reconcile task through workflow ${workflowKey}`,
        },
        claim: primary,
        executionPaths,
        declaredOutputPaths,
        childContext,
        taskSnapshot,
        event,
        ...(primary.handoff
          ? {
              fallbackReason: `${primary.handoff.reason}: ${primary.handoff.summary}${
                primary.handoff.facts.length
                  ? `\nHandoff facts:\n${primary.handoff.facts.map((entry) => `- ${entry}`).join("\n")}`
                  : ""
              }`,
            }
          : {}),
        observer,
      });
    } else if (executorKey) {
      const registered = opts.executors?.[executorKey];
      if (registered) {
        primaryResult ??= await runRegisteredTaskExecutor({
          opts,
          descriptor,
          claim: primary,
          executionPaths,
          declaredOutputPaths,
          childContext,
          event,
          observer,
          name: executorKey,
          execute: registered,
        });
      } else {
        primaryResult ??= {
          handlerResult: {
            state: "error",
            summary: `Task executor ${executorKey} is not registered`,
            facts: [],
            actions: [],
          },
          runId: null,
          unavailable: true,
        };
      }
    } else {
      const handoffWorkflow =
        primary.handoff && intent.workflow
          ? await opts.workflows?.inspect({
              source: opts,
              appDir: descriptor.appDir,
              agent: primary.agent,
              workflow: intent.workflow,
            })
          : undefined;
      if (primary.handoff && intent.workflow && !handoffWorkflow?.available) {
        primaryResult = {
          handlerResult: {
            state: "error",
            summary: handoffWorkflow?.error ?? "Task workflow runner is not installed",
            facts: [],
            actions: [],
          },
          runId: null,
          unavailable: true,
        };
      } else {
        primaryResult = await runTaskAgent({
          opts,
          descriptor,
          claim: primary,
          executionPaths,
          declaredOutputPaths,
          childContext,
          event,
          ...(primary.handoff
            ? {
                fallbackReason: `${primary.handoff.reason}: ${primary.handoff.summary}${
                  primary.handoff.facts.length
                    ? `\nHandoff facts:\n${primary.handoff.facts.map((entry) => `- ${entry}`).join("\n")}`
                    : ""
                }`,
              }
            : {}),
          observer,
        });
      }
      if (handoffWorkflow?.verifier) primaryResult!.verifier = handoffWorkflow.verifier;
    }

    if (!primaryResult) throw new Error(`Task ${primary.taskId} produced no handler result`);

    const primaryHandlerResult = primaryResult.handlerResult;
    const rejectStaleEffect = (error: unknown) => {
      const stale = recoverStaleTaskActionResult(config, primary, error);
      if (!stale) return null;
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: "stale",
        input: intent.input ?? {},
        summary: error instanceof Error ? error.message : String(error),
        facts: primaryHandlerResult.facts,
        staleRecovery: stale.staleRecovery,
        workflowRunId: primaryResult.runId,
      });
      return stale;
    };
    const fenceWorkspaceFinalization = async () => {
      if (!taskWorkspace) return null;
      try {
        assertAppTaskClaimCurrent(config, primary);
        return null;
      } catch (error) {
        await finalizeWorkspace("failed");
        const stale = rejectStaleEffect(error);
        if (!stale) throw error;
        return stale;
      }
    };
    if (
      primaryHandlerResult.state === "converged" &&
      primary.handoff?.reason === "needs-agent" &&
      intent.workflow &&
      !primaryResult.verifier
    ) {
      primaryHandlerResult.state = "error";
      primaryHandlerResult.summary = `Agent convergence was rejected because workflow ${intent.workflow} handed off without a verifier`;
      primaryResult.handlerBlocked = true;
    }
    if (primaryResult.unavailable) {
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.handler.unavailable", intent.id, {
        generation: primary.generation,
        handler: primary.handler,
        condition: "HandlerUnavailable",
        reason: primaryHandlerResult.summary,
      });
    }
    if (primaryHandlerResult.state === "incomplete") {
      const stale = await fenceWorkspaceFinalization();
      if (stale) return stale.reconcileTaskIds;
      // An incomplete report does not accept or discard workspace output. Retain it using
      // the existing failed-attempt policy, including any cleanup limitation.
      const finalized = await finalizeWorkspace("failed");
      const facts = [
        ...primaryHandlerResult.facts,
        ...(taskWorkspace ? [taskWorkspace.metadata.path] : []),
        ...(!finalized.ok && finalized.reason ? [finalized.reason] : []),
      ];
      try {
        const applied = persistResult(() =>
          reportAppTaskFailure(config, primary, {
            ...primaryHandlerResult,
            facts,
            acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
          }),
        );
        const staleResult = applied.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          disposition: applied.status === "applied" ? "incomplete" : "stale",
          summary: applied.summary ?? primaryHandlerResult.summary,
          facts,
        });
        return staleResult?.reconcileTaskIds ?? [];
      } catch (error) {
        const staleResult = rejectStaleEffect(error);
        if (staleResult) return staleResult.reconcileTaskIds;
        primaryResult.handlerBlocked = true;
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `Incomplete report was rejected: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (primaryHandlerResult.state === "converged") {
      const accepted = await establishTaskAcceptance({
        descriptor,
        intent,
        claim: primary,
        capability: primaryResult,
        executionPaths,
      });
      const acceptanceBasis = accepted.ok ? accepted.acceptanceBasis : undefined;
      if (!accepted.ok) {
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = accepted.summary;
        primaryHandlerResult.facts = accepted.facts;
        // Rejected acceptance needs new facts or an owner decision, not a
        // transport retry of the same workflow and its external effects.
        primaryResult.handlerBlocked = true;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.verification.failed", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          summary: accepted.summary,
          facts: accepted.facts,
          workflowRunId: primaryResult.runId,
        });
      } else {
        const stale = await fenceWorkspaceFinalization();
        if (stale) return stale.reconcileTaskIds;
        // Keep reusable work when a newer observation still needs judgment.
        // Completion below records progress instead of granting acceptance.
        const finalized = await finalizeWorkspace(
          hasPendingAppTaskFacts(config, primary, primaryResult.acceptedLiveEventIds) ? "waiting" : "accepted",
        );
        if (!finalized.ok) {
          // A retained dirty/unintegrated workspace needs inspection, not an
          // identical replay of the handler's already rejected completion.
          primaryResult.handlerBlocked = true;
          primaryHandlerResult.state = "error";
          primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
          primaryHandlerResult.facts = [
            ...primaryHandlerResult.facts,
            taskWorkspace?.metadata.path ?? executionPaths.workspaceDir,
          ];
        }
      }
      if (primaryHandlerResult.state === "converged" && acceptanceBasis) {
        try {
          const apply: ReturnType<typeof completeConversationTaskTurn> = persistResult(() =>
            primaryResult.conversation
              ? completeConversationTaskTurn(config, primary, primaryResult.conversation.decision, {
                  followUp: primaryResult.conversation.followUp,
                  taskControls: primaryResult.conversation.taskControls,
                  acceptanceBasis,
                })
              : completeAppTask(config, primary, {
                  summary: primaryHandlerResult.summary,
                  response: primaryHandlerResult.response,
                  result: primaryHandlerResult.result,
                  facts: primaryHandlerResult.facts,
                  actions: primaryHandlerResult.actions,
                  acceptanceBasis,
                  acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
                  prepareSupersededSessions,
                }),
          );
          const appliedDisposition = taskCompletionDisposition(
            primary.taskId,
            primaryHandlerResult.actions,
            apply.taskContinues,
          );
          const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
          emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
            generation: primary.generation,
            attemptId: primary.attemptId,
            handler: primary.handler,
            disposition: apply.status === "applied" ? appliedDisposition : "stale",
            outcome: intent.outcome,

            owner: intent.owner ?? descriptor.agent,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            ...(intent.executor ? { executor: intent.executor } : {}),
            acceptance: intent.acceptance,
            input: intent.input ?? {},
            summary: primaryHandlerResult.summary,
            ...(primaryHandlerResult.response ? { response: primaryHandlerResult.response } : {}),
            ...(primaryHandlerResult.result ? { result: primaryHandlerResult.result } : {}),
            facts: primaryHandlerResult.facts,
            acceptanceBasis,
            actionsApplied: apply.actionsApplied,
            ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
            workflowRunId: primaryResult.runId,
          });
          for (const cancelled of apply.cancelledTasks ?? []) publishTaskCancellation(opts.bus, cancelled);
          if (apply.admittedTasks) {
            for (const admitted of apply.admittedTasks) {
              // This post-commit hint also crosses the existing worker event
              // bridge. Durable readiness remains the recovery authority.
              opts.bus.emit({
                type: "app.task.ready",
                source: `app-task:${descriptor.id}:task-reconciler`,
                owner: `app:${descriptor.id}`,
                target: admitted,
                data: admitted,
              });
            }
          }
          return stale?.reconcileTaskIds ?? apply.dependentTaskIds;
        } catch (error) {
          if (cleanupFailed) throw error;
          const stale = recoverStaleTaskActionResult(config, primary, error);
          if (stale) {
            const summary = error instanceof Error ? error.message : String(error);
            emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
              generation: primary.generation,
              attemptId: primary.attemptId,
              handler: primary.handler,
              disposition: "stale",
              outcome: intent.outcome,

              owner: intent.owner ?? descriptor.agent,
              ...(intent.workflow ? { workflow: intent.workflow } : {}),
              ...(intent.executor ? { executor: intent.executor } : {}),
              input: intent.input ?? {},
              summary,
              facts: primaryHandlerResult.facts,
              staleRecovery: stale.staleRecovery,
              workflowRunId: primaryResult.runId,
            });
            return stale.reconcileTaskIds;
          }
          primaryHandlerResult.state = "error";
          primaryHandlerResult.summary = `Handler actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      const stale = await fenceWorkspaceFinalization();
      if (stale) return stale.reconcileTaskIds;
      const finalized = await finalizeWorkspace("waiting");
      if (!finalized.ok) {
        primaryResult.handlerBlocked = true;
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
        primaryHandlerResult.facts = [
          ...primaryHandlerResult.facts,
          taskWorkspace?.metadata.path ?? executionPaths.workspaceDir,
        ];
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      try {
        const existingAppDependencyConditions = openTaskAppDependencyConditions(config, primary.taskId);
        const dependencyConditions = primaryHandlerResult.dependencies?.length
          ? admitTaskAppDependencies({
              opts,
              descriptor,
              claim: primary,
              dependencies: primaryHandlerResult.dependencies,
              existingConditions: existingAppDependencyConditions,
              acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
            })
          : [];
        const conditions = mergeTaskConditions(
          [...existingAppDependencyConditions, ...(primaryHandlerResult.conditions ?? []), ...dependencyConditions],
          new Set(existingAppDependencyConditions.map((condition) => condition.id)),
        );
        primaryHandlerResult.conditions = conditions.length > 0 ? conditions : undefined;
      } catch (error) {
        const stale = rejectStaleEffect(error);
        if (stale) {
          return stale.reconcileTaskIds;
        }
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `App dependency admission failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      try {
        const apply = persistResult(() =>
          deferAppTask(config, primary, {
            disposition: "waiting",
            report: primaryHandlerResult.report,
            summary: primaryHandlerResult.summary,
            response: primaryHandlerResult.response,
            result: primaryHandlerResult.result,
            facts: primaryHandlerResult.facts,
            actions: primaryHandlerResult.actions,
            conditions: primaryHandlerResult.conditions,
            acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
            prepareSupersededSessions,
          }),
        );
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          disposition: apply.status === "applied" ? primaryHandlerResult.state : "stale",
          ...(primary.trigger?.type === "project.task.condition-review.missed"
            ? { reason: "condition-review-checkpoint-missed" }
            : {}),
          input: intent.input ?? {},
          summary: primaryHandlerResult.summary,
          ...(primaryHandlerResult.response ? { response: primaryHandlerResult.response } : {}),
          ...(primaryHandlerResult.result ? { result: primaryHandlerResult.result } : {}),
          facts: primaryHandlerResult.facts,
          actionsApplied: apply.actionsApplied,
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: primaryResult.runId,
        });
        const recoveredTaskIds =
          apply.status === "applied"
            ? recoverTaskConditions(opts, descriptor, config, {
                conditionIds: primaryHandlerResult.conditions?.map((condition) => condition.id),
              })
            : [];
        return [...new Set([...(stale?.reconcileTaskIds ?? apply.reconcileTaskIds), ...recoveredTaskIds])];
      } catch (error) {
        if (cleanupFailed) throw error;
        const stale = recoverStaleTaskActionResult(config, primary, error);
        if (stale) {
          const summary = error instanceof Error ? error.message : String(error);
          emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
            generation: primary.generation,
            attemptId: primary.attemptId,
            handler: primary.handler,
            disposition: "stale",
            input: intent.input ?? {},
            summary,
            facts: primaryHandlerResult.facts,
            staleRecovery: stale.staleRecovery,
            workflowRunId: primaryResult.runId,
          });
          return stale.reconcileTaskIds;
        }
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `Handler result was rejected: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    await finalizeWorkspace("failed");

    const agentHandoff = Boolean(workflowKey && primaryHandlerResult.state === "needs-agent");
    if (
      !primaryResult.unavailable &&
      !primaryResult.handlerBlocked &&
      !primaryResult.workspacePreparationFailed &&
      !agentHandoff &&
      !primaryHandlerResult.resultRejected
    ) {
      const retry = persistResult(() => failAppTaskAttempt(config, primary, primaryHandlerResult.summary));
      if (retry.status === "superseded") return [];
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: retry.status,
        retryAt: retry.retryAt,
        input: intent.input ?? {},
        summary: retry.summary,
      });
      // The persisted deadline and existing recovery scheduler own the retry.
      return [];
    }
    let attention: ReturnType<typeof markAppTaskAttention>;
    try {
      attention = persistResult(() =>
        markAppTaskAttention(config, primary, {
          summary: primaryHandlerResult.summary,
          // A failed workspace/action admission must not report its proposed
          // Task mutations as accepted through the diagnostic path either.
          result: primaryHandlerResult.actions.length ? undefined : primaryHandlerResult.result,
          facts: primaryHandlerResult.facts,
          reason: primaryHandlerResult.resultRejected
            ? "HandlerResultInvalid"
            : primaryResult.unavailable
              ? "HandlerUnavailable"
              : primaryResult.executionFailed
                ? "HandlerExecutionFailed"
                : primaryResult.workspacePreparationFailed
                  ? "WorkspacePreparationFailed"
                  : primaryHandlerResult.state === "needs-agent"
                    ? "needs-agent"
                    : "handler-blocked",
        }),
      );
    } catch (error) {
      const stale = rejectStaleEffect(error);
      if (!stale) throw error;
      return stale.reconcileTaskIds;
    }
    if (attention.status === "stale") return [];
    if (!agentHandoff) {
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: "retrying",
        retryAt: attention.retryAt,
        input: intent.input ?? {},
        summary: attention.summary,
      });
      return [];
    }
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      disposition: "agent-handoff",
      input: intent.input ?? {},
      summary: primaryHandlerResult.summary,
    });
    return [intent.id];
  } catch (error) {
    // Cleanup refusal is not a failed execution or rejected result. Preserve
    // the original claim until recovery can drain execution and retry safely.
    if (cleanupFailed) {
      timing.outcome = "failed";
      throw error;
    }
    if (activeConfig && activeClaim) {
      const stale = recoverStaleTaskActionResult(activeConfig, activeClaim, error);
      if (stale) {
        timing.outcome = "completed";
        emitTaskReconciliationEvent(
          opts,
          descriptor,
          activeClaim.trigger as EventEnvelope | undefined,
          "project.task.reconciled",
          activeClaim.taskId,
          {
            generation: activeClaim.generation,
            attemptId: activeClaim.attemptId,
            handler: activeClaim.handler,
            disposition: "stale",
            summary:
              "The claimed Task changed before executor startup; stale work was discarded without retrying it as a handler failure.",
            staleRecovery: stale.staleRecovery,
          },
        );
        return stale.reconcileTaskIds;
      }
    }
    timing.outcome = "failed";
    if (activeConfig && activeClaim) {
      const failedConfig = activeConfig;
      const failedClaim = activeClaim;
      const summary = `Task handler failed before returning a persistable result: ${
        error instanceof Error ? error.message : String(error)
      }`;
      try {
        const retry = persistResult(() => failAppTaskAttempt(failedConfig, failedClaim, summary));
        if (retry.status === "superseded") {
          // The stored owner decision already ended this attempt. Its late
          // executor error must not become a dispatch failure or another retry.
          timing.outcome = "completed";
          return [];
        }
        emitTaskReconciliationEvent(
          opts,
          descriptor,
          failedClaim.trigger as EventEnvelope | undefined,
          "project.task.reconciled",
          failedClaim.taskId,
          {
            generation: failedClaim.generation,
            attemptId: failedClaim.attemptId,
            handler: failedClaim.handler,
            disposition: retry.status,
            retryAt: retry.retryAt,
            summary: retry.summary,
          },
        );
        return [];
      } catch {
        // Preserve the original failure. Recovery still fences attempts whose
        // persistence boundary itself is unavailable.
      }
    }
    throw error;
  } finally {
    input.reportTiming(timing);
  }
}

function taskCompletionDisposition(
  taskId: string,
  actions: TaskAction[],
  taskContinues: boolean | undefined,
): "converged" | "progress" | "revised" {
  if (!taskContinues) return "converged";
  return actions.some((action) => action.kind === "update-task" && action.taskId === taskId) ? "revised" : "progress";
}

function emitTaskReconciliationEvent(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  event: EventEnvelope | undefined,
  type: string,
  taskId: string,
  data: Record<string, unknown>,
): void {
  const persistedEventId = Number((event as Record<string, unknown> | undefined)?.eventId);
  const trace =
    Number.isInteger(persistedEventId) && persistedEventId > 0
      ? {
          traceId:
            event?.trace && typeof event.trace === "object" && typeof event.trace.traceId === "string"
              ? event.trace.traceId
              : `event:${persistedEventId}`,
          parentEventId: persistedEventId,
        }
      : childEventTrace(event);
  opts.bus.emit({
    type,
    source: `app-task:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.agent}`,
    target: { appId: descriptor.id },
    data: { project: descriptor.id, taskId, ...data },
    ...(trace ? { trace } : {}),
  } as unknown as AgentEvent);
}

function recoverStaleTaskResult(
  config: AppTaskContext,
  claim: AppTaskClaim,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } {
  const recovery = releaseStaleAppTaskResult(
    config,
    claim,
    `Stale reconciliation result for ${claim.taskId} was rejected; retrying from current task facts`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" ? [] : [claim.taskId],
  };
}

function recoverStaleTaskActionResult(
  config: AppTaskContext,
  claim: AppTaskClaim,
  error: unknown,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } | null {
  if (!isAppTaskActionStaleError(error) && !(error instanceof ResourceTaskMutationStaleError)) {
    return null;
  }
  const recovery = releaseStaleAppTaskResult(
    config,
    claim,
    `Stale handler action for ${
      isAppTaskActionStaleError(error) ? error.taskId : claim.taskId
    } was rejected; retrying ${claim.taskId} from current task facts`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" ? [] : [claim.taskId],
  };
}

async function establishTaskAcceptance(input: {
  descriptor: AppTaskRuntimeDescriptor;
  intent: AppTaskIntent;
  claim: AppTaskClaim;
  capability: TaskCapabilityRun;
  executionPaths: AppTaskExecutionPaths;
}): Promise<{ ok: true; acceptanceBasis: AppTaskAcceptanceBasis } | { ok: false; summary: string; facts: string[] }> {
  const { descriptor, intent, claim, capability } = input;
  const workflow = claim.handler.startsWith("workflow:");
  if (!capability.verifier) {
    if (!workflow) {
      return {
        ok: true,
        acceptanceBasis: {
          method: "agent-judgment",
          facts: [...capability.handlerResult.facts],
        },
      };
    }
    return {
      ok: true,
      acceptanceBasis: {
        method: "workflow-contract",
        facts: [...capability.handlerResult.facts, ...(capability.runId ? [`workflow-run:${capability.runId}`] : [])],
      },
    };
  }

  try {
    const verificationConfig = appTaskConfig(descriptor);
    const pendingTrigger = readPendingAppTaskTrigger(verificationConfig, claim.taskId);
    const raw = await capability.verifier.verify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        appRoot: descriptor.appDir,
        projectRoot: descriptor.projectDir,
        workspaceDir: input.executionPaths.workspaceDir,
        intent: structuredClone(intent),
        ...(pendingTrigger
          ? {
              pendingTrigger: canonicalAppEvent(pendingTrigger as AgentEvent),
            }
          : {}),
      },
      capability.handlerResult as AppTaskHandlerResult,
    );
    const admitted = admitAppTaskVerificationResult(raw);
    if (!admitted.ok) {
      return {
        ok: false,
        summary: `Verifier ${capability.verifier.name} returned an invalid result: ${admitted.error}`,
        facts: capability.runId ? [`workflow-run:${capability.runId}`] : [],
      };
    }
    if (!admitted.result.accepted) {
      return {
        ok: false,
        summary: admitted.result.summary,
        facts: admitted.result.facts,
      };
    }
    return {
      ok: true,
      acceptanceBasis: {
        method: "deterministic",
        verifier: capability.verifier.name,
        facts: admitted.result.facts,
      },
    };
  } catch (error) {
    return {
      ok: false,
      summary: `Verifier ${capability.verifier.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      facts: capability.runId ? [`workflow-run:${capability.runId}`] : [],
    };
  }
}

/** Publish only after the caller's complete state transaction has committed. */
export function publishTaskCancellation(bus: EventBus, result: ReturnType<typeof cancelAppTask>): void {
  if (result.applied) {
    const { appId, taskId } = result.cancellation;
    bus.emit({
      type: "app.task.cancelled",
      source: "app-task-reconciler",
      owner: "human:operator",
      target: { appId, taskId },
      data: {
        appId,
        taskId,
        generation: result.cancellation.generation,
        ...(result.cancelledAttemptId ? { attemptId: result.cancelledAttemptId } : {}),
        reason: result.cancellation.reason,
      },
    });
  }
}
