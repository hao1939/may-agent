/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "test-and-fix";

export const description: string =
  "Run tests, if they fail delegate to coder to fix, then re-test. " +
  "One retry. Escalates if tests still fail after fix.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Run tests
  const testTask = ctx.task || "Run npx vitest --run and report the results. If all tests pass, just say TESTS PASS. If any fail, report the exact failure output.";
  const testRun = await ctx.runAgent("coder", testTask);
  if (testRun.status === "error") {
    return ctx.escalate("test run failed", { error: testRun.error });
  }

  // Check if tests passed
  const testText = testRun.lastAssistantText ?? "";
  const testUpper = testText.toUpperCase();
  if (testUpper.includes("TESTS PASS") || (testUpper.includes("PASSED") && !testUpper.includes("FAILED"))) {
    return ctx.done(`Tests passed.\n\n${testText}`);
  }

  // Step 2: Tests failed — delegate fix to coder
  const fixTask =
    `Tests are failing. Fix the failures:\n\n${testText}\n\n` +
    `After fixing, run npx vitest --run to verify all tests pass.`;
  const fix = await ctx.runAgent("coder", fixTask);
  if (fix.status === "error") {
    return ctx.escalate("coder fix attempt failed", { error: fix.error, testOutput: testText });
  }

  // Step 3: Verify fix
  const fixText = fix.lastAssistantText ?? "";
  const fixUpper = fixText.toUpperCase();
  if (fixUpper.includes("TESTS PASS") || (fixUpper.includes("PASSED") && !fixUpper.includes("FAILED"))) {
    return ctx.done(`Tests fixed and passing.\n\n${fixText}`);
  }

  // Still failing after one fix attempt
  return ctx.escalate("tests still failing after one fix attempt", {
    originalFailures: testText,
    fixAttempt: fixText,
  });
}
