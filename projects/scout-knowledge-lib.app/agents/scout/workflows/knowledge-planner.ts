import {
  admitTaskReconcileResult,
  taskAgentResultSchema,
  type ExecutionResult,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";
import { taskEmissionKey } from "./lib/task-emission.js";
import {
  changedKnowledgePaths,
  publicationFacts,
  publishKnowledgeChanges,
  retainedCandidateFacts,
  snapshotKnowledge,
} from "./lib/knowledge-publication.js";

type AgentResult = Exclude<TaskReconcileResult, { state: "needs-agent" }>;

export function admitExperienceReviewResult(
  value: unknown,
): { ok: true; result: AgentResult } | { ok: false; error: string } {
  const admitted = admitTaskReconcileResult(value, {
    allowNeedsAgent: false,
  });
  if (!admitted.ok) return admitted;
  if (admitted.result.state === "needs-agent") {
    return { ok: false, error: "experience review cannot return needs-agent" };
  }
  const dependencies = admitted.result.dependencies ?? [];
  if (dependencies.length > 1) {
    return {
      ok: false,
      error: "experience review may delegate at most one bounded goal",
    };
  }
  if (
    dependencies.some(
      (dependency) =>
        dependency.appId !== "scout-knowledge-lib" ||
        dependency.input.kind !== "goal",
    )
  ) {
    return {
      ok: false,
      error:
        "experience review delegates bounded work through Scout goal input",
    };
  }
  return { ok: true, result: admitted.result };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Read only the two admitted owner-request shapes; do not recursively infer intent. */
export function isExperienceReview(ctx: WorkflowContext): boolean {
  return Boolean(
    ctx.reconciliation?.events.items.some(({ event }) => {
      const data = record(event.data);
      if (data.reason === "experience-review") return true;
      if (event.type !== "app.task.requested") return false;
      const request = record(data.request);
      const input = record(request.input);
      const inputData = record(input.data);
      return (
        input.kind === "owner-review" &&
        inputData.reason === "experience-review"
      );
    }),
  );
}

export const name = "knowledge-planner";
export const description =
  "Scout knowledge-library planner. Reviews current task resources and performs the smallest useful library maintenance step.";

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  if (!ctx.workspace || !ctx.reconciliation) {
    return ctx.blocked(
      "Scout maintenance requires a canonical App task context",
    );
  }
  const appDir = ctx.workspace.appRoot;
  const beforePublication = snapshotKnowledge(
    ctx.workspace.projectRoot,
    ctx.workspace.output,
  );
  const candidateFailureDetails = () => ({
    candidateFacts: retainedCandidateFacts(beforePublication),
    uncommittedChanges: changedKnowledgePaths(beforePublication),
  });
  const projectDir = beforePublication.projectRoot;
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
- Final canonical library root (link destination only): ${beforePublication.canonicalProjectRoot}

Edit durable content only in the supplied domain workspace candidate. Use the
final canonical root for links from the working digest or other workspaces,
and relative links within library notes. Return candidate output paths for
verification. The workflow commits accepted bytes and returns canonical paths;
do not run Git publication or edit the canonical library in this call.

Your job in this workflow is not a freeform heartbeat. Review the bounded task
resource context, understand the trigger, and do the smallest useful maintenance
step.

Start by reading:
- ${appDir}/project.json
- ${appDir}/tasks/README.md
- the bounded reconciliation packet below
- ${projectDir}/README.md
- ${projectDir}/knowledge/README.md

Open ${projectDir}/knowledge/INDEX.md only when the trigger does not identify
the relevant file or an exhaustive file map is necessary. Open
${projectDir}/knowledge/xhs-topic-map.md only when choosing among ranked
unresolved questions or source-lane evidence gaps. Do not load either large
artifact merely as a heartbeat.

Valid durable outcomes:
- update an existing knowledge note to reduce duplication or improve reuse
- create or update ${projectDir}/knowledge/README.md as a short human landing page
- repair ${projectDir}/knowledge/INDEX.md navigation
- add a source-grounded finding only when no existing note fits
- write a compact report under ${projectDir}/reports/
- move a small verified report batch into reports/health, reports/merge,
  reports/triage, reports/migration, or reports/operations
- revise an existing child assignment or delegate a bounded Scout goal when independent work is useful

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
- Treat every path previously returned in Task/workflow evidence as a published
  interface. Do not move or rename that file during maintenance. Improve its
  title or add index navigation while keeping the exact delivered path readable.
- today.md is a mutable accumulator, not an archive. The daily workflow preserves
  a snapshot and clears the accumulator after recording its handoff to May.
  Before repairing missing digest content, read the daily-digest Task and its retained snapshot.
  A prior source Task's output path is not proof that the highlight must still be in today.md.
  Do not re-add a highlight merely because handoff cleared it. Continue other
  useful maintenance or record a no-op instead. Snapshot existence alone does
  not prove handoff or provider delivery; inspect the corresponding evidence
  when that is the question.
- When compacting duplicated material into one authoritative note, leave an
  inline relative link at the omission point to the exact retained heading. A
  file-level mention elsewhere is not a substitute; verify the link after the
  edit.
- Treat /app/shared/knowledge as external source material. Link, summarize, or
  promote only durable reusable knowledge; do not bulk-copy the corpus.
- Keep source-grounded <ai_context> preambles where the library already uses them.
- Do not bulk-edit just to improve a metric.
- Do not create ceremonial project/control tasks.
- The Host is the sole task-state mutation authority. Never edit task JSON,
  call private task mutation commands, or write task state through a database.
  Return changes to existing child Tasks through typed actions in \`finish\`.
  For independent work, return \`waiting\` with at most one dependency:
  {id: "stable-purpose", appId: "scout-knowledge-lib", input: {kind: "goal",
  data: {outcome: "bounded result", acceptance: ["proof required"], context: "relevant facts and constraints"}}}.
  Never return create-task or close-task actions. Do not rewrite your own assignment.
- Current task evidence comes from the reconciliation packet and supported
  task reads. Retained tasks/state.json and tasks/tree.json files are historical,
  not current health signals. Do not request a publisher to refresh them or
  let obsolete projection-repair work block independent library maintenance.
  Explain obsolete acceptance and request a stop or scope correction; never
  claim a retired artifact was regenerated.
- Existing-task actions require the exact generation in the supplied context. Never
  mutate task ids beginning with \`runtime/\`.
- You may edit Scout-owned knowledge and report files, plus the working digest,
  when that is the smallest useful domain step. Task actions describe the
  durable organization change; they are not a substitute for evidence that the
  domain change happened.
- If no useful library or organization change is warranted, return an empty
  actions array with the exact reason.
- Finish with the fields allowed for your state: summary and facts, actions
  only where the result schema permits them. Use \`converged\` after the bounded work, and
  \`waiting\` only for delegated work or an identified fact with a known return route.
  A missing prerequisite with no return route is an unsuccessful \`incomplete\` report
  with evidence and the help needed. It does not close the Task: Runtime retries
  unfinished work with backoff. An accepted outcome also leaves the Task open
  until its assigning owner closes it.

${experienceContext}

## Canonical reconciliation context
${JSON.stringify(ctx.reconciliation, null, 2)}`.trim();

  const result = await ctx.agents.call("scout", prompt, {
    timeoutMs: 1_800_000,
    schema: taskAgentResultSchema,
  });
  if (result.status !== "done") {
    return ctx.blocked("Scout owner maintenance session failed", {
      executionId: result.id,
      status: result.status,
      summary: result.summary,
      ...candidateFailureDetails(),
    });
  }

  const finish = result.facts;
  if (
    finish &&
    typeof finish === "object" &&
    "status" in finish &&
    finish.status === "partial"
  ) {
    return ctx.blocked("Scout owner maintenance is incomplete", {
      executionId: result.id,
      summary: result.summary,
      finish,
      ...candidateFailureDetails(),
    });
  }
  const admitted = admitTaskReconcileResult(result.output, {
    allowNeedsAgent: false,
  });
  if (!admitted.ok || admitted.result.state === "needs-agent") {
    return ctx.blocked("Scout owner maintenance returned an invalid result", {
      executionId: result.id,
      error: admitted.ok ? "needs-agent is not accepted" : admitted.error,
      ...candidateFailureDetails(),
    });
  }
  let agentResult = admitted.result as AgentResult;
  if (experienceReview) {
    const reviewed = admitExperienceReviewResult(agentResult);
    if ("error" in reviewed) {
      return ctx.blocked(
        `Scout experience review result was rejected: ${reviewed.error}`,
        { executionId: result.id, ...candidateFailureDetails() },
      );
    }
    agentResult = reviewed.result;
  }
  let publication;
  try {
    const reportedOutputs = (agentResult.facts ?? [])
      .filter((fact) => fact.startsWith("output:"))
      .map((fact) => fact.slice("output:".length).trim());
    publication = publishKnowledgeChanges(beforePublication, {
      executionId: result.id,
      summary: agentResult.summary,
      reportedOutputs,
    });
  } catch (error) {
    return ctx.blocked("Scout maintenance was not published", {
      executionId: result.id,
      error: error instanceof Error ? error.message : String(error),
      ...candidateFailureDetails(),
    });
  }
  agentResult = {
    ...agentResult,
    facts: [
      ...(agentResult.facts ?? []).filter(
        (fact) => !fact.startsWith("output:"),
      ),
      ...publication.outputs.map((path) => `output:${path}`),
      ...publicationFacts(publication),
    ] as [string, ...string[]],
  };
  const maintenanceFact = {
    project: "scout-knowledge-lib",
    summary: agentResult.summary,
    state: agentResult.state,
    proposedActions: agentResult.actions ?? [],
    proposedDependencies: agentResult.dependencies ?? [],
    facts: agentResult.facts,
  };
  try {
    await ctx.events.emit({
      type: "project.knowledge.maintained",
      localKey: taskEmissionKey(ctx, "knowledge-maintained", maintenanceFact),
      target: { appId: "scout-knowledge-lib", project: "scout-knowledge-lib" },
      data: maintenanceFact,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Idempotency key") && message.includes("different")) {
      return ctx.blocked(
        "Knowledge maintenance emission has a deterministic idempotency conflict and requires repair rather than immediate retry",
        { error: message },
      );
    }
    throw error;
  }
  return ctx.done(agentResult.summary, agentResult);
}
