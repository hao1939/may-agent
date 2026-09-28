import {
  admitTaskVerificationResult as admitAppTaskVerificationResult,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskReconcileResult as AppTaskHandlerResult,
  type TaskIntent as AppTaskIntent,
  type TaskAttempt,
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
  interruptSupersededAgentSession,
  runRegisteredTaskExecutor,
  runTaskAgent,
  runTaskWorkflow,
  runTaskExecutorAttempt,
  type TaskHandlerInput,
} from "./attempt-execution.js";
import { type AppTaskDispatch } from "./controller.js";
import {
  admitTaskAppDependencies,
  mergeTaskConditions,
  openTaskAppDependencyConditions,
  recoverTaskConditions,
} from "./dependency-admission.js";
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
  attemptId?: string;
  generation?: number;
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
  };

  try {
    const config = appTaskConfig(descriptor);
    const claim = claimObservedAppTask(config, {
      taskId: input.taskId,
      appAgent: descriptor.agent,
      handler: "auto",
      reason: input.reason ?? "task-controller",
      recoverSessionHandoff: (attempt) => opts.sessions?.handoff(attempt),
    });
    if (claim.kind !== "claimed") {
      if (claim.kind === "busy") {
        const active = claim.attemptId ? config.resourceStore.readAttempt(claim.attemptId) : null;
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
        claim.kind === "busy"
          ? { reason: "attempt-active", attemptId: claim.attemptId }
          : claim.kind === "waiting"
            ? claim.dependencyIds?.length
              ? { reason: "dependencies-open", dependencyIds: claim.dependencyIds }
              : { reason: "conditions-open", conditionIds: claim.conditionIds }
            : claim.kind === "attention"
              ? { reason: "attention-required", generation: claim.generation, summary: claim.summary }
              : { reason: "already-completed", generation: claim.generation };
      emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.reconcile.skipped", input.taskId, {
        route: "task-controller",
        ...skip,
      });
      return [];
    }
    timing.attemptId = claim.attemptId;
    timing.generation = claim.generation;
    return await runClaimedTask(opts, descriptor, config, claim);
  } finally {
    input.reportTiming(timing);
  }
}

async function runClaimedTask(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  config: AppTaskContext,
  claim: AppTaskClaim,
): Promise<string[]> {
  const intent = claim.intent;
  const event = claim.trigger as EventEnvelope | undefined;
  const workflowKey = claim.handler.startsWith("workflow:") ? claim.handler.slice("workflow:".length) : "";
  let executionPaths: AppTaskExecutionPaths;
  let taskWorkspace: PreparedTaskWorkspace | undefined;
  let workspaceFinalized = false;
  try {
    executionPaths = appTaskExecutionPaths(descriptor.appDir, descriptor.projectDir);
    for (const sessionId of claim.supersededSessionIds ?? []) {
      interruptSupersededAgentSession(
        opts,
        sessionId,
        `Task ${claim.taskId} superseded an orphaned agent session while recovering the current generation`,
        claim.taskId,
      );
    }
    const conversation = isConversationTask(config, claim.taskId);
    const childContext = readAppTaskChildContext(config, claim.taskId);
    const taskSnapshot = readAppTaskLiveSnapshot(config, claim.taskId);
    emit("project.task.reconcile.started", {
      route: "task-controller",

      owner: claim.agent,
    });

    // Claiming a task rewrites the canonical state plus its disposable route and
    // read projections. On large retained trees that synchronous durability
    // boundary is substantial. Yield before agent/workflow association can
    // perform another state rewrite, so HTTP readiness and accepted event
    // ingress get an observable turn inside one reconciliation (not merely
    // between separate claims).
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const workflowWorkspace =
      workflowKey && opts.workflows
        ? (
            await opts.workflows.inspect({
              source: opts,
              appDir: descriptor.appDir,
              agent: claim.agent,
              workflow: workflowKey,
            })
          ).workspace
        : undefined;
    const workflowNeedsWorktree =
      workflowWorkspace === "task" || (typeof workflowWorkspace === "object" && workflowWorkspace.kind === "task");
    // Both execution paths share workspace lineage, admission fencing, and
    // failure handling. Only the workflow may override the App's base branch.
    if (!conversation && (workflowNeedsWorktree || (!workflowKey && descriptor.app.workspace?.kind === "git"))) {
      try {
        if (descriptor.app.workspace?.kind !== "git") {
          throw new Error(`Workflow ${workflowKey} requires a task worktree but app workspace is not Git`);
        }
        if (!opts.workspaces) throw new Error("Task workspace backend is not installed");
        const previous = Object.values(config.resourceStore.readTaskContext({ taskIds: [claim.taskId] }).attempts ?? {})
          .filter(
            (attempt) =>
              attempt.taskId === claim.taskId &&
              attempt.taskGeneration === claim.generation &&
              attempt.workspace?.kind === "task-worktree",
          )
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]?.workspace;
        taskWorkspace = await opts.workspaces.prepare({
          repoDir: descriptor.projectDir,
          workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
          taskId: claim.taskId,
          generation: claim.generation,
          baseBranch:
            typeof workflowWorkspace === "object"
              ? workflowWorkspace.baseBranch
              : (descriptor.app.workspace.branch ?? "dev"),
          previous,
        });
        executionPaths = withAppTaskWorkspace(executionPaths, taskWorkspace.metadata.path);
        if (!recordAppTaskAttemptWorkspace(config, claim, taskWorkspace.metadata)) {
          throw new Error(`Task attempt ${claim.attemptId} became stale while preparing its workspace`);
        }
      } catch (error) {
        return await finishUnsuccessfulAttempt({
          handlerResult: {
            state: "error",
            summary: `Task workspace preparation failed: ${error instanceof Error ? error.message : String(error)}`,
            facts: [],
            actions: [],
          },
          runId: null,
          workspacePreparationFailed: true,
        });
      }
    }
    // One attempt lifetime surrounds dispatch; settlement follows after it closes.
    const execution = { opts, descriptor, claim, executionPaths, childContext, taskSnapshot, event };
    const report = await runTaskExecutorAttempt({
      ...execution,
      execute: (attempt, taskEvents) => executeTaskHandler({ ...execution, attempt, taskEvents, conversation }),
    });

    const result = report.handlerResult;
    const rejectResult = (
      summary: string,
      diagnostics: Pick<TaskCapabilityRun, "handlerBlocked"> = {},
      facts = result.facts,
    ) =>
      finishUnsuccessfulAttempt({
        ...report,
        ...diagnostics,
        handlerResult: { ...result, state: "error", summary, facts },
      });

    if (report.unavailable) {
      emit("project.task.handler.unavailable", {
        condition: "HandlerUnavailable",
        reason: result.summary,
      });
    }
    if (
      result.state === "converged" &&
      claim.handoff?.reason === "needs-agent" &&
      intent.workflow &&
      !report.verifier
    ) {
      return await rejectResult(
        `Agent convergence was rejected because workflow ${intent.workflow} handed off without a verifier`,
        { handlerBlocked: true },
      );
    }
    if (result.state === "incomplete") {
      const stale = await fenceWorkspaceFinalization(report);
      if (stale) return stale.reconcileTaskIds;
      // An incomplete report does not accept or discard workspace output. Retain it using
      // the existing failed-attempt policy, including any cleanup limitation.
      const finalized = await finalizeWorkspace("failed");
      const facts = [
        ...result.facts,
        ...(taskWorkspace ? [taskWorkspace.metadata.path] : []),
        ...(!finalized.ok && finalized.reason ? [finalized.reason] : []),
      ];
      try {
        const applied = persistResult(() =>
          reportAppTaskFailure(config, claim, {
            ...result,
            facts,
            acceptedLiveEventIds: report.acceptedLiveEventIds,
          }),
        );
        const staleResult = applied.status === "stale" ? recoverStaleTaskResult(config, claim) : null;
        emit("project.task.reconciled", {
          disposition: applied.status === "applied" ? "incomplete" : "stale",
          summary: applied.summary ?? result.summary,
          facts,
        });
        return staleResult?.reconcileTaskIds ?? [];
      } catch (error) {
        const staleResult = rejectStaleEffect(error, report);
        if (staleResult) return staleResult.reconcileTaskIds;
        return await rejectResult(
          `Incomplete report was rejected: ${error instanceof Error ? error.message : String(error)}`,
          { handlerBlocked: true },
        );
      }
    }
    if (result.state === "converged") {
      const accepted = await establishTaskAcceptance({
        descriptor,
        intent,
        claim,
        capability: report,
        executionPaths,
      });
      if (!accepted.ok) {
        // Rejected acceptance needs new facts or an owner decision, not a
        // transport retry of the same workflow and its external effects.
        emit("project.task.verification.failed", {
          summary: accepted.summary,
          facts: accepted.facts,
          workflowRunId: report.runId,
        });
        return await rejectResult(accepted.summary, { handlerBlocked: true }, accepted.facts);
      }
      const stale = await fenceWorkspaceFinalization(report);
      if (stale) return stale.reconcileTaskIds;
      // Pending input retains useful work; completion records progress until it is considered.
      const finalized = await finalizeWorkspace(
        hasPendingAppTaskFacts(config, claim, report.acceptedLiveEventIds) ? "waiting" : "accepted",
      );
      if (!finalized.ok) {
        return await rejectResult(finalized.reason ?? "Task workspace finalization failed", { handlerBlocked: true }, [
          ...result.facts,
          taskWorkspace?.metadata.path ?? executionPaths.workspaceDir,
        ]);
      }
      const { acceptanceBasis } = accepted;
      try {
        const apply: ReturnType<typeof completeConversationTaskTurn> = persistResult(() =>
          report.conversation
            ? completeConversationTaskTurn(config, claim, report.conversation.decision, {
                taskControls: report.conversation.taskControls,
                acceptanceBasis,
                getTaskApp: (appId) => conversationTaskApp(opts, descriptor, appId),
              })
            : completeAppTask(config, claim, {
                summary: result.summary,
                response: result.response,
                result: result.result,
                facts: result.facts,
                actions: result.actions,
                acceptanceBasis,
                acceptedLiveEventIds: report.acceptedLiveEventIds,
              }),
        );
        const appliedDisposition = apply.taskContinues ? "progress" : "converged";
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, claim) : null;
        emit("project.task.reconciled", {
          disposition: apply.status === "applied" ? appliedDisposition : "stale",
          outcome: intent.outcome,

          owner: intent.owner ?? descriptor.agent,
          ...(intent.workflow ? { workflow: intent.workflow } : {}),
          ...(intent.executor ? { executor: intent.executor } : {}),
          acceptance: intent.acceptance,
          input: intent.input ?? {},
          summary: result.summary,
          ...(result.response ? { response: result.response } : {}),
          ...(result.result ? { result: result.result } : {}),
          facts: result.facts,
          acceptanceBasis,
          actionsApplied: apply.actionsApplied,
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: report.runId,
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
        const stale = recoverStaleTaskActionResult(config, claim, error);
        if (stale) {
          const summary = error instanceof Error ? error.message : String(error);
          emit("project.task.reconciled", {
            disposition: "stale",
            outcome: intent.outcome,

            owner: intent.owner ?? descriptor.agent,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            ...(intent.executor ? { executor: intent.executor } : {}),
            input: intent.input ?? {},
            summary,
            facts: result.facts,
            staleRecovery: stale.staleRecovery,
            workflowRunId: report.runId,
          });
          return stale.reconcileTaskIds;
        }
        return await finishUnsuccessfulAttempt(
          {
            ...report,
            handlerResult: {
              ...result,
              state: "error",
              summary: `Handler actions were rejected: ${error instanceof Error ? error.message : String(error)}`,
            },
          },
          {
            attemptId: claim.attemptId,
            sessionId: config.resourceStore.readAttempt(claim.attemptId)?.sessionId,
            settlementError: error instanceof Error ? error.message : String(error),
            summary: result.summary,
            response: result.response,
            result: result.result,
            facts: result.facts,
          },
        );
      }
    }

    if (result.state === "waiting") {
      const stale = await fenceWorkspaceFinalization(report);
      if (stale) return stale.reconcileTaskIds;
      const finalized = await finalizeWorkspace("waiting");
      if (!finalized.ok) {
        return await rejectResult(finalized.reason ?? "Task workspace finalization failed", { handlerBlocked: true }, [
          ...result.facts,
          taskWorkspace?.metadata.path ?? executionPaths.workspaceDir,
        ]);
      }

      let conditions: ReturnType<typeof admitWaitingConditions>;
      try {
        conditions = admitWaitingConditions({
          opts,
          descriptor,
          config,
          claim,
          result,
          acceptedLiveEventIds: report.acceptedLiveEventIds,
        });
      } catch (error) {
        const stale = rejectStaleEffect(error, report);
        if (stale) return stale.reconcileTaskIds;
        return await rejectResult(
          `App dependency admission failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      try {
        const apply = persistResult(() =>
          deferAppTask(config, claim, {
            disposition: "waiting",
            continue: result.continue,
            report: result.report,
            summary: result.summary,
            response: result.response,
            result: result.result,
            reviewAt: result.reviewAt,
            facts: result.facts,
            actions: result.actions,
            conditions,
            acceptedLiveEventIds: report.acceptedLiveEventIds,
          }),
        );
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, claim) : null;
        emit("project.task.reconciled", {
          disposition: apply.status === "applied" ? "waiting" : "stale",
          ...(claim.trigger?.type === "project.task.condition-review.missed"
            ? { reason: "condition-review-checkpoint-missed" }
            : {}),
          input: intent.input ?? {},
          summary: result.summary,
          ...(result.response ? { response: result.response } : {}),
          ...(result.result ? { result: result.result } : {}),
          facts: result.facts,
          actionsApplied: apply.actionsApplied,
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: report.runId,
        });
        const recoveredTaskIds =
          apply.status === "applied"
            ? recoverTaskConditions(opts, descriptor, config, {
                conditionIds: conditions?.map((condition) => condition.id),
              })
            : [];
        return [...new Set([...(stale?.reconcileTaskIds ?? apply.reconcileTaskIds), ...recoveredTaskIds])];
      } catch (error) {
        const stale = rejectStaleEffect(error, report);
        if (stale) return stale.reconcileTaskIds;
        return await rejectResult(
          `Handler result was rejected: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return await finishUnsuccessfulAttempt(report);
  } catch (error) {
    const stale = recoverStaleTaskActionResult(config, claim, error);
    if (stale) {
      emit("project.task.reconciled", {
        disposition: "stale",
        summary:
          "The claimed Task changed before executor startup; stale work was discarded without retrying it as a handler failure.",
        staleRecovery: stale.staleRecovery,
      });
      return stale.reconcileTaskIds;
    }
    const summary = `Task handler failed before returning a persistable result: ${
      error instanceof Error ? error.message : String(error)
    }`;
    try {
      const retry = persistResult(() => failAppTaskAttempt(config, claim, summary));
      if (retry.status === "superseded") {
        // The stored owner decision already ended this attempt. Its late
        // executor error must not become a dispatch failure or another retry.
        return [];
      }
      emit("project.task.reconciled", {
        disposition: retry.status,
        retryAt: retry.retryAt,
        summary: retry.summary,
      });
      return [];
    } catch {
      // Preserve the original failure. Recovery still fences attempts whose
      // persistence boundary itself is unavailable.
    }
    throw error;
  }

  async function finalizeWorkspace(outcome: "accepted" | "waiting" | "failed") {
    if (!taskWorkspace || workspaceFinalized) return { ok: true as const };
    try {
      const finalized = await opts.workspaces!.finalize(taskWorkspace, outcome);
      workspaceFinalized = true;
      persistResult(() => recordAppTaskAttemptWorkspace(config, claim, finalized.metadata));
      return finalized;
    } catch (error) {
      workspaceFinalized = true;
      taskWorkspace.metadata.disposition = "retained-for-recovery";
      persistResult(() => recordAppTaskAttemptWorkspace(config, claim, taskWorkspace!.metadata));
      return {
        ok: false as const,
        metadata: taskWorkspace.metadata,
        reason: `Task workspace finalization failed and was retained for recovery: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  function rejectStaleEffect(error: unknown, run: TaskCapabilityRun) {
    const stale = recoverStaleTaskActionResult(config, claim, error);
    if (!stale) return null;
    emit("project.task.reconciled", {
      disposition: "stale",
      input: intent.input ?? {},
      summary: error instanceof Error ? error.message : String(error),
      facts: run.handlerResult.facts,
      staleRecovery: stale.staleRecovery,
      workflowRunId: run.runId,
    });
    return stale;
  }
  async function fenceWorkspaceFinalization(run: TaskCapabilityRun) {
    if (!taskWorkspace) return null;
    try {
      assertAppTaskClaimCurrent(config, claim);
      return null;
    } catch (error) {
      await finalizeWorkspace("failed");
      const stale = rejectStaleEffect(error, run);
      if (!stale) throw error;
      return stale;
    }
  }
  async function finishUnsuccessfulAttempt(
    run: TaskCapabilityRun,
    unacceptedResult?: NonNullable<TaskAttempt["previousAttempt"]>["unacceptedResult"],
  ): Promise<string[]> {
    const result = run.handlerResult;
    await finalizeWorkspace("failed");

    const diagnostic =
      run.unavailable ||
      run.handlerBlocked ||
      run.workspacePreparationFailed ||
      (workflowKey && result.state === "needs-agent") ||
      result.resultRejected;
    const details = diagnostic
      ? {
          // Rejected proposed actions cannot be accepted through the diagnostic path.
          result: result.actions.length ? undefined : result.result,
          facts: result.facts,
          reason: result.resultRejected
            ? "HandlerResultInvalid"
            : run.unavailable
              ? "HandlerUnavailable"
              : run.executionFailed
                ? "HandlerExecutionFailed"
                : run.workspacePreparationFailed
                  ? "WorkspacePreparationFailed"
                  : result.state === "needs-agent"
                    ? "needs-agent"
                    : "handler-blocked",
        }
      : unacceptedResult
        ? { reason: "HandlerResultSettlementFailed", unacceptedResult }
        : {};
    try {
      const failure = persistResult(() => failAppTaskAttempt(config, claim, result.summary, details));
      if (failure.status === "superseded") return [];
      const handoff = failure.status === "handoff";
      emit("project.task.reconciled", {
        disposition: handoff ? "agent-handoff" : failure.status,
        ...(!handoff ? { retryAt: failure.retryAt } : {}),
        input: intent.input ?? {},
        summary: failure.summary,
      });
      // Only a recorded handoff continues immediately. Stored retry deadlines
      // and the existing recovery scheduler own every other unsuccessful attempt.
      return handoff ? [claim.taskId] : [];
    } catch (error) {
      const stale = rejectStaleEffect(error, run);
      if (!stale) throw error;
      return stale.reconcileTaskIds;
    }
  }

  function emit(type: string, data: Record<string, unknown>) {
    emitTaskReconciliationEvent(opts, descriptor, event, type, claim.taskId, {
      generation: claim.generation,
      attemptId: claim.attemptId,
      handler: claim.handler,
      ...data,
    });
  }
}

/** Resolve targets from the same pinned installation for preparation and settlement. */
function conversationTaskApp(opts: AppTaskRuntimeOptions, descriptor: AppTaskRuntimeDescriptor, appId: string) {
  const registry = opts.appRegistrySnapshot ?? opts.appRegistry?.snapshot();
  if (!registry) throw new Error("Conversation execution requires an installed App registry");
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
}

/** Select the recorded handler. All paths share Task lifetime and result settlement. */
async function executeTaskHandler(
  input: TaskHandlerInput & { conversation: boolean },
): Promise<TaskCapabilityRun> {
  const { conversation, ...context } = input;
  const { opts, descriptor, claim, attempt, taskEvents } = context;
  const execution = {
    ...context,
    ...(claim.handoff
      ? {
          fallbackReason: `${claim.handoff.reason}: ${claim.handoff.summary}${
            claim.handoff.facts.length
              ? `\nHandoff facts:\n${claim.handoff.facts.map((fact) => `- ${fact}`).join("\n")}`
              : ""
          }`,
        }
      : {}),
  };
  if (conversation) {
    if (!descriptor.app.conversation || !opts.conversations)
      throw new Error(`App ${descriptor.id} Conversation executor is unavailable`);
    const registry = opts.appRegistrySnapshot ?? opts.appRegistry?.snapshot();
    if (!registry) throw new Error("Conversation execution requires an installed App registry");
    const proposal = await opts.conversations.execute({
      config: appTaskConfig(descriptor),
      claim,
      app: descriptor.app,
      registry,
      signal: attempt.signal,
      execution: {
        descriptor,
        attempt,
        taskEvents,
        taskSnapshot: input.taskSnapshot,
        executionPaths: input.executionPaths,
      },
      getTaskApp: (appId) => conversationTaskApp(opts, descriptor, appId),
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
      runId: claim.attemptId,
      conversation: proposal,
    };
  }
  const workflowKey = claim.handler.startsWith("workflow:") ? claim.handler.slice("workflow:".length) : "";
  if (workflowKey) {
    return runTaskWorkflow({
      ...execution,
      capability: { workflow: workflowKey, agent: claim.agent, task: `Reconcile task through workflow ${workflowKey}` },
    });
  }
  const executorKey = claim.handler.startsWith("executor:")
    ? claim.handler.slice("executor:".length)
    : claim.handler.startsWith("cli:")
      ? claim.handler.slice("cli:".length)
      : "";
  if (executorKey) {
    const registered = opts.executors?.[executorKey];
    if (registered) return runRegisteredTaskExecutor({ ...execution, name: executorKey, execute: registered });
    return {
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
  const handoffWorkflow =
    claim.handoff && claim.intent.workflow
      ? await opts.workflows?.inspect({
          source: opts,
          appDir: descriptor.appDir,
          agent: claim.agent,
          workflow: claim.intent.workflow,
        })
      : undefined;
  if (claim.handoff && claim.intent.workflow && !handoffWorkflow?.available) {
    return {
      handlerResult: {
        state: "error",
        summary: handoffWorkflow?.error ?? "Task workflow runner is not installed",
        facts: [],
        actions: [],
      },
      runId: null,
      unavailable: true,
    };
  }
  const report = await runTaskAgent(execution);
  return handoffWorkflow?.verifier ? { ...report, verifier: handoffWorkflow.verifier } : report;
}

/** Validate declarations before admitting dependencies; stored peer waits stay with the reconciler. */
function admitWaitingConditions(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  config: AppTaskContext;
  claim: AppTaskClaim;
  result: Pick<TaskCapabilityRun["handlerResult"], "conditions" | "dependencies">;
  acceptedLiveEventIds?: number[];
}) {
  const { opts, descriptor, config, claim, result, acceptedLiveEventIds } = input;
  // Validate owner declarations as one provenance group before admitting
  // dependencies. Otherwise conflicting explicit specifications could be
  // rejected only after publishing or adopting new dependency work.
  const explicitConditions = mergeTaskConditions(result.conditions ?? []);
  const existingAppDependencyConditions = openTaskAppDependencyConditions(config, claim.taskId);
  const existingIds = new Set(existingAppDependencyConditions.map((condition) => condition.id));
  // Also reject an explicit retarget of persisted dependency identity
  // before dependency admission can publish unrelated new work.
  mergeTaskConditions([...existingAppDependencyConditions, ...explicitConditions], existingIds);
  const dependencyConditions = result.dependencies?.length
    ? admitTaskAppDependencies({
        opts,
        descriptor,
        claim,
        dependencies: result.dependencies,
        existingConditions: existingAppDependencyConditions,
        acceptedLiveEventIds,
      })
    : [];
  // Generated dependency Conditions establish/reuse the wait, but the
  // owner's explicit declaration is the final compatible specification.
  const declaredConditions = [...dependencyConditions, ...explicitConditions];
  const declaredIds = new Set(declaredConditions.map((condition) => condition.id));
  const conditions = mergeTaskConditions(
    [...existingAppDependencyConditions, ...declaredConditions],
    new Set([...existingAppDependencyConditions, ...dependencyConditions].map((condition) => condition.id)),
  ).filter((condition) => declaredIds.has(condition.id));
  return conditions.length > 0 ? conditions : undefined;
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
      { ...capability.handlerResult } as AppTaskHandlerResult,
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
      owner: result.cancellation.decidedBy?.kind === "human" ? "human:operator" : `app:${appId}`,
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

/** Retry only a rolled-back transaction, never the executor or its external effects. */
function persistResult<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (!(error instanceof ResourceTaskMutationStaleError)) throw error;
    // Re-read state and recheck authority once. Semantic staleness still returns
    // to reconciliation; this retry only handles storage write contention.
    return operation();
  }
}
