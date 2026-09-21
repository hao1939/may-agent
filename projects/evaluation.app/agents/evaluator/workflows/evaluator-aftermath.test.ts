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
  const authoritativeInput = { subjectAppId: "sample", ...input };
  return createTestAppWorkflowContext({
    input: authoritativeInput,
    reconciliation: reconciliation(authoritativeInput),
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
    expect(
      parseAftermathOutcome({
        kind: "evaluation",
        evaluation: { ...evaluation, agent: "evaluator-deepseek" },
        findings: [],
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
    expect(
      parseAftermathOutcome({
        kind: "skip",
        sessionId: "s_deepseek",
        agent: "evaluator-deepseek",
        reason: "self execution",
      }),
    ).toBeNull();
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

  test("retires every session-only semantic review regardless of caller ownership hint", async () => {
    for (const input of [
      { sessionId: "s_unknown" },
      { sessionId: "s_misattributed", subjectAppId: "scout-knowledge-lib" },
    ]) {
      let calls = 0;
      const ctx = createTestAppWorkflowContext({
        input,
        reconciliation: reconciliation(input),
        callAgent: async () => {
          calls += 1;
          throw new Error("must not call");
        },
      });
      const result = await execute(ctx);
      expect(result.status).toBe("done");
      expect(result.summary).toContain("session-only review is retired");
      expect(calls).toBe(0);
    }
  });
});
