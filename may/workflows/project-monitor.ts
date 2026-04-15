/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Project Monitor Workflow
 *
 * Actively checks on external agent projects — not just asking status,
 * but reading the actual work output, verifying quality, and providing
 * feedback or escalating.
 *
 * May acts like a hands-on manager:
 * 1. Check if the agent is running
 * 2. Read what it actually produced (code, docs, workspace files)
 * 3. Read the project source to verify the agent's work makes sense
 * 4. If it can give useful feedback → steer the agent directly
 * 5. If it needs coaching → escalate to coach with evidence
 * 6. If it needs human decision → report to human with a specific question
 */

export const description = "Actively monitor external projects — verify work, give feedback, escalate when needed";

export default async function projectMonitor(ctx: WorkflowContext) {
  const checkResult = await ctx.runAgent("may", `
You are actively monitoring external agent projects. This is NOT a passive status check — you are reviewing actual work output and providing feedback.

## Steps

1. **Read project registry**: Read agents/may/projects.json

2. **For each project**, do ALL of these:

   a. **Check if running**: 
      bash("echo '{\\"type\\":\\"status\\"}' | socat -t2 - UNIX-CONNECT:<full_socket_path> 2>&1")
   
   b. **Read recent session outcomes**: 
      bash("ls -lt <path>/.state/sessions/history/ 2>/dev/null | head -10")
      Then read the meta.json of the 2-3 most recent sessions to understand what was accomplished.
   
   c. **Read the agent's actual work output**:
      - Check the agent's workspace: bash("ls <path>/agents/*/workspace/ 2>/dev/null")
      - Read key output files the agent produced
      - If the agent was supposed to write code, read the code
      - If the agent was supposed to write docs, read the docs
   
   d. **Verify against the project source**:
      - Read relevant project files to check if the agent's work makes sense
      - Does the agent's summary match what's actually in the files?
      - Did the agent miss something obvious?
   
   e. **Decide what to do**:
      - **Work is good** → note it, move on
      - **Work has minor issues you can fix with feedback** → send feedback directly:
        bash("echo '{\\"type\\":\\"input\\",\\"message\\":\\"<specific feedback>\\"}' | socat -t2 - UNIX-CONNECT:<socket> 2>&1")
      - **Agent is stuck or confused** → note for coach escalation
      - **Agent needs human decision** → note the specific question for Hao
      - **Agent is idle and has no task** → check if there's pending work to assign

3. **Write report** to agents/may/workspace/project-status.md:
   - Each project: status, what was produced, quality assessment
   - Feedback sent (if any)
   - Issues that need coaching (if any) — with evidence (session IDs, file paths)
   - Questions for Hao (if any) — with context so Hao can decide quickly

Be thorough. Read the actual files, not just metadata. Your job is to catch problems early.
`);

  const report = checkResult.lastAssistantText ?? "";

  // If coach is needed, escalate with evidence
  if (report.toLowerCase().includes("needs coaching") ||
      report.toLowerCase().includes("coach") ||
      report.toLowerCase().includes("behavioral gap") ||
      report.toLowerCase().includes("keeps failing")) {

    await ctx.runAgent("coach", `
An external project agent needs coaching. Read agents/may/workspace/project-status.md for May's assessment.

Your job:
1. Read the specific session transcripts May identified (paths are in the report)
2. Diagnose WHY the agent failed — is it a SOUL.md gap? Missing skill? Wrong methodology?
3. Fix it: edit the project's SOUL.md or common-sense.md (paths in agents/may/projects.json)
4. Write your diagnosis and fix to agents/coach/workspace/project-coaching.md

Remember: you're editing files in a DIFFERENT project directory. Read agents/may/projects.json for paths.
`);
  }

  // If human input needed, notify
  if (report.toLowerCase().includes("question for hao") ||
      report.toLowerCase().includes("human decision") ||
      report.toLowerCase().includes("[human-needed]")) {
    ctx.emit({ type: "step_done", step: "human-attention" } as any);
  }

  return ctx.done(
    `## Project Monitor Complete\n\n${report.slice(0, 1000)}`
  );
}
