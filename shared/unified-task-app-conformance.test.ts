import { describe, expect, it } from "bun:test";

import aksApp from "../projects/aks-rp-e2e.app/app.ts";
import evaluationApp from "../projects/evaluation.app/app.ts";
import gymApp from "../projects/gym.app/app.ts";
import mayAgentApp from "../projects/may-agent.app/app.ts";
import scoutApp from "../projects/scout-knowledge-lib.app/app.ts";

const apps = [scoutApp, gymApp, evaluationApp, mayAgentApp, aksApp];

const semanticWakeProbes = [
  {
    app: scoutApp,
    first: {
      type: "project.owner.requested",
      data: {
        project: "scout-knowledge-lib",
        reason: "manual-library-review",
      },
      target: {
        appId: "scout-knowledge-lib",
        project: "scout-knowledge-lib",
      },
    },
    repeated: {
      type: "project.owner.requested",
      data: { project: "scout-knowledge-lib", reason: "repair-index" },
      target: {
        appId: "scout-knowledge-lib",
        project: "scout-knowledge-lib",
      },
    },
    taskId: "library-maintenance",
  },
  {
    app: gymApp,
    first: {
      type: "gym.improvement.requested",
      data: { project: "gym", agent: "may", reason: "human-request" },
      target: { appId: "gym", project: "gym" },
    },
    repeated: {
      type: "gym.improvement.requested",
      data: { project: "gym", agent: "may", reason: "new-evidence" },
      target: { appId: "gym", project: "gym" },
    },
    taskId: "improve/may",
  },
  {
    app: evaluationApp,
    first: {
      type: "evaluation.project.review.requested",
      data: { targetProject: "gym.app", reason: "scheduled" },
      target: { appId: "evaluation", project: "evaluation" },
    },
    repeated: {
      type: "evaluation.project.review.requested",
      data: { targetProject: "gym.app", reason: "material-change" },
      target: { appId: "evaluation", project: "evaluation" },
    },
    taskId: "runtime/project-audit/gym.app",
  },
  {
    app: mayAgentApp,
    first: {
      type: "project.tick",
      data: { project: "may-agent", reason: "scheduled-project-review" },
      target: { appId: "may-agent", project: "may-agent" },
    },
    repeated: {
      type: "project.tick",
      data: { project: "may-agent", reason: "owner-heartbeat" },
      target: { appId: "may-agent", project: "may-agent" },
    },
    taskId: "runtime/platform-owner-review",
  },
  {
    app: aksApp,
    first: {
      type: "pipeline.failure.observed",
      data: {
        project: "aks-rp-e2e",
        specId: "spec.conformance.example",
        failureFingerprint: "episode-a",
        pipelineRunId: "101",
      },
      target: { appId: "aks-rp-e2e", project: "aks-rp-e2e" },
    },
    repeated: {
      type: "pipeline.failure.observed",
      data: {
        project: "aks-rp-e2e",
        specId: "spec.conformance.example",
        failureFingerprint: "episode-b",
        pipelineRunId: "202",
      },
      target: { appId: "aks-rp-e2e", project: "aks-rp-e2e" },
    },
    taskId: "domain/master-validation-failure/spec.conformance.example",
  },
];

function selectorType(selector: unknown): string {
  if (typeof selector === "string") return selector;
  if (!selector || typeof selector !== "object") return "";
  return String((selector as { type?: unknown }).type ?? "");
}

function withEventId(event: unknown, eventId: number): Record<string, unknown> {
  return { ...(event as Record<string, unknown>), eventId };
}

describe("unified task-app conformance", () => {
  it("keeps recurring schedule task identities stable", () => {
    for (const app of apps) {
      expect(
        app.tasks,
        `${app.id} must use the shared task controller`,
      ).toBeDefined();
      for (const schedule of app.schedules ?? []) {
        const emitted = "event" in schedule ? schedule.event : undefined;
        if (!emitted) continue;
        const first = app.tasks?.resolve(withEventId(emitted, 101));
        const repeated = app.tasks?.resolve(withEventId(emitted, 202));
        if (!first && !repeated) continue;
        expect(
          repeated?.id,
          `${app.id}.${schedule.id} changed task identity`,
        ).toBe(first?.id);
        expect(["achieve", "maintain"]).toContain(first?.mode);

        const target = (emitted as { target?: { taskId?: unknown } }).target;
        if (typeof target?.taskId === "string") {
          expect(
            first?.id,
            `${app.id}.${schedule.id} did not resolve its exact target`,
          ).toBe(target.taskId);
        }
      }
    }
  });

  it("reconciles repeated semantic events into stable resources", () => {
    for (const probe of semanticWakeProbes) {
      const first = probe.app.tasks?.resolve(withEventId(probe.first, 101));
      const repeated = probe.app.tasks?.resolve(
        withEventId(probe.repeated, 202),
      );

      expect(first?.id, `${probe.app.id} did not resolve the first wake`).toBe(
        probe.taskId,
      );
      expect(
        repeated?.id,
        `${probe.app.id} created a new resource for a repeated semantic wake`,
      ).toBe(probe.taskId);
    }
  });

  it("keeps reconciliation results out of canonical task routing", () => {
    for (const app of apps) {
      expect(app).not.toHaveProperty("events");
      expect(app).not.toHaveProperty("onEvent");
      expect((app.tasks?.subscriptions ?? []).map(selectorType)).not.toContain(
        "project.task.reconciled",
      );
      expect(
        app.tasks?.resolve({
          type: "project.task.reconciled",
          data: {
            project: app.id,
            taskId: "conformance-probe",
            status: "converged",
            summary: "projection-only conformance probe",
          },
          target: { appId: app.id, project: app.id },
          eventId: 303,
        }),
        `${app.id} resolved fresh task work from project.task.reconciled`,
      ).toBeNull();
    }
  });
});
