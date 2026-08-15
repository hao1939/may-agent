import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * build-check guard — warns if a coding step doesn't mention build/test success.
 *
 * This is a lightweight example guard. It inspects step_done events from agent
 * steps and emits a warning if the agent's final output doesn't mention
 * "build passes", "tests pass", or similar phrases.
 *
 * Guards return Demand[] — an empty array means "no objection".
 */

export const guard: WorkflowGuard = {
  name: "build-check",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    if (event.source !== "agent") return [];

    const text = event.result.lastAssistantText ?? "";
    const step = event.step.toLowerCase();

    // Only check coding-related steps
    const codingSteps = ["coder", "implement", "code", "fix", "patch"];
    if (!codingSteps.some((s) => step.includes(s))) return [];

    // Look for build/test success indicators
    const successPhrases = [
      /build\s+(passes|succeeded|success|ok|clean)/i,
      /tests?\s+(pass|succeeded|passing|green|ok)/i,
      /tsc.*no\s*emit.*success/i,
      /exit\s*code\s*0/i,
      /all\s+\d+\s+tests?\s+pass/i,
      /✅/,
    ];

    if (successPhrases.some((re) => re.test(text))) return [];

    // No success indicator found — warn
    return [
      {
        type: "warn",
        reason: `Step "${event.step}" completed without build/test success confirmation. ` +
          `Consider adding a verification step.`,
      },
    ];
  },
};
