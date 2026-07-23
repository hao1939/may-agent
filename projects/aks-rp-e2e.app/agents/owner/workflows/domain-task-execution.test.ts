import { describe, expect, it } from "bun:test";
import type { WorkflowContext } from "@may-agent/sdk";
import { execute } from "./domain-task-execution.js";

function context(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    task: "bounded task",
    agent: "aks-explorer",
    projectDir: "/repo",
    workspaceDir: "/worktrees/task-1",
    runAgent: (async () => ({
      status: "done",
      sessionId: "session-1",
      lastAssistantText: "done",
      messages: [],
      duration: "1s",
      outputDir: "/tmp",
      finishResult: { status: "success", summary: "done" },
      structuredResult: {
        state: "converged",
        summary: "done",
        evidence: ["commit:abc"],
        actions: [],
      },
    })) as WorkflowContext["runAgent"],
    done: (summary, output) => ({ type: "done", summary, output }),
    blocked: (reason, details) => ({
      type: "blocked",
      reason,
      context: details,
    }),
    ...overrides,
  } as WorkflowContext;
}

describe("domain task execution", () => {
  it("requires infrastructure to supply an isolated task worktree", async () => {
    const result = await execute(context({ workspaceDir: "/repo" }));
    expect(result).toMatchObject({
      type: "blocked",
      reason: expect.stringContaining("prepared task worktree"),
    });
  });

  it("runs the owner capability in the supplied worktree and returns its typed result", async () => {
    let prompt = "";
    const result = await execute(
      context({
        runAgent: (async (_agent: string, task: string) => {
          prompt = task;
          return {
            status: "done",
            sessionId: "session-1",
            lastAssistantText: "done",
            messages: [],
            duration: "1s",
            outputDir: "/tmp",
            finishResult: { status: "success", summary: "done" },
            structuredResult: {
              state: "converged",
              summary: "done",
              evidence: ["commit:abc"],
              actions: [],
            },
          };
        }) as WorkflowContext["runAgent"],
      }),
    );

    expect(prompt).toContain("/worktrees/task-1");
    expect(prompt).toContain("Do not create another branch or worktree");
    expect(prompt).toContain("subject project:aks-rp-e2e");
    expect(prompt).toContain('specId: "<spec id>"');
    expect(result).toMatchObject({
      type: "done",
      output: { state: "converged", summary: "done" },
    });
  });
});
