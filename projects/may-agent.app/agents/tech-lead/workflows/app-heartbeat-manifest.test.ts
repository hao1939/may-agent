import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
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

const disabledHeartbeatModules = [
  "../../../agents/bob/workflows/bob-heartbeat.ts",
  "../../../agents/coach/workflows/coach-heartbeat.ts",
  "../../../agents/dev/workflows/dev-heartbeat.ts",
  "../../../agents/optimizer/workflows/optimizer-heartbeat.ts",
  "../../../agents/qa/workflows/qa-heartbeat.ts",
  "../../../agents/tech-lead/workflows/tech-lead-heartbeat.ts",
  "../../../../scout-knowledge-lib.app/agents/amy/workflows/amy-heartbeat.ts",
  "../../../../scout-knowledge-lib.app/agents/amy-kimi/workflows/amy-kimi-heartbeat.ts",
] as const;

describe("independent task resource manifests", () => {
  for (const { id, app, scheduleId, taskId } of regularReviewCases) {
    test(`${id} maps its regular review timer to one stable maintain resource`, () => {
      const schedule = app.schedules?.find(
        (entry: { id?: string }) => entry.id === scheduleId,
      );

      expect(schedule).toBeDefined();
      expect(schedule?.enabled).not.toBe(false);
      expect(schedule?.intervalMs).toBeGreaterThanOrEqual(3_600_000);

      const event =
        schedule && "event" in schedule ? schedule.event : undefined;
      expect(event).toBeDefined();
      expect(event?.target?.project).toBe(id);

      const first = event ? app.tasks?.resolve?.(event) : null;
      const second = event ? app.tasks?.resolve?.(event) : null;
      expect(first).toMatchObject({ id: taskId, mode: "maintain" });
      expect(second).toEqual(first);
      expect(app).not.toHaveProperty("taskRoutes");
      expect(app).not.toHaveProperty("taskWorkflows");
      expect(app).not.toHaveProperty("eventGraph");
    });
  }

  test("heartbeat-disabled agents do not retain discoverable heartbeat modules", () => {
    for (const source of disabledHeartbeatModules) {
      expect(existsSync(new URL(source, import.meta.url))).toBe(false);
    }
  });
});
