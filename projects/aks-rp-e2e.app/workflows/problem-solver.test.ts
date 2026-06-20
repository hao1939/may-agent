import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
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

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

describe("problem solver", () => {
  test("emits resolved problem result for explicit solver success", async () => {
    const { appDir, projectDir } = await makeWorkspace();
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
        triggerEvent({
          type: "project.problem.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
          affectedTasks: ["feature-a-live-execute"],
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
          message:
            "ROOT_CAUSE: runner auth env missing\nACTION_TAKEN: configured auth preflight\nVERIFICATION: preflight passed\nPLANNER_NEXT: retry affected tasks\nPROBLEM_RESULT: resolved",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Problem Solver Mode");
    expect(prompts[0]).toContain("Do not reshape tasks/tree.json");
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

    const problemRuns = await readFile(
      join(appDir, ".state", "problem-runs.jsonl"),
      "utf8",
    );
    expect(problemRuns).toContain('"result_event":"project.problem.resolved"');
  });

  test("emits escalated problem result without explicit resolved marker", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.problem.requested",
          project: "aks-rp-e2e",
          problem_key: "aks-rp-e2e:azure-quota",
          affected_tasks: ["quota-blocked-task"],
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
        message:
          "ROOT_CAUSE: subscription quota exhausted\nACTION_TAKEN: verified quota\nVERIFICATION: quota check failed\nPLANNER_NEXT: wait for human quota increase\nPROBLEM_RESULT: escalated",
      }),
      summarize: () => "",
    } as any);

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

  test("treats clear fixed-and-verified solver summary as resolved even without marker", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.problem.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
          affectedTasks: ["staging-replay-task"],
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
        message:
          "Fixed ARM auth blocker for staging execution tasks. Root cause: az was installed outside PATH. Added resolveAzPath fallback. Verification: checkAuth passed and armRequest returned HTTP 200.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.resolved",
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

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.problem.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:task-problem:test-empty-text",
          affectedTasks: ["triage-task"],
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "error" }),
      runAgentSession: async () => ({
        sessionId: "s_problem_test_empty",
        status: "error",
        lastAssistantText: "",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.problem.unknown",
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

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.problem.requested",
          project: "aks-rp-e2e",
          problemKey: "aks-rp-e2e:task-problem:test",
          affectedTasks: ["triage-task"],
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
      }),
      summarize: () => "",
    } as any);

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
