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
  const reviewManager = {
    async callAgent(_agent: string, prompt: string) {
      task = prompt;
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
