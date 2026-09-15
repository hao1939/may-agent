import { expect, test } from "bun:test";
import { createExecutionUsage } from "./execution-usage.js";
import { preparationFixture, usageReply, observeReply } from "../../test/fixtures/execution-usage.js";

test("usage counts new model replies, caches and fallback separately, including empty error responses", () => {
  const collector = createExecutionUsage(preparationFixture);
  const first = usageReply();
  observeReply(collector, first);
  observeReply(collector, first); // same live observation, not another model reply
  const before = collector.snapshot();
  observeReply(collector, usageReply({ provider: "fallback", model: "model-b", stopReason: "error" }));
  collector.observe({ type: "tool_execution_start", toolCallId: "tool-1", toolName: "read", args: {} }, {} as never);
  expect(collector.snapshot()).toMatchObject({
    toolCalls: 1,
    totals: {
      replies: 2,
      measuredReplies: 2,
      input: 20,
      cacheRead: 200,
      cacheWrite: 40,
      output: 10,
      estimatedCost: 0.08,
      estimatedCostReplies: 2,
    },
  });
  expect(collector.snapshot().models.map((row) => row.provider)).toEqual(["fallback", "fixture"]);
  expect(before.totals.replies).toBe(1);
});

test("zero, missing and invalid usage stay unknown; missing pricing does not imply free usage", () => {
  const collector = createExecutionUsage(preparationFixture);
  observeReply(collector, usageReply({ usage: undefined as never }));
  observeReply(
    collector,
    usageReply({ usage: { ...usageReply().usage, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 } }),
  );
  observeReply(collector, usageReply({ usage: { ...usageReply().usage, input: -1 } }));
  observeReply(collector, usageReply({ usage: { ...usageReply().usage, input: Infinity } }));
  observeReply(collector, usageReply({ usage: { ...usageReply().usage, cost: undefined as never } }));
  expect(collector.snapshot().totals).toMatchObject({
    replies: 5,
    measuredReplies: 1,
    estimatedCostReplies: 0,
    input: 10,
    cacheRead: 100,
    cacheWrite: 20,
    output: 5,
    estimatedCost: 0,
  });
});
