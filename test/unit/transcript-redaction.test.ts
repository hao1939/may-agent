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

  it("redacts authenticated GitHub URLs with embedded tokens", () => {
    const gitOutput = `Cloning into '/tmp/repo'...\nhttps://ghp_abc123XYZtoken456@github.com/org/my-repo.git\nDone.`;
    const result = redactTranscriptSecrets(gitOutput);
    expect(result).not.toContain("ghp_abc123XYZtoken456");
    expect(result).toContain("[REDACTED-GIT-TOKEN]");
    expect(result).toContain("Cloning into");
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

describe("GitHub PAT redaction", () => {
  it("redacts classic GitHub PAT (ghp_)", () => {
    const input = "resolveGitHubClient() returned credential ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abc";
    const result = redactTranscriptSecrets(input);
    expect(result).toContain("[REDACTED-GITHUB-PAT]");
    expect(result).not.toContain("ghp_aBcDeFgHiJk");
  });

  it("redacts fine-grained GitHub PAT (github_pat_)", () => {
    // Standalone context (not after a token= keyword) to test the pattern alone
    const input = 'Found credential: github_pat_11AABBCC0ddddddEEEEEEfffgg in env';
    const result = redactTranscriptSecrets(input);
    expect(result).toContain("[REDACTED-GITHUB-PAT]");
    expect(result).not.toContain("github_pat_11AABBCC0");
  });

  it("redacts GitHub App installation tokens (ghs_)", () => {
    const input = 'ghs_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abc expires at 2026-07-01';
    const result = redactTranscriptSecrets(input);
    expect(result).toContain("[REDACTED-GITHUB-TOKEN]");
    expect(result).not.toContain("ghs_aBcDeFgHiJk");
  });

  it("redacts multiple GitHub token types in one string", () => {
    // Use contexts that don't trigger the generic token= pattern first
    const input = "old ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abc and new ghs_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789def";
    const result = redactTranscriptSecrets(input);
    expect(result).toContain("[REDACTED-GITHUB-PAT]");
    expect(result).toContain("[REDACTED-GITHUB-TOKEN]");
    expect(result).not.toContain("ghp_aBcDeFgHiJk");
    expect(result).not.toContain("ghs_aBcDeFgHiJk");
  });

  it("redacts ghp_ token in resolveGitHubClient output context", () => {
    // This is the exact scenario from the P0 finding — the token appears
    // standalone in CLI output from resolveGitHubClient(). Either the
    // GitHub PAT pattern or the generic token= pattern fires, but the
    // secret MUST NOT survive.
    const input = 'resolveGitHubClient({ owner: "org", pat: "ghp_x1y2z3A4B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9" })';
    const result = redactTranscriptSecrets(input);
    expect(result).not.toContain("ghp_x1y2z3A4B5C6");
    expect(result).toContain("REDACTED");
  });
});

describe("appendSessionMessage GitHub PAT redaction (persistence path)", () => {
  const tmpDir2 = join(import.meta.dir, "__ghpat_redaction_test_tmp__");

  function writeAndRead2(message: any): string {
    const sessionId = `test_ghpat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    mkdirSync(join(tmpDir2, "sessions", sessionId), { recursive: true });
    appendSessionMessage(tmpDir2, sessionId, message);
    return readFileSync(join(tmpDir2, "sessions", sessionId, "session.jsonl"), "utf-8");
  }

  it("setup", () => {
    if (existsSync(tmpDir2)) rmSync(tmpDir2, { recursive: true });
  });

  it("redacts GitHub PAT in tool output through persistence fast-path", () => {
    const message = {
      role: "assistant",
      content: [{
        type: "tool_result",
        text: 'resolveGitHubClient says ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abc',
      }],
    };
    const persisted = writeAndRead2(message);
    expect(persisted).toContain("REDACTED");
    expect(persisted).not.toContain("ghp_aBcDeFgHiJk");
  });

  it("redacts github_pat_ in nested Bun command output through persistence path", () => {
    const message = {
      role: "assistant",
      content: [{
        type: "tool_use",
        id: "call_789",
        name: "bash",
        input: {
          command: "bun run script.ts",
        },
      }, {
        type: "tool_result",
        tool_use_id: "call_789",
        content: "Found credential github_pat_11AABBCC0ddddddEEEEEEfffgg in environment",
      }],
    };
    const persisted = writeAndRead2(message);
    expect(persisted).toContain("[REDACTED-GITHUB-PAT]");
    expect(persisted).not.toContain("github_pat_11AABBCC0");
  });

  it("cleanup", () => {
    if (existsSync(tmpDir2)) rmSync(tmpDir2, { recursive: true });
  });
});
