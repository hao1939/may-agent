/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "research-pipeline";

export const description: string =
  "Research pipeline: source agent extracts content → scout deep-dives papers/references → bob reviews for system relevance. " +
  "Task format: JSON with {source, content, questions} or plain text with content to research.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Parse the task — expect structured handoff or plain text
  let scoutTask: string;
  let contentSummary: string;

  // Try to parse as structured input (from a previous agent's handoff)
  try {
    const parsed = JSON.parse(ctx.task);
    contentSummary = parsed.content || parsed.summary || ctx.task;
    const papers = parsed.papers || [];
    const questions = parsed.questions || [];

    scoutTask =
      `Deep-dive research on the following papers/references extracted from a source.\n\n` +
      `## Source Summary\n${contentSummary}\n\n` +
      (papers.length > 0
        ? `## Papers to Research\n${papers.map((p: any) => `- ${typeof p === "string" ? p : (p.title || p.id || JSON.stringify(p))}`).join("\n")}\n\n`
        : "") +
      (questions.length > 0
        ? `## Research Questions\n${questions.map((q: string) => `- ${q}`).join("\n")}\n\n`
        : "") +
      `For each paper:\n` +
      `1. Find the full paper (arXiv, web search, etc.)\n` +
      `2. Read and summarize key findings, methodology, and results\n` +
      `3. Extract actionable insights for our agent system\n` +
      `4. Save deep-dive to agents/scout/workspace/\n\n` +
      `Write a consolidated research report to agents/scout/workspace/research-handoff.md`;
  } catch {
    // Plain text — use as-is
    contentSummary = ctx.task;
    scoutTask =
      `Deep-dive research on the following content.\n\n` +
      `${ctx.task}\n\n` +
      `For any papers or references mentioned:\n` +
      `1. Find the full paper (arXiv, web search, etc.)\n` +
      `2. Read and summarize key findings, methodology, and results\n` +
      `3. Extract actionable insights for our agent system\n` +
      `4. Save deep-dive to agents/scout/workspace/\n\n` +
      `Write a consolidated research report to agents/scout/workspace/research-handoff.md`;
  }

  // Step 1: Scout deep-dives
  ctx.emit({ type: "step_start", step: "scout-deep-dive" });
  const scout = await ctx.runAgent("scout", scoutTask);
  ctx.emit({ type: "step_done", step: "scout-deep-dive", sessionId: scout.sessionId, result: scout });

  if (scout.status === "error") {
    return ctx.escalate("scout deep-dive failed", { error: scout.error });
  }

  // Step 2: Bob reviews for system relevance
  ctx.emit({ type: "step_start", step: "bob-review" });
  const bobTask =
    `Review this research for relevance to our agent system.\n\n` +
    `## Original Source\n${contentSummary.slice(0, 500)}\n\n` +
    `## Scout's Research\n${ctx.summarize(scout)}\n\n` +
    `Your job:\n` +
    `1. Read scout's deep-dive reports in agents/scout/workspace/\n` +
    `2. Evaluate against our philosophy (agents/shared/philosophy.md)\n` +
    `3. Identify what's actionable for our system vs. interesting-but-not-relevant\n` +
    `4. If actionable: propose specific changes or additions to our system\n` +
    `5. Write review to agents/bob/workspace/research-review.md`;
  const bob = await ctx.runAgent("bob", bobTask);
  ctx.emit({ type: "step_done", step: "bob-review", sessionId: bob.sessionId, result: bob });

  if (bob.status === "error") {
    return ctx.escalate("bob review failed", { error: bob.error });
  }

  return ctx.done(
    `## Research Pipeline Complete\n\n` +
    `### Scout Deep-Dive\n${scout.lastAssistantText?.slice(0, 1000) || "(no output)"}\n\n` +
    `### Bob's Review\n${bob.lastAssistantText?.slice(0, 1000) || "(no output)"}\n\n` +
    `Files:\n- Scout: agents/scout/workspace/research-handoff.md\n- Bob: agents/bob/workspace/research-review.md`
  );
}
