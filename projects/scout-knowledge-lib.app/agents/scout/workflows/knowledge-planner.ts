import {
  admitTaskReconcileResult,
  taskOwnerResultSchema,
  type ExecutionResult,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";

type OwnerResult = Exclude<TaskReconcileResult, { state: "needs-owner" }>;

export function admitExperienceReviewResult(
  value: unknown,
): { ok: true; result: OwnerResult } | { ok: false; error: string } {
  const admitted = admitTaskReconcileResult(value, {
    allowNeedsOwner: false,
    defaultParentId: "project",
  });
  if (!admitted.ok) return admitted;
  if (admitted.result.state === "needs-owner") {
    return { ok: false, error: "experience review cannot return needs-owner" };
  }
  const created = (admitted.result.actions ?? []).filter(
    (action) => action.kind === "create-task",
  );
  if (created.length > 1) {
    return {
      ok: false,
      error: "experience review may create at most one finite task",
    };
  }
  if (created.some((action) => action.mode !== "achieve")) {
    return {
      ok: false,
      error: "experience review may not create a maintain task",
    };
  }
  return { ok: true, result: admitted.result };
}

function isExperienceReview(ctx: WorkflowContext): boolean {
  const data = ctx.reconciliation?.trigger?.data;
  return Boolean(
    data &&
    typeof data === "object" &&
    (data as Record<string, unknown>).reason === "experience-review",
  );
}

export const name = "knowledge-planner";
export const description =
  "Scout knowledge-library planner. Reviews the project task tree and performs the smallest useful library maintenance step.";

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  if (!ctx.workspace || !ctx.reconciliation) {
    return ctx.blocked(
      "Scout maintenance requires a canonical App task context",
    );
  }
  const appDir = ctx.workspace.appRoot;
  const projectDir = ctx.workspace.projectRoot;
  const experienceReview = isExperienceReview(ctx);
  const experienceContext = experienceReview
    ? `Bounded reconciliation history:\n${JSON.stringify(ctx.reconciliation.children, null, 2)}`
    : "";
  const prompt =
    `You are Scout maintaining the Scout Knowledge Library as a project.

Scout maintains this knowledge-library project:
- Domain workspace: ${projectDir}
- App/control plane: ${appDir}
- Durable library: ${projectDir}/knowledge
- Working digest: ${appDir}/agents/scout/workspace/digest/today.md
- External shared corpus: /app/shared/knowledge

Your job in this workflow is not a freeform heartbeat. Review the project task
tree, understand the trigger, and do the smallest useful maintenance step.

Start by reading:
- ${appDir}/project.json
- the bounded reconciliation packet below
- ${projectDir}/README.md
- ${projectDir}/knowledge/INDEX.md

Valid durable outcomes:
- update an existing knowledge note to reduce duplication or improve reuse
- create or update ${projectDir}/knowledge/README.md as a short human landing page
- repair ${projectDir}/knowledge/INDEX.md navigation
- add a source-grounded finding only when no existing note fits
- write a compact report under ${projectDir}/reports/
- move a small verified report batch into reports/health, reports/merge,
  reports/triage, reports/migration, or reports/operations
- propose a typed task action when project understanding or next work changes

Health-signal closure rules:
- Library-health signals are current domain facts, not task-progress judgments
  or instructions to create work. Review only the facts listed in this trigger.
- For each meaningful fact, perform the smallest useful domain step, propose at
  most one independently closable child task, or record an exact no-op reason.
- Treat future-dated project/library content as a time-trust repair before
  doing more synthesis. Correct the date when it is wrong; otherwise record why
  the future date is intentional.
- An unchanged fact may be a valid no-op. The observer itself controls when the
  fact is next due for review; do not encode owner decisions into observer state.
- If unsourced backlog keeps growing, select a small batch or record the exact
  capacity blocker and next batch target.
- If human-navigation-missing appears, create knowledge/README.md first. Keep it
  short and human-facing; do not duplicate the full INDEX.
- If reports-layout-backlog appears, move only one small report batch and update
  references. Do not reorganize the whole library in one pass.
- If artifact-identity-collision appears, inspect only the findings and digest
  headings named by its evidence. Preserve every recoverable source-grounded
  finding, give distinct findings descriptive unused paths and headings, and
  repair the working digest without inventing lost prose. Read all repaired
  files back and verify that the exact (source, date, scan ID) collision is gone.
  If evidence is insufficient, report the exact unresolved gap and leave the
  health fact observable; do not claim that the collision was repaired.

Operating rules:
- Prefer updating existing notes over creating duplicates.
- Treat /app/shared/knowledge as external source material. Link, summarize, or
  promote only durable reusable knowledge; do not bulk-copy the corpus.
- Keep source-grounded <ai_context> preambles where the library already uses them.
- Do not bulk-edit just to improve a metric.
- Do not create ceremonial project/control tasks.
- The generic reconciler is the sole task-tree mutation authority. Never edit
  the task-tree JSON, call task-tree mutation commands, or write task state via
  the database. Return task changes only through the typed actions in \`finish\`.
- Existing-task actions require the exact generation shown in the tree. Never
  mutate or create task ids beginning with \`runtime/\`.
- You may edit Scout-owned knowledge and report files, plus the working digest,
  when that is the smallest useful domain step. Task actions describe the
  durable organization change; they are not a substitute for evidence that the
  domain change happened.
- If no useful library or organization change is warranted, return an empty
  actions array with the exact reason.
- Finish with state, summary, evidence, actions, and exact Conditions when
  waiting. Use \`converged\` after applying the current bounded actions, and
  \`waiting\` only for an identified external fact that an observer will emit.

${experienceContext}

## Canonical reconciliation context
${JSON.stringify(ctx.reconciliation, null, 2)}`.trim();

  const result = await ctx.agents.call("scout", prompt, {
    timeoutMs: 1_800_000,
    schema: taskOwnerResultSchema,
  });
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Scout owner maintenance session failed", {
      executionId: result.id,
      status: result.status,
      summary: result.summary,
    });
  }

  let ownerResult = result.output as unknown as OwnerResult;
  if (experienceReview) {
    const admitted = admitExperienceReviewResult(ownerResult);
    if (!admitted.ok) {
      return ctx.blocked(
        `Scout experience review result was rejected: ${admitted.error}`,
        {
          executionId: result.id,
        },
      );
    }
    ownerResult = admitted.result;
  }
  await ctx.events.emit({
    type: "project.knowledge.maintained",
    target: { appId: "scout-knowledge-lib", project: "scout-knowledge-lib" },
    data: {
      project: "scout-knowledge-lib",
      summary: ownerResult.summary,
      state: ownerResult.state,
      proposedActions: ownerResult.actions ?? [],
      evidence: ownerResult.evidence,
    },
  });
  return ctx.done(ownerResult.summary, ownerResult);
}
