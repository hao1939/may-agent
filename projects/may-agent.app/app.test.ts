import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import type { AppEvent, AppInput } from "@may-agent/sdk";
import app, {
  OWNER_HEARTBEAT_INTERVAL_MS,
  OWNER_REVIEW_TASK_ID,
  PLATFORM_REVIEW_INTERVAL_MS,
  resolveMayAgentTask,
  routeMayAgentRequest,
  taskInputForEvent,
} from "./app.ts";

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return { type, data, ...extra };
}

function request(input: AppInput, dependency?: Record<string, unknown>) {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
    ...(dependency ? { dependency: dependency as never } : {}),
  };
}

describe("canonical may-agent platform App", () => {
  it("owns one manifest and keeps addressed work separate from task wakes", () => {
    expect(app).toMatchObject({
      id: "may-agent",
      version: 1,
      owner: "tech-lead",
      inbox: { batch: "single", maxConcurrent: 2 },
      tasks: { attach: true, maxConcurrent: 2 },
    });
    expect(app.route).toBe(routeMayAgentRequest);
    expect(app.tasks?.resolve).toBe(resolveMayAgentTask);
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "project-comment",
      "project-owner-request",
    ]);
    expect(app.observations).toContain("project.task.reconciled");
    expect(app.observations).toContain("runtime.daemon.heartbeat");
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(app).not.toHaveProperty("budget");
    expect(existsSync(new URL("./inbox.ts", import.meta.url))).toBe(false);
  });

  it("publishes every periodic background wake as a fact", () => {
    expect(
      app.schedules?.find(({ id }) => id === "platform-review")?.intervalMs,
    ).toBe(PLATFORM_REVIEW_INTERVAL_MS);
    expect(
      app.schedules?.find(({ id }) => id === "owner-heartbeat")?.intervalMs,
    ).toBe(OWNER_HEARTBEAT_INTERVAL_MS);
    for (const schedule of app.schedules ?? []) {
      expect(schedule).toHaveProperty("event");
      expect(schedule).not.toHaveProperty("input");
    }
  });

  it("turns the platform action into an addressed App input", () => {
    expect(
      app.actions?.["advance-project"]?.toInput({ scope: "runtime" }),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "manual-advance", params: { scope: "runtime" } },
    });
  });
});

describe("may-agent task routing", () => {
  it("routes periodic and reactive platform facts to stable tasks", () => {
    expect(
      resolveMayAgentTask(event("project.tick", { reason: "scheduled" })),
    ).toMatchObject({
      id: OWNER_REVIEW_TASK_ID,
      mode: "maintain",
      workflow: "platform-owner-review",
      input: { scope: "may-agent-platform" },
    });
    expect(resolveMayAgentTask(event("project.ops_health.tick"))).toMatchObject(
      {
        id: "runtime/ops-health-observer",
        workflow: "ops-health-review",
      },
    );
  });

  it("filters recovered, deferred, and foreign metric observations", () => {
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "runtime.some-platform-metric" },
          { owner: "agent:tech-lead" },
        ),
      ),
    ).toMatchObject({
      kind: "owner-review",
      data: { reason: "metric-signal" },
    });
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "project.health.finding-count" },
          { owner: "agent:tech-lead" },
        ),
      ),
    ).toBeNull();
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "other.metric" },
          { owner: "agent:other-app" },
        ),
      ),
    ).toBeNull();
    expect(taskInputForEvent(event("metric.recovered"))).toBeNull();
  });

  it("keeps an addressed request open until its exact task converges", () => {
    expect(
      routeMayAgentRequest(
        request({ kind: "owner-review", data: { reason: "manual" } }),
      ),
    ).toMatchObject({
      type: "task",
      task: { kind: "desired", intent: { id: OWNER_REVIEW_TASK_ID } },
    });
    expect(
      routeMayAgentRequest(
        request(
          { kind: "owner-review", data: { reason: "manual" } },
          {
            kind: "task",
            id: OWNER_REVIEW_TASK_ID,
            status: "done",
            summary: "Platform reviewed",
            evidence: ["review:current"],
          },
        ),
      ),
    ).toEqual({
      type: "complete",
      summary: "Platform reviewed",
      response: undefined,
      evidence: ["review:current"],
    });
  });
});
