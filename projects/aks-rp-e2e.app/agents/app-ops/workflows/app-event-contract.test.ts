import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { TaskTree } from "@may-agent/sdk/legacy";
import { applyProjectAppConditionEvent } from "../../../../may-agent/src/app/project-app-condition-tracker.ts";
import app, {
  masterValidationCapacityPulseEventType,
  masterValidationCapacityPulseIdempotencyKey,
  masterValidationCycleSlot,
  masterValidationScheduleGate,
  malformedApprovalWaitContract,
  resolveAksTask,
  routeAksEvent,
  scenarioTestFrontierWakeEvent,
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
      intents?: string[];
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

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8"));
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
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

  test("leaves loop continuation to shared parent wakeup", () => {
    const source = readFileSync(
      resolve(import.meta.dir, "../../../app.ts"),
      "utf8",
    );
    expect(source).not.toContain("loopRefillWakeForTaskEvent");
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

  test("projects May approval-decision messages into project.approval.submitted when an exact approval wait is asleep", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "approval-decision-projection-"));
    const emitted: Record<string, unknown>[] = [];
    const waitingTaskId =
      "ops/reconcile-unowned-dirty-detached-tmp-origin-dev-42642b6c-20260801";
    const approvalId =
      "aks-rp-e2e:approval:ops/request-approval-tmp-origin-dev-42642b6c-residue-cleanup-20260801:evidence-archive-ops-request-tmp-origin-dev-42642b6c-residue-cleanup-approval-20260801-packet.md";
    const waitId =
      "wait:aks-rp-e2e:approval:ops/request-approval-tmp-origin-dev-42642b6c-residue-cleanup-20260801:evidence-archive-ops-request-tmp-origin-dev-42642b6c-residue-cleanup-approval-20260801-packet.md";
    const pathId =
      "ops/request-approval-tmp-origin-dev-42642b6c-residue-cleanup-20260801";
    const conditionId = "approval-return:tmp-origin-dev-42642b6c-cleanup";

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [waitingTaskId]: {
            metadata: { id: waitingTaskId, generation: 1, resourceVersion: 1 },
            spec: { owner: "app-ops" },
            status: {
              phase: "waiting",
              conditionIds: [conditionId],
            },
          },
        },
        conditions: {
          [conditionId]: {
            metadata: { id: conditionId, generation: 1, resourceVersion: 1 },
            spec: {
              type: "project.approval.submitted",
              subject: "project:aks-rp-e2e",
              expected: {
                approvalKind: "approval-packet-dispatch",
                approvalId,
                waitId,
                pathId,
                packetPath:
                  "evidence/archive/ops-request-tmp-origin-dev-42642b6c-residue-cleanup-approval-20260801-packet.md",
                acceptedDecisions: [
                  "approve",
                  "adjust",
                  "hold",
                  "decline",
                  "reroute",
                ],
              },
            },
            status: {
              observedGeneration: 0,
              state: "unknown",
              observedAt: "2026-08-01T22:34:07.589Z",
            },
          },
        },
        attempts: {},
      });

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "message.created",
          source: "agent:may",
          owner: "agent:app-ops",
          eventId: 4844998,
          data: {
            from: "may",
            to: "app-ops",
            intent: "approval-decision",
            content:
              "[approval-decision] Decision: approve\n\nApproval id: " +
              approvalId +
              "\nWait id: " +
              waitId +
              "\nProject: aks-rp-e2e\n\nApprove deletion of only /tmp/aks-origin-dev-42642b6c/node_modules subject to the final execution-time reread safety checks already specified in the packet.",
          },
        },
      );

      expect(result).toEqual({
        approvalDecisionProjected: true,
        projectedApprovalDecision: {
          approvalId,
          waitId,
          project: "aks-rp-e2e",
          decision: "approve",
          message:
            "[approval-decision] Decision: approve\n\nApproval id: " +
            approvalId +
            "\nWait id: " +
            waitId +
            "\nProject: aks-rp-e2e\n\nApprove deletion of only /tmp/aks-origin-dev-42642b6c/node_modules subject to the final execution-time reread safety checks already specified in the packet.",
          pathId,
          packetPath:
            "evidence/archive/ops-request-tmp-origin-dev-42642b6c-residue-cleanup-approval-20260801-packet.md",
          conditionIds: [conditionId],
          taskIds: [waitingTaskId],
        },
      });
      expect(emitted).toEqual([
        {
          type: "project.approval.submitted",
          source: "aks-rp-e2e-app",
          target: { project: projectId },
          data: {
            project: projectId,
            approvalKind: "approval-packet-dispatch",
            approvalId,
            waitId,
            pathId,
            decision: "approve",
            message:
              "[approval-decision] Decision: approve\n\nApproval id: " +
              approvalId +
              "\nWait id: " +
              waitId +
              "\nProject: aks-rp-e2e\n\nApprove deletion of only /tmp/aks-origin-dev-42642b6c/node_modules subject to the final execution-time reread safety checks already specified in the packet.",
            sourceMessageType: "message.created",
            sourceMessageIntent: "approval-decision",
            sourceMessageOwner: "agent:app-ops",
            sourceMessageEventId: 4844998,
            packetPath:
              "evidence/archive/ops-request-tmp-origin-dev-42642b6c-residue-cleanup-approval-20260801-packet.md",
          },
        },
        {
          type: "message.resolved",
          source: "aks-rp-e2e-app",
          owner: "agent:app-ops",
          target: { project: projectId },
          data: {
            openEventId: 4844998,
            openEventType: "message.created",
            project: projectId,
            projectId,
            disposition: "answered",
            outcome: "fulfilled",
            summary: `Applied the approve decision to approval ${approvalId}.`,
            taskRefs: [{ projectId, taskId: waitingTaskId }],
          },
          trace: {
            traceId: "event:4844998",
            parentEventId: 4844998,
            links: [
              {
                eventId: 4844998,
                type: "closure",
                label: "message.resolved",
              },
            ],
          },
        },
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("claims only approval decisions and leaves ordinary owner messages to the shared lifecycle", () => {
    const messageSelectors = app.events.filter(
      (selector) =>
        typeof selector !== "string" && selector.type === "message.created",
    );
    expect(messageSelectors).toEqual([
      {
        type: "message.created",
        owner: "agent:app-ops",
        intents: ["approval-decision"],
      },
    ]);
  });

  test("sends an unclear approval decision to ordinary owner review with the original message identity", async () => {
    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        appPath: () => "/missing-approval-state",
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "message.created",
        source: "agent:may",
        owner: "agent:app-ops",
        eventId: 4845001,
        data: {
          from: "may",
          to: "app-ops",
          intent: "approval-decision",
          content: "Approve this one.",
        },
      },
    );

    expect(result).toEqual({
      approvalDecisionProjected: false,
      ownerReviewRequested: true,
      reason: "approval-decision-needs-clarification",
    });
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "project.owner.requested",
        owner: "agent:app-ops",
        target: { project: projectId },
        data: expect.objectContaining({
          reason: "owner-message",
          inputEventId: 4845001,
          inputEventType: "message.created",
          instruction: "Approve this one.",
        }),
        trace: expect.objectContaining({ parentEventId: 4845001 }),
      }),
    ]);
  });

  test("refreshes owner-visible readout when the controller promotes a runnable task into the live active frontier", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "owner-visible-refresh-"));
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const liveTreeUpdatedAt = "2026-07-26T03:14:31.577Z";
    const staleTreeUpdatedAt = "2026-07-26T03:13:31.808Z";
    const activeTaskId = "domain/example-active-task";
    const runnableTaskId = "domain/example-runnable-task";
    const runtimeMirrorPath = resolve(
      appDir,
      ".state/runtime-modules",
      appDir.replace(/[^A-Za-z0-9._-]+/g, "_"),
      "project.json",
    );

    try {
      writeJson(resolve(projectDir, "specs/index.json"), { specFiles: [] });
      writeJson(resolve(projectDir, "model/knowledge-map/model.json"), {
        featurePaths: [],
      });
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          root: { status: { phase: "active" } },
          [activeTaskId]: { status: { phase: "active" } },
          [runnableTaskId]: { status: { phase: "ready" } },
        },
      });
      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "root",
        updated_at: liveTreeUpdatedAt,
        tasks: {
          root: { id: "root", children: [activeTaskId, runnableTaskId] },
          [activeTaskId]: { id: activeTaskId, children: [] },
          [runnableTaskId]: { id: runnableTaskId, children: [] },
        },
        resources: {
          root: { status: { phase: "active" } },
          [activeTaskId]: { status: { phase: "active" } },
          [runnableTaskId]: { status: { phase: "ready" } },
        },
      });
      writeJson(resolve(appDir, "project.json"), {
        id: "aks-rp-e2e.app",
        domainProject: { path: "../aks-rp-e2e" },
        currentFocus: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          nextAction: `Drain the current live packet first: active=[none], review=[none], runnable=[${runnableTaskId}], waiting=[none], blocked=[none].`,
          activeTaskIds: [],
          waitingTaskIds: [],
          blockedTaskIds: [],
          proposedTaskIds: [runnableTaskId],
          focusMission: {
            treeUpdatedAt: staleTreeUpdatedAt,
            activeTaskIds: [],
            reviewTaskIds: [],
            waitingTaskIds: [],
            runnableTaskIds: [runnableTaskId],
            blockedTaskIds: [],
            linkedBlockedTaskIds: [],
            liveReviewFrontierTaskIds: [],
            proposedTaskIds: [runnableTaskId],
            packetCounts: {
              active: 0,
              review: 0,
              waiting: 0,
              runnable: 1,
              blocked: 0,
            },
          },
          focusReview: {
            note: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          },
          snapshot: {
            treeUpdatedAt: staleTreeUpdatedAt,
          },
        },
        focusReview: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
        },
        ownerNext: `Drain the current live packet first: active=[none], review=[none], runnable=[${runnableTaskId}], waiting=[none], blocked=[none].`,
      });
      writeJson(resolve(appDir, ".state/project-state.json"), {
        currentState: {
          summary: `Task-tree summary at ${staleTreeUpdatedAt} shows 1 runnable leaves, 0 waiting holders, 0 active frontier tasks, 0 review frontier tasks, and 0 dependency-blocked holders.`,
          activeTaskId: null,
          metrics: {
            activeLeafCount: 0,
            reviewLeafCount: 0,
            waitingLeafCount: 0,
            runnableLeafCount: 1,
            blockedLeafCount: 0,
          },
          snapshot: {
            treeUpdatedAt: staleTreeUpdatedAt,
          },
        },
        currentFocus: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          nextAction: `Drain the current live packet first: active=[none], review=[none], runnable=[${runnableTaskId}], waiting=[none], blocked=[none].`,
          activeTaskIds: [],
          waitingTaskIds: [],
          blockedTaskIds: [],
          proposedTaskIds: [runnableTaskId],
          focusMission: {
            treeUpdatedAt: staleTreeUpdatedAt,
            activeTaskIds: [],
            reviewTaskIds: [],
            waitingTaskIds: [],
            runnableTaskIds: [runnableTaskId],
            blockedTaskIds: [],
            linkedBlockedTaskIds: [],
            liveReviewFrontierTaskIds: [],
            proposedTaskIds: [runnableTaskId],
            packetCounts: {
              active: 0,
              review: 0,
              waiting: 0,
              runnable: 1,
              blocked: 0,
            },
          },
          focusReview: {
            note: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          },
          snapshot: {
            treeUpdatedAt: staleTreeUpdatedAt,
          },
        },
        focusReview: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
        },
        ownerNext: `Drain the current live packet first: active=[none], review=[none], runnable=[${runnableTaskId}], waiting=[none], blocked=[none].`,
      });
      writeJson(runtimeMirrorPath, {
        currentFocus: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          nextAction: `Drain the current live packet first: active=[none], review=[none], runnable=[${runnableTaskId}], waiting=[none], blocked=[none].`,
          activeTaskIds: [],
          waitingTaskIds: [],
          blockedTaskIds: [],
          proposedTaskIds: [runnableTaskId],
          focusMission: {
            treeUpdatedAt: staleTreeUpdatedAt,
            activeTaskIds: [],
            reviewTaskIds: [],
            waitingTaskIds: [],
            runnableTaskIds: [runnableTaskId],
            blockedTaskIds: [],
            linkedBlockedTaskIds: [],
            liveReviewFrontierTaskIds: [],
            proposedTaskIds: [runnableTaskId],
            packetCounts: {
              active: 0,
              review: 0,
              waiting: 0,
              runnable: 1,
              blocked: 0,
            },
          },
          focusReview: {
            note: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          },
          snapshot: {
            treeUpdatedAt: staleTreeUpdatedAt,
          },
        },
        focusReview: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
        },
        ownerNext: `Drain the current live packet first: active=[none], review=[none], runnable=[${runnableTaskId}], waiting=[none], blocked=[none].`,
      });
      rmSync(runtimeMirrorPath);
      symlinkSync(resolve(appDir, "project.json"), runtimeMirrorPath);

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "project.task.reconcile.started",
          target: { project: projectId, taskId: activeTaskId },
          data: {
            project: projectId,
            taskId: activeTaskId,
            reason: "task-controller",
          },
        },
      );

      expect(result).toEqual({
        ownerVisibleReadoutRefreshed: true,
        eventType: "project.task.reconcile.started",
      });
      expect(emitted).toEqual([]);

      const projectJson = readJson(resolve(appDir, "project.json"));
      const projectState = readJson(
        resolve(appDir, ".state/project-state.json"),
      );
      const runtimeMirror = readJson(runtimeMirrorPath);
      for (const packet of [projectState]) {
        expect(packet.currentFocus.snapshot.treeUpdatedAt).toBe(
          liveTreeUpdatedAt,
        );
        expect(packet.currentFocus.focusMission.treeUpdatedAt).toBe(
          liveTreeUpdatedAt,
        );
        expect(packet.currentFocus.activeTaskIds).toEqual([activeTaskId]);
        expect(packet.currentFocus.focusMission.activeTaskIds).toEqual([
          activeTaskId,
        ]);
        expect(packet.currentFocus.focusMission.runnableTaskIds).toEqual([
          runnableTaskId,
        ]);
        expect(packet.currentFocus.focusMission.packetCounts).toMatchObject({
          active: 1,
          review: 0,
          waiting: 0,
          runnable: 1,
          blocked: 0,
        });
      }
      expect(projectState.currentState.snapshot.treeUpdatedAt).toBe(
        liveTreeUpdatedAt,
      );
      expect(projectState.currentState.activeTaskId).toBe(activeTaskId);
      expect(projectState.currentState.metrics).toMatchObject({
        activeLeafCount: 1,
        reviewLeafCount: 0,
        waitingLeafCount: 0,
        runnableLeafCount: 1,
        blockedLeafCount: 0,
      });
      expect(projectJson.currentFocus.snapshot.treeUpdatedAt).toBe(
        staleTreeUpdatedAt,
      );
      expect(projectJson.currentFocus.activeTaskIds).toEqual([]);
      expect(runtimeMirror).toEqual(projectJson);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("keeps running repo-ref waits and active parents out of executable active/runnable buckets", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "owner-visible-executable-frontier-"),
    );
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const liveTreeUpdatedAt = "2026-07-26T14:20:00.000Z";
    const staleTreeUpdatedAt = "2026-07-26T14:19:00.000Z";
    const activeParentTaskId = "scenario-normalization";
    const activeChildTaskId = "domain/example-live-child";
    const activeWaitHolderId = "wait/example-running-origin-dev-advance-holder";
    const runnableTaskId = "domain/example-runnable-task";
    const pendingWaitHolderId =
      "wait/example-pending-origin-dev-advance-holder";
    const runtimeMirrorPath = resolve(
      appDir,
      ".state/runtime-modules",
      appDir.replace(/[^A-Za-z0-9._-]+/g, "_"),
      "project.json",
    );

    try {
      writeJson(resolve(projectDir, "specs/index.json"), { specFiles: [] });
      writeJson(resolve(projectDir, "model/knowledge-map/model.json"), {
        featurePaths: [],
      });
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          root: { status: { phase: "active" } },
          [activeParentTaskId]: { status: { phase: "running" } },
          [activeChildTaskId]: { status: { phase: "running" } },
          [activeWaitHolderId]: { status: { phase: "running" } },
          [runnableTaskId]: { status: { phase: "ready" } },
          [pendingWaitHolderId]: { status: { phase: "pending" } },
        },
      });
      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "root",
        updated_at: liveTreeUpdatedAt,
        tasks: {
          root: {
            id: "root",
            children: [
              activeParentTaskId,
              activeWaitHolderId,
              runnableTaskId,
              pendingWaitHolderId,
            ],
          },
          [activeParentTaskId]: {
            id: activeParentTaskId,
            children: [activeChildTaskId],
            workflow: "normalize-scenario-frontier",
          },
          [activeChildTaskId]: { id: activeChildTaskId, children: [] },
          [activeWaitHolderId]: {
            id: activeWaitHolderId,
            children: [],
            workflow: "wait-for-repo-ref-advance",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: "abc123",
            },
          },
          [runnableTaskId]: { id: runnableTaskId, children: [] },
          [pendingWaitHolderId]: {
            id: pendingWaitHolderId,
            children: [],
            workflow: "wait-for-repo-ref-advance",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: "def456",
            },
          },
        },
        resources: {
          root: { status: { phase: "active" } },
          [activeParentTaskId]: { status: { phase: "running" } },
          [activeChildTaskId]: { status: { phase: "running" } },
          [activeWaitHolderId]: { status: { phase: "running" } },
          [runnableTaskId]: { status: { phase: "ready" } },
          [pendingWaitHolderId]: { status: { phase: "pending" } },
        },
      });
      const stalePacket = {
        id: "aks-rp-e2e.app",
        domainProject: { path: "../aks-rp-e2e" },
        currentFocus: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          nextAction: `Drain the current live packet first: active=[${activeParentTaskId}, ${activeWaitHolderId}], review=[none], runnable=[${runnableTaskId}, ${pendingWaitHolderId}], waiting=[none], blocked=[none].`,
          activeTaskIds: [activeParentTaskId, activeWaitHolderId],
          waitingTaskIds: [],
          blockedTaskIds: [],
          proposedTaskIds: [
            activeParentTaskId,
            activeWaitHolderId,
            runnableTaskId,
            pendingWaitHolderId,
          ],
          focusMission: {
            treeUpdatedAt: staleTreeUpdatedAt,
            activeTaskIds: [activeParentTaskId, activeWaitHolderId],
            reviewTaskIds: [],
            waitingTaskIds: [],
            runnableTaskIds: [runnableTaskId, pendingWaitHolderId],
            blockedTaskIds: [],
            linkedBlockedTaskIds: [],
            liveReviewFrontierTaskIds: [],
            proposedTaskIds: [
              activeParentTaskId,
              activeWaitHolderId,
              runnableTaskId,
              pendingWaitHolderId,
            ],
            packetCounts: {
              active: 2,
              review: 0,
              waiting: 0,
              runnable: 2,
              blocked: 0,
            },
          },
          focusReview: {
            note: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
          },
          snapshot: {
            treeUpdatedAt: staleTreeUpdatedAt,
          },
        },
        focusReview: {
          summary: `Owner-visible frontier refreshed from the live tree updated ${staleTreeUpdatedAt}`,
        },
        ownerNext: `Drain the current live packet first: active=[${activeParentTaskId}, ${activeWaitHolderId}], review=[none], runnable=[${runnableTaskId}, ${pendingWaitHolderId}], waiting=[none], blocked=[none].`,
      };
      writeJson(resolve(appDir, "project.json"), stalePacket);
      writeJson(resolve(appDir, ".state/project-state.json"), {
        currentState: {
          summary: `Task-tree summary at ${staleTreeUpdatedAt} shows 2 runnable leaves, 0 waiting holders, 2 active frontier tasks, 0 review frontier tasks, and 0 dependency-blocked holders.`,
          activeTaskId: activeParentTaskId,
          metrics: {
            activeLeafCount: 2,
            reviewLeafCount: 0,
            waitingLeafCount: 0,
            runnableLeafCount: 2,
            blockedLeafCount: 0,
          },
          snapshot: {
            treeUpdatedAt: staleTreeUpdatedAt,
          },
        },
        currentFocus: stalePacket.currentFocus,
        focusReview: stalePacket.focusReview,
        ownerNext: stalePacket.ownerNext,
      });
      writeJson(runtimeMirrorPath, stalePacket);

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: () => undefined,
        } as never,
        {
          type: "project.task.reconcile.started",
          target: { project: projectId, taskId: activeChildTaskId },
          data: {
            project: projectId,
            taskId: activeChildTaskId,
            reason: "task-controller",
          },
        },
      );

      expect(result).toEqual({
        ownerVisibleReadoutRefreshed: true,
        eventType: "project.task.reconcile.started",
      });

      const projectJson = readJson(resolve(appDir, "project.json"));
      const projectState = readJson(
        resolve(appDir, ".state/project-state.json"),
      );
      const runtimeMirror = readJson(runtimeMirrorPath);
      for (const packet of [projectState]) {
        expect(packet.currentFocus.snapshot.treeUpdatedAt).toBe(
          liveTreeUpdatedAt,
        );
        expect(packet.currentFocus.focusMission.treeUpdatedAt).toBe(
          liveTreeUpdatedAt,
        );
        expect(packet.currentFocus.activeTaskIds).toEqual([activeChildTaskId]);
        expect(packet.currentFocus.waitingTaskIds).toEqual([
          pendingWaitHolderId,
          activeWaitHolderId,
        ]);
        expect(packet.currentFocus.focusMission.activeTaskIds).toEqual([
          activeChildTaskId,
        ]);
        expect(packet.currentFocus.focusMission.waitingTaskIds).toEqual([
          pendingWaitHolderId,
          activeWaitHolderId,
        ]);
        expect(packet.currentFocus.focusMission.runnableTaskIds).toEqual([
          runnableTaskId,
        ]);
        expect(packet.currentFocus.focusMission.packetCounts).toMatchObject({
          active: 1,
          review: 0,
          waiting: 2,
          runnable: 1,
          blocked: 0,
        });
        expect(packet.currentFocus.focusMission.successCriteria).toContain(
          "Active ids are executable leaves only, and exact repo-ref wait holders are preserved outside runnable capacity.",
        );
      }
      expect(projectState.currentState.snapshot.treeUpdatedAt).toBe(
        liveTreeUpdatedAt,
      );
      expect(projectState.currentState.activeTaskId).toBe(activeChildTaskId);
      expect(projectState.currentState.metrics).toMatchObject({
        activeLeafCount: 1,
        reviewLeafCount: 0,
        waitingLeafCount: 2,
        runnableLeafCount: 1,
        blockedLeafCount: 0,
      });
      expect(projectState.currentFocus.nextAction).toContain(
        `active=[${activeChildTaskId}]`,
      );
      expect(projectState.currentFocus.nextAction).toContain(
        `runnable=[${runnableTaskId}]`,
      );
      expect(projectState.currentFocus.nextAction).toContain(
        `waiting=[${pendingWaitHolderId}, ${activeWaitHolderId}]`,
      );
      expect(projectJson).toEqual(stalePacket);
      expect(runtimeMirror).toEqual(stalePacket);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
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

  test("routes the project-state holder migration to one finite resource", () => {
    expect(
      resolveAksTask({
        type: "aks.resource-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-resource-liveness-v3",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-resource-migration",
      input: { migration: "resource-liveness-v3" },
    });
  });

  test("routes the task-state wait migration to one finite resource", () => {
    expect(
      resolveAksTask({
        type: "aks.task-state-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-task-state-v1",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-task-state-migration",
      input: { migration: "task-state-waits-v1" },
    });
  });

  test("routes the task-tick holder migration to one finite resource", () => {
    expect(
      resolveAksTask({
        type: "aks.task-tick-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-task-tick-v1",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-task-tick-migration",
      input: { migration: "task-tick-holders-v1" },
    });
  });

  test("routes the legacy repo-ref condition migration to one finite resource", () => {
    expect(
      resolveAksTask({
        type: "aks.repo-ref-condition-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-repo-ref-condition-v1",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-repo-ref-condition-migration",
      input: { migration: "legacy-repo-ref-conditions-v1" },
    });
  });

  test("routes the topology-aware project-state residue migration", () => {
    expect(
      resolveAksTask({
        type: "aks.project-state-residue-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-project-state-v2",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-project-state-residue-migration",
      input: { migration: "project-state-residue-v2" },
    });
  });

  test("routes the safe spec-loop ownership migration", () => {
    expect(
      resolveAksTask({
        type: "aks.spec-loop-ownership-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-spec-loop-ownership-v1",
      parentId: "group/app-operations",
      workflow: "unified-spec-loop-ownership-migration",
      input: { migration: "spec-loop-siblings-v1" },
      priority: "P0",
    });
  });

  test("routes current feature work to the executable feature loop", () => {
    expect(
      resolveAksTask({
        type: "aks.feature-loop-ownership-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-feature-loop-current-v1",
      parentId: "group/app-operations",
      workflow: "unified-feature-loop-ownership-migration",
      input: { migration: "feature-loop-current-v1" },
      priority: "P0",
    });
  });

  test("routes stale feature history to one guarded cleanup", () => {
    expect(
      resolveAksTask({
        type: "aks.feature-loop-history-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-feature-loop-history-v1",
      parentId: "group/app-operations",
      workflow: "unified-feature-loop-history-migration",
      input: { migration: "feature-loop-history-v1", batch: "1" },
      priority: "P0",
    });
  });

  test("uses a stable resource for each bounded feature history batch", () => {
    expect(
      resolveAksTask({
        type: "aks.feature-loop-history-migration.requested",
        target: { project: projectId },
        data: { batch: "2" },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-feature-loop-history-v2",
      input: { migration: "feature-loop-history-v1", batch: "2" },
    });
  });

  test("routes remaining feature topology under the executable loop", () => {
    expect(
      resolveAksTask({
        type: "aks.feature-loop-residue-migration.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-feature-loop-residue-v1",
      parentId: "group/app-operations",
      workflow: "unified-feature-loop-residue-migration",
      input: { migration: "feature-loop-residue-v1", batch: "1" },
      priority: "P0",
    });
  });

  test("uses a stable resource for each bounded feature residue batch", () => {
    expect(
      resolveAksTask({
        type: "aks.feature-loop-residue-migration.requested",
        target: { project: projectId },
        data: { batch: "2" },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-feature-loop-residue-v2",
      input: { migration: "feature-loop-residue-v1", batch: "2" },
    });
  });

  test("routes scenario siblings to their executable loop", () => {
    expect(
      resolveAksTask({
        type: "aks.scenario-loop-ownership-migration.requested",
        target: { project: projectId },
        data: { batch: "2" },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-scenario-loop-ownership-v2",
      parentId: "group/app-operations",
      workflow: "unified-scenario-loop-ownership-migration",
      input: { migration: "scenario-loop-ownership-v1", batch: "2" },
      priority: "P0",
    });
  });

  test("routes waiting-frontier retirement to the existing runtime resource", () => {
    expect(
      resolveAksTask({
        type: "aks.waiting-frontier-retirement.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/waiting-frontier-review",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      workflow: "retire-waiting-frontier",
      input: { migration: "waiting-frontier-retirement-v1" },
    });
  });

  test("routes rejected waiting-frontier migration cleanup to its own receipt", () => {
    expect(
      resolveAksTask({
        type: "aks.waiting-frontier-migration-cleanup.requested",
        target: { project: projectId },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-waiting-frontier-v1",
      mode: "achieve",
      workflow: "unified-waiting-frontier-migration",
      input: { migration: "waiting-frontier-direct-resolver-v2" },
    });
  });

  test("routes finite holder cleanup through stable bounded batches", () => {
    expect(
      resolveAksTask({
        type: "aks.finite-holder-migration.requested",
        target: { project: projectId },
        data: { batch: "3" },
      }),
    ).toMatchObject({
      id: "runtime/unified-resource-migration-finite-holders-v3",
      mode: "achieve",
      workflow: "unified-finite-holder-migration",
      input: { migration: "finite-holder-residue-v1", batch: "3" },
    });
  });

  test("leaves repo-ref Condition matching and wakeup to the shared runtime", async () => {
    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "aks.repo-ref.observed",
        target: { project: projectId },
        data: {
          project: projectId,
          repoRef: "origin/dev",
          commit: "new-commit",
          previousCommit: "old-commit",
          changed: true,
        },
      },
    );

    expect(result).toEqual({
      observed: true,
      repoRef: "origin/dev",
      commit: "new-commit",
      conditionTracking: "shared-runtime",
    });
    expect(emitted).toEqual([]);
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

  test("keeps project.task.reconciled projection-only", async () => {
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
          taskId: "domain/example-verifier-rejected",
        },
        data: {
          project: projectId,
          taskId: "domain/example-verifier-rejected",
          disposition: "attention",
          actionsApplied: ["unblocked stale-wait"],
        },
      },
    );

    expect(result).toEqual({
      specProof: {
        changed: false,
        taskId: "domain/example-verifier-rejected",
      },
      featureCompactProjection: {
        changed: false,
        taskId: "domain/example-verifier-rejected",
      },
    });
    expect(emitted).toEqual([]);
  });

  test("leaves newly created ready children to the shared controller queue", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "created-ready-child-"));
    const emitted: Record<string, unknown>[] = [];
    const parentTaskId =
      "ops/repair-owner-review-origin-dev-wait-churn-and-maintain-replay-20260728";
    const childTaskId =
      "ops/migrate-workload-autoscaler-generic-origin-dev-wait-descendants-20260728";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/tree.json"),
        JSON.stringify(
          {
            tasks: {
              [childTaskId]: {
                id: childTaskId,
                phase: "pending",
                readiness: {
                  state: "ready",
                  reason: "Dependencies and capacity allow claim",
                  related_ids: [],
                },
              },
            },
          },
          null,
          2,
        ),
      );

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "project.task.reconciled",
          target: {
            project: projectId,
            taskId: parentTaskId,
          },
          data: {
            project: projectId,
            taskId: parentTaskId,
            disposition: "waiting",
            actionsApplied: [`created ${childTaskId}`],
          },
        },
      );

      expect(result).not.toHaveProperty("appliedReadyTaskWake");
      expect(emitted).not.toContainEqual(
        expect.objectContaining({
          type: "project.task.tick",
          target: { project: projectId, taskId: childTaskId },
        }),
      );
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("leaves updated ready tasks to the shared controller queue", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "updated-ready-task-"));
    const emitted: Record<string, unknown>[] = [];
    const sourceTaskId = "runtime/owner-review";
    const taskId =
      "domain/reconcile-direct-scenario-quality-app-routing-default-domain-istio";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/tree.json"),
        JSON.stringify({
          active_task_ids: [],
          tasks: {
            [taskId]: {
              id: taskId,
              phase: "pending",
              readiness: { state: "ready" },
            },
          },
        }),
      );

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "project.task.reconciled",
          target: { project: projectId, taskId: sourceTaskId },
          data: {
            project: projectId,
            taskId: sourceTaskId,
            disposition: "converged",
            actionsApplied: [`updated ${taskId}`],
          },
        },
      );

      expect(result).not.toHaveProperty("appliedReadyTaskWake");
      expect(emitted).not.toContainEqual(
        expect.objectContaining({
          type: "project.task.tick",
          target: { project: projectId, taskId },
        }),
      );
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("leaves recovered-task scheduling to the shared runtime", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "recovered-ready-task-"));
    const emitted: Record<string, unknown>[] = [];
    const taskId =
      "domain/reconcile-direct-scenario-quality-autoupgrader-tests-autoupgrader-vm-prerelease-umbrella-7ab9b4c8";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/tree.json"),
        JSON.stringify(
          {
            active_task_ids: [],
            tasks: {
              [taskId]: {
                id: taskId,
                phase: "pending",
                readiness: {
                  state: "ready",
                  reason: "Task recovered and is ready to retry",
                  related_ids: [],
                },
              },
            },
          },
          null,
          2,
        ),
      );

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "project.task.handler.recovered",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            taskId,
            task_id: taskId,
            reason: "owner-session-succeeded-after-handler-execution-failure",
          },
        },
      );

      expect(result).toMatchObject({
        eventType: "project.task.handler.recovered",
        recoveredTaskId: taskId,
        recoveryScheduling: "shared-runtime",
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("leaves satisfied-Condition scheduling to the shared runtime", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "pipeline-ready-task-"));
    const emitted: Record<string, unknown>[] = [];
    const taskId =
      "domain/reconcile-direct-scenario-quality-autoupgrader-tests-autoupgrader-vm-prerelease-umbrella-7ab9b4c8";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/tree.json"),
        JSON.stringify(
          {
            active_task_ids: [],
            tasks: {
              [taskId]: {
                id: taskId,
                phase: "waiting",
                readiness: {
                  state: "waiting",
                  reason: "Projection has not observed the condition yet",
                  related_ids: ["pipeline-run-174886017-completed"],
                },
              },
            },
          },
          null,
          2,
        ),
      );
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            resources: {
              [taskId]: {
                status: {
                  phase: "waiting",
                  conditionIds: ["pipeline-run-174886017-completed"],
                },
              },
            },
            conditions: {
              "pipeline-run-174886017-completed": {
                status: { state: "true" },
              },
            },
            attempts: {},
          },
          null,
          2,
        ),
      );

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "pipeline.completed",
          target: { project: projectId },
          data: {
            project: projectId,
            taskId,
            task_id: taskId,
            pipelineRunId: "174886017",
            runId: "174886017",
            status: "completed",
            result: "succeeded",
          },
        },
      );

      expect(result).toMatchObject({
        eventType: "pipeline.completed",
        taskId,
        conditionScheduling: "shared-runtime",
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("syncs feature-compact projection when a live holder reconciles into an exact wait", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "feature-compact-projection-"));
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const emitted: Record<string, unknown>[] = [];
    const holderTaskId =
      "hold-compact-virtualmachines-agentpool-split-residual-frontier-5044f69c-20260728";
    const conditionId =
      "mixed-sku-upgrade-master-validation-recovery-converged";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      mkdirSync(resolve(appDir, ".state/feature-compact-loop"), {
        recursive: true,
      });
      mkdirSync(resolve(projectDir, ".state/feature-compact-loop"), {
        recursive: true,
      });

      const staleFeatureRow = {
        featureKey: "virtualmachines-agentpool",
        capabilityId: "virtualmachines-agentpool",
        packetPath: "features/virtualmachines-agentpool.yaml",
        specsDir: "features/virtualmachines-agentpool/specs",
        specCount: 22,
        status: "pending",
        errorClass: "package-partial",
        retryable: false,
        retryReason:
          "Resume compact work by consuming the exact current same-feature follow-through.",
        taskId: holderTaskId,
        frontierTaskIds: [holderTaskId],
        attempts: 2,
        lastPlanPath:
          "features/virtualmachines-agentpool/compact/staging.plan.json",
        lastSummaryPath:
          "features/virtualmachines-agentpool/compact/staging.summary.md",
        lastDiagnosticsPath:
          "features/virtualmachines-agentpool/compact/staging.diagnostics.json",
        lastResultPath:
          "runs/test-results/feature-compact-virtualmachines-agentpool-staging-check",
        lastWorkflowRunId: "171311555",
        lastWorkflowRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171311555",
        lastWorkflowLoopKey: null,
        lastDispatchMetadataPath: null,
        lastLiveProofVersion: null,
        activeAttemptId: null,
        activeTaskSessionId: null,
        activeWorkflowRunId: null,
        heartbeatAt: null,
        lastSummary:
          "Current compact authority selects 23 active specs with 14 live-ready members and a 9-spec residual frontier.",
        rootCauseClassification: "repo-local-spec-metadata-split-frontier",
        inputFingerprint: null,
        errorFingerprint: null,
        lastSupportWorkFingerprint: null,
        ownerReason: "Stale 14/9 holder mapping.",
        attemptedFixes: [],
        nextStepClassification:
          "Consume the active mixed-sku-rest-scale normalization follow-through.",
        resumeCondition:
          "Resume the feature holder after domain/normalize-plain-scenario-carrier-virtualmachines-agentpool-tests-virtualmachines-mixed-sku-rest-scale.ts-5044f69c or any represented residual frontier changes materially.",
        blockedAt: null,
        blockedReason: null,
        waitingFor: null,
        waitingCondition: null,
        observedBy: null,
        observationMethod: null,
        nextCheckAt: null,
        blockerOwner: "aks-explorer",
        fallbackAt: null,
        fallbackAction: null,
        resumeAction:
          "Keep the feature represented by the residual-frontier holder.",
        blockedScope: { kind: "feature", ids: ["virtualmachines-agentpool"] },
        blockedFingerprint: null,
        lastCheckedAt: "2026-07-28T16:27:12.475Z",
        evidencePaths: [
          "evidence/archive/reconcile-virtualmachines-agentpool-stale-same-feature-holder-routing-20260728.md",
        ],
        reviewEvidencePath:
          "evidence/archive/reconcile-virtualmachines-agentpool-stale-same-feature-holder-routing-20260728.md",
        verificationBlocker: "Old 23/14/9 frontier still cited.",
        summary:
          "Repaired virtualmachines-agentpool app-visible compact routing to cite the current same-feature producer.",
        updatedAt: "2026-07-28T16:27:12.475Z",
      };
      const unrelatedNewerRow = {
        featureKey: "ccp-coredns",
        capabilityId: "ccp-coredns",
        packetPath: "features/ccp-coredns.yaml",
        specsDir: "features/ccp-coredns/specs",
        specCount: 7,
        status: "done",
        errorClass: null,
        retryable: true,
        retryReason: null,
        taskId: "hold-compact-ccp-coredns-split-frontier-20260728",
        frontierTaskIds: ["hold-compact-ccp-coredns-split-frontier-20260728"],
        attempts: 1,
        lastPlanPath: "features/ccp-coredns/compact/staging.plan.json",
        lastSummaryPath: "features/ccp-coredns/compact/staging.summary.md",
        lastDiagnosticsPath:
          "features/ccp-coredns/compact/staging.diagnostics.json",
        lastResultPath: "runs/test-results/feature-compact-ccp-coredns-check",
        lastWorkflowRunId: "174104717",
        lastWorkflowRunUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=174104717",
        lastWorkflowLoopKey: null,
        lastDispatchMetadataPath: null,
        lastLiveProofVersion: "live-aks-proof-v2",
        activeAttemptId: null,
        activeTaskSessionId: null,
        activeWorkflowRunId: null,
        heartbeatAt: null,
        lastSummary:
          "Current compact authority already matches the published split frontier.",
        rootCauseClassification: "repo-local-spec-metadata-split-frontier",
        inputFingerprint: "ccp-coredns@done",
        errorFingerprint: null,
        lastSupportWorkFingerprint: null,
        ownerReason: "Published split frontier remains authoritative.",
        attemptedFixes: [
          "Published split-frontier source truth to origin/dev.",
        ],
        nextStepClassification: "No same-surface action required.",
        resumeCondition: null,
        blockedAt: null,
        blockedReason: null,
        waitingFor: null,
        waitingCondition: null,
        observedBy: null,
        observationMethod: null,
        nextCheckAt: null,
        blockerOwner: null,
        fallbackAt: null,
        fallbackAction: null,
        resumeAction: null,
        blockedScope: null,
        blockedFingerprint: null,
        lastCheckedAt: "2026-07-29T03:59:59.000Z",
        evidencePaths: [
          "evidence/archive/reconcile-canonical-root-ccp-coredns-split-frontier-residue-20260728.md",
        ],
        reviewEvidencePath:
          "evidence/archive/reconcile-canonical-root-ccp-coredns-split-frontier-residue-20260728.md",
        verificationBlocker: null,
        summary:
          "CCP CoreDNS row is already newer than the projected holder update.",
        updatedAt: "2026-07-29T03:59:59.000Z",
      };
      const featureState = {
        loopTaskId: "aks-feature-compact-loop",
        windowSize: 3,
        cursor: 0,
        features: {
          "virtualmachines-agentpool": staleFeatureRow,
          "ccp-coredns": unrelatedNewerRow,
        },
      };
      writeJson(
        resolve(appDir, ".state/feature-compact-loop/state.json"),
        featureState,
      );
      writeJson(
        resolve(projectDir, ".state/feature-compact-loop/state.json"),
        featureState,
      );
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [holderTaskId]: {
            metadata: { id: holderTaskId, generation: 2, resourceVersion: 9 },
            spec: {
              parentId: "group/feature-compact",
              owner: "aks-explorer",
              outcome:
                "Preserve the exact virtualmachines-agentpool compact residual frontier at 23 selected / 13 live-ready / 10 residual.",
              acceptance: [
                "Preserve the current target residual frontier explicitly.",
              ],
              mode: "maintain",
              input: {
                featureKey: "virtualmachines-agentpool",
              },
            },
            status: {
              observedGeneration: 2,
              phase: "waiting",
              updatedAt: "2026-07-29T03:34:39.438Z",
              conditionIds: [conditionId],
              summary:
                "The reclassification publish is already integrated and the compact artifacts now truthfully preserve the 23 selected / 13 live-ready / 10 residual virtualmachines-agentpool frontier. Keep this holder waiting only for the exact mixed-sku-upgrade master-validation recovery task to converge with a later current-main pass before any same-surface frontier change is reconsidered.",
              evidence: [
                "evidence/archive/reconcile-virtualmachines-agentpool-mixed-sku-upgrade-frontier-20260729.md",
                "features/virtualmachines-agentpool/compact/staging.summary.md now reports 23 selected / 13 live-ready / 10 residual.",
              ],
            },
          },
        },
        conditions: {
          [conditionId]: {
            metadata: { id: conditionId, generation: 1, resourceVersion: 1 },
            spec: {
              type: "task-field",
              subject:
                "task:domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/1f5d75c79e520c91b41c",
              expected: {
                field: "completedAt",
                notEquals: null,
              },
            },
          },
        },
        attempts: {},
      });

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "project.task.reconciled",
          target: {
            project: projectId,
            taskId: holderTaskId,
          },
          data: {
            project: projectId,
            taskId: holderTaskId,
            disposition: "waiting",
          },
        },
      );

      expect(result).toMatchObject({
        featureCompactProjection: {
          changed: true,
          taskId: holderTaskId,
          featureKey: "virtualmachines-agentpool",
          conditionId,
        },
      });
      expect(emitted).toEqual([]);

      const appState = readJson(
        resolve(appDir, ".state/feature-compact-loop/state.json"),
      );
      const projectState = readJson(
        resolve(projectDir, ".state/feature-compact-loop/state.json"),
      );
      for (const state of [appState, projectState]) {
        expect(state.features["virtualmachines-agentpool"]).toMatchObject({
          status: "blocked",
          retryable: false,
          taskId: holderTaskId,
          frontierTaskIds: [holderTaskId],
          blockedReason:
            "The reclassification publish is already integrated and the compact artifacts now truthfully preserve the 23 selected / 13 live-ready / 10 residual virtualmachines-agentpool frontier. Keep this holder waiting only for the exact mixed-sku-upgrade master-validation recovery task to converge with a later current-main pass before any same-surface frontier change is reconsidered.",
          waitingCondition: conditionId,
          waitingFor: {
            type: "task-field",
            taskId:
              "domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/1f5d75c79e520c91b41c",
            field: "completedAt",
            notEquals: null,
            representedTaskIds: [
              "domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/1f5d75c79e520c91b41c",
            ],
          },
          ownerReason:
            "Current task hold-compact-virtualmachines-agentpool-split-residual-frontier-5044f69c-20260728 is the exact feature-level compact holder. The reclassification publish is already integrated and the compact artifacts now truthfully preserve the 23 selected / 13 live-ready / 10 residual virtualmachines-agentpool frontier. Keep this holder waiting only for the exact mixed-sku-upgrade master-validation recovery task to converge with a later current-main pass before any same-surface frontier change is reconsidered.",
          attemptedFixes: [
            "Projected hold-compact-virtualmachines-agentpool-split-residual-frontier-5044f69c-20260728 into the feature-compact ledger and rewrote current blocked-state text to the exact remaining wake. The reclassification publish is already integrated and the compact artifacts now truthfully preserve the 23 selected / 13 live-ready / 10 residual virtualmachines-agentpool frontier. Keep this holder waiting only for the exact mixed-sku-upgrade master-validation recovery task to converge with a later current-main pass before any same-surface frontier change is reconsidered.",
          ],
          nextStepClassification:
            "Preserve the current feature-level compact holder and wait only for the exact wait for domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/1f5d75c79e520c91b41c to report completedAt != null before reconsidering same-surface frontier changes.",
          resumeAction:
            "Keep the feature represented by hold-compact-virtualmachines-agentpool-split-residual-frontier-5044f69c-20260728 while the exact wait for domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/1f5d75c79e520c91b41c to report completedAt != null remains the exact wake.",
          resumeCondition:
            "Resume when domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/1f5d75c79e520c91b41c reports completedAt != null.",
          verificationBlocker:
            "Do not rerun the unchanged whole package. The reclassification publish is already integrated and the compact artifacts now truthfully preserve the 23 selected / 13 live-ready / 10 residual virtualmachines-agentpool frontier. Keep this holder waiting only for the exact mixed-sku-upgrade master-validation recovery task to converge with a later current-main pass before any same-surface frontier change is reconsidered.",
          lastCheckedAt: "2026-07-29T03:34:39.438Z",
          updatedAt: "2026-07-29T03:34:39.438Z",
          reviewEvidencePath:
            "evidence/archive/reconcile-virtualmachines-agentpool-mixed-sku-upgrade-frontier-20260729.md",
        });
        expect(
          state.features["virtualmachines-agentpool"].evidencePaths,
        ).toEqual(
          expect.arrayContaining([
            "evidence/archive/reconcile-virtualmachines-agentpool-stale-same-feature-holder-routing-20260728.md",
            "evidence/archive/reconcile-virtualmachines-agentpool-mixed-sku-upgrade-frontier-20260729.md",
          ]),
        );
        expect(state.features["ccp-coredns"]).toEqual(unrelatedNewerRow);
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("leaves repo-ref owner handoff continuation to the shared controller", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-owner-handoff-"));
    const emitted: Record<string, unknown>[] = [];
    const taskId =
      "wait-compact-secure-tls-bootstrap-package-partial-origin-dev-advance-63c7519a-20260726";
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
                metadata: { id: taskId, generation: 1, resourceVersion: 2 },
                spec: {
                  parentId: "project",
                  outcome:
                    "After origin/dev advances, recheck the exact same compact frontier.",
                  acceptance: ["Preserve same-task bounded owner judgment."],
                  mode: "achieve",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "63c7519aa1420391aaa5b19967f1a7c8bcbcf786",
                    specId: "spec.secure-tls-bootstrap.basic-lifecycle",
                  },
                  priority: "P2",
                  category: "domain",
                },
              },
            },
          },
          null,
          2,
        ),
      );

      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
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

      expect(result).not.toHaveProperty("repoRefOwnerHandoffReplay");
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("leaves satisfied repo-ref continuation to the shared Condition tracker", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-wait-reconciled-"));
    const taskId =
      "ops/reconcile-reraised-traffic-api-proxy-contract-helper-retained-worktree-7bbb6f45ba-at-ed1c33b9-20260801";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      mkdirSync(resolve(appDir, ".state/watchers"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            version: 2,
            project: projectId,
            resources: {
              [taskId]: {
                metadata: { id: taskId, generation: 3, resourceVersion: 29 },
                spec: {
                  parentId: "runtime/owner-review",
                  outcome:
                    "From current origin/dev, re-read the retained traffic-api-proxy worktree and preserve or revise its same-surface disposition from current facts.",
                  acceptance: [
                    "Keep the exact retained worktree path claimed while this carrier remains live.",
                  ],
                  mode: "achieve",
                  owner: "app-ops",
                  input: {
                    workspacePath:
                      "/app/worktrees/aks-rp-e2e/domain-reconcile-traffic-api-proxy-contract-helper-unpaired-adapter-orig-7bbb6f45ba",
                  },
                },
                status: {
                  phase: "waiting",
                  conditionIds: [
                    "aks-rp-e2e-origin-dev-advance-after-70f667c7-traffic-api-proxy",
                  ],
                },
              },
            },
            conditions: {
              "aks-rp-e2e-origin-dev-advance-after-70f667c7-traffic-api-proxy":
                {
                  spec: {
                    type: "aks.repo-ref.observed",
                    subject: "project:aks-rp-e2e",
                    expected: {
                      baseRef: "origin/dev",
                      shaNotEquals: "70f667c7b688155e1786b419c384b99942f0d827",
                    },
                  },
                  status: {
                    observedGeneration: 0,
                    state: "unknown",
                    observedAt: "2026-08-01T16:31:08.653Z",
                  },
                },
            },
            attempts: {},
          },
          null,
          2,
        ),
      );
      writeFileSync(
        resolve(appDir, ".state/watchers/repo-ref.json"),
        JSON.stringify(
          {
            refs: {
              "origin/dev": "a189864494c5a93aebedb99502e8fa1349c97dc4",
            },
            checkedAt: "2026-08-02T13:44:07.661Z",
          },
          null,
          2,
        ),
      );

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

      expect(result).not.toHaveProperty("repoRefWaitReplay");
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("accepts structured AzureLinux publication events and wakes only after a new published version", async () => {
    expect(
      app.events?.some(
        (selector) =>
          typeof selector === "object" &&
          selector.type === "aks.node-image-publication.state",
      ),
    ).toBe(true);

    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        appPath: (path = ".") => resolve("/tmp", path),
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "aks.node-image-publication.state",
        target: { project: projectId },
        data: {
          project: projectId,
          targetName: "staging",
          location: "westus2",
          imageFamily: "AKSAzureLinux",
          channel: "SecurityPatch",
          publishedVersion: "AKSAzureLinux-V3gen2-202607.29.0",
        },
      },
    );
    expect(result).toEqual({
      nodeImagePublicationObserved: true,
      targetName: "staging",
      location: "westus2",
      imageFamily: "AKSAzureLinux",
      channel: "SecurityPatch",
      publishedVersion: "AKSAzureLinux-V3gen2-202607.29.0",
      conditionTracking: "shared-runtime",
    });
    expect(emitted).toEqual([]);

    const tree: TaskTree = {
      version: 2,
      project: projectId,
      tasks: {},
      resources: {
        "domain/spec.ccp-security-patch.azurelinux-prod-mtc": {
          metadata: {
            id: "domain/spec.ccp-security-patch.azurelinux-prod-mtc",
            generation: 1,
            resourceVersion: 1,
          },
          spec: {
            parentId: "group/domain",
            outcome:
              "Wait for a newer westus2 AzureLinux security patch publication.",
            acceptance: [],
            mode: "achieve",
          },
          status: {
            observedGeneration: 1,
            phase: "waiting",
            conditionIds: ["azurelinux-publication-after-202607.29.0"],
            updatedAt: "2026-08-05T12:20:00.000Z",
          },
        },
      },
      conditions: {
        "azurelinux-publication-after-202607.29.0": {
          metadata: {
            id: "azurelinux-publication-after-202607.29.0",
            generation: 1,
            resourceVersion: 1,
          },
          spec: {
            type: "aks.node-image-publication.state",
            subject: "project:aks-rp-e2e",
            expected: {
              targetName: "staging",
              location: "westus2",
              imageFamily: "AKSAzureLinux",
              channel: "SecurityPatch",
              field: "publishedVersion",
              notEquals: "AKSAzureLinux-V3gen2-202607.29.0",
            },
          },
          status: {
            observedGeneration: 1,
            state: "unknown",
            observedAt: "2026-08-05T12:20:00.000Z",
          },
        },
      },
    };

    expect(
      applyProjectAppConditionEvent(tree, {
        type: "aks.node-image-publication.state",
        project: projectId,
        targetName: "staging",
        location: "westus2",
        imageFamily: "AKSAzureLinux",
        channel: "SecurityPatch",
        publishedVersion: "AKSAzureLinux-V3gen2-202607.29.0",
        timestamp: Date.parse("2026-08-05T12:21:00.000Z"),
      }),
    ).toEqual([]);
    expect(
      applyProjectAppConditionEvent(tree, {
        type: "aks.node-image-publication.state",
        project: projectId,
        targetName: "staging",
        location: "westus2",
        imageFamily: "AKSAzureLinux",
        channel: "SecurityPatch",
        publishedVersion: "AKSAzureLinux-V3gen2-202608.01.0",
        timestamp: Date.parse("2026-08-05T12:22:00.000Z"),
      }),
    ).toMatchObject([
      {
        taskId: "domain/spec.ccp-security-patch.azurelinux-prod-mtc",
        conditionId: "azurelinux-publication-after-202607.29.0",
      },
    ]);
  });

  test("reports malformed approval-return waits without scheduling from reconciliation results", async () => {
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

      expect(result).toEqual({
        specProof: { changed: false, taskId },
        featureCompactProjection: { changed: false, taskId },
      });
      expect(emitted).toEqual([]);
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

      expect(result).toEqual({
        specProof: { changed: false, taskId },
        featureCompactProjection: { changed: false, taskId },
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("suppresses covered workspace-integrity wakes but still emits when one anomaly lacks a live holder", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "workspace-integrity-route-"));
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const workspacePath = join(rootDir, "owner-space");
    const cleanupTaskId = "ops/request-approval-canonical-root-demo-cleanup";
    const workspaceTaskId = "ops/request-approval-owner-space-cleanup";
    const dirtyRelativePath = "features/demo/spec.json";
    const dirtyAbsolutePath = join(projectDir, dirtyRelativePath);
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      mkdirSync(dirname(dirtyAbsolutePath), { recursive: true });
      mkdirSync(workspacePath, { recursive: true });
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      git(projectDir, "config", "user.email", "test@example.com");
      git(projectDir, "config", "user.name", "Test");
      writeFileSync(dirtyAbsolutePath, "base\n");
      git(projectDir, "add", dirtyRelativePath);
      git(projectDir, "commit", "-m", "base");
      writeFileSync(dirtyAbsolutePath, "base\nlocal residue\n");

      const event = {
        type: "aks.workspace.integrity.changed",
        target: { project: projectId },
        data: {
          checkedAt: "2026-07-26T10:00:00.000Z",
          fingerprint: "demo-covered-frontier",
          canonical: {
            branch: "dev",
            head: "abc123",
            expectedHead: "def456",
            clean: false,
            healthy: false,
          },
          anomalies: [
            { path: projectDir, kind: "canonical-unhealthy" },
            { path: projectDir, kind: "unowned-dirty" },
            { path: workspacePath, kind: "unowned-dirty" },
          ],
        },
      };

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: {
            id: "project",
            children: [cleanupTaskId, workspaceTaskId],
          },
          [cleanupTaskId]: {
            id: cleanupTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              cleanupPaths: [dirtyRelativePath],
            },
          },
          [workspaceTaskId]: {
            id: workspaceTaskId,
            phase: "waiting",
            input: {
              workspacePath,
            },
          },
        },
      });

      const coveredEmitted: Record<string, unknown>[] = [];
      const coveredResult = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => coveredEmitted.push(value),
        } as never,
        event,
      );

      expect(coveredResult).toMatchObject({
        ownerReviewRequested: false,
        workspaceIntegrityOwnerReviewSuppressed: true,
      });
      expect(coveredEmitted).toEqual([]);

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: { id: "project", children: [cleanupTaskId] },
          [cleanupTaskId]: {
            id: cleanupTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              cleanupPaths: [dirtyRelativePath],
            },
          },
        },
      });

      const uncoveredEmitted: Record<string, unknown>[] = [];
      const uncoveredResult = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) =>
            uncoveredEmitted.push(value),
        } as never,
        event,
      );

      expect(uncoveredResult).toMatchObject({
        ownerReviewRequested: true,
        workspaceIntegrityOwnerReviewSuppressed: false,
        workspaceIntegrityUncovered: [
          {
            path: workspacePath,
            kind: "unowned-dirty",
            reason: "no-live-task-claim",
          },
        ],
      });
      expect(uncoveredEmitted).toContainEqual(
        expect.objectContaining({
          type: "project.owner.requested",
          target: { project: projectId },
          data: expect.objectContaining({
            project: projectId,
            reason: "workspace-integrity-changed",
            uncovered: [
              {
                path: workspacePath,
                kind: "unowned-dirty",
                reason: "no-live-task-claim",
              },
            ],
          }),
        }),
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("workspace-integrity coverage recognizes filePaths, scopedPaths, and sourcePaths claims", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "workspace-integrity-claim-kinds-"),
    );
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const workspacePath = join(rootDir, "owner-space");
    const fileTaskId = "ops/wait-readme-guidance";
    const scopedTaskId = "ops/wait-fleet-compact";
    const sourceTaskId = "domain/wait-network-acns";
    const workspaceTaskId = "ops/request-approval-owner-space-cleanup";
    const dirtyRelativePaths = [
      "README.md",
      "features/fleet/compact/staging.summary.md",
      "features/network-cni/specs/network-acns-performance-cilium-upgrade.json",
    ];
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      mkdirSync(workspacePath, { recursive: true });
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      git(projectDir, "config", "user.email", "test@example.com");
      git(projectDir, "config", "user.name", "Test");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, "base\n");
      }
      git(projectDir, "add", ...dirtyRelativePaths);
      git(projectDir, "commit", "-m", "base");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        writeFileSync(absolutePath, `base\n${relativePath}\n`);
      }

      const event = {
        type: "aks.workspace.integrity.changed",
        target: { project: projectId },
        data: {
          checkedAt: "2026-07-26T10:05:00.000Z",
          fingerprint: "demo-claim-kinds",
          canonical: {
            branch: "dev",
            head: "abc123",
            expectedHead: "def456",
            clean: false,
            healthy: false,
          },
          anomalies: [
            { path: projectDir, kind: "canonical-unhealthy" },
            { path: projectDir, kind: "unowned-dirty" },
            { path: workspacePath, kind: "unowned-dirty" },
          ],
        },
      };

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: {
            id: "project",
            children: [fileTaskId, scopedTaskId, sourceTaskId, workspaceTaskId],
          },
          [fileTaskId]: {
            id: fileTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              filePaths: ["README.md"],
            },
          },
          [scopedTaskId]: {
            id: scopedTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              scopedPaths: ["features/fleet/compact/staging.summary.md"],
            },
          },
          [sourceTaskId]: {
            id: sourceTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              sourcePaths: [
                "features/network-cni/specs/network-acns-performance-cilium-upgrade.json",
              ],
            },
          },
          [workspaceTaskId]: {
            id: workspaceTaskId,
            phase: "waiting",
            input: {
              workspacePath,
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        event,
      );

      expect(result).toMatchObject({
        ownerReviewRequested: false,
        workspaceIntegrityOwnerReviewSuppressed: true,
      });
      expect(result).toMatchObject({
        workspaceIntegrityCoveredByTask: {
          [`canonical:${join(projectDir, "README.md")}`]: [fileTaskId],
          [`canonical:${join(projectDir, "features/fleet/compact/staging.summary.md")}`]:
            [scopedTaskId],
          [`canonical:${join(projectDir, "features/network-cni/specs/network-acns-performance-cilium-upgrade.json")}`]:
            [sourceTaskId],
          [`unowned-dirty:${workspacePath}`]: [workspaceTaskId],
        },
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("workspace-integrity coverage recognizes nested branch and cleanup path fields", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "workspace-integrity-nested-claims-"),
    );
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const recoveryPath = join(rootDir, "recovery-worktree");
    const dirtyRelativePaths = [
      "evidence/archive/legacy-proof.md",
      "features/localdns.yaml",
      "features/cluster-autoscaler/compact/staging.plan.json",
    ];
    const legacyTaskId = "ops/verify-legacy-branch-demo";
    const localdnsCleanupTaskId = "ops/request-approval-localdns-demo-cleanup";
    const recoveryCleanupTaskId =
      "ops/request-approval-cluster-autoscaler-demo-cleanup";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      mkdirSync(recoveryPath, { recursive: true });
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      git(projectDir, "config", "user.email", "test@example.com");
      git(projectDir, "config", "user.name", "Test");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, "base\n");
      }
      git(projectDir, "add", ...dirtyRelativePaths);
      git(projectDir, "commit", "-m", "base");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        writeFileSync(absolutePath, `base\n${relativePath}\n`);
      }

      const event = {
        type: "aks.workspace.integrity.changed",
        target: { project: projectId },
        data: {
          checkedAt: "2026-07-26T10:10:00.000Z",
          fingerprint: "demo-nested-claims",
          canonical: {
            branch: "dev",
            head: "abc123",
            expectedHead: "def456",
            clean: false,
            healthy: false,
          },
          anomalies: [
            { path: projectDir, kind: "canonical-unhealthy" },
            { path: projectDir, kind: "unowned-dirty" },
            { path: recoveryPath, kind: "unowned-dirty" },
          ],
        },
      };

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: {
            id: "project",
            children: [
              legacyTaskId,
              localdnsCleanupTaskId,
              recoveryCleanupTaskId,
            ],
          },
          [legacyTaskId]: {
            id: legacyTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              branches: [
                {
                  branch: "task/demo",
                  files: ["evidence/archive/legacy-proof.md"],
                },
              ],
            },
          },
          [localdnsCleanupTaskId]: {
            id: localdnsCleanupTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              mirrorSourcePaths: ["features/localdns.yaml"],
            },
          },
          [recoveryCleanupTaskId]: {
            id: recoveryCleanupTaskId,
            phase: "waiting",
            input: {
              canonicalRoot: projectDir,
              recoveryPath,
              staleFiles: [
                "features/cluster-autoscaler/compact/staging.plan.json",
              ],
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        event,
      );

      expect(result).toMatchObject({
        ownerReviewRequested: false,
        workspaceIntegrityOwnerReviewSuppressed: true,
        workspaceIntegrityCoveredByTask: {
          [`canonical:${join(projectDir, "evidence/archive/legacy-proof.md")}`]:
            [legacyTaskId],
          [`canonical:${join(projectDir, "features/localdns.yaml")}`]: [
            localdnsCleanupTaskId,
          ],
          [`canonical:${join(projectDir, "features/cluster-autoscaler/compact/staging.plan.json")}`]:
            [recoveryCleanupTaskId],
          [`unowned-dirty:${recoveryPath}`]: [recoveryCleanupTaskId],
        },
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("workspace-integrity coverage treats source-branch evidence as a live worktree claim", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "workspace-integrity-evidence-claim-"),
    );
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "projects", "aks-rp-e2e");
    const worktreeName =
      "domain-normalize-plain-scenario-carrier-secops-tests-secops-fips-pool-ad-demo";
    const worktreePath = resolve(
      projectDir,
      "../../worktrees",
      basename(projectDir),
      worktreeName,
    );
    const taskId =
      "domain/normalize-plain-scenario-carrier-secops-tests-secops-fips-pool-add-existing.ts-demo";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      mkdirSync(worktreePath, { recursive: true });

      const event = {
        type: "aks.workspace.integrity.changed",
        target: { project: projectId },
        data: {
          checkedAt: "2026-07-27T10:20:00.000Z",
          fingerprint: "demo-evidence-claim",
          canonical: {
            branch: "dev",
            head: "abc123",
            expectedHead: "abc123",
            clean: true,
            healthy: true,
          },
          anomalies: [{ path: worktreePath, kind: "unowned-dirty" }],
        },
      };

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: { id: "project", children: [taskId] },
          [taskId]: {
            id: taskId,
            phase: "pending",
            input: {
              scenarioTestPath:
                "features/secops/tests/secops-fips-pool-add-existing.ts",
            },
            evidence: [
              `source-branch:task/${worktreeName}`,
              "source-commit:demo123",
            ],
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") =>
            path === "../aks-rp-e2e" ? projectDir : resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        event,
      );

      expect(result).toMatchObject({
        ownerReviewRequested: false,
        workspaceIntegrityOwnerReviewSuppressed: true,
        workspaceIntegrityCoveredByTask: {
          [`unowned-dirty:${worktreePath}`]: [taskId],
        },
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("workspace-integrity coverage recognizes live task worktree inference and output-owned canonical slices", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "workspace-integrity-lived-worktree-and-outputs-"),
    );
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "projects", "aks-rp-e2e");
    const worktreePath = resolve(
      projectDir,
      "../../worktrees",
      basename(projectDir),
      "domain-repair-net-integration-cross-tenant-accepted-path-compact-sync-20-d18eaea04b",
    );
    const unmatchedWorktreePath = resolve(
      projectDir,
      "../../worktrees",
      basename(projectDir),
      "domain-repair-net-integration-cross-tenant-accepted-path-compact-sync-20-fffffffffe",
    );
    const netIntegrationTaskId =
      "domain/repair-net-integration-cross-tenant-accepted-path-compact-sync-20260730";
    const knowledgeMapTaskId =
      "domain/reconcile-clean-origin-dev-knowledge-map-slice-ccp-net-private-20260730";
    const knowledgeMapPaths = [
      "model/knowledge-map/model.json",
      "model/knowledge-map/views/evidence-index.md",
      "model/knowledge-map/views/evidence-matrix.json",
      "model/knowledge-map/views/graph-view.json",
      "model/knowledge-map/views/model.generated.md",
      "model/knowledge-map/views/path-summary.json",
      "model/knowledge-map/views/status-summary.json",
    ];
    const uncoveredRelativePath = "features/unclaimed/spec.json";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      mkdirSync(worktreePath, { recursive: true });
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      git(projectDir, "config", "user.email", "test@example.com");
      git(projectDir, "config", "user.name", "Test");
      for (const relativePath of knowledgeMapPaths) {
        const absolutePath = join(projectDir, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, "base\n");
      }
      git(projectDir, "add", ...knowledgeMapPaths);
      git(projectDir, "commit", "-m", "base");
      for (const relativePath of knowledgeMapPaths) {
        const absolutePath = join(projectDir, relativePath);
        writeFileSync(absolutePath, `base\n${relativePath}\n`);
      }

      const coveredEvent = {
        type: "aks.workspace.integrity.changed",
        target: { project: projectId },
        data: {
          checkedAt: "2026-07-30T15:23:45.769Z",
          fingerprint: "demo-lived-worktree-and-outputs-covered",
          canonical: {
            branch: "dev",
            head: "489628037a4ef9a8ae54e91765eb2f2663d775d4",
            expectedHead: "d4a775c0ac42ed1b4eca2c952c0f18ead2b0b11d",
            clean: false,
            healthy: false,
          },
          anomalies: [
            { path: projectDir, kind: "canonical-unhealthy" },
            { path: projectDir, kind: "unowned-dirty" },
            { path: worktreePath, kind: "unowned-dirty" },
          ],
        },
      };

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: {
            id: "project",
            children: [netIntegrationTaskId, knowledgeMapTaskId],
          },
          [netIntegrationTaskId]: {
            id: netIntegrationTaskId,
            generation: 1,
            phase: "pending",
            input: {
              baseRef: "origin/dev",
              featureKey: "net-integration",
            },
          },
          [knowledgeMapTaskId]: {
            id: knowledgeMapTaskId,
            phase: "waiting",
            outputs: knowledgeMapPaths,
          },
        },
      });

      const coveredEmitted: Record<string, unknown>[] = [];
      const coveredResult = await routeAksEvent(
        {
          appPath: (path = ".") =>
            path === "../aks-rp-e2e" ? projectDir : resolve(appDir, path),
          emit: (value: Record<string, unknown>) => coveredEmitted.push(value),
        } as never,
        coveredEvent,
      );

      expect(coveredResult).toMatchObject({
        ownerReviewRequested: false,
        workspaceIntegrityOwnerReviewSuppressed: true,
        workspaceIntegrityCoveredByTask: {
          [`unowned-dirty:${worktreePath}`]: [netIntegrationTaskId],
          [`canonical:${join(projectDir, "model/knowledge-map/model.json")}`]: [
            knowledgeMapTaskId,
          ],
          [`canonical:${join(projectDir, "model/knowledge-map/views/evidence-index.md")}`]:
            [knowledgeMapTaskId],
          [`canonical:${join(projectDir, "model/knowledge-map/views/evidence-matrix.json")}`]:
            [knowledgeMapTaskId],
          [`canonical:${join(projectDir, "model/knowledge-map/views/graph-view.json")}`]:
            [knowledgeMapTaskId],
          [`canonical:${join(projectDir, "model/knowledge-map/views/model.generated.md")}`]:
            [knowledgeMapTaskId],
          [`canonical:${join(projectDir, "model/knowledge-map/views/path-summary.json")}`]:
            [knowledgeMapTaskId],
          [`canonical:${join(projectDir, "model/knowledge-map/views/status-summary.json")}`]:
            [knowledgeMapTaskId],
        },
      });
      expect(coveredEmitted).toEqual([]);

      mkdirSync(dirname(join(projectDir, uncoveredRelativePath)), {
        recursive: true,
      });
      writeFileSync(
        join(projectDir, uncoveredRelativePath),
        "base\nuncovered\n",
      );
      mkdirSync(unmatchedWorktreePath, { recursive: true });

      const uncoveredEmitted: Record<string, unknown>[] = [];
      const uncoveredResult = await routeAksEvent(
        {
          appPath: (path = ".") =>
            path === "../aks-rp-e2e" ? projectDir : resolve(appDir, path),
          emit: (value: Record<string, unknown>) =>
            uncoveredEmitted.push(value),
        } as never,
        {
          ...coveredEvent,
          data: {
            ...coveredEvent.data,
            fingerprint: "demo-lived-worktree-and-outputs-uncovered",
            anomalies: [
              ...coveredEvent.data.anomalies,
              { path: unmatchedWorktreePath, kind: "unowned-dirty" },
            ],
          },
        },
      );

      expect(uncoveredResult).toMatchObject({
        ownerReviewRequested: true,
        workspaceIntegrityOwnerReviewSuppressed: false,
        workspaceIntegrityUncovered: [
          {
            path: unmatchedWorktreePath,
            kind: "unowned-dirty",
            reason: "no-live-task-claim",
          },
          {
            path: join(projectDir, uncoveredRelativePath),
            kind: "canonical-dirty-path",
            reason: "no-live-task-claim",
          },
        ],
      });
      expect(uncoveredEmitted).toContainEqual(
        expect.objectContaining({
          type: "project.owner.requested",
          target: { project: projectId },
          data: expect.objectContaining({
            project: projectId,
            reason: "workspace-integrity-changed",
            uncovered: [
              {
                path: unmatchedWorktreePath,
                kind: "unowned-dirty",
                reason: "no-live-task-claim",
              },
              {
                path: join(projectDir, uncoveredRelativePath),
                kind: "canonical-dirty-path",
                reason: "no-live-task-claim",
              },
            ],
          }),
        }),
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("workspace-integrity coverage lets compact holders cover feature compact and source directories", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "workspace-integrity-compact-holder-"),
    );
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const compactTaskId = "wait-compact-traffic-alb-controller-demo";
    const dirtyRelativePaths = [
      "features/traffic-alb-controller/compact/staging.summary.md",
      "features/traffic-alb-controller/specs/traffic-alb-controller-ingress-routing.json",
      "features/traffic-alb-controller/tests/alb-live-shared.test.ts",
      "features/traffic-alb-controller/lib/demo-helper.ts",
    ];
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      git(projectDir, "config", "user.email", "test@example.com");
      git(projectDir, "config", "user.name", "Test");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, "base\n");
      }
      git(projectDir, "add", ...dirtyRelativePaths);
      git(projectDir, "commit", "-m", "base");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        writeFileSync(absolutePath, `base\n${relativePath}\n`);
      }

      const event = {
        type: "aks.workspace.integrity.changed",
        target: { project: projectId },
        data: {
          checkedAt: "2026-07-26T10:12:00.000Z",
          fingerprint: "demo-compact-holder",
          canonical: {
            branch: "dev",
            head: "abc123",
            expectedHead: "def456",
            clean: false,
            healthy: false,
          },
          anomalies: [
            { path: projectDir, kind: "canonical-unhealthy" },
            { path: projectDir, kind: "unowned-dirty" },
          ],
        },
      };

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: { id: "project", children: [compactTaskId] },
          [compactTaskId]: {
            id: compactTaskId,
            phase: "waiting",
            input: {
              featureKey: "traffic-alb-controller",
              packetPath: "features/traffic-alb-controller.yaml",
              specId: "spec.traffic-alb-controller.ingress-routing",
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        event,
      );

      expect(result).toMatchObject({
        ownerReviewRequested: false,
        workspaceIntegrityOwnerReviewSuppressed: true,
      });
      expect(result).toMatchObject({
        workspaceIntegrityCoveredByTask: {
          [`canonical:${join(projectDir, "features/traffic-alb-controller/compact/staging.summary.md")}`]:
            [compactTaskId],
          [`canonical:${join(projectDir, "features/traffic-alb-controller/specs/traffic-alb-controller-ingress-routing.json")}`]:
            [compactTaskId],
          [`canonical:${join(projectDir, "features/traffic-alb-controller/tests/alb-live-shared.test.ts")}`]:
            [compactTaskId],
          [`canonical:${join(projectDir, "features/traffic-alb-controller/lib/demo-helper.ts")}`]:
            [compactTaskId],
        },
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("workspace-integrity coverage lets hold-compact holders cover canonical compact plan paths", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "workspace-integrity-hold-compact-holder-"),
    );
    const appDir = join(rootDir, "aks-rp-e2e.app");
    const projectDir = join(rootDir, "aks-rp-e2e");
    const compactTaskId = "hold-compact-ccp-coredns-demo";
    const dirtyRelativePaths = [
      "features/ccp-coredns/compact/staging.plan.json",
      "features/ccp-coredns/compact/staging.summary.md",
    ];
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      git(projectDir, "config", "user.email", "test@example.com");
      git(projectDir, "config", "user.name", "Test");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, "base\n");
      }
      git(projectDir, "add", ...dirtyRelativePaths);
      git(projectDir, "commit", "-m", "base");
      for (const relativePath of dirtyRelativePaths) {
        const absolutePath = join(projectDir, relativePath);
        writeFileSync(absolutePath, `base\n${relativePath}\n`);
      }

      const event = {
        type: "aks.workspace.integrity.changed",
        target: { project: projectId },
        data: {
          checkedAt: "2026-07-28T09:49:04.555Z",
          fingerprint: "demo-hold-compact-holder",
          canonical: {
            branch: "dev",
            head: "abc123",
            expectedHead: "def456",
            clean: false,
            healthy: false,
          },
          anomalies: [
            { path: projectDir, kind: "canonical-unhealthy" },
            { path: projectDir, kind: "unowned-dirty" },
          ],
        },
      };

      writeJson(resolve(appDir, ".state/tasks/tree.json"), {
        root_task_id: "project",
        tasks: {
          project: { id: "project", children: [compactTaskId] },
          [compactTaskId]: {
            id: compactTaskId,
            phase: "converged",
            input: {
              featureKey: "ccp-coredns",
              summaryPath: "features/ccp-coredns/compact/staging.summary.md",
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        event,
      );

      expect(result).toMatchObject({
        ownerReviewRequested: false,
        workspaceIntegrityOwnerReviewSuppressed: true,
      });
      expect(result).toMatchObject({
        workspaceIntegrityCoveredByTask: {
          [`canonical:${join(projectDir, "features/ccp-coredns/compact/staging.plan.json")}`]:
            [compactTaskId],
          [`canonical:${join(projectDir, "features/ccp-coredns/compact/staging.summary.md")}`]:
            [compactTaskId],
        },
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
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

  test("resolver maps semantic events to stable domain tasks", async () => {
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
      priority: "P1",
    });
    expect(ownerA?.acceptance?.join("\n")).toContain(
      "scenario-normalization is the sole frontier and live-capacity owner",
    );
    expect(ownerA?.acceptance?.join("\n")).toContain(
      "wake the existing scenario-normalization task",
    );
    expect(ownerB?.id).toBe(ownerA?.id);
    expect(ownerA?.workflow).toBeUndefined();
    expect(ownerA?.input).toBeUndefined();
    expect(ownerB?.input).toBeUndefined();

    expect(
      resolveAksTask({
        type: "project.comment.created",
        target: { project: projectId },
        data: { author: "hao", comment: "continue the current goal" },
      }),
    ).toMatchObject({ id: "runtime/owner-review", priority: "P0" });
    expect(
      resolveAksTask({
        type: "project.owner.requested",
        target: { project: projectId },
        data: {
          project: projectId,
          reason: "owner-message",
          inputEventType: "message.created",
        },
      }),
    ).toMatchObject({ id: "runtime/owner-review", priority: "P0" });

    const earlyFailure = {
      type: "pipeline.test.nonpassing",
      target: { project: projectId },
      data: {
        pipelineRunId: "173790426",
        specId: "spec.example",
        status: "fail",
      },
    };
    expect(resolveAksTask(earlyFailure)).toBeNull();
    expect(eventIsHandled(earlyFailure)).toBe(true);
    const earlyFailureEmits: Record<string, unknown>[] = [];
    await expect(
      routeAksEvent(
        {
          emit: (value: Record<string, unknown>) =>
            earlyFailureEmits.push(value),
        } as never,
        earlyFailure,
      ),
    ).resolves.toMatchObject({
      masterValidationFailureRouted: false,
      ownerReviewRequested: true,
      reason: "non-aggregate-task-owner-review-requested",
    });
    expect(earlyFailureEmits).toEqual([
      expect.objectContaining({
        type: "project.owner.requested",
        source: "aks-rp-e2e-app",
        target: { project: projectId },
        data: expect.objectContaining({
          project: projectId,
          reason: "pipeline-test-nonpassing",
          pipelineRunId: "173790426",
          specId: "spec.example",
          status: "fail",
        }),
      }),
    ]);
    expect(resolveAksTask(earlyFailureEmits[0])).toMatchObject({
      id: "runtime/owner-review",
      mode: "maintain",
      owner: "app-ops",
    });

    const routedFailures: Record<string, unknown>[] = [];
    const progressiveFailure = {
      type: "pipeline.test.nonpassing",
      target: { project: projectId },
      validationTaskId: "master-validation-staging-cycle",
      validationGeneration: "6",
      data: {
        project: projectId,
        validationTaskId: "master-validation-staging-cycle",
        validationGeneration: "6",
        pipelineRunId: "174796530",
        sourceBranch: "refs/heads/validation/master-validation-173853081",
        sourceVersion: "3ffc651bdbaccc9ba08e47d2eb9671ede3aad2f4",
        specId: "spec.managed-namespaces.lifecycle",
        sliceId: "05",
        status: "fail",
        category: "unknown",
        reason:
          "Azure timeline reported a failure before artifacts were available.",
        phase: "provider-timeline",
        phaseDetail: "completed",
        failureFingerprint: "0d59e858d6a1339cb058",
      },
    };
    expect(progressiveFailure).not.toHaveProperty("taskId");
    expect(progressiveFailure.data).not.toHaveProperty("taskId");

    await expect(
      routeAksEvent(
        {
          emit: (value: Record<string, unknown>) => routedFailures.push(value),
        } as never,
        progressiveFailure,
      ),
    ).resolves.toMatchObject({
      masterValidationFailureRouted: false,
      ownerReviewRequested: true,
      reason: "master-validation-progressive-awaiting-artifact",
    });
    expect(routedFailures).toHaveLength(1);
    expect(routedFailures[0]).toMatchObject({
      type: "project.owner.requested",
      source: "aks-rp-e2e-app",
      target: { project: projectId },
      data: expect.objectContaining({
        reason: "master-validation-progressive-nonpassing",
        validationTaskId: "master-validation-staging-cycle",
        pipelineRunId: "174796530",
        specId: "spec.managed-namespaces.lifecycle",
        summary: expect.stringContaining(
          "wait for this run's pipeline.failure.observed event",
        ),
      }),
    });
    expect(routedFailures[0]).not.toHaveProperty("taskId");
    expect(resolveAksTask(routedFailures[0])).toMatchObject({
      id: "runtime/owner-review",
      owner: "app-ops",
    });

    const appDir = mkdtempSync(join(tmpdir(), "master-validation-no-reuse-"));
    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        resources: {
          "domain/master-validation-failure/spec.managed-namespaces.lifecycle/c17abe6e8a69376e9e6f":
            {
              metadata: { generation: 46, resourceVersion: 210 },
              spec: {
                parentId: "group/domain-work",
                outcome:
                  "Classify and resolve the progressively observed master-validation failure or temporary admission exclusion for spec.managed-namespaces.lifecycle without waiting for the aggregate pipeline to finish.",
                acceptance: [
                  "Keep the stable managed-namespaces carrier current.",
                ],
                mode: "achieve",
                owner: "aks-explorer",
                workflow: "master-validation-failure",
                input: {
                  pipelineRunId: "174826569",
                  sourceBranch:
                    "refs/heads/validation/master-validation-173853081",
                  sourceCommit: "3ffc651bdbaccc9ba08e47d2eb9671ede3aad2f4",
                  specId: "spec.managed-namespaces.lifecycle",
                  status: "fail",
                  category: "product_failure",
                  reason: "one or more public kube validations failed",
                  failureFingerprint: "c17abe6e8a69376e9e6f",
                  artifactName: "slice-05-test-results",
                  artifactPath:
                    "/artifacts/174826569/slice-05-test-results/result.json",
                },
                priority: "P0",
                category: "domain",
              },
              status: { phase: "waiting" },
            },
        },
      });

      const progressiveEvents: Record<string, unknown>[] = [];
      await expect(
        routeAksEvent(
          {
            appPath: (path = ".") => resolve(appDir, path),
            emit: (value: Record<string, unknown>) =>
              progressiveEvents.push(value),
          } as never,
          progressiveFailure,
        ),
      ).resolves.toMatchObject({
        masterValidationFailureRouted: false,
        ownerReviewRequested: true,
        reason: "master-validation-progressive-awaiting-artifact",
      });
      expect(progressiveEvents).toEqual([
        expect.objectContaining({
          type: "project.owner.requested",
          source: "aks-rp-e2e-app",
          target: { project: projectId },
          data: expect.objectContaining({
            pipelineRunId: "174796530",
            specId: "spec.managed-namespaces.lifecycle",
            reason: "master-validation-progressive-nonpassing",
          }),
        }),
      ]);
      expect(JSON.stringify(progressiveEvents)).not.toContain(
        "/artifacts/174826569/",
      );
      expect(JSON.stringify(progressiveEvents)).not.toContain(
        "one or more public kube validations failed",
      );
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }

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
        action: "master-validation-compact",
        target: { project: projectId, taskId: "master-validation-compact" },
      }),
    ).toMatchObject({
      id: "master-validation-compact",
      parentId: "group/feature-compact",
      owner: "aks-explorer",
      mode: "maintain",
      priority: "P0",
      input: {
        selectorPath: "ci/feature-sets/master-validation.txt",
        maximumClusterCreates: 16,
      },
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
      priority: "P1",
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
        type: "project.problem.investigation.requested",
        target: { project: projectId },
        problemKey: "localdns-producerless-project-state-condition-20260730",
        taskId: "hold-compact-localdns-split-frontier-e8d7677892-20260730",
      })?.input,
    ).toMatchObject({
      problemKey: "localdns-producerless-project-state-condition-20260730",
      targetTaskId: "hold-compact-localdns-split-frontier-e8d7677892-20260730",
    });
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
          authority: "human",
          requiresHumanDecision: true,
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
        authority: "human",
        requiresHumanDecision: true,
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
        expect.objectContaining({
          type: "project.task.tick",
          action: "master-validation-compact",
          target: { project: projectId, taskId: "master-validation-compact" },
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
    expect(schedule?.intervalMs).toBe(21_600_000);
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

  test("an active frozen campaign emits exactly one semantic capacity pulse from the raw check", async () => {
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
      expect(emitted).toEqual([
        expect.objectContaining({
          type: masterValidationCapacityPulseEventType,
          target: { project: projectId },
          data: expect.objectContaining({
            project: projectId,
            gateReason: "campaign-active",
            cycleSlot: expect.any(Number),
            idempotencyKey: expect.stringMatching(
              /^aks-master-validation-capacity-pulse:aks-rp-e2e:\d+$/,
            ),
          }),
        }),
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("a semantic capacity pulse wakes the master-validation cycle exactly once", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "master-validation-capacity-pulse-"),
    );
    try {
      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: masterValidationCapacityPulseEventType,
          target: { project: projectId },
          data: {
            project: projectId,
            gateReason: "campaign-active",
            cycleSlot: 82676,
          },
        },
      );
      expect(result).toEqual({
        masterValidationCapacityPulseObserved: true,
        masterValidationCycleWake: true,
        reason: "campaign-active",
        cycleSlot: 82676,
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
            reason: "master-validation-campaign-reconcile",
            cycleSlot: 82676,
          }),
        }),
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("an exact focused PR-head pass overrides the aggregate wait to publish its PR immediately", async () => {
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
            sourceBranch: "refs/heads/task/node-ephemeral",
            sourceCommit: "fix123",
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

  test("master validation gate emits one semantic capacity pulse after the receipt interval elapses", async () => {
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
        capacityPulseEmitted: true,
        reason: "interval-elapsed",
        queuedAt,
        runId: "173596985",
        cycleSlot: expect.any(Number),
      });
      expect(emitted).toEqual([
        expect.objectContaining({
          type: masterValidationCapacityPulseEventType,
          target: { project: projectId },
          data: expect.objectContaining({
            project: projectId,
            gateReason: "interval-elapsed",
            cycleSlot: expect.any(Number),
            idempotencyKey: expect.stringMatching(
              /^aks-master-validation-capacity-pulse:aks-rp-e2e:\d+$/,
            ),
            queuedAt,
            runId: "173596985",
            sourceCommit: "b6ed0123763895f4584db2e3337145998e44b009",
          }),
        }),
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("two due raw checks in the same slot emit the same dedupable semantic pulse payload, and the next slot changes it", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "master-validation-gate-dedupe-"),
    );
    const realNow = Date.now;
    const baseNow = 82676 * 21_600_000 + 1234;
    const queuedAt = new Date(
      baseNow - (6 * 60 * 60_000 + 5 * 60_000),
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

      Date.now = () => baseNow;
      const firstEmitted: Record<string, unknown>[] = [];
      const secondEmitted: Record<string, unknown>[] = [];
      const nextSlotEmitted: Record<string, unknown>[] = [];

      await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => firstEmitted.push(value),
        } as never,
        {
          type: "aks.master-validation.check",
          target: { project: projectId },
        },
      );

      await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => secondEmitted.push(value),
        } as never,
        {
          type: "aks.master-validation.check",
          target: { project: projectId },
        },
      );

      Date.now = () => baseNow + 21_600_000;
      await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => nextSlotEmitted.push(value),
        } as never,
        {
          type: "aks.master-validation.check",
          target: { project: projectId },
        },
      );

      expect(firstEmitted).toHaveLength(1);
      expect(secondEmitted).toHaveLength(1);
      expect(nextSlotEmitted).toHaveLength(1);

      const firstData = firstEmitted[0]?.data as Record<string, unknown>;
      const secondData = secondEmitted[0]?.data as Record<string, unknown>;
      const nextSlotData = nextSlotEmitted[0]?.data as Record<string, unknown>;

      expect(firstData).toEqual(secondData);
      expect(firstData).toMatchObject({
        project: projectId,
        gateReason: "interval-elapsed",
        cycleSlot: masterValidationCycleSlot(baseNow),
        idempotencyKey: masterValidationCapacityPulseIdempotencyKey(
          masterValidationCycleSlot(baseNow),
        ),
        queuedAt,
        runId: "173596985",
        sourceCommit: "b6ed0123763895f4584db2e3337145998e44b009",
      });
      expect(nextSlotData).toMatchObject({
        project: projectId,
        gateReason: "interval-elapsed",
        cycleSlot: masterValidationCycleSlot(baseNow + 21_600_000),
        idempotencyKey: masterValidationCapacityPulseIdempotencyKey(
          masterValidationCycleSlot(baseNow + 21_600_000),
        ),
      });
      expect(nextSlotData).not.toEqual(firstData);
    } finally {
      Date.now = realNow;
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("semantic master-validation capacity pulses wake the cycle once without re-emitting themselves", async () => {
    const emitted: Record<string, unknown>[] = [];
    const result = await routeAksEvent(
      {
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: masterValidationCapacityPulseEventType,
        target: { project: projectId },
        data: {
          project: projectId,
          gateReason: "interval-elapsed",
          cycleSlot: 123,
        },
      },
    );

    expect(
      eventIsHandled({
        type: masterValidationCapacityPulseEventType,
        target: { project: projectId },
      }),
    ).toBe(true);
    expect(result).toEqual({
      masterValidationCapacityPulseObserved: true,
      masterValidationCycleWake: true,
      reason: "interval-elapsed",
      cycleSlot: 123,
    });
    expect(emitted).toEqual([
      expect.objectContaining({
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
          cycleSlot: 123,
        },
      }),
    ]);
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

    expect(
      actionEvent("pulse-master-validation-compact", { taskId: "loop-m" }),
    ).toMatchObject({
      type: "project.task.tick",
      action: "master-validation-compact",
      target: { project: projectId, taskId: "loop-m" },
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

  test("does not keep an app-local waiting-frontier scheduler", () => {
    const schedule = appManifest.schedules?.find(
      (entry) => entry.id === "blocked-frontier-app-ops-review",
    );
    expect(schedule).toBeUndefined();
    expect(
      resolveAksTask({
        type: "project.task.tick",
        target: {
          project: projectId,
          taskId: "runtime/waiting-frontier-review",
        },
        action: "waiting-frontier-review",
      }),
    ).toBeNull();
  });

  test("suppresses an unchanged strict-red wait-only frontier without a recovery scan", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "scenario-inventory-dedupe-"));

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          "scenario-normalization": {
            status: {
              phase: "converged",
              summary: "Agent-authored summary is not machine parsed.",
              evidence: [
                "origin-dev-commit:23d754e9ce82252103471e106a7ce7e43f5b6209",
                "strict-passed:false",
                "missing-adapters:0",
                "remaining-spec-referenced-plain-scenario-units:22",
                "remaining-repo-plain-scenario-files:100",
                "declared-normalization-actions:0",
                "actionable-plain-rows:0",
                "waiting-plain-rows:22",
                "unrepresented-plain-rows:0",
              ],
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.scenario-test-inventory.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            observation: {
              observedAt: "2026-07-29T23:49:34.251Z",
              sourceRef: "origin/dev",
              sourceCommit: "23d754e9ce82252103471e106a7ce7e43f5b6209",
              sourceKind: "clean-ref-worktree",
              state: "red",
              strictPassed: false,
              activeSpecCount: 701,
              referencedPlainActiveSpecCount: 22,
              referencedScenarioWithAdapterCount: 22,
              directVitestImplementationCount: 674,
              remainingSpecReferencedPlainScenarioCount: 22,
              remainingRepoPlainScenarioFileCount: 100,
              missingAdapterFiles: [],
            },
          },
        },
      );

      expect(result).toEqual({
        taskId: "scenario-normalization",
        observed: true,
        wakeSuppressed: true,
      });
      expect(emitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("does not suppress a changed strict-inventory frontier commit", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "scenario-inventory-commit-change-"),
    );

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          "scenario-normalization": {
            status: {
              phase: "converged",
              summary:
                "Scenario frontier remains strict-red on origin/dev 23d754e9ce82252103471e106a7ce7e43f5b6209 with zero missing adapter files: declared 0 bounded plain-carrier normalization task action(s), observed 0 actionable and 22 waiting plain-carrier task(s), counted 0 exact pipeline-backed wait(s) and 0 pending owner-adjudication handoff(s) against live execution capacity for 0/5 occupied slot(s), found 22 current spec-referenced plain scenario unit(s), 100 remaining repo plain scenario file(s), and 0 row(s) represented only by attention or stale terminal residue.",
              evidence: [
                "origin-dev-commit:23d754e9ce82252103471e106a7ce7e43f5b6209",
                "strict-passed:false",
                "missing-adapters:0",
                "remaining-spec-referenced-plain-scenario-units:22",
                "remaining-repo-plain-scenario-files:100",
                "declared-normalization-actions:0",
                "actionable-plain-rows:0",
                "waiting-plain-rows:22",
                "unrepresented-plain-rows:0",
              ],
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.scenario-test-inventory.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            observation: {
              observedAt: "2026-07-30T00:10:00.000Z",
              sourceRef: "origin/dev",
              sourceCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              sourceKind: "clean-ref-worktree",
              state: "red",
              strictPassed: false,
              remainingSpecReferencedPlainScenarioCount: 22,
              remainingRepoPlainScenarioFileCount: 100,
              missingAdapterFiles: [],
            },
          },
        },
      );

      expect(result).toEqual({
        taskId: "scenario-normalization",
        observed: true,
        wakeSuppressed: false,
      });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        type: "project.task.tick",
        target: { project: projectId, taskId: "scenario-normalization" },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("does not suppress when the latest converged frontier shows uncovered or actionable drift", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "scenario-inventory-uncovered-"));

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          "scenario-normalization": {
            status: {
              phase: "converged",
              summary:
                "Scenario frontier remains strict-red on origin/dev 23d754e9ce82252103471e106a7ce7e43f5b6209 with zero missing adapter files: declared 0 bounded plain-carrier normalization task action(s), observed 0 actionable and 22 waiting plain-carrier task(s), counted 0 exact pipeline-backed wait(s) and 0 pending owner-adjudication handoff(s) against live execution capacity for 0/5 occupied slot(s), found 22 current spec-referenced plain scenario unit(s), 100 remaining repo plain scenario file(s), and 0 row(s) represented only by attention or stale terminal residue.",
              evidence: [
                "origin-dev-commit:23d754e9ce82252103471e106a7ce7e43f5b6209",
                "strict-passed:false",
                "missing-adapters:0",
                "remaining-spec-referenced-plain-scenario-units:22",
                "remaining-repo-plain-scenario-files:100",
                "declared-normalization-actions:0",
                "actionable-plain-rows:0",
                "waiting-plain-rows:22",
                "unrepresented-plain-rows:1",
              ],
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.scenario-test-inventory.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            observation: {
              observedAt: "2026-07-29T23:49:34.251Z",
              sourceRef: "origin/dev",
              sourceCommit: "23d754e9ce82252103471e106a7ce7e43f5b6209",
              sourceKind: "clean-ref-worktree",
              state: "red",
              strictPassed: false,
              remainingSpecReferencedPlainScenarioCount: 22,
              remainingRepoPlainScenarioFileCount: 100,
              missingAdapterFiles: [],
            },
          },
        },
      );

      expect(result).toEqual({
        taskId: "scenario-normalization",
        observed: true,
        wakeSuppressed: false,
      });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        type: "project.task.tick",
        target: { project: projectId, taskId: "scenario-normalization" },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("routes active PR review changes to the existing master-validation carrier and suppresses repeated fingerprints", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "pr-review-change-route-"));
    const taskId =
      "domain/master-validation-failure/spec.rp-cluster-lifecycle.delete-node-resource-group-reconcile";
    const reviewEvent = {
      type: "pull-request.state",
      target: { project: projectId },
      eventId: 5085818,
      data: {
        pullRequestId: "16692153",
        state: "active",
        unresolvedReviewCount: 2,
        reviewFingerprint: "df13be91ae2f50be",
        unresolvedReviewThreads: [
          {
            threadId: "255297856",
            path: "runner/scenario-lib/aks-run-command.ts",
            author: "Reviewer One",
            content: "Sensitive Data Handling",
          },
          {
            threadId: "255297859",
            path: "runner/scenario-lib/aks-run-command.test.ts",
            author: "Reviewer Two",
            content: "Resource Management",
          },
        ],
      },
    };

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [taskId]: {
            metadata: { id: taskId, generation: 4, resourceVersion: 27 },
            spec: {
              owner: "aks-explorer",
              workflow: "master-validation-failure",
              input: {
                specId:
                  "spec.rp-cluster-lifecycle.delete-node-resource-group-reconcile",
                sourceCommit: "c23744c1c547f8a166ee23a74b1c19b7c4277cb1",
              },
            },
            status: {
              phase: "waiting",
              evidence: [
                "pull-request:16692153",
                "pull-request-review-fingerprint:prior-review-fingerprint",
              ],
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        reviewEvent,
      );

      expect(result).toEqual({
        pullRequestObserved: true,
        pullRequestId: "16692153",
        state: "active",
        unresolvedReviewCount: 2,
        masterValidationFailureWake: true,
        taskId,
        reviewFingerprint: "df13be91ae2f50be",
      });
      expect(emitted).toEqual([
        expect.objectContaining({
          type: "project.task.tick",
          source: "aks-rp-e2e-app",
          target: { project: projectId, taskId },
          action: "master-validation-failure",
          overrideWait: true,
          data: {
            project: projectId,
            taskId,
            task_id: taskId,
            reason: "pull-request-review-changed",
            overrideWait: true,
            pullRequestId: "16692153",
            unresolvedReviewCount: 2,
            reviewFingerprint: "df13be91ae2f50be",
            pullRequestStateEventId: 5085818,
            unresolvedReviewThreads: [
              {
                threadId: "255297856",
                path: "runner/scenario-lib/aks-run-command.ts",
                author: "Reviewer One",
                content: "Sensitive Data Handling",
              },
              {
                threadId: "255297859",
                path: "runner/scenario-lib/aks-run-command.test.ts",
                author: "Reviewer Two",
                content: "Resource Management",
              },
            ],
            summary: expect.stringContaining("255297856,255297859"),
          },
        }),
      ]);

      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [taskId]: {
            metadata: { id: taskId, generation: 5, resourceVersion: 28 },
            spec: {
              owner: "aks-explorer",
              workflow: "master-validation-failure",
              input: {
                specId:
                  "spec.rp-cluster-lifecycle.delete-node-resource-group-reconcile",
                sourceCommit: "c23744c1c547f8a166ee23a74b1c19b7c4277cb1",
              },
            },
            status: {
              phase: "waiting",
              evidence: [
                "pull-request:16692153",
                "pull-request-review-fingerprint:df13be91ae2f50be",
              ],
            },
          },
        },
      });

      const repeatedEmitted: Record<string, unknown>[] = [];
      const repeated = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => repeatedEmitted.push(value),
        } as never,
        reviewEvent,
      );

      expect(repeated).toEqual({
        pullRequestObserved: true,
        pullRequestId: "16692153",
        state: "active",
        unresolvedReviewCount: 2,
        masterValidationFailureWake: false,
        taskId,
        reviewFingerprint: "df13be91ae2f50be",
      });
      expect(repeatedEmitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("routes PR review changes to the standalone route-verification carrier", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "route-proof-pr-review-route-"));
    const taskId =
      "domain/master-validation-route-verification/spec.service-platform.queuewatcher/b89108cb16c9";

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [taskId]: {
            metadata: { id: taskId, generation: 1, resourceVersion: 20 },
            spec: {
              owner: "aks-explorer",
              workflow: "master-validation-route-verification",
              input: { specId: "spec.service-platform.queuewatcher" },
            },
            status: {
              phase: "waiting",
              evidence: [
                "pull-request:16730865",
                "pull-request-review-fingerprint:prior-review",
                "pull-request-unresolved-review-count:0",
              ],
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "pull-request.state",
          target: { project: projectId },
          eventId: 5278509,
          data: {
            pullRequestId: "16730865",
            state: "active",
            unresolvedReviewCount: 2,
            reviewFingerprint: "ecb147cc40a69592",
            unresolvedReviewThreads: [
              { threadId: "255816679", content: "Protect cluster cleanup." },
              {
                threadId: "255816685",
                content: "Protect resource-group cleanup.",
              },
            ],
          },
        },
      );

      expect(result).toMatchObject({
        masterValidationFailureWake: true,
        taskId,
        reviewFingerprint: "ecb147cc40a69592",
      });
      expect(emitted).toEqual([
        expect.objectContaining({
          type: "project.task.tick",
          target: { project: projectId, taskId },
          action: "master-validation-route-verification",
          data: expect.objectContaining({
            reason: "pull-request-review-changed",
            pullRequestId: "16730865",
            unresolvedReviewCount: 2,
            pullRequestStateEventId: 5278509,
          }),
        }),
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("wakes the active master-validation campaign for a changed focused PR head only until it is integrated", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "campaign-pr-head-route-"));
    const taskId =
      "domain/master-validation-failure/spec.service-platform.queuewatcher";
    const pullRequestId = "16712127";
    const sourceCommit = "5c995c8fd3542cce4128dad84cd845a96076725a";
    const campaignBase = "5f4c00f34fb32cacc2d70f188599a3599d1a64fa";
    const campaign = {
      schemaVersion: "1",
      baselineRunId: "175600111",
      baseCommit: campaignBase,
      branch: "validation/master-validation-175600111",
      currentCommit: "97efc154a4eabb7b49adba8fc3884301a10f84f5",
      integratedFixes: [],
      updatedAt: "2026-08-07T07:21:39.115Z",
    };
    const pullRequestEvent = {
      type: "pull-request.state",
      target: { project: projectId },
      data: {
        pullRequestId,
        state: "active",
        sourceCommit,
        unresolvedReviewCount: 0,
      },
    };

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [taskId]: {
            metadata: { id: taskId, generation: 4, resourceVersion: 31 },
            spec: {
              owner: "aks-explorer",
              workflow: "master-validation-failure",
              input: { specId: "spec.service-platform.queuewatcher" },
            },
            status: {
              phase: "waiting",
              evidence: [
                `pull-request:${pullRequestId}`,
                `campaign-base:${campaignBase}`,
                `source-commit:${sourceCommit}`,
              ],
            },
          },
        },
      });
      writeJson(
        resolve(appDir, ".state/master-validation-campaign.json"),
        campaign,
      );

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        pullRequestEvent,
      );

      expect(result).toEqual({
        pullRequestObserved: true,
        pullRequestId,
        state: "active",
        unresolvedReviewCount: 0,
        masterValidationFailureWake: false,
        masterValidationCycleWake: true,
        taskId,
        reviewFingerprint: null,
      });
      expect(emitted).toEqual([
        {
          type: "project.task.tick",
          source: "aks-rp-e2e-app",
          target: {
            project: projectId,
            taskId: "master-validation-staging-cycle",
          },
          action: "master-validation-cycle",
          overrideWait: true,
          data: {
            project: projectId,
            taskId: "master-validation-staging-cycle",
            task_id: "master-validation-staging-cycle",
            reason: "master-validation-focused-pr-changed",
            overrideWait: true,
            pullRequestId,
            sourceCommit,
            repairTaskId: taskId,
          },
        },
      ]);

      writeJson(resolve(appDir, ".state/master-validation-campaign.json"), {
        ...campaign,
        integratedFixes: [
          {
            pullRequestId,
            taskId,
            sourceBranch: "task/queuewatcher",
            sourceCommit,
            campaignBaseCommit: campaignBase,
            targetCommit: campaignBase,
            title: "Fix Queuewatcher admission",
            patchIds: ["patch-id"],
          },
        ],
      });
      const repeatedEmitted: Record<string, unknown>[] = [];
      const repeated = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => repeatedEmitted.push(value),
        } as never,
        pullRequestEvent,
      );
      expect(repeated).toEqual({
        pullRequestObserved: true,
        pullRequestId,
        state: "active",
        unresolvedReviewCount: 0,
        masterValidationFailureWake: false,
        taskId,
        reviewFingerprint: null,
      });
      expect(repeatedEmitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("routes active PR review changes to an existing non-spec publication carrier and suppresses repeated fingerprints", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "pr-review-change-publication-route-"),
    );
    const taskId =
      "domain/publish-master-validation-current-main-direct-node-proof-repair-8a462485-20260804";
    const reviewEvent = {
      type: "pull-request.state",
      target: { project: projectId },
      eventId: 5099625,
      data: {
        pullRequestId: "16693575",
        state: "active",
        unresolvedReviewCount: 1,
        reviewFingerprint: "ee3dd77a3da02bc8",
        unresolvedReviewThreads: [
          {
            threadId: "255301000",
            path: "/features/node-pool-config/tests/node-pool-config-ephemeral-disk.test.ts",
            author: "GitOps (Git LowPriv)",
            content:
              "Use the shared direct-node helper instead of duplicating cleanup logic.",
          },
        ],
      },
    };

    try {
      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [taskId]: {
            metadata: { id: taskId, generation: 1, resourceVersion: 20 },
            spec: {
              owner: "aks-explorer",
              workflow: "non-spec-main-publication",
              input: {
                targetBranch: "main",
                allowedChangedFiles: [
                  "features/node-pool-config/lib/node-pool-config-custom-ca.ts",
                ],
              },
            },
            status: {
              phase: "waiting",
              evidence: [
                "pull-request:16693575",
                "pull-request-review-fingerprint:prior-review-fingerprint",
                "pull-request-unresolved-review-count:1",
              ],
            },
          },
        },
      });

      const emitted: Record<string, unknown>[] = [];
      const result = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        reviewEvent,
      );

      expect(result).toEqual({
        pullRequestObserved: true,
        pullRequestId: "16693575",
        state: "active",
        unresolvedReviewCount: 1,
        masterValidationFailureWake: true,
        taskId,
        reviewFingerprint: "ee3dd77a3da02bc8",
      });
      expect(emitted).toEqual([
        expect.objectContaining({
          type: "project.task.tick",
          source: "aks-rp-e2e-app",
          target: { project: projectId, taskId },
          action: "non-spec-main-publication",
          overrideWait: true,
          data: expect.objectContaining({
            reason: "pull-request-review-changed",
            pullRequestId: "16693575",
            pullRequestStateEventId: 5099625,
            reviewFingerprint: "ee3dd77a3da02bc8",
          }),
        }),
      ]);

      writeJson(resolve(appDir, ".state/tasks/state.json"), {
        version: 2,
        project: projectId,
        resources: {
          [taskId]: {
            metadata: { id: taskId, generation: 1, resourceVersion: 21 },
            spec: {
              owner: "aks-explorer",
              workflow: "non-spec-main-publication",
              input: {
                targetBranch: "main",
              },
            },
            status: {
              phase: "waiting",
              evidence: [
                "pull-request:16693575",
                "pull-request-review-fingerprint:ee3dd77a3da02bc8",
                "pull-request-unresolved-review-count:1",
              ],
            },
          },
        },
      });

      const repeatedEmitted: Record<string, unknown>[] = [];
      const repeated = await routeAksEvent(
        {
          appPath: (path = ".") => resolve(appDir, path),
          emit: (value: Record<string, unknown>) => repeatedEmitted.push(value),
        } as never,
        reviewEvent,
      );

      expect(repeated).toEqual({
        pullRequestObserved: true,
        pullRequestId: "16693575",
        state: "active",
        unresolvedReviewCount: 1,
        masterValidationFailureWake: false,
        taskId,
        reviewFingerprint: "ee3dd77a3da02bc8",
      });
      expect(repeatedEmitted).toEqual([]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
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
