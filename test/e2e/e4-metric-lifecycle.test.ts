/**
 * E4 — Metric breach to alert
 *
 * Validates the full metric lifecycle: define → record healthy → record
 * breaching → metric.breach event → metric_alerts row → record recovery →
 * metric.recovered and the same alert resolved. Each phase enters through the
 * real daemon's event interface; E1 separately proves recurring timer delivery.
 *
 * Spans:
 *   - sdk.metrics.define / sdk.metrics.record
 *   - metric breach detection and event emission
 *   - metric_alerts table materialization
 *   - recovery path
 *
 * Validates documented behavior of:
 *   - metric-alerts.md § Ownership, Required Triage
 *   - metrics.md § Pipeline (define → record → snapshot → alert)
 *   - sdk-quickstart.md § Choose the Right Primitive (sdk.metrics)
 *
 * Runs by default; does not require LLM access.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { openSandboxDb, pollUntil, queryEvents } from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";
import { emitDaemonEvent } from "../../packages/control/src/client.js";

describe("E4: metric breach to alert", () => {
  let sb: Sandbox;
  const t0 = Date.now();

  beforeAll(async () => {
    sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureHandlers: { may: ["e2e-metric-canary"] },
      cronJson: {
        may: [
          {
            name: "e2e-metric-canary",
            handler: "e2e-metric-canary",
            on: ["e2e.metric.sample"],
            agent: "may",
            enabled: true,
          },
        ],
      },
    });
    await sb.daemonReady;
    // The socket opens before handler loading and event subscriptions finish.
    // This existing activation message is emitted after subscriptions attach.
    await pollUntil(() => sb.getLogs().includes("[cron:may] Starting 1 job(s)"), {
      timeoutMs: 10_000,
      intervalMs: 50,
      description: "metric handler event subscription ready",
    });
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "metric defines, breaches, alerts, recovers",
    async () => {
      const db = openSandboxDb(sb.dbPath);
      try {
        const sample = async (phase: string, value: number) => {
          // Use the existing operator fact ingress, as `may --emit` does.
          const receipt = await emitDaemonEvent(sb.socketPath, "e2e.metric.sample", {}, { timeoutMs: 5_000 });
          expect(receipt.type).toBe("ok");
          await pollUntil(
            () =>
              queryEvents(db, { types: ["e2e.metric.phase"], since: t0 }).some(
                (event) => JSON.parse(event.data ?? "{}").phase === phase,
              ),
            { timeoutMs: 10_000, intervalMs: 50, description: `metric ${phase}` },
          );
          expect(db.prepare("SELECT current FROM metrics WHERE id = ?").get("e2e.canary")).toEqual({ current: value });
        };
        await sample("baseline", 1.0);
        expect(db.prepare("SELECT COUNT(*) AS count FROM metric_alerts WHERE metric_id = ?").get("e2e.canary")).toEqual(
          { count: 0 },
        );
        await sample("breach", 0.3);

        // Metric row exists.
        const metric = db
          .prepare("SELECT id, current, threshold, target, owner, alert_op FROM metrics WHERE id = ?")
          .get("e2e.canary") as { id: string; current: number; threshold: number; target: number; owner: string; alert_op: string } | undefined;
        expect(metric).toBeDefined();
        expect(metric!.id).toBe("e2e.canary");
        expect(metric!.threshold).toBe(0.8);
        expect(metric!.target).toBe(1.0);
        expect(metric!.owner).toBe("agent:may");
        expect(metric!.alert_op).toBe("lt");

        // Latest snapshot reflects breach value.
        const snapshots = db
          .prepare("SELECT value, note FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 5")
          .all("e2e.canary") as { value: number; note: string | null }[];
        expect(snapshots.length).toBeGreaterThanOrEqual(2);
        const breachSnap = snapshots.find((s) => s.value === 0.3);
        expect(breachSnap).toBeDefined();

        // metric.breach event emitted.
        const breachEvents = queryEvents(db, { types: ["metric.breach"], since: t0, limit: 5 })
          .filter((e) => (e.data ?? "").includes("e2e.canary"));
        expect(breachEvents.length).toBeGreaterThanOrEqual(1);

        // metric_alerts row materialized for the breach.
        const alerts = db
          .prepare("SELECT id, metric_id, message, resolved_at FROM metric_alerts WHERE metric_id = ? ORDER BY id DESC LIMIT 5")
          .all("e2e.canary") as { id: number; metric_id: string; message: string | null; resolved_at: number | null }[];
        expect(alerts.length).toBeGreaterThanOrEqual(1);
        expect(alerts[0].resolved_at).toBeNull();

        await sample("recover", 0.95);

        // Latest snapshot is recovery value.
        const recovered = db
          .prepare("SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 1")
          .get("e2e.canary") as { value: number };
        expect(recovered.value).toBe(0.95);

        // Latest current value reflects recovery.
        const metricAfter = db
          .prepare("SELECT current FROM metrics WHERE id = ?")
          .get("e2e.canary") as { current: number };
        expect(metricAfter.current).toBeGreaterThanOrEqual(0.8);

        const recoveredEvents = queryEvents(db, { types: ["metric.recovered"], since: t0, limit: 5 })
          .filter((e) => (e.data ?? "").includes("e2e.canary"));
        expect(recoveredEvents.length).toBeGreaterThanOrEqual(1);

        const resolvedAlerts = db
          .prepare("SELECT id, resolved_at FROM metric_alerts WHERE metric_id = ? ORDER BY id DESC LIMIT 5")
          .all("e2e.canary") as { id: number; resolved_at: number | null }[];
        expect(resolvedAlerts).toEqual([{ id: alerts[0].id, resolved_at: expect.any(Number) }]);
      } finally {
        db.close();
      }
    },
    60_000,
  );
});
