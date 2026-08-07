import { describe, it, expect } from "bun:test";
import { classifyError, type ErrorClass } from "./classify-error.js";

describe("classifyError", () => {
  // ── Null / undefined / empty ──────────────────────────────────────
  describe("null/undefined/empty inputs", () => {
    it("returns 'logic' for undefined", () => {
      expect(classifyError(undefined)).toBe("logic");
    });

    it("returns 'logic' for null", () => {
      expect(classifyError(null)).toBe("logic");
    });

    it("returns 'logic' for empty string", () => {
      expect(classifyError("")).toBe("logic");
    });
  });

  // ── Infrastructure errors (retryable) ─────────────────────────────
  describe("infrastructure errors → 'infra'", () => {
    const infraPatterns = [
      "Empty response from API",
      "Got 0 output tokens from model",
      "Stream error: connection reset",
      "Stream closed unexpectedly",
      "HTTP 502 Bad Gateway",
      "HTTP 503 Service Unavailable",
      "HTTP 429 Too Many Requests",
      "ECONNRESET while fetching",
      "Rate limit exceeded, retry after 30s",
      "Request timeout after 60s",
      "Connection refused to api.anthropic.com",
      "Network error: DNS resolution failed",
      "No deployments available for selected model, Try again in 5 seconds",
      "The model is not supported in model group",
      "Bad request: invalid model group configuration",
    ];

    for (const pattern of infraPatterns) {
      it(`classifies "${pattern.slice(0, 50)}…" as infra`, () => {
        expect(classifyError(pattern)).toBe("infra");
      });
    }

    it("is case-insensitive", () => {
      expect(classifyError("EMPTY RESPONSE")).toBe("infra");
      expect(classifyError("Stream Error")).toBe("infra");
      expect(classifyError("RATE LIMIT")).toBe("infra");
    });
  });

  // ── Context overflow (not retryable without modification) ─────────
  describe("overflow errors → 'overflow'", () => {
    const overflowPatterns = [
      "Context window exceeded (200k tokens)",
      "Max tokens limit reached",
      "context_length_exceeded",
      "Too many tokens in request (150000 > 128000)",
    ];

    for (const pattern of overflowPatterns) {
      it(`classifies "${pattern.slice(0, 50)}…" as overflow`, () => {
        expect(classifyError(pattern)).toBe("overflow");
      });
    }
  });

  // ── Abort (user/system cancelled) ─────────────────────────────────
  describe("abort errors → 'abort'", () => {
    const abortPatterns = [
      "Operation aborted by user",
      "Session cancelled by manager",
      "Request was aborted",
      "Task cancel requested",
    ];

    for (const pattern of abortPatterns) {
      it(`classifies "${pattern.slice(0, 50)}…" as abort`, () => {
        expect(classifyError(pattern)).toBe("abort");
      });
    }
  });

  // ── Logic errors (bugs / permission issues) ──────────────────────
  describe("logic errors → 'logic'", () => {
    const logicPatterns = [
      "Tool not found: nonexistent_tool",
      "Permission denied: cannot write to /etc",
      "Call depth exceeded (5). Agents calling each other in a loop.",
      "Operation not allowed for this agent",
      "HTTP 401 Unauthorized",
      "HTTP 403 Forbidden",
      "Unauthorized access to resource",
      "Forbidden: API key lacks permission",
    ];

    for (const pattern of logicPatterns) {
      it(`classifies "${pattern.slice(0, 50)}…" as logic`, () => {
        expect(classifyError(pattern)).toBe("logic");
      });
    }
  });

  // ── Unknown errors default to logic ───────────────────────────────
  describe("unknown errors → 'logic' (conservative default)", () => {
    it("returns 'logic' for unrecognized error strings", () => {
      expect(classifyError("Something unexpected happened")).toBe("logic");
      expect(classifyError("TypeError: Cannot read property of undefined")).toBe("logic");
      expect(classifyError("Stack overflow in recursive function")).toBe("logic");
    });
  });

  // ── Priority / ordering ───────────────────────────────────────────
  describe("classification priority", () => {
    it("infra takes priority when multiple patterns match", () => {
      // "timeout" matches infra, "abort" could match abort — infra checked first
      expect(classifyError("timeout abort")).toBe("infra");
    });

    it("'timeout abort' matches infra before abort", () => {
      // "Timeout abort signal fired" contains both "timeout" (infra) and "abort" (abort)
      // infra is checked first, so it wins
      expect(classifyError("Timeout abort signal fired")).toBe("infra");
    });

    it("overflow takes priority over abort", () => {
      // Both could match if the string contains "cancel" and "context window"
      expect(classifyError("context window exceeded, operation cancelled")).toBe("overflow");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("handles very long error strings", () => {
      const longError = "a".repeat(10000) + " empty response " + "b".repeat(10000);
      expect(classifyError(longError)).toBe("infra");
    });

    it("handles error strings with special characters", () => {
      expect(classifyError("Error: connection failed\n\tat Module._compile")).toBe("infra");
    });

    it("does not match partial words incorrectly", () => {
      // "connection" is a pattern — ensure it matches
      expect(classifyError("disconnection event")).toBe("infra"); // contains "connection"
    });

    it("handles model group compound conditions", () => {
      // "model is not supported" alone should NOT match — needs "model group" too
      expect(classifyError("model is not supported")).toBe("logic");
      expect(classifyError("model is not supported in the current model group")).toBe("infra");
      
      // "bad request" alone should NOT match infra — needs "model group"
      expect(classifyError("bad request: invalid JSON")).toBe("logic");
      expect(classifyError("bad request for model group deployment")).toBe("infra");
    });
  });
});
