/**
 * Tests for tool name sanitization in the security module.
 *
 * Validates that sanitizeToolName prevents directory traversal attacks,
 * absolute path injection, null byte injection, and other path-based attacks.
 */

import { describe, it, expect } from "vitest";
import { sanitizeToolName, checkSkillSafety } from "../../src/lib/tools/security.js";

// ── sanitizeToolName ────────────────────────────────────────────────────

describe("sanitizeToolName()", () => {
  describe("valid tool names", () => {
    it("accepts simple alphanumeric names", () => {
      const result = sanitizeToolName("myTool");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("myTool");
      expect(result.reason).toBeNull();
    });

    it("accepts names with hyphens and underscores", () => {
      expect(sanitizeToolName("my-tool").valid).toBe(true);
      expect(sanitizeToolName("my_tool").valid).toBe(true);
      expect(sanitizeToolName("my-tool_v2").valid).toBe(true);
    });

    it("accepts names with single dots (e.g., namespaced tools)", () => {
      const result = sanitizeToolName("security.check");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("security.check");
    });

    it("accepts purely numeric names", () => {
      expect(sanitizeToolName("123").valid).toBe(true);
    });

    it("trims whitespace from valid names", () => {
      const result = sanitizeToolName("  myTool  ");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("myTool");
    });
  });

  describe("directory traversal prevention", () => {
    it("rejects ../../etc/passwd", () => {
      const result = sanitizeToolName("../../etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeNull();
      expect(result.reason).toContain("..");
    });

    it("rejects ../secret", () => {
      const result = sanitizeToolName("../secret");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects deeply nested traversal like ../../../../root/.ssh/id_rsa", () => {
      const result = sanitizeToolName("../../../../root/.ssh/id_rsa");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects .. by itself", () => {
      const result = sanitizeToolName("..");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects name with embedded .. like foo..bar", () => {
      const result = sanitizeToolName("foo..bar");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });

    it("rejects Windows-style traversal ..\\windows\\system32", () => {
      const result = sanitizeToolName("..\\windows\\system32");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("..");
    });
  });

  describe("absolute path prevention", () => {
    it("rejects Unix absolute path /etc/passwd", () => {
      const result = sanitizeToolName("/etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("absolute path");
    });

    it("rejects Windows absolute path C:\\Windows\\System32", () => {
      const result = sanitizeToolName("C:\\Windows\\System32");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("absolute path");
    });

    it("rejects root path /", () => {
      const result = sanitizeToolName("/");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("absolute path");
    });
  });

  describe("path separator prevention", () => {
    it("rejects forward slash in name like sub/tool", () => {
      const result = sanitizeToolName("sub/tool");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("path separator");
    });

    it("rejects backslash in name like sub\\tool", () => {
      const result = sanitizeToolName("sub\\tool");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("path separator");
    });
  });

  describe("null byte prevention", () => {
    it("rejects name with null byte", () => {
      const result = sanitizeToolName("tool\0.txt");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("null byte");
    });

    it("rejects name that is just a null byte", () => {
      const result = sanitizeToolName("\0");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("null byte");
    });
  });

  describe("empty and whitespace names", () => {
    it("rejects empty string", () => {
      const result = sanitizeToolName("");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("empty");
    });

    it("rejects whitespace-only string", () => {
      const result = sanitizeToolName("   ");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("empty");
    });
  });

  describe("special character prevention", () => {
    it("rejects names with shell metacharacters", () => {
      expect(sanitizeToolName("tool;rm -rf /").valid).toBe(false);
      expect(sanitizeToolName("tool$(whoami)").valid).toBe(false);
      expect(sanitizeToolName("tool`id`").valid).toBe(false);
      expect(sanitizeToolName("tool|cat /etc/passwd").valid).toBe(false);
    });

    it("rejects names with spaces", () => {
      expect(sanitizeToolName("my tool").valid).toBe(false);
    });

    it("rejects names with quotes", () => {
      expect(sanitizeToolName("tool'name").valid).toBe(false);
      expect(sanitizeToolName('tool"name').valid).toBe(false);
    });
  });
});
