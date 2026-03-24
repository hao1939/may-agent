/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Project Monitor Workflow
 *
 * Checks on external agent projects: status, progress, issues.
 * Escalates to coach/optimizer when needed.
 *
 * Runs on cron (e.g., every 30min). May reads projects.json,
 * checks each project's socket and sessions, reports findings.
 */

export const description = "Monitor external agent projects — check status, read progress, escalate issues";

export default async function projectMonitor(ctx: WorkflowContext) {
  // Step 1: May checks all projects and reports
  const checkResult = await ctx.runAgent("may", `
You are checking on external agent projects. Follow these steps:

1. Read agents/may/projects.json to get the list of projects.
2. For each project:
   a. Check if it's running: bash("echo '{\\"type\\":\\"status\\"}' | socat -t2 - UNIX-CONNECT:<path>/<socket> 2>&1")
   b. Read its recent sessions: bash("ls -lt <path>/.state/sessions/history/ 2>/dev/null | head -5")
   c. For the most recent session, read meta.json to get status and outcome
   d. If the session status is "error" or the agent appears stuck, note the issue

3. Write a progress report to agents/may/workspace/project-status.md with:
   - Each project's status (running/idle/error/unreachable)
   - What the agent accomplished (from session meta)
   - Any issues that need attention
   - Recommendations (steer, coach, or leave it alone)

4. If any project has a stuck or failing agent, note it clearly — the next step will handle escalation.
`);

  const report = checkResult.lastAssistantText ?? "";

  // Step 2: If issues found, escalate to coach
  if (report.toLowerCase().includes("stuck") ||
      report.toLowerCase().includes("failing") ||
      report.toLowerCase().includes("error") ||
      report.toLowerCase().includes("needs coaching")) {

    const coachResult = await ctx.runAgent("coach", `
An external project agent needs help. Read agents/may/workspace/project-status.md for the details.

For each project with issues:
1. Read the project's recent session transcript to understand what went wrong
   (path is in the status report)
2. Diagnose the behavioral gap — why did the agent fail?
3. If you can fix it by editing the project's SOUL.md, do it
4. Write your findings to agents/coach/workspace/project-coaching.md

Remember: you're coaching an agent in a DIFFERENT project directory.
Read its SOUL.md and sessions from the paths in the status report.
`);

    return ctx.done(
      `## Project Monitor Complete\n\n` +
      `### Status Report\n${report.slice(0, 500)}\n\n` +
      `### Coaching\n${coachResult.lastAssistantText?.slice(0, 500) ?? "No coaching needed"}`
    );
  }

  return ctx.done(
    `## Project Monitor Complete\n\n` +
    `### Status Report\n${report.slice(0, 500)}\n\n` +
    `All projects healthy — no escalation needed.`
  );
}
