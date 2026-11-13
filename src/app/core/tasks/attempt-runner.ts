import {
  admitTaskVerificationResult as admitAppTaskVerificationResult,
  type TaskReconcileResult as AppTaskHandlerResult,
  type TaskIntent as AppTaskIntent,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskAttempt,
} from "@may-agent/sdk";
import { join } from "node:path";
import { log } from "../../../lib/log.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import type { EventEnvelope } from "../events/bus.js";
import { EVENT_RECORD_ONLY, childEventTrace, type AgentEvent, type EventBus } from "../events/bus.js";
import { isConversationTask } from "../state/conversation-task-turns.js";
import { appTaskExecutionPaths, withAppTaskWorkspace, type AppTaskExecutionPaths } from "./app-task-output-paths.js";
import {
  assertAppTaskClaimCurrent,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  deferAppTaskExecution,
  expiredAgentSessionAppTaskAttempt,
  failAppTaskAttempt,
  isAppTaskActionStaleError,
  readAppTaskAgent,
  readAppTaskIntent,
  readAppTaskChildContext,
  readAppTaskLiveSnapshot,
  readTaskChangeInputKeys,
  readPendingAppTaskTrigger,
  recordAppTaskAttemptWorkspace,
  recordReleasedAppTaskWorkspace,
  recoverableAppTaskAttempts,
  refreshTaskWorkspaceConstraint,
  releaseInterruptedAppTaskAttempt,
  releaseStaleAppTaskResult,
  releaseTerminalSessionExpiredAppTaskAttempt,
  reportAppTaskFailure,
  type AppTaskClaim,
} from "./app-task-reconciler.js";
import { pendingTaskWorkspaceConstraint } from "./app-task-state.js";
import { ResourceTaskMutationStaleError, appTaskReadinessById, type AppTaskContext } from "./app-task-store.js";
import {
  hasLiveAppTaskSession,
  interruptSupersededAgentSession,
  runRegisteredTaskExecutor,
  runTaskAgent,
  runTaskExecutorAttempt,
  runTaskWorkflow,
  type TaskHandlerInput,
} from "./attempt-execution.js";
import { type AppTaskDispatch } from "./controller.js";
import { recoverTaskConditions } from "./dependency-admission.js";
import { type TaskCapabilityRun } from "./result.js";
import { appTaskConfig, type AppTaskRuntimeDescriptor } from "./runtime-definition.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";
import { applyTaskChanges } from "./task-changes.js";
import { recordTaskCheck } from "./task-check-observations.js";
import {
  assertCommunicationRequestsSettled,
  settleTaskCommunicationInputs,
  taskResultCommunication,
} from "./task-communication.js";
import { isTrustedTaskCoordination } from "./task-coordination.js";
import type { PreparedTaskWorkspace, TaskWorkspaceAdmission, TaskWorkspaceInput } from "./workspace.js";
import { TaskWorkspaceDeferredError } from "./workspace.js";

export type AppTaskTiming = {
  dispatch: AppTaskDispatch;
  attemptId?: string;
  generation?: number;
};

/** Both preclaim observation and actual preparation resolve the installed method.
 * No resource authority is passed to the adapter; it only observes the operation. */
async function taskWorkspaceRequirement(
  opts: AppTaskRuntimeOptions, descriptor: AppTaskRuntimeDescriptor, config: AppTaskContext,
  input: { intent: AppTaskIntent; agent: string; generation: number },
) {
  const workflow = input.intent.workflow?.trim();
  const workspace = workflow && opts.workflows ? (await opts.workflows.inspect({
    source: opts, appDir: descriptor.appDir, agent: input.agent, workflow,
  })).workspace : undefined;
  const workflowNeedsWorktree = workspace === "task" || (typeof workspace === "object" && workspace.kind === "task");
  const required = workflowNeedsWorktree ||
    (!workflow && !isConversationTask(config, input.intent.id) && descriptor.app.workspace?.kind === "git");
  const preparation: TaskWorkspaceInput | undefined = required && descriptor.app.workspace?.kind === "git" ? {
    repoDir: descriptor.projectDir,
    workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
    taskId: input.intent.id, generation: input.generation,
    baseBranch: typeof workspace === "object" ? workspace.baseBranch : (descriptor.app.workspace.branch ?? "dev"),
    previous: config.resourceStore.readTaskWorkspace(input.intent.id, input.generation),
  } : undefined;
  return { workspace, required, preparation };
}

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

  const config = appTaskConfig(descriptor);

  try {
    // Recover the exact saved answer before deciding whether any agent work is needed.
    const recoveredTaskIds = recoverTaskConditions(opts, descriptor, config, { taskId: input.taskId }).filter(
      (taskId) => taskId !== input.taskId,
    );
    const snapshot = config.resourceStore.readTaskContext({ taskIds: [input.taskId] }, { includeHistory: false, childLimit: 0 });
    const pending = snapshot.resources?.[input.taskId];
    const workspaceHold = pending && pendingTaskWorkspaceConstraint(pending);
    const readiness = appTaskReadinessById(snapshot, config.maxConcurrent)[input.taskId]?.state;
    let expectedResource: { generation: number; resourceVersion: number } | undefined;
    if (pending && !pending.status.currentAttemptId && pending.status.phase !== "running" &&
      (workspaceHold || (descriptor.app.workspace?.kind === "git" && opts.workspaces?.admission)) &&
      (workspaceHold || readiness === "ready" || readiness === "capacity-blocked") &&
      (!workspaceHold || workspaceHold.retryAt <= Date.now())) {
      expectedResource = { generation: pending.metadata.generation, resourceVersion: pending.metadata.resourceVersion };
      let observation: TaskWorkspaceAdmission = { kind: "unavailable" };
      try {
        const method = await taskWorkspaceRequirement(opts, descriptor, config, {
          intent: readAppTaskIntent(config, input.taskId)!, generation: pending.metadata.generation,
          agent: readAppTaskAgent(config, input.taskId, snapshot) ?? descriptor.agent,
        });
        observation = !method.required ? { kind: "ready" }
          : method.preparation && opts.workspaces?.admission ? await opts.workspaces.admission(method.preparation)
          : { kind: "unavailable" };
        // A shared method with no retained blocker has no checkout observation
        // to fence. The ordinary claim reads current requirements as before.
        if (!method.required && !workspaceHold) expectedResource = undefined;
      } catch { /* Actual preparation retains its established diagnostic/failure path. */ }
      if (expectedResource && (observation.kind === "deferred" || workspaceHold)) {
        const held = observation.kind === "deferred" ? observation.constraint
          : observation.kind === "unavailable" && workspaceHold ? { ...workspaceHold, retryAt: Date.now() + 60_000 }
          : undefined;
        const applied = refreshTaskWorkspaceConstraint(config, { taskId: input.taskId, ...expectedResource }, held);
        if (!applied || held) {
          recordTaskCheck(opts.bus, applied ? "deferred" : "stale", { appId: descriptor.id, taskId: input.taskId });
          return recoveredTaskIds;
        }
        expectedResource.resourceVersion++;
      }
    }
    const claim = claimObservedAppTask(config, {
      taskId: input.taskId,
      appAgent: descriptor.agent,
      handler: "auto",
      expectedResource,
      ...(input.dispatch.coordination ? { canUseCoordinationReserve: (resource, agent) => isTrustedTaskCoordination(descriptor, resource, agent) } : {}),
      reason: input.reason ?? "task-controller",
      recoverPreviousSession: (attempt) => {
        if (attempt.taskId !== input.taskId) {
          throw new Error(
            `Task ${input.taskId} retained attempt ${attempt.metadata.id} belongs to ${attempt.taskId}; refusing cross-Task recovery`,
          );
        }
        return interruptSupersededAgentSession(
          opts,
          attempt.sessionId!,
          `Task ${input.taskId} is recovering an orphaned agent session`,
          input.taskId,
          {
            appId: descriptor.id,
            taskId: input.taskId,
            generation: attempt.taskGeneration,
            attemptId: attempt.metadata.id,
          },
        );
      },
      recoverSessionHandoff: (attempt) => opts.sessions?.handoff(attempt),
    });
    recordTaskCheck(opts.bus, claim.kind, { appId: descriptor.id, taskId: input.taskId });
    if (claim.kind !== "claimed") {
      if (claim.kind === "busy") {
        const active = claim.attemptId ? config.resourceStore.readAttempt(claim.attemptId) : null;
        const leaseCheckAt = Date.now();
        // Worker death before a session starts (including workflows/executors)
        // still needs fenced claim recovery when execution retries are exhausted.
        if (active && !active.sessionId) {
          const orphan = recoverableAppTaskAttempts(config, leaseCheckAt, false, [input.taskId])[0];
          if (orphan && !orphan.sessionId &&
            releaseInterruptedAppTaskAttempt(config, orphan, "Previous worker's attempt lease expired").released) {
            emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.recovery.requeued", input.taskId, {
              route: "task-controller", reason: "previous-runtime-expired-lease", attemptId: orphan.attemptId,
            });
            return [...new Set([...recoveredTaskIds, input.taskId])];
          }
        }
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
          interruptSupersededAgentSession(
            opts,
            sessionId,
            "Retrying an uncommitted Task attempt",
            input.taskId,
            {
              appId: descriptor.id,
              taskId: expired.taskId,
              generation: expired.attemptGeneration,
              attemptId: expired.attemptId,
            },
          );
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
            return [...new Set([...recoveredTaskIds, input.taskId])];
          }
        }
      }
      log("debug", `[app-task:${descriptor.id}] ${input.taskId} check: ${claim.kind}`);
      return recoveredTaskIds;
    }
    timing.attemptId = claim.attemptId;
    timing.generation = claim.generation;
    return [...new Set([...recoveredTaskIds, ...(await runClaimedTask(opts, descriptor, config, claim, input.dispatch))])];
  } finally {
    if (timing.attemptId) input.reportTiming(timing);
  }
}

async function runClaimedTask(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  config: AppTaskContext,
  claim: AppTaskClaim,
  dispatch: AppTaskDispatch,
): Promise<string[]> {
  const intent = claim.intent;
  const event = claim.trigger as EventEnvelope | undefined;
  const workflowKey = claim.handler.startsWith("workflow:") ? claim.handler.slice("workflow:".length) : "";
  let executionPaths: AppTaskExecutionPaths;
  let taskWorkspace: PreparedTaskWorkspace | undefined;
  let workspaceFinalized = false;
  try {
    executionPaths = appTaskExecutionPaths(descriptor.appDir, descriptor.projectDir);
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

    let report: TaskCapabilityRun;
    {
      const method = await taskWorkspaceRequirement(opts, descriptor, config, {
        intent, agent: claim.agent, generation: claim.generation,
      });
      if (dispatch.coordination && method.workspace !== "shared")
        throw new Error("Coordination reserve requires the installed shared-workspace workflow");
      // Both execution paths share workspace lineage, admission fencing, and
      // failure handling. Only the workflow may override the App's base branch.
      if (method.required) {
        try {
          if (descriptor.app.workspace?.kind !== "git") {
            throw new Error(`Workflow ${workflowKey} requires a task worktree but app workspace is not Git`);
          }
          if (!opts.workspaces) throw new Error("Task workspace backend is not installed");
          taskWorkspace = await opts.workspaces.prepare(method.preparation!);
          executionPaths = withAppTaskWorkspace(executionPaths, taskWorkspace.metadata.path);
          if (!recordAppTaskAttemptWorkspace(config, claim, taskWorkspace.metadata)) {
            throw new Error(`Task attempt ${claim.attemptId} became stale while preparing its workspace`);
          }
        } catch (error) {
          if (error instanceof TaskWorkspaceDeferredError) {
            const applied = persistResult(() => deferAppTaskExecution(config, claim, error.constraint));
            emit("project.task.reconciled", { disposition: applied === "applied" ? "deferred" : "stale",
              workspace: error.constraint, summary: error.message });
            return [];
          }
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
      const execution = { opts, descriptor, claim, executionPaths, childContext, taskSnapshot, event, dispatch };
      report = await runTaskExecutorAttempt({
        ...execution,
        execute: (attempt, taskEvents, acceptedLiveEventIds) =>
          executeTaskHandler({ ...execution, attempt, taskEvents, acceptedLiveEventIds }),
      });
    }
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
          ...(applied.retryExhausted ? { retryExhausted: applied.retryExhausted } : {}),
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
        opts,
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
      const { acceptanceBasis } = accepted;
      try {
        const staleWorkspace = await fenceWorkspaceFinalization(report);
        if (staleWorkspace) return staleWorkspace.reconcileTaskIds;
        if (result.inputKeys !== undefined) readTaskChangeInputKeys(config, claim, result.inputKeys, report.acceptedLiveEventIds);
        const changeInput = {
          opts,
          descriptor,
          claim,
          changes: {
            requests: result.requests,
            communication: taskResultCommunication(config, claim, result, report.acceptedLiveEventIds),
            actions: result.actions,
            facts: result.facts,
            inputKeys: result.inputKeys,
          },
          acceptedLiveEventIds: report.acceptedLiveEventIds,
        };
        // Validation is non-destructive. Final admission still checks authority
        // and revisions after the awaited Git reads, before any removal is allowed.
        const inspected = taskWorkspace ? await opts.workspaces!.inspect(taskWorkspace) : undefined;
        if (inspected && !inspected.ok) {
          return await rejectResult(
            inspected.reason ?? "Task workspace validation failed",
            { handlerBlocked: true },
            [...result.facts, taskWorkspace!.metadata.path],
          );
        }
        let apply!: ReturnType<typeof completeAppTask>;
        const changes = persistResult(() =>
          applyTaskChanges({
            ...changeInput,
            settle: () => {
              assertCommunicationRequestsSettled(config, claim, result.inputKeys, report.acceptedLiveEventIds);
              apply = completeAppTask(config, claim, {
                summary: result.summary,
                response: result.response,
                result: result.result,
                facts: result.facts,
                inputKeys: result.inputKeys,
                acceptanceBasis,
                workspace: inspected,
                acceptedLiveEventIds: report.acceptedLiveEventIds,
              });
              if (apply.status === "applied") settleTaskCommunicationInputs(config, claim);
            },
          }),
        );
        workspaceFinalized = true;
        const workspaceCleanupError = await cleanupReleasedWorkspace();
        const appliedDisposition = apply.taskContinues ? "progress" : "converged";
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, claim) : null;
        emit("project.task.reconciled", {
          disposition: apply.status === "applied" ? appliedDisposition : "stale",
          ...(workspaceCleanupError ? { workspaceCleanupError } : {}),
          outcome: intent.outcome,

          owner: intent.agent ?? descriptor.agent,
          ...(intent.workflow ? { workflow: intent.workflow } : {}),
          ...(intent.executor ? { executor: intent.executor } : {}),
          acceptance: intent.acceptance,
          input: intent.input ?? {},
          summary: result.summary,
          ...(result.response ? { response: result.response } : {}),
          ...(result.result ? { result: result.result } : {}),
          facts: result.facts,
          acceptanceBasis,
          actionsApplied: [...changes.actionsApplied, ...apply.actionsApplied],
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: report.runId,
        });
        for (const cancelled of apply.cancelledTasks ?? []) publishTaskCancellation(opts.bus, cancelled);
        return stale?.reconcileTaskIds ?? apply.dependentTaskIds;
      } catch (error) {
        const stale = recoverStaleTaskActionResult(config, claim, error);
        if (stale) {
          const summary = error instanceof Error ? error.message : String(error);
          emit("project.task.reconciled", {
            disposition: "stale",
            outcome: intent.outcome,

            owner: intent.agent ?? descriptor.agent,
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

      try {
        let apply!: ReturnType<typeof deferAppTask>;
        const changes = persistResult(() =>
          applyTaskChanges({
            opts,
            descriptor,
            claim,
            changes: {
              requests: result.requests,
              communication: result.communication,
              conditions: result.conditions,
              actions: result.actions,
              facts: result.facts,
              inputKeys: result.inputKeys,
            },
            acceptedLiveEventIds: report.acceptedLiveEventIds,
            settle: () => {
              apply = deferAppTask(config, claim, {
                disposition: "waiting",
                continue: result.continue,
                report: result.report,
                summary: result.summary,
                response: result.response,
                result: result.result,
                reviewAt: result.reviewAt,
                facts: result.facts,
                inputKeys: result.inputKeys,
                acceptedLiveEventIds: report.acceptedLiveEventIds,
              });
            },
          }),
        );
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, claim) : null;
        emit("project.task.reconciled", {
          disposition: apply.status === "applied" ? "waiting" : "stale",
          input: intent.input ?? {},
          summary: result.summary,
          ...(result.response ? { response: result.response } : {}),
          ...(result.result ? { result: result.result } : {}),
          facts: result.facts,
          actionsApplied: [...changes.actionsApplied, ...apply.actionsApplied],
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: report.runId,
        });
        const recoveredTaskIds =
          apply.status === "applied"
            ? recoverTaskConditions(opts, descriptor, config, {
                conditionIds: changes.conditionIds.length ? changes.conditionIds : undefined,
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

  async function cleanupReleasedWorkspace(): Promise<string | undefined> {
    try {
      const workspace = config.resourceStore.readAttempt(claim.attemptId)?.workspace;
      if (!taskWorkspace || !workspace?.released) return;
      // Settlement relinquished this exact workspace. New work uses a different
      // identity, so asynchronous removal cannot delete its files or private refs.
      // A missing checkout/branch can still leave private refs. Always run the
      // adapter's idempotent finalizer; disposition alone is not cleanup proof.
      let metadata = workspace;
      try {
        const finalized = await opts.workspaces!.finalize({ ...taskWorkspace, metadata: workspace }, "accepted");
        metadata =
          finalized.ok && finalized.metadata.disposition === "removed"
            ? finalized.metadata
            : { ...workspace, cleanupError: finalized.reason ?? "Released workspace was retained during cleanup" };
      } catch (error) {
        metadata = { ...workspace, cleanupError: error instanceof Error ? error.message : String(error) };
      }
      recordReleasedAppTaskWorkspace(config, claim, metadata);
      return metadata.cleanupError;
    } catch (error) {
      // Cleanup, including its bookkeeping, cannot reject committed work.
      return error instanceof Error ? error.message : String(error);
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
                  : "handler-blocked",
        }
      : unacceptedResult
        ? { reason: "HandlerResultSettlementFailed", unacceptedResult }
        : {};
    try {
      const failure = persistResult(() => failAppTaskAttempt(config, claim, result.summary, details));
      if (failure.status === "superseded") return [];
      emit("project.task.reconciled", {
        disposition: failure.status,
        retryAt: failure.retryAt,
        input: intent.input ?? {},
        summary: failure.summary,
      });
      // Stored retry deadlines and the recovery scheduler pace unsuccessful attempts.
      return [];
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

/** Select the recorded handler. All paths share Task lifetime and result settlement. */
async function executeTaskHandler(input: TaskHandlerInput): Promise<TaskCapabilityRun> {
  const { opts, claim } = input;
  const execution = {
    ...input,
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
  if (claim.handler === "executor:conversation") {
    throw new Error("Retained Conversation execution requires offline conversion to executor:agent");
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
  return runTaskAgent(execution);
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
    // The attempt already owns this work. These Events report its decisions;
    // any declared durable consumer still owns its independent delivery.
    [EVENT_RECORD_ONLY]: true,
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
): { staleRecovery: "released" | "superseded" | "missing" | "busy"; reconcileTaskIds: string[] } {
  const recovery = releaseStaleAppTaskResult(
    config,
    claim,
    `Stale reconciliation result for ${claim.taskId} was rejected; retrying from current task facts`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" || recovery.status === "busy" ? [] : [claim.taskId],
  };
}

function recoverStaleTaskActionResult(
  config: AppTaskContext,
  claim: AppTaskClaim,
  error: unknown,
): { staleRecovery: "released" | "superseded" | "missing" | "busy"; reconcileTaskIds: string[] } | null {
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
    reconcileTaskIds: recovery.status === "missing" || recovery.status === "busy" ? [] : [claim.taskId],
  };
}

async function establishTaskAcceptance(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  intent: AppTaskIntent;
  claim: AppTaskClaim;
  capability: TaskCapabilityRun;
  executionPaths: AppTaskExecutionPaths;
}): Promise<{ ok: true; acceptanceBasis: AppTaskAcceptanceBasis } | { ok: false; summary: string; facts: string[] }> {
  const { descriptor, intent, claim, capability } = input;
  const workflow = claim.handler.startsWith("workflow:");
  const verifier = capability.verifier;
  if (!verifier) {
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
    const raw = await verifier.verify(
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
        summary: `Verifier ${verifier.name} returned an invalid result: ${admitted.error}`,
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
        verifier: verifier.name,
        facts: admitted.result.facts,
      },
    };
  } catch (error) {
    return {
      ok: false,
      summary: `Verifier ${verifier.name} failed: ${error instanceof Error ? error.message : String(error)}`,
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
