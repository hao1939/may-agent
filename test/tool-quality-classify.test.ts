import { describe, it, expect } from "vitest";
import { classifyFailure } from "../agents/may/handlers/tool-quality-scan.ts";

function chain(tool: string, args: string, result: string, rootCause: string, isError?: boolean) {
  return { trigger: { tool, args, result, isError }, rootCause, recovery: [] };
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

  it("classifies edit ambiguous match (multiple occurrences) as edit-match-fail", () => {
    expect(classifyFailure(chain("edit", '{"path":"INDEX.md"}',
      "Found 2 occurrences of the text in INDEX.md. The text must be unique.",
      "edit failed: Found 2 occurrences of the text in INDEX.md. The text must be unique."))).toBe("edit-match-fail");
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

  it("classifies gitignore-blocked paths as git-error", () => {
    expect(classifyFailure(chain("bash", '{"command":"cd agents && git add file.md && git commit"}',
      "The following paths are ignored by one of your .gitignore files:\nfile.md\nhint: Use -f if you really want to add them",
      "exec failed: The following paths are ignored by one of your .gitignore files"))).toBe("git-error");
  });

  it("classifies review gate blocks as git-error", () => {
    expect(classifyFailure(chain("bash", '{"command":"git commit -m msg"}',
      "\n❌ Direct commits to main are blocked by the review gate.\n\n   Commit to a review branch instead:",
      "exec failed: Direct commits to main are blocked"))).toBe("git-error");
  });

  it("classifies git push rejected as git-error", () => {
    expect(classifyFailure(chain("bash", '{"command":"cd agents && git push k3s main"}',
      "! [rejected]  main -> main (fetch first)\nerror: failed to push some refs to 'server'",
      "exec failed: failed to push some refs"))).toBe("git-error");
  });

  it("classifies nothing-to-commit as git-error", () => {
    expect(classifyFailure(chain("bash", '{"command":"git commit -m msg"}',
      "On branch main\nnothing to commit, working tree clean",
      "exec failed: nothing to commit"))).toBe("git-error");
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

  it("classifies exit code 127 as exit-code-nonzero", () => {
    expect(classifyFailure(chain("bash", '{"command":"ls | nonexistent-cmd"}',
      "output\n---\n\nCommand exited with code 127",
      "exec failed: Command exited with code 127"))).toBe("exit-code-nonzero");
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

  it("classifies truncated bash output with isError as exit-code-nonzero", () => {
    // When output is truncated, "Command exited with code N" is cut off.
    // The chain detector still sets isError:true and rootCause starts with "exec failed:".
    expect(classifyFailure(chain("bash",
      '{"command":"grep -c \\"KE-079\\" agents/shared/knowledge/INDEX.md && echo \\"---\\""}',
      "3\n---\n# KE-079: Cascade-Architecture Convergence",
      'exec failed: {"command":"grep -c \\"KE-079\\"  — 3\n---\n# KE-079: Cascade-Architecture Convergence',
      true))).toBe("exit-code-nonzero");
  });

  it("still classifies genuine other when isError is not set", () => {
    // Without isError, truncated output with "exec failed:" should remain "other"
    expect(classifyFailure(chain("bash", '{"command":"cat foo.js"}',
      "/** Markdown Renderer */", "bash failed: /** Markdown Renderer */"))).toBe("other");
  });
});
