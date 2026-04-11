import { describe, it, expect } from "vitest";
import { isOverflowError, extractProgress } from "../src/lib/overflow.js";

describe("isOverflowError", () => {
  it("detects Anthropic overflow", () => {
    expect(isOverflowError("prompt is too long: 213462 tokens > 200000 maximum")).toBe(true);
  });

  it("detects OpenAI overflow", () => {
    expect(isOverflowError("Your input exceeds the context window of this model")).toBe(true);
  });

  it("detects Google overflow", () => {
    expect(
      isOverflowError("The input token count (1196265) exceeds the maximum number of tokens allowed (1048575)"),
    ).toBe(true);
  });

  it("detects xAI overflow", () => {
    expect(isOverflowError("This model's maximum prompt length is 131072 but the request contains 537812 tokens")).toBe(
      true,
    );
  });

  it("detects generic overflow", () => {
    expect(isOverflowError("context_length_exceeded")).toBe(true);
    expect(isOverflowError("too many tokens")).toBe(true);
    expect(isOverflowError("token limit exceeded")).toBe(true);
  });

  it("detects Cerebras/Mistral empty body overflow", () => {
    expect(isOverflowError("400 status code (no body)")).toBe(true);
    expect(isOverflowError("413 (no body)")).toBe(true);
  });

  it("rejects non-overflow errors", () => {
    expect(isOverflowError("rate limit exceeded")).toBe(false);
    expect(isOverflowError("internal server error")).toBe(false);
    expect(isOverflowError("network timeout")).toBe(false);
    expect(isOverflowError("invalid api key")).toBe(false);
  });
});

describe("extractProgress", () => {
  it("produces markdown with task, actions, and error", () => {
    const messages: any[] = [
      { role: "user", content: [{ type: "text", text: "do something" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I'll read the file first." },
          { type: "toolCall", name: "read", arguments: { path: "/foo/bar.ts" } },
        ],
      },
      { role: "toolResult", content: [{ type: "text", text: "file contents here" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Now I'll write the fix." },
          { type: "toolCall", name: "write", arguments: { path: "/foo/bar.ts", content: "fixed" } },
        ],
      },
    ];

    const result = extractProgress("Fix the bug", messages, "prompt is too long");

    expect(result).toContain("# Overflow Recovery");
    expect(result).toContain("Fix the bug");
    expect(result).toContain("**read**");
    expect(result).toContain("**write**");
    expect(result).toContain("/foo/bar.ts");
    expect(result).toContain("prompt is too long");
    expect(result).toContain("## Files Touched");
    expect(result).toContain("### Read");
    expect(result).toContain("### Written");
  });

  it("handles empty messages", () => {
    const result = extractProgress("task", [], "overflow");
    expect(result).toContain("# Overflow Recovery");
    expect(result).toContain("task");
    expect(result).toContain("overflow");
  });

  it("truncates long action args", () => {
    const longArgs = { data: "x".repeat(500) };
    const messages: any[] = [{ role: "assistant", content: [{ type: "toolCall", name: "exec", arguments: longArgs }] }];
    const result = extractProgress("task", messages, "overflow");
    expect(result).toContain("...");
    // Should not contain the full 500-char string
    expect(result.length).toBeLessThan(1000);
  });

  it("redacts sensitive keys from tool arguments", () => {
    const messages: any[] = [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            name: "exec",
            arguments: {
              command: "curl -H 'Authorization: Bearer secret'",
              apiKey: "sk-secret-123",
              token: "my-token",
              path: "/safe/path",
            },
          },
        ],
      },
    ];
    const result = extractProgress("task", messages, "overflow");
    expect(result).not.toContain("sk-secret-123");
    expect(result).not.toContain("my-token");
    expect(result).toContain("[REDACTED]");
    expect(result).toContain("/safe/path");
    // command is not a secret key, so it should be present
    expect(result).toContain("curl");
  });

  it("truncates long assistant text from the beginning", () => {
    const longText = "START_MARKER " + "x".repeat(3000) + " END_MARKER";
    const messages: any[] = [{ role: "assistant", content: [{ type: "text", text: longText }] }];
    const result = extractProgress("task", messages, "overflow");
    // Should keep the beginning (with START_MARKER) and truncate the end
    expect(result).toContain("START_MARKER");
    expect(result).not.toContain("END_MARKER");
    expect(result).toContain("_(truncated)_");
  });
});
