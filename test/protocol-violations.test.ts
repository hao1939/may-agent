import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { detectProtocolViolations } = require("../agents/evaluator/skills/monitor-session.cjs");

// Helper: create an assistant message with tool calls
function assistantWithToolCalls(calls: Array<{ name: string; args: Record<string, unknown> }>) {
  return {
    role: "assistant",
    content: calls.map((c) => ({
      type: "toolCall",
      name: c.name,
      arguments: c.args,
    })),
  };
}

describe("detectProtocolViolations (P82/P114)", () => {
  // ── P82: Explicit Handshake ─────────────────────────────────────────

  describe("P82 — SIGNALS.md write without read_by", () => {
    it("flags write to SIGNALS.md without read_by", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "write",
            args: {
              path: "agents/shared/SIGNALS.md",
              content: "## New Signal\nSome content without acknowledgment field",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe("P82");
      expect(result.violations[0].evidence).toContain("P82 Violation");
      expect(result.violations[0].evidence).toContain("read_by");
    });

    it("flags edit to SIGNALS.md without read_by", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "edit",
            args: {
              path: "agents/shared/SIGNALS.md",
              oldText: "old content",
              newText: "new content without ack",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(true);
      expect(result.violations[0].type).toBe("P82");
    });

    it("passes when SIGNALS.md write includes read_by:", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "write",
            args: {
              path: "agents/shared/SIGNALS.md",
              content: "## New Signal\nread_by: []\nSome content",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(false);
      expect(result.violations).toHaveLength(0);
    });

    it("passes when editing SIGNALS.md with read_by in newText", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "edit",
            args: {
              path: "agents/shared/SIGNALS.md",
              oldText: "old",
              newText: "read_by: [bob, may]",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(false);
    });

    it("is case-insensitive on SIGNALS.md path", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "write",
            args: {
              path: "agents/shared/signals.md",
              content: "no ack field here",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(true);
      expect(result.violations[0].type).toBe("P82");
    });
  });

  // ── P114: Experience Replay ─────────────────────────────────────────

  describe("P114 — complex task without Experience Replay", () => {
    it("flags src/ modification without prior grep ERROR_LOG", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "edit",
            args: {
              path: "src/lib/manager.ts",
              oldText: "old code",
              newText: "new code",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe("P114");
      expect(result.violations[0].evidence).toContain("Experience Replay");
    });

    it("flags agents/ modification without prior grep ERROR_LOG", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "write",
            args: {
              path: "agents/coder/LESSONS.md",
              content: "new lesson content",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(true);
      expect(result.violations[0].type).toBe("P114");
    });

    it("passes when grep ERROR_LOG precedes src/ modification", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "bash",
            args: { command: "grep -i error ERROR_LOG.jsonl" },
          },
        ]),
        assistantWithToolCalls([
          {
            name: "edit",
            args: {
              path: "src/lib/manager.ts",
              oldText: "old",
              newText: "new",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(false);
    });

    it("passes when grep ERROR_LOG precedes agents/ modification", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "bash",
            args: { command: "cat ERROR_LOG.md | grep pattern" },
          },
        ]),
        assistantWithToolCalls([
          {
            name: "write",
            args: {
              path: "agents/bob/workspace/notes.md",
              content: "some notes",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(false);
    });

    it("only flags P114 once per session (prevents spam)", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "edit",
            args: { path: "src/lib/a.ts", oldText: "a", newText: "b" },
          },
        ]),
        assistantWithToolCalls([
          {
            name: "edit",
            args: { path: "src/lib/b.ts", oldText: "c", newText: "d" },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(true);
      // Should only have 1 P114 violation, not 2
      const p114s = result.violations.filter((v: { type: string }) => v.type === "P114");
      expect(p114s).toHaveLength(1);
    });

    it("does not flag SIGNALS.md writes as P114 (communication, not complex task)", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "write",
            args: {
              path: "agents/shared/SIGNALS.md",
              content: "signal content\nread_by: []",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      // Should be clean — SIGNALS.md has read_by so no P82, and SIGNALS.md is excluded from P114
      expect(result.detected).toBe(false);
    });
  });

  // ── Combined scenarios ──────────────────────────────────────────────

  describe("combined P82 + P114 violations", () => {
    it("detects both P82 and P114 in same session", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "write",
            args: {
              path: "agents/shared/SIGNALS.md",
              content: "no ack field",
            },
          },
        ]),
        assistantWithToolCalls([
          {
            name: "edit",
            args: {
              path: "src/lib/evaluator.ts",
              oldText: "old",
              newText: "new",
            },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(true);
      expect(result.violations).toHaveLength(2);
      const types = result.violations.map((v: { type: string }) => v.type);
      expect(types).toContain("P82");
      expect(types).toContain("P114");
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns clean for empty entries", () => {
      const result = detectProtocolViolations([]);
      expect(result.detected).toBe(false);
      expect(result.violations).toHaveLength(0);
    });

    it("ignores non-assistant messages", () => {
      const entries = [
        {
          role: "user",
          content: [
            {
              type: "toolCall",
              name: "write",
              arguments: {
                path: "agents/shared/SIGNALS.md",
                content: "no read_by",
              },
            },
          ],
        },
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(false);
    });

    it("ignores writes to non-protected paths", () => {
      const entries = [
        assistantWithToolCalls([
          {
            name: "write",
            args: { path: "docs/readme.md", content: "documentation" },
          },
        ]),
      ];
      const result = detectProtocolViolations(entries);
      expect(result.detected).toBe(false);
    });
  });
});
