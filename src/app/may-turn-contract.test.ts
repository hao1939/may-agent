import { describe, expect, it } from "bun:test";
import { admitMayBreakGlassResult, admitMayTurnDecision } from "./may-turn-contract.js";

describe("May turn contract", () => {
  it("accepts a normal app route", () => {
    const result = admitMayTurnDecision({
      disposition: "route",
      response: "I am routing this to Gym; you do not need to act.",
      project: "gym",
      outcome: "Train May on the new behavior.",
      requiredProof: "A held-back Gym evaluation passes.",
      constraints: ["Keep the current evaluator fixed."],
    });
    expect(result.ok).toBe(true);
  });

  it("requires a bounded break-glass contract", () => {
    expect(
      admitMayTurnDecision({
        disposition: "break-glass",
        response: "I am taking over the failed runtime repair.",
        reason: "The platform owner path failed twice.",
        scope: "Repair message routing only.",
        terminalProof: "The original message receives the correct reply.",
      }).ok,
    ).toBe(false);
  });

  it("accepts verified closure and explicit hand-back results", () => {
    expect(
      admitMayBreakGlassResult({
        disposition: "closed",
        summary: "Message routing is restored.",
        evidence: ["Targeted tests passed."],
      }).ok,
    ).toBe(true);
    expect(
      admitMayBreakGlassResult({
        disposition: "hand-back",
        summary: "The controller is repaired; the app can continue.",
        evidence: ["Controller smoke test passed."],
        project: "gym",
        outcome: "Continue the existing campaign.",
        requiredProof: "The campaign converges.",
      }).ok,
    ).toBe(true);
  });
});
