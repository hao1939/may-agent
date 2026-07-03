import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { closeDb, getDb } from "./requests.js";
import { createMetricService } from "./metrics.js";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "may-metrics-"));
}

describe("metric service", () => {
  it("re-emits breach when an open alert changes", () => {
    const root = tempRoot();
    try {
      const emitted: Array<{
        type: string;
        data?: Record<string, unknown>;
      }> = [];
      const service = createMetricService({
        getDb: () => getDb(root),
        now: () => Date.now(),
        measuredBy: "test",
        emit: (type, data) => {
          emitted.push({ type, data });
        },
      });

      service.define({
        id: "process.unowned-work-count",
        name: "Unowned work",
        type: "gauge",
        target: 0,
        threshold: 0,
        alertOp: ">",
        priority: "P0",
        status: "active",
      });

      service.record("process.unowned-work-count", 2);
      service.evaluate("process.unowned-work-count");
      service.record("process.unowned-work-count", 15);
      service.evaluate("process.unowned-work-count");

      const breaches = emitted.filter((event) => event.type === "metric.breach");
      expect(breaches).toHaveLength(2);
      expect(breaches[1].data).toMatchObject({
        metricId: "process.unowned-work-count",
        current: 15,
        repeat: true,
        reason: "open-alert-updated",
      });
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
