import { describe, expect, it } from "bun:test";
import { admitProjectAppTaskHandlerResult } from "@may-agent/sdk";
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
                outcome: "Repair library navigation",
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
    const admitted = admitProjectAppTaskHandlerResult(
      result.type === "done" ? result.output : undefined,
      { allowNeedsOwner: true, defaultParentId: "project" },
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
    let eventFilter: Record<string, unknown> | undefined;
    const result = await execute({
      task: `app: /app/projects/scout-knowledge-lib.app
project: /app/projects/scout-knowledge-lib

## Trigger Event
\`\`\`json
{"project":"scout-knowledge-lib","reason":"experience-review"}
\`\`\``,
      query: {
        events(filter: Record<string, unknown>) {
          eventFilter = filter;
          return { rows: [], rowCount: 0, limit: 200, truncated: false };
        },
      },
      async runAgent(_agent: string, value: string) {
        prompt = value;
        return {
          status: "done",
          sessionId: "s_review",
          structuredResult: {
            state: "converged",
            summary: "No improvement justified.",
            evidence: ["experience window contained no reconciliations"],
            actions: [],
          },
        };
      },
      emit() {},
      done(summary: string, output?: unknown) {
        return { type: "done", summary, output } as const;
      },
      blocked(reason: string, context?: unknown) {
        return { type: "blocked", reason, context } as const;
      },
    } as never);

    expect(eventFilter).toMatchObject({
      type: "project.task.reconciled",
      projectId: "scout-knowledge-lib",
      limit: 200,
    });
    expect(prompt).toContain("Periodic experience evidence");
    expect(prompt).toContain("untrusted historical evidence");
    expect(prompt).toContain('"groups": []');
    expect(result).toMatchObject({
      type: "done",
      output: { state: "converged", actions: [] },
    });
  });
});
