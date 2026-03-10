/// <reference path="../../../src/workflow-defs.d.ts" />

export const name: string = "paper-review-2601-12538";

export const description: string =
  "One-off pipeline: scout fetches and investigates arXiv paper 2601.12538, bob reviews for system relevance.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  ctx.emit({ type: "step_start", step: "scout-investigate" });
  const scout = await ctx.runAgent("scout", `Fetch and deeply investigate this paper: https://arxiv.org/abs/2601.12538

1. Read the full paper (try https://arxiv.org/pdf/2601.12538 or the HTML version)
2. Summarize: title, authors, abstract, key contributions
3. Deep-dive the methodology — what exactly do they propose?
4. Extract key findings, metrics, benchmarks, results
5. Identify what's novel vs. prior work
6. Analyze relevance to multi-agent systems like ours (orchestrator + specialist agents)
7. List specific actionable takeaways

Save your full investigation to agents/scout/workspace/paper-2601.12538-investigation.md`);
  ctx.emit({ type: "step_done", step: "scout-investigate", sessionId: scout.sessionId, result: scout });

  if (scout.status === "error") {
    return ctx.escalate("scout investigation failed", { error: scout.error });
  }

  ctx.emit({ type: "step_start", step: "bob-review" });
  const bob = await ctx.runAgent("bob", `Review scout's investigation of arXiv paper 2601.12538.

Paper URL: https://arxiv.org/abs/2601.12538

Scout's investigation: ${ctx.summarize(scout)}

Your job:
1. Read agents/scout/workspace/paper-2601.12538-investigation.md for the full analysis
2. Also read the paper abstract yourself at the URL above to form your own view
3. Evaluate against our philosophy (agents/shared/philosophy.md) and system design (agents/shared/system-design.md)
4. Judge: is this paper actionable for our system, or just academically interesting?
5. If actionable, propose concrete changes — which agents, which behaviors, what implementation
6. If not actionable, explain why clearly
7. Write your review to agents/bob/workspace/paper-2601.12538-review.md`);
  ctx.emit({ type: "step_done", step: "bob-review", sessionId: bob.sessionId, result: bob });

  if (bob.status === "error") {
    return ctx.escalate("bob review failed", { error: bob.error });
  }

  return ctx.done(
    "## Paper Review Complete: arXiv 2601.12538\\n\\n" +
    "### Scout Investigation\\n" + (scout.lastAssistantText?.slice(0, 1000) || "(no output)") + "\\n\\n" +
    "### Bob's Review\\n" + (bob.lastAssistantText?.slice(0, 1000) || "(no output)") + "\\n\\n" +
    "Files:\\n- agents/scout/workspace/paper-2601.12538-investigation.md\\n- agents/bob/workspace/paper-2601.12538-review.md"
  );
}
