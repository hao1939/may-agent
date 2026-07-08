import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./project-stall-review.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-stall-review-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  return { appDir, projectDir };
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

async function writeTree(appDir: string) {
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        tasks: {
          project: {
            id: "project",
            parent_id: null,
            state: "backlog",
            status: "backlog",
            children: ["aks-spec-verification-loop"],
            goal: "Project root.",
            inputs: [],
            outputs: ["tasks/tree.json"],
            acceptance: ["Done."],
            forbidden: [],
          },
          "aks-spec-verification-loop": {
            id: "aks-spec-verification-loop",
            parent_id: "project",
            state: "done",
            status: "done",
            workflow: "spec-loop-controller",
            children: [],
            goal: "Verify every spec.",
            inputs: ["specs/index.json"],
            outputs: [".state/spec-loop/state.json"],
            acceptance: ["Every spec is pass or exactly escalated."],
            forbidden: [],
            context: {
              workflowProgress: {
                completionReady: false,
                reason: "spec-loop still has non-pass results",
                error: 1,
              },
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function writeSpecLoopState(appDir: string) {
  await writeFile(
    join(appDir, ".state", "spec-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 5,
        cursor: 0,
        prioritySpecIds: [],
        specs: {
          "spec.virtualmachines.example": {
            status: "error",
            taskId: "verify-spec-virtualmachines-example",
            attempts: 3,
            lastRunId: "run-1",
            lastResultPath: "runs/test-results/run-1.json",
            lastPrUrl: null,
            updatedAt: new Date().toISOString(),
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

describe("project stall review", () => {
  test("collects loop state, repairs false-terminal controller root, asks agent to judge, and emits reviewed fact", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    await writeSpecLoopState(appDir);

    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxLoopPulses: 1",
        triggerEvent({
          type: "project.stall.review.requested",
          project: "aks-rp-e2e",
          reason: "watchdog-durable-loop-stall",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return {
          status: "success",
          stallReview: {
            judgment: "needs-work",
            rootCause: "false-terminal loop root with error state",
            nextProjectMove: "planner should assign grouped repair work",
            whyNotMoving:
              "loop root was done while workflowProgress was incomplete",
            evidence: ["spec-loop state has one error"],
          },
          message: "Structured stall review produced a needs-work judgment.",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "project.stall.reviewed (needs-work, fallback)",
    );
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("App-Ops Deep-Dive Fallback");
    expect(prompts[0]).toContain("Workflow code collected the packet");
    expect(prompts[0]).toContain("spec.virtualmachines.example");
    expect(prompts[0]).toContain("Review mode: fallback");
    expect(prompts[0]).toContain('"stallReview"');

    expect(dispatched.map((event) => event.type)).toEqual([
      "project.task.tick",
      "project.stall.reviewed",
    ]);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.tick",
      payload: {
        target: {
          project: "aks-rp-e2e",
          taskId: "aks-spec-verification-loop",
        },
        action: "spec-loop",
        requested_by: "project-stall-review",
      },
    });
    const reviewed = dispatched.find(
      (event) => event.type === "project.stall.reviewed",
    );
    expect(reviewed).toBeDefined();
    expect(reviewed?.payload.target).toEqual({ project: "aks-rp-e2e" });
    expect(reviewed?.payload.project).toBe("aks-rp-e2e");
    expect(reviewed?.payload.reason).toBe("watchdog-durable-loop-stall");
    expect(reviewed?.payload.mode).toBe("fallback");
    expect(reviewed?.payload.judgment).toBe("needs-work");
    expect(reviewed?.payload.stallReview).toMatchObject({
      judgment: "needs-work",
      rootCause: "false-terminal loop root with error state",
      nextProjectMove: "planner should assign grouped repair work",
      whyNotMoving: "loop root was done while workflowProgress was incomplete",
      evidence: ["spec-loop state has one error"],
    });
    expect(reviewed?.payload.repaired).toBe(true);
    expect(reviewed?.payload.dispatchedTicks).toEqual([
      {
        taskId: "aks-spec-verification-loop",
        action: "spec-loop",
      },
    ]);
    const specLoopSummary = (
      reviewed?.payload.loopSummaries as Array<Record<string, unknown>>
    ).find((summary) => summary.taskId === "aks-spec-verification-loop");
    expect(specLoopSummary).toMatchObject({
      taskId: "aks-spec-verification-loop",
      nonTerminalCount: 1,
      statusCounts: { error: 1 },
    });

    const updatedTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(updatedTree.tasks["aks-spec-verification-loop"].state).toBe(
      "backlog",
    );

    const runs = await readFile(
      join(appDir, ".state", "stall-review-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"judgment":"needs-work"');
    expect(runs).toContain('"mode":"fallback"');
  });

  test("risk-review mode collects and asks agent without repairing or pulsing controllers", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    await writeSpecLoopState(appDir);

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxLoopPulses: 1",
        triggerEvent({
          type: "project.stall.review.requested",
          project: "aks-rp-e2e",
          reason: "manual-stall-risk-review",
          mode: "risk-review",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        stallReview: {
          judgment: "needs-work",
          rootCause: "diagnostic review only",
          nextProjectMove: "planner should decide",
          whyNotMoving: "false-terminal root observed",
          evidence: ["packet collected"],
        },
        message: "Structured risk review produced a needs-work judgment.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "project.stall.reviewed (needs-work, risk-review)",
    );
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.stall.reviewed",
    ]);
    expect(dispatched[0]).toMatchObject({
      type: "project.stall.reviewed",
      payload: {
        reason: "manual-stall-risk-review",
        mode: "risk-review",
        judgment: "needs-work",
        stallReview: {
          judgment: "needs-work",
          rootCause: "diagnostic review only",
        },
        repaired: false,
        repairResult: {
          skipped: true,
        },
        dispatchedTicks: [],
      },
    });

    const updatedTree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    expect(updatedTree.tasks["aks-spec-verification-loop"].state).toBe("done");
  });

  test("fallback mode preserves exact blocked wait stewardship without pulsing loop controllers", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          tasks: {
            project: {
              id: "project",
              parent_id: null,
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop"],
              goal: "Project root.",
              inputs: [],
              outputs: ["tasks/tree.json"],
              acceptance: ["Done."],
              forbidden: [],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "blocked",
              status: "blocked",
              workflow: "spec-loop-controller",
              children: [],
              goal: "Verify every spec.",
              inputs: ["specs/index.json"],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Every spec is pass or exactly escalated."],
              forbidden: [],
              blocker: "exact wait stewardship",
              context: {
                workflowProgress: {
                  completionReady: false,
                  noRefillNow: true,
                  reason:
                    "spec-loop execution residue is drained and the remaining frontier is exact wait stewardship",
                  pending: 123,
                  error: 203,
                  openChildren: 0,
                  activeChildren: 0,
                  reviewChildren: 0,
                  waitingChildren: 0,
                  backlogChildren: 0,
                  openSpecVerifierChildren: 0,
                  openFollowups: 0,
                  blockedWaitChildren: 5,
                  unrepresentedNonTerminalCount: 0,
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeSpecLoopState(appDir);

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxLoopPulses: 1",
        triggerEvent({
          type: "project.stall.review.requested",
          project: "aks-rp-e2e",
          reason: "watchdog-durable-loop-stall",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        stallReview: {
          judgment: "exact-external-wait",
          rootCause: "durable blocked wait stewardship",
          nextProjectMove:
            "preserve exact wait until one named blocker resolves",
          whyNotMoving:
            "frontier is blocked-only while residue remains in loop state",
          evidence: [
            "spec-loop residue is preserved but frontier children are all blocked waits",
          ],
        },
        message:
          "Structured stall review produced an exact-external-wait judgment.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "project.stall.reviewed (exact-external-wait, fallback)",
    );
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.stall.reviewed",
    ]);
    const reviewed = dispatched[0];
    expect(reviewed).toMatchObject({
      type: "project.stall.reviewed",
      payload: {
        reason: "watchdog-durable-loop-stall",
        mode: "fallback",
        judgment: "exact-external-wait",
        dispatchedTicks: [],
      },
    });
    const specLoopSummary = (
      reviewed.payload.loopSummaries as Array<Record<string, unknown>>
    ).find((summary) => summary.taskId === "aks-spec-verification-loop");
    expect(specLoopSummary).toMatchObject({
      taskId: "aks-spec-verification-loop",
      nonTerminalCount: 1,
      unrepresentedNonTerminalCount: 0,
      exactBlockedWaitStewardship: true,
      needsAttention: false,
    });
  });

  test("classifies judgment from nested structured result when runtime summary omits marker", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    await writeSpecLoopState(appDir);

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.stall.review.requested",
          project: "aks-rp-e2e",
          reason: "manual-stall-risk-review",
          mode: "risk-review",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "done",
        message:
          "Diagnosed the stall and recommended a concrete next project move.",
        finishResult: {
          stallReview: {
            judgment: "needs-work",
            rootCause: "retry-drained loop family",
            nextProjectMove: "planner should create grouped repair work",
            whyNotMoving: "loop state has nonterminal records",
            evidence: ["packet collected"],
          },
        },
      }),
      summarize: () => "",
    } as any);

    const reviewed = dispatched.find(
      (event) => event.type === "project.stall.reviewed",
    );
    expect(reviewed?.payload.judgment).toBe("needs-work");
    expect(reviewed?.payload.stallReview).toMatchObject({
      judgment: "needs-work",
      rootCause: "retry-drained loop family",
      nextProjectMove: "planner should create grouped repair work",
    });
    expect(reviewed?.payload.summary).toContain(
      "Diagnosed the stall and recommended",
    );
  });

  test("does not classify judgment from raw marker prose", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    await writeSpecLoopState(appDir);

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.stall.review.requested",
          project: "aks-rp-e2e",
          reason: "manual-stall-risk-review",
          mode: "risk-review",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "done",
        message:
          "ROOT_CAUSE: prose only\nNEXT_PROJECT_MOVE: do something\nSTALL_REVIEW_RESULT: needs-work",
      }),
      summarize: () => "",
    } as any);

    const reviewed = dispatched.find(
      (event) => event.type === "project.stall.reviewed",
    );
    expect(reviewed?.payload.judgment).toBe("needs-work");
    expect(reviewed?.payload.stallReview).toMatchObject({
      judgment: "needs-work",
      rootCause: "durable loop ledger has unrepresented non-terminal records",
    });
  });
});
