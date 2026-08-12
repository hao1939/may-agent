import { describe, expect, test } from "bun:test";
import { routePlatformEvent } from "../../../app.ts";

type Recorded =
  | { kind: "emit"; value: unknown }
  | { kind: "noop"; reason: string };

function fakeCtx() {
  const recorded: Recorded[] = [];
  const ctx = {
    emit: (value: unknown) => {
      recorded.push({ kind: "emit", value });
      return { emitted: value };
    },
    noop: (reason: string) => {
      recorded.push({ kind: "noop", reason });
      return { noop: reason };
    },
  };
  return { ctx, recorded };
}

async function route(event: Record<string, unknown>) {
  const { ctx, recorded } = fakeCtx();
  // routePlatformEvent only uses emit/noop from the context.
  await routePlatformEvent(ctx as never, event);
  return recorded[0];
}

const PLATFORM_OWNED_METRIC = "guard.triggered-count-24h";

describe("may-agent.app metric routing", () => {
  test("non-platform-owned metric breach does not wake the platform owner", async () => {
    const result = await route({
      type: "metric.breach",
      owner: "aks-explorer",
      metricId: "aks-rp-e2e.task.stalled-count",
    });
    expect(result.kind).toBe("noop");
  });

  test("platform-owned metric breach requests the owner", async () => {
    for (const owner of ["tech-lead", "agent:tech-lead", "may", "agent:may"]) {
      const result = await route({
        type: "metric.breach",
        owner,
        metricId: PLATFORM_OWNED_METRIC,
      });
      expect(result.kind).toBe("emit");
      expect((result as { value: { type: string; reason: string } }).value.type)
        .toBe("project.owner.requested");
    }
  });

  test("platform-owned stalled metric requests the owner", async () => {
    const result = await route({
      type: "metric.stalled",
      owner: "tech-lead",
      metricId: "session.provider-error-count-1h",
    });
    expect(result.kind).toBe("emit");
  });

  test("metric.recovered stays informational", async () => {
    const result = await route({
      type: "metric.recovered",
      owner: "tech-lead",
      metricId: PLATFORM_OWNED_METRIC,
    });
    expect(result.kind).toBe("noop");
  });

  test("only self-referential platform-local metrics remain deferred", async () => {
    const deferred = [
      "project.health.finding-count",
      "project.owner-incomplete-count",
      "project.owner-judgment-needed-count",
      "capability.zombie-session-count",
      "runtime.stale-running-session-count",
    ];
    for (const metricId of deferred) {
      const result = await route({
        type: "metric.breach",
        owner: "tech-lead",
        metricId,
      });
      expect(result.kind).toBe("noop");
      expect((result as { reason: string }).reason).toContain("deferred");
    }
  });

  test("previously incident-narrative deferrals now wake the owner", async () => {
    const restored = [
      "guard.triggered-count-24h",
      "guard.warned-count-24h",
      "escalation.pending-count",
      "metric.stale-active-count",
      "session.first-turn-error-count-1h",
      "handler.heartbeat-coverage",
      "infra.persist.db-size-mb",
      "agent.config-invalid-count-1h",
      "session.provider-error-count-1h",
      "event.pair-orphan-count",
      "session.error-rate-6h",
    ];
    for (const metricId of restored) {
      const result = await route({
        type: "metric.breach",
        owner: "tech-lead",
        metricId,
      });
      expect(result.kind).toBe("emit");
    }
  });
});
