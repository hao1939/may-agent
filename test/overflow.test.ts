import { describe, it, expect } from "bun:test";
import { isOverflowError } from "../src/lib/overflow.js";

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
