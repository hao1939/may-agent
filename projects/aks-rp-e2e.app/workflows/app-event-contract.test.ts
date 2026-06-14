import { describe, expect, test } from "bun:test";
import app from "../app.ts";

type EmittedEvent = Record<string, unknown>;

function testContext() {
  const emitted: EmittedEvent[] = [];
  const noops: string[] = [];
  return {
    emitted,
    noops,
    ctx: {
      projectPath: (path: string) => `/domain/${path}`,
      appPath: (path: string) => `/app/${path}`,
      readJson: async () => ({}),
      importModule: async () => ({}),
      startSession: () => undefined,
      emit: (event: EmittedEvent) => {
        emitted.push(event);
        return event;
      },
      noop: (reason: string) => {
        noops.push(reason);
        return { type: "noop", reason };
      },
    },
  };
}

describe("app event contract", () => {
  test("task.requeued wakes owner review with task context", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "task.requeued",
      projectId: "aks-rp-e2e",
      taskId: "feature-a-replay",
      status: "ready",
      reason: "session-stale",
      session_id: "s_task_feature_a_replay",
      goal: "Run feature A replay.",
      outputs: ["replays/feature-a.ts"],
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].type).toBe("project.owner.requested");
    expect(emitted[0].reason).toBe("task-requeued");
    expect(emitted[0].params).toMatchObject({
      task: {
        taskId: "feature-a-replay",
        status: "ready",
        reason: "session-stale",
        session_id: "s_task_feature_a_replay",
        goal: "Run feature A replay.",
        outputs: ["replays/feature-a.ts"],
      },
    });
  });

  test("project.task.completed wakes owner review with completion snapshot", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "feature-a-replay",
        status: "review",
        session_id: "s_task_feature_a_replay",
        result: "done",
        summary: "Replay passed and wrote result evidence.",
        evidence: ["runs/executions/run-1/result.json"],
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId: "feature-a-replay",
        status: "review",
        task: {
          taskId: "feature-a-replay",
          status: "review",
          result: "done",
          summary: "Replay passed and wrote result evidence.",
          evidence: ["runs/executions/run-1/result.json"],
        },
      },
    });
  });

  test("blocked task completion requests visible problem solving and wakes owner review", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "wi-upgrade-survival-staging-execute-20260612",
        status: "review",
        session_id: "s_task_wi_upgrade_survival",
        result: "blocked",
        summary:
          "Replay blocked at ARM auth preflight. No ARM token available; az CLI not installed, no managed identity, no ARM_ACCESS_TOKEN.",
        evidence: [
          "runs/executions/run_20260612s_wi_upgrade_survival/result.json",
        ],
      },
    });

    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toMatchObject({
      type: "project.problem.requested",
      project: "aks-rp-e2e",
      problemKey:
        "aks-rp-e2e:task-problem:wi-upgrade-survival-staging-execute-20260612",
      affectedTasks: ["wi-upgrade-survival-staging-execute-20260612"],
      params: {
        problemKey:
          "aks-rp-e2e:task-problem:wi-upgrade-survival-staging-execute-20260612",
        reason: "task-blocked-or-failed",
        taskId: "wi-upgrade-survival-staging-execute-20260612",
      },
    });
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId: "wi-upgrade-survival-staging-execute-20260612",
      },
    });
  });

  test("rejected review completions request problem solving and wake owner review", async () => {
    const { ctx, emitted, noops } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "feature-a-rework-review",
        status: "review",
        verificationVerdict: "rejected",
        summary: "Review rejected because the output duplicated old evidence.",
      },
    });

    expect(noops).toEqual([]);
    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toMatchObject({
      type: "project.problem.requested",
      project: "aks-rp-e2e",
      problemKey: "aks-rp-e2e:task-problem:feature-a-rework-review",
      affectedTasks: ["feature-a-rework-review"],
    });
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId: "feature-a-rework-review",
        verificationVerdict: "rejected",
        task: {
          taskId: "feature-a-rework-review",
          verificationVerdict: "rejected",
          summary:
            "Review rejected because the output duplicated old evidence.",
        },
      },
    });
  });

  test("problem solver results wake the owner for tree reconciliation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.problem.resolved",
      project: "aks-rp-e2e",
      problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
      affectedTasks: ["ms-create-time-staging-execute-20260612"],
      summary: "Configured runner ARM token path and verified auth preflight.",
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "problem-resolved",
      params: {
        problemKey: "aks-rp-e2e:staging-arm-auth-unavailable",
        problem: {
          summary:
            "Configured runner ARM token path and verified auth preflight.",
        },
      },
    });
  });

  test("focus approval submission wakes owner with decision context", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.focus.approval.submitted",
      project: "aks-rp-e2e",
      data: {
        planId: "focus-proposal-needs_approval",
        decision: "approve",
        reply: "approve aad-rbac and ossku live staging focus",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      project: "aks-rp-e2e",
      reason: "focus-approval-submitted",
      params: {
        approval: {
          planId: "focus-proposal-needs_approval",
          decision: "approve",
          reply: "approve aad-rbac and ossku live staging focus",
        },
      },
    });
  });

  test("focus escalation resolution with project app path wakes owner", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "escalation.resolved",
      source: "telegram",
      owner: "human:operator",
      data: {
        escalationId: "esc_aks_rp_e2e_focus_needs_approval_1",
        projectId: "projects/aks-rp-e2e.app",
        outcome: "answered",
        summary: "approve the live staging focus",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      project: "aks-rp-e2e",
      reason: "escalation-resolved",
      params: {
        projectId: "projects/aks-rp-e2e.app",
        summary: "approve the live staging focus",
      },
    });
  });

  test("project metric breach wakes owner review with metric context", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "metric.breach",
      owner: "agent:aks-explorer",
      data: {
        metricId: "aks-rp-e2e.run.live-idle-with-runnable-work",
        current: 1,
        threshold: 0,
        priority: "P1",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "metric-breach",
      params: {
        metricId: "aks-rp-e2e.run.live-idle-with-runnable-work",
        metric: {
          metricId: "aks-rp-e2e.run.live-idle-with-runnable-work",
          current: 1,
          threshold: 0,
          priority: "P1",
        },
      },
    });
  });

  test("no-work metric breach creates human unblock escalation and wakes owner review", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "metric.breach",
      owner: "agent:aks-explorer",
      data: {
        metricId: "aks-rp-e2e.task.no-work-with-gaps",
        current: 1,
        threshold: 0,
        priority: "P0",
      },
    });

    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toMatchObject({
      type: "escalation.created",
      owner: "human:operator",
      project: "aks-rp-e2e",
      data: {
        projectId: "aks-rp-e2e",
        severity: "P0",
        dedupKey: "aks-rp-e2e:metric:no-work-with-gaps",
      },
    });
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      reason: "metric-breach",
      params: {
        metricId: "aks-rp-e2e.task.no-work-with-gaps",
      },
    });
  });
});
