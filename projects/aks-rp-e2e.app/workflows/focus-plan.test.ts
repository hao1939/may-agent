import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./focus-plan.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-focus-plan-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(appDir, "tasks", "tree.json"),
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
            state: "backlog",
            children: ["execution-and-verification"],
            goal: "Learn AKS RP input and expectation space.",
            outputs: ["tasks/tree.json"],
            acceptance: ["project advances"],
          },
          "execution-and-verification": {
            id: "execution-and-verification",
            parent_id: "project",
            state: "backlog",
            kind: "lane",
            children: ["run-rest-spec-batch"],
            goal: "Execute runnable specs and feed evidence back.",
            outputs: ["runs/executions/", "model/knowledge-map/model.json"],
            acceptance: ["live evidence updates the model"],
          },
          "run-rest-spec-batch": {
            id: "run-rest-spec-batch",
            parent_id: "execution-and-verification",
            state: "backlog",
            kind: "domain_leaf",
            priority: "P1",
            children: [],
            goal: "Run a small REST replay batch.",
            outputs: ["runs/executions/rest-batch/"],
            acceptance: ["result.json files exist"],
            conflict_scope: ["staging-rest-runs"],
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return { appDir, projectDir };
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

describe("focus-plan workflow", () => {
  test("asks for human approval and still wakes owner review for a proposed focus", async () => {
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
          type: "project.focus.plan.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-mid-term-focus-plan",
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
            "FOCUS_PLAN_RESULT: needs_approval\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Propose 24h focus on REST replay execution and model feedback.\nOWNER_NEXT: wait for approval, then assign replay leaves",
        };
      },
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("AKS RP E2E Focus Plan Mode");
    expect(prompts[0]).toContain("Current compact task-tree packet");
    expect(prompts[0]).toContain("run-rest-spec-batch");
    expect(dispatched.map((event) => event.type)).toEqual([
      "message.created",
      "project.owner.requested",
    ]);
    expect(dispatched[0].payload).toMatchObject({
      from: "aks-explorer",
      to: "human",
      intent: "focus-plan-approval",
      project: "aks-rp-e2e",
    });
    expect((dispatched[0].payload as any).dedupKey).toBe(
      "aks-rp-e2e:focus-plan:needs_approval",
    );
    expect(dispatched[0].payload).toMatchObject({
      projectId: "projects/aks-rp-e2e.app",
      projectPath: "projects/aks-rp-e2e.app",
      requestedAction:
        "Reply to this notification with approve, adjust <changes>, or hold. The reply is emitted to projects/aks-rp-e2e.app as project.focus.approval.submitted.",
      approval: {
        kind: "focus-plan",
        planId: "focus-proposal-needs_approval",
        question: 'Approve the proposal focus direction "REST replay focus"?',
        directEvent: {
          type: "project.focus.approval.submitted",
          project: "aks-rp-e2e",
          projectPath: "projects/aks-rp-e2e.app",
          planId: "focus-proposal-needs_approval",
        },
      },
    });
    expect(String((dispatched[0].payload as any).content)).toContain(
      "Decision: Approve the proposal focus direction",
    );
    expect(String((dispatched[0].payload as any).content)).toContain(
      "Reply to this Telegram message with approve",
    );
    expect(dispatched[1].payload).toMatchObject({
      project: "aks-rp-e2e",
      reason: "focus-plan-proposal",
      focusResult: "needs_approval",
    });

    const focusRuns = await readFile(
      join(appDir, ".state", "focus-plan-runs.jsonl"),
      "utf8",
    );
    expect(focusRuns).toContain('"result":"needs_approval"');
  });

  test("progress review on track wakes owner review without human escalation", async () => {
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
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
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
          "FOCUS_PLAN_RESULT: on_track\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Active focus still has runnable leaves.\nOWNER_NEXT: keep assigning backlog leaves",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.owner.requested",
    ]);
    expect(dispatched[0].payload).toMatchObject({
      project: "aks-rp-e2e",
      reason: "focus-plan-review",
      focusResult: "on_track",
    });
  });
});
