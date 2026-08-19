import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import type { AppEvent, AppInput } from "@may-agent/sdk";
import app, {
  OWNER_HEARTBEAT_INTERVAL_MS,
  OWNER_REVIEW_TASK_ID,
  PLATFORM_METRIC_INTERVAL_MS,
  PLATFORM_REVIEW_INTERVAL_MS,
  resolveMayAgentTask,
  taskForMayAgentInput,
  taskInputForEvent,
} from "./app.ts";

function event(
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<AppEvent<Record<string, unknown>>> = {},
): AppEvent<Record<string, unknown>> {
  return { type, data, ...extra };
}

function admittedInput(input: AppInput) {
  return {
    id: "request-1",
    source: { kind: "system" as const, id: "test" },
    input,
  };
}

describe("canonical may-agent platform App", () => {
  it("owns one manifest and keeps addressed work separate from task wakes", () => {
    expect(app).toMatchObject({
      id: "may-agent",
      version: 1,
      owner: "may",
      inbox: { batch: "single", maxConcurrent: 2 },
      tasks: { maxConcurrent: 2 },
    });
    expect(app.task).toBe(taskForMayAgentInput);
    expect(app.route).toBeUndefined();
    expect(app.tasks?.resolve).toBe(resolveMayAgentTask);
    expect(app.subscriptions?.map(({ id }) => id)).toEqual([
      "project-comment",
      "project-owner-request",
    ]);
    expect(app.observations).toContain("project.task.reconciled");
    expect(app.observations).toContain("runtime.daemon.heartbeat");
    expect(app.observations).toContain("metric.recovered");
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
      app.schedules?.find(({ id }) => id === "platform-metrics"),
    ).toMatchObject({
      intervalMs: PLATFORM_METRIC_INTERVAL_MS,
      event: {
        type: "trigger.metrics-snapshot",
        data: { reason: "scheduled-platform-measurement" },
        target: { appId: "may-agent", project: "may-agent" },
      },
    });
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
  it("routes App-owned platform facts to the runnable canonical owner", () => {
    const intent = resolveMayAgentTask(
      event("project.tick", { reason: "scheduled" }),
    );
    expect(intent).toMatchObject({
      id: OWNER_REVIEW_TASK_ID,
      mode: "maintain",
      owner: "may",
      input: { scope: "may-agent-platform" },
    });
    expect(intent).not.toHaveProperty("workflow");
    expect(resolveMayAgentTask(event("project.ops_health.tick"))).toBeNull();
    expect(resolveMayAgentTask(event("project.ops_digest.tick"))).toBeNull();
  });

  it("keeps mechanical session recovery and one-time state migration in Runtime", () => {
    expect(
      resolveMayAgentTask(
        event("session.recovery.requested", { sessionId: "s_failed/17" }),
      ),
    ).toBeNull();
    expect(
      resolveMayAgentTask(event("may-agent.resource-migration.requested")),
    ).toBeNull();
  });

  it("filters recovered, deferred, and foreign metric observations", () => {
    expect(
      taskInputForEvent(
        event(
          "metric.breach",
          { metricId: "runtime.some-platform-metric" },
          { owner: "agent:may" },
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
          { owner: "agent:may" },
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

  it("maps addressed input directly to its stable task", () => {
    expect(
      taskForMayAgentInput(
        admittedInput({ kind: "owner-review", data: { reason: "manual" } }),
      ),
    ).toMatchObject({
      kind: "desired",
      intent: { id: OWNER_REVIEW_TASK_ID },
    });
  });
});
