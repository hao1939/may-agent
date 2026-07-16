import { createHash } from "node:crypto";
import {
  normalizeStringArray,
  readTaskTree,
  taskRevision,
  taskState,
  withTreeLock,
  type TaskNode,
  type TaskTreeConfig,
} from "./task-tree-store.ts";
import {
  appendToolJournal,
  saveTaskTreeWithKanbanSnapshot,
} from "./task-tree-tools.ts";
import {
  conditionRegistry,
  upsertPipelineConditionInTree,
  type ProjectConditionV2Mode,
} from "./project-conditions.ts";

export type TaskTreeFollowupActionV2 = {
  actionKind: "task-tree-followup";
  idBase: string;
  parentId: string;
  owner: string;
  goal: string;
  outputs: string[];
  acceptance: string[];
  conflictScopes: string[];
  kind?: string;
  workflow?: string;
};

export type ApplyTaskTreeFollowupReviewInputV2 = {
  taskId: string;
  taskRevision: number;
  attemptId: string;
  decision: "accept" | "followup";
  summary: string;
  action: TaskTreeFollowupActionV2;
};

export type ApplyTaskTreeFollowupReviewResultV2 = {
  handled: true;
  applied: boolean;
  replayed: boolean;
  commandKey: string;
  successorTaskId?: string;
  reason?: string;
};

export type RevisePipelineVerificationPhaseInputV2 = {
  conditionV2?: ProjectConditionV2Mode;
  taskId: string;
  taskRevision: number;
  attemptId: string;
  summary: string;
  runId: string;
  runUrl: string;
  specIds: string[];
  reason: string;
};

export type RevisePipelineVerificationPhaseResultV2 = {
  applied: boolean;
  replayed: boolean;
  commandKey: string;
  taskId: string;
  fromRevision: number;
  toRevision?: number;
  reason?: string;
};

export type ExactPipelineConditionAdoptionV2Mode = "off" | "exact-task";

export type AdoptExactPipelineWaitV2Input = {
  adoptionV2?: ExactPipelineConditionAdoptionV2Mode;
  conditionV2?: ProjectConditionV2Mode;
  taskId: string;
  runId: string;
};

export type AdoptExactPipelineWaitV2Result = {
  applied: boolean;
  replayed: boolean;
  commandKey: string;
  taskId: string;
  runId: string;
  fromRevision: number;
  toRevision?: number;
  conditionId?: string;
  reason?: string;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function validTaskId(value: string): boolean {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.endsWith("/")
  );
}

function validOwner(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function actionFingerprint(action: TaskTreeFollowupActionV2): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        actionKind: action.actionKind,
        idBase: action.idBase,
        parentId: action.parentId,
        owner: action.owner,
        goal: action.goal.trim(),
        outputs: sortedUnique(action.outputs),
        acceptance: sortedUnique(action.acceptance),
        conflictScopes: sortedUnique(action.conflictScopes),
        kind: action.kind?.trim() ?? "domain_leaf",
        workflow: action.workflow?.trim() ?? "",
      }),
    )
    .digest("hex");
}

function commandKey(input: ApplyTaskTreeFollowupReviewInputV2): string {
  return `work.apply-review:${input.taskId}:${input.taskRevision}:${input.attemptId}:task-tree-followup`;
}

function appliedCommands(task: TaskNode): JsonRecord {
  return record(record(task.trace).applied_review_commands);
}

function commandRegistry(tree: ReturnType<typeof readTaskTree>): {
  root: TaskNode | null;
  commands: JsonRecord;
} {
  const rootId = tree.root_task_id ?? "project";
  const root = tree.tasks[rootId] ?? null;
  return {
    root,
    commands: root ? record(record(root.context).workCommandsV2) : {},
  };
}

function boundedCommandRegistry(commands: JsonRecord, limit = 100): JsonRecord {
  return Object.fromEntries(
    Object.entries(commands)
      .sort(([, left], [, right]) => {
        const leftAt = String(record(left).appliedAt ?? "");
        const rightAt = String(record(right).appliedAt ?? "");
        return rightAt.localeCompare(leftAt);
      })
      .slice(0, limit),
  );
}

function reject(
  key: string,
  reason: string,
): ApplyTaskTreeFollowupReviewResultV2 {
  return {
    handled: true,
    applied: false,
    replayed: false,
    commandKey: key,
    reason,
  };
}

function validateAction(
  tree: ReturnType<typeof readTaskTree>,
  source: TaskNode,
  action: TaskTreeFollowupActionV2,
): string | null {
  if (action.actionKind !== "task-tree-followup") {
    return "unsupported action kind";
  }
  if (!validTaskId(action.idBase)) return "invalid successor task id";
  if (!validTaskId(action.parentId) || !tree.tasks[action.parentId]) {
    return "successor parent does not exist";
  }
  if (action.parentId === source.id)
    return "review source cannot parent its successor";
  if (!validOwner(action.owner)) return "invalid successor owner";
  if (source.owner && action.owner !== source.owner) {
    return "successor owner override is outside the canary scope";
  }
  if (action.workflow && action.workflow !== source.workflow) {
    return "successor workflow override is outside the canary scope";
  }
  if (!action.goal.trim()) return "successor goal is required";
  if (sortedUnique(action.outputs).length === 0) {
    return "successor outputs are required";
  }
  if (sortedUnique(action.acceptance).length === 0) {
    return "successor acceptance is required";
  }
  if (sortedUnique(action.conflictScopes).length === 0) {
    return "successor conflict scope is required";
  }
  return null;
}

export function applyTaskTreeFollowupReviewV2(
  config: TaskTreeConfig,
  input: ApplyTaskTreeFollowupReviewInputV2,
): ApplyTaskTreeFollowupReviewResultV2 {
  const key = commandKey(input);
  const fingerprint = actionFingerprint(input.action);
  const result = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const registry = commandRegistry(tree);
    const registered = record(registry.commands[key]);
    const registeredSuccessorId =
      typeof registered.successorTaskId === "string"
        ? registered.successorTaskId
        : "";
    if (registeredSuccessorId) {
      if (registered.actionFingerprint !== fingerprint) {
        return reject(
          key,
          "review command payload differs from the applied command",
        );
      }
      if (registered.decision !== input.decision) {
        return reject(key, "review decision differs from the applied command");
      }
      if (!tree.tasks[registeredSuccessorId]) {
        return reject(key, "applied review command lost its successor task");
      }
      return {
        handled: true as const,
        applied: true,
        replayed: true,
        commandKey: key,
        successorTaskId: registeredSuccessorId,
      };
    }
    const successorByCommand = Object.values(tree.tasks).find(
      (task) => record(record(task.context).workCommand).key === key,
    );
    if (successorByCommand) {
      const successorCommand = record(
        record(successorByCommand.context).workCommand,
      );
      if (successorCommand.actionFingerprint !== fingerprint) {
        return reject(
          key,
          "review command payload differs from the successor command",
        );
      }
      if (successorCommand.decision !== input.decision) {
        return reject(
          key,
          "review decision differs from the successor command",
        );
      }
      return {
        handled: true as const,
        applied: true,
        replayed: true,
        commandKey: key,
        successorTaskId: successorByCommand.id,
      };
    }
    const source = tree.tasks[input.taskId];
    if (!source) return reject(key, "review source task was not found");

    const prior = record(appliedCommands(source)[key]);
    const priorSuccessorId =
      typeof prior.successorTaskId === "string" ? prior.successorTaskId : "";
    if (priorSuccessorId) {
      if (prior.actionFingerprint !== fingerprint) {
        return reject(
          key,
          "review command payload differs from the applied command",
        );
      }
      if (prior.decision !== input.decision) {
        return reject(key, "review decision differs from the applied command");
      }
      if (!tree.tasks[priorSuccessorId]) {
        return reject(key, "applied review command lost its successor task");
      }
      return {
        handled: true as const,
        applied: true,
        replayed: true,
        commandKey: key,
        successorTaskId: priorSuccessorId,
      };
    }

    if (taskRevision(source) !== input.taskRevision) {
      return reject(
        key,
        `review source revision ${input.taskRevision} is stale; current revision is ${taskRevision(source)}`,
      );
    }
    if (taskState(source) !== "review") {
      return reject(key, `review source is ${taskState(source)}, not review`);
    }
    const currentAttemptId = record(source.trace).current_attempt_id;
    if (typeof currentAttemptId !== "string" || !currentAttemptId) {
      return reject(key, "review source has no current attempt");
    }
    if (currentAttemptId !== input.attemptId) {
      return reject(key, "review source attempt is stale");
    }
    if (normalizeStringArray(source.children).length > 0) {
      return reject(key, "review source must be a leaf");
    }
    if (
      source.kind === "durable_lane" ||
      source.kind === "standing_task" ||
      source.kind === "project" ||
      record(source.context).specLoopFollowup === true
    ) {
      return reject(
        key,
        "review source is outside the canary domain-leaf scope",
      );
    }
    const actionIssue = validateAction(tree, source, input.action);
    if (actionIssue) return reject(key, actionIssue);

    const existing = tree.tasks[input.action.idBase];
    if (existing) {
      const existingCommand = record(existing.context).workCommand;
      if (record(existingCommand).key !== key) {
        return reject(
          key,
          "successor task id already exists for another command",
        );
      }
    }

    const now = new Date().toISOString();
    const successor: TaskNode = existing ?? {
      id: input.action.idBase,
      revision: 0,
      parent_id: input.action.parentId,
      state: "backlog",
      kind: input.action.kind?.trim() || source.kind || "domain_leaf",
      priority: source.priority,
      owner: input.action.owner,
      workflow: input.action.workflow?.trim() || source.workflow,
      children: [],
      goal: input.action.goal.trim(),
      inputs: [
        `Reviewed task: ${source.id}`,
        `Revision: ${input.taskRevision}`,
        `Attempt: ${input.attemptId}`,
      ],
      outputs: sortedUnique(input.action.outputs),
      acceptance: sortedUnique(input.action.acceptance),
      conflict_scope: sortedUnique(input.action.conflictScopes),
      context: {
        reviewedTask: {
          taskId: source.id,
          taskRevision: input.taskRevision,
          attemptId: input.attemptId,
          decision: input.decision,
          summary: input.summary,
          reviewAction: input.action,
        },
        workCommand: {
          key,
          actionFingerprint: fingerprint,
          decision: input.decision,
        },
      },
      trace: {
        created_at: now,
        created_by: "work.applyReview.v2",
        command_key: key,
      },
    };
    tree.tasks[successor.id] = successor;
    const parent = tree.tasks[input.action.parentId];
    parent.children = sortedUnique([
      ...normalizeStringArray(parent.children),
      successor.id,
    ]);

    source.state = "done";
    delete source.status;
    source.blocker = undefined;
    source.resolution = "completed";
    source.done_at = now;
    source.done_by = "work.applyReview.v2";
    source.context = {
      ...record(source.context),
      acceptance_note: input.summary,
    };
    source.trace = {
      ...record(source.trace),
      reviewed_at: now,
      reviewed_by: "work.applyReview.v2",
      review_summary: input.summary,
      applied_review_commands: {
        ...appliedCommands(source),
        [key]: {
          successorTaskId: successor.id,
          actionFingerprint: fingerprint,
          decision: input.decision,
          appliedAt: now,
        },
      },
    };
    if (!registry.root) {
      return reject(key, "project root task was not found");
    }
    registry.root.context = {
      ...record(registry.root.context),
      workCommandsV2: {
        ...boundedCommandRegistry({
          ...registry.commands,
          [key]: {
            successorTaskId: successor.id,
            actionFingerprint: fingerprint,
            decision: input.decision,
            appliedAt: now,
          },
        }),
      },
    };
    tree.active_task_ids = Object.values(tree.tasks)
      .filter((task) => taskState(task) === "active")
      .map((task) => task.id)
      .sort((left, right) => left.localeCompare(right));
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    return {
      handled: true as const,
      applied: true,
      replayed: false,
      commandKey: key,
      successorTaskId: successor.id,
    };
  });

  if (result.applied && !result.replayed) {
    appendToolJournal(config, {
      kind: "work_review_applied_v2",
      command_key: result.commandKey,
      task_id: input.taskId,
      task_revision: input.taskRevision,
      attempt_id: input.attemptId,
      decision: input.decision,
      successor_task_id: result.successorTaskId,
      action_kind: input.action.actionKind,
    });
  }
  return result;
}

export function revisePipelineVerificationPhaseV2(
  config: TaskTreeConfig,
  input: RevisePipelineVerificationPhaseInputV2,
): RevisePipelineVerificationPhaseResultV2 {
  const key = `work.revise-phase:${input.taskId}:${input.taskRevision}:${input.attemptId}:pipeline-verification:${input.runId}`;
  const base = {
    commandKey: key,
    taskId: input.taskId,
    fromRevision: input.taskRevision,
  };
  const result = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "phase source task was not found",
      };
    }
    const phase = record(record(task.context).phaseContract);
    if (phase.commandKey === key) {
      return {
        ...base,
        applied: true,
        replayed: true,
        toRevision: taskRevision(task),
      };
    }
    if (taskRevision(task) !== input.taskRevision) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: `phase source revision ${input.taskRevision} is stale; current revision is ${taskRevision(task)}`,
      };
    }
    if (taskState(task) !== "review") {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: `phase source is ${taskState(task)}, not review`,
      };
    }
    const trace = record(task.trace);
    if (trace.current_attempt_id !== input.attemptId) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "phase source attempt is stale",
      };
    }
    const context = record(task.context);
    if (context.controlPlaneVersion !== 2) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "phase source is not in the V2 control-plane cohort",
      };
    }
    if (context.workflow !== "fix-forward") {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "phase source is not a fix-forward contract",
      };
    }
    if (!input.runId.trim() || input.specIds.length === 0) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "pipeline verification requires an exact run and spec",
      };
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const toRevision = input.taskRevision + 1;
    const specIds = sortedUnique(input.specIds);
    const nextCheckAt = new Date(now + 10 * 60_000).toISOString();
    const fallbackAt = new Date(now + 2 * 60 * 60_000).toISOString();
    const fallbackAction =
      "Refresh this exact Condition or escalate a proven queue/artifact issue; do not replay the fix-forward phase.";
    let registeredCondition;
    try {
      registeredCondition = upsertPipelineConditionInTree(tree, {
        mode: input.conditionV2,
        backend: "ado",
        runId: input.runId,
        runUrl: input.runUrl,
        taskId: input.taskId,
        taskRevision: toRevision,
        nextCheckAt,
        fallbackAt,
        fallbackAction,
        now: nowIso,
      });
    } catch (error) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    const resultRef = `.state/task-reviewer-runs.jsonl#${input.taskId}:${input.taskRevision}:${input.attemptId}`;
    const condition = `Azure DevOps run ${input.runId} is the exact verification prerequisite for ${specIds.join(", ")}.`;
    task.revision = toRevision;
    task.state = "blocked";
    delete task.status;
    task.workflow = "default-task-worker";
    task.goal = `Inspect terminal Azure DevOps run ${input.runId} artifacts for ${specIds.join(", ")} and record only the current verification result.`;
    task.inputs = [
      `Accepted phase result: ${resultRef}`,
      `ADO run: ${input.runId}`,
      ...specIds.map((specId) => `Spec: ${specId}`),
    ];
    task.outputs = ["runs/test-results/"];
    task.acceptance = [
      `Azure DevOps run ${input.runId} is terminal and its exact artifacts are inspected.`,
      "The current phase returns SPEC_RESULT_REVIEW only; it does not reproduce the prior fix-forward result.",
    ];
    task.conflict_scope = sortedUnique([
      ...normalizeStringArray(task.conflict_scope).filter(
        (scope) => !scope.startsWith("ado-run:") && !scope.startsWith("spec:"),
      ),
      ...specIds.map((specId) => `spec:${specId}`),
      `ado-run:${input.runId}`,
    ]);
    task.context = {
      ...context,
      workflow: "spec-result-review",
      phaseContract: {
        commandKey: key,
        revision: toRevision,
        workflow: "spec-result-review",
        resultSchema: "SPEC_RESULT_REVIEW",
        acceptedPhaseResultRef: resultRef,
      },
      conditionId: registeredCondition.id,
      acceptedPhaseResult: {
        revision: input.taskRevision,
        attemptId: input.attemptId,
        resultRef,
        summary: input.summary,
      },
      acceptedQueuedPipelineRun: {
        sourceTaskId: input.taskId,
        sourceRevision: input.taskRevision,
        sourceAttemptId: input.attemptId,
        runId: input.runId,
        runUrl: input.runUrl,
        specIds,
        summary: input.summary,
      },
    };
    delete task.context.terminalPipelineWaitReview;
    task.blocker = {
      condition,
      condition_id: registeredCondition.id,
      category: "external-wait",
      owner: "ado",
      blocked_at: nowIso,
      waiting_for: {
        type: "ado.pipeline_run.completed",
        runId: input.runId,
        runUrl: input.runUrl,
        specIds,
        subjectTaskId: input.taskId,
        subjectRevision: toRevision,
      },
      observed_by: {
        workflow: "project-execution-watchdog",
        trigger: "project.task.reviewed",
      },
      observation_method:
        "Watchdog observes the exact run and enables artifact review only when terminal; the worker executes the revision-local spec-result-review contract.",
      next_check_at: nextCheckAt,
      resume_condition: `Resume revision ${toRevision} only when run ${input.runId} is terminal and its artifacts are available.`,
      fallback_at: fallbackAt,
      fallback_action: fallbackAction,
    };
    task.result = input.summary;
    task.trace = {
      ...trace,
      previous_attempt_id: input.attemptId,
      current_attempt_id: undefined,
      current_task_revision: toRevision,
      phase_revised_at: nowIso,
      phase_revised_by: "work.revise.v2",
      phase_command_key: key,
    };
    task.session_id = undefined;
    tree.active_task_ids = Object.values(tree.tasks)
      .filter((candidate) => taskState(candidate) === "active")
      .map((candidate) => candidate.id)
      .sort((left, right) => left.localeCompare(right));
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    return {
      ...base,
      applied: true,
      replayed: false,
      toRevision,
    };
  });

  if (result.applied && !result.replayed && "toRevision" in result) {
    appendToolJournal(config, {
      kind: "work_phase_revised_v2",
      command_key: key,
      task_id: input.taskId,
      from_revision: input.taskRevision,
      to_revision: result.toRevision,
      previous_attempt_id: input.attemptId,
      workflow: "spec-result-review",
      run_id: input.runId,
      spec_ids: sortedUnique(input.specIds),
    });
  }
  return result;
}

export function adoptExactPipelineWaitV2(
  config: TaskTreeConfig,
  input: AdoptExactPipelineWaitV2Input,
): AdoptExactPipelineWaitV2Result {
  const key = `work.adopt-exact-pipeline-condition:${input.taskId}:0:${input.runId}`;
  const base = {
    commandKey: key,
    taskId: input.taskId,
    runId: input.runId,
    fromRevision: 0,
  };
  if (input.adoptionV2 !== "exact-task") {
    return {
      ...base,
      applied: false,
      replayed: false,
      reason: "exact pipeline Condition adoption V2 writer is disabled",
    };
  }
  const result = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "exact pipeline wait task was not found",
      };
    }
    const context = record(task.context);
    const priorAdoption = record(context.conditionAdoptionV2);
    if (priorAdoption.commandKey === key) {
      const conditionId =
        typeof priorAdoption.conditionId === "string"
          ? priorAdoption.conditionId
          : undefined;
      return {
        ...base,
        applied: Boolean(
          conditionId &&
          conditionRegistry(tree)[conditionId] &&
          taskRevision(task) === 1 &&
          context.controlPlaneVersion === 2,
        ),
        replayed: true,
        toRevision: taskRevision(task),
        conditionId,
        ...(!conditionId
          ? { reason: "adopted task lost its Condition identity" }
          : {}),
      };
    }
    if (taskRevision(task) !== 0) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: `exact pipeline wait revision is ${taskRevision(task)}, not compatibility revision 0`,
      };
    }
    if (taskState(task) !== "blocked") {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: `exact pipeline wait is ${taskState(task)}, not blocked`,
      };
    }
    const blocker = record(task.blocker);
    const waitingFor = record(blocker.waiting_for ?? blocker.waitingFor);
    if (
      waitingFor.type !== "ado.pipeline_run.completed" ||
      String(waitingFor.runId ?? "") !== input.runId
    ) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "task is not the exact requested ADO pipeline wait",
      };
    }
    const runUrl =
      typeof waitingFor.runUrl === "string" && waitingFor.runUrl.trim()
        ? waitingFor.runUrl.trim()
        : `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=${input.runId}`;
    const specIds = sortedUnique(
      Array.isArray(waitingFor.specIds)
        ? waitingFor.specIds.filter(
            (value): value is string =>
              typeof value === "string" && Boolean(value.trim()),
          )
        : [],
    );
    if (specIds.length === 0) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: "exact ADO pipeline wait has no structured spec ids",
      };
    }
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const nextCheckAt =
      typeof blocker.next_check_at === "string" && blocker.next_check_at.trim()
        ? blocker.next_check_at
        : new Date(nowMs + 10 * 60_000).toISOString();
    const fallbackAt =
      typeof blocker.fallback_at === "string" && blocker.fallback_at.trim()
        ? blocker.fallback_at
        : new Date(nowMs + 2 * 60 * 60_000).toISOString();
    const fallbackAction =
      typeof blocker.fallback_action === "string" &&
      blocker.fallback_action.trim()
        ? blocker.fallback_action
        : "Refresh this exact Condition or escalate a proven queue/artifact issue.";
    const toRevision = 1;
    let condition;
    try {
      condition = upsertPipelineConditionInTree(tree, {
        mode: input.conditionV2,
        backend: "ado",
        runId: input.runId,
        runUrl,
        taskId: task.id,
        taskRevision: toRevision,
        nextCheckAt,
        fallbackAt,
        fallbackAction,
        now,
      });
    } catch (error) {
      return {
        ...base,
        applied: false,
        replayed: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    task.revision = toRevision;
    task.context = {
      ...context,
      controlPlaneVersion: 2,
      conditionId: condition.id,
      conditionAdoptionV2: {
        commandKey: key,
        conditionId: condition.id,
        fromRevision: 0,
        toRevision,
        runId: input.runId,
        adoptedAt: now,
      },
    };
    task.blocker = {
      ...blocker,
      category: "external-wait",
      owner: "ado",
      waiting_for: {
        ...waitingFor,
        type: "ado.pipeline_run.completed",
        backend: "ado",
        runId: input.runId,
        runUrl,
        specIds,
        subjectTaskId: task.id,
        subjectRevision: toRevision,
      },
      condition_id: condition.id,
      observed_by: {
        workflow: "project-execution-watchdog",
        trigger: "project.watchdog.check.requested",
      },
      observation_method:
        "Watchdog and project.test_run.completed resolve the same exact Condition for this run and task revision.",
      next_check_at: nextCheckAt,
      resume_at: undefined,
      resumeAt: undefined,
      resume_condition: condition.resumeCondition,
      fallback_at: fallbackAt,
      fallback_action: fallbackAction,
    };
    task.trace = {
      ...record(task.trace),
      current_task_revision: toRevision,
      condition_adopted_at: now,
      condition_adoption_command_key: key,
      condition_id: condition.id,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    return {
      ...base,
      applied: true,
      replayed: false,
      toRevision,
      conditionId: condition.id,
    };
  });
  if (
    result.applied &&
    !result.replayed &&
    "toRevision" in result &&
    "conditionId" in result
  ) {
    appendToolJournal(config, {
      kind: "exact_pipeline_wait_adopted_v2",
      command_key: result.commandKey,
      task_id: result.taskId,
      run_id: result.runId,
      from_revision: result.fromRevision,
      to_revision: result.toRevision,
      condition_id: result.conditionId,
    });
  }
  return result;
}
