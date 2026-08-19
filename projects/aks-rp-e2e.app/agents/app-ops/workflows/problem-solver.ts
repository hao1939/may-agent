/**
 * problem-solver — focused unblock workflow for aks-rp-e2e.
 *
 * Handles project.problem.investigation.requested by waking a focused solver session. The
 * solver investigates and may fix local runner/app/domain defects, but the
 * planner remains responsible for task-tree reconciliation.
 */

import type {
  AppEvent,
  ExecutionResult,
  WorkflowContext,
} from "@may-agent/sdk";
import {
  field,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  sourceDir,
  triggerBlock,
  triggerString,
  triggerValue,
} from "./lib/workflow-input.ts";

export const name = "problem-solver";
export const description =
  "Investigate one project problem and emit resolved/escalated feedback for the planner.";

function solverSessionId(problemKey: string): string {
  const safeKey =
    problemKey
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 72) || "project_problem";
  return `s_problem_${safeKey}`;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function problemSolverTaskInput(
  ctx: WorkflowContext,
): Record<string, unknown> | null {
  return recordValue(ctx.reconciliation?.input ?? ctx.input);
}

function taskInputString(
  input: Record<string, unknown> | null,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function problemKeyFromTrigger(
  trigger: ReturnType<typeof parseTriggerEvent>,
  taskInput?: Record<string, unknown> | null,
) {
  return (
    taskInputString(taskInput ?? null, "problemKey", "problem_key") ||
    triggerString(trigger, "problemKey") ||
    triggerString(trigger, "problem_key") ||
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    `problem_${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`
  );
}

function buildSolverPrompt(input: {
  appDir: string;
  projectDir: string;
  sourceDir: string;
  agent: string;
  problemKey: string;
  trigger: string;
  affectedTasks: string[];
  taskFacts: {
    live: Array<Record<string, unknown>>;
    truncated: boolean;
  };
}): string {
  return `Problem Solver Mode

You are handling one aks-rp-e2e project problem. The purpose is to make the
failure/blocking process large, visible, and resolved quickly.

Boundaries:
- Do not reshape the task tree, accept tasks, roll up parents, or dispatch work.
  The planner owns all task-tree decisions.
- You may inspect task context, run diagnostics, and fix local app/domain runner
  or replay code when the problem is caused by our tools or environment setup.
- If the problem needs external input, credentials, quota, policy, product
  rollout, or human decision, do not cycle. Produce a concrete escalation with
  exact evidence and resume conditions.
- For source-related problems, first inspect the mounted AKS RP Go source at
  ${input.sourceDir}. Do not escalate missing source/devbox/source-holder issues
  until the relevant mounted source paths have been checked.
- If you fix something, verify the fix as far as possible and state the exact
  retry event or task the planner should use.

Finish with one explicit line:

  PROBLEM_RESULT: resolved | escalated | inconclusive

Also include:
- ROOT_CAUSE:
- ACTION_TAKEN:
- VERIFICATION:
- PLANNER_NEXT:

App: ${input.appDir}
Domain workspace: ${input.projectDir}
Source workspace: ${input.sourceDir}
Agent: ${input.agent}
Problem key: ${input.problemKey}
Affected tasks: ${input.affectedTasks.length ? input.affectedTasks.join(", ") : "unknown"}

Useful commands:
- cd ${input.projectDir} && bun run status -- --gaps
- cd ${input.projectDir} && find runs/executions evidence/archive -maxdepth 2 -type f -mmin -120
- rg -n "Scenario_|NewScenario|suites.Static" ${input.sourceDir}/test/e2ev3

Current bounded task facts (absence is conclusive only when truncated=false):
\`\`\`json
${JSON.stringify(input.taskFacts, null, 2)}
\`\`\`

${input.trigger}`.trim();
}

async function runSolverStep(input: {
  ctx: WorkflowContext;
  agent: string;
  prompt: string;
  sessionId: string;
}): Promise<unknown> {
  return input.ctx.agents.call(input.agent, input.prompt, {
    sessionId: input.sessionId,
    timeoutMs: 900_000,
  });
}

function problemResultType(
  text: string,
):
  | "project.problem.resolved"
  | "project.problem.escalated"
  | "project.problem.inconclusive" {
  if (/PROBLEM_RESULT:\s*resolved/i.test(text))
    return "project.problem.resolved";
  if (/PROBLEM_RESULT:\s*escalated/i.test(text))
    return "project.problem.escalated";
  if (/PROBLEM_RESULT:\s*inconclusive/i.test(text))
    return "project.problem.inconclusive";

  // Agent didn't declare a result — don't guess from unrelated free text.
  // The planner will see "inconclusive" and decide.
  return "project.problem.inconclusive";
}

async function emitProblemResult(
  ctx: WorkflowContext,
  input: {
    type:
      | "project.problem.resolved"
      | "project.problem.escalated"
      | "project.problem.inconclusive";
    problemKey: string;
    affectedTasks: string[];
    summary: string;
  },
): Promise<void> {
  await ctx.events.emit({
    type: input.type,
    target: { appId: "aks-rp-e2e", project: "aks-rp-e2e" },
    data: {
      project: "aks-rp-e2e",
      problemKey: input.problemKey,
      problem_key: input.problemKey,
      affectedTasks: input.affectedTasks,
      affected_tasks: input.affectedTasks,
      summary: input.summary,
      requested_by: "problem-solver",
    },
  } satisfies AppEvent<Record<string, unknown>>);
}

function finishProblemSolver(
  ctx: WorkflowContext,
  input: {
    state: "converged" | "needs-owner";
    summary: string;
    evidence: string[];
  },
): ExecutionResult {
  const output: {
    state: "converged" | "needs-owner";
    summary: string;
    evidence: string[];
    actions?: [];
  } = {
    state: input.state,
    summary: input.summary,
    evidence: input.evidence,
  };
  if (input.state === "converged") output.actions = [];
  return ctx.done(input.summary, output);
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const projectDir = ctx.workspace?.projectRoot;
  if (!projectDir) {
    throw new Error("problem-solver requires workspace.projectRoot");
  }
  const appDir = resolveAppDir(projectDir, ctx.workspace?.appRoot);
  const sourceRoot = sourceDir(ctx);
  const trigger = parseTriggerEvent(ctx);
  const taskInput = problemSolverTaskInput(ctx);
  const agent = field(ctx, "owner") ?? field(ctx, "agent") ?? "aks-explorer";
  const hasAdmittedProblem = Boolean(
    taskInputString(taskInput, "problemKey", "problem_key"),
  );

  if (
    trigger?.type !== "project.problem.investigation.requested" &&
    !hasAdmittedProblem
  ) {
    const summary = `Problem solver ignored trigger ${String(trigger?.type ?? "unknown")}; use project.problem.investigation.requested.`;
    return finishProblemSolver(ctx, {
      state: "needs-owner",
      summary,
      evidence: ["problem-solver:invalid-trigger"],
    });
  }

  const problemKey = problemKeyFromTrigger(trigger, taskInput);
  const affectedTaskFromTrigger =
    trigger?.type === "project.problem.investigation.requested"
      ? [
          ...stringList(triggerValue(trigger, "affectedTasks")),
          ...stringList(triggerValue(trigger, "affected_tasks")),
          triggerString(trigger, "taskId"),
          triggerString(trigger, "task_id"),
        ]
      : [];
  const affectedTasks = [
    ...new Set(
      [
        ...stringList(taskInput?.affectedTasks),
        ...stringList(taskInput?.affected_tasks),
        ...affectedTaskFromTrigger,
        taskInputString(taskInput, "targetTaskId", "target_task_id"),
      ].filter(Boolean),
    ),
  ];
  const taskSnapshot = ctx.reconciliation?.taskSnapshot;
  const taskFacts = {
    live: (taskSnapshot?.live ?? [])
      .filter(
        (task) =>
          affectedTasks.length === 0 || affectedTasks.includes(task.taskId),
      )
      .map((task) => ({
        taskId: task.taskId,
        status: task.status,
        outcome: task.outcome,
        owner: task.owner,
        readiness: task.readiness,
        conditions: task.conditions,
      })),
    truncated: taskSnapshot?.truncated ?? false,
  };

  let solverResult: unknown;
  try {
    solverResult = await runSolverStep({
      ctx,
      agent,
      sessionId: solverSessionId(problemKey),
      prompt: buildSolverPrompt({
        appDir,
        projectDir,
        sourceDir: sourceRoot,
        agent,
        problemKey,
        trigger: triggerBlock(ctx),
        affectedTasks,
        taskFacts,
      }),
    });
  } catch (err) {
    solverResult = {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const summary = resultText(solverResult);
  const type = problemResultType(summary);
  await emitProblemResult(ctx, {
    type,
    problemKey,
    affectedTasks,
    summary,
  });
  const resultSummary = `Problem solver emitted ${type} for ${problemKey}. Result: ${summary}`;
  return finishProblemSolver(ctx, {
    state: "converged",
    summary: resultSummary,
    evidence: [`problem-solver:${problemKey}:${type}`, `event:${type}`],
  });
}
