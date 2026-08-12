import { describe, expect, it } from "bun:test";
import app, {
  OWNER_HEARTBEAT_INTERVAL_MS,
  OWNER_REVIEW_TASK_ID,
  OWNER_SESSIONS_PER_DAY,
  PLATFORM_REVIEW_INTERVAL_MS,
  RESERVED_REACTIVE_SESSIONS_PER_DAY,
  SCHEDULED_OWNER_SESSIONS_PER_DAY,
  resolveMayAgentTask,
} from "./app.ts";

const DAY_MS = 86_400_000;

function schedule(id: string) {
  const found = (app.schedules ?? []).find((s) => s.id === id);
  if (!found) throw new Error(`missing schedule ${id}`);
  return found;
}

describe("may-agent.app owner session budget", () => {
  it("reserves reactive headroom instead of booking the whole budget", () => {
    expect(app.budget?.sessionsPerDay).toBe(OWNER_SESSIONS_PER_DAY);
    expect(SCHEDULED_OWNER_SESSIONS_PER_DAY).toBeLessThan(
      OWNER_SESSIONS_PER_DAY,
    );
    expect(OWNER_SESSIONS_PER_DAY - SCHEDULED_OWNER_SESSIONS_PER_DAY).toBe(
      RESERVED_REACTIVE_SESSIONS_PER_DAY,
    );
  });

  it("derives scheduled owner sessions from the declared intervals", () => {
    expect(schedule("platform-review").intervalMs).toBe(
      PLATFORM_REVIEW_INTERVAL_MS,
    );
    expect(schedule("owner-heartbeat").intervalMs).toBe(
      OWNER_HEARTBEAT_INTERVAL_MS,
    );
    const derived =
      DAY_MS / schedule("platform-review").intervalMs +
      DAY_MS / schedule("owner-heartbeat").intervalMs;
    expect(derived).toBe(SCHEDULED_OWNER_SESSIONS_PER_DAY);
    expect(derived).toBe(4);
  });

  it("keeps non-owner observer schedules out of the owner session budget", () => {
    // ops-health-review / daily-ops-digest run deterministic observer
    // workflows and only request the owner for actionable signals.
    for (const id of ["ops-health-review", "daily-ops-digest"]) {
      const emits = schedule(id).emits as Array<{ type: string }>;
      expect(emits.every((e) => e.type !== "project.owner.requested")).toBe(
        true,
      );
    }
  });
});

describe("owner review routing stability", () => {
  it("routes project comments, reactive owner requests, and scheduled reviews to one resource", () => {
    for (const type of ["project.comment.created", "project.owner.requested"]) {
      const intent = resolveMayAgentTask({ type, project: "may-agent" });
      expect(intent?.id).toBe(OWNER_REVIEW_TASK_ID);
      expect(intent?.workflow).toBe("platform-owner-review");
      expect(intent?.mode).toBe("maintain");
    }
  });

  it("accepts the reactive event types that consume the reserved headroom", () => {
    const accepts = (app.tasks?.accepts ?? []) as Array<{ type: string }>;
    const types = accepts.map((a) => a.type);
    expect(types).toContain("project.comment.created");
    expect(types).toContain("project.owner.requested");
  });

  it("scheduled project.tick becomes an owner request on the same resource", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const ctx = {
      emit: async (event: Record<string, unknown>) => {
        emitted.push(event);
        return event;
      },
      noop: async (reason: string) => ({ noop: reason }),
    } as never;

    await app.onEvent?.(ctx, { type: "project.tick", project: "may-agent" });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.type).toBe("project.owner.requested");
    expect(resolveMayAgentTask(emitted[0]!)?.id).toBe(OWNER_REVIEW_TASK_ID);
  });

  it("platform-owned metric breaches wake the owner via the same resource", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const noops: string[] = [];
    const ctx = {
      emit: async (event: Record<string, unknown>) => {
        emitted.push(event);
        return event;
      },
      noop: async (reason: string) => {
        noops.push(reason);
        return { noop: reason };
      },
    } as never;

    await app.onEvent?.(ctx, {
      type: "metric.breach",
      owner: "tech-lead",
      metricId: "runtime.some-platform-metric",
    });
    expect(emitted).toHaveLength(1);
    expect(resolveMayAgentTask(emitted[0]!)?.id).toBe(OWNER_REVIEW_TASK_ID);

    // Foreign-owned metrics must not consume the reserved headroom.
    await app.onEvent?.(ctx, {
      type: "metric.breach",
      owner: "agent:other-app",
      metricId: "other.metric",
    });
    expect(emitted).toHaveLength(1);
    expect(noops).toHaveLength(1);
  });
});

describe("project-local containment", () => {
  it("declares no global handlers or specialist heartbeats", () => {
    const source = Bun.file(new URL("./app.ts", import.meta.url));
    return source.text().then((text) => {
      // No global fan-out / specialist heartbeat registration from this app.
      expect(text).not.toContain("agents.fork");
      expect(text).not.toContain("registerHandler");
      expect(text).not.toContain("agent.heartbeat");
      for (const s of app.schedules ?? []) {
        for (const emit of s.emits as Array<Record<string, unknown>>) {
          expect(
            emit.project === undefined || emit.project === "may-agent",
          ).toBe(true);
        }
      }
      // Every scheduled owner wake is this app's own owner-review lane.
      expect(app.owner).toBe("tech-lead");
    });
  });
});
