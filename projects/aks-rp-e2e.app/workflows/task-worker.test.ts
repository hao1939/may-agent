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
import { buildTaskTreeConfig } from "./default-task-worker.ts";
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
  test("uses assigned worker from trigger event for task execution config", async () => {
    const projectDir = await makeProject();
    const trigger = {
      type: "project.task.assigned",
      project: "aks-rp-e2e",
      taskId: "ops-task",
      attemptId: "attempt-ops-1",
      worker: "app-ops",
    };

    const config = buildTaskTreeConfig(
      {
        task: [
          `app: ${projectDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "worker: aks-explorer",
          eventBlock(trigger),
        ].join("\n"),
        agent: "aks-explorer",
      } as any,
      projectDir,
      projectDir,
      1,
      trigger as any,
    );

    expect(config.worker).toBe("app-ops");
  });

  test("tells app-ops workers to write app audit outputs under the app dir", async () => {
    const appDir = await makeProject();
    const projectDir = await makeProject();
    await writeFile(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: "ops-task",
          active_task_ids: ["ops-task"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["ops-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops-task": {
              id: "ops-task",
              parent_id: "project",
              state: "active",
              status: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "app-ops",
              children: [],
              goal: "Write app audit evidence.",
              inputs: [],
              outputs: ["evidence/archive/ops/ops-task.md"],
              acceptance: ["done"],
              conflict_scope: ["ops:test"],
              depends_on: [],
              session_id: "s_task_ops-task",
              trace: {
                current_attempt_id: "attempt-ops-app-output",
                review_reject: {
                  summary: "The prior audit did not update its named artifact.",
                  findings: ["The evidence file still contains stale data."],
                  feedback: ["Update the evidence from current app state."],
                  artifacts: ["evidence/archive/ops/ops-task.md"],
                  verification: ["The evidence cites the current app state."],
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

    let observedPrompt = "";
    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "worker: aks-explorer",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          taskId: "ops-task",
          attemptId: "attempt-ops-app-output",
          worker: "app-ops",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, prompt: string) => {
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
    expect(observedPrompt).toContain(
      "App-ops task outputs and app audit evidence",
    );
    expect(observedPrompt).toContain(`rooted at ${appDir}`);
    expect(observedPrompt).toContain("evidence/archive/ops/ops-task.md");
    expect(observedPrompt).toContain("Previous review requiring correction");
    expect(observedPrompt).toContain(
      "The prior audit did not update its named artifact.",
    );
    expect(observedPrompt).toContain(
      "The evidence cites the current app state.",
    );
    expect(observedPrompt).toContain(
      "Do not emit project or runtime events through the CLI, HTTP API, SDK, or direct",
    );
    expect(observedPrompt).toContain(
      "independent reviewer judges it and the planner validates and emits it.",
    );
    expect(observedPrompt).toContain(
      "Completing that proposal is the normal worker/reviewer boundary",
    );
  });

  test("runs assigned task sessions under the event worker when it differs from the handler default", async () => {
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
          active_task_id: "ops-task",
          active_task_ids: ["ops-task"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["ops-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops-task": {
              id: "ops-task",
              parent_id: "project",
              state: "active",
              status: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "app-ops",
              children: [],
              goal: "Repair one app task.",
              inputs: [],
              outputs: ["evidence/archive/ops-task.md"],
              acceptance: ["done"],
              conflict_scope: ["ops:test"],
              depends_on: [],
              session_id: "s_task_ops-task",
              trace: {
                current_attempt_id: "attempt-ops-1",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    let observedAgent = "";
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "worker: aks-explorer",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          taskId: "ops-task",
          attemptId: "attempt-ops-1",
          worker: "app-ops",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (agent: string) => {
        observedAgent = agent;
        return {
          status: "success",
          finishResult: { status: "success" },
          message: "completed",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedAgent).toBe("app-ops");

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["ops-task"].trace.worker_started_attempt_id).toBe(
      "attempt-ops-1",
    );

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_worker_started"');
    expect(journal).toContain('"task_id":"ops-task"');
    expect(journal).toContain('"worker":"app-ops"');
  });

  test("ignores blank event worker and uses task owner for worker-start attribution", async () => {
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
          active_task_id: "ops-task",
          active_task_ids: ["ops-task"],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              children: ["ops-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops-task": {
              id: "ops-task",
              parent_id: "project",
              state: "active",
              status: "active",
              kind: "domain_leaf",
              priority: "P1",
              owner: "app-ops",
              children: [],
              goal: "Repair one app task.",
              inputs: [],
              outputs: ["evidence/archive/ops-task.md"],
              acceptance: ["done"],
              conflict_scope: ["ops:test"],
              depends_on: [],
              session_id: "s_task_ops-task",
              trace: {
                current_attempt_id: "attempt-ops-blank",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    let observedAgent = "";
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "worker: aks-explorer",
        eventBlock({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          taskId: "ops-task",
          attemptId: "attempt-ops-blank",
          worker: "",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (agent: string) => {
        observedAgent = agent;
        return {
          status: "success",
          finishResult: { status: "success" },
          message: "completed",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedAgent).toBe("app-ops");

    const journal = await readFile(
      join(projectDir, ".state", "journal.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"task_worker_started"');
    expect(journal).toContain('"task_id":"ops-task"');
    expect(journal).toContain('"worker":"app-ops"');
    expect(journal).not.toContain('"worker":""');
  });

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
    expect(observedSessionId).toBe(assignment.sessionId);
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
    expect(observedPrompt).not.toContain("App-ops state repair authority");

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["spec-task"].session_id).toBe(assignment.sessionId);
    expect(updated.tasks["spec-task"].session_history).toContain(
      assignment.sessionId,
    );
    expect(updated.tasks["spec-task"].state).toBe("review");
    expect(updated.tasks["spec-task"].status).toBeUndefined();
    expect(updated.tasks["spec-task"].trace.last_worker_result).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.task.completed",
      payload: {
        taskId: "spec-task",
        state: "review",
        attemptId: assignment.attemptId,
        result: "done",
      },
    });
  });

  test("explicit app-ops state repair tasks can use supported app state mechanisms", async () => {
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
              children: ["ops/repair-frontier-state"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops/repair-frontier-state": {
              id: "ops/repair-frontier-state",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              children: [],
              goal: "Restore one live task-tree holder and repair feature-compact loop state frontier pointers.",
              inputs: [],
              outputs: [
                "evidence/archive/ops-repair-frontier-state.md",
                ".state/feature-compact-loop/state.json",
              ],
              acceptance: [
                "The live task tree contains the restored exact holder.",
                "The app-owned loop state frontierTaskIds are refreshed.",
              ],
              forbidden: [],
              conflict_scope: ["ops:frontier-state"],
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
      taskId: "ops/repair-frontier-state",
      worker: "app-ops",
    });
    let observedPrompt = "";
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "worker: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, prompt: string) => {
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
    expect(observedPrompt).toContain("App-ops state repair authority");
    expect(observedPrompt).toContain("Use task-tree CLI commands");
    expect(observedPrompt).toContain(".state/tasks/tree.json directly");
    expect(observedPrompt).toContain("existing app store");
    expect(observedPrompt).toContain("app-local script");
  });

  test("does not grant app state repair authority from prose-only task text", async () => {
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
              children: ["ops/review-frontier-note"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "ops/review-frontier-note": {
              id: "ops/review-frontier-note",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P2",
              owner: "app-ops",
              children: [],
              goal: "Review prose saying task-tree repair and loop state refresh may be needed.",
              inputs: [],
              outputs: ["evidence/archive/ops-review-frontier-note.md"],
              acceptance: ["Write the review note."],
              forbidden: [],
              conflict_scope: ["ops:review"],
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
      taskId: "ops/review-frontier-note",
      worker: "app-ops",
    });
    let observedPrompt = "";
    const result = await execute({
      task: [
        `app: ${projectDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "worker: aks-explorer",
        "maxConcurrent: 1",
        eventBlock(assignedEvent(assignment)),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async (_agent: string, prompt: string) => {
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
    expect(observedPrompt).not.toContain("App-ops state repair authority");
    expect(observedPrompt).not.toContain("QUEUED_PIPELINE_RUN");
    expect(observedPrompt).not.toContain("SPEC_RESULT_REVIEW");
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
                subjectKind: "compact-feature-family",
                featureCompactFollowup: true,
                errorClass: "package-partial",
                inputFingerprints: ["input-a"],
                errorFingerprints: ["error-a"],
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
    expect(dispatched[0].payload.workflowResult.workflow).toBe("fix-forward");
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
    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(
      updated.tasks["fix-task"].trace.workflowResult.details.fixForward,
    ).toMatchObject({
      workflow: "fix-forward",
      classification: "request-shape-invalid",
      nextAction: "done",
    });
  });

  test("captures structured fix-forward result from nested session finish payload when runtime summary omits marker", async () => {
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
                subjectKind: "compact-feature-family",
                featureCompactFollowup: true,
                errorClass: "package-partial",
                inputFingerprints: ["input-a"],
                errorFingerprints: ["error-a"],
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
          message:
            "Reviewed the family and wrote durable evidence at evidence/fix.md.",
          finishResult: {
            status: "success",
            summary:
              "Reviewed the family and wrote durable evidence at evidence/fix.md.",
            deliverables: [{ path: "evidence/fix.md" }],
            verification_evidence: [
              'FIX_FORWARD_RESULT:\n```json\n{\n  "workflow": "fix-forward",\n  "subject": { "kind": "feature-family", "id": "secops-fips" },\n  "classification": "other-known-class",\n  "diagnosis": "Family is already split across exact waits and successor reviews.",\n  "minimumDiagnosisPacket": {\n    "target": "staging",\n    "branch": "dev",\n    "runId": "171423554",\n    "resultPath": "evidence/fix.md",\n    "failingPhase": "review",\n    "failingAssertion": "",\n    "requestOrResponseExcerpt": "",\n    "referencesChecked": ["state.json"],\n    "inputFingerprint": "",\n    "errorFingerprint": ""\n  },\n  "changedFiles": ["evidence/fix.md"],\n  "verification": {\n    "runId": "",\n    "resultPath": "evidence/fix.md",\n    "status": "not-run"\n  },\n  "nextAction": "exact-wait",\n  "nextActionReason": "No single truthful family-wide rerun remains."\n}\n```',
            ],
          },
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedPrompt).toContain("Compact fix-forward training");
    expect(observedPrompt).toContain(
      "The reviewer will reject useful prose without FIX_FORWARD_RESULT",
    );
    expect(observedPrompt).toContain("Evidence must be fresh for this attempt");
    expect(observedPrompt).toContain(
      'Do not claim "done" from stale compact evidence alone',
    );
    expect(observedPrompt).toContain("no rerun; exact wait remains");
    expect(dispatched).toHaveLength(1);
    expect(
      dispatched[0].payload.workflowResult.details.fixForward,
    ).toMatchObject({
      workflow: "fix-forward",
      classification: "other-known-class",
      nextAction: "exact-wait",
    });
    expect(
      dispatched[0].payload.workflowResult.details
        .fixForwardStructuredResultPresent,
    ).toBe(true);
  });

  test("captures structured fix-forward result from cited deliverable when session result omits marker", async () => {
    const projectDir = await makeProject();
    const deliverablePath = join(projectDir, "fix-forward-from-deliverable.md");
    await writeFile(
      deliverablePath,
      `# deliverable\n\nFIX_FORWARD_RESULT:\n\
\`\`\`json\n{\n  "workflow": "fix-forward",\n  "subject": { "kind": "feature-family", "id": "kms" },\n  "classification": "other-known-class",\n  "diagnosis": "The durable evidence file carries the structured result.",\n  "minimumDiagnosisPacket": {\n    "target": "staging",\n    "branch": "dev",\n    "runId": "28819401584",\n    "resultPath": "evidence/fix-forward-from-deliverable.md",\n    "failingPhase": "review",\n    "failingAssertion": "same frontier remains",\n    "requestOrResponseExcerpt": "unchanged exact wait",\n    "referencesChecked": ["state.json"],\n    "inputFingerprint": "",\n    "errorFingerprint": ""\n  },\n  "changedFiles": ["evidence/fix-forward-from-deliverable.md"],\n  "verification": {\n    "runId": "",\n    "resultPath": "evidence/fix-forward-from-deliverable.md",\n    "status": "not-run"\n  },\n  "nextAction": "exact-wait",\n  "nextActionReason": "The deliverable itself is the authoritative structured packet."\n}\n\`\`\`\n`,
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
    const dispatched: Array<{ type: string; payload: Record<string, any> }> =
      [];
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
        message: "Reviewed the family and wrote durable evidence.",
        finishResult: {
          status: "success",
          summary: "Reviewed the family and wrote durable evidence.",
          deliverables: [{ path: deliverablePath }],
        },
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(
      dispatched[0].payload.workflowResult.details.fixForward,
    ).toMatchObject({
      workflow: "fix-forward",
      classification: "other-known-class",
      nextAction: "exact-wait",
    });
    expect(
      dispatched[0].payload.workflowResult.details
        .fixForwardStructuredResultPresent,
    ).toBe(true);
  });

  test("captures structured queued pipeline run from normal domain task output", async () => {
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
              children: ["queue-rerun-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "queue-rerun-task": {
              id: "queue-rerun-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Queue one exact ADO rerun.",
              inputs: ["spec:spec.one"],
              outputs: ["evidence/archive/spec-one-rerun.md"],
              acceptance: ["Structured queued run is returned"],
              forbidden: [],
              conflict_scope: ["spec:spec.one"],
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
      taskId: "queue-rerun-task",
    });
    const dispatched: Array<{ type: string; payload: Record<string, any> }> =
      [];
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
          finishResult: { status: "success" },
          message: `Queued one exact rerun.

QUEUED_PIPELINE_RUN:
\`\`\`json
{
  "backend": "ado",
  "runId": "171845974",
  "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171845974",
  "specIds": ["spec.one"],
  "target": "staging",
  "branch": "dev",
  "sourceVersion": "fe20302c4bc12708e539f011985a718db4bba5ef",
  "metadataPath": "workspace/spec-one/ado-run.json"
}
\`\`\``,
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedPrompt).toContain("QUEUED_PIPELINE_RUN");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload.workflowResult.details).toMatchObject({
      queuedRunStructuredResultPresent: true,
      queuedRun: {
        backend: "ado",
        runId: "171845974",
        specIds: ["spec.one"],
        target: "staging",
        branch: "dev",
      },
    });
  });

  test("captures structured spec result review for terminal pipeline wait tasks", async () => {
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
              children: ["wait-review-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "wait-review-task": {
              id: "wait-review-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Review terminal ADO run result for one spec.",
              inputs: ["run:171800822", "spec:spec.one"],
              outputs: ["evidence/archive/spec-one-review.md"],
              acceptance: ["Structured result review is returned"],
              forbidden: [],
              conflict_scope: ["spec:spec.one"],
              depends_on: [],
              context: {
                terminalPipelineWaitReview: {
                  backend: "ado",
                  runId: "171800822",
                  specIds: ["spec.one"],
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

    const assignment = assignTask(config(projectDir), {
      taskId: "wait-review-task",
    });
    const dispatched: Array<{ type: string; payload: Record<string, any> }> =
      [];
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
            deliverables: [{ path: "evidence/archive/spec-one-review.md" }],
          },
          message: `Reviewed terminal run.

SPEC_RESULT_REVIEW:
\`\`\`json
{
  "workflow": "spec-result-review",
  "specId": "spec.one",
  "runId": "171800822",
  "runUrl": "https://dev.azure.com/example/_build/results?buildId=171800822",
  "resultPath": "runs/test-results/spec.one/result.json",
  "specStatus": "pass",
  "reason": "Artifact result.json reports pass.",
  "liveVerified": true,
  "liveClusterObserved": true,
  "resourceGroup": "rg-spec-one",
  "clusterName": "aks-spec-one",
  "artifactRefs": ["runs/test-results/spec.one/result.json"],
  "specResults": []
}
\`\`\``,
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(observedPrompt).toContain("SPEC_RESULT_REVIEW");
    expect(observedPrompt).toContain("terminal Azure DevOps pipeline wait");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload.workflowResult.workflow).toBe(
      "spec-result-review",
    );
    expect(dispatched[0].payload.workflowResult.details).toMatchObject({
      workflow: "spec-result-review",
      specId: "spec.one",
      runId: "171800822",
      resultPath: "runs/test-results/spec.one/result.json",
      specStatus: "pass",
      liveVerified: true,
      specResultReviewStructuredResultPresent: true,
    });
  });

  test("captures structured spec result review from cited deliverable when session result omits marker", async () => {
    const projectDir = await makeProject();
    const deliverablePath = join(projectDir, "spec-result-review.md");
    await writeFile(
      deliverablePath,
      `# spec result review

SPEC_RESULT_REVIEW:
\`\`\`json
{
  "workflow": "spec-result-review",
  "specId": "spec.two",
  "runId": "171800999",
  "runUrl": "https://dev.azure.com/example/_build/results?buildId=171800999",
  "resultPath": "runs/test-results/spec.two/result.json",
  "specStatus": "error",
  "reason": "Artifact result.json reports cluster create timeout.",
  "liveVerified": false,
  "liveClusterObserved": true,
  "resourceGroup": "rg-spec-two",
  "clusterName": "aks-spec-two",
  "artifactRefs": ["runs/test-results/spec.two/result.json"],
  "specResults": []
}
\`\`\`
`,
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
              children: ["wait-review-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "wait-review-task": {
              id: "wait-review-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Review terminal ADO run result for one spec.",
              inputs: ["run:171800999", "spec:spec.two"],
              outputs: ["evidence/archive/spec-two-review.md"],
              acceptance: ["Structured result review is returned"],
              forbidden: [],
              conflict_scope: ["spec:spec.two"],
              depends_on: [],
              context: {
                terminalPipelineWaitReview: {
                  backend: "ado",
                  runId: "171800999",
                  specIds: ["spec.two"],
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

    const assignment = assignTask(config(projectDir), {
      taskId: "wait-review-task",
    });
    const dispatched: Array<{ type: string; payload: Record<string, any> }> =
      [];
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
        message: "Reviewed terminal run and wrote durable evidence.",
        finishResult: {
          status: "success",
          deliverables: [{ path: deliverablePath }],
        },
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload.workflowResult.workflow).toBe(
      "spec-result-review",
    );
    expect(dispatched[0].payload.workflowResult.details).toMatchObject({
      workflow: "spec-result-review",
      specId: "spec.two",
      runId: "171800999",
      resultPath: "runs/test-results/spec.two/result.json",
      specStatus: "error",
      liveClusterObserved: true,
      specResultReviewStructuredResultPresent: true,
    });
  });

  test("captures structured spec result review without terminal wait context", async () => {
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
              children: ["plain-review-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "plain-review-task": {
              id: "plain-review-task",
              parent_id: "project",
              state: "backlog",
              kind: "domain_leaf",
              priority: "P1",
              children: [],
              goal: "Review returned ADO artifacts for one spec.",
              inputs: [
                "run:171845974",
                "spec:spec.virtualmachines.spot-pool-eviction",
              ],
              outputs: ["evidence/archive/spec-spot-review.md"],
              acceptance: ["Structured result review is returned"],
              forbidden: [],
              conflict_scope: ["spec:spec.virtualmachines.spot-pool-eviction"],
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
      taskId: "plain-review-task",
    });
    const dispatched: Array<{ type: string; payload: Record<string, any> }> =
      [];
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
        finishResult: {
          status: "success",
          deliverables: [{ path: "evidence/archive/spec-spot-review.md" }],
        },
        message: `Reviewed returned run artifacts.

SPEC_RESULT_REVIEW:
\`\`\`json
{
  "workflow": "spec-result-review",
  "specId": "spec.virtualmachines.spot-pool-eviction",
  "runId": "171845974",
  "runUrl": "https://dev.azure.com/example/_build/results?buildId=171845974",
  "resultPath": "runs/test-results/test_20260711161602701_h4tmyw_716962/artifacts/virtualmachines-spot-pool-eviction/spec-runner/result.json",
  "specStatus": "pass",
  "reason": "Artifact result.json reports pass.",
  "liveVerified": true,
  "liveClusterObserved": true,
  "resourceGroup": "rg-plan-001-2701-h4tmyw-716962",
  "clusterName": "aks-plan-001-2701-h4tmyw-716962",
  "artifactRefs": ["runs/test-results/test_20260711161602701_h4tmyw_716962/artifacts/virtualmachines-spot-pool-eviction/spec-runner/result.json"],
  "specResults": []
}
\`\`\``,
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].payload.workflowResult.workflow).toBe(
      "spec-result-review",
    );
    expect(dispatched[0].payload.workflowResult.details).toMatchObject({
      workflow: "spec-result-review",
      specId: "spec.virtualmachines.spot-pool-eviction",
      runId: "171845974",
      specStatus: "pass",
      resultPath:
        "runs/test-results/test_20260711161602701_h4tmyw_716962/artifacts/virtualmachines-spot-pool-eviction/spec-runner/result.json",
      liveVerified: true,
      specResultReviewStructuredResultPresent: true,
    });
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
        state: "review",
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
        state: "review",
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

  test("routes app workflow tasks inline under the assigned task session", async () => {
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
              children: ["collector-task"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "collector-task": {
              id: "collector-task",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "feature-reference-collector",
              priority: "P1",
              children: [],
              goal: "Collect one feature reference packet.",
              inputs: [],
              outputs: ["features/example/references.md"],
              acceptance: ["Collector returns a structured result"],
              forbidden: [],
              conflict_scope: ["feature:example"],
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
      taskId: "collector-task",
    });
    let agentCalls = 0;
    let workflowCalls = 0;
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
      runWorkflow: async () => {
        workflowCalls++;
        return { status: "done", message: "unexpected sub-workflow call" };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      `routed inline to workflow feature-reference-collector under session ${assignment.sessionId}`,
    );
    expect(agentCalls).toBe(0);
    expect(workflowCalls).toBe(0);

    const updated = JSON.parse(
      await readFile(resolveTaskTreePath(projectDir), "utf8"),
    );
    expect(updated.tasks["collector-task"].session_id).toBe(
      assignment.sessionId,
    );
    expect(updated.tasks["collector-task"].trace.last_worker_result).toBe(
      "partial",
    );
  });
});
