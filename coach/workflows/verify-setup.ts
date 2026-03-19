/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "verify-setup";

export const description: string =
  "Verify coach's tools, workflows, skills, and gym runner. Run this after " +
  "any changes to coach configuration to confirm everything works.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const check = await ctx.runAgent("coach",
    `Verify your setup. Do NOT run any other workflows — just check.\n\n` +
    `## Checks\n` +
    `1. List your available workflows: workflow.list() — confirm they load\n` +
    `2. Read agents/coach/TOOLS.md — confirm it matches your actual tools\n` +
    `3. Read agents/coach/knowledge/method-catalog.md — confirm it exists\n` +
    `4. Read agents/coach/workspace/experiments.jsonl — confirm it exists\n` +
    `5. List agents/coach/skills/ — confirm skill directories exist\n` +
    `6. Test gym runner:\n` +
    `   \`\`\`bash\n` +
    `   ./node_modules/.bin/vite-node src/gym/runner.ts -- --list 2>&1\n` +
    `   \`\`\`\n` +
    `   Confirm it shows usage and available scenarios.\n` +
    `7. Test fork/discard cycle:\n` +
    `   fork_agent({ source: "coder", dest: "coder-verify-test" })\n` +
    `   Confirm agents/.lab/coder-verify-test/ exists\n` +
    `   discard_agent({ fork: "coder-verify-test" })\n` +
    `   Confirm it's cleaned up\n\n` +
    `Report each check as PASS or FAIL with details.`
  );
  if (check.status === "error") {
    return ctx.escalate("setup check failed", { error: check.error });
  }

  const text = check.lastAssistantText ?? "(no output)";
  const allPassed = !text.includes("FAIL");

  if (allPassed) {
    return ctx.done(`All checks passed.\n\n${text}`);
  }

  return ctx.escalate("Some checks failed — review details", { details: text });
}
