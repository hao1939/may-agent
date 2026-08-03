import { describe, expect, it } from "bun:test";

import aksApp from "../projects/aks-rp-e2e.app/app.ts";
import evaluationApp from "../projects/evaluation.app/app.ts";
import gymApp from "../projects/gym.app/app.ts";
import mayAgentApp from "../projects/may-agent.app/app.ts";
import scoutApp from "../projects/scout-knowledge-lib.app/app.ts";

const apps = [scoutApp, gymApp, evaluationApp, mayAgentApp, aksApp];

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
        for (const emitted of schedule.emits) {
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
    }
  });

  it("keeps reconciliation results out of task scheduling", async () => {
    for (const app of apps) {
      expect((app.tasks?.accepts ?? []).map(selectorType)).not.toContain(
        "project.task.reconciled",
      );
      if (
        !(app.events ?? [])
          .map(selectorType)
          .includes("project.task.reconciled")
      )
        continue;

      const emitted: Record<string, unknown>[] = [];
      const context = {
        appPath: (path: string) =>
          `/app/projects/${app.id}.app${path === "." ? "" : `/${path}`}`,
        emit: (event: Record<string, unknown>) => {
          emitted.push(event);
          return event;
        },
        noop: (reason: string) => ({ type: "noop", reason }),
      };
      await app.onEvent?.(context as never, {
        type: "project.task.reconciled",
        project: app.id,
        taskId: "conformance-probe",
        status: "converged",
        summary: "projection-only conformance probe",
        eventId: 303,
      });

      const scheduled = emitted.filter((event) =>
        app.tasks?.resolve(withEventId(event, 404)),
      );
      expect(
        scheduled,
        `${app.id} scheduled task work from project.task.reconciled`,
      ).toEqual([]);
    }
  });
});
