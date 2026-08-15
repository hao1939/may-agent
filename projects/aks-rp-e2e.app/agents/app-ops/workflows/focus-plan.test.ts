import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./focus-plan.ts";

function taskTreePath(appDir: string): string {
  return join(appDir, ".state", "tasks", "tree.json");
}

function reconciliationTaskSnapshot(appDir: string) {
  const tree = JSON.parse(readFileSync(taskTreePath(appDir), "utf8")) as {
    tasks?: Record<string, Record<string, any>>;
    conditions?: Record<string, { spec?: Record<string, any> }>;
  };
  const status = (task: Record<string, any>) => {
    const phase = String(task.phase ?? task.state ?? "pending");
    return (
      {
        backlog: "pending",
        active: "running",
        blocked: "waiting",
        review: "attention",
        converged: "done",
      } as Record<string, string>
    )[phase] ?? phase;
  };
  const liveEntries = Object.entries(tree.tasks ?? {}).filter(
    ([, task]) =>
      task.item_type !== "group" &&
      !["done", "closed", "converged"].includes(status(task)),
  );
  const liveIds = new Set(liveEntries.map(([taskId]) => taskId));
  return {
    live: liveEntries.map(([taskId, task]) => ({
      taskId,
      parentId: String(task.parent_id ?? "project"),
      generation: Number(task.generation ?? task.revision ?? 1),
      status: status(task),
      outcome: String(task.outcome ?? task.goal ?? ""),
      evidence: Array.isArray(task.evidence) ? task.evidence : [],
      ...(typeof task.owner === "string" ? { owner: task.owner } : {}),
      ...(typeof task.workflow === "string" ? { workflow: task.workflow } : {}),
      input:
        task.input && typeof task.input === "object" && !Array.isArray(task.input)
          ? task.input
          : {},
      ...(typeof task.priority === "string" ? { priority: task.priority } : {}),
      ...(typeof task.category === "string" ? { category: task.category } : {}),
      ...(Array.isArray(task.depends_on) ? { dependsOn: task.depends_on } : {}),
      conditions: (Array.isArray(task.condition_ids) ? task.condition_ids : []).flatMap(
        (conditionId: string) => {
          const spec = tree.conditions?.[conditionId]?.spec;
          return spec
            ? [
                {
                  id: conditionId,
                  type: String(spec.type ?? ""),
                  subject: String(spec.subject ?? ""),
                  expected: spec.expected,
                  ...(typeof spec.owner === "string" ? { owner: spec.owner } : {}),
                },
              ]
            : [];
        },
      ),
      ...(task.readiness && typeof task.readiness === "object"
        ? {
            readiness: {
              state: String(task.readiness.state ?? "not-applicable"),
              reason: String(task.readiness.reason ?? "test fixture"),
              relatedTaskIds: Array.isArray(task.readiness.related_ids)
                ? task.readiness.related_ids
                : [],
            },
          }
        : {}),
      hasLiveChildren: (Array.isArray(task.children) ? task.children : []).some(
        (childId: string) => liveIds.has(childId),
      ),
      ...(typeof task.updated_at === "string" ? { updatedAt: task.updated_at } : {}),
    })),
    truncated: false,
  };
}

async function makeWorkspace(options?: { leafState?: string }) {
  const leafState = options?.leafState ?? "backlog";
  const leafPhase =
    (
      {
        backlog: "pending",
        active: "running",
        review: "attention",
        blocked: "waiting",
        done: "converged",
      } as const
    )[leafState as "backlog" | "active" | "review" | "blocked" | "done"] ??
    leafState;
  const root = await mkdtemp(join(tmpdir(), "aks-focus-plan-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    taskTreePath(appDir),
    `${JSON.stringify(
      {
        schema_version: 2,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        tasks: {
          project: {
            item_type: "group",
            id: "project",
            children: ["execution-and-verification"],
            outcome: "Learn AKS RP input and expectation space.",
            outputs: [".state/tasks/tree.json"],
            acceptance: ["project advances"],
          },
          "execution-and-verification": {
            item_type: "group",
            id: "execution-and-verification",
            parent_id: "project",
            category: "lane",
            children: ["run-rest-spec-batch"],
            outcome: "Execute runnable specs and feed evidence back.",
            outputs: ["runs/executions/", "model/knowledge-map/model.json"],
            acceptance: ["live evidence updates the model"],
          },
          "run-rest-spec-batch": {
            item_type: "task",
            id: "run-rest-spec-batch",
            parent_id: "execution-and-verification",
            phase: leafPhase,
            category: "domain_leaf",
            priority: "P1",
            children: [],
            outcome: "Run a small REST replay batch.",
            readiness: {
              state: leafPhase === "pending" ? "ready" : "not-applicable",
              reason: "test fixture",
              related_ids: [],
            },
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
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    taskTreePath(appDir),
    `${JSON.stringify(
      {
        schema_version: 2,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        tasks: {
          project: {
            item_type: "group",
            id: "project",
            children: [
              "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
              "ops/wait-project-approval-owner-return-primary-blocker-20260713",
            ],
            outcome: "Learn AKS RP input and expectation space.",
            outputs: [".state/tasks/tree.json"],
            acceptance: ["project advances"],
          },
          "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711":
            {
              item_type: "task",
              id: "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
              parent_id: "project",
              phase: "waiting",
              category: "focus_plan",
              priority: "P1",
              children: [],
              owner: "aks-explorer",
              outcome:
                "Keep the focus branch normalized behind the governing owner-return wait.",
              condition_ids: ["condition-focus-governing-wait"],
              outputs: ["evidence/archive/focus.md"],
              acceptance: ["focus stays aligned"],
            },
          "ops/wait-project-approval-owner-return-primary-blocker-20260713": {
            item_type: "task",
            id: "ops/wait-project-approval-owner-return-primary-blocker-20260713",
            parent_id: "project",
            phase: "waiting",
            category: "domain_leaf",
            priority: "P2",
            children: [],
            owner: "app-ops",
            outcome: "Carry the governing project-level owner-return wait.",
            condition_ids: ["condition-project-approval"],
            input: {
              approval: {
                type: "project.approval.submitted",
                taskId:
                  "ops/wait-project-approval-owner-return-primary-blocker-20260713",
                acceptedDecisions: [
                  "approve",
                  "adjust",
                  "hold",
                  "decline",
                  "reroute",
                ],
                lineages: [
                  {
                    taskId:
                      "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711",
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
            outputs: ["evidence/archive/wait.md"],
            acceptance: ["wait stays exact"],
          },
        },
        conditions: {
          "condition-focus-governing-wait": {
            metadata: {
              id: "condition-focus-governing-wait",
              generation: 1,
              resourceVersion: 1,
            },
            spec: {
              type: "task.converged",
              subject:
                "task:ops/wait-project-approval-owner-return-primary-blocker-20260713",
              expected: { phase: "converged" },
              owner: "app-ops",
            },
            status: { observedGeneration: 0, state: "unknown" },
          },
          "condition-project-approval": {
            metadata: {
              id: "condition-project-approval",
              generation: 1,
              resourceVersion: 1,
            },
            spec: {
              type: "project.approval.submitted",
              subject:
                "approvalId:aks-rp-e2e:approval:focus-review-off_track-approval-refresh-20260712:evidence-archive-ops-repair-focus-review-off-track-approval-refresh-20260712.md",
              expected: {
                field: "decision",
                anyOf: ["approve", "adjust", "hold", "decline", "reroute"],
              },
              owner: "human",
            },
            status: { observedGeneration: 0, state: "unknown" },
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

function context(input: {
  appDir: string;
  projectDir: string;
  trigger: Record<string, unknown>;
  agentResult:
    | unknown
    | ((
        agent: string,
        prompt: string,
        options?: { sessionId?: string; timeoutMs?: number },
      ) => unknown | Promise<unknown>);
  dispatched?: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
}) {
  const { type, target, data, ...legacyData } = input.trigger;
  return {
    input: {},
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "runtime/focus-plan",
      generation: 1,
      resourceVersion: 1,
      owner: "aks-explorer",
      mode: "maintain",
      outcome: "Review current project focus",
      acceptance: ["The focus review emits its bounded follow-up."],
      input: {},
      children: { live: [], completed: [] },
      taskSnapshot: reconciliationTaskSnapshot(input.appDir),
      trigger: {
        type,
        target,
        data: {
          ...legacyData,
          ...(data && typeof data === "object" ? data : {}),
        },
      },
    },
    workspace: {
      appRoot: input.appDir,
      projectRoot: input.projectDir,
      root: input.projectDir,
      output: input.projectDir,
    },
    agents: {
      async call(
        agent: string,
        prompt: string,
        options?: { sessionId?: string; timeoutMs?: number },
      ) {
        return typeof input.agentResult === "function"
          ? input.agentResult(agent, prompt, options)
          : input.agentResult;
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

describe("focus-plan workflow", () => {
  test("suppresses terminal guidance when live frontier is still nonterminal", async () => {
    const { appDir, projectDir } = await makeWorkspace({ leafState: "active" });
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        dispatched,
        agentResult: {
          status: "success",
          message:
            "FOCUS_PLAN_RESULT: completed\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Project at FINAL terminal ceiling. No actionable work remains. Disable review schedule.\nOWNER_NEXT: close the loop",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result.summary).toContain("result updated");
    expect(result.summary).toContain(
      "Terminal/completed or disable-review guidance was suppressed",
    );
    expect(result.summary).toContain('active_task_ids=["run-rest-spec-batch"]');
    expect(result.summary).toContain("counts.waiting=0");
    expect(result.summary).toContain("counts.pending=0");
    expect(result).toMatchObject({
      output: {
        state: "converged",
        summary: expect.stringContaining(
          "Focus-plan review completed with result updated",
        ),
        evidence: [
          "focus-plan:review:updated",
          "event:project.owner.requested",
        ],
        actions: [],
      },
    });
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

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        agentResult: {
          status: "success",
          message:
            "FOCUS_PLAN_RESULT: completed\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Focus done.\nOWNER_NEXT: archive the plan",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result.summary).toContain("LIVE_FRONTIER_EVIDENCE:");
    expect(result.summary).toContain("frontier.review=[]");
    expect(result.summary).toContain("counts.waiting=0");
    expect(result.summary).toContain("counts.pending=0");
  });

  test("suppresses failed-known-issues when live frontier is still nonterminal", async () => {
    const { appDir, projectDir } = await makeWorkspace({
      leafState: "blocked",
    });

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        agentResult: {
          status: "success",
          message:
            "FOCUS_PLAN_RESULT: failed_known_issues\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Planned run terminal failed with known issues.\nOWNER_NEXT: archive the plan",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result.summary).toContain("result updated");
    expect(result.summary).toContain(
      "Terminal/completed or disable-review guidance was suppressed",
    );
    expect(result.summary).toContain("counts.waiting=1");
  });

  test("accepts failed-known-issues when the focus frontier is terminal", async () => {
    const { appDir, projectDir } = await makeWorkspace({ leafState: "done" });

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        agentResult: {
          status: "success",
          message:
            "FOCUS_PLAN_RESULT: failed_known_issues\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Planned run terminal failed after local repair paths were exhausted.\nOWNER_NEXT: start a new focus after escalation response",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result.summary).toContain(
      "Focus-plan review completed with result failed_known_issues",
    );
    expect(result.summary).toContain("LIVE_FRONTIER_EVIDENCE:");
    expect(result.summary).toContain("counts.waiting=0");
  });

  test("asks for human approval and still wakes owner review for a proposed focus", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const prompts: string[] = [];
    const sessionIds: string[] = [];
    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-mid-term-focus-plan",
          mode: "plan",
        },
        dispatched,
        agentResult: async (_agent, prompt, options) => {
          prompts.push(prompt);
          sessionIds.push(options?.sessionId ?? "");
          return {
            status: "success",
            message:
              "FOCUS_PLAN_RESULT: needs_approval\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Propose 24h focus on REST replay execution and model feedback.\nOWNER_NEXT: wait for approval, then assign replay leaves",
          };
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("AKS RP E2E Focus Plan Mode");
    expect(prompts[0]).toContain(
      "Current bounded, truncation-aware App task snapshot",
    );
    expect(prompts[0]).toContain("run-rest-spec-batch");
    expect(sessionIds).toHaveLength(1);
    expect(sessionIds[0]).toMatch(/^s_focus_plan_strategy_\d{14}_[a-z0-9]+$/);
    expect(sessionIds[0]).not.toBe("s_focus_plan_strategy");
    expect(new Set(dispatched.map((event) => event.type))).toEqual(
      new Set(["message.created", "project.owner.requested"]),
    );
    const approvalEvent = dispatched.find(
      (event) => event.type === "message.created",
    )!;
    const ownerEvent = dispatched.find(
      (event) => event.type === "project.owner.requested",
    )!;
    expect(approvalEvent.payload).toMatchObject({
      from: "aks-explorer",
      to: "human",
      intent: "focus-plan-approval",
      project: "aks-rp-e2e",
    });
    expect((approvalEvent.payload as any).dedupKey).toBe(
      "aks-rp-e2e:focus-plan:needs_approval",
    );
    expect(approvalEvent.payload).toMatchObject({
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
    expect(String((approvalEvent.payload as any).content)).toContain(
      "Decision: Approve the proposal focus direction",
    );
    expect(String((approvalEvent.payload as any).content)).toContain(
      "Reply to this Telegram message with approve",
    );
    expect(ownerEvent.payload).toMatchObject({
      project: "aks-rp-e2e",
      reason: "focus-plan-proposal",
      focusResult: "needs_approval",
    });
    expect(result).toMatchObject({
      output: {
        evidence: expect.arrayContaining([
          "event:message.created",
          "event:project.owner.requested",
        ]),
      },
    });
  });

  test("prefers marker-bearing assistant text over plain summary", async () => {
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
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        dispatched,
        agentResult: {
          status: "success",
          summary:
            "Completed the regular focus progress review and confirmed the focus is still on track.",
          lastAssistantText:
            "FOCUS_PLAN_RESULT: on_track\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Active focus still has runnable leaves.\nOWNER_NEXT: keep assigning backlog leaves",
        },
      }),
    );

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

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        dispatched,
        agentResult: {
          status: "success",
          summary:
            "Completed the regular focus progress review for aks-rp-e2e, confirmed the existing no-live post-reconciliation stewardship focus is still on track, and refreshed both the durable evidence artifact and focus-plan metadata in .state/tasks/tree.json to match the current fully-drained executable frontier.",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result.summary).toContain("result on_track");
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

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        dispatched,
        agentResult: {
          status: "success",
          summary:
            "Completed the regular focus progress review for aks-rp-e2e, confirmed the existing no-live stewardship focus is still on track, and kept it blocked behind the same governing approval wait while no returned owner decision exists.",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(result.summary).toContain("result blocked");
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

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-mid-term-focus-plan",
          mode: "plan",
        },
        dispatched,
        agentResult: {
          status: "success",
          message:
            "FOCUS_PLAN_RESULT: needs_approval\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Propose 24h focus on REST replay execution and model feedback.\nOWNER_NEXT: wait for approval, then assign replay leaves",
        },
      }),
    );

    expect(result.status).toBe("done");
    expect(new Set(dispatched.map((event) => event.type))).toEqual(
      new Set(["message.created", "project.owner.requested"]),
    );
    const approvalEvent = dispatched.find(
      (event) => event.type === "message.created",
    )!;
    const ownerEvent = dispatched.find(
      (event) => event.type === "project.owner.requested",
    )!;
    expect(approvalEvent.payload).toMatchObject({
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
    expect(ownerEvent.payload).toMatchObject({
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

    const result = await execute(
      context({
        appDir,
        projectDir,
        trigger: {
          type: "project.focus.review.requested",
          project: "aks-rp-e2e",
          reason: "scheduled-focus-progress-review",
        },
        dispatched,
        agentResult: {
          status: "success",
          message:
            "FOCUS_PLAN_RESULT: on_track\nFOCUS_PLAN_TITLE: REST replay focus\nFOCUS_PLAN_SUMMARY: Active focus still has runnable leaves.\nOWNER_NEXT: keep assigning backlog leaves",
        },
      }),
    );

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
