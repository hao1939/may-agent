import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import app, {
  masterValidationScheduleGate,
  malformedApprovalWaitContract,
  malformedRepoRefWaitContract,
  resolveAksTask,
  routeAksEvent,
  scenarioTestFrontierWakeEvent,
  waitingFrontierReviewTaskId,
} from "../../../app.ts";
import { repositorySkillMaintenanceTaskId } from "../../../task-loops.ts";

type EventSelector =
  | string
  | {
      type?: string;
      target?: Record<string, unknown>;
      project?: string;
      owner?: string;
      actions?: string[];
    };

type ProjectAction = {
  event?: (params?: unknown) => Record<string, unknown>;
};

type Schedule = {
  id?: string;
  enabled?: boolean;
  intervalMs?: number;
  emits?: Array<Record<string, unknown>>;
};

type AppManifest = {
  tasks?: {
    accepts?: EventSelector[];
    resolve?: (event: Record<string, unknown>) => unknown;
  };
  events?: EventSelector[];
  schedules?: Schedule[];
  actions?: Record<string, ProjectAction>;
  onEvent?: unknown;
};

const projectId = "aks-rp-e2e";
const appManifest = app as AppManifest;

function taskSelectors(): EventSelector[] {
  return Array.isArray(appManifest.tasks?.accepts)
    ? appManifest.tasks.accepts
    : [];
}

function eventTarget(event: Record<string, unknown>): Record<string, unknown> {
  return event.target && typeof event.target === "object"
    ? (event.target as Record<string, unknown>)
    : {};
}

function selectorMatchesEvent(
  selector: EventSelector,
  event: Record<string, unknown>,
): boolean {
  if (typeof selector === "string") return event.type === selector;
  if (selector.type !== event.type) return false;

  const selectorProject = selector.target?.project ?? selector.project;
  if (
    typeof selectorProject === "string" &&
    eventTarget(event).project !== selectorProject
  ) {
    return false;
  }

  const selectorTaskId = selector.target?.taskId;
  if (
    typeof selectorTaskId === "string" &&
    eventTarget(event).taskId !== selectorTaskId
  ) {
    return false;
  }

  if (typeof selector.owner === "string" && event.owner !== selector.owner) {
    return false;
  }

  if (selector.actions?.length) {
    return (
      typeof event.action === "string" &&
      selector.actions.includes(event.action)
    );
  }

  return true;
}

function eventIsHandled(event: Record<string, unknown>): boolean {
  return (
    taskSelectors().some((selector) => selectorMatchesEvent(selector, event)) ||
    (appManifest.events ?? []).some((selector) =>
      selectorMatchesEvent(selector, event),
    )
  );
}

function actionEvent(
  actionName: string,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  const action = appManifest.actions?.[actionName];
  if (!action?.event) throw new Error(`Missing event action ${actionName}`);
  return action.event(params);
}

function scheduleEvents(scheduleId: string): Record<string, unknown>[] {
  const schedule = appManifest.schedules?.find(
    (entry) => entry.id === scheduleId,
  );
  return Array.isArray(schedule?.emits) ? schedule.emits : [];
}

function selectorTypes(): string[] {
  return taskSelectors()
    .map((selector) =>
      typeof selector === "string" ? selector : selector.type,
    )
    .filter((type): type is string => Boolean(type));
}

describe("app event contract", () => {
  test("keeps reusable workflows under their accountable agent", () => {
    expect(existsSync(resolve(import.meta.dir, "../../../workflows"))).toBe(
      false,
    );
  });

  test("uses the current task resolver contract", () => {
    expect(appManifest.tasks?.accepts).toBeArray();
    expect(appManifest.tasks?.resolve).toBeFunction();
    expect(appManifest.onEvent).toBeFunction();
    expect(appManifest).not.toHaveProperty("workflowHandlers");
    expect(appManifest).not.toHaveProperty("taskRoutes");
    expect(appManifest).not.toHaveProperty("taskWorkflows");
    expect(appManifest).not.toHaveProperty("eventGraph");
  });

  test("every manifest-produced event is resolver-handled or a direct task wake", () => {
    const failures: string[] = [];

    for (const schedule of appManifest.schedules ?? []) {
      if (schedule.enabled === false) continue;
      for (const event of schedule.emits ?? []) {
        if (!eventIsHandled(event)) {
          failures.push(
            `schedule ${schedule.id ?? "(unnamed)"} emits unhandled ${String(event.type)}`,
          );
        }
      }
    }

    for (const [name, action] of Object.entries(appManifest.actions ?? {})) {
      if (!action.event) continue;
      const event = action.event({ taskId: "loop-a" });
      if (!eventIsHandled(event)) {
        failures.push(`action ${name} emits unhandled ${String(event.type)}`);
      }
    }

    expect(failures).toEqual([]);
  });

  test("semantic project events are accepted by the task resolver", () => {
    expect(selectorTypes()).toEqual(
      expect.arrayContaining([
        "project.owner.requested",
        "project.task.tick",
        "project.comment.created",
        "project.approval.submitted",
        "project.test_run.completed",
        "project.stall.reviewed",
        "project.problem.investigation.requested",
        "project.problem.resolved",
        "project.problem.escalated",
        "project.problem.inconclusive",
        "project.stall.review.requested",
        "project.approval.requested",
        "coverage.gap.detected",
        "metric.breach",
        "metric.recovered",
        "learning.feedback",
        "escalation.resolved",
        "escalation.dismissed",
      ]),
    );
  });

  test("routes actionable stall reviews to a visible app-ops follow-up", () => {
    const task = resolveAksTask({
      type: "project.stall.reviewed",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "manual-stall-risk-review-after-loop-summary-fix",
        judgment: "needs-work",
        stallReview: {
          judgment: "needs-work",
          rootCause: "stale holder representation",
          nextProjectMove: "open an app-owned repair",
        },
      },
    });

    expect(task).toMatchObject({
      id: "runtime/stall-review-followup/needs-work-manual-stall-risk-review-after-loop-summary-fix",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      priority: "P0",
      input: {
        judgment: "needs-work",
        reason: "manual-stall-risk-review-after-loop-summary-fix",
      },
    });
    expect(task?.id).not.toBe("runtime/owner-review");
    expect(task?.acceptance?.join("\n")).toContain(
      "Do not treat receipts, archived done leaves, or completed repair evidence as live coverage",
    );
  });

  test("keeps deterministic pipeline observation outside the task graph", () => {
    const event = {
      type: "aks.pipeline.check",
      target: { project: projectId },
    };
    expect(resolveAksTask(event)).toBeNull();
    expect(eventIsHandled(event)).toBe(true);
  });

  test("turns an origin main advance into one targeted validation wake", async () => {
    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "aks.repo-ref.changed",
        target: { project: projectId },
        data: {
          project: projectId,
          repoRef: "origin/main",
          previousCommit: "old-main",
          commit: "new-main",
        },
      },
    );

    expect(result).toEqual({
      masterValidationWake: true,
      repoRef: "origin/main",
      commit: "new-main",
    });
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "project.task.tick",
        action: "master-validation-cycle",
        target: {
          project: projectId,
          taskId: "master-validation-staging-cycle",
        },
        data: expect.objectContaining({
          reason: "master-validation-main-advanced",
          commit: "new-main",
        }),
      }),
    ]);
  });

  test("continues a productive waiting-frontier review from structured actions", async () => {
    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        appPath: () => resolve(import.meta.dir, "../../.."),
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "project.task.reconciled",
        target: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
        },
        data: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
          disposition: "converged",
          actionsApplied: ["unblocked stale-wait"],
        },
      },
    );

    expect(result).toMatchObject({
      waitingFrontierContinuation: true,
    });
    expect(emitted).toContainEqual({
      type: "project.task.tick",
      source: "aks-rp-e2e-app",
      target: {
        project: projectId,
        taskId: waitingFrontierReviewTaskId,
      },
      urgency: "high",
      action: "waiting-frontier-review",
      data: {
        project: projectId,
        taskId: waitingFrontierReviewTaskId,
        task_id: waitingFrontierReviewTaskId,
        reason: "continue-after-applied-recovery-actions",
      },
    });
  });

  test("stops waiting-frontier continuation when the agent applied no actions", async () => {
    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        appPath: () => resolve(import.meta.dir, "../../.."),
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "project.task.reconciled",
        target: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
        },
        data: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
          disposition: "converged",
          actionsApplied: [],
        },
      },
    );

    expect(result).toMatchObject({
      waitingFrontierContinuation: false,
    });
    expect(emitted).toEqual([]);
  });

  test("replays repo-ref owner handoffs through an exact same-task tick", async () => {
    const emitted: Record<string, unknown>[] = [];
    const taskId =
      "wait-compact-ccp-metricsserver-reviewed-exception-origin-dev-advance-c17c6450-20260724";
    const result = await routeAksEvent(
      {
        appPath: () => resolve(import.meta.dir, "../../.."),
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "project.task.reconciled",
        target: {
          project: projectId,
          taskId,
        },
        data: {
          project: projectId,
          taskId,
          disposition: "owner-handoff",
          handler: "workflow:wait-for-repo-ref-advance",
          summary:
            "origin/dev advanced beyond the baseline and the same task now needs owner judgment.",
        },
      },
    );

    expect(result).toMatchObject({
      repoRefOwnerHandoffReplay: true,
    });
    expect(emitted).toContainEqual({
      type: "project.task.tick",
      source: "aks-rp-e2e-app",
      target: {
        project: projectId,
        taskId,
      },
      urgency: "high",
      action: "repo-ref-owner-handoff-replay",
      data: {
        project: projectId,
        taskId,
        task_id: taskId,
        reason: "repo-ref-wait-owner-handoff",
        previousDisposition: "owner-handoff",
        previousHandler: "workflow:wait-for-repo-ref-advance",
      },
    });
  });

  test("replays malformed repo-ref waits after a later repo observation would otherwise leave them asleep", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-wait-contract-"));
    const taskId =
      "hold-compact-node-ephemeral-os-disk-explicit-resourcedisk-public-create-omission-20260720";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            version: 2,
            project: projectId,
            resources: {
              [taskId]: {
                metadata: { id: taskId, generation: 5, resourceVersion: 355 },
                spec: {
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "0565d5f3039041384b4ad4afc679883150851fff",
                    specId: "spec.node-ephemeral-disk.resource-placement",
                  },
                },
                status: {
                  phase: "waiting",
                  conditionIds: [
                    "origin-dev-advance-node-ephemeral-resource-placement-0565d5f303",
                  ],
                },
              },
            },
            conditions: {
              "origin-dev-advance-node-ephemeral-resource-placement-0565d5f303":
                {
                  spec: {
                    type: "aks.repo-ref.observed",
                    subject: "project:aks-rp-e2e",
                    expected: {
                      project: projectId,
                      repoRef: "origin/dev",
                      changed: true,
                      commit: {
                        notEquals: "0565d5f3039041384b4ad4afc679883150851fff",
                      },
                    },
                  },
                },
            },
          },
          null,
          2,
        ),
      );

      expect(malformedRepoRefWaitContract(appDir, taskId)).toMatchObject({
        taskId,
        conditionId:
          "origin-dev-advance-node-ephemeral-resource-placement-0565d5f303",
        repoRef: "origin/dev",
        baselineCommit: "0565d5f3039041384b4ad4afc679883150851fff",
        issues: expect.arrayContaining([
          'subject="project:aks-rp-e2e"',
          "expected.field=null",
          "expected.notEquals=null",
        ]),
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.repo-ref.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            repoRef: "origin/dev",
            commit: "07a4f2f4ef890879943ee3d9c6d9ec2ee417114d",
            previousCommit: "0565d5f3039041384b4ad4afc679883150851fff",
            changed: true,
          },
        },
      );

      expect(result).toMatchObject({
        observed: true,
        repoRef: "origin/dev",
        commit: "07a4f2f4ef890879943ee3d9c6d9ec2ee417114d",
        malformedRepoRefWaitReplay: true,
        malformedRepoRefWaitProblems: [
          {
            taskId,
            conditionId:
              "origin-dev-advance-node-ephemeral-resource-placement-0565d5f303",
          },
        ],
      });
      expect(emitted).toContainEqual({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId },
        urgency: "high",
        action: "repo-ref-wait-contract-replay",
        data: {
          project: projectId,
          taskId,
          task_id: taskId,
          reason: "malformed-repo-ref-wait-contract",
          repoRef: "origin/dev",
          commit: "07a4f2f4ef890879943ee3d9c6d9ec2ee417114d",
          baselineCommit: "0565d5f3039041384b4ad4afc679883150851fff",
          conditionId:
            "origin-dev-advance-node-ephemeral-resource-placement-0565d5f303",
          issues: [
            'subject="project:aks-rp-e2e"',
            "expected.field=null",
            "expected.notEquals=null",
          ],
          workflow: "wait-for-repo-ref-advance",
        },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("does not replay canonical repo-ref waits because the generic condition tracker already owns them", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-wait-canonical-"));
    const taskId =
      "wait-spec-network-swift-v1-vnetscale-dual-stack-basic-datapath-origin-dev-timeout-carrier-advance-0565d5f3-20260725";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            version: 2,
            project: projectId,
            resources: {
              [taskId]: {
                metadata: { id: taskId, generation: 1, resourceVersion: 1 },
                spec: {
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "0565d5f3039041384b4ad4afc679883150851fff",
                    specId:
                      "spec.network-swift-v1.vnetscale-dual-stack-basic-datapath",
                  },
                },
                status: {
                  phase: "waiting",
                  conditionIds: ["repo-ref-advance-abc123"],
                },
              },
            },
            conditions: {
              "repo-ref-advance-abc123": {
                spec: {
                  type: "aks.repo-ref.observed",
                  subject: "repoRef:origin/dev",
                  expected: {
                    field: "commit",
                    notEquals: "0565d5f3039041384b4ad4afc679883150851fff",
                  },
                },
              },
            },
          },
          null,
          2,
        ),
      );

      expect(malformedRepoRefWaitContract(appDir, taskId)).toBeNull();
      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.repo-ref.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            repoRef: "origin/dev",
            commit: "07a4f2f4ef890879943ee3d9c6d9ec2ee417114d",
            previousCommit: "0565d5f3039041384b4ad4afc679883150851fff",
            changed: true,
          },
        },
      );

      expect(result).toMatchObject({
        observed: true,
        malformedRepoRefWaitReplay: false,
        malformedRepoRefWaitProblems: [],
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("replays malformed approval-return waits to owner judgment instead of leaving them asleep", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "approval-wait-contract-"));
    const taskId =
      "domain/normalize-plain-scenario-carrier-kms-etcd-encryption-tests-kms-v2plus-enable-cmk-from-v2-vnet-integration.ts";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            version: 2,
            project: projectId,
            resources: {
              [taskId]: {
                metadata: { id: taskId, generation: 1, resourceVersion: 1 },
                spec: {
                  owner: "aks-explorer",
                  workflow: "spec-live-reconciliation",
                },
                status: {
                  phase: "waiting",
                  conditionIds: [
                    "project-approval-submitted-kms-v2plus-enable-cmk-from-v2-vnet-integration-secret-migration-20260724",
                  ],
                },
              },
            },
            conditions: {
              "project-approval-submitted-kms-v2plus-enable-cmk-from-v2-vnet-integration-secret-migration-20260724":
                {
                  spec: {
                    type: "project.approval.submitted",
                    subject: "project:aks-rp-e2e",
                    expected: {
                      approvalId:
                        "aks-rp-e2e:approval:path.kms.v2plus-enable-cmk-from-v2-vnet-integration.secret-migration-owner-20260724:evidence-archive-ops-send-kms-v2plus-enable-cmk-from-v2-vnet-integration-secret-migration-owner-ask-20260724.md",
                      waitId:
                        "wait:aks-rp-e2e:approval:path.kms.v2plus-enable-cmk-from-v2-vnet-integration.secret-migration-owner-20260724:evidence-archive-ops-send-kms-v2plus-enable-cmk-from-v2-vnet-integration-secret-migration-owner-ask-20260724.md",
                      pathId:
                        "path.kms.v2plus-enable-cmk-from-v2-vnet-integration.secret-migration-owner-20260724",
                      decisionIn: [
                        "approve",
                        "adjust",
                        "hold",
                        "decline",
                        "reroute",
                      ],
                    },
                  },
                },
            },
          },
          null,
          2,
        ),
      );

      expect(malformedApprovalWaitContract(appDir, taskId)).toMatchObject({
        taskId,
        conditionId:
          "project-approval-submitted-kms-v2plus-enable-cmk-from-v2-vnet-integration-secret-migration-20260724",
        issues: expect.arrayContaining([
          "approvalKind=null",
          "acceptedDecisions=null",
        ]),
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "project.task.reconciled",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            taskId,
            disposition: "waiting",
          },
        },
      );

      expect(result).toMatchObject({
        malformedApprovalWaitReplay: true,
        malformedApprovalWaitProblem: {
          taskId,
          conditionId:
            "project-approval-submitted-kms-v2plus-enable-cmk-from-v2-vnet-integration-secret-migration-20260724",
        },
      });
      expect(emitted).toContainEqual({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId },
        urgency: "high",
        action: "approval-wait-contract-replay",
        data: {
          project: projectId,
          taskId,
          task_id: taskId,
          reason: "malformed-approval-wait-contract",
          conditionId:
            "project-approval-submitted-kms-v2plus-enable-cmk-from-v2-vnet-integration-secret-migration-20260724",
          issues: ["approvalKind=null", "acceptedDecisions=null"],
          workflow: "spec-live-reconciliation",
        },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("does not replay focus-plan approval waits that use a different approval kind", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "focus-approval-contract-"));
    const taskId = "aks-focus-plan-progress-review";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            version: 2,
            project: projectId,
            resources: {
              [taskId]: {
                metadata: { id: taskId, generation: 1, resourceVersion: 1 },
                spec: { owner: "app-ops", workflow: "focus-plan" },
                status: {
                  phase: "waiting",
                  conditionIds: ["focus-approval"],
                },
              },
            },
            conditions: {
              "focus-approval": {
                spec: {
                  type: "project.approval.submitted",
                  subject: "project:aks-rp-e2e",
                  expected: {
                    approvalKind: "focus-plan",
                    planId: "focus-current",
                    approvalId: "focus-approval-id",
                    waitId: "focus-wait-id",
                    pathId: "focus-path-id",
                  },
                },
              },
            },
          },
          null,
          2,
        ),
      );

      expect(malformedApprovalWaitContract(appDir, taskId)).toBeNull();
      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "project.task.reconciled",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            taskId,
            disposition: "waiting",
          },
        },
      );

      expect(result).toMatchObject({
        malformedApprovalWaitReplay: false,
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("turns one overdue pipeline fact into an operator message without a task", async () => {
    const event = {
      type: "pipeline.queue.overdue",
      target: { project: projectId },
      data: {
        pipelineRunId: "173408245",
        queueTime: "2026-07-23T01:22:57Z",
      },
    };
    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      event,
    );

    expect(resolveAksTask(event)).toBeNull();
    expect(eventIsHandled(event)).toBe(true);
    expect(result).toEqual({
      operatorNotified: true,
      pipelineRunId: "173408245",
    });
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        intent: "master-validation-queue-overdue",
        pipelineRunId: "173408245",
        content: expect.stringContaining("did not cancel or duplicate"),
      }),
    );
  });

  test("resolver maps semantic events to stable domain tasks", () => {
    const ownerA = resolveAksTask({
      type: "project.owner.requested",
      target: { project: projectId },
      eventId: 101,
    });
    const ownerB = resolveAksTask({
      type: "project.owner.requested",
      target: { project: projectId },
      eventId: 102,
    });
    expect(ownerA).toMatchObject({
      id: "runtime/owner-review",
      mode: "maintain",
      owner: "app-ops",
    });
    expect(ownerB?.id).toBe(ownerA?.id);
    expect(ownerA?.workflow).toBeUndefined();
    expect(ownerA?.input).toBeUndefined();
    expect(ownerB?.input).toBeUndefined();

    const earlyFailure = {
      type: "pipeline.test.nonpassing",
      target: { project: projectId },
      data: {
        pipelineRunId: "173790426",
        specId: "spec.example",
        status: "fail",
      },
    };
    expect(resolveAksTask(earlyFailure)).toMatchObject({
      id: "runtime/owner-review",
      mode: "maintain",
      owner: "app-ops",
    });
    expect(eventIsHandled(earlyFailure)).toBe(true);

    expect(
      resolveAksTask({
        type: "project.task.tick",
        action: "spec-loop",
        target: { project: projectId, taskId: "aks-spec-verification-loop" },
      }),
    ).toMatchObject({
      id: "aks-spec-verification-loop",
      parentId: "group/spec-verification",
      owner: "app-ops",
      workflow: "spec-loop-controller",
    });
    expect(
      resolveAksTask({
        type: "project.task.tick",
        action: "feature-compact-loop",
        target: { project: projectId, taskId: "aks-feature-compact-loop" },
      }),
    ).toMatchObject({
      id: "aks-feature-compact-loop",
      parentId: "group/feature-compact",
      owner: "app-ops",
      workflow: "feature-compact-loop-controller",
    });
    expect(
      resolveAksTask({
        type: "project.task.tick",
        target: {
          project: projectId,
          taskId: "scenario-normalization",
        },
      }),
    ).toMatchObject({
      id: "scenario-normalization",
      parentId: "group/scenario-normalization",
      owner: "aks-explorer",
      workflow: "normalize-scenario-frontier",
      mode: "maintain",
    });
    expect(
      resolveAksTask({
        type: "project.problem.investigation.requested",
        target: { project: projectId },
        problemKey: "staging-auth",
      })?.workflow,
    ).toBe("problem-solver");
    const problemA = resolveAksTask({
      type: "project.problem.investigation.requested",
      target: { project: projectId },
      problemKey: "staging-auth",
      eventId: 201,
    });
    const problemB = resolveAksTask({
      type: "project.problem.investigation.requested",
      target: { project: projectId },
      problemKey: "staging-auth",
      eventId: 202,
    });
    expect(problemA?.input).toEqual(problemB?.input);
    expect(
      resolveAksTask({
        type: "project.focus.review.requested",
        target: { project: projectId },
      }),
    ).toBeNull();
    expect(
      resolveAksTask({
        type: "project.approval.requested",
        target: { project: projectId },
        pathId: "network/cilium",
      })?.workflow,
    ).toBe("approval-dispatch");
    expect(
      resolveAksTask({
        type: "project.approval.requested",
        target: { project: projectId },
        reason: "manual-approval-packet-dispatch-request",
        params: {
          packetPath: "evidence/archive/network-cni-approval-packet.md",
          pathId: "path.network-cni-azure-overlay-dual-stack-migration",
          requestedAction: "Approve one bounded live execution",
          summary: "Preserve the exact approval tuple on the runtime task.",
          target: "human:operator",
          approvalId:
            "aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
          waitId:
            "wait:aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
        },
      }),
    ).toMatchObject({
      workflow: "approval-dispatch",
      input: {
        approvalId:
          "aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
        packetPath: "evidence/archive/network-cni-approval-packet.md",
        pathId: "path.network-cni-azure-overlay-dual-stack-migration",
        reason: "manual-approval-packet-dispatch-request",
        requestedAction: "Approve one bounded live execution",
        summary: "Preserve the exact approval tuple on the runtime task.",
        waitId:
          "wait:aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
      },
    });
  });

  test("durable-loop schedule emits direct targeted task wakes", () => {
    expect(scheduleEvents("durable-loop-pulse")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project.task.tick",
          action: "spec-loop",
          target: { project: projectId, taskId: "aks-spec-verification-loop" },
        }),
        expect.objectContaining({
          type: "project.task.tick",
          action: "feature-compact-loop",
          target: { project: projectId, taskId: "aks-feature-compact-loop" },
        }),
      ]),
    );
  });

  test("repository skill maintenance has one daily stable task wake", () => {
    const schedule = appManifest.schedules?.find(
      (entry) => entry.id === "repository-skill-maintenance",
    );

    expect(schedule).toMatchObject({
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        {
          type: "project.task.tick",
          action: "repository-skill-maintenance",
          target: {
            project: projectId,
            taskId: repositorySkillMaintenanceTaskId,
          },
        },
      ],
    });
    expect(
      resolveAksTask(schedule?.emits?.[0] as Record<string, unknown>),
    ).toMatchObject({
      id: repositorySkillMaintenanceTaskId,
      parentId: "group/domain-work",
      mode: "maintain",
      owner: "aks-explorer",
      workflow: "domain-task-execution",
    });
  });

  test("master validation schedules a level check instead of a direct task tick", () => {
    const schedule = appManifest.schedules?.find(
      (entry) => entry.id === "master-validation-staging-cycle",
    );
    expect(schedule?.intervalMs).toBe(300_000);
    expect(scheduleEvents("master-validation-staging-cycle")).toEqual([
      expect.objectContaining({
        type: "aks.master-validation.check",
        target: { project: projectId },
      }),
    ]);
    expect(
      resolveAksTask({
        type: "project.task.tick",
        action: "master-validation-cycle",
        target: {
          project: projectId,
          taskId: "master-validation-staging-cycle",
        },
        data: {
          project: projectId,
          taskId: "master-validation-staging-cycle",
          reason: "scheduled-six-hour-master-validation",
        },
      }),
    ).toMatchObject({ input: { intervalMs: 21_600_000 } });
  });

  test("master validation gate stays asleep until the six-hour receipt window elapses", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "master-validation-gate-"));
    const queuedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    try {
      mkdirSync(resolve(appDir, ".state"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/master-validation-cycle.json"),
        JSON.stringify({
          runId: "173596985",
          sourceCommit: "b6ed0123763895f4584db2e3337145998e44b009",
          queuedAt,
        }),
      );

      expect(masterValidationScheduleGate(appDir)).toMatchObject({
        due: false,
        reason: "cooldown-active",
        runId: "173596985",
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.master-validation.check",
          target: { project: projectId },
        },
      );

      expect(result).toEqual({
        masterValidationWake: false,
        reason: "cooldown-active",
        queuedAt,
        runId: "173596985",
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("an active frozen campaign reconciles on the five-minute pulse", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "master-validation-campaign-gate-"),
    );
    try {
      mkdirSync(resolve(appDir, ".state"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/master-validation-campaign.json"),
        JSON.stringify({
          schemaVersion: "1",
          baselineRunId: "173646937",
          baseCommit: "main123",
          branch: "validation/master-validation-173646937",
          currentCommit: "candidate123",
          integratedFixes: [],
          updatedAt: new Date().toISOString(),
        }),
      );
      expect(masterValidationScheduleGate(appDir)).toEqual({
        due: true,
        reason: "campaign-active",
      });

      const emitted: Record<string, unknown>[] = [];
      await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.master-validation.check",
          target: { project: projectId },
        },
      );
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        type: "project.task.tick",
        data: { reason: "master-validation-campaign-reconcile" },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("an exact campaign spec pass overrides the aggregate wait to publish its PR immediately", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "master-validation-fix-ready-"));
    try {
      mkdirSync(resolve(appDir, ".state"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/master-validation-campaign.json"),
        JSON.stringify({
          schemaVersion: "1",
          baselineRunId: "173646937",
          baseCommit: "main123",
          branch: "validation/master-validation-173646937",
          currentCommit: "candidate123",
          integratedFixes: [
            {
              pullRequestId: "16568861",
              taskId:
                "domain/master-validation-failure/spec.node-ephemeral-disk.master-validation/fingerprint",
              sourceBranch: "task/node-ephemeral",
              sourceCommit: "fix123",
              title: "Fix node ephemeral master validation",
            },
          ],
          updatedAt: new Date().toISOString(),
        }),
      );
      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "pipeline.spec.observed",
          target: { project: projectId },
          data: {
            specId: "spec.node-ephemeral-disk.master-validation",
            status: "pass",
            pipelineRunId: "173761466",
            sourceBranch: "refs/heads/validation/master-validation-173646937",
            sourceCommit: "candidate123",
          },
        },
      );

      expect(result).toEqual({
        masterValidationFixReadyWake: true,
        pullRequestIds: ["16568861"],
      });
      expect(emitted).toEqual([
        expect.objectContaining({
          type: "project.task.tick",
          overrideWait: true,
          target: {
            project: projectId,
            taskId: "master-validation-staging-cycle",
          },
          data: expect.objectContaining({
            reason: "master-validation-fix-verified",
            overrideWait: true,
            pullRequestIds: ["16568861"],
          }),
        }),
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("master validation gate emits a targeted wake after the receipt interval elapses", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "master-validation-gate-due-"));
    const queuedAt = new Date(
      Date.now() - (6 * 60 * 60_000 + 5 * 60_000),
    ).toISOString();
    try {
      mkdirSync(resolve(appDir, ".state"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/master-validation-cycle.json"),
        JSON.stringify({
          runId: "173596985",
          sourceCommit: "b6ed0123763895f4584db2e3337145998e44b009",
          queuedAt,
        }),
      );

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.master-validation.check",
          target: { project: projectId },
        },
      );

      expect(result).toEqual({
        masterValidationWake: true,
        reason: "interval-elapsed",
        queuedAt,
        runId: "173596985",
      });
      expect(emitted).toEqual([
        expect.objectContaining({
          type: "project.task.tick",
          action: "master-validation-cycle",
          target: {
            project: projectId,
            taskId: "master-validation-staging-cycle",
          },
          data: expect.objectContaining({
            reason: "scheduled-six-hour-master-validation",
            cycleSlot: expect.any(Number),
          }),
        }),
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("manual actions emit explicit target events", () => {
    expect(appManifest.actions).not.toHaveProperty("request-focus-plan");
    expect(appManifest.actions).not.toHaveProperty("review-focus-progress");
    expect(
      appManifest.schedules?.filter((schedule) =>
        ["focus-plan-proposal", "focus-progress-review"].includes(
          schedule.id ?? "",
        ),
      ),
    ).toEqual([
      expect.objectContaining({ id: "focus-plan-proposal", enabled: false }),
      expect.objectContaining({ id: "focus-progress-review", enabled: false }),
    ]);

    expect(
      actionEvent("investigate-problem", { problemKey: "staging-auth" }),
    ).toMatchObject({
      type: "project.problem.investigation.requested",
      target: { project: projectId },
    });

    expect(
      actionEvent("review-stall-risk", { taskId: "task-a" }),
    ).toMatchObject({
      type: "project.stall.review.requested",
      target: { project: projectId },
    });

    expect(actionEvent("dispatch-approval-packet")).toMatchObject({
      type: "project.approval.requested",
      target: { project: projectId },
    });

    expect(actionEvent("pulse-spec-loop", { taskId: "loop-a" })).toMatchObject({
      type: "project.task.tick",
      action: "spec-loop",
      target: { project: projectId, taskId: "loop-a" },
    });

    expect(
      actionEvent("pulse-feature-compact-loop", { taskId: "loop-c" }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "feature-compact-loop",
      target: { project: projectId, taskId: "loop-c" },
    });

    expect(actionEvent("pulse-scenario-frontier")).toMatchObject({
      type: "project.task.tick",
      target: {
        project: projectId,
        taskId: "scenario-normalization",
      },
      data: {
        project: projectId,
        reason: "manual-scenario-frontier-pulse",
        desiredRunnableLeaves: { min: 3, max: 5 },
      },
    });

    expect(actionEvent("pulse-repository-skill-maintenance")).toMatchObject({
      type: "project.task.tick",
      action: "repository-skill-maintenance",
      target: {
        project: projectId,
        taskId: repositorySkillMaintenanceTaskId,
      },
    });
  });

  test("supports multiple loop task instances", () => {
    expect(
      actionEvent("pulse-spec-loop", { taskId: "spec-loop-a" }),
    ).toMatchObject({
      target: { taskId: "spec-loop-a" },
    });
    expect(
      actionEvent("pulse-spec-loop", { taskId: "spec-loop-b" }),
    ).toMatchObject({
      target: { taskId: "spec-loop-b" },
    });
  });

  test("routes app-ops workflows to the app-ops workflow directory", () => {
    const cases = [
      {
        type: "project.problem.investigation.requested",
        target: { project: projectId },
        problemKey: "quota",
        expectedWorkflow: "problem-solver",
      },
      {
        type: "project.stall.review.requested",
        target: { project: projectId },
        expectedWorkflow: "project-stall-review",
      },
      {
        type: "project.approval.requested",
        target: { project: projectId },
        approvalId: "approval-1",
        expectedWorkflow: "approval-dispatch",
      },
    ];

    for (const event of cases) {
      expect(resolveAksTask(event)).toMatchObject({
        parentId: "group/app-operations",
        owner: "app-ops",
        workflow: event.expectedWorkflow,
      });
    }
  });

  test("routes scenario frontier workflow to the domain owner", () => {
    expect(
      resolveAksTask({
        type: "project.task.tick",
        target: {
          project: projectId,
          taskId: "scenario-normalization",
        },
      }),
    ).toMatchObject({
      owner: "aks-explorer",
      workflow: "normalize-scenario-frontier",
    });
  });

  test("waiting-frontier review has an independent scheduled task lane", () => {
    const schedule = appManifest.schedules?.find(
      (entry) => entry.id === "blocked-frontier-app-ops-review",
    );

    expect(schedule).toMatchObject({
      enabled: true,
      intervalMs: 1_800_000,
      emits: [
        {
          type: "project.task.tick",
          target: {
            project: projectId,
            taskId: waitingFrontierReviewTaskId,
          },
          action: "waiting-frontier-review",
          data: {
            project: projectId,
            taskId: waitingFrontierReviewTaskId,
            reason: "scheduled-blocked-frontier-review",
          },
          urgency: "high",
        },
      ],
    });

    const resolved = resolveAksTask(
      schedule?.emits?.[0] as Record<string, unknown>,
    );
    expect(resolved).toMatchObject({
      id: waitingFrontierReviewTaskId,
      parentId: "group/app-operations",
      mode: "maintain",
      owner: "app-ops",
      priority: "P0",
      category: "ops",
    });
    expect(resolved?.input?.maxConcurrent).toBe(5);
    expect(
      Array.isArray(resolved?.input?.instructions) &&
        resolved.input.instructions.some(
          (entry) =>
            typeof entry === "string" &&
            /preserve owner=aks-explorer/i.test(entry),
        ),
    ).toBe(true);
    expect(
      Array.isArray(resolved?.input?.instructions) &&
        resolved.input.instructions.some(
          (entry) =>
            typeof entry === "string" &&
            /future main-branch spec pass is not a valid producer/i.test(entry),
        ),
    ).toBe(true);
    expect(
      Array.isArray(resolved?.input?.instructions) &&
        resolved.input.instructions.some(
          (entry) =>
            typeof entry === "string" &&
            /true Condition is already level-triggered ready work/i.test(
              entry,
            ) &&
            /generic task controller owns/i.test(entry),
        ),
    ).toBe(true);
    expect(
      Array.isArray(resolved?.acceptance) &&
        resolved.acceptance.some(
          (entry) =>
            typeof entry === "string" &&
            /do not retry or unblock/i.test(entry) &&
            /Condition is satisfied/i.test(entry),
        ),
    ).toBe(true);
    expect(
      Array.isArray(resolved?.acceptance) &&
        resolved.acceptance.some(
          (entry) =>
            typeof entry === "string" &&
            /read current task state and hot external facts/i.test(entry),
        ),
    ).toBe(true);
  });

  test("strict inventory wakes its domain frontier without owner-review indirection", () => {
    const schedule = appManifest.schedules?.find(
      (entry) => entry.id === "scenario-test-frontier-observer",
    );

    expect(schedule).toMatchObject({
      enabled: true,
      intervalMs: 1_800_000,
      emits: [
        {
          type: "aks.scenario-test-inventory.check",
          target: { project: projectId },
        },
      ],
    });
    expect(
      appManifest.schedules?.some(
        (entry) => entry.id === "active-frontier-refill-review",
      ),
    ).toBe(false);

    expect(
      scenarioTestFrontierWakeEvent({
        type: "aks.scenario-test-inventory.observed",
        target: { project: projectId },
        data: { observation: { state: "red", strictPassed: false } },
      }),
    ).toMatchObject({
      type: "project.task.tick",
      target: {
        project: projectId,
        taskId: "scenario-normalization",
      },
      data: {
        observation: { state: "red", strictPassed: false },
        taskId: "scenario-normalization",
        task_id: "scenario-normalization",
        overrideWait: true,
        desiredRunnableLeaves: { min: 3, max: 5 },
        capacityRule: expect.stringContaining("Review/attention residue"),
        instructions: expect.stringContaining("missingAdapterFiles"),
      },
    });
  });
});
