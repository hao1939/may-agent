import { describe, expect, it } from "bun:test";
import { extractFinishParams } from "@may-agent/sdk/runtime";
import historicalTranscripts from "../../../../../test/fixtures/pre-migration-finish-transcripts.json";

function finishCall(id: string, args: Record<string, unknown>) {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name: "finish", arguments: args }],
  };
}

function finishResult(id: string, text: string, isError = false) {
  return {
    role: "toolResult",
    toolCallId: id,
    toolName: "finish",
    content: [{ type: "text", text }],
    isError,
  };
}

describe("finish result extraction", () => {
  it("extracts only canonical finish fields and ignores retired legacy properties", () => {
    const messages = [
      finishCall("finish-saved", {
        status: "done",
        summary: "Done",
        facts: { evidence: "App-owned field" },
        verification_facts: ["Legacy field ignored"],
        verification_evidence: ["Superseded check"],
        next_steps: "Legacy next steps ignored",
      }),
      finishResult("finish-saved", "✅ SUCCESS: Done"),
    ];
    const saved = JSON.stringify(messages);
    const restored = JSON.parse(saved);
    const result = extractFinishParams(restored);
    expect(result).toEqual({
      status: "done",
      summary: "Done",
      output: undefined,
      facts: { evidence: "App-owned field" },
    });
    expect(JSON.stringify(restored)).toBe(saved);
    expect(extractFinishParams([
      finishCall("finish-current", {
        status: "done",
        summary: "Current",
        verification_facts: ["Not part of the current contract"],
      }),
      finishResult("finish-current", "✅ SUCCESS: Current"),
    ])).toEqual({ status: "done", summary: "Current", output: undefined, facts: undefined });
    for (const facts of [false, null]) {
      expect(extractFinishParams([
        finishCall(`finish-facts-${String(facts)}`, {
          status: "blocked",
          summary: "Blocked",
          facts,
          verification_facts: ["Legacy fallback must not replace direct facts"],
        }),
        finishResult(`finish-facts-${String(facts)}`, "⚠️ BLOCKED: Blocked"),
      ])?.facts).toBe(facts);
    }
  });

  it("extracts a successfully executed schema-backed finish payload", () => {
    const messages = [
      finishCall("finish-1", { status: "done", summary: "Done", output: { verdict: "pass" } }),
      finishResult("finish-1", "✅ SUCCESS: Done"),
    ];

    expect(extractFinishParams(messages)).toMatchObject({
      status: "done",
      summary: "Done",
      output: { verdict: "pass" },
    });
  });

  it("normalizes unchanged pre-migration transcripts without mutating their historical vocabulary", () => {
    const saved = JSON.stringify(historicalTranscripts);

    expect(extractFinishParams(historicalTranscripts.successWithFalseOutput)).toEqual({
      status: "done",
      summary: "Historical success",
      output: false,
      facts: {
        deliverables: [{ path: "report.md", description: "Historical report" }],
        verification_facts: ["Historical check passed"],
      },
    });
    expect(extractFinishParams(historicalTranscripts.partialWithNullOutput)).toEqual({
      status: "blocked",
      summary: "Historical work remains",
      output: null,
      facts: {
        blockers: [{ reason: "External review pending", context: "The saved work is not complete" }],
        verification_evidence: ["Historical draft retained"],
      },
    });
    expect(extractFinishParams(historicalTranscripts.blockedWithEvidenceOnly)).toEqual({
      status: "blocked",
      summary: "Historical review remains",
      output: undefined,
      facts: {
        verification_facts: ["Historical source checks passed"],
        verification_evidence: ["Historical candidate retained"],
        next_steps: ["Obtain external review"],
      },
    });
    expect(extractFinishParams(historicalTranscripts.failure)).toEqual({
      status: "error",
      summary: "Historical verification failed",
      output: { passed: false },
      facts: { verification_facts: ["Historical test exited 1"] },
    });
    expect(JSON.stringify(historicalTranscripts)).toBe(saved);
  });

  it("rejects a committed historical finish whose persisted summary is not a string", () => {
    const messages = [
      finishCall("finish-corrupt-summary", {
        status: "success",
        summary: { text: "corrupted persisted value" },
        result: false,
        verification_facts: ["Committed historical evidence"],
      }),
      finishResult("finish-corrupt-summary", "✅ SUCCESS: persisted result"),
    ];

    expect(extractFinishParams(messages)).toBeNull();
  });

  it("does not accept a finish call rejected by semantic validation", () => {
    const messages = [
      finishCall("finish-1", { status: "blocked", summary: "Need input" }),
      finishResult("finish-1", "finish() error: 'blockers' required when status is 'blocked'."),
    ];

    expect(extractFinishParams(messages)).toBeNull();
  });

  it("does not accept a finish call rejected by Pi schema validation", () => {
    const messages = [
      finishCall("finish-1", { status: "done", summary: "Missing result" }),
      finishResult("finish-1", "Validation failed for tool finish", true),
    ];

    expect(extractFinishParams(messages)).toBeNull();
  });
});
