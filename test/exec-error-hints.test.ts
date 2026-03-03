import { describe, it, expect } from "vitest";
import { buildExecErrorHint } from "../src/tools.js";

const ROOT = "/home/example-user/may-agent";

describe("buildExecErrorHint", () => {
  describe("empty output on non-zero exit", () => {
    it("detects glob pattern with no matches", () => {
      const hint = buildExecErrorHint(
        "ls agents/*/skills/",
        "",
        2,
        ROOT,
      );
      expect(hint).toContain("glob pattern matched nothing");
      expect(hint).toContain("listing the parent directory");
    });

    it("lists directory contents when path is identifiable", () => {
      const hint = buildExecErrorHint(
        "ls agents/nonexistent/",
        "",
        2,
        ROOT,
      );
      expect(hint).toContain("Hint:");
      // Should list the agents/ directory contents
      expect(hint).toContain("agents/");
    });

    it("detects stderr redirected to /dev/null", () => {
      const hint = buildExecErrorHint(
        "ls agents/*/skills/ 2>/dev/null",
        "",
        2,
        ROOT,
      );
      expect(hint).toContain("redirected to /dev/null");
    });

    it("detects grep with no matches (exit 1)", () => {
      const hint = buildExecErrorHint(
        'grep -r "nonexistent_pattern" src/',
        "",
        1,
        ROOT,
      );
      expect(hint).toContain("grep exited with code 1");
      expect(hint).toContain("no matches found");
    });

    it("provides generic hint for other empty-output failures", () => {
      const hint = buildExecErrorHint(
        "some_random_command",
        "",
        1,
        ROOT,
      );
      expect(hint).toContain("failed with exit code 1 and no output");
    });
  });

  describe("module not found", () => {
    it("suggests build for dist/ modules", () => {
      const hint = buildExecErrorHint(
        'node -e "require(\'./dist/tools.js\')"',
        "Error: Cannot find module './dist/tools.js'\nRequire stack:\n- /home/example-user/may-agent/[eval]",
        1,
        ROOT,
      );
      expect(hint).toContain("./dist/tools.js");
      expect(hint).toContain("built first");
      expect(hint).toContain("npx tsc");
    });

    it("suggests checking file for local modules", () => {
      const hint = buildExecErrorHint(
        'node -e "import(\'./src/nonexistent.js\')"',
        "Error: Cannot find module './src/nonexistent.js'",
        1,
        ROOT,
      );
      expect(hint).toContain("./src/nonexistent.js");
      expect(hint).toContain("Check if the file exists");
    });

    it("suggests npm install for third-party modules", () => {
      const hint = buildExecErrorHint(
        'node -e "require(\'some-pkg\')"',
        "Error: Cannot find module 'some-pkg'",
        1,
        ROOT,
      );
      expect(hint).toContain("npm install some-pkg");
    });
  });

  describe("command not found", () => {
    it("detects command not found and suggests npx", () => {
      const hint = buildExecErrorHint(
        "tsc --noEmit",
        "bash: tsc: command not found",
        127,
        ROOT,
      );
      expect(hint).toContain('"tsc"');
      expect(hint).toContain("npx");
    });
  });

  describe("sed errors", () => {
    it("detects 'old text not found' from sed-like tools", () => {
      const hint = buildExecErrorHint(
        "sed -i 's/old/new/' file.ts",
        "ERROR: old text not found",
        1,
        ROOT,
      );
      expect(hint).toContain("sed command failed");
      expect(hint).toContain("write tool");
    });

    it("detects unterminated substitute", () => {
      const hint = buildExecErrorHint(
        "sed -i 's/old/new' file.ts",
        "sed: -e expression #1, char 12: unterminated `s' substitute command",
        1,
        ROOT,
      );
      expect(hint).toContain("sed command failed");
    });
  });

  describe("TypeScript errors", () => {
    it("detects TS compilation errors", () => {
      const hint = buildExecErrorHint(
        "npx tsc --noEmit",
        "src/tools.ts(42,5): error TS2322: Type 'string' is not assignable to type 'number'.",
        1,
        ROOT,
      );
      expect(hint).toContain("TypeScript compilation error");
      expect(hint).toContain("Read the specific file and line");
    });
  });

  describe("cd errors", () => {
    it("detects cd to non-existent directory", () => {
      const hint = buildExecErrorHint(
        "cd /home/user && ls",
        "/bin/sh: 1: cd: can't cd to /home/user",
        2,
        ROOT,
      );
      expect(hint).toContain("does not exist");
      expect(hint).toContain("working directory is already");
    });
  });

  describe("no hint for unrecognized patterns", () => {
    it("returns empty string when output has content but no pattern match", () => {
      const hint = buildExecErrorHint(
        "some_command",
        "Some random error output that doesn't match any pattern",
        1,
        ROOT,
      );
      expect(hint).toBe("");
    });
  });

  describe("multiple patterns can match", () => {
    it("provides both module hint and compilation hint if both match", () => {
      const hint = buildExecErrorHint(
        "npx tsc",
        "Cannot find module 'foo'\nerror TS2307: Cannot find module 'foo'",
        1,
        ROOT,
      );
      // Should have both hints
      expect(hint).toContain("npm install foo");
      expect(hint).toContain("TypeScript compilation error");
    });
  });
});
