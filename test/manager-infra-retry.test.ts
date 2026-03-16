import { describe, it, expect } from "vitest";
import { isRetryableInfraError, isRateLimitError } from "../src/lib/manager-retry.ts";
import { INFRA_RETRY_MAX } from "../src/lib/manager.ts";
import type { ActiveSession } from "../src/lib/manager-utils.ts";

/**
 * Create a minimal mock ActiveSession for testing isRetryableInfraError().
 * Only populates the fields the function actually reads.
 */
function mockSession(overrides: {
  closed?: boolean;
  status?: ActiveSession["status"];
  messages?: Array<{ role: string; content?: any[]; stopReason?: string }>;
  agentError?: string;
  sessionError?: string;
}): ActiveSession {
  const messages = overrides.messages ?? [];
  return {
    sessionId: "test-session",
    agentName: "test-agent",
    agent: {
      state: {
        messages,
        error: overrides.agentError,
      },
      replaceMessages: () => {},
    } as any,
    promise: Promise.resolve(),
    task: "test task",
    startedAt: Date.now(),
    status: overrides.status ?? "running",
    error: overrides.sessionError,
    outputDir: "/tmp/test",
    turnCount: 0,
    closed: overrides.closed ?? false,
    autoClose: "immediate",
    kind: "call" as any,
    opBudget: 0,
    opCount: 0,
    infraRetryCount: 0,
    toolErrorHistory: new Map(),
    toolErrorCount: 0,
    turnBudgetWarningAt: 0,
    turnBudgetWarned: false,
    filesModified: new Set(),
  } as ActiveSession;
}

describe("P93 Infrastructure Resilience — Infra Retry", () => {
  // ------ INFRA_RETRY_MAX constant ------
  it("exports INFRA_RETRY_MAX constant with value 5", () => {
    expect(INFRA_RETRY_MAX).toBe(5);
    expect(Number.isInteger(INFRA_RETRY_MAX)).toBe(true);
    expect(INFRA_RETRY_MAX).toBeGreaterThan(0);
  });

  // ------ Guard: closed session ------
  it("returns null for closed sessions", () => {
    const session = mockSession({
      closed: true,
      status: "running",
      messages: [{ role: "user" }],
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ Guard: non-running session ------
  it("returns null for non-running sessions (interrupted)", () => {
    const session = mockSession({
      status: "interrupted",
      messages: [{ role: "user" }],
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  it("returns null for non-running sessions (idle)", () => {
    const session = mockSession({
      status: "idle",
      messages: [{ role: "user" }],
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ Guard: empty messages ------
  it("returns null when there are no messages", () => {
    const session = mockSession({
      status: "running",
      messages: [],
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ Guard: abort errors are never retried ------
  it('returns null when agent.state.error contains "aborted"', () => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "user" }],
      agentError: "Request was aborted",
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  it('returns null when session.error contains "aborted" (fallback path)', () => {
    // agent.state.error ?? session.error — tests the fallback
    const s = mockSession({
      status: "running",
      messages: [{ role: "user" }],
    });
    s.error = "aborted by user";
    s.agent.state.error = undefined;
    expect(isRetryableInfraError(s)).toBeNull();
  });

  // ------ Guard: overflow errors are never retried ------
  it.each([
    "prompt is too long: 210000 tokens",
    "maximum context length exceeded",
    "context_length_exceeded",
  ])("returns null for overflow error: %s", (errMsg) => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "user" }],
      agentError: errMsg,
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ Pattern 1: Silent stream error (last message is user, no agentError) ------
  it('returns "empty_response" when last message is user (silent stream error)', () => {
    const session = mockSession({
      status: "running",
      messages: [
        { role: "user" },
        { role: "assistant", content: [{ type: "text", text: "hello" }] },
        { role: "user" },
      ],
    });
    expect(isRetryableInfraError(session)).toBe("empty_response");
  });

  // ------ Pattern 2: Empty assistant response (0 output tokens) ------
  it('returns "empty_response" for assistant with empty content array', () => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "assistant", content: [] }],
    });
    expect(isRetryableInfraError(session)).toBe("empty_response");
  });

  it('returns "empty_response" for assistant with whitespace-only text', () => {
    const session = mockSession({
      status: "running",
      messages: [
        { role: "assistant", content: [{ type: "text", text: "   \n  " }] },
      ],
    });
    expect(isRetryableInfraError(session)).toBe("empty_response");
  });

  it('returns "empty_response" for assistant with no content property', () => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "assistant" }], // content is undefined
    });
    expect(isRetryableInfraError(session)).toBe("empty_response");
  });

  // ------ Pattern 3: stopReason toolUse but no tool calls ------
  it('returns "tool_use_missing" when stopReason is toolUse but only text content', () => {
    const session = mockSession({
      status: "running",
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "Let me check..." }],
          stopReason: "toolUse",
        },
      ],
    });
    expect(isRetryableInfraError(session)).toBe("tool_use_missing");
  });

  it("returns null when stopReason is toolUse AND tool calls exist", () => {
    const session = mockSession({
      status: "running",
      messages: [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check..." },
            { type: "toolCall", name: "read", args: {} },
          ],
          stopReason: "toolUse",
        },
      ],
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ Pattern 4: JSON stream / parse errors ------
  it.each([
    ["Unexpected end of JSON input", "json_stream_error"],
    ["JSON Parse error: unexpected token at position 3", "json_stream_error"],
    ["Unexpected non-whitespace character after JSON at position 42", "json_stream_error"],
    ["Unexpected event order: got data before headers", "json_stream_error"],
  ])('returns "%s" → "%s"', (errorMsg, expected) => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "user" }],
      agentError: errorMsg,
    });
    expect(isRetryableInfraError(session)).toBe(expected);
  });

  // ------ Precedence: overflow beats Pattern 4 ------
  it("overflow errors take precedence over JSON stream patterns", () => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "user" }],
      agentError: "prompt is too long",
    });
    // overflow check runs before json_stream_error check
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ Pattern 5: HTTP/rate limit errors ------
  it.each([
    ["429 Too Many Requests", "http_retryable"],
    ["litellm.RateLimitError: rate limit exceeded", "http_retryable"],
    ["Rate limit exceeded", "http_retryable"],
    ["rate limit exceeded", "http_retryable"],
    ["throttling_error: too many requests", "http_retryable"],
    ["Throttled by upstream", "http_retryable"],
    ["502 Bad Gateway", "http_retryable"],
    ["503 Service Unavailable", "http_retryable"],
    ["500 Internal Server Error", "http_retryable"],
    ["ECONNRESET", "http_retryable"],
    ["ETIMEDOUT", "http_retryable"],
    ["socket hang up", "http_retryable"],
  ])('returns "%s" → "%s"', (errorMsg, expected) => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "user" }],
      agentError: errorMsg,
    });
    expect(isRetryableInfraError(session)).toBe(expected);
  });

  // ------ Pattern 6: Unhandled stop reason from pi-ai ------
  it.each([
    ["Unhandled stop reason: unexpected_state", "unhandled_stop_reason"],
    ["Unhandled stop reason: some_new_reason", "unhandled_stop_reason"],
  ])('returns "%s" → "%s"', (errorMsg, expected) => {
    const session = mockSession({
      status: "running",
      messages: [{ role: "user" }],
      agentError: errorMsg,
    });
    expect(isRetryableInfraError(session)).toBe(expected);
  });

  // ------ Non-matching errors do NOT trigger retry ------
  it.each([
    "API key invalid",
    "Internal server error",
    "Connection refused",
    "timeout exceeded",
    "ENOENT: no such file or directory",
  ])("returns null for non-retryable error: %s", (errMsg) => {
    const session = mockSession({
      status: "running",
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "some response" }],
        },
      ],
      agentError: errMsg,
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ Normal successful responses are NOT retryable ------
  it("returns null for normal assistant response with text content", () => {
    const session = mockSession({
      status: "running",
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "Here is the answer." }],
        },
      ],
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  it("returns null for normal assistant response with tool call content", () => {
    const session = mockSession({
      status: "running",
      messages: [
        {
          role: "assistant",
          content: [
            { type: "toolCall", name: "bash", args: { command: "ls" } },
          ],
        },
      ],
    });
    expect(isRetryableInfraError(session)).toBeNull();
  });

  // ------ manager.ts delegates to manager-retry.ts ------
  it("manager.ts imports from manager-retry.ts", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/manager.ts", "utf-8");
    expect(src).toContain('from "./manager-retry.js"');
    expect(src).toContain("isRetryableInfraError");
    expect(src).toContain("runAgentWithRetry");
  });
});

describe("isRateLimitError — case-insensitive detection", () => {
  it.each([
    "429 Too Many Requests",
    "429",
    "litellm.RateLimitError: rate limit exceeded",
    "Rate limit exceeded",
    "rate limit exceeded",
    "RATE LIMIT",
    "RateLimit error from provider",
    "throttling_error",
    "Throttled by upstream",
    "Request was throttled",
  ])("detects rate limit: %s", (msg) => {
    expect(isRateLimitError(msg)).toBe(true);
  });

  it.each([
    "API key invalid",
    "Connection refused",
    "ECONNRESET",
    "500 Internal Server Error",
    "timeout exceeded",
  ])("does not match: %s", (msg) => {
    expect(isRateLimitError(msg)).toBe(false);
  });
});
