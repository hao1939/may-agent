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
import app, {
  masterValidationScheduleGate,
  malformedApprovalWaitContract,
  malformedRepoRefWaitContract,
  malformedSelfTaskStateWaitContract,
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
      id: "runtime/unified-resource-migration-project-state-v1",
      parentId: "group/app-operations",
      mode: "achieve",
      owner: "app-ops",
      workflow: "unified-resource-migration",
      input: { migration: "project-state-holders-v1" },
    });
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

      expect(result).not.toHaveProperty("createdReadyTaskWake");
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
        lastPlanPath: "features/virtualmachines-agentpool/compact/staging.plan.json",
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
        attemptedFixes: ["Published split-frontier source truth to origin/dev."],
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
        summary: "CCP CoreDNS row is already newer than the projected holder update.",
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
      writeJson(resolve(appDir, ".state/feature-compact-loop/state.json"), featureState);
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
        expect(state.features["virtualmachines-agentpool"].evidencePaths).toEqual(
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

  test("wakes waiting-frontier review when a task enters attention", async () => {
    const emitted: Record<string, unknown>[] = [];
    const attentionTaskId = "domain/example-verifier-rejected";
    const result = await routeAksEvent(
      {
        appPath: () => resolve(import.meta.dir, "../../.."),
        emit: (value: Record<string, unknown>) => emitted.push(value),
      } as never,
      {
        type: "project.task.reconciled",
        target: {
          project: projectId,
          taskId: attentionTaskId,
        },
        data: {
          project: projectId,
          taskId: attentionTaskId,
          generation: 3,
          disposition: "attention",
          summary: "Verifier rejected the claimed result.",
        },
      },
    );

    expect(result).toMatchObject({
      waitingFrontierAttentionWake: true,
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
        reason: "task-entered-attention",
        attentionTaskId,
        attentionGeneration: 3,
      },
    });
  });

  test("replays satisfied task-phase waits after the subject task leaves the blocked phase", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "task-state-wait-replay-"));
    const emitted: Record<string, unknown>[] = [];
    const subjectTaskId =
      "domain/master-validation-failure/spec.runtime-container.runtimeclass-default/b0e3da3a1c587e6475db";
    const waitingTaskId = "master-validation-staging-cycle";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            version: 2,
            project: projectId,
            resources: {
              [waitingTaskId]: {
                metadata: {
                  id: waitingTaskId,
                  generation: 6,
                  resourceVersion: 1,
                },
                spec: { owner: "app-ops", workflow: "master-validation-cycle" },
                status: {
                  phase: "waiting",
                  conditionIds: ["task-runtimeclass-default-not-running"],
                },
              },
              [subjectTaskId]: {
                metadata: {
                  id: subjectTaskId,
                  generation: 2,
                  resourceVersion: 1,
                },
                spec: {
                  owner: "aks-explorer",
                  workflow: "master-validation-failure",
                },
                status: {
                  phase: "waiting",
                },
              },
            },
            conditions: {
              "task-runtimeclass-default-not-running": {
                spec: {
                  type: "task-phase",
                  subject: `task:${subjectTaskId}`,
                  expected: {
                    field: "phase",
                    notEquals: "running",
                  },
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
            taskId: subjectTaskId,
          },
          data: {
            project: projectId,
            taskId: subjectTaskId,
            disposition: "waiting",
          },
        },
      );

      expect(result).toMatchObject({
        taskStateWaitReplay: true,
        taskStateWaitReplayTargets: [
          {
            taskId: waitingTaskId,
            conditionId: "task-runtimeclass-default-not-running",
            type: "task-phase",
          },
        ],
      });
      expect(emitted).toContainEqual({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: waitingTaskId,
        },
        urgency: "high",
        action: "task-state-wait-replay",
        data: {
          project: projectId,
          taskId: waitingTaskId,
          task_id: waitingTaskId,
          reason: "task-state-condition-satisfied",
          conditionId: "task-runtimeclass-default-not-running",
          conditionType: "task-phase",
          subjectTaskId,
        },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("replays waiting task-state waits when the subject task is removed after convergence", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "task-state-wait-removed-"));
    const emitted: Record<string, unknown>[] = [];
    const subjectTaskId =
      "domain/implement-rp-master-validation-force-upgrade-ignore-pdb-shared-journey-20260728";
    const waitingTaskId =
      "hold-compact-rp-master-validation-ready-package-392e435eb3-20260728";
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify(
          {
            version: 2,
            project: projectId,
            resources: {
              [waitingTaskId]: {
                metadata: {
                  id: waitingTaskId,
                  generation: 1,
                  resourceVersion: 1,
                },
                spec: { owner: "aks-explorer" },
                status: {
                  phase: "waiting",
                  conditionIds: ["task-shared-journey-phase-meaningful"],
                },
              },
            },
            conditions: {
              "task-shared-journey-phase-meaningful": {
                spec: {
                  type: "task-field",
                  subject: `task:${subjectTaskId}`,
                  expected: {
                    field: "phase",
                    anyOf: ["waiting", "converged"],
                  },
                },
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
          type: "project.task.reconciled",
          target: {
            project: projectId,
            taskId: subjectTaskId,
          },
          data: {
            project: projectId,
            taskId: subjectTaskId,
            disposition: "converged",
          },
        },
      );

      expect(result).toMatchObject({
        taskStateWaitReplay: true,
        taskStateWaitReplayTargets: [
          {
            taskId: waitingTaskId,
            conditionId: "task-shared-journey-phase-meaningful",
            type: "task-field",
          },
        ],
      });
      expect(emitted).toContainEqual({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: waitingTaskId,
        },
        urgency: "high",
        action: "task-state-wait-replay",
        data: {
          project: projectId,
          taskId: waitingTaskId,
          task_id: waitingTaskId,
          reason: "task-state-condition-satisfied",
          conditionId: "task-shared-journey-phase-meaningful",
          conditionType: "task-field",
          subjectTaskId,
        },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("replays repo-ref owner handoffs through an exact same-task tick", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-owner-handoff-"));
    const emitted: Record<string, unknown>[] = [];
    const taskId =
      "wait-compact-ccp-metricsserver-reviewed-exception-origin-dev-advance-c17c6450-20260724";
    const taskIntent = {
      id: taskId,
      parentId: "compact/compact-feature-ccp",
      outcome: "Recheck the exact CCP row after origin/dev advances.",
      acceptance: ["Use current origin/dev evidence."],
      mode: "achieve",
      owner: "aks-explorer",
      input: {
        baseRef: "origin/dev",
        resumeBaselineCommit: "c17c6450",
      },
      priority: "P2",
    };
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify({
          resources: {
            [taskId]: {
              spec: {
                ...taskIntent,
                workflow: "wait-for-repo-ref-advance",
              },
              status: { phase: "running", conditionIds: [] },
            },
          },
        }),
      );
      const result = await routeAksEvent(
        {
          appPath: () => appDir,
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
          taskIntent,
        },
      });
      expect(resolveAksTask(emitted[0])).toMatchObject({
        id: taskId,
        parentId: "compact/compact-feature-ccp",
        outcome: "Recheck the exact CCP row after origin/dev advances.",
        mode: "achieve",
        owner: "aks-explorer",
        input: {
          baseRef: "origin/dev",
          resumeBaselineCommit: "c17c6450",
          repoRefOwnerHandoff: {
            reason: "repo-ref-wait-owner-handoff",
            preserveSameTaskId: true,
            priorWorkflow: "wait-for-repo-ref-advance",
            previousBaselineCommit: "c17c6450",
          },
        },
        priority: "P2",
      });
      expect(resolveAksTask(emitted[0])?.acceptance).toEqual(
        expect.arrayContaining([
          "Use current origin/dev evidence.",
          "If the same scope still needs a supported origin/dev wait, keep this same task id waiting from the current baseline instead of creating a child or successor wait-named descendant.",
        ]),
      );
      expect(resolveAksTask(emitted[0])?.workflow).toBeUndefined();
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("backfills a triggerless pending repo-ref wait with its structured intent", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-wait-backfill-"));
    const emitted: Record<string, unknown>[] = [];
    const taskId = "wait-spec-example-origin-dev-advance-old";
    const taskIntent = {
      id: taskId,
      parentId: "group/scenario-normalization",
      outcome: "Recheck the exact spec after origin/dev advances.",
      acceptance: ["Inspect only the exact same-spec surface."],
      mode: "achieve",
      owner: "aks-explorer",
      workflow: "wait-for-repo-ref-advance",
      input: {
        baseRef: "origin/dev",
        resumeBaselineCommit: "old-commit",
      },
      priority: "P0",
    };
    try {
      mkdirSync(resolve(appDir, ".state/tasks"), { recursive: true });
      writeFileSync(
        resolve(appDir, ".state/tasks/state.json"),
        JSON.stringify({
          resources: {
            [taskId]: {
              spec: taskIntent,
              status: { phase: "pending", conditionIds: [] },
            },
          },
          attempts: {},
        }),
      );

      const result = await routeAksEvent(
        {
          appPath: () => appDir,
          emit: (value: Record<string, unknown>) => emitted.push(value),
        } as never,
        {
          type: "aks.repo-ref.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            repoRef: "origin/dev",
            commit: "new-commit",
          },
        },
      );

      expect(result).toMatchObject({
        repoRefWaitContractReplay: true,
        replayTaskIds: [taskId],
      });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        type: "project.task.tick",
        target: { project: projectId, taskId },
        action: "repo-ref-wait-contract-replay",
        data: {
          reason: "triggerless-pending-repo-ref-wait",
          repoRef: "origin/dev",
          commit: "new-commit",
          taskIntent,
        },
      });
      expect(resolveAksTask(emitted[0])).toMatchObject({
        id: taskId,
        parentId: "group/scenario-normalization",
        outcome: "Recheck the exact spec after origin/dev advances.",
        acceptance: ["Inspect only the exact same-spec surface."],
        mode: "achieve",
        owner: "aks-explorer",
        input: {
          baseRef: "origin/dev",
          resumeBaselineCommit: "old-commit",
        },
        priority: "P0",
      });
      expect(resolveAksTask(emitted[0])?.workflow).toBeUndefined();
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("repo-ref owner-handoff replay carries a direct-owner task intent snapshot", async () => {
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

      await routeAksEvent(
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

      const replayEvent = emitted.find(
        (entry) => entry.action === "repo-ref-owner-handoff-replay",
      ) as Record<string, unknown> | undefined;
      expect(replayEvent).toBeTruthy();
      expect(replayEvent).toMatchObject({
        data: {
          taskIntent: {
            id: taskId,
            parentId: "project",
            owner: "aks-explorer",
            mode: "achieve",
            outcome:
              "After origin/dev advances, recheck the exact same compact frontier.",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: "63c7519aa1420391aaa5b19967f1a7c8bcbcf786",
            },
          },
        },
      });
      expect(
        (
          (replayEvent?.data as Record<string, unknown>)?.taskIntent as Record<
            string,
            unknown
          >
        )?.workflow,
      ).toBeUndefined();
      expect(resolveAksTask(replayEvent ?? {})).toMatchObject({
        id: taskId,
        owner: "aks-explorer",
        mode: "achieve",
        outcome:
          "After origin/dev advances, recheck the exact same compact frontier.",
        input: {
          baseRef: "origin/dev",
          resumeBaselineCommit: "63c7519aa1420391aaa5b19967f1a7c8bcbcf786",
          repoRefOwnerHandoff: {
            reason: "repo-ref-wait-owner-handoff",
            preserveSameTaskId: true,
            priorWorkflow: "wait-for-repo-ref-advance",
            previousBaselineCommit: "63c7519aa1420391aaa5b19967f1a7c8bcbcf786",
          },
        },
      });
      expect(resolveAksTask(replayEvent ?? {})?.acceptance).toEqual(
        expect.arrayContaining([
          "Preserve same-task bounded owner judgment.",
          "If the same scope still needs a supported origin/dev wait, keep this same task id waiting from the current baseline instead of creating a child or successor wait-named descendant.",
        ]),
      );
      expect(resolveAksTask(replayEvent ?? {})?.workflow).toBeUndefined();
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
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
            "repo-ref waits must name a concrete pending source branch/commit, PR, publication branch, or other exact external producer that can change the scoped authority; generic origin/dev churn is not such a producer",
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

  test("replays triggerless pending repo-ref waits after the ref already advanced past their baselines", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-pending-wait-"));
    const taskId =
      "wait-compact-serverless-package-partial-origin-dev-advance-894696be-20260726";
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
                  parentId: "project",
                  outcome:
                    "After origin/dev advances, recheck the exact same serverless compact frontier.",
                  acceptance: ["Preserve same-task bounded owner judgment."],
                  mode: "achieve",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "894696be2ec2520ecbf866a5145c6357e5a67f13",
                    specId:
                      "spec.serverless-virtual-nodes.addonv2-aci-connector",
                  },
                },
                status: {
                  phase: "pending",
                  conditionIds: [],
                },
              },
            },
            conditions: {},
            attempts: {},
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
          type: "aks.repo-ref.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            repoRef: "origin/dev",
            commit: "b6223038f3b4b5d16ff0a1f3a71b68f68a9bec64",
            previousCommit: "894696be2ec2520ecbf866a5145c6357e5a67f13",
            changed: true,
          },
        },
      );

      expect(result).toMatchObject({
        observed: true,
        repoRef: "origin/dev",
        commit: "b6223038f3b4b5d16ff0a1f3a71b68f68a9bec64",
        repoRefWaitReplay: false,
        repoRefWaitContractReplay: true,
        malformedRepoRefWaitReplay: true,
        malformedRepoRefWaitProblems: [
          {
            taskId,
            conditionId: "",
            baselineCommit: "894696be2ec2520ecbf866a5145c6357e5a67f13",
            replayReason: "triggerless-pending-repo-ref-wait",
            issues: [
              "repo-ref waits must name a concrete pending source branch/commit, PR, publication branch, or other exact external producer that can change the scoped authority; generic origin/dev churn is not such a producer",
              "pending-phase-without-attempt",
              "missing conditionId",
              'observed.commit="b6223038f3b4b5d16ff0a1f3a71b68f68a9bec64"',
            ],
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
          reason: "triggerless-pending-repo-ref-wait",
          repoRef: "origin/dev",
          commit: "b6223038f3b4b5d16ff0a1f3a71b68f68a9bec64",
          baselineCommit: "894696be2ec2520ecbf866a5145c6357e5a67f13",
          conditionId: "",
          issues: [
            "repo-ref waits must name a concrete pending source branch/commit, PR, publication branch, or other exact external producer that can change the scoped authority; generic origin/dev churn is not such a producer",
            "pending-phase-without-attempt",
            "missing conditionId",
            'observed.commit="b6223038f3b4b5d16ff0a1f3a71b68f68a9bec64"',
          ],
          workflow: "wait-for-repo-ref-advance",
          taskIntent: {
            id: taskId,
            parentId: "project",
            outcome:
              "After origin/dev advances, recheck the exact same serverless compact frontier.",
            acceptance: ["Preserve same-task bounded owner judgment."],
            owner: "aks-explorer",
            mode: "achieve",
            workflow: "wait-for-repo-ref-advance",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: "894696be2ec2520ecbf866a5145c6357e5a67f13",
              specId: "spec.serverless-virtual-nodes.addonv2-aci-connector",
            },
          },
        },
      });

      const replayEvent = emitted.find(
        (entry) => entry.action === "repo-ref-wait-contract-replay",
      );
      expect(resolveAksTask(replayEvent ?? {})).toMatchObject({
        id: taskId,
        parentId: "project",
        owner: "aks-explorer",
        mode: "achieve",
        outcome:
          "After origin/dev advances, recheck the exact same serverless compact frontier.",
        acceptance: ["Preserve same-task bounded owner judgment."],
        input: {
          baseRef: "origin/dev",
          resumeBaselineCommit: "894696be2ec2520ecbf866a5145c6357e5a67f13",
          specId: "spec.serverless-virtual-nodes.addonv2-aci-connector",
        },
      });
      expect(resolveAksTask(replayEvent ?? {})?.workflow).toBeUndefined();
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("replays supported pending-publication repo-ref waits when an observed advance already satisfies their exact wake", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "repo-ref-wait-canonical-"));
    const taskId =
      "domain/wait-machines-agentpool-nap-full-cleanup-direct-carrier-origin-dev-publication-after-next-dev-advance-780f3d01-20260727";
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
                  parentId: "compact/compact-feature-machines-agentpool",
                  outcome:
                    "After `origin/dev` advances beyond `780f3d01308600e853ea2dc2a0491e15e1816bba`, re-read the exact Machines AgentPool NAP full-cleanup two-spec/four-file family to decide whether commit `e9694c118cf63d4881988df8c4af3976b7c072c0` or an exact reviewed equivalent has been absorbed, then record absorption/equivalence or refresh one exact same-family wait.",
                  acceptance: ["Preserve same-task bounded owner judgment."],
                  mode: "achieve",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "780f3d01308600e853ea2dc2a0491e15e1816bba",
                    specId: "spec.nap.default-machines-pool-cleanup-full",
                    sourceCommit: "e9694c118cf63d4881988df8c4af3976b7c072c0",
                    publicationBranch:
                      "aks-explorer/reconcile-machines-agentpool-nap-full-cleanup-direct-carrier-current-origin-dev-20260723",
                  },
                  priority: "P2",
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
                    notEquals: "780f3d01308600e853ea2dc2a0491e15e1816bba",
                  },
                },
              },
            },
            attempts: {},
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
            previousCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
            changed: true,
          },
        },
      );

      expect(result).toMatchObject({
        observed: true,
        repoRef: "origin/dev",
        commit: "07a4f2f4ef890879943ee3d9c6d9ec2ee417114d",
        repoRefWaitReplay: true,
        repoRefWaitReplayTaskIds: [taskId],
        malformedRepoRefWaitReplay: false,
        malformedRepoRefWaitProblems: [],
      });
      expect(emitted).toEqual([
        {
          type: "project.task.tick",
          source: "aks-rp-e2e-app",
          target: { project: projectId, taskId },
          urgency: "high",
          action: "repo-ref-condition-satisfied",
          data: {
            project: projectId,
            taskId,
            task_id: taskId,
            reason: "repo-ref-condition-satisfied",
            repoRef: "origin/dev",
            commit: "07a4f2f4ef890879943ee3d9c6d9ec2ee417114d",
            baselineCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
            conditionId: "repo-ref-advance-abc123",
            taskIntent: {
              id: taskId,
              parentId: "compact/compact-feature-machines-agentpool",
              outcome:
                "After `origin/dev` advances beyond `780f3d01308600e853ea2dc2a0491e15e1816bba`, re-read the exact Machines AgentPool NAP full-cleanup two-spec/four-file family to decide whether commit `e9694c118cf63d4881988df8c4af3976b7c072c0` or an exact reviewed equivalent has been absorbed, then record absorption/equivalence or refresh one exact same-family wait.",
              acceptance: ["Preserve same-task bounded owner judgment."],
              mode: "achieve",
              owner: "aks-explorer",
              workflow: "wait-for-repo-ref-advance",
              input: {
                baseRef: "origin/dev",
                resumeBaselineCommit:
                  "780f3d01308600e853ea2dc2a0491e15e1816bba",
                specId: "spec.nap.default-machines-pool-cleanup-full",
                sourceCommit: "e9694c118cf63d4881988df8c4af3976b7c072c0",
                publicationBranch:
                  "aks-explorer/reconcile-machines-agentpool-nap-full-cleanup-direct-carrier-current-origin-dev-20260723",
              },
              priority: "P2",
            },
          },
        },
      ]);
      expect(resolveAksTask(emitted[0])).toEqual({
        id: taskId,
        parentId: "compact/compact-feature-machines-agentpool",
        outcome:
          "After `origin/dev` advances beyond `780f3d01308600e853ea2dc2a0491e15e1816bba`, re-read the exact Machines AgentPool NAP full-cleanup two-spec/four-file family to decide whether commit `e9694c118cf63d4881988df8c4af3976b7c072c0` or an exact reviewed equivalent has been absorbed, then record absorption/equivalence or refresh one exact same-family wait.",
        acceptance: ["Preserve same-task bounded owner judgment."],
        mode: "achieve",
        owner: "aks-explorer",
        workflow: "wait-for-repo-ref-advance",
        input: {
          baseRef: "origin/dev",
          resumeBaselineCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
          specId: "spec.nap.default-machines-pool-cleanup-full",
          sourceCommit: "e9694c118cf63d4881988df8c4af3976b7c072c0",
          publicationBranch:
            "aks-explorer/reconcile-machines-agentpool-nap-full-cleanup-direct-carrier-current-origin-dev-20260723",
        },
        priority: "P2",
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("treats unsupported repo-ref waits as malformed instead of replaying generic origin/dev churn", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "repo-ref-wait-unsupported-compact-"),
    );
    const taskId =
      "wait-compact-workload-autoscaler-package-partial-origin-dev-advance-780f3d01-20260727";
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
                  parentId: "compact/compact-feature-workload-autoscaler",
                  outcome:
                    "After origin/dev advances, recheck only whether the exact same-scope workload-autoscaler compact partial frontier materially changed.",
                  acceptance: ["Preserve same-task bounded owner judgment."],
                  mode: "achieve",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "780f3d01308600e853ea2dc2a0491e15e1816bba",
                    specId: "spec.workload-autoscaler.keda-upgrade-survival",
                    sourceCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
                    publicationBranch: "dev",
                  },
                },
                status: {
                  phase: "waiting",
                  conditionIds: ["repo-ref-advance-workload"],
                },
              },
            },
            conditions: {
              "repo-ref-advance-workload": {
                spec: {
                  type: "aks.repo-ref.observed",
                  subject: "repoRef:origin/dev",
                  expected: {
                    field: "commit",
                    notEquals: "780f3d01308600e853ea2dc2a0491e15e1816bba",
                  },
                },
              },
            },
            attempts: {},
          },
          null,
          2,
        ),
      );

      expect(malformedRepoRefWaitContract(appDir, taskId)).toMatchObject({
        taskId,
        conditionId: "repo-ref-advance-workload",
        issues: expect.arrayContaining([
          expect.stringContaining("generic origin/dev churn"),
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
            commit: "1922bd30db15f9f48ec1cc86d4d8597fb1fa9647",
            previousCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
            changed: true,
          },
        },
      );

      expect(result).toMatchObject({
        repoRefWaitReplay: false,
        malformedRepoRefWaitReplay: true,
        malformedRepoRefWaitProblems: [
          {
            taskId,
            conditionId: "repo-ref-advance-workload",
            issues: expect.arrayContaining([
              expect.stringContaining("generic origin/dev churn"),
            ]),
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
          commit: "1922bd30db15f9f48ec1cc86d4d8597fb1fa9647",
          baselineCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
          conditionId: "repo-ref-advance-workload",
          issues: [
            "repo-ref waits must name a concrete pending source branch/commit, PR, publication branch, or other exact external producer that can change the scoped authority; generic origin/dev churn is not such a producer",
          ],
          workflow: "wait-for-repo-ref-advance",
          taskIntent: {
            id: taskId,
            parentId: "compact/compact-feature-workload-autoscaler",
            outcome:
              "After origin/dev advances, recheck only whether the exact same-scope workload-autoscaler compact partial frontier materially changed.",
            acceptance: ["Preserve same-task bounded owner judgment."],
            mode: "achieve",
            owner: "aks-explorer",
            workflow: "wait-for-repo-ref-advance",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
              specId: "spec.workload-autoscaler.keda-upgrade-survival",
              sourceCommit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
              publicationBranch: "dev",
            },
          },
        },
      });

      const replayEvent = emitted.find(
        (entry) => entry.action === "repo-ref-wait-contract-replay",
      );
      expect(resolveAksTask(replayEvent ?? {})).toMatchObject({
        id: taskId,
        owner: "aks-explorer",
        mode: "achieve",
        outcome:
          "After origin/dev advances, recheck only whether the exact same-scope workload-autoscaler compact partial frontier materially changed.",
      });
      expect(resolveAksTask(replayEvent ?? {})?.workflow).toBeUndefined();
      expect(resolveAksTask(replayEvent ?? {})?.id).not.toBe(
        "runtime/owner-review",
      );
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("treats unsupported normalization repo-ref waits as malformed instead of replaying unrelated dev advances", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "repo-ref-wait-unsupported-normalization-"),
    );
    const taskId =
      "wait-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-frontier-origin-dev-advance-5c252d46-20260727";
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
                  parentId: "project",
                  outcome:
                    "After origin/dev advances, recheck only whether the published spec.network-acns.performance-cilium-upgrade carrier or accepted same-surface evidence materially changes the pre-upgrade user-iptables-label runtime frontier.",
                  acceptance: ["Preserve same-task bounded owner judgment."],
                  mode: "achieve",
                  owner: "aks-explorer",
                  workflow: "wait-for-repo-ref-advance",
                  input: {
                    baseRef: "origin/dev",
                    resumeBaselineCommit:
                      "5c252d465ae78739e7d89e4e220a92523f25053d",
                    specId: "spec.network-acns.performance-cilium-upgrade",
                    sourceCommit: "5c252d465ae78739e7d89e4e220a92523f25053d",
                    publicationBranch: "dev",
                  },
                },
                status: {
                  phase: "waiting",
                  conditionIds: ["repo-ref-advance-network-acns"],
                },
              },
            },
            conditions: {
              "repo-ref-advance-network-acns": {
                spec: {
                  type: "aks.repo-ref.observed",
                  subject: "repoRef:origin/dev",
                  expected: {
                    field: "commit",
                    notEquals: "5c252d465ae78739e7d89e4e220a92523f25053d",
                  },
                },
              },
            },
            attempts: {},
          },
          null,
          2,
        ),
      );

      expect(malformedRepoRefWaitContract(appDir, taskId)).toMatchObject({
        taskId,
        conditionId: "repo-ref-advance-network-acns",
        issues: expect.arrayContaining([
          expect.stringContaining("generic origin/dev churn"),
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
            commit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
            previousCommit: "5c252d465ae78739e7d89e4e220a92523f25053d",
            changed: true,
          },
        },
      );

      expect(result).toMatchObject({
        repoRefWaitReplay: false,
        malformedRepoRefWaitReplay: true,
        malformedRepoRefWaitProblems: [
          {
            taskId,
            conditionId: "repo-ref-advance-network-acns",
            issues: expect.arrayContaining([
              expect.stringContaining("generic origin/dev churn"),
            ]),
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
          commit: "780f3d01308600e853ea2dc2a0491e15e1816bba",
          baselineCommit: "5c252d465ae78739e7d89e4e220a92523f25053d",
          conditionId: "repo-ref-advance-network-acns",
          issues: [
            "repo-ref waits must name a concrete pending source branch/commit, PR, publication branch, or other exact external producer that can change the scoped authority; generic origin/dev churn is not such a producer",
          ],
          workflow: "wait-for-repo-ref-advance",
          taskIntent: {
            id: taskId,
            parentId: "project",
            outcome:
              "After origin/dev advances, recheck only whether the published spec.network-acns.performance-cilium-upgrade carrier or accepted same-surface evidence materially changes the pre-upgrade user-iptables-label runtime frontier.",
            acceptance: ["Preserve same-task bounded owner judgment."],
            mode: "achieve",
            owner: "aks-explorer",
            workflow: "wait-for-repo-ref-advance",
            input: {
              baseRef: "origin/dev",
              resumeBaselineCommit: "5c252d465ae78739e7d89e4e220a92523f25053d",
              specId: "spec.network-acns.performance-cilium-upgrade",
              sourceCommit: "5c252d465ae78739e7d89e4e220a92523f25053d",
              publicationBranch: "dev",
            },
          },
        },
      });

      const replayEvent = emitted.find(
        (entry) => entry.action === "repo-ref-wait-contract-replay",
      );
      expect(resolveAksTask(replayEvent ?? {})).toMatchObject({
        id: taskId,
        owner: "aks-explorer",
        mode: "achieve",
        outcome:
          "After origin/dev advances, recheck only whether the published spec.network-acns.performance-cilium-upgrade carrier or accepted same-surface evidence materially changes the pre-upgrade user-iptables-label runtime frontier.",
      });
      expect(resolveAksTask(replayEvent ?? {})?.workflow).toBeUndefined();
      expect(resolveAksTask(replayEvent ?? {})?.id).not.toBe(
        "runtime/owner-review",
      );
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("replays self-referential task-state waits to owner judgment when a task reconciles into waiting", async () => {
    const appDir = mkdtempSync(
      join(tmpdir(), "self-task-state-wait-reconcile-"),
    );
    const taskId =
      "hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728";
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
                  parentId:
                    "compact/reconcile-virtualmachines-agentpool-current-ready-subset-frontier-f4233cb2ce",
                  outcome:
                    "Preserve the exact virtualmachines-agentpool compact split residual frontier on current origin/dev after consuming the completed capacity-based-surge-maxunavailable follow-through merge.",
                  acceptance: [
                    "Resume only when represented frontier authority changes.",
                  ],
                  mode: "maintain",
                  owner: "aks-explorer",
                  input: {
                    baselineOriginDev:
                      "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
                    preservedWaitTaskIds: [
                      "spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation",
                    ],
                    representedSpecIds: [
                      "spec.virtualmachine-prerelease.row61-core-addon-compatibility",
                      "spec.virtualmachine-prerelease.row75-aksconformance-core",
                      "spec.virtualmachine-prerelease.row76-aksconformance-tunnel",
                      "spec.virtualmachines.auto-zone-mixed-sku",
                      "spec.virtualmachines.auto-zone-single-sku",
                      "spec.virtualmachines.cli-add-multi-sku",
                      "spec.virtualmachines.managedsystem-combined",
                      "spec.virtualmachines.pool-delete-rest",
                      "spec.virtualmachines.vmas-to-vms-migration-slb",
                    ],
                  },
                },
                status: {
                  phase: "waiting",
                  conditionIds: [
                    "task:spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation-phase-change",
                    "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change",
                  ],
                },
              },
            },
            conditions: {
              "task:spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation-phase-change":
                {
                  spec: {
                    type: "task-field",
                    subject:
                      "task:spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation",
                    expected: { field: "phase", notEquals: "waiting" },
                  },
                },
              "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change":
                {
                  spec: {
                    type: "task-field",
                    subject: `task:${taskId}`,
                    expected: { field: "phase", notEquals: "waiting" },
                  },
                },
            },
            attempts: {},
          },
          null,
          2,
        ),
      );

      expect(malformedSelfTaskStateWaitContract(appDir, taskId)).toMatchObject({
        taskId,
        conditionId:
          "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change",
        baselineCommit: "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
        issues: expect.arrayContaining([
          "task state wait cannot observe the waiting task itself",
          'subject="task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728"',
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
            task_id: taskId,
            disposition: "waiting",
          },
        },
      );

      expect(result).toMatchObject({
        malformedSelfTaskStateWaitReplay: true,
        malformedSelfTaskStateWaitProblem: {
          taskId,
          conditionId:
            "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change",
        },
      });
      expect(emitted).toContainEqual({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId },
        urgency: "high",
        action: "task-state-wait-contract-replay",
        overrideWait: true,
        data: {
          project: projectId,
          taskId,
          task_id: taskId,
          reason: "self-task-state-wait-contract",
          overrideWait: true,
          conditionId:
            "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change",
          issues: [
            "task state wait cannot observe the waiting task itself",
            'type="task-field"',
            'subject="task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728"',
          ],
          workflow: "",
          repoRef: "origin/dev",
          baselineCommit: "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
          taskIntent: {
            id: taskId,
            parentId:
              "compact/reconcile-virtualmachines-agentpool-current-ready-subset-frontier-f4233cb2ce",
            outcome:
              "Preserve the exact virtualmachines-agentpool compact split residual frontier on current origin/dev after consuming the completed capacity-based-surge-maxunavailable follow-through merge.",
            acceptance: [
              "Resume only when represented frontier authority changes.",
            ],
            mode: "maintain",
            owner: "aks-explorer",
            input: {
              baselineOriginDev: "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
              preservedWaitTaskIds: [
                "spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation",
              ],
              representedSpecIds: [
                "spec.virtualmachine-prerelease.row61-core-addon-compatibility",
                "spec.virtualmachine-prerelease.row75-aksconformance-core",
                "spec.virtualmachine-prerelease.row76-aksconformance-tunnel",
                "spec.virtualmachines.auto-zone-mixed-sku",
                "spec.virtualmachines.auto-zone-single-sku",
                "spec.virtualmachines.cli-add-multi-sku",
                "spec.virtualmachines.managedsystem-combined",
                "spec.virtualmachines.pool-delete-rest",
                "spec.virtualmachines.vmas-to-vms-migration-slb",
              ],
            },
          },
        },
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  test("replays self-referential task-state waits after origin/dev advances beyond the holder baseline", async () => {
    const appDir = mkdtempSync(join(tmpdir(), "self-task-state-wait-reporef-"));
    const taskId =
      "hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728";
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
                  parentId:
                    "compact/reconcile-virtualmachines-agentpool-current-ready-subset-frontier-f4233cb2ce",
                  outcome:
                    "Preserve the exact virtualmachines-agentpool compact split residual frontier on current origin/dev after consuming the completed capacity-based-surge-maxunavailable follow-through merge.",
                  acceptance: [
                    "Resume only when represented frontier authority changes.",
                  ],
                  mode: "maintain",
                  owner: "aks-explorer",
                  input: {
                    baselineOriginDev:
                      "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
                    preservedWaitTaskIds: [
                      "spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation",
                    ],
                    representedSpecIds: [
                      "spec.virtualmachine-prerelease.row61-core-addon-compatibility",
                      "spec.virtualmachine-prerelease.row75-aksconformance-core",
                      "spec.virtualmachine-prerelease.row76-aksconformance-tunnel",
                      "spec.virtualmachines.auto-zone-mixed-sku",
                      "spec.virtualmachines.auto-zone-single-sku",
                      "spec.virtualmachines.cli-add-multi-sku",
                      "spec.virtualmachines.managedsystem-combined",
                      "spec.virtualmachines.pool-delete-rest",
                      "spec.virtualmachines.vmas-to-vms-migration-slb",
                    ],
                  },
                },
                status: {
                  phase: "waiting",
                  conditionIds: [
                    "task:spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation-phase-change",
                    "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change",
                  ],
                },
              },
            },
            conditions: {
              "task:spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation-phase-change":
                {
                  spec: {
                    type: "task-field",
                    subject:
                      "task:spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation",
                    expected: { field: "phase", notEquals: "waiting" },
                  },
                },
              "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change":
                {
                  spec: {
                    type: "task-field",
                    subject: `task:${taskId}`,
                    expected: { field: "phase", notEquals: "waiting" },
                  },
                },
            },
            attempts: {},
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
          type: "aks.repo-ref.observed",
          target: { project: projectId },
          data: {
            project: projectId,
            repoRef: "origin/dev",
            commit: "f1032631286f9b2a3f403661246ef38266a4c0c1",
            previousCommit: "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
            changed: true,
          },
        },
      );

      expect(result).toMatchObject({
        observed: true,
        repoRef: "origin/dev",
        commit: "f1032631286f9b2a3f403661246ef38266a4c0c1",
        malformedSelfTaskStateWaitReplay: true,
        malformedSelfTaskStateWaitProblems: [
          {
            taskId,
            conditionId:
              "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change",
            baselineCommit: "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
            replayReason: "self-task-state-wait-after-repo-advance",
            issues: expect.arrayContaining([
              "task state wait cannot observe the waiting task itself",
              "missing repo-ref wake after baseline advance",
              'observed.commit="f1032631286f9b2a3f403661246ef38266a4c0c1"',
            ]),
          },
        ],
      });
      expect(emitted).toContainEqual({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: { project: projectId, taskId },
        urgency: "high",
        action: "task-state-wait-contract-replay",
        overrideWait: true,
        data: {
          project: projectId,
          taskId,
          task_id: taskId,
          reason: "self-task-state-wait-after-repo-advance",
          overrideWait: true,
          repoRef: "origin/dev",
          commit: "f1032631286f9b2a3f403661246ef38266a4c0c1",
          baselineCommit: "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
          conditionId:
            "task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728-phase-change",
          issues: [
            "task state wait cannot observe the waiting task itself",
            'type="task-field"',
            'subject="task:hold-compact-virtualmachines-agentpool-split-residual-frontier-d4865dba-20260728"',
            "missing repo-ref wake after baseline advance",
            'baselineCommit="d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c"',
            'observed.commit="f1032631286f9b2a3f403661246ef38266a4c0c1"',
          ],
          workflow: "",
          taskIntent: {
            id: taskId,
            parentId:
              "compact/reconcile-virtualmachines-agentpool-current-ready-subset-frontier-f4233cb2ce",
            outcome:
              "Preserve the exact virtualmachines-agentpool compact split residual frontier on current origin/dev after consuming the completed capacity-based-surge-maxunavailable follow-through merge.",
            acceptance: [
              "Resume only when represented frontier authority changes.",
            ],
            mode: "maintain",
            owner: "aks-explorer",
            input: {
              baselineOriginDev: "d4865dbaf1bedfdca8b711d60c2e4c9a2fd0e40c",
              preservedWaitTaskIds: [
                "spec/repair-verify-spec-virtualmachines-auto-zone-mixed-sku-disposition-representation",
              ],
              representedSpecIds: [
                "spec.virtualmachine-prerelease.row61-core-addon-compatibility",
                "spec.virtualmachine-prerelease.row75-aksconformance-core",
                "spec.virtualmachine-prerelease.row76-aksconformance-tunnel",
                "spec.virtualmachines.auto-zone-mixed-sku",
                "spec.virtualmachines.auto-zone-single-sku",
                "spec.virtualmachines.cli-add-multi-sku",
                "spec.virtualmachines.managedsystem-combined",
                "spec.virtualmachines.pool-delete-rest",
                "spec.virtualmachines.vmas-to-vms-migration-slb",
              ],
            },
          },
        },
      });
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
        overrideWait: true,
        data: {
          project: projectId,
          taskId,
          task_id: taskId,
          reason: "malformed-approval-wait-contract",
          overrideWait: true,
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
            /input\.packetPath.*input\.pathId.*input\.requestedAction/i.test(
              entry,
            ),
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
