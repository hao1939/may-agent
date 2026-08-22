import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./problem-solver.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-problem-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  return { appDir, projectDir };
}

function context(input: {
  appDir: string;
  projectDir: string;
  trigger: Record<string, unknown>;
  taskInput?: Record<string, unknown>;
  agentResult?: unknown;
  prompts?: string[];
  dispatched?: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
}) {
  const { type, target, data, ...legacyData } = input.trigger;
  const taskInput = input.taskInput ?? {};
  return {
    input: taskInput,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "runtime/problem-solver/test",
      generation: 1,
      resourceVersion: 1,
      owner: "aks-explorer",
      mode: "achieve",
      outcome: "Investigate the project problem",
      acceptance: ["The problem is resolved or explicitly escalated."],
      input: taskInput,
      children: { live: [], completed: [] },
      events: {
        items: [
          {
            observedAt: "2026-08-21T00:00:00.000Z",
            event: {
              type,
              target,
              data: {
                ...legacyData,
                ...(data && typeof data === "object" ? data : {}),
              },
            },
          },
        ],
        truncated: false,
      },
    },
    workspace: {
      appRoot: input.appDir,
      projectRoot: input.projectDir,
      root: input.projectDir,
      output: input.projectDir,
    },
    agents: {
      async call(_agent: string, prompt: string) {
        input.prompts?.push(prompt);
        return (
          input.agentResult ?? {
            id: "agent:test",
            kind: "agent",
            status: "done",
            summary: "done",
          }
        );
      },
    },
    events: {
      async emit(event: { type: string; data: Record<string, unknown> }) {
        input.dispatched?.push({ type: event.type, payload: event.data });
      },
    },
    done(summary: string, output?: unknown) {
      return {
        id: "workflow:test",
        kind: "workflow",
        status: "done",
        summary,
        output,
      };
    },
  } as any;
}

describe("problem solver", () => {
  test("returns needs-owner without actions for unsupported triggers", async () => {
    const { appDir, projectDir } = await makeWorkspace();

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.task.tick",
          project: "aks-rp-e2e",
          taskId: "runtime/problem-solver/example",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result).toMatchObject({
      output: {
        state: "needs-owner",
        summary: expect.stringContaining(
          "Problem solver ignored trigger project.task.tick",
        ),
        evidence: ["problem-solver:invalid-trigger"],
      },
    });
    expect(
      (result as { output?: Record<string, unknown> }).output,
    ).not.toHaveProperty("actions");
  });

  test("emits resolved problem result for explicit solver success", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.problem.investigation.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
          affectedTasks: ["feature-a-live-execute"],
        },
        prompts,
        dispatched,
        agentResult: {
          status: "success",
          message:
            "ROOT_CAUSE: runner auth env missing\nACTION_TAKEN: configured auth preflight\nVERIFICATION: preflight passed\nPLANNER_NEXT: retry affected tasks\nPROBLEM_RESULT: resolved",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result).toMatchObject({
      output: {
        state: "converged",
        summary: expect.stringContaining("project.problem.resolved"),
        evidence: [
          "problem-solver:aks-rp-e2e:staging-arm-auth-unavailable:project.problem.resolved",
          "event:project.problem.resolved",
        ],
        actions: [],
      },
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Problem Solver Mode");
    expect(prompts[0]).toContain("Do not reshape the task tree");
    expect(prompts[0]).toContain("Source workspace: /app/sources/aks-rp");
    expect(prompts[0]).toContain("Do not escalate missing source");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.resolved",
      payload: {
        project: "aks-rp-e2e",
        problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
        affectedTasks: ["feature-a-live-execute"],
      },
    });
  });

  test("emits escalated problem result without explicit resolved marker", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.problem.investigation.requested",
          project: "aks-rp-e2e",
          problem_key: "aks-rp-e2e:azure-quota",
          affected_tasks: ["quota-blocked-task"],
        },
        dispatched,
        agentResult: {
          status: "success",
          message:
            "ROOT_CAUSE: subscription quota exhausted\nACTION_TAKEN: verified quota\nVERIFICATION: quota check failed\nPLANNER_NEXT: wait for human quota increase\nPROBLEM_RESULT: escalated",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.escalated",
      payload: {
        project: "aks-rp-e2e",
        problemKey: "aks-rp-e2e:azure-quota",
        affectedTasks: ["quota-blocked-task"],
      },
    });
  });

  test("recovers from reconciler task ticks using task input", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        taskInput: {
          problemKey: "localdns-producerless-project-state-condition-20260730",
          targetTaskId:
            "hold-compact-localdns-split-frontier-e8d7677892-20260730",
        },
        trigger: {
          type: "project.task.tick",
          project: "aks-rp-e2e",
          taskId:
            "runtime/problem-solver/localdns-producerless-project-state-condition-20260730",
          reason: "run-created-problem-investigation",
        },
        dispatched,
        agentResult: {
          status: "success",
          message:
            "ROOT_CAUSE: producerless project.state condition\nACTION_TAKEN: verified owner handoff path\nVERIFICATION: LocalDNS holder is pending on current evidence\nPLANNER_NEXT: let the owner-held LocalDNS carrier run\nPROBLEM_RESULT: resolved",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result).toMatchObject({
      output: {
        state: "converged",
        summary: expect.stringContaining(
          "project.problem.resolved for localdns-producerless-project-state-condition-20260730",
        ),
        actions: [],
      },
    });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.resolved",
      payload: {
        project: "aks-rp-e2e",
        problemKey: "localdns-producerless-project-state-condition-20260730",
        affectedTasks: [
          "hold-compact-localdns-split-frontier-e8d7677892-20260730",
        ],
      },
    });
  });

  test("reconciles an admitted problem from task input regardless of request wrapper", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        taskInput: {
          problemKey: "live-proof-aks-taxonomy",
          targetTaskId: "runtime/owner-review",
          requestedOutcome: "Return terminal routing proof.",
        },
        trigger: {
          type: "app.task.requested",
          taskId: "runtime/problem-solver/live-proof-aks-taxonomy",
          problemKey: "stale-wrapper-key",
          affectedTasks: ["stale-wrapper-task"],
        },
        dispatched,
        agentResult: {
          status: "success",
          message:
            "ROOT_CAUSE: admitted request wrapper\nACTION_TAKEN: inspected task input\nVERIFICATION: exact task identity retained\nPLANNER_NEXT: consume the result\nPROBLEM_RESULT: resolved",
        },
      }),
    );

    expect(result).toMatchObject({
      output: {
        state: "converged",
        evidence: [
          "problem-solver:live-proof-aks-taxonomy:project.problem.resolved",
          "event:project.problem.resolved",
        ],
      },
    });
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.resolved",
      payload: {
        problemKey: "live-proof-aks-taxonomy",
        affectedTasks: ["runtime/owner-review"],
      },
    });
  });

  test("does not infer resolved problem result from fixed-and-verified prose", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.problem.investigation.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
          affectedTasks: ["staging-replay-task"],
        },
        dispatched,
        agentResult: {
          status: "success",
          message:
            "Fixed ARM auth blocker for staging execution tasks. Root cause: az was installed outside PATH. Added resolveAzPath fallback. Verification: checkAuth passed and armRequest returned HTTP 200.",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.inconclusive",
      payload: {
        project: "aks-rp-e2e",
        problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
        affectedTasks: ["staging-replay-task"],
      },
    });
  });

  test("uses status when assistant text is present but empty", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.problem.investigation.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:task-problem:test-empty-text",
          affectedTasks: ["triage-task"],
        },
        dispatched,
        agentResult: {
          sessionId: "s_problem_test_empty",
          status: "error",
          lastAssistantText: "",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.inconclusive",
      payload: {
        project: "aks-rp-e2e",
        problemKey: "aks-rp-e2e:task-problem:test-empty-text",
        affectedTasks: ["triage-task"],
        summary: "error",
      },
    });
  });

  test("uses finish summary text to classify escalated result when message is absent", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.problem.investigation.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:task-problem:test",
          affectedTasks: ["triage-task"],
        },
        dispatched,
        agentResult: {
          sessionId: "s_problem_test",
          status: "done",
          lastAssistantText: null,
          messages: [],
          duration: "1s",
          outputDir: "/tmp/problem-test",
          finishResult: {
            status: "blocked",
            summary:
              "ROOT_CAUSE: external quota\nACTION_TAKEN: verified quota\nVERIFICATION: quota check failed\nPLANNER_NEXT: request quota increase\nPROBLEM_RESULT: escalated",
          },
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.escalated",
      payload: {
        project: "aks-rp-e2e",
        problemKey: "aks-rp-e2e:task-problem:test",
        affectedTasks: ["triage-task"],
      },
    });
  });
});
