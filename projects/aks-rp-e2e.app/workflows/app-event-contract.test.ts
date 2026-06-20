import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import app from "../app.ts";

type EmittedEvent = Record<string, unknown>;

function testContext(options?: {
  liveTasks?: Record<string, Record<string, unknown>>;
  archives?: Array<{ file: string; body: Record<string, unknown> }>;
}) {
  const emitted: EmittedEvent[] = [];
  const noops: string[] = [];
  const tempRoot = mkdtempSync(join(tmpdir(), "aks-rp-e2e-app-event-"));
  const tasksDir = join(tempRoot, "tasks");
  const archiveDir = join(tasksDir, "archive");
  mkdirSync(archiveDir, { recursive: true });

  const tree = {
    tasks: {
      "triage-task": { id: "triage-task", state: "blocked" },
      "secops-identity-role-assignment-validation-live-execute-gate-await-20260620": {
        id: "secops-identity-role-assignment-validation-live-execute-gate-await-20260620",
        state: "blocked",
        blocker:
          "External execute authorization required: bounded --check evidence in evidence/archive/secops-identity-role-assignment-validation-check-gated-execute-20260620.md and evidence/archive/run_20260620061622467_r0xkqc-secops-identity-role-assignment-validation.json proved the maintained spec/replay pair is ready.",
      },
      "live-pass-through-task": { id: "live-pass-through-task", state: "blocked" },
      ...(options?.liveTasks ?? {}),
    },
  };

  const archives =
    options?.archives ?? [
      {
        file: "done-leaves-20260620061901509.json",
        body: {
          version: 1,
          tasks: [
            {
              id: "secops-identity-role-assignment-validation-check-gated-execute-20260620",
              status: "done",
              resolution: "completed",
            },
          ],
        },
      },
    ];

  writeFileSync(join(tasksDir, "tree.json"), JSON.stringify(tree, null, 2));
  for (const archive of archives) {
    writeFileSync(
      join(archiveDir, archive.file),
      JSON.stringify(archive.body, null, 2),
    );
  }

  return {
    emitted,
    noops,
    ctx: {
      projectPath: (path: string) => join(tempRoot, path),
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

  test("manifest schedules periodic blocked-frontier owner review", () => {
    const schedule = app.schedules?.find(
      (entry: { id?: string }) => entry.id === "blocked-frontier-owner-review",
    );

    expect(schedule).toMatchObject({
      enabled: true,
      intervalMs: 7_200_000,
      event: {
        type: "project.owner.requested",
        project: "aks-rp-e2e",
        reason: "scheduled-blocked-frontier-review",
        urgency: "high",
      },
    });
    expect(String(schedule?.event?.params?.instruction)).toContain(
      "Periodic blocked-frontier owner review",
    );
    expect(String(schedule?.event?.params?.instruction)).toContain(
      "push sampled blockers toward final state",
    );
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

  test("blocked send-ready source-holder handoff stays owner-visible without problem solver escalation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "vm-prerelease-uninstall-missing-spec-wave-20260619",
        status: "review",
        result: "blocked",
        summary:
          "Wrote evidence/archive/vm-prerelease-uninstall-missing-spec-wave-20260619.md and a send-ready owner handoff packet showing VM prerelease uninstall rows 197-201 are still blocked on missing authoritative uninstall source, then recorded the exact resume condition for source holder follow-up.",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId: "vm-prerelease-uninstall-missing-spec-wave-20260619",
        status: "review",
        task: {
          taskId: "vm-prerelease-uninstall-missing-spec-wave-20260619",
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

  test("blocked owner checkpoint packet in worker mode stays owner-visible without problem solver escalation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId: "networkcni-done-slice-owner-checkpoint-after-routing-20260619",
        status: "review",
        result: "blocked",
        summary:
          "Produced the owner checkpoint packet at projects/aks-rp-e2e/evidence/archive/networkcni-done-slice-owner-checkpoint-after-routing-20260619.md with fresh git/domain:checkpoint evidence confirming the exact 12-file candidate slice and 4 tracked holdouts. I did not create the repo commit hash because aks-rp-e2e worker mode and tasks/README make domain repo commits owner-only.",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId:
          "networkcni-done-slice-owner-checkpoint-after-routing-20260619",
        status: "review",
        task: {
          taskId:
            "networkcni-done-slice-owner-checkpoint-after-routing-20260619",
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

  test("blocked duplicate-family blocker artifact stays owner-visible without problem solver escalation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "project.task.completed",
      project: "aks-rp-e2e",
      data: {
        taskId:
          "artifact-duplicate-cloud-provider-multiple-slb-family-cleanup-20260619",
        status: "review",
        result: "blocked",
        summary:
          "Investigated the cloud-provider-multiple-slb-staging-frontier duplicate family, documented all 24 members plus their model/archive/run references, and concluded no single bounded row-80-style rename can safely move the metric without a broader relink/rebucket decomposition.",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "task-completed",
      params: {
        completedTaskId:
          "artifact-duplicate-cloud-provider-multiple-slb-family-cleanup-20260619",
        status: "review",
        task: {
          taskId:
            "artifact-duplicate-cloud-provider-multiple-slb-family-cleanup-20260619",
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
          problemKey: "aks-rp-e2e:task-problem:triage-me",
          affectedTasks: ["triage-task"],
          taskId: undefined,
          originalProblemKey: "aks-rp-e2e:task-problem:triage-me",
          originalAffectedTasks: ["triage-task"],
          normalization: {
            reason: "live-task-pass-through",
            disposition: "active",
          },
        },
      },
    });
  });

  test("problem owner routing relinks archived task ids to one explicit live successor", async () => {
    const { ctx, emitted, noops } = testContext();

    await app.onEvent(ctx, {
      type: "project.problem.unknown",
      project: "aks-rp-e2e",
      problemKey:
        "aks-rp-e2e:task-problem:secops-identity-role-assignment-validation-check-gated-execute-20260620",
      taskId:
        "secops-identity-role-assignment-validation-check-gated-execute-20260620",
      affectedTasks: [
        "secops-identity-role-assignment-validation-check-gated-execute-20260620",
      ],
      summary: "stale wake",
    });

    expect(noops).toEqual([]);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      reason: "problem-unknown",
      params: {
        problemKey:
          "aks-rp-e2e:task-problem:secops-identity-role-assignment-validation-live-execute-gate-await-20260620",
        problem: {
          problemKey:
            "aks-rp-e2e:task-problem:secops-identity-role-assignment-validation-live-execute-gate-await-20260620",
          originalProblemKey:
            "aks-rp-e2e:task-problem:secops-identity-role-assignment-validation-check-gated-execute-20260620",
          taskId:
            "secops-identity-role-assignment-validation-live-execute-gate-await-20260620",
          affectedTasks: [
            "secops-identity-role-assignment-validation-live-execute-gate-await-20260620",
          ],
          originalTaskId:
            "secops-identity-role-assignment-validation-check-gated-execute-20260620",
          originalAffectedTasks: [
            "secops-identity-role-assignment-validation-check-gated-execute-20260620",
          ],
          normalization: {
            reason: "archived-task-relinked-to-live-successor",
            archiveTaskId:
              "secops-identity-role-assignment-validation-check-gated-execute-20260620",
            liveSuccessorTaskId:
              "secops-identity-role-assignment-validation-live-execute-gate-await-20260620",
            disposition: "active",
          },
        },
      },
    });
  });

  test("problem owner routing retires archived unknown wakes when no live successor remains", async () => {
    const archivedTaskId = "archived-no-successor-task";
    const { ctx, emitted, noops } = testContext({
      archives: [
        {
          file: "done-leaves-test.json",
          body: {
            version: 1,
            tasks: [
              {
                id: archivedTaskId,
                status: "done",
                resolution: "completed",
              },
            ],
          },
        },
      ],
    });

    const result = await app.onEvent(ctx, {
      type: "project.problem.unknown",
      project: "aks-rp-e2e",
      problemKey: `aks-rp-e2e:task-problem:${archivedTaskId}`,
      taskId: archivedTaskId,
      affectedTasks: [archivedTaskId],
      summary: "stale wake without successor",
    });

    expect(emitted).toHaveLength(0);
    expect(noops).toHaveLength(1);
    expect(noops[0]).toContain("retired stale archived problem wake");
    expect(result).toMatchObject({
      type: "noop",
      reason: expect.stringContaining(archivedTaskId),
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

  test("no-work metric breach wakes owner without direct escalation", async () => {
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

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      project: "aks-rp-e2e",
      reason: "metric-breach",
      urgency: "high",
      params: {
        metricId: "aks-rp-e2e.task.no-work-with-gaps",
        metric: {
          metricId: "aks-rp-e2e.task.no-work-with-gaps",
          current: 1,
          threshold: 0,
          priority: "P0",
        },
      },
    });
    expect(
      String((emitted[0].params as Record<string, unknown>).instruction),
    ).toContain("owner-loop reconciliation incident");
    expect(emitted.some((event) => event.type === "escalation.created")).toBe(
      false,
    );
  });

  test("stale-active metric breach wakes owner without direct escalation", async () => {
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

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      project: "aks-rp-e2e",
      reason: "metric-breach",
      urgency: "high",
      params: {
        metricId: "aks-rp-e2e.task.stale-active-with-gaps",
        metric: {
          metricId: "aks-rp-e2e.task.stale-active-with-gaps",
          current: 1,
          threshold: 0,
          priority: "P0",
        },
      },
    });
    expect(
      String((emitted[0].params as Record<string, unknown>).instruction),
    ).toContain("unhealthy worker sessions");
    expect(emitted.some((event) => event.type === "escalation.created")).toBe(
      false,
    );
  });

  test("blocked-count metric breach wakes owner blocked-frontier review without direct escalation", async () => {
    const { ctx, emitted } = testContext();

    await app.onEvent(ctx, {
      type: "metric.breach",
      owner: "agent:aks-explorer",
      data: {
        metricId: "aks-rp-e2e.task.blocked-count",
        current: 64,
        threshold: 5,
        priority: "P1",
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "project.owner.requested",
      project: "aks-rp-e2e",
      reason: "blocked-frontier-review",
      urgency: "high",
      params: {
        metricId: "aks-rp-e2e.task.blocked-count",
        metric: {
          metricId: "aks-rp-e2e.task.blocked-count",
          current: 64,
          threshold: 5,
          priority: "P1",
        },
      },
    });
    expect(
      String((emitted[0].params as Record<string, unknown>).instruction),
    ).toContain("Review the blocked and dependency-waiting task frontier");
    expect(emitted.some((event) => event.type === "escalation.created")).toBe(
      false,
    );
  });
});
