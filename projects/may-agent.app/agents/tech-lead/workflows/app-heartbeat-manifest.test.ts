import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import evaluationApp from "../../../../evaluation.app/app.ts";
import gymApp from "../../../../gym.app/app.ts";
import mayAgentApp from "../../../app.ts";
import scoutKnowledgeLibApp from "../../../../scout-knowledge-lib.app/app.ts";

const regularReviewCases = [
  {
    id: "gym",
    app: gymApp,
    scheduleId: "design-alignment-review-daily",
    taskId: "runtime/design-alignment-review",
  },
  {
    id: "scout-knowledge-lib",
    app: scoutKnowledgeLibApp,
    scheduleId: "owner-review",
    taskId: "library-maintenance",
  },
  {
    id: "evaluation",
    app: evaluationApp,
    scheduleId: "owner-heartbeat",
    taskId: "runtime/owner-review",
  },
  {
    id: "may-agent",
    app: mayAgentApp,
    scheduleId: "owner-heartbeat",
    taskId: "runtime/platform-owner-review",
  },
] as const;

const appSources = [
  "../../../../gym.app/app.ts",
  "../../../../scout-knowledge-lib.app/app.ts",
  "../../../../evaluation.app/app.ts",
  "../../../app.ts",
] as const;

describe("independent task resource manifests", () => {
  for (const { id, app, scheduleId, taskId } of regularReviewCases) {
    test(`${id} maps its regular review timer to one stable maintain resource`, () => {
      const schedule = app.schedules?.find(
        (entry: { id?: string }) => entry.id === scheduleId,
      );

      expect(schedule).toBeDefined();
      expect(schedule?.enabled).toBe(true);
      expect(schedule?.intervalMs).toBeGreaterThanOrEqual(3_600_000);

      const event = ((schedule as any)?.emits as unknown[])?.[0] as any;
      expect(event).toBeDefined();
      expect(event.project).toBe(id);

      const first = app.tasks?.resolve?.({ ...event, eventId: 1 });
      const second = app.tasks?.resolve?.({ ...event, eventId: 2 });
      expect(first).toMatchObject({ id: taskId, mode: "maintain" });
      expect(second).toEqual(first);
      expect(app).not.toHaveProperty("taskRoutes");
      expect(app).not.toHaveProperty("taskWorkflows");
      expect(app).not.toHaveProperty("eventGraph");
    });
  }

  test("non-AKS apps do not install an app-local task scheduling layer", () => {
    for (const source of appSources) {
      const text = readFileSync(new URL(source, import.meta.url), "utf8");
      expect(text).not.toContain("project.task.reconciled");
      expect(text).not.toContain("project.task.tick");
    }
  });
});
