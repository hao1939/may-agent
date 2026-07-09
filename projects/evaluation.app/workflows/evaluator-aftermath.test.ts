import { describe, expect, it } from "bun:test";

import {
  getSessionIdFromTrigger,
  reviewFailureDetails,
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
    expect(triggerRequiresSessionId({ type: "session.completed" })).toBe(true);
    expect(
      triggerRequiresSessionId({ type: "evaluation.session.requested" }),
    ).toBe(true);
    expect(
      triggerRequiresSessionId({ type: "evaluation.aftermath.scan" }),
    ).toBe(false);
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
});
