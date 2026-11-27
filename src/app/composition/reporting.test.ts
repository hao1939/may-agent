import { expect, it, spyOn } from "bun:test";
import * as metrics from "../../lib/metrics.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { EventBus } from "../core/events/bus.js";
import { createAppReporting } from "./reporting.js";

it("does not construct reporting services merely to prepare runtime/SDK capabilities", () => {
  const metricFactory = spyOn(metrics, "createMetricService");
  try {
    const options = {
      bus: new EventBus(),
      agentName: "fixture",
      persistDir: "/unused/state",
      projectRoot: "/unused",
      agentsRoot: "/unused/agents",
      sharedRoot: "/unused/shared",
      projectsRoot: "/unused/projects",
    };
    buildRuntimeCtx(options);
    const reports = createAppReporting(() => {
      throw new Error("read was not requested");
    });
    reports.syncDefinitions([]);
    expect(metricFactory).not.toHaveBeenCalled();
  } finally {
    metricFactory.mockRestore();
  }
});

it("executes bounded App domain collectors, retires removed collectors on reload, and projects domainMetrics", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { Type, defineApp } = await import("@may-agent/sdk/app");
  const { getDb, closeAllDbs } = await import("../../lib/db/connection.js");
  const { measureSourceMetrics } = await import("../metric-source-measurement.js");
  const { observabilitySummaryQuery, readObservabilitySummary } = await import(
    "../adapters/reporting/observability-summary.js"
  );

  const persistDir = mkdtempSync(join(tmpdir(), "app-domain-collector-"));
  const bus = new EventBus();
  try {
    const db = getDb(persistDir);
    const reports = createAppReporting(() => db);
    const fakeRead = {
      contract: async () => ({ appId: "scout", agent: "scout", inputSchema: Type.Object({}), observations: [] }),
      appResult: async () => null,
      tasks: {
        list: async () => ({
          items: [
            { id: "t1", status: "converged", outcome: "o1", summary: "s1", updatedAt: 0 },
            { id: "t2", status: "converged", outcome: "o2", summary: "s2", updatedAt: 0 },
          ],
        }),
        get: async () => null,
      },
      execution: async () => null,
      metric: reports.readMetric,
    };
    const appV1 = defineApp({
      id: "scout",
      version: 1,
      agent: "scout",
      inputSchema: Type.Object({}),
      metrics: [
        {
          id: "scout.findings_7d",
          name: "Findings (7d)",
          unit: "outcomes",
          direction: "up",
          collect: async ({ appId, appRoot, read, now }) => {
            const page = await read.tasks.list();
            return { value: page.items.length, sampleSize: page.items.length, measuredAt: now, note: `${appId}@${appRoot}` };
          },
        },
        {
          id: "scout.empty_ratio",
          name: "Empty ratio",
          unit: "ratio",
          collect: () => ({ kind: "no_exposure", sampleSize: 0, note: "zero denominator" }),
        },
      ],
    });

    const sampleTime = 1_795_760_000_000;
    reports.syncDefinitions([{ definition: appV1, dir: "/apps/scout.app" }], () => fakeRead);
    const res = await measureSourceMetrics({
      bus,
      persistDir,
      measuredAt: sampleTime,
      appCollectors: (id) => reports.getCollector(id),
      isDue: (row) => row.id.startsWith("scout."),
    });
    expect(res.measured).toEqual(["scout.findings_7d"]);
    expect(res.skipped).toEqual(["scout.empty_ratio"]);
    expect(res.failures).toEqual([]);

    const summary = readObservabilitySummary(db, {
      query: observabilitySummaryQuery(new URLSearchParams("days=7"), sampleTime + 60_000),
      projectsRoot: persistDir,
      stateDir: persistDir,
      loadedApps: [{ id: "scout", owner: "scout" }],
      now: sampleTime + 60_000,
    });
    const scoutCard = summary.apps.find((a) => a.appId === "scout");
    expect(scoutCard?.domainMetrics.map((m) => ({ id: m.metricId, current: m.current }))).toEqual([
      { id: "scout.empty_ratio", current: null },
      { id: "scout.findings_7d", current: 2 },
    ]);

    // Reloading without scout.empty_ratio retires the removed collector cleanly.
    const appV2 = defineApp({ ...appV1, metrics: [appV1.metrics![0]!] });
    reports.syncDefinitions([{ definition: appV2, dir: "/apps/scout.app" }], () => fakeRead);
    const statusRow = db.prepare("SELECT status FROM metrics WHERE id = ?").get("scout.empty_ratio") as {
      status: string;
    };
    expect(statusRow.status).toBe("retired");
  } finally {
    closeAllDbs();
    rmSync(persistDir, { recursive: true, force: true });
  }
});
