import { describe, expect, it } from "bun:test";

import {
  getSessionIdFromTrigger,
  ownerEventTarget,
  reviewFailureDetails,
  reviewProcessFailureOutcome,
  shouldSkipAftermathAmplification,
  triggerRequiresSessionId,
} from "./evaluator-aftermath";

describe("evaluator aftermath event contract", () => {
  it("accepts sessionId from params for explicit session evaluation", () => {
    expect(
      getSessionIdFromTrigger({
        type: "evaluation.session.requested",
        params: { sessionId: "s_explicit" },
      }),
    ).toBe("s_explicit");
  });

  it("requires session id only for concrete session events", () => {
    expect(triggerRequiresSessionId({ type: "session.end" })).toBe(true);
    expect(
      triggerRequiresSessionId({ type: "evaluation.session.requested" }),
    ).toBe(true);
    expect(
      triggerRequiresSessionId({ type: "evaluation.aftermath.scan" }),
    ).toBe(false);
  });

  it("normalizes scoped owner labels to flat message targets", () => {
    expect(ownerEventTarget("agent:may/runtime")).toBe("may");
    expect(ownerEventTarget("may/runtime")).toBe("may");
    expect(ownerEventTarget("agent:tech-lead")).toBe("tech-lead");
    expect(ownerEventTarget("human:runtime-owner")).toBe("may");
  });

  it("classifies reviewer runtime failure separately from source quality", () => {
    expect(
      reviewFailureDetails({
        status: "error",
        sessionId: "s_review",
        error:
          "OpenAI API error (429): No deployments available for selected model",
      }),
    ).toMatchObject({
      failureScope: "review_process",
      reviewCompleted: false,
      reviewFailureType: "provider_unavailable",
      retryable: true,
      reviewSessionId: "s_review",
    });
  });

  it("returns owner fallback for a review-process provider failure without an observer", () => {
    const details = reviewFailureDetails({
      status: "error",
      sessionId: "s_review_provider",
      error: "OpenAI API error (429): No deployments available",
    });

    const outcome = reviewProcessFailureOutcome(
      "s_source_concrete",
      { agent: "coder" },
      details,
    );

    expect(outcome.state).toBe("needs-owner");
    expect(outcome.actions).toEqual([]);
    expect(outcome.summary).toContain("standard owner fallback");
    expect(outcome.evidence.join("\n")).toContain("evaluation.review_failed");
    expect(outcome).not.toHaveProperty("conditions");
  });

  it("structured-skips runtime duplicate resume already-active terminal rows", () => {
    expect(
      shouldSkipAftermathAmplification(
        {
          status: "done",
          error: 'Failed to resume session: Session "s_example" already active',
          opCount: 40,
        },
        "",
      ),
    ).toEqual({
      skip: true,
      reason: "runtime_duplicate_resume_already_active",
    });
  });
});
