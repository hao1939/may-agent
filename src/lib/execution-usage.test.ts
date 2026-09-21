import { expect, test } from "bun:test";
import { calculateCost } from "@earendil-works/pi-ai";
import { createModelRegistry } from "../app/model-registry.js";
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

test("the registered DeepSeek model preserves usage without claiming a zero-cost estimate", () => {
  const model = createModelRegistry({
    DEEPSEEK_BASE_URL: "https://deepseek.example.test/v1",
    DEEPSEEK_API_KEY: "synthetic-unused",
  })["deepseek-v4-flash"]!;
  const collector = createExecutionUsage(preparationFixture);
  const usage = usageReply().usage;
  calculateCost(model, usage);
  observeReply(
    collector,
    usageReply({
      provider: model.provider,
      model: model.id,
      usage,
    }),
  );

  expect(Number.isNaN(usage.cost.total)).toBe(true);
  expect(collector.snapshot().totals).toMatchObject({
    replies: 1,
    measuredReplies: 1,
    estimatedCostReplies: 0,
    input: usage.input,
    cacheRead: usage.cacheRead,
    cacheWrite: usage.cacheWrite,
    output: usage.output,
    estimatedCost: 0,
  });
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
