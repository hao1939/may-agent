import { describe, it, expect } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { redactTranscriptSecrets, appendSessionMessage } from "../../src/lib/persistence.js";

describe("redactTranscriptSecrets", () => {
  it("redacts Azure JWT tokens", () => {
    const jwt =
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJodHRwczovL21hbmFnZW1lbnQuYXp1cmUuY29tIiwiaXNzIjoiaHR0cHM6Ly9zdHMud2luZG93cy5uZXQvYWJjIiwiZXhwIjoxNjE2NjIxNjg0fQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const result = redactTranscriptSecrets(`access_token: ${jwt}`);
    expect(result).toContain("[REDACTED-JWT]");
    expect(result).not.toContain("eyJhbGciOiJ");
  });

  it("redacts Bearer tokens", () => {
    const input =
      "Authorization: Bearer abcdef1234567890abcdef1234567890abcdef1234567890";
    const result = redactTranscriptSecrets(input);
    expect(result).toContain("[REDACTED-BEARER-TOKEN]");
    expect(result).not.toContain("abcdef1234567890");
  });

  it("redacts accessToken assignments", () => {
    const input =
      '{"accessToken": "abcdefghij1234567890abcdefghij1234567890abcdef"}';
    const result = redactTranscriptSecrets(input);
    expect(result).toContain("[REDACTED-ACCESS-TOKEN]");
    expect(result).not.toContain("abcdefghij1234567890");
  });

  it("redacts password/secret/token key-value pairs", () => {
    const input = 'password="supersecretpassword12345"';
    const result = redactTranscriptSecrets(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("supersecretpassword12345");
  });

  it("passes through normal text unchanged", () => {
    const input = "This is a normal log line with no secrets.";
    expect(redactTranscriptSecrets(input)).toBe(input);
  });

  it("redacts multiple JWTs in one string", () => {
    const jwt1 =
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhIiwiZXhwIjoxfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV";
    const jwt2 =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiSm9obiJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV";
    const input = `Token1: ${jwt1} and Token2: ${jwt2}`;
    const result = redactTranscriptSecrets(input);
    expect(result.match(/\[REDACTED-JWT\]/g)?.length).toBe(2);
    expect(result).not.toContain("eyJhbGciOiJ");
  });

  it("handles az account get-access-token JSON output", () => {
    const azOutput = `{
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJodHRwczovL21hbmFnZW1lbnQuYXp1cmUuY29tIiwiaXNzIjoiaHR0cHM6Ly9zdHMud2luZG93cy5uZXQvYWJjIiwiZXhwIjoxNjE2NjIxNjg0fQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      "expiresOn": "2026-06-15 12:00:00.000000",
      "subscription": "test-sub",
      "tenant": "test-tenant",
      "tokenType": "Bearer"
    }`;
    const result = redactTranscriptSecrets(azOutput);
    expect(result).not.toContain("eyJhbGciOiJ");
    // Should contain either REDACTED-JWT or REDACTED-ACCESS-TOKEN
    expect(
      result.includes("[REDACTED-JWT]") ||
        result.includes("[REDACTED-ACCESS-TOKEN]"),
    ).toBe(true);
  });
});

// ── End-to-end persistence-path tests ─────────────────────────────────
// These exercise appendSessionMessage() → sanitizeMessageForTranscript(),
// verifying the fast-path detector doesn't bypass redaction for edge cases.

describe("appendSessionMessage redaction (persistence path)", () => {
  const tmpDir = join(import.meta.dir, "__redaction_test_tmp__");

  function writeAndRead(message: any): string {
    const sessionId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // appendSessionMessage uses persistDir/sessions/sessionId/session.jsonl
    mkdirSync(join(tmpDir, "sessions", sessionId), { recursive: true });
    appendSessionMessage(tmpDir, sessionId, message);
    return readFileSync(join(tmpDir, "sessions", sessionId, "session.jsonl"), "utf-8");
  }

  // Clean up after all tests
  it("setup", () => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it("redacts non-JWT Bearer tokens through persistence path", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          text: "Authorization: Bearer abcdef1234567890abcdef1234567890abcdef1234567890",
        },
      ],
    };
    const persisted = writeAndRead(message);
    expect(persisted).toContain("[REDACTED-BEARER-TOKEN]");
    expect(persisted).not.toContain("abcdef1234567890abcdef1234567890");
  });

  it("redacts accessToken JSON values through persistence path", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          text: '{"accessToken": "abcdefghij1234567890abcdefghij1234567890abcdef"}',
        },
      ],
    };
    const persisted = writeAndRead(message);
    expect(persisted).toContain("[REDACTED-ACCESS-TOKEN]");
    expect(persisted).not.toContain("abcdefghij1234567890abcdefghij1234567890");
  });

  it("redacts password key-value pairs through persistence path", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_result",
          text: 'password="supersecretpassword12345"',
        },
      ],
    };
    const persisted = writeAndRead(message);
    expect(persisted).toContain("[REDACTED]");
    expect(persisted).not.toContain("supersecretpassword12345");
  });

  it("passes normal messages through unchanged", () => {
    const message = {
      role: "assistant",
      content: [{ type: "text", text: "This is a normal log line with no secrets." }],
    };
    const persisted = writeAndRead(message);
    expect(persisted).toContain("This is a normal log line with no secrets.");
  });

  it("redacts secrets in nested tool-call arguments", () => {
    const jwt = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJodHRwczovL21hbmFnZW1lbnQuYXp1cmUuY29tIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_123",
          name: "bash",
          input: {
            command: `az account get-access-token --output json`,
          },
        },
        {
          type: "tool_result",
          tool_use_id: "call_123",
          content: JSON.stringify({
            accessToken: jwt,
            expiresOn: "2026-06-15",
            tokenType: "Bearer",
          }),
        },
      ],
    };
    const persisted = writeAndRead(message);
    expect(persisted).not.toContain("eyJhbGciOiJ");
    expect(persisted).toContain("REDACTED");
  });

  it("redacts secrets in deeply nested objects", () => {
    const message = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_456",
          name: "ssh_exec",
          input: {
            command: "curl -H 'Authorization: Bearer abcdefghij1234567890abcdefghij1234567890abcdefghij1234567890' https://api.example.com",
          },
        },
      ],
    };
    const persisted = writeAndRead(message);
    expect(persisted).toContain("[REDACTED-BEARER-TOKEN]");
    expect(persisted).not.toContain("abcdefghij1234567890");
  });

  it("cleanup", () => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });
});
