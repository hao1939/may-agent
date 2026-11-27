import { describe, expect, it } from "bun:test";
import { Type, defineApp, type MetricDefinition } from "@may-agent/sdk/app";
import { syncAppMetricDefinitions } from "./metric-definitions.js";

describe("App metric definitions", () => {
  it("installs declared definitions with App defaults", () => {
    const installed: MetricDefinition[] = [];
    const definition = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      inputSchema: Type.Object({}),
      metrics: [
        {
          id: "evaluation.coverage",
          type: "gauge",
          sourceQuery: "SELECT 1 AS value",
          measureInterval: 300_000,
        },
      ],
    });

    syncAppMetricDefinitions([{ definition }], {
      define(metric) {
        installed.push(metric);
      },
    });

    expect(installed).toEqual([
      expect.objectContaining({
        id: "evaluation.coverage",
        owner: "evaluator",
        project: "evaluation",
        sourceQuery: "SELECT 1 AS value",
      }),
    ]);
  });

  it("preserves explicit ownership", () => {
    const installed: MetricDefinition[] = [];
    const definition = defineApp({
      id: "platform",
      version: 1,
      agent: "tech-lead",
      inputSchema: Type.Object({}),
      metrics: [{ id: "platform.health", owner: "operator", project: "host" }],
    });
    syncAppMetricDefinitions([{ definition }], { define: (metric) => installed.push(metric) });
    expect(installed[0]).toMatchObject({ owner: "operator", project: "host" });
  });

  it("retries ordinary SQLite contention while installing a definition", () => {
    const definition = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      inputSchema: Type.Object({}),
      metrics: [{ id: "evaluation.coverage" }],
    });
    let attempts = 0;

    syncAppMetricDefinitions([{ definition }], {
      define() {
        attempts += 1;
        if (attempts === 1) throw new Error("database is locked");
      },
    });

    expect(attempts).toBe(2);
  });

  it("registers bounded collect() definitions as app-collector domain metrics and rejects raw SQL mixing", () => {
    const installed: MetricDefinition[] = [];
    const definition = defineApp({
      id: "scout-knowledge-lib",
      version: 1,
      agent: "scout",
      inputSchema: Type.Object({}),
      metrics: [
        {
          id: "scout-knowledge-lib.findings_published_7d",
          name: "Findings published (7d)",
          unit: "outcomes",
          direction: "up",
          collect: async ({ now }) => ({ value: 12, sampleSize: 12, measuredAt: now }),
        },
      ],
    });

    syncAppMetricDefinitions([{ definition }], { define: (metric) => installed.push(metric) });
    expect(installed[0]).toMatchObject({
      id: "scout-knowledge-lib.findings_published_7d",
      owner: "scout",
      project: "scout-knowledge-lib",
      source: "app-collector",
      measureInterval: 300_000,
      config: { scope: "app:scout-knowledge-lib", domainMetric: true },
    });
    expect(installed[0]?.collect).toBeUndefined();

    const invalid = defineApp({
      id: "scout-knowledge-lib",
      version: 1,
      agent: "scout",
      inputSchema: Type.Object({}),
      metrics: [
        {
          id: "scout-knowledge-lib.mixed",
          sourceQuery: "SELECT 1 AS value",
          collect: () => 1,
        },
      ],
    });
    expect(() => syncAppMetricDefinitions([{ definition: invalid }], { define() {} })).toThrow(
      /cannot combine collect\(\) with sourceQuery or sourceCommand/,
    );
  });
});
