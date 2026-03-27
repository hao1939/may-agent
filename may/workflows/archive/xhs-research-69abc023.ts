/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "xhs-research-69abc023";

export const description: string =
  "One-off pipeline: scout researches multi-agent Byzantine Generals problem, bob reviews.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Scout deep-dives the topic from the XHS post
  // The original post content was in images (not extractable), but the topic
  // "多Agent协作根本性缺陷：拜占庭将军" appeared in the feed alongside it.
  // We pivot to researching the actual paper/concept.
  ctx.emit({ type: "step_start", step: "scout-research" });
  const scout = await ctx.runAgent("scout", `Research the intersection of Byzantine fault tolerance and multi-agent AI systems.

Context: A XHS (小红书) post discussed "一个多Agent协作根本性缺陷：拜占庭将军" (A fundamental defect in multi-Agent collaboration: Byzantine Generals). The post was image-based so we couldn't extract the full text, but the topic is highly relevant to our multi-agent system.

Research tasks:
1. Find papers on Byzantine fault tolerance applied to LLM multi-agent systems
2. Search for "Byzantine Generals problem multi-agent AI" — any recent papers (2024-2025)
3. Also search for the specific failure modes: what happens when one agent in a multi-agent system gives incorrect/conflicting information to others?
4. Look for practical mitigations used in production multi-agent systems

For our system specifically, we have agents that delegate to sub-agents and trust their outputs. What are the risks?

Save your consolidated findings to agents/scout/workspace/byzantine-multi-agent-research.md`);
  ctx.emit({ type: "step_done", step: "scout-research", sessionId: scout.sessionId, result: scout });

  if (scout.status === "error") {
    return ctx.escalate("scout research failed", { error: scout.error });
  }

  // Step 2: Bob reviews for relevance to our system
  ctx.emit({ type: "step_start", step: "bob-review" });
  const bob = await ctx.runAgent("bob", `Review scout's research on Byzantine fault tolerance in multi-agent AI systems.

Scout's findings: ${ctx.summarize(scout)}

Your job:
1. Read agents/scout/workspace/byzantine-multi-agent-research.md
2. Evaluate against our philosophy (agents/shared/philosophy.md) and system design (agents/shared/system-design.md)
3. Our system has agents trusting sub-agent outputs without verification — is this a Byzantine risk?
4. Propose specific, actionable changes if needed (not theoretical hand-waving)
5. Write your review to agents/bob/workspace/byzantine-review.md`);
  ctx.emit({ type: "step_done", step: "bob-review", sessionId: bob.sessionId, result: bob });

  if (bob.status === "error") {
    return ctx.escalate("bob review failed", { error: bob.error });
  }

  return ctx.done(
    `## Byzantine Multi-Agent Research Complete\n\n` +
    `### Scout\n${scout.lastAssistantText?.slice(0, 800) || "(no output)"}\n\n` +
    `### Bob's Review\n${bob.lastAssistantText?.slice(0, 800) || "(no output)"}\n\n` +
    `Files:\n- agents/scout/workspace/byzantine-multi-agent-research.md\n- agents/bob/workspace/byzantine-review.md`
  );
}
