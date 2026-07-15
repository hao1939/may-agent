import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./focus-plan.ts";

async function makeWorkspace(options?: { leafState?: string }) {
  const leafState = options?.leafState ?? "backlog";
  const root = await mkdtemp(join(tmpdir(), "aks-focus-plan-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
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
            state: leafState === "done" ? "done" : "backlog",
            children: ["execution-and-verification"],
            goal: "Learn AKS RP input and expectation space.",
            outputs: ["tasks/tree.json"],
            acceptance: ["project advances"],
          },
          "execution-and-verification": {
            id: "execution-and-verification",
            parent_id: "project",
            state: leafState === "done" ? "done" : "backlog",
            kind: "lane",
            children: ["run-rest-spec-batch"],
            goal: "Execute runnable specs and feed evidence back.",
            outputs: ["runs/executions/", "model/knowledge-map/model.json"],
            acceptance: ["live evidence updates the model"],
          },
          "run-rest-spec-batch": {
            id: "run-rest-spec-batch",
            parent_id: "execution-and-verification",
            state: leafState,
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

async function makeOwnerReturnAlignedWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-focus-plan-lineage-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
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
            state: "blocked",
            children: [
              "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
              "ops/wait-project-approval-owner-return-primary-blocker-20260713",
            ],
            goal: "Learn AKS RP input and expectation space.",
            outputs: ["tasks/tree.json"],
            acceptance: ["project advances"],
          },
          "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711": {
            id: "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
            parent_id: "project",
            state: "blocked",
            kind: "focus_plan",
            priority: "P1",
            children: [],
            owner: "aks-explorer",
            goal: "Keep the focus branch normalized behind the governing owner-return wait.",
            outputs: ["evidence/archive/focus.md"],
            acceptance: ["focus stays aligned"],
            blocker: {
              condition: "Blocked behind the governing wait.",
              category: "human-approval",
              owner: "human",
              blocked_at: "2026-07-14T00:00:00Z",
              waiting_for: {
                type: "blocker.resolved",
                taskId: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
              },
            },
          },
          "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
            id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
            parent_id: "project",
            state: "blocked",
            kind: "domain_leaf",
            priority: "P2",
            children: [],
            owner: "app-ops",
            goal: "Carry the governing project-level owner-return wait.",
            outputs: ["evidence/archive/wait.md"],
            acceptance: ["wait stays exact"],
            blocker: {
              condition: "Blocked on the returned project approval decision for the exact focus/shared owner-return lineage.",
              category: "external-wait",
              owner: "human",
              blocked_at: "2026-07-14T00:00:00Z",
              waiting_for: {
                type: "project.approval.submitted",
                taskId: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                approvalKind: "approval-packet-dispatch",
                acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
                lineages: [
                  {
                    taskId: "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
                    planId: "focus-review-off_track",
                    pathId: "focus-review-off_track-approval-refresh-20260712",
                    approvalId:
                      "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
                    waitId:
                      "wait:aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
                    packetPath:
                      "evidence/archive/ops-repair-focus-review-off-track-approval-refresh-20260712.md",
                    requestEventId: 3069971,
                    messageId: 3069974,
                  },
                ],
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
  return { appDir, projectDir };
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

describe("focus-plan workflow", () => {
  test("suppresses terminal guidance when live frontier is still nonterminal", async () => {
    const { appDir, projectDir } = await makeWorkspace({ leafState: "active" });
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
          "FOCUS_PLAN_RESULT: completed\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Project at FINAL terminal ceiling. No actionable work remains. Disable review schedule.\nOWNER_NEXT: close the loop",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("result updated");
    expect(result.message).toContain(
      "Terminal/completed or disable-review guidance was suppressed",
    );
    expect(result.message).toContain('active_task_ids=["run-rest-spec-batch"]');
    expect(result.message).toContain("counts.blocked=0");
    expect(result.message).toContain("counts.backlog=0");
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.owner.requested",
    ]);
    expect(dispatched[0].payload).toMatchObject({
      project: "aks-rp-e2e",
      reason: "focus-plan-review",
      focusResult: "updated",
    });
    expect(String((dispatched[0].payload as any).params?.summary)).toContain(
      "Keep review scheduling enabled until the live frontier is actually terminal.",
    );
  });

  test("adds explicit live frontier evidence when a terminal result remains", async () => {
    const { appDir, projectDir } = await makeWorkspace({ leafState: "done" });

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
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message:
          "FOCUS_PLAN_RESULT: completed\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Focus done.\nOWNER_NEXT: archive the plan",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("LIVE_FRONTIER_EVIDENCE:");
    expect(result.message).toContain("frontier.review=[]");
    expect(result.message).toContain("counts.blocked=0");
    expect(result.message).toContain("counts.backlog=0");
  });

  test("suppresses failed-known-issues when live frontier is still nonterminal", async () => {
    const { appDir, projectDir } = await makeWorkspace({
      leafState: "blocked",
    });

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
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message:
          "FOCUS_PLAN_RESULT: failed_known_issues\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Planned run terminal failed with known issues.\nOWNER_NEXT: archive the plan",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("result updated");
    expect(result.message).toContain(
      "Terminal/completed or disable-review guidance was suppressed",
    );
    expect(result.message).toContain("counts.blocked=1");
  });

  test("accepts failed-known-issues when the focus frontier is terminal", async () => {
    const { appDir, projectDir } = await makeWorkspace({ leafState: "done" });

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
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      runAgentSession: async () => ({
        status: "success",
        message:
          "FOCUS_PLAN_RESULT: failed_known_issues\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Planned run terminal failed after local repair paths were exhausted.\nOWNER_NEXT: start a new focus after escalation response",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Focus-plan review completed with result failed_known_issues",
    );
    expect(result.message).toContain("LIVE_FRONTIER_EVIDENCE:");
    expect(result.message).toContain("counts.blocked=0");
  });

  test("asks for human approval and still wakes owner review for a proposed focus", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const prompts: string[] = [];
    const sessionIds: string[] = [];
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
          reason: "scheduled-mid-term-focus-plan",
          mode: "plan",
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
      runAgentSession: async (
        _agent: string,
        prompt: string,
        sessionId: string,
      ) => {
        prompts.push(prompt);
        sessionIds.push(sessionId);
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
    expect(sessionIds).toHaveLength(1);
    expect(sessionIds[0]).toMatch(/^s_focus_plan_strategy_\d{14}_[a-z0-9]+$/);
    expect(sessionIds[0]).not.toBe("s_focus_plan_strategy");
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
        "Reply to this notification with approve, adjust <changes>, or hold. The reply is emitted to projects/aks-rp-e2e.app as project.approval.submitted.",
      approval: {
        kind: "focus-plan",
        planId: "focus-proposal-needs_approval",
        question: 'Approve the proposal focus direction "REST replay focus"?',
        directEvent: {
          type: "project.approval.submitted",
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

  test("prefers marker-bearing assistant text over plain summary", async () => {
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
        summary:
          "Completed the regular focus progress review and confirmed the focus is still on track.",
        lastAssistantText:
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

  test("does not re-notify human approval for summary-only on-track review text", async () => {
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
        summary:
          "Completed the regular focus progress review for aks-rp-e2e, confirmed the existing no-live post-reconciliation stewardship focus is still on track, and refreshed both the durable evidence artifact and focus-plan metadata in .state/tasks/tree.json to match the current fully-drained executable frontier.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("result on_track");
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.owner.requested",
    ]);
    expect(dispatched[0].payload).toMatchObject({
      project: "aks-rp-e2e",
      reason: "focus-plan-review",
      focusResult: "on_track",
    });
  });

  test("does not emit off-track approval metadata for unmarked on-track blocked reviews", async () => {
    const { appDir, projectDir } = await makeWorkspace({
      leafState: "blocked",
    });
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
        summary:
          "Completed the regular focus progress review for aks-rp-e2e, confirmed the existing no-live stewardship focus is still on track, and kept it blocked behind the same governing approval wait while no returned owner decision exists.",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("result blocked");
    expect(dispatched.map((event) => event.type)).toEqual([
      "project.owner.requested",
    ]);
    expect(dispatched[0].payload).toMatchObject({
      project: "aks-rp-e2e",
      reason: "focus-plan-review",
      focusResult: "blocked",
    });
  });

  test("reuses preserved governing focus approval lineage when approval is requested", async () => {
    const { appDir, projectDir } = await makeOwnerReturnAlignedWorkspace();
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
          reason: "scheduled-mid-term-focus-plan",
          mode: "plan",
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
          "FOCUS_PLAN_RESULT: needs_approval\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Propose 24h focus on REST replay execution and model feedback.\nOWNER_NEXT: wait for approval, then assign replay leaves",
      }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(dispatched.map((event) => event.type)).toEqual([
      "message.created",
      "project.owner.requested",
    ]);
    expect(dispatched[0].payload).toMatchObject({
      intent: "focus-plan-approval",
      requestedAction:
        "Reply to this notification with approve, adjust <changes>, or hold. The reply is emitted to projects/aks-rp-e2e.app as project.approval.submitted carrying the preserved approvalId/waitId lineage.",
      pathId: "focus-review-off_track-approval-refresh-20260712",
      approvalId:
        "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
      waitId:
        "wait:aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
      dedupKey:
        "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
      approval: {
        kind: "focus-plan",
        planId: "focus-review-off_track",
        pathId: "focus-review-off_track-approval-refresh-20260712",
        approvalId:
          "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
        waitId:
          "wait:aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
        packetPath:
          "evidence/archive/ops-repair-focus-review-off-track-approval-refresh-20260712.md",
        directEvent: {
          type: "project.approval.submitted",
          project: "aks-rp-e2e",
          projectPath: "projects/aks-rp-e2e.app",
          approvalKind: "focus-plan",
          planId: "focus-review-off_track",
          pathId: "focus-review-off_track-approval-refresh-20260712",
          approvalId:
            "aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
          waitId:
            "wait:aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
          packetPath:
            "evidence/archive/ops-repair-focus-review-off-track-approval-refresh-20260712.md",
        },
      },
      evidence: {
        governingFocusApprovalWaitTaskId:
          "ops/wait-project-approval-owner-return-primary-blocker-20260713",
        preservedFocusApprovalPathId:
          "focus-review-off_track-approval-refresh-20260712",
      },
    });
    expect(dispatched[1].payload).toMatchObject({
      project: "aks-rp-e2e",
      reason: "focus-plan-proposal",
      focusResult: "needs_approval",
    });
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
