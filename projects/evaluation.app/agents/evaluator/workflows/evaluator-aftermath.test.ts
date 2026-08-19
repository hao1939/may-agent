import { describe, expect, test } from "bun:test";
import type { AppEvent, ExecutionResult } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  AFTERMATH_VERSION,
  aftermathContinuationEvent,
  buildAftermathTask,
  evaluationRecordedFact,
  execute,
  humanDecisionEvent,
  ownerFindingEvent,
  parseAftermathOutcome,
  skippedEvaluationFact,
  type AftermathEvaluation,
  type AftermathFinding,
  type AftermathInput,
} from "./evaluator-aftermath.ts";

const evaluation: AftermathEvaluation = {
  sessionId: "s_source",
  agent: "coder",
  quality: 0.6,
  efficiency: 0.7,
  productiveCalls: 7,
  wastedCalls: 2,
  verdict: "acceptable",
  issues: ["verification was incomplete"],
  lane: "needs_triage",
  reason: "material output lacks final verification",
  signals: ["file write", "missing read-back"],
  overall: {
    resultDelivered: true,
    valueProduced: "implementation",
    evidence: ["tool call 7 wrote the target"],
  },
};

const finding: AftermathFinding = {
  targetAppId: "aks-rp-e2e",
  severity: "concern",
  summary: "Verification gap needs an owner decision",
  message: "Review the exact changed target and require a read-back check.",
  evidence: ["session:s_source", "tool-call:7"],
  dedupeKey: "aks-rp-e2e:verification-gap",
  requestedHumanAction: "decide",
};

function reconciliation(input: AftermathInput) {
  return {
    appId: "evaluation",
    taskId: input.sessionId
      ? `runtime/session-aftermath/${input.sessionId}`
      : "runtime/aftermath-backfill",
    generation: 4,
    resourceVersion: 8,
    owner: "evaluator",
    mode: input.sessionId ? ("achieve" as const) : ("maintain" as const),
    outcome: "Evaluate terminal sessions.",
    acceptance: ["One durable evaluation or structured skip exists."],
    input,
    children: { live: [], completed: [] },
  };
}

function agentResult(output: unknown): ExecutionResult {
  return {
    id: "s_evaluator",
    kind: "agent",
    status: "done",
    summary: "bounded evaluation complete",
    output,
  };
}

function context(
  input: AftermathInput,
  output: unknown,
  events: AppEvent[],
  summary?: string,
) {
  return createTestAppWorkflowContext({
    input,
    reconciliation: reconciliation(input),
    callAgent: async () =>
      summary === undefined
        ? agentResult(output)
        : { ...agentResult(undefined), summary },
    emit: async (event) => {
      events.push(event);
    },
  });
}

describe("canonical evaluator aftermath", () => {
  test("parses one strict evaluation and preserves bounded findings", () => {
    expect(
      parseAftermathOutcome(
        {
          kind: "evaluation",
          evaluation,
          findings: [finding],
          backlogRemaining: true,
        },
        "s_source",
      ),
    ).toEqual({
      kind: "evaluation",
      evaluation,
      findings: [finding],
      backlogRemaining: true,
    });
  });

  test("accepts canonical result and legacy finish-summary envelopes", () => {
    const expected = {
      kind: "evaluation" as const,
      evaluation,
      findings: [],
      backlogRemaining: false,
    };
    expect(parseAftermathOutcome({ result: expected }, "s_source")).toEqual(
      expected,
    );
    expect(
      parseAftermathOutcome(
        { summary: JSON.stringify(expected), completed_items: ["evaluated"] },
        "s_source",
      ),
    ).toEqual(expected);
  });

  test("rejects substitution, invalid scores, and partially valid finding lists", () => {
    expect(
      parseAftermathOutcome(
        {
          kind: "evaluation",
          evaluation: { ...evaluation, sessionId: "s_other" },
          findings: [],
          backlogRemaining: false,
        },
        "s_source",
      ),
    ).toBeNull();
    expect(
      parseAftermathOutcome({
        kind: "evaluation",
        evaluation: { ...evaluation, quality: 2 },
        findings: [],
      }),
    ).toBeNull();
    expect(
      parseAftermathOutcome({
        kind: "evaluation",
        evaluation,
        findings: [finding, { ...finding, targetAppId: "../bad" }],
      }),
    ).toBeNull();
  });

  test("accepts existing, skip, and empty-frontier outcomes", () => {
    expect(
      parseAftermathOutcome(
        {
          kind: "existing",
          sessionId: "s_source",
          verdict: "good",
          createdAt: 100,
        },
        "s_source",
      ),
    ).toEqual({
      kind: "existing",
      sessionId: "s_source",
      verdict: "good",
      createdAt: 100,
    });
    expect(
      parseAftermathOutcome({
        kind: "skip",
        sessionId: "s_skip",
        agent: "coder",
        reason: "runtime duplicate-resume carrier",
        backlogRemaining: true,
      }),
    ).toMatchObject({ kind: "skip", backlogRemaining: true });
    expect(
      parseAftermathOutcome({ noCandidate: true, reason: "frontier current" }),
    ).toEqual({ kind: "none", reason: "frontier current" });
  });

  test("builds an exact-session prompt without legacy prompt parsing or mutation authority", () => {
    const prompt = buildAftermathTask("s_exact");
    expect(prompt).toContain("Evaluate exactly session s_exact");
    expect(prompt).toContain("never substitute another session");
    expect(prompt).toContain("Use query_db");
    expect(prompt).toContain(
      "Do not edit files, write the database, send messages",
    );
    expect(prompt).toContain("finish().result");
  });

  test("builds a one-candidate frontier prompt with explicit priority and continuation evidence", () => {
    const prompt = buildAftermathTask();
    expect(prompt).toContain("select at most one eligible terminal session");
    expect(prompt).toContain("Prioritize failed/interrupted sessions");
    expect(prompt).toContain("recent 3h window");
    expect(prompt).toContain("set backlogRemaining");
  });

  test("publishes the complete durable evaluation projection fact", () => {
    expect(
      evaluationRecordedFact(evaluation, "s_evaluator", 1_700_000_000_000),
    ).toEqual({
      type: "evaluation.recorded",
      owner: "agent:evaluator",
      data: {
        source: "evaluator-aftermath",
        evaluation: {
          ...evaluation,
          overall: {
            ...evaluation.overall,
            aftermathVersion: AFTERMATH_VERSION,
            evaluationExecutionId: "s_evaluator",
          },
          createdAt: 1_700_000_000_000,
        },
      },
      target: {
        appId: "evaluation",
        project: "evaluation",
        sessionId: "s_source",
      },
    });
  });

  test("routes owner findings and concrete human decisions through canonical App events", () => {
    expect(ownerFindingEvent(finding, evaluation)).toMatchObject({
      type: "project.owner.requested",
      data: {
        project: "aks-rp-e2e",
        reason: "evaluation-session-finding",
        sourceSessionId: "s_source",
      },
      target: { appId: "aks-rp-e2e", project: "aks-rp-e2e" },
    });
    expect(humanDecisionEvent(finding, evaluation)).toMatchObject({
      type: "evaluation.human_decision.requested",
      data: {
        requestedHumanAction: "decide",
        dedupeKey: "aks-rp-e2e:verification-gap",
      },
      target: { appId: "may", project: "may" },
    });
  });

  test("evaluates an exact session from a finish summary, persists before routing, and returns a typed reconciliation result", async () => {
    const events: AppEvent[] = [];
    const outcome = {
      kind: "evaluation",
      evaluation,
      findings: [finding],
      backlogRemaining: true,
    };
    const result = await execute(
      context(
        { sessionId: "s_source" },
        undefined,
        events,
        JSON.stringify(outcome),
      ),
    );
    expect(result.status).toBe("done");
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.recorded",
      "project.owner.requested",
      "evaluation.human_decision.requested",
    ]);
    expect(result.output).toMatchObject({
      state: "converged",
      actions: [],
      evidence: ["execution:s_evaluator", "evaluated-session:s_source"],
    });
  });

  test("records a structured skip as the same durable evaluation fact", async () => {
    const events: AppEvent[] = [];
    const skip = {
      kind: "skip" as const,
      sessionId: "s_skip",
      agent: "coder",
      reason: "duplicate runtime carrier",
      backlogRemaining: false,
    };
    const result = await execute(
      context({ sessionId: "s_skip" }, skip, events),
    );
    expect(result.status).toBe("done");
    expect(events).toEqual([
      skippedEvaluationFact(skip, "s_evaluator", expect.any(Number)),
    ]);
    expect(recordedEvaluation(events[0])).toMatchObject({
      sessionId: "s_skip",
      verdict: "skipped",
      overall: { structuredSkip: true, aftermathVersion: AFTERMATH_VERSION },
    });
  });

  test("emits one compact continuation only for a standing frontier with backlog", async () => {
    const events: AppEvent[] = [];
    const result = await execute(
      context(
        { scope: "session-aftermath-frontier" },
        {
          kind: "evaluation",
          evaluation,
          findings: [],
          backlogRemaining: true,
        },
        events,
      ),
    );
    expect(result.status).toBe("done");
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.recorded",
      "evaluation.aftermath.scan",
    ]);
    expect(events[1]).toEqual(aftermathContinuationEvent("s_source"));
  });

  test("converges a current frontier and an already-recorded exact session without side effects", async () => {
    const frontierEvents: AppEvent[] = [];
    const frontier = await execute(
      context(
        { scope: "session-aftermath-frontier" },
        { kind: "none", reason: "No eligible terminal session." },
        frontierEvents,
      ),
    );
    expect(frontier.status).toBe("done");
    expect(frontierEvents).toEqual([]);

    const existingEvents: AppEvent[] = [];
    const existing = await execute(
      context(
        { sessionId: "s_source" },
        { kind: "existing", sessionId: "s_source", verdict: "good" },
        existingEvents,
      ),
    );
    expect(existing.status).toBe("done");
    expect(existingEvents).toEqual([]);
  });

  test("blocks incomplete review execution and emits no target or human request", async () => {
    const events: AppEvent[] = [];
    const ctx = createTestAppWorkflowContext({
      input: { sessionId: "s_source" },
      reconciliation: reconciliation({ sessionId: "s_source" }),
      callAgent: async () => ({
        id: "s_failed",
        kind: "agent",
        status: "error",
        summary: "provider unavailable",
      }),
      emit: async (event) => {
        events.push(event);
      },
    });
    const result = await execute(ctx);
    expect(result.status).toBe("blocked");
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.review_failed",
    ]);
    expect(
      events.some((event) => event.type === "project.owner.requested"),
    ).toBeFalse();
    expect(
      events.some(
        (event) => event.type === "evaluation.human_decision.requested",
      ),
    ).toBeFalse();
  });

  test("blocks malformed output and inputs outside canonical reconciliation", async () => {
    const events: AppEvent[] = [];
    const malformed = await execute(
      context({ sessionId: "s_source" }, { kind: "evaluation" }, events),
    );
    expect(malformed.status).toBe("blocked");
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.review_failed",
    ]);

    const noReconciliation = await execute(
      createTestAppWorkflowContext({
        input: { sessionId: "s_source" },
      }),
    );
    expect(noReconciliation.status).toBe("blocked");
  });
});

function recordedEvaluation(
  event: AppEvent | undefined,
): Record<string, unknown> {
  if (!event || !event.data || typeof event.data !== "object") return {};
  const data = event.data as Record<string, unknown>;
  return data.evaluation && typeof data.evaluation === "object"
    ? (data.evaluation as Record<string, unknown>)
    : {};
}
