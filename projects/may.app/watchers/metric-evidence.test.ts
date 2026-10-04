import { expect, test } from "bun:test";
import { readMetricObservation } from "../../alex.app/agents/evaluator/workflows/lib/metric-evidence.js";
import { createMetricEvidenceObserver } from "./metric-evidence.js";

test("metric observation reads exact retained facts without App-catalog attribution", async () => {
  const calls: string[] = [];
  const controller = new AbortController();
  const observer = createMetricEvidenceObserver((id, end, alert, signal) =>
    readMetricObservation(id, end, alert, signal, (async (url, init) => {
      calls.push(String(url));
      expect(init?.signal?.aborted).toBe(false);
      return Response.json({
        version: 1,
        available: true,
        metricId: id,
        end,
        metric: { id, status: "active", owner: "unavailable-app" },
        freshness: "fresh",
        latest: { id: 17, measuredAt: end - 1, value: 0 },
      });
    }) as typeof fetch),
  );
  const result = await observer.inspect("sample.failures", {
    signal: controller.signal,
  });
  expect(calls).toHaveLength(1);
  expect(new URL(calls[0]).pathname).toBe(
    "/api/metrics/sample.failures/evidence",
  );
  expect(result).toMatchObject({
    metricId: "sample.failures",
    value: 0,
    sampleId: 17,
    freshness: "fresh",
  });
});

test("observer cancellation reaches its pending HTTP read and leaves no successful observation", async () => {
  const controller = new AbortController();
  let observedSignal: AbortSignal | null | undefined;
  const observer = createMetricEvidenceObserver((id, end, alert, signal) =>
    readMetricObservation(id, end, alert, signal, ((_url, init) => {
      observedSignal = init?.signal;
      return new Promise((_resolve, reject) => {
        observedSignal!.addEventListener(
          "abort",
          () => reject(observedSignal!.reason),
          { once: true },
        );
      });
    }) as typeof fetch),
  );
  const reading = observer.inspect("sample.failures", {
    signal: controller.signal,
  });
  expect(observedSignal).toBeDefined();
  controller.abort(new Error("Observation stopped"));
  await expect(reading).rejects.toThrow("Observation stopped");
  expect(observedSignal!.aborted).toBe(true);
});
