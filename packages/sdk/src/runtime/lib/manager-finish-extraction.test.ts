import { describe, expect, it } from "bun:test";
import { extractFinishParams } from "@may-agent/sdk/runtime";

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
