/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "verify-setup";

export const description: string =
  "Verify coach's tools, workflows, skills, and ability to spawn/connect to " +
  "a detached agent. Run this after any changes to coach configuration to " +
  "confirm everything works end-to-end.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Coach verifies its own setup — tools, skills, workflows, knowledge
  const selfCheck = await ctx.runAgent("coach",
    `Verify your own setup. Do NOT run any workflows — just check that everything is in place.\n\n` +
    `## Checks\n` +
    `1. List your available workflows: workflow.list() — confirm they all load without errors\n` +
    `2. Read agents/coach/workspace/COACHEES.md — confirm it exists\n` +
    `3. Read agents/coach/knowledge/library/coaching-methodology.md — confirm it references subagents (not background_exec)\n` +
    `4. List agents/coach/skills/ — confirm skill directories exist and each has a SKILL.md\n` +
    `5. Test subagents: subagents.status() — confirm it returns without error\n` +
    `6. Test exec: exec("echo ok") — confirm read-only exec works\n\n` +
    `Report each check as PASS or FAIL with details. If anything fails, explain what's wrong.`
  );
  if (selfCheck.status === "error") {
    return ctx.escalate("self-check failed to run", { error: selfCheck.error });
  }

  // Step 2: Coach spawns a lightweight detached agent and connects via socket
  const connectTest = await ctx.runAgent("coach",
    `Test spawning and connecting to a detached agent.\n\n` +
    `## Previous Check Results\n${ctx.summarize(selfCheck)}\n\n` +
    `## Instructions\n` +
    `1. Spawn a detached coder session with a trivial task:\n` +
    `   subagents.run({ agent: "coder", task: "Run exec(\\"echo hello\\") and stop.", mode: "detached" })\n` +
    `2. Wait 5 seconds, then look for the socket:\n` +
    `   exec("ls .state/instances/")\n` +
    `   Find the instance directory matching the session ID\n` +
    `   exec("cat .state/instances/<dir>/identity.json")\n` +
    `3. Connect via socket_watch using the socket path from identity.json\n` +
    `   Use debounceMs: 3000 and label: "verify"\n` +
    `4. Wait for events — you should see the coder working on the trivial task\n` +
    `5. After seeing events (or after 30 seconds), disconnect and cancel:\n` +
    `   socket_watch.disconnect(watchId)\n` +
    `   subagents.cancel({ sessionId: "<sessionId>" })\n` +
    `6. Verify cleanup: exec("ls .state/instances/") — confirm no stale instance\n\n` +
    `Report each step as PASS or FAIL. If socket connection fails, check the detached log:\n` +
    `exec("cat .state/logs/detached-<sessionId>.log")`
  );
  if (connectTest.status === "error") {
    return ctx.escalate("connect test failed to run", { error: connectTest.error });
  }

  // Combine results
  const selfCheckText = selfCheck.lastAssistantText ?? "(no output)";
  const connectTestText = connectTest.lastAssistantText ?? "(no output)";

  const allPassed = !selfCheckText.includes("FAIL") && !connectTestText.includes("FAIL");

  if (allPassed) {
    return ctx.done(
      `All checks passed.\n\n` +
      `## Self Check\n${selfCheckText}\n\n` +
      `## Connection Test\n${connectTestText}`
    );
  }

  return ctx.escalate(
    "Some checks failed — review details",
    { selfCheck: selfCheckText, connectTest: connectTestText }
  );
}
