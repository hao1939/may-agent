import {
  projectAppTaskOwnerResultSchema,
  type ProjectAppTaskHandlerResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

export const name = "domain-task-execution";
export const description =
  "Execute one bounded independent AKS domain patch in the task-owned Git worktree supplied by infrastructure.";
export const workspace = "task";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.workspaceDir || ctx.workspaceDir === ctx.projectDir) {
    return ctx.blocked(
      "Domain task execution requires a prepared task worktree",
      {
        workspaceDir: ctx.workspaceDir ?? null,
        projectDir: ctx.projectDir ?? null,
      },
    );
  }

  const prompt = [
    "Execute the bounded AKS reconciliation task below.",
    "",
    `Your task-owned Git worktree is ${ctx.workspaceDir}.`,
    "All relative filesystem tools already run there. Do not create another branch or worktree and do not switch the shared canonical checkout.",
    "Inspect current source and task evidence, make only the smallest accepted domain change, run scoped verification, and commit every accepted file change on the supplied task branch.",
    "A converged result must leave the worktree clean. If work cannot be committed cleanly, return needs-owner with exact recovery evidence; use waiting only for an external fact with an exact Condition.",
    "The generic reconciler alone mutates task state. Return task changes only through typed actions.",
    'For a master-validation product-recovery wait, use the semantic pass event: type pipeline.spec.observed, subject project:aks-rp-e2e, expected { specId: "<spec id>", status: "pass", sourceBranch: "refs/heads/main" }. The project subject is the routing scope; the expected fields select the exact proof.',
    "",
    ctx.task,
  ].join("\n");

  const result = await ctx.runAgent(ctx.agent, prompt, {
    timeoutMs: 1_800_000,
    schema: projectAppTaskOwnerResultSchema,
  });
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("AKS domain task session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
      workspaceDir: ctx.workspaceDir,
    });
  }

  const ownerResult = result.structuredResult as ProjectAppTaskHandlerResult;
  return ctx.done(ownerResult.summary, ownerResult);
}
