import { expect, test } from "bun:test";
import {
  bindMetricReuseScope,
  metricScopeCovers,
  readBoundMetricReuseScope,
  type MetricReuseScope,
} from "./metric-decision-reuse.js";
import type { MetricEvidence } from "../alex.app/agents/evaluator/workflows/lib/metric-evidence.js";

function observation(): MetricEvidence {
  return {
    available: true,
    metricId: "fixture.latency",
    end: 1000,
    windowMs: 100,
    metric: {
      id: "fixture.latency",
      owner: "may",
      status: "active",
      threshold: 100,
    },
    responsibility: {
      appId: "may",
      status: "resolved",
      declaredOwner: "may",
      project: null,
    },
    freshness: "fresh",
    alertRule: null,
    calculationRule: { window: 100 },
    latest: {
      measuredBy: "fixture-reader",
      measuredAt: 999,
      value: 105,
      noteTruncated: 0,
      note: JSON.stringify({
        queryId: "42",
        failures: 0,
        coverage: "complete",
        evidenceTruncated: false,
      }),
    },
  };
}
const scope: MetricReuseScope = {
  concern:
    "Fixture query within owner-chosen bounds; failures require reconsideration",
  applicability: [
    { field: "source.queryId", equals: "42" },
    { field: "source.coverage", equals: "complete" },
    { field: "latest.value", gte: 0 },
    { field: "latest.value", lte: 120 },
  ],
  reconsiderWhen: [{ field: "source.failures", gt: 0 }],
};

test("scope binds the inspected evidence; new samples can reuse while material evidence changes cannot", () => {
  const initial = observation();
  const bound = bindMetricReuseScope(scope, initial);
  expect(readBoundMetricReuseScope(bound)).toEqual(bound);
  expect(bound.basis).toMatchObject({
    end: 1000,
    measuredBy: "fixture-reader",
  });
  const same = {
    ...initial,
    end: 2000,
    latest: { ...(initial.latest as object), value: 95, measuredAt: 1999 },
  };
  expect(metricScopeCovers(bound, same)).toBe(true);
  const edits: Array<(value: any) => void> = [
    (e) => {
      e.latest.value = 121;
    },
    (e) => {
      e.latest.measuredBy = "another-reader";
    },
    (e) => {
      e.latest.note = e.latest.note.replace('"42"', "42");
    },
    (e) => {
      e.latest.note = e.latest.note.replace('"failures":0', '"failures":1');
    },
    (e) => {
      e.metric.threshold = 110;
    },
    (e) => {
      e.calculationRule.window = 200;
    },
    (e) => {
      e.responsibility.appId = "alex";
    },
    (e) => {
      e.responsibility.status = "ambiguous";
    },
    (e) => {
      e.freshness = "stale";
    },
    (e) => {
      delete e.latest;
    },
    (e) => {
      delete e.latest.noteTruncated;
    },
    (e) => {
      e.latest.noteTruncated = 1;
    },
    (e) => {
      e.latest.note = e.latest.note.replace(
        '"evidenceTruncated":false',
        '"evidenceTruncated":true',
      );
    },
    (e) => {
      e.latest.note = "incomplete JSON";
    },
    (e) => {
      e.latest.note = '{"queryId":"42","coverage":"complete"}';
    },
    (e) => {
      e.latest.value = "105";
    },
  ];
  for (const edit of edits) {
    const changed = structuredClone(same);
    edit(changed);
    expect(metricScopeCovers(bound, changed)).toBe(false);
  }
});

test("comparisons retain type identity, require known values and reject executable or ambiguous shapes", () => {
  for (const predicate of [
    { field: "source.queryId", anyOf: ["42", "43"] },
    { field: "source.queryId", notEquals: 42 },
    { field: "latest.value", lt: 106 },
    { field: "latest.value", gt: 104 },
  ])
    expect(() =>
      bindMetricReuseScope(
        { ...scope, applicability: [predicate] },
        observation(),
      ),
    ).not.toThrow();
  for (const predicate of [
    { field: "source.queryId", equals: 42 },
    { field: "source.missing", notEquals: null },
    { field: "source.queryId", gt: 41 },
    { field: "latest.value", equals: 105, gt: 0 },
    { field: "metric.id", equals: "fixture.latency" },
    { field: "latest.__proto__", notEquals: null },
    { field: "latest.note", notEquals: null },
    { field: "latest.value", execute: "return true" },
  ])
    expect(() =>
      bindMetricReuseScope(
        { ...scope, applicability: [predicate as any] },
        observation(),
      ),
    ).toThrow();
  expect(() =>
    bindMetricReuseScope(
      { ...scope, reconsiderWhen: [{ field: "source.missing", equals: true }] },
      observation(),
    ),
  ).toThrow();
  expect(() =>
    bindMetricReuseScope({ ...scope, applicability: [] }, observation()),
  ).toThrow();
  expect(
    readBoundMetricReuseScope({
      ...bindMetricReuseScope(scope, observation()),
      extra: true,
    }),
  ).toBeNull();
});
