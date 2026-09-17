import { describe, expect, test } from "bun:test";
import { taskAgentResultSchema } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { Check } from "typebox/value";
import { execute as executeHeartbeat } from "./evaluator-heartbeat.js";
import {
  execute as executeProjectHealth,
  projectHealthJudgmentSchema,
} from "./project-health-evaluator.js";

const agentResult = {
  state: "converged" as const,
  summary: "The supplied owner state is already coherent.",
  facts: ["bounded reconciliation packet"],
  actions: [],
};

const healthResult = {
  verdict: "watch" as const,
  mainConcern: "The declared metric is stale relative to current workflows.",
  affectedArtifacts: ["metric:gym.valid-run-rate"],
  recommendedChange: "Refresh the metric from a terminal workflow receipt.",
  verification: ["A newer metric snapshot cites the terminal workflow."],
  requestedHumanAction: "watch" as const,
  notify: false,
  dedupeKey: "gym.app:stale-metric",
  message: "Refresh or retire the stale declared metric.",
  observations: {
    task: "The relevant maintain task is live.",
    metrics: "The latest snapshot predates current workflow evidence.",
    runtime: "A newer terminal workflow is visible.",
    sourceRevisions: ["project.json@fixture", "workflow-run:fixture"],
  },
};

function reconciliation(taskId: string, input: Record<string, unknown>) {
  return {
    appId: "evaluation",
    taskId,
    generation: 1,
    resourceVersion: 1,
    agent: "evaluator",
    mode: "maintain" as const,
    outcome: "Maintain a current evaluation result.",
    acceptance: ["A schema-backed result is reconciled."],
    input,
    children: { live: [], completed: [] },
    taskSnapshot: { live: [], truncated: false },
    events: { items: [], truncated: false },
  };
}

describe("schema-backed agent finish result envelope", () => {
  test("evaluator-heartbeat requests and consumes finish().result as an object", async () => {
    let suppliedSchema: unknown;
    const ctx = createTestAppWorkflowContext({
      input: { scope: "evaluation.app" },
      reconciliation: reconciliation("runtime/owner-review", {
        scope: "evaluation.app",
      }),
      callAgent: async (_agent, _prompt, options) => {
        suppliedSchema = options?.schema;
        return {
          id: "s_owner_result",
          kind: "agent",
          status: "done",
          summary: "Human-readable session summary is not the result envelope.",
          output: agentResult,
        };
      },
    });

    await expect(executeHeartbeat(ctx)).resolves.toMatchObject({
      status: "done",
      output: agentResult,
    });
    expect(suppliedSchema).toBe(taskAgentResultSchema);
    expect(Check(taskAgentResultSchema, agentResult)).toBe(true);
    expect(Check(taskAgentResultSchema, JSON.stringify(agentResult))).toBe(
      false,
    );
    expect(
      Check(taskAgentResultSchema, { ...agentResult, unexpected: true }),
    ).toBe(false);
  });

  test("project-health-evaluator requests and consumes a strict finish().result object", async () => {
    let suppliedSchema: unknown;
    const root = `${process.env.TMPDIR ?? "/tmp"}/evaluation-result-envelope-${crypto.randomUUID()}`;
    const ctx = createTestAppWorkflowContext({
      input: { targetProject: "gym.app" },
      reconciliation: reconciliation("runtime/project-audit/gym.app", {
        targetProject: "gym.app",
      }),
      workspace: {
        appRoot: root,
        projectRoot: root,
        root,
        output: root,
      },
      callAgent: async (_agent, _prompt, options) => {
        suppliedSchema = options?.schema;
        return {
          id: "s_health_result",
          kind: "agent",
          status: "done",
          summary: "Human-readable session summary is not the result envelope.",
          output: healthResult,
        };
      },
    });

    await expect(executeProjectHealth(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: [
          expect.stringContaining("report:"),
          "execution:s_health_result",
        ],
      },
    });
    expect(suppliedSchema).toBe(projectHealthJudgmentSchema);
    expect(Check(projectHealthJudgmentSchema, healthResult)).toBe(true);
    expect(
      Check(projectHealthJudgmentSchema, JSON.stringify(healthResult)),
    ).toBe(false);
    expect(
      Check(projectHealthJudgmentSchema, {
        ...healthResult,
        observations: { task: "missing the rest of the raw source facts" },
      }),
    ).toBe(false);
  });
});
