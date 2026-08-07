import { expect, test } from "bun:test";
import type { SubagentManager } from "../../lib/manager.js";
import { reviewHumanAttention } from "./human-attention-review.js";

function manager(result: Record<string, unknown>): SubagentManager {
  return {
    async callAgent() {
      return result;
    },
  } as unknown as SubagentManager;
}

test("teaches decision packets and useful digests as different deliveries", async () => {
  let task = "";
  let toolPolicy = "";
  let outputSchema: Record<string, unknown> | undefined;
  const reviewManager = {
    async callAgent(
      _agent: string,
      prompt: string,
      options: { toolPolicy?: string; outputSchema?: Record<string, unknown> },
    ) {
      task = prompt;
      toolPolicy = options.toolPolicy ?? "";
      outputSchema = options.outputSchema;
      return {
        status: "done",
        sessionId: "digest-review",
        structuredResult: {
          disposition: "deliver",
          understoodIntent: "The producer proposes the requested daily digest.",
          reason: "The accepted digest is useful.",
          nextAction: "Deliver the compact facts.",
          evidence: ["Current, safe, and requested."],
          deliveredMessage: "All critical services are healthy.",
        },
      };
    },
  } as unknown as SubagentManager;

  await reviewHumanAttention(
    reviewManager,
    {
      sourceEventId: 5055708,
      eventType: "message.created",
      from: "ops",
      content: "Daily digest ready.",
    },
    "/app",
  );

  expect(task).toContain("When a human decision remains");
  expect(task).toContain("When an accepted useful digest is delivered");
  expect(task).toContain("Never invent approval choices or a recommendation");
  expect(task).toContain("track both access and diagnostic completion");
  expect(task).toContain("Deliver a later update only when");
  expect(task).toContain("perform one bounded action before finishing");
  expect(task).toContain("A recovered proposal is handle");
  expect(task).toContain("Never contact Hao directly");
  expect(task).toContain("Start from bounded durable evidence");
  expect(task).toContain("Do not fall back to repository-wide search");
  expect(task).toContain("Authoritative candidate sourceEventId: 5055708");
  expect(task).toContain("Do not treat a prior human.attention.reviewed, channel.delivery.*, or message.resolved row as closure unless it matches the exact sourceEventId above");
  expect(task).toContain("After you confirm the candidate payload, exact lineage, and exact prior-closure check, either decide or safe-route");
  expect(task).toContain("do not abandon the review silently");
  expect(toolPolicy).toBe("full");
  const variants = (outputSchema as { anyOf?: Array<{ required?: string[] }> })?.anyOf ?? [];
  expect(variants).toHaveLength(3);
  expect(variants.slice(0, 2).every((variant) => variant.required?.includes("actionTaken"))).toBe(true);
  expect(variants.slice(0, 2).every((variant) => variant.required?.includes("closureCondition"))).toBe(true);
  expect(variants[2]?.required).toContain("deliveredMessage");
});

test("returns May's structured human-attention judgment", async () => {
  const review = await reviewHumanAttention(
    manager({
      status: "done",
      sessionId: "review-session",
      structuredResult: {
        disposition: "deliver",
        understoodIntent: "Ask Hao to approve one proven scorer meaning.",
        reason: "Approved evaluation meaning belongs to Hao.",
        nextAction: "Wait for approve or reject, then rerun the baseline.",
        evidence: ["Three trials and the semantic controls pass."],
        deliveredMessage: "Approve scorer candidate sha256:7ad1? I recommend approve.",
      },
    }),
    {
      eventType: "message.created",
      from: "gym",
      content: "Need approval for evaluator changes.",
    },
    "/app",
  );

  expect(review).toEqual({
    status: "completed",
    sessionId: "review-session",
    disposition: "deliver",
    understoodIntent: "Ask Hao to approve one proven scorer meaning.",
    reason: "Approved evaluation meaning belongs to Hao.",
    nextAction: "Wait for approve or reject, then rerun the baseline.",
    owner: undefined,
    evidence: ["Three trials and the semantic controls pass."],
    actionTaken: undefined,
    closureCondition: undefined,
    reviewAgainWhen: undefined,
    deliveredMessage: "Approve scorer candidate sha256:7ad1? I recommend approve.",
  });
});

test("fails a deliver judgment without human-ready text", async () => {
  const review = await reviewHumanAttention(
    manager({
      status: "done",
      sessionId: "review-session",
      structuredResult: {
        disposition: "deliver",
        understoodIntent: "Ask Hao.",
        reason: "Human authority remains.",
        nextAction: "Wait.",
        evidence: [],
      },
    }),
    {
      eventType: "message.created",
      from: "owner",
      content: "Need a decision.",
    },
    "/app",
  );

  expect(review).toEqual({
    status: "failed",
    sessionId: "review-session",
    reason: "May chose deliver without a delivered message",
  });
});

test("fails a routed judgment that did not push work to an accountable owner", async () => {
  const review = await reviewHumanAttention(
    manager({
      status: "done",
      sessionId: "review-session",
      structuredResult: {
        disposition: "route",
        understoodIntent: "Recover a project-owned product failure.",
        reason: "The project owner can act before Hao is needed.",
        nextAction: "Route to the owner.",
        owner: "app-ops",
        evidence: ["No owner recovery attempt exists."],
      },
    }),
    {
      eventType: "message.created",
      from: "evaluator",
      content: "AKS failed. Ask Hao what to do.",
    },
    "/app",
  );

  expect(review).toEqual({
    status: "failed",
    sessionId: "review-session",
    reason: "May chose route without a completed action and closure condition",
  });
});
