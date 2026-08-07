import { describe, expect, it } from "bun:test";
import { Type } from "@earendil-works/pi-ai";
import {
  shouldAttemptWorkflowFinishRecovery,
  workflowFinishRecoveryPrompt,
} from "./workflow-finish-recovery.js";

describe("workflow finish recovery", () => {
  it("retries finish recovery after infra/provider failures", () => {
    expect(
      shouldAttemptWorkflowFinishRecovery(
        'OpenAI API error (429): {"message":"No deployments available for selected model, Try again in 5 seconds."}',
      ),
    ).toBe(true);
  });

  it("retries finish recovery after empty assistant failures", () => {
    expect(
      shouldAttemptWorkflowFinishRecovery("Agent ended with an empty assistant turn"),
    ).toBe(true);
  });

  it("does not retry finish recovery after logic/auth failures", () => {
    expect(
      shouldAttemptWorkflowFinishRecovery(
        "AuthenticationError: HTTP 401 Unauthorized",
      ),
    ).toBe(false);
  });

  it("mentions transient failure and schema payload in the recovery prompt", () => {
    const prompt = workflowFinishRecoveryPrompt(
      Type.Object({ state: Type.String() }),
      "OpenAI API error (429): No deployments available for selected model",
    );

    expect(prompt).toContain("transient runtime/provider failure");
    expect(prompt).toContain("Do not repeat prior reads");
    expect(prompt).toContain("schema-validated result payload");
  });
});
