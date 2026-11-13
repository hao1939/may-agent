import { expect, test } from "bun:test";
import type { WorkflowContext } from "@may-agent/sdk";
import { memberEmissionKey, taskEmissionKey } from "./task-emission.js";

const event = {
  type: "evaluation.tick",
  data: { reason: "scheduled", scope: { b: 2, a: 1 } },
  target: { appId: "alex" },
};
const item = { observedAt: "2026-11-13T00:00:00.000Z", event };
const fact = {
  project: "scout-knowledge-lib",
  summary: "unchanged",
  facts: ["source:one"],
};

type ReconciliationEvents = NonNullable<
  WorkflowContext["reconciliation"]
>["events"];

function context(events: ReconciliationEvents, resourceVersion = 1) {
  return { reconciliation: { events, resourceVersion } };
}

// Frozen outputs from both original App helpers, before their consolidation.
const fixtures = [
  {
    name: "durable batch",
    ctx: context({
      items: [{ ...item, eventId: 101 }],
      throughEventId: 101,
      truncated: false,
    }),
    key: "event-101:observed",
  },
  {
    name: "last numbered event without a batch high-water mark",
    ctx: context({
      items: [
        { ...item, eventId: 99 },
        { ...item, eventId: 101 },
      ],
      truncated: false,
    }),
    key: "event-101:observed",
  },
  {
    name: "older trigger without an event ID",
    ctx: context({ items: [item], truncated: false }),
    key: "event-b7cb8f5c3a5aaba6:observed",
  },
  {
    name: "empty input batch",
    ctx: context({ items: [], truncated: false }),
    key: "observed",
  },
  { name: "standalone invocation", ctx: {}, key: "observed" },
];

test.each(fixtures)("preserves published keys for $name", ({ ctx, key }) => {
  expect(taskEmissionKey(ctx, "observed")).toBe(key);
  expect(taskEmissionKey(ctx, "observed", fact)).toBe(
    `${key}:fact-375b77d01877ea3e`,
  );
});

test("keeps retries stable across resource revisions and separates later inputs", () => {
  const events = {
    items: [{ ...item, eventId: 101 }],
    throughEventId: 101,
    truncated: false,
  };
  expect(taskEmissionKey(context(events, 8), "observed")).toBe(
    taskEmissionKey(context(events, 1), "observed"),
  );
  const next = {
    items: [{ ...item, eventId: 102 }],
    throughEventId: 102,
    truncated: false,
  };
  expect(taskEmissionKey(context(next), "observed")).toBe("event-102:observed");
  expect(taskEmissionKey(context(next), "observed")).not.toBe(
    taskEmissionKey(context(events), "observed"),
  );
});

test("untriggered retries keep the logical key within Host generation scope", () => {
  const events = { items: [], truncated: false };
  expect(taskEmissionKey(context(events, 1), "initial")).toBe("initial");
  expect(taskEmissionKey(context(events, 8), "initial")).toBe("initial");
});

test("preserves semantic member hashing, including nested fields and ordered arrays", () => {
  expect(
    memberEmissionKey("owner-finding", {
      appId: "gym",
      dedupeKey: "gym:verification-gap",
    }),
  ).toBe("owner-finding-18fc183d3ac01b4d");
  const first = memberEmissionKey("member", {
    scope: { b: 2, a: 1 },
    items: ["one", "two"],
  });
  expect(
    memberEmissionKey("member", {
      items: ["one", "two"],
      scope: { a: 1, b: 2 },
    }),
  ).toBe(first);
  expect(
    memberEmissionKey("member", {
      items: ["two", "one"],
      scope: { a: 1, b: 2 },
    }),
  ).not.toBe(first);
  expect(first).toMatch(/^member-[a-f0-9]{16}$/);
});

test("legacy trigger hashing ignores object field order but separates changed evidence", () => {
  const ctx = context({ items: [item], truncated: false });
  const reordered = {
    target: { appId: "alex" },
    data: { scope: { a: 1, b: 2 }, reason: "scheduled" },
    type: "evaluation.tick",
  };
  expect(
    taskEmissionKey(
      context({ items: [{ ...item, event: reordered }], truncated: false }),
      "observed",
    ),
  ).toBe(taskEmissionKey(ctx, "observed"));
  const changed = { ...event, data: { ...event.data, reason: "changed" } };
  expect(
    taskEmissionKey(
      context({ items: [{ ...item, event: changed }], truncated: false }),
      "observed",
    ),
  ).not.toBe(taskEmissionKey(ctx, "observed"));
});

test("content-bound keys distinguish changed serialized facts, including property order", () => {
  const ctx = context({
    items: [{ ...item, eventId: 101 }],
    throughEventId: 101,
    truncated: false,
  });
  const key = taskEmissionKey(ctx, "observed", fact);
  expect(taskEmissionKey(ctx, "observed", structuredClone(fact))).toBe(key);
  expect(
    taskEmissionKey(ctx, "observed", { ...fact, summary: "changed" }),
  ).not.toBe(key);
  expect(
    taskEmissionKey(ctx, "observed", {
      facts: fact.facts,
      summary: fact.summary,
      project: fact.project,
    }),
  ).not.toBe(key);
});
