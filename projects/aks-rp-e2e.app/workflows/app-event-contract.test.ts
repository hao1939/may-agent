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
  test("manifest subscribes to project metric and problem-result events", () => {
    expect(app.events).toContainEqual({
      type: "metric.breach",
      project: "aks-rp-e2e",
    });
    expect(app.events).toContainEqual({
      type: "metric.recovered",
      project: "aks-rp-e2e",
    });
    expect(app.events).toContainEqual({
      type: "project.problem.unknown",
      project: "aks-rp-e2e",
    });
  });

  test("task.requeued wakes owner review with task context", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "task.requeued",
      projectId: "aks-rp-e2e",
      taskId: "feature-a-replay",
      state: "backlog",
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
        state: "backlog",
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

  test("blocked checkpoint artifact review stays owner-visible without problem solver escalation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "go-e2ev3-knowledge-map-done-slice-checkpoint-20260617",
        status: "review",
        result: "blocked",
        summary:
          "Wrote the requested checkpoint artifact at evidence/archive/go-e2ev3-knowledge-map-done-slice-checkpoint-20260617.md after auditing the live workspace, running checks from the correct app/domain roots, and determining the VM/WI/localdns knowledge-map repairs cannot be sliced into a trustworthy done-only commit from the current mixed model/spec state.",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId:
          "go-e2ev3-knowledge-map-done-slice-checkpoint-20260617",
        status: "review",
        task: {
          taskId: "go-e2ev3-knowledge-map-done-slice-checkpoint-20260617",
          result: "blocked",
        },
      },
    });
  });

  test("blocked owner-owned checkpoint handoff stays owner-visible without problem solver escalation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId:
          "app-routing-default-domain-tls-owner-checkpoint-commit-20260617",
        status: "review",
        result: "blocked",
        summary:
          "Prepared owner-facing checkpoint evidence for the narrow App Routing default-domain TLS boundary-hardening slice in evidence/archive/app-routing-default-domain-tls-owner-checkpoint-commit-20260617.md, including exact stage set, exact excluded dirty files, and targeted check results. The actual checkpoint commit hash could not be produced because project policy reserves domain repo commits for owner review, so the remaining step is an owner-owned commit.",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId:
          "app-routing-default-domain-tls-owner-checkpoint-commit-20260617",
        status: "review",
        task: {
          taskId:
            "app-routing-default-domain-tls-owner-checkpoint-commit-20260617",
          result: "blocked",
        },
      },
    });
  });

  test("blocked worker-mode owner-review output for live tree metadata repair stays owner-visible", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "row82-live-output-lineage-apply-20260618",
        status: "review",
        result: "blocked",
        summary:
          "Wrote a blocked worker packet at evidence/archive/row82-live-output-lineage-apply-20260618.md documenting the exact live set-outputs commands, fresh checkpoint evidence, and the worker-mode instruction conflict that prevented mutating the live task tree.",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId: "row82-live-output-lineage-apply-20260618",
        status: "review",
        task: {
          taskId: "row82-live-output-lineage-apply-20260618",
          result: "blocked",
        },
      },
    });
  });

  test("blocked wording-only reconcile with unrelated pre-existing validator debt stays owner-visible", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "aad-rbac-reset-model-wording-reconcile-20260618",
        status: "review",
        result: "blocked",
        summary:
          "Reconciled AAD RBAC ResetAAD wording in model/knowledge-map/model.json and regenerated views so managed-v2 and non-AAD rows now state the exact preview-empty HTTP 400 baseline and stable-empty rerun ordering/gates. Acceptance remains blocked because the repo-wide knowledge-map validator still fails on many unrelated pre-existing model issues outside the AAD RBAC scope.",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId: "aad-rbac-reset-model-wording-reconcile-20260618",
        status: "review",
        task: {
          taskId: "aad-rbac-reset-model-wording-reconcile-20260618",
          result: "blocked",
        },
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

  test("problem solver resolved results wake the owner for tree reconciliation", async () => {
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

  test("problem solver unknown results wake the owner for tree reconciliation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.problem.unknown",
      project: "aks-rp-e2e",
      problemKey: "aks-rp-e2e:task-problem:triage-me",
      affectedTasks: ["triage-task"],
      summary: "error",
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "problem-unknown",
      params: {
        problemKey: "aks-rp-e2e:task-problem:triage-me",
        problem: {
          summary: "error",
          affectedTasks: ["triage-task"],
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

  test("stale-active metric breach creates human unblock escalation and wakes owner review", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "metric.breach",
      owner: "agent:aks-explorer",
      data: {
        metricId: "aks-rp-e2e.task.stale-active-with-gaps",
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
        blockedOn: "metric breach aks-rp-e2e.task.stale-active-with-gaps",
        dedupKey: "aks-rp-e2e:metric:stale-active-with-gaps",
      },
    });
    expect(emitted[1]).toMatchObject({
      type: "project.owner.requested",
      reason: "metric-breach",
      params: {
        metricId: "aks-rp-e2e.task.stale-active-with-gaps",
      },
    });
  });
});
