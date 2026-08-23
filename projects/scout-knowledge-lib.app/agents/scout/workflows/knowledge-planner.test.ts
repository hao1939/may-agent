import { describe, expect, it } from "bun:test";
import { admitTaskReconcileResult, type WorkflowContext } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { admitExperienceReviewResult, execute } from "./knowledge-planner";

describe("Scout owner reconciliation boundary", () => {
  it("normalizes an omitted experience-task mode to finite achieve work", () => {
    const admitted = admitExperienceReviewResult({
      state: "converged",
      summary: "Proposed one bounded improvement.",
      evidence: ["Three reconciliations showed the same mechanical failure."],
      actions: [
        {
          kind: "create-task",
          id: "improve-source-diagnostic",
          outcome: "Make source rejection diagnostic",
          acceptance: ["The rejected field is named"],
        },
      ],
    });

    expect(admitted).toMatchObject({
      ok: true,
      result: {
        actions: [
          {
            kind: "create-task",
            id: "improve-source-diagnostic",
            mode: "achieve",
          },
        ],
      },
    });
  });

  it("rejects multiple tasks or maintain work from an experience review", () => {
    const task = (id: string, mode: "achieve" | "maintain" = "achieve") => ({
      kind: "create-task" as const,
      id,
      outcome: `Complete ${id}`,
      acceptance: [`${id} is complete`],
      mode,
    });

    expect(
      admitExperienceReviewResult({
        state: "converged",
        summary: "Too much work.",
        evidence: ["packet"],
        actions: [task("one"), task("two")],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("at most one"),
    });
    expect(
      admitExperienceReviewResult({
        state: "converged",
        summary: "Standing work.",
        evidence: ["packet"],
        actions: [task("standing", "maintain")],
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("maintain") });
  });

  it("returns typed task proposals for the generic reconciler", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    let prompt = "";
    let runOptions: Record<string, unknown> | undefined;
    const result = await execute(
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "library-maintenance",
          generation: 1,
          resourceVersion: 1,
          agent: "scout",
          mode: "maintain",
          outcome: "Maintain the library",
          acceptance: ["One bounded decision is recorded"],
          input: {},
          children: { live: [], completed: [] },
          events: { items: [], truncated: false },
        },
        workspace: {
          appRoot: "/app/projects/scout-knowledge-lib.app",
          projectRoot: "/app/projects/scout-knowledge-lib",
          root: "/app/projects/scout-knowledge-lib",
          output: "/app/projects/scout-knowledge-lib.app/.state/output",
        },
        callAgent: (async (
          _agent: string,
          value: string,
          options?: Record<string, unknown>,
        ) => {
          prompt = value;
          runOptions = options;
          return {
            id: "s_owner",
            kind: "agent",
            status: "done",
            summary: "proposed maintenance task",
            output: {
              state: "converged",
              summary: "Proposed one bounded maintenance task.",
              evidence: ["library packet identifies the gap"],
              actions: [
                {
                  kind: "create-task",
                  id: "repair-navigation",
                  parentId: "library-maintenance",
                  outcome: "Repair library navigation",
                  outputs: ["knowledge/README.md"],
                  acceptance: ["The landing page links canonical notes"],
                },
              ],
            },
          };
        }) as WorkflowContext["agents"]["call"],
        emit: async (event) => {
          emitted.push(event as unknown as Record<string, unknown>);
        },
      }),
    );

    expect(prompt).toContain("Host is the sole task-state mutation authority");
    expect(runOptions?.schema).toBeDefined();
    expect(emitted.at(-1)).toMatchObject({
      type: "project.knowledge.maintained",
      localKey: "state-1:knowledge-maintained",
      data: {
        proposedActions: [{ kind: "create-task", id: "repair-navigation" }],
      },
    });
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        actions: [{ kind: "create-task", id: "repair-navigation" }],
      },
    });
    const admitted = admitTaskReconcileResult(
      result.status === "done" ? result.output : undefined,
      { allowNeedsAgent: true, defaultParentId: "project" },
    );
    expect(admitted.ok && admitted.result.actions?.[0]).toMatchObject({
      kind: "create-task",
      id: "repair-navigation",
      mode: "achieve",
      priority: "P2",
    });
  });

  it("prepares bounded experience evidence before the owner generation", async () => {
    let prompt = "";
    const result = await execute(
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "library-maintenance",
          generation: 2,
          resourceVersion: 2,
          agent: "scout",
          mode: "maintain",
          outcome: "Review library experience",
          acceptance: ["One bounded decision is recorded"],
          input: {},
          children: { live: [], completed: [] },
          events: {
            items: [
              {
                observedAt: "2026-08-21T00:00:00.000Z",
                event: {
                  type: "project.owner.requested",
                  data: {
                    project: "scout-knowledge-lib",
                    reason: "experience-review",
                  },
                },
              },
            ],
            truncated: false,
          },
        },
        workspace: {
          appRoot: "/app/projects/scout-knowledge-lib.app",
          projectRoot: "/app/projects/scout-knowledge-lib",
          root: "/app/projects/scout-knowledge-lib",
          output: "/app/projects/scout-knowledge-lib.app/.state/output",
        },
        callAgent: (async (_agent: string, value: string) => {
          prompt = value;
          return {
            id: "s_review",
            kind: "agent",
            status: "done",
            summary: "No improvement justified.",
            output: {
              state: "converged",
              summary: "No improvement justified.",
              evidence: ["experience window contained no reconciliations"],
              actions: [],
            },
          };
        }) as WorkflowContext["agents"]["call"],
      }),
    );

    expect(prompt).toContain("Bounded reconciliation history");
    expect(prompt).toContain("Canonical reconciliation context");
    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged", actions: [] },
    });
  });
});
