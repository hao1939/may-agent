/**
 * tool-quality-scan.ts — Classifies tool failure chains by failure type.
 *
 * Used by the tool quality scanning handler to categorize failures
 * for aggregate reporting.
 */

interface FailureChain {
  trigger: {
    tool: string;
    args: string;
    result: string;
    isError?: boolean;
  };
  rootCause: string;
  recovery: unknown[];
}

export type FailureCategory =
  | "empty-args"
  | "nonexistent-path"
  | "edit-match-fail"
  | "cmd-not-found"
  | "cmd-aborted"
  | "test-failure"
  | "git-error"
  | "env-mismatch"
  | "exit-code-nonzero"
  | "timeout-killed"
  | "permission-denied"
  | "module-not-found"
  | "other";

export function classifyFailure(chain: FailureChain): FailureCategory {
  const { trigger, rootCause } = chain;
  const args = trigger.args ?? "";
  const result = trigger.result ?? "";
  const combined = `${result} ${rootCause}`;

  // Empty args
  if (args === "{}" || args === "") {
    return "empty-args";
  }

  // ENOENT / nonexistent-path
  if (/ENOENT|No such file/i.test(combined)) {
    return "nonexistent-path";
  }

  // Edit match failures
  if (/Could not find exact text|occurrences? of the text/i.test(combined)) {
    return "edit-match-fail";
  }

  // Command not found
  if (/command not found/i.test(combined)) {
    return "cmd-not-found";
  }

  // Command aborted
  if (/Command aborted/i.test(combined)) {
    return "cmd-aborted";
  }

  // Timeout
  if (/timed out/i.test(combined)) {
    return "timeout-killed";
  }

  // Permission denied
  if (/Permission denied/i.test(combined)) {
    return "permission-denied";
  }

  // Module not found
  if (/Cannot find module/i.test(combined)) {
    return "module-not-found";
  }

  // Test failure patterns
  if (
    /\d+ tests?\s*\|\s*\d+ failed/i.test(combined) ||
    /["']?passed["']?\s*:\s*false/i.test(combined) ||
    /RESULT:\s*FAIL/i.test(combined) ||
    /[✓✗]\s+\S+\.test\.ts/i.test(combined)
  ) {
    return "test-failure";
  }

  // Git errors
  if (
    /fatal:/i.test(combined) ||
    /paths are ignored by.*\.gitignore/i.test(combined) ||
    /Direct commits to main are blocked/i.test(combined) ||
    /failed to push some refs/i.test(combined) ||
    /nothing to commit/i.test(combined)
  ) {
    return "git-error";
  }

  // Environment mismatch
  if (/ERR_UNKNOWN_BUILTIN_MODULE/i.test(combined)) {
    return "env-mismatch";
  }

  // Exit code nonzero - check for explicit "Command exited with code N" patterns
  if (/Command exited with code \d+/i.test(combined)) {
    return "exit-code-nonzero";
  }

  // Exit code nonzero - when isError is set and rootCause starts with "exec failed:"
  if (trigger.isError && /^exec failed:/i.test(rootCause)) {
    return "exit-code-nonzero";
  }

  return "other";
}
