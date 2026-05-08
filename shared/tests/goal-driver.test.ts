import { describe, expect, it } from "vitest";
import { parseDecision } from "../workflows/goal-driver.ts";

describe("goal-driver parseDecision", () => {
  it("parses a valid ACT decision", () => {
    const decision = parseDecision(`DECISION: ACT
RATIONALE: The goal has a clear next step.
NEXT_ACTION: Update the project context with verified facts.
VALIDATION_SIGNAL: The next run sees the context and avoids duplicate work.`);

    expect(decision.kind).toBe("ACT");
    expect(decision.rationale).toContain("clear next step");
    expect(decision.nextAction).toContain("Update the project context");
    expect(decision.validationSignal).toContain("avoids duplicate work");
  });

  it("keeps multiline sections intact", () => {
    const decision = parseDecision(`DECISION: ESCALATE
RATIONALE: The next movement is not safe.
- Source facts conflict.
- Human judgment is needed.
NEXT_ACTION: Ask May to decide.
VALIDATION_SIGNAL: May records a decision.`);

    expect(decision.kind).toBe("ESCALATE");
    expect(decision.rationale).toContain("Source facts conflict");
    expect(decision.rationale).toContain("Human judgment is needed");
  });

  it("rejects responses that do not put the decision first", () => {
    const decision = parseDecision(`I believe all work is done.

DECISION: DONE_THIS_RUN
RATIONALE: Complete.`);

    expect(decision.kind).toBe("INVALID");
  });
});
