import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute as executePlanner } from "./project-planner.ts";
import { execute } from "./task-reviewer.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-task-reviewer-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  return { appDir, projectDir };
}

async function writeTree(
  appDir: string,
  input: { state?: string; attemptId?: string } = {},
) {
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        active_task_id: null,
        active_task_ids: [],
        tasks: {
          project: {
            id: "project",
            state: "active",
            children: ["review-task"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "review-task": {
            id: "review-task",
            parent_id: "project",
            state: input.state ?? "review",
            kind: "domain_leaf",
            workflow: "single-spec-verifier",
            priority: "P1",
            children: [],
            goal: "Verify one spec on GitHub.",
            inputs: [],
            outputs: ["runs/test-results/"],
            acceptance: ["GitHub live test passes"],
            forbidden: [],
            conflict_scope: ["spec:one"],
            depends_on: [],
            trace: {
              current_attempt_id: input.attemptId ?? "attempt-1",
              last_worker_result: "done",
              last_worker_summary: "GitHub live workflow passed.",
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

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event
\`\`\`json
${JSON.stringify(event)}
\`\`\``;
}

function completionEvent(
  input: {
    taskId?: string;
    attemptId?: string;
    result?: string;
    summary?: string;
    evidenceRefs?: string[];
  } = {},
): Record<string, unknown> {
  const taskId = input.taskId ?? "review-task";
  const attemptId = input.attemptId ?? "attempt-1";
  const result = input.result ?? "done";
  const summary = input.summary ?? "GitHub live workflow passed.";
  const evidenceRefs = input.evidenceRefs ?? ["runs/test-results/test-1"];
  return {
    type: "project.task.completed",
    target: { project: "aks-rp-e2e", taskId },
    project: "aks-rp-e2e",
    taskId,
    attemptId,
    result,
    summary,
    completion: {
      taskId,
      attemptId,
      result,
      summary,
      evidenceRefs,
    },
  };
}

describe("task reviewer", () => {
  test("emits structured reviewed event for a current review task", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const prompts: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
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
          message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "accept",
  "confidence": "high",
  "summary": "Live GitHub proof satisfies the task.",
  "findings": ["artifact includes passing live run"],
  "feedback": [],
  "suggestedFollowups": []
}
\`\`\``,
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Task Review Mode");
    expect(prompts[0]).toContain("Do not mutate the task tree");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        attemptId: "attempt-1",
        decision: "accept",
        confidence: "high",
        summary: "Live GitHub proof satisfies the task.",
        findings: ["artifact includes passing live run"],
      },
    });

    const runs = await readFile(
      join(appDir, ".state", "task-reviewer-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"result":"project.task.reviewed"');
  });

  test("emitted reviewed event is directly consumable by the planner", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message: `TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "accept",
  "confidence": "high",
  "summary": "Live GitHub proof satisfies the task.",
  "findings": ["artifact includes passing live run"],
  "feedback": [],
  "suggestedFollowups": []
}
\`\`\``,
      }),
      summarize: () => "",
    } as any);

    const prompts: string[] = [];
    const plannerResult = await executePlanner({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        triggerEvent({
          type: dispatched[0].type,
          data: dispatched[0].payload,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return { status: "success", message: "owner should not run" };
      },
      runAgentSession: async (_agent: string, prompt: string) => {
        prompts.push(prompt);
        return { status: "success", message: "owner should not run" };
      },
      summarize: () => "",
    } as any);

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    ) as { tasks: Record<string, any> };
    expect(plannerResult.status).toBe("done");
    expect(plannerResult.message).toContain(
      "Applied accept review for review-task",
    );
    expect(tree.tasks["review-task"].state).toBe("done");
    expect(prompts).toHaveLength(0);
  });

  test("ignores stale completion when task is no longer in review", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir, { state: "done" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("not review");
    expect(dispatched).toEqual([]);
  });

  test("emits redo without reviewer session for empty worker completion", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(
          completionEvent({
            result: "blocked",
            summary: "Agent ended with an empty assistant turn",
            evidenceRefs: [],
          }),
        ),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        throw new Error("reviewer session should not run");
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "redo",
        confidence: "high",
        findings: ["worker-empty-assistant-turn", "worker-no-evidence"],
      },
    });
  });

  test("falls back to escalate review when reviewer output is malformed", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    await writeTree(appDir);
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-reviewer",
        triggerEvent(completionEvent()),
      ].join("\n"),
      agent: "aks-reviewer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message: "looks fine but missing structured JSON",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.reviewed",
      payload: {
        taskId: "review-task",
        decision: "escalate",
        confidence: "low",
        findings: ["reviewer-output-not-structured"],
      },
    });
  });
});
