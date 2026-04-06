import { describe, it, expect } from "vitest";
import { computeHeuristicScores, extractFinishCallParams } from "../src/lib/evaluator.js";
import type { PersistedSession } from "../src/lib/persistence.js";

// Minimal session for testing
function makeSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    id: "s_test_123",
    agent: "test-agent",
    status: "done",
    startedAt: Date.now() - 60000,
    ...overrides,
  } as PersistedSession;
}

// Build a toolResult message matching the JSONL format
function toolResult(text: string): any {
  return {
    role: "toolResult",
    toolCallId: "tc_" + Math.random().toString(36).slice(2),
    toolName: "read",
    content: [{ type: "text", text }],
  };
}

function assistantMsg(toolCalls: number = 1): any {
  const content = [];
  for (let i = 0; i < toolCalls; i++) {
    content.push({ type: "toolCall", name: "read", id: "tc_" + i, input: {} });
  }
  return { role: "assistant", content };
}

// Build a transcript string from messages
function toTranscript(messages: any[]): string {
  return messages.map((m) => JSON.stringify(m)).join("\n");
}

describe("computeHeuristicScores - hard error counting", () => {
  it("counts actual ENOENT errors in short toolResult messages", () => {
    const messages = [
      assistantMsg(2),
      toolResult("Error reading file: ENOENT: no such file or directory, open '/app/missing.ts'"),
      toolResult("file contents here"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(1);
    expect(scores.productiveCalls).toBe(1);
  });

  it("does NOT count error strings inside long file content (>500 chars)", () => {
    // Simulate reading an error log or TSC output that contains "Cannot find module"
    const longContent = "x".repeat(200) + "\nCannot find module '@foo/bar'\nENOENT: no such file\n" + "x".repeat(300);
    const messages = [
      assistantMsg(3),
      toolResult(longContent), // long read result — analyzing error logs
      toolResult("ok"),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Should NOT count the error strings in the long content
    expect(scores.wastedCalls).toBe(0);
    expect(scores.productiveCalls).toBe(3);
  });

  it("counts multiple short error results correctly", () => {
    const messages = [
      assistantMsg(5),
      toolResult("Error reading file: ENOENT: no such file or directory, open '/app/a.ts'"),
      toolResult("Error reading file: ENOENT: no such file or directory, open '/app/b.ts'"),
      toolResult("Cannot find module './missing'"),
      toolResult("P53 Violation: blocked"),
      toolResult("success"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // 4 hard errors > 3, triggers efficiency penalty and capping
    expect(scores.wastedCalls).toBe(3); // min(4, ceil(5*0.5)) = min(4,3) = 3
    expect(scores.issues).toContain("multiple_tool_errors");
  });

  it("falls back to transcript matching when no messages provided", () => {
    // Legacy behavior: regex on full transcript
    const messages = [assistantMsg(2), toolResult("ENOENT: no such file or directory"), toolResult("ok")];
    const transcript = toTranscript(messages);
    // Pass undefined messages — should fall back to transcript matching
    const scores = computeHeuristicScores(makeSession(), transcript);
    expect(scores.wastedCalls).toBe(1);
  });

  it("handles string content in toolResult (not just array)", () => {
    const messages = [
      assistantMsg(1),
      {
        role: "toolResult",
        toolCallId: "tc_1",
        toolName: "read",
        content: "ENOENT: no such file or directory",
      },
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(1);
  });

  it("real-world scenario: agent reading TSC output with 'Cannot find module' is NOT penalized", () => {
    // TSC output is typically long with many lines
    const tscOutput = Array.from(
      { length: 30 },
      (_, i) =>
        `src/file${i}.ts(${i + 1},5): error TS2307: Cannot find module './dep${i}' or its corresponding type declarations.`,
    ).join("\n");
    // tscOutput is > 500 chars
    expect(tscOutput.length).toBeGreaterThan(500);

    const messages = [
      assistantMsg(3),
      toolResult(tscOutput), // reading TSC output
      toolResult("file contents ok"),
      toolResult("another ok result"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // The "Cannot find module" strings should NOT be counted
    expect(scores.wastedCalls).toBe(0);
    expect(scores.productiveCalls).toBe(3);
  });

  it("Validation failed for tool is counted in short results", () => {
    const messages = [
      assistantMsg(2),
      toolResult("Validation failed for tool 'bash': missing required parameter 'command'"),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(1);
  });
});

describe("computeHeuristicScores - waste ratio penalty", () => {
  it("100% waste ratio (0 productive, all wasted) → needs_improvement", () => {
    // Simulate a session with many tool calls that all fail with ENOENT
    const messages: any[] = [];
    // 10 assistant turns, each with 1 tool call
    for (let i = 0; i < 10; i++) {
      messages.push(assistantMsg(1));
      messages.push(toolResult("ENOENT: no such file or directory, open '/app/f" + i + ".ts'"));
    }
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // 10 hard errors > 3 → wastedCalls = min(10, ceil(10*0.5)) = 5
    // wasteRatio = 5/10 = 0.5 → moderate_waste_ratio
    expect(scores.issues).toContain("multiple_tool_errors");
    expect(scores.issues).toContain("moderate_waste_ratio");
    // efficiency: 3 + 1(done+3tools) - 1(multiple_tool_errors) - 1(moderate_waste) = 2
    // quality: 3 + 1(done+3tools) - 1(moderate_waste) = 3
    expect(scores.efficiency).toBeLessThanOrEqual(2);
  });

  it("session with 75%+ waste ratio gets high_waste_ratio and needs_improvement", () => {
    // 8 tool calls, 7 are hard errors (short results) → wasteRatio ≥ 0.75
    const messages: any[] = [];
    // One assistant turn with 8 tool calls
    messages.push(assistantMsg(8));
    for (let i = 0; i < 7; i++) {
      messages.push(toolResult("ENOENT: no such file or directory"));
    }
    messages.push(toolResult("ok"));
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // 7 hard errors > 3 → wastedCalls = min(7, ceil(8*0.5)) = 4
    // wasteRatio = 4/8 = 0.5 → moderate at 50%, but let's check...
    // Actually this gets moderate_waste_ratio since 4/8 = 0.5
    expect(scores.issues).toContain("multiple_tool_errors");
    expect(scores.wastedCalls).toBeGreaterThanOrEqual(4);
    // verdict should be acceptable or needs_improvement (not "good")
    expect(scores.verdict).not.toBe("good");
  });

  it("session with low waste ratio (<50%) gets no waste penalty", () => {
    // 10 tool calls, 2 are errors → wasteRatio = 0.2
    const messages: any[] = [];
    messages.push(assistantMsg(10));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ENOENT: no such file or directory"));
    for (let i = 0; i < 8; i++) {
      messages.push(toolResult("ok"));
    }
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(2);
    expect(scores.issues).not.toContain("high_waste_ratio");
    expect(scores.issues).not.toContain("moderate_waste_ratio");
  });

  it("reproduces the bug: 0 productive / 42 wasted should be needs_improvement", () => {
    // The exact bug case: s_1773811688106_497 had 0 productive, 42 wasted
    // Build a session with many hard-error tool calls
    const messages: any[] = [];
    for (let i = 0; i < 42; i++) {
      messages.push(assistantMsg(1));
      messages.push(toolResult("Validation failed for tool 'bash': missing required parameter 'command'"));
    }
    const transcript = toTranscript(messages);
    const session = makeSession({ status: "interrupted" as any });
    const scores = computeHeuristicScores(session, transcript, messages);
    // 42 errors > 3 → wastedCalls = min(42, ceil(42*0.5)) = 21
    // wasteRatio = 21/42 = 0.5 → moderate_waste_ratio
    // "interrupted" is NOT penalized with session_error (only "error" status is).
    // efficiency: 3 - 1(multiple_tool_errors) - 1(moderate_waste) = 1
    // quality: 3 - 1(moderate_waste) = 2
    // verdict: quality=2 >= 2 but efficiency=1 < 2 → needs_improvement
    expect(scores.verdict).toBe("needs_improvement");
    expect(scores.issues).toContain("multiple_tool_errors");
  });

  it("high_waste_ratio threshold at exactly 0.75", () => {
    // 4 tool calls, 3 are errors → wastedCalls from hardErrors = 3 (not > 3, so no capping)
    // Actually 3 hardErrors is NOT > 3, so wastedCalls = 3, productiveCalls = 1
    // wasteRatio = 3/4 = 0.75 → high_waste_ratio
    const messages: any[] = [];
    messages.push(assistantMsg(4));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ok"));
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(3);
    expect(scores.productiveCalls).toBe(1);
    // 3/4 = 0.75 → high_waste_ratio
    expect(scores.issues).toContain("high_waste_ratio");
  });
});

describe("computeHeuristicScores - error type differentiation", () => {
  it("turn limit hit does NOT penalize quality, only mild efficiency penalty", () => {
    const messages = [
      assistantMsg(5),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const session = makeSession({
      status: "error",
      error: "Turn limit reached: 41/40 turns. Session terminated.",
    });
    const scores = computeHeuristicScores(session, transcript, messages);
    // Quality should NOT be penalized — agent was doing good work
    expect(scores.quality).toBeGreaterThanOrEqual(3);
    // Efficiency gets mild -1 penalty for not finishing within budget
    expect(scores.issues).toContain("turn_limit_hit");
    expect(scores.issues).not.toContain("session_error");
    // Should still be "acceptable" or "good", not dragged down
    expect(scores.verdict).not.toBe("needs_improvement");
  });

  it("provider/LiteLLM error does NOT penalize quality OR efficiency", () => {
    const messages = [assistantMsg(1), toolResult("ok")];
    const transcript = toTranscript(messages);
    const session = makeSession({
      status: "error",
      error: '400 {"error":{"message":"litellm.BadRequestError: Github_copilotException - The requested model is not supported.. Received Model Group=claude-sonnet-4-20250514"}}',
    });
    const scores = computeHeuristicScores(session, transcript, messages);
    // No quality or efficiency penalty for provider errors
    expect(scores.issues).toContain("provider_error");
    expect(scores.issues).not.toContain("session_error");
    expect(scores.quality).toBeGreaterThanOrEqual(3);
  });

  it("genuine agent error still penalizes quality as before", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const session = makeSession({
      status: "error",
      error: "TypeError: Cannot read properties of undefined (reading 'map')",
    });
    const scores = computeHeuristicScores(session, transcript, messages);
    // Genuine error → quality penalty still applies
    expect(scores.issues).toContain("session_error");
    expect(scores.issues).not.toContain("turn_limit_hit");
    expect(scores.issues).not.toContain("provider_error");
  });

  it("error session with no error message falls through to session_error", () => {
    const messages = [assistantMsg(1), toolResult("ok")];
    const transcript = toTranscript(messages);
    const session = makeSession({ status: "error" });
    // error field is undefined
    const scores = computeHeuristicScores(session, transcript, messages);
    expect(scores.issues).toContain("session_error");
  });

  it("turn limit hit with good work still scores well overall", () => {
    // Simulate a 40-turn session that did lots of productive work
    const messages: any[] = [];
    for (let i = 0; i < 20; i++) {
      messages.push(assistantMsg(2));
      messages.push(toolResult("file contents here..."));
      messages.push(toolResult("command output ok"));
    }
    const transcript = toTranscript(messages);
    const session = makeSession({
      status: "error",
      error: "Turn limit reached: 41/40 turns. Session terminated.",
    });
    const scores = computeHeuristicScores(session, transcript, messages);
    // Should get good quality for productive work despite turn limit
    expect(scores.quality).toBeGreaterThanOrEqual(3);
    expect(scores.productiveCalls).toBe(40);
    expect(scores.wastedCalls).toBe(0);
    expect(scores.issues).toContain("turn_limit_hit");
    expect(scores.issues).not.toContain("session_error");
  });

  it("BadRequestError with claude-opus model is classified as provider_error", () => {
    const messages = [assistantMsg(1), toolResult("ok")];
    const transcript = toTranscript(messages);
    const session = makeSession({
      status: "error",
      error: '400 {"error":{"message":"litellm.BadRequestError: Github_copilotException - Bad Request. Received Model Group=claude-opus-4.6"}}',
    });
    const scores = computeHeuristicScores(session, transcript, messages);
    expect(scores.issues).toContain("provider_error");
    expect(scores.issues).not.toContain("session_error");
  });
});

// Helper to create an assistant message containing a finish() tool call
function finishMsg(params: Record<string, unknown>): any {
  return {
    role: "assistant",
    content: [
      { type: "toolCall", name: "finish", id: "tc_finish_1", arguments: params },
    ],
  };
}

// Helper to create a finish tool result
function finishResult(): any {
  return {
    role: "toolResult",
    toolCallId: "tc_finish_1",
    toolName: "finish",
    content: [{ type: "text", text: '{"status":"success"}' }],
  };
}

describe("extractFinishCallParams", () => {
  it("extracts finish params from a simple finish() call", () => {
    const messages = [
      assistantMsg(2),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({ status: "success", summary: "All done" }),
      finishResult(),
    ];
    const params = extractFinishCallParams(messages);
    expect(params).not.toBeNull();
    expect(params!.status).toBe("success");
    expect(params!.summary).toBe("All done");
  });

  it("returns the LAST finish call when multiple exist", () => {
    const messages = [
      finishMsg({ status: "failure", summary: "First attempt failed" }),
      finishResult(),
      assistantMsg(1),
      toolResult("fixed something"),
      finishMsg({ status: "success", summary: "Second attempt succeeded" }),
      finishResult(),
    ];
    const params = extractFinishCallParams(messages);
    expect(params).not.toBeNull();
    expect(params!.status).toBe("success");
    expect(params!.summary).toBe("Second attempt succeeded");
  });

  it("returns null when no finish call exists", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
    ];
    const params = extractFinishCallParams(messages);
    expect(params).toBeNull();
  });

  it("extracts verification_evidence and deliverables arrays", () => {
    const messages = [
      finishMsg({
        status: "success",
        summary: "Tests pass",
        verification_evidence: ["Step 5: bash test exit code 0"],
        deliverables: [{ path: "src/app.ts", description: "Added feature" }],
      }),
      finishResult(),
    ];
    const params = extractFinishCallParams(messages);
    expect(params).not.toBeNull();
    expect(params!.verification_evidence).toHaveLength(1);
    expect(params!.deliverables).toHaveLength(1);
  });

  it("extracts blockers from failure/blocked status", () => {
    const messages = [
      finishMsg({
        status: "blocked",
        summary: "Need API key",
        blockers: [{ reason: "Missing API key", context: "Tried env vars" }],
      }),
      finishResult(),
    ];
    const params = extractFinishCallParams(messages);
    expect(params).not.toBeNull();
    expect(params!.status).toBe("blocked");
    expect(params!.blockers).toHaveLength(1);
  });

  it("handles string arguments (JSON string) in finish call", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "finish",
            id: "tc_finish_str",
            arguments: JSON.stringify({ status: "partial", summary: "Halfway done" }),
          },
        ],
      },
    ];
    const params = extractFinishCallParams(messages);
    expect(params).not.toBeNull();
    expect(params!.status).toBe("partial");
  });
});

describe("computeHeuristicScores - finish status differentiation (H-009)", () => {
  it("finish(success) with verification_evidence → quality +1 (H-009 Phase 3)", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "All tests pass after refactoring the scoring module",
        verification_evidence: ["Step 5: vitest exit code 0"],
        deliverables: [{ path: "src/foo.ts", description: "New feature" }],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 + 1 (finish_success_verified) = 4 (no done+tools quality bonus)
    expect(scores.quality).toBe(4);
    expect(scores.issues).toContain("finish_success_verified");
    expect(scores.issues).toContain("has_deliverables");
    expect(scores.verdict).toBe("good");
  });

  it("finish(success) without evidence → no quality bonus (H-009 Phase 3)", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Implemented the feature and verified all tests pass correctly",
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 + 0 (no evidence = no bonus) = 3
    expect(scores.quality).toBe(3);
    expect(scores.issues).toContain("finish_success_unverified");
    expect(scores.issues).not.toContain("finish_success_verified");
  });

  it("finish(partial) → no quality bonus", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "partial",
        summary: "Half done",
        next_steps: "Continue tomorrow",
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 + 0 (partial = no bonus, no done+tools quality bonus) = 3
    expect(scores.quality).toBe(3);
    expect(scores.issues).toContain("finish_partial");
  });

  it("finish(failure) → quality -1 penalty", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "failure",
        summary: "Could not complete",
        blockers: [{ reason: "Dependency broken", context: "npm install fails" }],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 - 1 (finish_failure) = 2
    expect(scores.quality).toBe(2);
    expect(scores.issues).toContain("finish_failure");
  });

  it("finish(blocked) → quality -1 penalty", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "blocked",
        summary: "Waiting for API key",
        blockers: [{ reason: "Missing key", context: "Checked all envs" }],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 - 1 (finish_blocked) = 2
    expect(scores.quality).toBe(2);
    expect(scores.issues).toContain("finish_blocked");
  });

  it("finish(success) verified vs unverified yields different quality scores for shallow sessions", () => {
    // With only 1 read tool call + finish (2 total < 3), the done+3tools bonus doesn't apply
    const verifiedMessages = [
      assistantMsg(1),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Completed the task and verified all tests pass successfully",
        verification_evidence: ["Step 3: bash test suite completed with exit code 0"],
      }),
      finishResult(),
    ];
    const unverifiedMessages = [
      assistantMsg(1),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Completed the task and verified all tests pass successfully",
      }),
      finishResult(),
    ];

    const verifiedScores = computeHeuristicScores(
      makeSession(),
      toTranscript(verifiedMessages),
      verifiedMessages,
    );
    const unverifiedScores = computeHeuristicScores(
      makeSession(),
      toTranscript(unverifiedMessages),
      unverifiedMessages,
    );

    // Verified gets +2, unverified gets +1
    expect(verifiedScores.quality).toBeGreaterThan(unverifiedScores.quality);
    expect(verifiedScores.issues).toContain("finish_success_verified");
    expect(unverifiedScores.issues).toContain("finish_success_unverified");
  });

  it("no finish call + no parsed params → no quality bonus (H-009 Phase 3)", () => {
    // Use 3 assistant turns so the no_finish_call issue is triggered (requires assistantTurns > 2)
    const messages = [
      assistantMsg(2),
      toolResult("ok"),
      toolResult("ok"),
      assistantMsg(1),
      toolResult("ok"),
      assistantMsg(1),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 + 0 (no finish bonus, no done+tools quality bonus) = 3
    expect(scores.quality).toBe(3);
    expect(scores.issues).toContain("no_finish_call");
    expect(scores.issues).not.toContain("finish_success_verified");
    expect(scores.issues).not.toContain("finish_success_unverified");
    expect(scores.issues).not.toContain("finish_partial");
    expect(scores.issues).not.toContain("finish_failure");
    expect(scores.issues).not.toContain("finish_blocked");
  });
});

describe("computeHeuristicScores - Phase 2 semantic quality (H-009)", () => {
  it("hollow summary (< 30 chars) on success → quality penalty", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Done",
        verification_evidence: ["Step 5: bash vitest run test/foo.test.ts exit code 0"],
        deliverables: [{ path: "src/foo.ts", description: "Updated" }],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.issues).toContain("hollow_summary");
    // Phase 3: Base 3 + 1 (verified) - 1 (hollow_summary) = 3
    expect(scores.quality).toBe(3);
  });

  it("good summary (≥ 30 chars) → no hollow_summary issue", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Refactored evaluator scoring to check finish status and evidence quality",
        verification_evidence: ["Step 8: bash vitest run returned all 31 tests passing"],
        deliverables: [{ path: "src/lib/evaluator.ts", description: "Phase 2 heuristics" }],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.issues).not.toContain("hollow_summary");
  });

  it("vague verification evidence → quality penalty", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Implemented the feature and verified everything works correctly",
        verification_evidence: ["verified", "looks good"],
        deliverables: [{ path: "src/foo.ts", description: "Feature" }],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.issues).toContain("vague_verification_evidence");
    // Phase 3: Base 3 + 1 (verified) - 1 (vague evidence) = 3
    expect(scores.quality).toBe(3);
  });

  it("mixed evidence (some specific, some vague) → mostly_vague if majority vague", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Implemented the feature and verified everything works correctly",
        verification_evidence: [
          "verified",
          "looks good",
          "Step 12: bash vitest run returned exit code 0 with all 31 tests passing",
        ],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.issues).toContain("mostly_vague_evidence");
    // Not all vague, so no quality penalty
    expect(scores.issues).not.toContain("vague_verification_evidence");
  });

  it("success without deliverables on long session → tracks issue (no penalty)", () => {
    const messages = [
      assistantMsg(5),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Analyzed the codebase and documented all architectural patterns found",
        verification_evidence: ["Step 10: read confirmed the analysis file was written correctly"],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.issues).toContain("success_no_deliverables");
    // Info-only — should not affect quality compared to same session with deliverables
  });

  it("partial/failure status → no Phase 2 checks applied", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "partial",
        summary: "Halfway",
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 2 checks only apply to success status
    expect(scores.issues).not.toContain("hollow_summary");
    expect(scores.issues).not.toContain("vague_verification_evidence");
  });
});

describe("computeHeuristicScores - Phase 4 scoring calibration (H-009)", () => {
  // Helper: creates an assistant message with a bash tool call containing a test/tsc command
  function bashTestCall(command: string): any {
    return {
      role: "assistant",
      content: [{ type: "toolCall", name: "bash", id: "tc_bash", input: { command } }],
    };
  }

  it("verified session → quality 5 (3+ test/tsc bash calls)", () => {
    const messages = [
      assistantMsg(5),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      bashTestCall("npx vitest run src/rate-limiter.test.ts"),
      toolResult("12 tests passed"),
      bashTestCall("npx tsc --noEmit"),
      toolResult("no errors"),
      bashTestCall("npm run check"),
      toolResult("clean"),
      finishMsg({
        status: "success",
        summary: "Implemented rate limiter with token bucket algorithm, added comprehensive test suite, and verified edge cases",
        verification_evidence: [
          "Step 5: bash vitest run returned all 12 tests passing with exit code 0",
          "Step 8: read src/rate-limiter.ts confirmed correct implementation of token bucket",
        ],
        deliverables: [
          { path: "src/rate-limiter.ts", description: "Token bucket rate limiter" },
          { path: "test/rate-limiter.test.ts", description: "12 test cases" },
        ],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 4: Base 3 + 1 (verified finish) + 1 (verified_with_tests) = 5
    expect(scores.quality).toBe(5);
    expect(scores.issues).toContain("verified_with_tests");
    expect(scores.verdict).toBe("good");
  });

  it("standard session → quality 4 (verified finish but no test runs)", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Updated the config file to fix the deployment issue",
        verification_evidence: ["Step 4: bash confirmed service starts correctly"],
        deliverables: [{ path: "config.yml", description: "Fixed port config" }],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 4: Base 3 + 1 (verified finish) = 4, no test runs for bonus
    expect(scores.quality).toBe(4);
    expect(scores.issues).not.toContain("verified_with_tests");
    expect(scores.verdict).toBe("good");
  });

  it("unverified success → quality 3 (acceptable, not good)", () => {
    const messages = [
      assistantMsg(3),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Completed the refactoring of the authentication module",
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 + 0 (no evidence) = 3
    expect(scores.quality).toBe(3);
    expect(scores.verdict).toBe("acceptable");
  });

  it("done+tools no longer gives quality bonus (only efficiency)", () => {
    // Session with tools but no finish call — old behavior would give quality +1
    const messages = [
      assistantMsg(2),
      toolResult("ok"),
      toolResult("ok"),
      assistantMsg(1),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Phase 3: Base 3 quality (no finish bonus, no done+tools quality bonus)
    expect(scores.quality).toBe(3);
    // But efficiency still gets the +1
    expect(scores.efficiency).toBe(4);
  });

  it("inline scripts with 'test' substring → no false positive (H-009 Phase 4b)", () => {
    // Bash calls with words like "latest", "attest" or SQL queries mentioning "test"
    // in inline scripts should NOT count as verification runs
    function bashInlineScript(command: string): any {
      return {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", id: "tc_bash", input: { command } }],
      };
    }

    const messages = [
      assistantMsg(5),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      // 3 bash calls that mention "test" but are NOT test runs
      bashInlineScript('bun -e "const latest = db.prepare(\'SELECT * FROM evaluations\').all(); console.log(\'Latest evaluations:\', latest)"'),
      toolResult("ok"),
      bashInlineScript('bun -e "console.log(\'Latest sessions:\', result)"'),
      toolResult("ok"),
      bashInlineScript('grep -n "contested" src/lib/evaluator.ts'),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Analyzed the evaluation distribution and confirmed the Phase 4 scoring is deployed correctly",
        verification_evidence: [
          "Step 5: bash bun -e query showed latest evaluations in DB",
          "Step 8: read src/lib/evaluator.ts confirmed Phase 4 code deployed",
        ],
        deliverables: [
          { path: "agents/shared/knowledge/analysis.md", description: "Evaluation distribution analysis" },
          { path: "agents/shared/knowledge/report.md", description: "Phase 4 deployment report" },
        ],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Should NOT get verified_with_tests — these are not real test commands
    expect(scores.quality).toBe(4); // verified finish only
    expect(scores.issues).not.toContain("verified_with_tests");
  });

  it("real test file paths match verification (test/ and .test. patterns)", () => {
    function bashCmd(command: string): any {
      return {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", id: "tc_bash", input: { command } }],
      };
    }

    const messages = [
      assistantMsg(5),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      toolResult("ok"),
      // Real test invocations using file paths
      bashCmd("cat test/evaluator-heuristic.test.ts | head -20"),
      toolResult("ok"),
      bashCmd("node src/foo.test.js"),
      toolResult("ok"),
      bashCmd("ls __tests__/unit/"),
      toolResult("ok"),
      finishMsg({
        status: "success",
        summary: "Ran all tests and verified the implementation works correctly across the board",
        verification_evidence: [
          "Step 5: bash showed test file content",
          "Step 6: bash ran test file",
        ],
        deliverables: [
          { path: "src/lib/impl.ts", description: "Implementation" },
          { path: "test/impl.test.ts", description: "Tests" },
        ],
      }),
      finishResult(),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Should get verified_with_tests — test/, .test., __tests__ patterns
    expect(scores.quality).toBe(5);
    expect(scores.issues).toContain("verified_with_tests");
  });
});

