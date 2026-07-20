import { describe, expect, it } from "bun:test";

import {
  buildReviewTask,
  classifyEvaluationLane,
  classifyVerdict,
  getSessionIdFromTrigger,
  ownerEventTarget,
  reviewFailureDetails,
  reviewProcessFailureOutcome,
  shouldSkipAftermathAmplification,
  transcriptOutputSignals,
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

  it("treats shell redirection writes as material output requiring review", () => {
    const transcript = [
      JSON.stringify({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "bash",
            id: "append_digest",
            arguments: {
              command:
                "cat >> /app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md << 'EOF'\nsummary\nEOF",
            },
          },
        ],
      }),
    ].join("\n");

    const heuristic = classifyVerdict(
      { status: "done", opCount: 12 },
      transcript,
    );

    expect(transcriptOutputSignals({}, transcript)).toContain(
      "shell file write",
    );
    expect(classifyEvaluationLane({}, transcript, heuristic)).toMatchObject({
      lane: "success_candidate",
      reason: "good session with material output: shell file write",
    });
  });

  it("instructs reviewers to coalesce the Scout nested-output feedback regression family", () => {
    const task = buildReviewTask({
      sessionId: "s_scout_nested_output",
      session: {
        sessionId: "s_scout_nested_output",
        agent: "scout",
        projectId: "scout-knowledge-lib",
        status: "done",
      },
      transcriptPath: ".state/sessions/s_scout_nested_output/session.jsonl",
      artifactPath:
        "projects/evaluation.app/agents/evaluator/workspace/aftermath/s_scout_nested_output.md",
      workflowCollectedFacts: "## Live Runtime Signals (workflow-collected)\nStatus: available",
      route: {
        lane: "needs_triage",
        reason: "nested output path",
        signals: ["project artifact"],
      },
      evalTrailPath: ".state/sessions/s_scout_nested_output/session.eval.jsonl",
    });

    expect(task).toContain("events 3582689, 3583286, 3583498, and 3583812");
    expect(task).toContain(
      "agent:scout|scout-knowledge-lib.app|root:nested-/app/projects/scout-knowledge-lib/projects-output-path|ask:reconcile-canonical-artifacts-and-use-absolute-/app/projects-output-verification",
    );
    expect(task).toContain("preserve this session's artifact/session link");
    expect(task).toContain("unrelated Scout findings with a different root cause or ask still use normal high-severity owner notification");
    expect(task).toContain(
      "Only send a new owner message for this family when the root cause/remediation ask materially changes, severity increases, or Scout explicitly asks for per-session follow-up",
    );
  });
});
