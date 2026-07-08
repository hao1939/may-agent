import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assignTask,
  taskTreeConfig,
  type TaskAssignment,
} from "./lib/task-tree-tools.ts";
import {
  completeStartedAttempt,
  markAttemptStartedOnce,
} from "./default-task-worker.ts";
import { execute } from "./task-worker.ts";

async function makeProject() {
  const dir = await mkdtemp(join(tmpdir(), "aks-task-worker-"));
  await mkdir(join(dir, ".state"), { recursive: true });
  await mkdir(join(dir, "tasks"), { recursive: true });
  await writeFile(join(dir, ".state", "journal.jsonl"), "", "utf8");
  return dir;
}

function eventBlock(event: Record<string, unknown>): string {
  return `## Trigger Event
\`\`\`json
${JSON.stringify(event)}
\`\`\``;
}

function config(projectDir: string) {
  return taskTreeConfig({
    appDir: projectDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent: 1,
  });
}

function assignedEvent(assignment: TaskAssignment): Record<string, unknown> {
  return {
    type: "project.task.assigned",
    project: "aks-rp-e2e",
    ...assignment,
  };
}

describe("task worker", () => {
  test("persists a stable session id for spec-runner leaves", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    let observedSessionId = "";
    let observedPrompt = "";
    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (
        _agent: string,
        prompt: string,
        sessionId: string,
      ) => {
        observedSessionId = sessionId;
        observedPrompt = prompt;
        return {
          status: "success",
          finishResult: { status: "success" },
          message: "completed",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedSessionId).toBe("s_task_spec-task");
    expect(observedPrompt).toContain("task-tree set-outputs");
    expect(observedPrompt).toContain(
      "Never edit the runtime task tree file directly",
    );
    expect(observedPrompt).toContain("Source workspace: /app/sources/aks-rp");
    expect(observedPrompt).toContain("context, not ground truth");
    expect(observedPrompt).toContain("commit it, push it to the target");
    expect(observedPrompt).toContain(
      "then verify it with the Azure DevOps pipeline",
    );
    expect(observedPrompt).toContain("App-only notes, memos");
    expect(observedPrompt).toContain("do not fix those");
    expect(observedPrompt).toContain(
      "domain result review with explicit inputs",
    );
    expect(observedPrompt).toContain("Do not touch the task tree");
    expect(observedPrompt).toContain("do not edit app loop state");
    expect(observedPrompt).toContain(
      "The app-side planner/controller consumes that result",
    );

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].session_id).toBe("s_task_spec-task");
    expect(updated.tasks["spec-task"].session_history).toContain(
      "s_task_spec-task",
    );
    expect(updated.tasks["spec-task"].state).toBe("review");
    expect(updated.tasks["spec-task"].status).toBeUndefined();
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        status: "review",
        attemptId: assignment.attemptId,
        result: "done",
      },
    });
  });

  test("carries structured fix-forward result into completion details", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["fix-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "fix-task": {
              id: "fix-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Fix one failed spec.",
              inputs: ["spec:one"],
              outputs: ["runs/test-results/"],
              acceptance: ["Fix-forward result is structured"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
              context: {
                workflow: "fix-forward",
                subjectKind: "spec-family",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "fix-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, any>;
    }> = [];
    let observedPrompt = "";
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        observedPrompt = prompt;
        return {
          status: "success",
          finishResult: {
            status: "success",
            deliverables: [{ path: "evidence/fix.md" }],
          },
          message: `Fixed.

FIX_FORWARD_RESULT:
\`\`\`json
{
  "workflow": "fix-forward",
  "subject": { "kind": "spec", "id": "spec.one" },
  "classification": "request-shape-invalid",
  "diagnosis": "Request shape was missing a required field.",
  "minimumDiagnosisPacket": {
    "target": "staging",
    "branch": "dev",
    "runId": "171",
    "resultPath": "runs/test-results/spec.one/result.json",
    "failingPhase": "execute",
    "failingAssertion": "create succeeds",
    "requestOrResponseExcerpt": "HTTP 400 missing field",
    "referencesChecked": ["azure-rest-api-specs"],
    "inputFingerprint": "input-a",
    "errorFingerprint": "error-a"
  },
  "changedFiles": ["features/example/specs/spec.one.json"],
  "verification": {
    "runId": "172",
    "resultPath": "runs/test-results/spec.one/result.json",
    "status": "pass"
  },
  "nextAction": "done",
  "nextActionReason": "The changed spec passed live verification."
}
\`\`\``,
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedPrompt).toContain("FIX_FORWARD_RESULT");
    expect(observedPrompt).toContain("minimumDiagnosisPacket");
    expect(dispatched).toHaveLength(1);
    expect(
      dispatched[0].payload.workflowResult.details.fixForward,
    ).toMatchObject({
      workflow: "fix-forward",
      classification: "request-shape-invalid",
      nextAction: "done",
    });
    expect(
      dispatched[0].payload.workflowResult.details
        .fixForwardStructuredResultPresent,
    ).toBe(true);
  });

  test("completion helpers accept legacy state-only active tasks", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "state-only-task",
          active_task_ids: ["state-only-task"],
          tasks: {
            project: {
              id: "project",
              state: "active",
              children: ["state-only-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "state-only-task": {
              id: "state-only-task",
              parent_id: "project",
              state: "active",
              kind: "domain_leaf",
              workflow: "feature-reference-collector",
              priority: "P1",
              children: [],
              goal: "Run one state-only task.",
              inputs: [],
              outputs: ["evidence/archive/state-only.md"],
              acceptance: ["done"],
              forbidden: [],
              conflict_scope: ["state-only"],
              depends_on: [],
              trace: {
                current_attempt_id: "attempt-state-only",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const started = markAttemptStartedOnce(config(projectDir), {
      taskId: "state-only-task",
      attemptId: "attempt-state-only",
    });
    expect(started.ok).toBe(true);

    const completed = completeStartedAttempt(config(projectDir), {
      taskId: "state-only-task",
      attemptId: "attempt-state-only",
      claim: "done",
      summary: "state-only task completed",
    });
    expect(completed.ok).toBe(true);

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["state-only-task"].state).toBe("review");
    expect(updated.tasks["state-only-task"].trace.last_worker_result).toBe(
      "done",
    );
  });

  test("ignores obsolete completion when owner already removed assigned task", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        const treePath = resolveTaskTreePath(projectDir);
        const tree = JSON.parse(await readFile(treePath, "utf8"));
        delete tree.tasks["spec-task"];
        tree.tasks.project.children = [];
        tree.active_task_id = null;
        tree.active_task_ids = [];
        tree.updated_at = new Date().toISOString();
        await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
        return {
          status: "success",
          finishResult: { status: "success" },
          message: "completed",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("ignored obsolete completion");
    expect(dispatched).toHaveLength(0);
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"]).toBeUndefined();
    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain("task_worker_completion_ignored");
  });

  test("keeps late stale-active completion reviewable when previous attempt finishes after retry", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "review",
              status: "review",
              kind: "domain_leaf",
              children: [],
              goal: "Repair one spec.",
              outputs: ["evidence/archive/"],
              acceptance: ["done"],
              result: "Retry attempt only queued the rerun.",
              evidence: ["evidence/archive/retry.md"],
              trace: {
                current_attempt_id: "attempt-retry",
                previous_attempt_id: "attempt-original",
                stale_active_fresh_session: true,
                last_worker_claim: "partial",
                last_worker_result: "partial",
                last_worker_summary: "Retry attempt only queued the rerun.",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const completed = completeStartedAttempt(config(projectDir), {
      taskId: "spec-task",
      attemptId: "attempt-original",
      claim: "done",
      summary: "Original attempt finished with the reviewed live result.",
      evidence: ["evidence/archive/final.md"],
    });

    expect(completed.ok).toBe(true);
    expect(completed.ok && completed.late).toBe(true);
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].state).toBe("review");
    expect(updated.tasks["spec-task"].result).toBe(
      "Original attempt finished with the reviewed live result.",
    );
    expect(updated.tasks["spec-task"].evidence).toEqual([
      "evidence/archive/final.md",
    ]);
    expect(updated.tasks["spec-task"].trace.last_worker_claim).toBe("done");
    expect(
      updated.tasks["spec-task"].trace.late_worker_completions[0].attempt_id,
    ).toBe("attempt-original");

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain("task_worker_late_completion_recorded");
    expect(journal).not.toContain("task_worker_completion_ignored");
  });

  test("keeps blocked worker results reviewable for the owner", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        status: "error",
        message: "ARM auth appears hung but no terminal artifact exists",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].state).toBe("review");
    expect(updated.tasks["spec-task"].status).toBeUndefined();
    expect(updated.tasks["spec-task"].blocker).toBeUndefined();
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("blocked");
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        status: "review",
        attemptId: assignment.attemptId,
        result: "blocked",
      },
    });
  });

  test("does not treat generic session success as task done", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        message: "I inspected the task but did not record a terminal result.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].state).toBe("review");
    expect(updated.tasks["spec-task"].status).toBeUndefined();
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("partial");
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        status: "review",
        attemptId: assignment.attemptId,
        result: "partial",
      },
    });
  });

  test("prefers status when assistant text is present but empty", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        sessionId: "s_task_spec-task",
        status: "error",
        lastAssistantText: "",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("blocked");
    expect(updated.tasks["spec-task"].trace.last_worker_summary).toBe("error");
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        result: "blocked",
        summary: "error",
      },
    });
  });

  test("uses finish summary when message and assistant text are absent", async () => {
    const projectDir = await makeProject();
    await writeFile(
      join(projectDir, "project.json"),
      `${JSON.stringify(
        {
          id: "test-project",
          owner: "aks-explorer",
          status: "active",
          currentState: {
            summary: "stale summary",
            activeTaskId: "old-active",
            metrics: {
              activeLeafCount: 9,
              blockedLeafCount: 0,
              reviewLeafCount: 7,
              waitingLeafCount: 6,
              runnableLeafCount: 5,
            },
          },
          currentFocus: {
            summary: "stale focus",
            activeTaskIds: ["old-active"],
            proposedTaskIds: ["old-active"],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "done" }),
      runAgentSession: async () => ({
        sessionId: "s_task_spec-task",
        status: "done",
        lastAssistantText: null,
        messages: [],
        duration: "1s",
        outputDir: "/tmp/spec-task",
        finishResult: {
          status: "success",
          summary:
            "Created evidence/archive/example.md and validated the spec successfully.",
          deliverables: [
            {
              path: "evidence/archive/example.md",
              description: "Example artifact created by the worker.",
            },
          ],
        },
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("done");
    expect(updated.tasks["spec-task"].trace.last_worker_summary).toContain(
      "Created evidence/archive/example.md",
    );
    expect(updated.tasks["spec-task"].trace.last_worker_evidence).toEqual([
      "evidence/archive/example.md",
    ]);
    const projectState = JSON.parse(
      await readFile(projectRuntimePaths(projectDir).projectStatePath, "utf8"),
    );
    expect(projectState.currentState.activeTaskId).toBeNull();
    expect(projectState.currentState.metrics.activeLeafCount).toBe(0);
    expect(projectState.currentState.metrics.reviewLeafCount).toBe(1);
    expect(projectState.currentState.metrics.blockedLeafCount).toBe(0);
    expect(projectState.currentFocus.activeTaskIds).toEqual(["spec-task"]);
    expect(projectState.currentFocus.proposedTaskIds).toEqual(["spec-task"]);
    expect(String(projectState.currentFocus.summary)).toContain(
      "non-done task-tree leaves first",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        result: "done",
        summary:
          "Created evidence/archive/example.md and validated the spec successfully.",
        evidence: ["evidence/archive/example.md"],
      },
    });
  });

  test("prefers runtime errorMessage when assistant turn is empty", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        sessionId: "s_task_spec-task",
        status: "error",
        lastAssistantText: null,
        errorMessage:
          "OpenAI API error (429): 429 No deployments available for selected model, Try again in 5 seconds.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("blocked");
    expect(updated.tasks["spec-task"].trace.last_worker_summary).toBe(
      "OpenAI API error (429): 429 No deployments available for selected model, Try again in 5 seconds.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        result: "blocked",
        summary:
          "OpenAI API error (429): 429 No deployments available for selected model, Try again in 5 seconds.",
      },
    });
  });

  test("prefers provider errorMessage over finish summary when session startup fails before work", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        sessionId: "s_task_spec-task",
        status: "error",
        lastAssistantText: null,
        errorMessage:
          "OpenAI API error (401): 401 litellm.AuthenticationError: token expired",
        finishResult: {
          status: "blocked",
          summary: "Agent ended with an empty assistant turn",
        },
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("blocked");
    expect(updated.tasks["spec-task"].trace.last_worker_summary).toBe(
      "OpenAI API error (401): 401 litellm.AuthenticationError: token expired",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        result: "blocked",
        summary:
          "OpenAI API error (401): 401 litellm.AuthenticationError: token expired",
      },
    });
  });

  test("uses explicit runtime-error summary when session ends error with no assistant output or provider error", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              workflow: "spec-runner",
              priority: "P1",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), { taskId: "spec-task" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
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
        sessionId: "s_task_spec-task",
        status: "error",
        lastAssistantText: null,
        finishResult: {
          status: "blocked",
          summary: "Agent ended with an empty assistant turn",
        },
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("blocked");
    expect(updated.tasks["spec-task"].trace.last_worker_summary).toBe(
      "Worker runtime error: session ended with status=error before any usable assistant output or structured finish summary.",
    );
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        result: "blocked",
        summary:
          "Worker runtime error: session ended with status=error before any usable assistant output or structured finish summary.",
      },
    });
  });

  test("ignores duplicate assignment events for the same started attempt", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "spec-task",
          active_task_ids: ["spec-task"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["spec-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "spec-task": {
              id: "spec-task",
              parent_id: "project",
              state: "active",
              status: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "aks-explorer",
              children: [],
              goal: "Run one spec.",
              inputs: [],
              outputs: ["runs/executions/"],
              acceptance: ["Spec-runner produces terminal result"],
              forbidden: [],
              conflict_scope: ["spec:one"],
              depends_on: [],
              session_id: "s_task_spec-task",
              session_history: ["s_task_spec-task"],
              trace: {
                current_attempt_id: "a_spec-task_20260618000000",
                worker_started_attempt_id: "a_spec-task_20260618000000",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    let calls = 0;
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          taskId: "spec-task",
          task_id: "spec-task",
          attemptId: "a_spec-task_20260618000000",
          attempt_id: "a_spec-task_20260618000000",
          sessionId: "s_task_spec-task",
          session_id: "s_task_spec-task",
          worker: "aks-explorer",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => {
        calls++;
        return {
          status: "success",
          finishResult: { status: "success" },
          message: "completed",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("already running or already started");
    expect(calls).toBe(0);
  });

  test("routes tasks with app workflow to that workflow", async () => {
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(projectDir),
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
              state: "backlog",
              children: ["controller-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "controller-task": {
              id: "controller-task",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: [],
              goal: "Pulse controller.",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["Controller pulse completed"],
              forbidden: [],
              conflict_scope: ["controller"],
              depends_on: [],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const assignment = assignTask(config(projectDir), {
      taskId: "controller-task",
    });
    let routedWorkflow = "";
    let routedTask = "";
    let agentCalls = 0;
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => {
        agentCalls++;
        return { status: "success" };
      },
      runWorkflow: async (workflow: string, task: string) => {
        routedWorkflow = workflow;
        routedTask = task;
        return { status: "done", message: "controller pulse ok" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(routedWorkflow).toBe("spec-loop-controller");
    expect(routedTask).toContain("## Task Workflow Route");
    expect(routedTask).toContain("workflow: spec-loop-controller");
    expect(agentCalls).toBe(0);
  });
});
