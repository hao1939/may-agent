import { describe, it, expect } from "vitest";
import { classifyFailure } from "../agents/may/handlers/tool-quality-scan.ts";

function chain(tool: string, args: string, result: string, rootCause: string) {
  return { trigger: { tool, args, result }, rootCause, recovery: [] };
}

describe("classifyFailure", () => {
  it("classifies empty args", () => {
    expect(classifyFailure(chain("bash", "{}", "", ""))).toBe("empty-args");
    expect(classifyFailure(chain("bash", "", "", ""))).toBe("empty-args");
  });

  it("classifies ENOENT / nonexistent-path", () => {
    expect(classifyFailure(chain("read", '{"path":"x.md"}', "No such file", "ENOENT"))).toBe("nonexistent-path");
  });

  it("classifies edit match failures", () => {
    expect(classifyFailure(chain("edit", '{"path":"x"}', "", "Could not find exact text"))).toBe("edit-match-fail");
  });

  it("classifies command not found", () => {
    expect(classifyFailure(chain("bash", '{"command":"foo"}', "command not found", "command not found"))).toBe("cmd-not-found");
  });

  // New categories
  it("classifies Command aborted as cmd-aborted", () => {
    expect(classifyFailure(chain("bash", '{"command":"gym-run.sh x"}', "Command aborted", "exec failed: Command aborted"))).toBe("cmd-aborted");
  });

  it("classifies vitest failures as test-failure", () => {
    expect(classifyFailure(chain("bash", '{"command":"vitest run"}',
      "test/x.test.ts (41 tests | 1 failed) 24ms", "bash failed: 41 tests | 1 failed"))).toBe("test-failure");
  });

  it("classifies gym-run passed:false as test-failure", () => {
    expect(classifyFailure(chain("bash", '{"command":"gym-run.sh x"}',
      '{"scenario":"x","passed": false}', 'exec failed: {"passed": false}'))).toBe("test-failure");
  });

  it("classifies RESULT: FAIL as test-failure", () => {
    expect(classifyFailure(chain("bash", '{"command":"run"}',
      "RESULT: FAIL\nRESULT: FAIL", "bash failed: RESULT: FAIL"))).toBe("test-failure");
  });

  it("classifies test runner output with checkmarks as test-failure", () => {
    expect(classifyFailure(chain("bash", '{"command":"vitest run"}',
      "✓ src/tests/optional.test.ts (2 tests) 21ms", "bash failed: ✓ tests"))).toBe("test-failure");
  });

  it("classifies git fatal errors as git-error", () => {
    expect(classifyFailure(chain("bash", '{"command":"git diff --name-only -s"}',
      "fatal: options '--name-only' and '-s' cannot be used together\n\nCommand exited with code 128",
      "bash failed: fatal: options cannot be used together"))).toBe("git-error");
  });

  it("classifies ERR_UNKNOWN_BUILTIN_MODULE as env-mismatch", () => {
    expect(classifyFailure(chain("bash", '{"command":"node -e ..."}',
      "Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite",
      "exec failed: ERR_UNKNOWN_BUILTIN_MODULE"))).toBe("env-mismatch");
  });

  it("classifies exit code 1 as exit-code-nonzero", () => {
    expect(classifyFailure(chain("bash", '{"command":"grep x y"}',
      "(no output)\n\nCommand exited with code 1",
      "exec failed: — (no output)\n\nCommand exited with code 1"))).toBe("exit-code-nonzero");
  });

  it("classifies exit code 2 as exit-code-nonzero", () => {
    expect(classifyFailure(chain("bash", '{"command":"ls nonexistent/ 2>/dev/null"}',
      "env\npackage.json\n---\n\nCommand exited with code 2",
      "exec failed: — env\npackage.json\n---\n\nCommand exited with code 2"))).toBe("exit-code-nonzero");
  });

  it("still classifies genuine others as other", () => {
    expect(classifyFailure(chain("bash", '{"command":"cat foo.js"}',
      "/** Markdown Renderer */", "bash failed: /** Markdown Renderer */"))).toBe("other");
  });

  it("classifies timeout-killed", () => {
    expect(classifyFailure(chain("bash", '{"command":"long"}', "timed out", "timed out"))).toBe("timeout-killed");
  });

  it("classifies permission-denied", () => {
    expect(classifyFailure(chain("bash", '{"command":"cat /root/x"}', "Permission denied", "Permission denied"))).toBe("permission-denied");
  });

  it("classifies module-not-found", () => {
    expect(classifyFailure(chain("bash", '{"command":"bun x.ts"}', "Cannot find module 'foo'", "Cannot find module 'foo'"))).toBe("module-not-found");
  });
});
