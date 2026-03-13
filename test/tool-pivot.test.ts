import { describe, it, expect } from "vitest";
import { isToolError, computeToolArgsKey, TOOL_PIVOT_LIMIT } from "../src/lib/manager.js";

describe("Tool Pivot Heuristic", () => {
  describe("isToolError", () => {
    it("detects non-zero exit codes", () => {
      expect(isToolError("Command failed with exit code 1")).toBe(true);
      expect(isToolError("Process exited with exit code 127")).toBe(true);
      expect(isToolError("bash: exit 2")).toBe(true);
      expect(isToolError("exit code 0")).toBe(false); // exit 0 is success
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

  describe("pivot integration (toolErrorHistory tracking)", () => {
    // These tests verify the logic by simulating what wrapToolsWithReceipts does internally.
    // Full integration requires a running SubagentManager, so we test the helpers + the Map logic.
    
    it("tracks consecutive errors and resets on success", () => {
      const history = new Map<string, number>();
      const key = computeToolArgsKey("bash", { command: "cat /missing" });

      // Simulate 2 errors
      const output1 = "cat: /missing: No such file or directory";
      expect(isToolError(output1)).toBe(true);
      history.set(key, (history.get(key) ?? 0) + 1);
      expect(history.get(key)).toBe(1);

      history.set(key, (history.get(key) ?? 0) + 1);
      expect(history.get(key)).toBe(2);

      // Simulate success — should reset
      const output2 = "file contents here";
      expect(isToolError(output2)).toBe(false);
      history.delete(key);
      expect(history.has(key)).toBe(false);
    });

    it("blocks at TOOL_PIVOT_LIMIT", () => {
      const history = new Map<string, number>();
      const key = computeToolArgsKey("edit", { path: "foo.ts", oldText: "wrong" });

      // Simulate 3 errors
      for (let i = 0; i < TOOL_PIVOT_LIMIT; i++) {
        history.set(key, (history.get(key) ?? 0) + 1);
      }
      expect(history.get(key)).toBe(TOOL_PIVOT_LIMIT);

      // At limit — should block
      const failCount = history.get(key) ?? 0;
      expect(failCount >= TOOL_PIVOT_LIMIT).toBe(true);
    });

    it("different args produce independent counters", () => {
      const history = new Map<string, number>();
      const key1 = computeToolArgsKey("bash", { command: "cat /a" });
      const key2 = computeToolArgsKey("bash", { command: "cat /b" });

      history.set(key1, 3);
      expect(history.get(key2) ?? 0).toBe(0); // key2 is unaffected
    });
  });
});
