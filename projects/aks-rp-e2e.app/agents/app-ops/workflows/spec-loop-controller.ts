import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  resolveTaskTreePath,
  workflowResultVersion,
  type ProjectAppTaskAction,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  defaultSpecLoopStatePath,
  loadSpecLoopState,
  safeTaskIdForSpec,
  type SpecLoopSpecState,
} from "./lib/spec-loop-store.ts";
import {
  field,
  frontierLimit,
  parseTriggerEvent,
  resolveAppDir,
  triggerString,
} from "./lib/workflow-input.ts";
import {
  learnedSpecVerificationAcceptance,
  loopFrontierAccounting,
  specLoopTaskId,
} from "../../../task-loops.ts";

export const name = "spec-loop-controller";
export const description =
  "Observe single-spec verification state and declare the next bounded reconciliation work.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "spec-loop-controller-v2",
  input: {
    required: ["project.task.tick action=spec-loop", "target.taskId"],
    optional: ["frontierLimit"],
    description:
      "Reconcile one durable spec-loop responsibility from current state.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions"],
    description:
      "Returns bounded desired task actions and then converges; it never assigns work or writes the task graph.",
  },
};

type GraphTask = {
  id?: string;
  state?: string;
  phase?: string;
  goal?: string;
  outcome?: string;
  summary?: string;
  result?: string;
  acceptance?: unknown;
  conflict_scope?: unknown;
  input?: Record<string, unknown>;
};

type Graph = {
  tasks?: Record<string, GraphTask>;
  satisfied_dependency_ids?: string[];
};

function readGraph(appDir: string): Graph {
  try {
    return JSON.parse(
      readFileSync(resolveTaskTreePath(appDir), "utf8"),
    ) as Graph;
  } catch {
    return {};
  }
}

function represented(graph: Graph, taskId: string | null | undefined): boolean {
  return Boolean(taskId && graph.tasks?.[taskId]);
}

function representedTaskState(graph: Graph, taskId: string): string {
  return String(
    graph.tasks?.[taskId]?.phase ?? graph.tasks?.[taskId]?.state ?? "unknown",
  )
    .trim()
    .toLowerCase();
}

function collectReferencedTaskIds(
  value: unknown,
  ids: Set<string> = new Set(),
): Set<string> {
  if (!value || typeof value !== "object") return ids;
  if (Array.isArray(value)) {
    for (const entry of value) collectReferencedTaskIds(entry, ids);
    return ids;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" &&
      ["taskid", "task_id"].some((suffix) => key.toLowerCase().endsWith(suffix))
    ) {
      ids.add(entry);
      continue;
    }
    collectReferencedTaskIds(entry, ids);
  }
  return ids;
}

function representedTaskIdsForSpec(
  graph: Graph,
  specId: string,
  spec: SpecLoopSpecState,
): string[] {
  const representedTaskIds = new Set<string>();
  const deterministicTaskId = workId(specId, spec);
  if (represented(graph, deterministicTaskId))
    representedTaskIds.add(deterministicTaskId);
  const legacyTaskId = `spec/${safeTaskIdForSpec(specId)}`;
  if (represented(graph, legacyTaskId)) representedTaskIds.add(legacyTaskId);
  const deterministicDispositionRepairTaskId = dispositionRepairId(specId, spec);
  if (represented(graph, deterministicDispositionRepairTaskId)) {
    representedTaskIds.add(deterministicDispositionRepairTaskId);
  }
  const legacyDispositionRepairTaskId = legacyDispositionRepairId(specId);
  if (represented(graph, legacyDispositionRepairTaskId)) {
    representedTaskIds.add(legacyDispositionRepairTaskId);
  }
  for (const taskId of collectReferencedTaskIds(spec)) {
    if (represented(graph, taskId)) representedTaskIds.add(taskId);
  }
  for (const [taskId, task] of Object.entries(graph.tasks ?? {})) {
    if (
      (task.input?.loopId === specLoopTaskId &&
        task.input?.workKey === specId) ||
      (task.input?.loopTaskId === specLoopTaskId &&
        task.input?.specId === specId)
    ) {
      representedTaskIds.add(taskId);
    }
  }
  return [...representedTaskIds];
}

function workRevision(spec: SpecLoopSpecState): string {
  const source =
    spec.inputFingerprint ??
    spec.errorFingerprint ??
    spec.lastRunId ??
    spec.updatedAt;
  return createHash("sha256").update(source).digest("hex").slice(0, 10);
}

function workId(specId: string, spec: SpecLoopSpecState): string {
  return `spec/${safeTaskIdForSpec(specId)}-${workRevision(spec)}`;
}

function legacyDispositionRepairId(specId: string): string {
  return `spec/repair-${safeTaskIdForSpec(specId)}-disposition-representation`;
}

function dispositionRepairId(specId: string, spec: SpecLoopSpecState): string {
  return `${legacyDispositionRepairId(specId)}-${workRevision(spec)}`;
}

function isSatisfied(spec: SpecLoopSpecState): boolean {
  return (
    spec.status === "pass" ||
    spec.status === "done" ||
    spec.terminalDisposition === true
  );
}

function hasStructuredDisposition(spec: SpecLoopSpecState): boolean {
  return Boolean(
    spec.review &&
    (spec.successorDisposition ||
      spec.resumeCondition ||
      spec.successorEvidencePath),
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir =
    ctx.projectDir ?? field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir =
    ctx.appDir ?? resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);
  const loopTaskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    "aks-spec-verification-loop";
  const statePath = defaultSpecLoopStatePath(appDir);
  const { state } = loadSpecLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 5,
    statePath,
    refreshFromProject: false,
  });
  const graph = readGraph(appDir);
  const remaining = Object.entries(state.specs)
    .filter(([, spec]) => !isSatisfied(spec))
    .sort(([left], [right]) => {
      const leftPriority = state.prioritySpecIds.indexOf(left);
      const rightPriority = state.prioritySpecIds.indexOf(right);
      if (leftPriority >= 0 || rightPriority >= 0) {
        return (
          (leftPriority < 0 ? Number.MAX_SAFE_INTEGER : leftPriority) -
          (rightPriority < 0 ? Number.MAX_SAFE_INTEGER : rightPriority)
        );
      }
      const dateOrder = String(
        state.specs[left]?.updatedAt ?? "",
      ).localeCompare(String(state.specs[right]?.updatedAt ?? ""));
      return dateOrder || left.localeCompare(right);
    });

  if (remaining.length === 0) {
    const summary = `Spec loop ${loopTaskId} converged: all ${Object.keys(state.specs).length} specs passed or reached a reviewed terminal disposition.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`spec-loop-state:${statePath}`],
      actions: [],
    });
  }

  const representedBySpec = new Map(
    remaining.map(([specId, spec]) => [
      specId,
      representedTaskIdsForSpec(graph, specId, spec),
    ]),
  );
  const representedTaskIds = [
    ...new Set([...representedBySpec.values()].flatMap((taskIds) => taskIds)),
  ];
  const accounting = loopFrontierAccounting(
    representedTaskIds.map((taskId) => ({
      taskId,
      phase: representedTaskState(graph, taskId),
    })),
    Math.min(12, frontierLimit(ctx.task, 5)),
  );
  const actionBudget = accounting.available;
  const actions: ProjectAppTaskAction[] = remaining
    .filter(([specId]) => (representedBySpec.get(specId) ?? []).length === 0)
    .slice(0, actionBudget)
    .map(([specId, spec]) => {
      if (hasStructuredDisposition(spec)) {
        return {
          kind: "create-task",
          id: dispositionRepairId(specId, spec),
          parentId: "group/spec-verification",
          outcome: `Repair the spec-loop representation for ${specId}: the ledger already has a structured reviewed disposition, but no live task holder and no terminalDisposition=true flag, so the controller cannot tell whether to wait, finish, or rerun.`,
          mode: "achieve",
          owner: "aks-explorer",
          workflow: "domain-task-execution",
          input: {
            specId,
            loopId: specLoopTaskId,
            workKey: specId,
            workRevision: workRevision(spec),
            statePath,
          },
          outputs: [statePath, "../aks-rp-e2e/evidence/archive/"],
          acceptance: [
            "Inspect the current spec-loop row, source, model, runner, cited evidence, and current .state/tasks/tree.json before changing anything.",
            "Treat any taskId, successorTaskId, or review.frontierTaskId that is absent from the current .state/tasks/tree.json as stale history; do not return an action that references a missing task id.",
            "If the reviewed disposition is still valid and no further run is truthful, make it controller-visible by setting terminalDisposition=true or by creating/repointing one exact live holder task and updating taskId/review pointers.",
            "If the reviewed disposition is stale or actually runnable, clear or replace the stale disposition and leave the exact next verification task or rerun path represented.",
            "Do not launch an unchanged rerun merely because the row is pending; first repair the missing representation.",
          ],
          priority: "P1",
        };
      }
      return {
        kind: "create-task",
        id: workId(specId, spec),
        parentId: "group/spec-verification",
        outcome: `Reconcile ${specId} to a passing live result, an exact wait, or a reviewed terminal disposition.`,
        mode: "achieve",
        owner: "aks-explorer",
        workflow: "spec-live-reconciliation",
        input: {
          specId,
          loopId: specLoopTaskId,
          workKey: specId,
          workRevision: workRevision(spec),
          statePath,
        },
        outputs: [statePath, "../aks-rp-e2e/runs/test-results/"],
        acceptance: [
          ...learnedSpecVerificationAcceptance,
          "Current source, model, runner, and prior evidence are inspected before any rerun.",
          "A live pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
          "When source changes, keep edit, exact live verification, fix-forward, PR into dev, and merge verification in this same finite task and task branch.",
          "The loop state is updated with evidence before this task converges.",
        ],
        priority: "P1",
      };
    });
  const summary = `Spec loop ${loopTaskId} has ${remaining.length} nonterminal spec(s): declared ${actions.length} bounded task action(s), observed ${accounting.actionableTaskIds.length} actionable, ${accounting.waitingTaskIds.length} waiting, ${accounting.attentionTaskIds.length} attention, and ${accounting.terminalTaskIds.length} stale terminal representation(s).`;
  const resultState =
    actions.length > 0 ||
    accounting.actionableTaskIds.length > 0 ||
    accounting.waitingTaskIds.length > 0
      ? "converged"
      : "needs-owner";
  if (resultState === "needs-owner") {
    return ctx.done(summary, {
      state: resultState,
      summary,
      evidence: [`spec-loop-state:${statePath}`],
    });
  }
  return ctx.done(summary, {
    state: resultState,
    summary,
    evidence: [`spec-loop-state:${statePath}`],
    actions,
  });
}
