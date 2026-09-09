import { describe, it, expect } from "bun:test";
import { isToolError, computeToolArgsKey, TOOL_PIVOT_LIMIT } from "./manager.js";

describe("Tool Pivot Heuristic", () => {
  describe("isToolError", () => {
    it("detects non-zero exit codes from bash.ts format", () => {
      // bash.ts appends "Command exited with code N" for non-zero exits
      expect(isToolError("some output\n\nCommand exited with code 1")).toBe(true);
      expect(isToolError("Command exited with code 127")).toBe(true);
      expect(isToolError("Command exited with code 2")).toBe(true);
      expect(isToolError("exit code 0")).toBe(false); // exit 0 is success
    });

    it("does not false-positive on exit code mentions in content", () => {
      // grep/read output containing "exit code 1" should NOT trigger error
      expect(isToolError("src/foo.ts:42: exit code 1;")).toBe(false);
      expect(isToolError("the process will exit 1 if")).toBe(false);
      expect(isToolError("testing that exit 42 is handled")).toBe(false);
      expect(isToolError("bash: exit 2 in documentation")).toBe(false);
    });

    it("detects error emoji prefix", () => {
      expect(isToolError("❌ git commit failed")).toBe(true);
      expect(isToolError("✅ Success")).toBe(false);
    });

    it("detects ENOENT and EACCES", () => {
      expect(isToolError("Error: ENOENT: no such file or directory")).toBe(true);
      expect(isToolError("Error: EACCES: permission denied")).toBe(true);
    });

    it("detects common error strings", () => {
      expect(isToolError("bash: foo: command not found")).toBe(true);
      expect(isToolError("ls: cannot access '/bad': No such file or directory")).toBe(true);
      expect(isToolError("Permission denied (publickey)")).toBe(true);
    });

    it("detects edit tool errors", () => {
      expect(isToolError("Could not find the exact text in src/foo.ts")).toBe(true);
      expect(isToolError("File not found: src/bar.ts")).toBe(true);
      expect(isToolError("Found 3 occurrences of the text in src/foo.ts")).toBe(true);
    });

    it("detects our own blocks", () => {
      expect(isToolError("OpBudgetExceeded: Agent foo used 10/10")).toBe(true);
      expect(isToolError("🚫 E_RETRY_LIMIT: blocked")).toBe(true);
    });

    it("returns false for normal output", () => {
      expect(isToolError("Hello world")).toBe(false);
      expect(isToolError("Successfully wrote 100 bytes")).toBe(false);
      expect(isToolError("test/foo.test.ts: 5 passed")).toBe(false);
      expect(isToolError("")).toBe(false);
    });
  });

  describe("computeToolArgsKey", () => {
    it("produces stable keys for same tool+args", () => {
      const key1 = computeToolArgsKey("bash", { command: "ls -la" });
      const key2 = computeToolArgsKey("bash", { command: "ls -la" });
      expect(key1).toBe(key2);
    });

    it("produces different keys for different args", () => {
      const key1 = computeToolArgsKey("bash", { command: "ls -la" });
      const key2 = computeToolArgsKey("bash", { command: "ls -lb" });
      expect(key1).not.toBe(key2);
    });

    it("produces different keys for different tools", () => {
      const key1 = computeToolArgsKey("bash", { command: "foo" });
      const key2 = computeToolArgsKey("edit", { command: "foo" });
      expect(key1).not.toBe(key2);
    });

    it("handles null/undefined params", () => {
      const key1 = computeToolArgsKey("read", null);
      const key2 = computeToolArgsKey("read", undefined);
      // Both should produce a key based on {}
      expect(key1).toBe(key2);
    });

    it("key format is toolName:hash", () => {
      const key = computeToolArgsKey("bash", { command: "echo hi" });
      expect(key).toMatch(/^bash:[0-9a-f]{16}$/);
    });
  });

  describe("TOOL_PIVOT_LIMIT", () => {
    it("is 3", () => {
      expect(TOOL_PIVOT_LIMIT).toBe(3);
    });
  });

});
