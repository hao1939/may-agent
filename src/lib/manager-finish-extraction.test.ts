import { describe, expect, it } from "bun:test";
import { extractFinishParams } from "./manager.js";

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
  it("extracts a successfully executed schema-backed finish payload", () => {
    const messages = [
      finishCall("finish-1", { status: "success", summary: "Done", result: { verdict: "pass" } }),
      finishResult("finish-1", "✅ SUCCESS: Done"),
    ];

    expect(extractFinishParams(messages)).toMatchObject({
      status: "success",
      summary: "Done",
      result: { verdict: "pass" },
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
      finishCall("finish-1", { status: "success", summary: "Missing result" }),
      finishResult("finish-1", "Validation failed for tool finish", true),
    ];

    expect(extractFinishParams(messages)).toBeNull();
  });
});
