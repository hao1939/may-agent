/**
 * E4 — Metric breach to alert
 *
 * Validates the full metric lifecycle: define → record healthy → record
 * breaching → metric.breach event → metric_alerts row → record recovery →
 * metric.recovered (best-effort; some implementations emit on next snapshot).
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
import {
  openSandboxDb,
  pollUntil,
  queryEvents,
} from "./lib/live-daemon.js";
import { buildSandbox, type Sandbox } from "./lib/sandbox.js";

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
            intervalMs: 10000,
            agent: "may",
            enabled: true,
          },
        ],
      },
    });
    await sb.daemonReady;
  }, 60_000);

  afterAll(async () => {
    if (sb) await sb.close();
  });

  test(
    "metric defines, breaches, alerts, recovers",
    async () => {
      const db = openSandboxDb(sb.dbPath);
      try {
        // Wait for at least 2 fires: baseline + breach. Each fire is 10s apart.
        await pollUntil(
          () => {
            const phases = queryEvents(db, { types: ["e2e.metric.phase"], since: t0, limit: 5 });
            return phases.length >= 2 ? phases : null;
          },
          { timeoutMs: 40_000, intervalMs: 500, description: "≥2 metric-canary phases" },
        );

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

        // ── Wait for recovery (3rd fire) ───────────────────────────────
        await pollUntil(
          () => {
            const phases = queryEvents(db, { types: ["e2e.metric.phase"], since: t0, limit: 10 });
            return phases.length >= 3 ? phases : null;
          },
          { timeoutMs: 25_000, intervalMs: 500, description: "recovery phase" },
        );

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
          .prepare("SELECT resolved_at FROM metric_alerts WHERE metric_id = ? ORDER BY id DESC LIMIT 5")
          .all("e2e.canary") as { resolved_at: number | null }[];
        expect(resolvedAlerts.some((alert) => alert.resolved_at !== null)).toBe(true);
      } finally {
        db.close();
      }
    },
    90_000,
  );
});
