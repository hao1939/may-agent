import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import type { AppEvent, ExecutionResult } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { Check } from "typebox/value";
import {
  AFTERMATH_VERSION,
  aftermathOutcomeSchema,
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
    taskId: `runtime/session-aftermath/${input.sessionId || "missing"}`,
    generation: 4,
    resourceVersion: 8,
    agent: "evaluator",
    mode: "achieve" as const,
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
  appRoot?: string,
) {
  return createTestAppWorkflowContext({
    input,
    reconciliation: reconciliation(input),
    ...(appRoot
      ? {
          workspace: {
            appRoot,
            projectRoot: appRoot,
            root: appRoot,
            output: join(appRoot, ".output"),
          },
        }
      : {}),
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
        },
        "s_source",
      ),
    ).toEqual({
      kind: "evaluation",
      evaluation,
      findings: [finding],
    });
  });

  test("accepts a structured result envelope but never parses summary prose", () => {
    const expected = {
      kind: "evaluation" as const,
      evaluation,
      findings: [],
    };
    expect(parseAftermathOutcome({ result: expected }, "s_source")).toEqual(
      expected,
    );
    expect(
      parseAftermathOutcome(
        { summary: JSON.stringify(expected), completed_items: ["evaluated"] },
        "s_source",
      ),
    ).toBeNull();
  });

  test("rejects substitution, invalid scores, and partially valid finding lists", () => {
    expect(
      parseAftermathOutcome(
        {
          kind: "evaluation",
          evaluation: { ...evaluation, sessionId: "s_other" },
          findings: [],
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
        evaluation: { ...evaluation, overall: { resultDelivered: true } },
        findings: [],
      }),
    ).toBeNull();
    expect(
      Check(aftermathOutcomeSchema, {
        kind: "evaluation",
        evaluation: { ...evaluation, overall: { resultDelivered: true } },
        findings: [],
      }),
    ).toBe(false);
    expect(
      parseAftermathOutcome({
        kind: "evaluation",
        evaluation,
        findings: [finding, { ...finding, targetAppId: "../bad" }],
      }),
    ).toBeNull();
  });

  test("accepts existing and structured skip outcomes", () => {
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
      }),
    ).toMatchObject({ kind: "skip", sessionId: "s_skip" });
    expect(parseAftermathOutcome({ noCandidate: true })).toBeNull();
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

  test("requires complete same-session lifecycle authority and supports explicit supersession", () => {
    const ordinary = buildAftermathTask("s_resume_lifecycle");
    const repair = buildAftermathTask("s_resume_lifecycle", true);
    expect(ordinary).toContain(
      "successful auto-resume terminal result supersedes",
    );
    expect(ordinary).toContain("genuinely terminal interrupted");
    expect(repair).toContain(
      "explicit correction: do not return kind=existing",
    );
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

  test("requests a schema-valid result for the exact canonical session", async () => {
    const events: AppEvent[] = [];
    const outcome = {
      kind: "evaluation" as const,
      evaluation,
      findings: [finding],
    };
    let suppliedSchema: unknown;
    const ctx = createTestAppWorkflowContext({
      input: { sessionId: "s_source" },
      reconciliation: reconciliation({ sessionId: "s_source" }),
      callAgent: async (_agent, prompt, options) => {
        expect(prompt).toContain("Evaluate exactly session s_source");
        suppliedSchema = options?.schema;
        return agentResult(outcome);
      },
      emit: async (event) => {
        events.push(event);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        state: "converged",
        evidence: ["execution:s_evaluator", "evaluated-session:s_source"],
      },
    });
    expect(suppliedSchema).toBe(aftermathOutcomeSchema);
    expect(Check(aftermathOutcomeSchema, outcome)).toBe(true);
    expect(Check(aftermathOutcomeSchema, JSON.stringify(outcome))).toBe(false);
    expect(
      Check(aftermathOutcomeSchema, {
        ...outcome,
        evaluation: { ...evaluation, sessionId: "s_other" },
      }),
    ).toBe(true);
    expect(events[0]?.type).toBe("evaluation.recorded");
    expect(events.every((event) => Boolean(event.localKey))).toBe(true);
  });

  test("rejects a summary that impersonates the missing structured result", async () => {
    const events: AppEvent[] = [];
    const outcome = {
      kind: "evaluation",
      evaluation,
      findings: [finding],
    };
    const result = await execute(
      context(
        { sessionId: "s_source" },
        undefined,
        events,
        JSON.stringify(outcome),
      ),
    );
    expect(result).toMatchObject({
      status: "blocked",
      summary:
        "Evaluator execution s_evaluator returned no valid aftermath result.",
    });
    expect(events.map((event) => event.type)).toEqual([
      "evaluation.review_failed",
    ]);
  });

  test("records a structured skip as the same durable evaluation fact", async () => {
    const events: AppEvent[] = [];
    const skip = {
      kind: "skip" as const,
      sessionId: "s_skip",
      agent: "coder",
      reason: "duplicate runtime carrier",
    };
    const result = await execute(
      context({ sessionId: "s_skip" }, skip, events),
    );
    expect(result.status).toBe("done");
    expect(events).toEqual([
      {
        ...skippedEvaluationFact(skip, "s_evaluator", expect.any(Number)),
        localKey: "evaluation-recorded",
      },
    ]);
    expect(recordedEvaluation(events[0])).toMatchObject({
      sessionId: "s_skip",
      verdict: "skipped",
      overall: { structuredSkip: true, aftermathVersion: AFTERMATH_VERSION },
    });
  });

  test("converges an already-recorded exact session without side effects", async () => {
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

  test("rejects reconciliation without an exact session", async () => {
    const events: AppEvent[] = [];
    const result = await execute(context({}, undefined, events));
    expect(result.status).toBe("blocked");
    expect(result.summary).toContain("requires an exact sessionId");
    expect(events).toEqual([]);
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
    expect(events[0]).toMatchObject({
      localKey: "review-failed",
      data: {
        requestedSessionId: "s_source",
        executionId: "s_failed",
        status: "error",
        summary: "provider unavailable",
        failure: "execution-not-done",
        reason:
          "Evaluator execution s_failed ended error: provider unavailable",
      },
    });
    expect(
      events.some((event) => event.type === "project.owner.requested"),
    ).toBeFalse();
    expect(
      events.some(
        (event) => event.type === "evaluation.human_decision.requested",
      ),
    ).toBeFalse();
  });

  test("blocks malformed output with a traceable recovery signal", async () => {
    const events: AppEvent[] = [];
    const malformed = await execute(
      context({ sessionId: "s_source" }, { kind: "evaluation" }, events),
    );
    expect(malformed).toMatchObject({
      status: "blocked",
      summary:
        "Evaluator execution s_evaluator returned no valid aftermath result.",
    });
    expect(events).toEqual([
      expect.objectContaining({
        type: "evaluation.review_failed",
        localKey: "review-failed",
        data: expect.objectContaining({
          source: "evaluator-aftermath",
          requestedSessionId: "s_source",
          executionId: "s_evaluator",
          status: "done",
          summary: "bounded evaluation complete",
          failure: "invalid-output",
          reason:
            "Evaluator execution s_evaluator returned no valid aftermath result.",
        }),
        target: { appId: "evaluation", project: "evaluation" },
      }),
    ]);
  });

  test("gives repeated findings distinct stable semantic keys", async () => {
    const events: AppEvent[] = [];
    const secondFinding = {
      ...finding,
      summary: "A second bounded observation in the same concern family",
      requestedHumanAction: "watch" as const,
    };
    await execute(
      context(
        { sessionId: "s_source" },
        {
          kind: "evaluation",
          evaluation,
          findings: [finding, secondFinding],
        },
        events,
      ),
    );

    const ownerKeys = events
      .filter((event) => event.type === "project.owner.requested")
      .map((event) => event.localKey);
    expect(ownerKeys).toHaveLength(2);
    expect(new Set(ownerKeys).size).toBe(2);
    expect(
      ownerKeys.every((key) => /^owner-finding-[a-f0-9]{16}$/.test(key!)),
    ).toBe(true);
  });

  test("does not guess cross-session equivalence and suppresses only exact repeated material", async () => {
    const appRoot = mkdtempSync(join(tmpdir(), "aftermath-finding-delivery-"));
    const firstFinding: AftermathFinding = {
      targetAppId: "gym",
      severity: "concern",
      summary:
        "Stable-localKey repair dispatch omitted the artifact directory required by gym-implementer.",
      message:
        "The reconciliation task dispatched gym-implementer with `input: {}` even though its active contract requires exactly one writable agent-overlay or benchmark-snapshot directory. Redispatch with that explicit directory, and ensure any waiting Condition uses a canonical typed subject such as `artifact:<stable-id>` with path requirements in `expected`.",
      evidence: [
        "session:s_1787349848905_805 meta.json input={}",
        "verification:/app/projects/gym.app/agents/gym-implementer/AGENTS.md writable-artifact contract",
      ],
      dedupeKey: "gym-implementer-missing-artifact-directory-dispatch",
      requestedHumanAction: "none",
    };
    const equivalentFinding: AftermathFinding = {
      ...firstFinding,
      summary:
        "Gym reconciliation routed implementation to Gym Implementer without its required writable candidate directory.",
      message:
        "Review task construction/routing for repair/stable-localkey-regression-emission. In session s_1787349957833_811, the active Gym Implementer contract required exactly one writable agent-overlay or benchmark-snapshot directory, but meta.json supplied input={} and declared absent /app/projects/gym production-style outputs. The agent could only return a partial decomposition rather than implement and verify the repair. Ensure the follow-up child is dispatched with the exact isolated artifact directory and then complete owner-run regression verification.",
      evidence: [
        "artifact:/app/.state/sessions/s_1787349957833_811/result.json",
        "verification:focused Gym overlay checks pending owner regression",
      ],
      dedupeKey: "gym-implementer-missing-writable-artifact-directory",
    };
    const changedFinding: AftermathFinding = {
      ...firstFinding,
      severity: "urgent",
      summary:
        "Gym approval routing now drops the required verification artifact.",
      message:
        "Restore owner routing with the attached artifact and run the Condition matcher regression before approval.",
      evidence: [
        "artifact:reports/gym-approval-routing.md",
        "verification:bun test condition-matcher.test.ts",
      ],
      requestedHumanAction: "approve",
    };
    const run = async (
      sessionId: string,
      deliveredFinding: AftermathFinding,
      events: AppEvent[],
    ) =>
      execute(
        context(
          { sessionId },
          {
            kind: "evaluation",
            evaluation: { ...evaluation, sessionId },
            findings: [deliveredFinding],
          },
          events,
          undefined,
          appRoot,
        ),
      );

    const firstEvents: AppEvent[] = [];
    const equivalentEvents: AppEvent[] = [];
    const changedEvents: AppEvent[] = [];
    const repeatedChangedEvents: AppEvent[] = [];
    await run("s_1787349848905_805", firstFinding, firstEvents);
    const equivalentResult = await run(
      "s_1787349957833_811",
      equivalentFinding,
      equivalentEvents,
    );
    await run("s_changed", changedFinding, changedEvents);
    const repeatResult = await run(
      "s_changed_repeat",
      changedFinding,
      repeatedChangedEvents,
    );

    expect(firstEvents.map((event) => event.type)).toEqual([
      "evaluation.recorded",
      "project.owner.requested",
    ]);
    expect(equivalentEvents.map((event) => event.type)).toEqual([
      "evaluation.recorded",
      "project.owner.requested",
    ]);
    expect(equivalentResult.output).toMatchObject({
      evidence: [
        "execution:s_evaluator",
        "evaluated-session:s_1787349957833_811",
        expect.stringContaining("finding-delivery-receipt:"),
      ],
    });
    expect(changedEvents.map((event) => event.type)).toEqual([
      "evaluation.recorded",
      "project.owner.requested",
      "evaluation.human_decision.requested",
    ]);
    expect(changedEvents[1]).toMatchObject({
      target: { appId: "gym" },
      data: {
        finding: {
          evidence: [
            "artifact:reports/gym-approval-routing.md",
            "verification:bun test condition-matcher.test.ts",
          ],
        },
      },
    });
    expect(repeatedChangedEvents.map((event) => event.type)).toEqual([
      "evaluation.recorded",
    ]);
    expect(repeatResult.output).toMatchObject({
      evidence: [
        "execution:s_evaluator",
        "evaluated-session:s_changed_repeat",
        "finding-delivery-suppressed:gym:gym-implementer-missing-artifact-directory-dispatch",
        expect.stringContaining("finding-delivery-receipt:"),
      ],
    });

    const receiptDir = join(appRoot, ".state", "finding-delivery", "receipts");
    expect(readdirSync(receiptDir)).toHaveLength(2);
    const receipt = readdirSync(receiptDir)
      .map((name) =>
        JSON.parse(readFileSync(join(receiptDir, name), "utf8")),
      )
      .find(
        (candidate) =>
          candidate.stableIdentity?.dedupeKey ===
          "gym-implementer-missing-artifact-directory-dispatch",
      );
    expect(receipt).toMatchObject({
      disposition: "delivered",
      stableIdentity: {
        targetAppId: "gym",
        dedupeKey: "gym-implementer-missing-artifact-directory-dispatch",
      },
      variants: [
        {
          sourceSessionId: "s_1787349848905_805",
          requestedHumanAction: "none",
          artifactAndVerificationContext: firstFinding.facts,
        },
        {
          sourceSessionId: "s_changed",
          requestedHumanAction: "approve",
          artifactAndVerificationContext: changedFinding.facts,
          humanDeliveredAt: expect.any(String),
        },
      ],
    });
    expect(receipt.resolvedAt).toBeUndefined();
  });

  test("reuses the exact task-owned identities when one aftermath attempt is delivered again", async () => {
    const outcome = {
      kind: "evaluation" as const,
      evaluation,
      findings: [finding],
    };
    const firstEvents: AppEvent[] = [];
    const retryEvents: AppEvent[] = [];

    await execute(context({ sessionId: "s_source" }, outcome, firstEvents));
    await execute(context({ sessionId: "s_source" }, outcome, retryEvents));

    const identities = (events: AppEvent[]) =>
      events.map((event) => `${event.type}:${event.localKey}`);
    expect(identities(retryEvents)).toEqual(identities(firstEvents));
    expect(new Set(identities(firstEvents)).size).toBe(firstEvents.length);
  });

  test("blocks inputs outside canonical reconciliation", async () => {
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
