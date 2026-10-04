import { describe, expect, it } from "bun:test";
import { Type, defineApp, type MetricDefinition } from "@may-agent/sdk";
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

  it("leaves the storage retry budget with the metric service", () => {
    const definition = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      inputSchema: Type.Object({}),
      metrics: [{ id: "evaluation.coverage" }],
    });
    let attempts = 0;

    expect(() => syncAppMetricDefinitions([{ definition }], {
      define() {
        attempts += 1;
        throw new Error("database is locked");
      },
    })).toThrow("database is locked");

    expect(attempts).toBe(1);
  });
});
