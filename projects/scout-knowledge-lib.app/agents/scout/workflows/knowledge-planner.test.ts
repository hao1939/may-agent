import { describe, expect, it } from "bun:test";
import { execute } from "./knowledge-planner";

describe("Scout owner reconciliation boundary", () => {
  it("returns typed task proposals for the generic reconciler", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    let prompt = "";
    let runOptions: Record<string, unknown> | undefined;
    const result = await execute({
      task: "app: /app/projects/scout-knowledge-lib.app\nproject: /app/projects/scout-knowledge-lib",
      async runAgent(
        _agent: string,
        value: string,
        options?: Record<string, unknown>,
      ) {
        prompt = value;
        runOptions = options;
        return {
          status: "done",
          sessionId: "s_owner",
          lastAssistantText: "proposed maintenance task",
          structuredResult: {
            state: "converged",
            summary: "Proposed one bounded maintenance task.",
            evidence: ["library packet identifies the gap"],
            actions: [
              {
                kind: "create-task",
                id: "repair-navigation",
                parentId: "library-maintenance",
                goal: "Repair library navigation",
                outputs: ["knowledge/README.md"],
                acceptance: ["The landing page links canonical notes"],
              },
            ],
          },
        };
      },
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      done(summary: string, output?: unknown) {
        return { type: "done", summary, output } as const;
      },
      blocked(reason: string, context?: unknown) {
        return { type: "blocked", reason, context } as const;
      },
    } as never);

    expect(prompt).toContain("sole task-tree mutation authority");
    expect(runOptions?.schema).toBeDefined();
    expect(emitted.at(-1)).toMatchObject({
      type: "project.knowledge.maintained",
      proposedActions: [{ kind: "create-task", id: "repair-navigation" }],
    });
    expect(result).toMatchObject({
      type: "done",
      output: {
        state: "converged",
        actions: [{ kind: "create-task", id: "repair-navigation" }],
      },
    });
  });
});
