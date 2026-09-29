import {
  admitTaskReconcileResult,
  taskAgentResultSchema,
  type ExecutionResult,
  type TaskReconcileResult,
  type TaskVerificationContext,
  type TaskVerificationResult,
  type WorkflowContext,
} from "@may-agent/sdk";
import { taskEmissionKey } from "./lib/task-emission.js";
import {
  acceptedPublicationRecovery,
  retainAcceptedPublication,
  type AcceptedPublicationRecovery,
} from "./lib/accepted-publication.js";
import { emitQualifiedResearchHandoff } from "./lib/research-adoption-handoff.js";
import {
  changedKnowledgePaths,
  KnowledgePublicationError,
  publicationFacts,
  publishKnowledgeChanges,
  retainedCandidateFacts,
  snapshotKnowledge,
  verifyAcceptedPublicationAtCanonicalHead,
  verifyArchivedCandidateAtCanonicalHead,
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

function procedureContext(input: unknown, taskInput: unknown): string {
  if (
    input === undefined ||
    input === null ||
    input === "" ||
    (Array.isArray(input) && input.length === 0) ||
    (typeof input === "object" &&
      !Array.isArray(input) &&
      Object.keys(record(input)).length === 0)
  )
    return "";
  const rendered = JSON.stringify(input, null, 2);
  if (!rendered || rendered === JSON.stringify(taskInput, null, 2)) return "";
  return `## Caller procedure context (advisory)\n${rendered}\n\nThis may describe how to perform the bounded attempt, but it does not amend or override the canonical Task outcome, acceptance, constraints, or retained waits.`;
}

async function recoveryTaskContext(
  ctx: WorkflowContext,
  recovery: AcceptedPublicationRecovery | undefined,
): Promise<string> {
  if (!recovery || !ctx.reconciliation) return "";
  const previousAttempt = ctx.reconciliation.previousAttempt ?? null;
  let currentTask: unknown;
  let readStatus = "available";
  try {
    currentTask = await ctx.read.tasks.get(ctx.reconciliation.taskId);
    if (record(currentTask).id !== ctx.reconciliation.taskId) {
      currentTask = null;
      readStatus = "unavailable: current Task did not match the requested id";
    }
  } catch (error) {
    currentTask = null;
    readStatus = `unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
  const task = record(currentTask);
  return `## Accepted-publication recovery evidence
Archive descriptor:
${JSON.stringify(recovery, null, 2)}

Exact current Task read (${readStatus}):
${JSON.stringify(
  currentTask
    ? {
        id: task.id,
        status: task.status,
        generation: task.generation,
        summary: task.summary,
        facts: task.facts,
        result: task.result,
        conditions: task.conditions,
      }
    : null,
  null,
  2,
)}

Previous attempt link from the reconciliation packet:
${JSON.stringify(previousAttempt, null, 2)}`;
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

function publicationFailureHandoff(
  error: unknown,
  executionId: string,
  recovery: AcceptedPublicationRecovery,
  result: AgentResult,
): Extract<TaskReconcileResult, { state: "needs-agent" }> | undefined {
  if (!(error instanceof KnowledgePublicationError)) return undefined;
  const publication = error;
  return {
    state: "needs-agent",
    summary:
      "Publication failed after Scout returned; the native Task owner must judge the retained failure and unpublished candidate.",
    facts: [
      `publication:failed:${publication.message}`,
      `writer-execution:${executionId}`,
      `accepted-archive-ref:${recovery.ref}`,
      `accepted-archive-revision:${recovery.revision}`,
      `accepted-archive-paths:${JSON.stringify(recovery.changedPaths)}`,
      ...(publication.candidateRef
        ? [`unpublished-candidate-ref:${publication.candidateRef}`]
        : []),
      ...(publication.candidateRevision
        ? [`unpublished-candidate-revision:${publication.candidateRevision}`]
        : []),
      ...(publication.candidateBase
        ? [`unpublished-candidate-base:${publication.candidateBase}`]
        : []),
      `unpublished-candidate-paths:${JSON.stringify(publication.changedPaths)}`,
      "publication:unverified",
      `unaccepted-workflow-result:${JSON.stringify(result)}`,
    ],
  };
}

export async function verify(
  context: TaskVerificationContext,
  result: TaskReconcileResult,
): Promise<TaskVerificationResult> {
  if (result.state !== "converged") {
    return {
      accepted: true,
      summary:
        "Only converged planner results require publication verification.",
      facts: [],
    };
  }
  const recovery = acceptedPublicationRecovery(context.intent.input);
  if (!recovery) {
    return {
      accepted: true,
      summary: "This result is outside accepted-publication recovery.",
      facts: [],
    };
  }
  try {
    const facts = verifyAcceptedPublicationAtCanonicalHead(
      context.projectRoot,
      recovery,
      result.facts ?? [],
    );
    return {
      accepted: true,
      summary: "Accepted Scout publication is present at canonical HEAD.",
      facts,
    };
  } catch (error) {
    return {
      accepted: false,
      summary: `Accepted Scout publication remains unverified: ${error instanceof Error ? error.message : String(error)}`,
      facts: ["accepted-publication:verification-failed"],
    };
  }
}

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
  const recovery = acceptedPublicationRecovery(ctx.reconciliation.input);
  const recoveryContext = await recoveryTaskContext(ctx, recovery);
  const callerProcedureContext = procedureContext(
    ctx.input,
    ctx.reconciliation.input,
  );
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
- Final canonical library root (read-only observation and final link destination): ${beforePublication.canonicalProjectRoot}

Edit durable content only in the supplied domain workspace candidate. The
canonical root may be inspected with non-mutating checks, but it is never a
write target for this bounded call. Candidate editability does not prove that
the publisher can replace the corresponding canonical destination. Use the
canonical root for links from the working digest or other workspaces, and
relative links within library notes. Return candidate output paths for
verification. The workflow commits accepted bytes and returns canonical paths;
do not probe-write, overwrite in place, change permissions or mounts, run Git
publication, or otherwise edit the canonical library in this call.

Your job in this workflow is not a freeform heartbeat. Review the bounded task
resource context, understand the trigger, and do the smallest useful maintenance
step.
${
  recovery
    ? `\nThis is recovery of accepted publication ${recovery.revision}. Read the exact archived tree at ${recovery.ref}; the temporary worktree is not authoritative. Before choosing a destination, inspect the retained publication failure below and, when needed, the exact canonical destination with non-mutating checks. A writable candidate copy is not evidence that canonical replacement will succeed. Do not retry an unchanged protected destination merely because archive restoration succeeds in the candidate. Preserve source fidelity through a Scout-judged suitable writable adaptation that explains how it delivers this accepted candidate, or return a supported human-owned Condition when a concrete human decision is actually necessary. Prefer a narrow linked addendum when it fits; do not rename or duplicate the protected original. A no-change result is sufficient only when canonical HEAD already contains every archived byte.\n`
    : ""
}
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
- When one newly published source record is plausibly applicable to this local
  May installation, optionally return result.researchRecommendation with
  sourceUrl, sourceRevision, artifact, claim, limits, possibleApplication, and
  optional relatedWork. Use the exact canonical output path; code verifies the
  published path and computes its SHA-256. Qualification asks Bob to investigate;
  it does not request implementation, represent Evaluation, or approve a change.
  Do not qualify every finding or repeat an unchanged source revision.
- Finish with the fields allowed for your state: summary and facts, actions
  only where the result schema permits them. Use \`converged\` after the bounded work, and
  \`waiting\` only for delegated work or an identified fact with a known return route.
  A missing prerequisite with no return route is an unsuccessful \`incomplete\` report
  with evidence and the help needed. It does not close the Task: Runtime retries
  unfinished work with backoff. An accepted outcome also leaves the Task open
  until its assigning owner closes it.

${callerProcedureContext}

${recoveryContext}

${experienceContext}

## Canonical reconciliation context (authoritative requirement)
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
    const retained =
      agentResult.state === "incomplete"
        ? undefined
        : retainAcceptedPublication(error, {
            summary:
              "Scout maintenance was accepted and retained for publication recovery.",
            facts: [
              `execution:${result.id}`,
              ...(agentResult.facts ?? []).filter(
                (fact) => !fact.startsWith("output:"),
              ),
            ],
            acceptedWaiting:
              agentResult.state === "waiting" ? agentResult : undefined,
            recovery,
          });
    if (retained) return ctx.done(retained.summary, retained);
    if (recovery) {
      const handoff = publicationFailureHandoff(
        error,
        result.id,
        recovery,
        agentResult,
      );
      if (handoff) return ctx.done(handoff.summary, handoff);
    }
    return ctx.blocked("Scout maintenance was not published", {
      executionId: result.id,
      error: error instanceof Error ? error.message : String(error),
      ...candidateFailureDetails(),
    });
  }
  let recoveryFacts: string[] = [];
  if (recovery) {
    try {
      recoveryFacts = verifyArchivedCandidateAtCanonicalHead(
        beforePublication,
        recovery,
      );
    } catch (error) {
      const evidence = `accepted-publication:still-pending:${recovery.revision}:${error instanceof Error ? error.message : String(error)}`;
      if (
        publication.state === "committed" &&
        agentResult.state === "converged"
      ) {
        // A committed adaptation is complete only when Scout explicitly accepts
        // it. Code records the real commit; it does not make the semantic call.
        recoveryFacts = [
          `accepted-publication:adapted:${recovery.revision}`,
          `accepted-publication:delivered-by:${publication.commit}`,
        ];
      } else if (agentResult.state === "waiting") {
        return ctx.done(agentResult.summary, {
          ...agentResult,
          facts: [
            evidence,
            ...(agentResult.facts ?? []).filter(
              (fact) => !fact.startsWith("output:"),
            ),
            ...publicationFacts(publication),
          ],
        });
      } else {
        return ctx.done("Accepted Scout publication remains undelivered.", {
          state: "incomplete",
          summary: "Accepted Scout publication remains undelivered.",
          facts: [evidence, ...publicationFacts(publication)],
        });
      }
    }
  }
  agentResult = {
    ...agentResult,
    facts: [
      ...(agentResult.facts ?? []).filter(
        (fact) => !fact.startsWith("output:"),
      ),
      ...publication.outputs.map((path) => `output:${path}`),
      ...publicationFacts(publication),
      ...recoveryFacts,
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

  try {
    const emitted = await emitQualifiedResearchHandoff(
      ctx.events.emit.bind(ctx.events),
      agentResult.result,
      publication.outputs,
    );
    if (emitted) {
      agentResult = {
        ...agentResult,
        facts: [...agentResult.facts, "research-handoff:may"],
      } as unknown as AgentResult;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    agentResult = {
      ...agentResult,
      facts: [...agentResult.facts, `research-handoff:deferred:${message}`],
    } as unknown as AgentResult;
  }
  return ctx.done(agentResult.summary, agentResult);
}
