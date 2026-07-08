/**
 * problem-solver — focused unblock workflow for aks-rp-e2e.
 *
 * Handles project.problem.investigation.requested by waking a focused solver session. The
 * solver investigates and may fix local runner/app/domain defects, but the
 * planner remains responsible for task-tree reconciliation.
 */

import { join } from "node:path";
import { appendFileSync, mkdirSync } from "node:fs";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
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

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
    opts?: { timeoutMs?: number },
  ) => Promise<unknown>;
};

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

function problemKeyFromTrigger(trigger: ReturnType<typeof parseTriggerEvent>) {
  return (
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
- cd ${input.appDir} && bun run task-tree frontier
- cd ${input.appDir} && bun run task-tree show <task-id>
- cd ${input.projectDir} && bun run status -- --gaps
- cd ${input.projectDir} && find runs/executions evidence/archive -maxdepth 2 -type f -mmin -120
- rg -n "Scenario_|NewScenario|suites.Static" ${input.sourceDir}/test/e2ev3

${input.trigger}`.trim();
}

async function runSolverStep(input: {
  ctx: WorkflowContext;
  agent: string;
  prompt: string;
  sessionId: string;
}): Promise<unknown> {
  const sessionCtx = input.ctx as SessionWorkflowContext;
  return sessionCtx.runAgentSession
    ? sessionCtx.runAgentSession(input.agent, input.prompt, input.sessionId, {
        timeoutMs: 900_000,
      })
    : input.ctx.runAgent(input.agent, input.prompt);
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

  // Backward-compatibility fallback for older solver sessions that returned a
  // concrete fixed/verified summary without the explicit marker line.
  if (
    /(fixed|resolved|repaired)/i.test(text) &&
    /(verified|verification|check passed|tests passed|retry)/i.test(text)
  ) {
    return "project.problem.resolved";
  }

  // Agent didn't declare a result — don't guess from unrelated free text.
  // The planner will see "inconclusive" and decide.
  return "project.problem.inconclusive";
}

function emitProblemResult(
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
): void {
  try {
    ctx.dispatchEvent(input.type, {
      target: { project: "aks-rp-e2e" },
      project: "aks-rp-e2e",
      problemKey: input.problemKey,
      problem_key: input.problemKey,
      affectedTasks: input.affectedTasks,
      affected_tasks: input.affectedTasks,
      summary: input.summary,
      requested_by: "problem-solver",
    });
  } catch {
    // Local tests may not provide a dispatcher.
  }
}

function appendProblemRun(
  appDir: string,
  entry: Record<string, unknown>,
): void {
  const path = join(appDir, ".state", "problem-runs.jsonl");
  mkdirSync(join(appDir, ".state"), { recursive: true });
  appendFileSync(
    path,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      workflow: "problem-solver",
      ...entry,
    })}\n`,
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const sourceRoot = sourceDir(ctx.task);
  const trigger = parseTriggerEvent(ctx.task);
  const agent =
    field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent;

  if (trigger?.type !== "project.problem.investigation.requested") {
    return ctx.done(
      `Problem solver ignored trigger ${String(trigger?.type ?? "unknown")}; use project.problem.investigation.requested.`,
    );
  }

  const problemKey = problemKeyFromTrigger(trigger);
  const affectedTasks = [
    ...new Set(
      [
        ...stringList(triggerValue(trigger, "affectedTasks")),
        ...stringList(triggerValue(trigger, "affected_tasks")),
        triggerString(trigger, "taskId"),
        triggerString(trigger, "task_id"),
      ].filter(Boolean),
    ),
  ];

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
        trigger: triggerBlock(ctx.task),
        affectedTasks,
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
  emitProblemResult(ctx, {
    type,
    problemKey,
    affectedTasks,
    summary,
  });
  appendProblemRun(appDir, {
    problem_key: problemKey,
    affected_task_ids: affectedTasks,
    result_event: type,
    result: summary.slice(0, 4000),
  });

  return ctx.done(
    `Problem solver emitted ${type} for ${problemKey}. Result: ${summary}`,
  );
}

if (import.meta.main) {
  if (process.env.MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT !== "1") {
    console.error(
      "Direct workflow entrypoint is disabled by default. Set MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT=1 to run it.",
    );
    process.exit(0);
  }
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer",
    agent: "aks-explorer",
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as unknown as WorkflowContext);
  console.log(JSON.stringify(result));
}
