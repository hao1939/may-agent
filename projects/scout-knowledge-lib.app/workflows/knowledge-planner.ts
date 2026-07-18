import {
  resolveTaskTreePath,
  type ProjectAppTaskHandlerResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

const nonEmptyString = { type: "string", minLength: 1 } as const;
const stringList = {
  type: "array",
  minItems: 1,
  items: nonEmptyString,
} as const;
const expectedRevision = { type: "integer", minimum: 0 } as const;

const ownerResultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["disposition", "summary", "evidence", "actions"],
  properties: {
    disposition: {
      type: "string",
      enum: ["converged", "progressing", "waiting"],
    },
    summary: nonEmptyString,
    evidence: {
      type: "array",
      maxItems: 12,
      items: nonEmptyString,
    },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "id",
              "parentId",
              "goal",
              "outputs",
              "acceptance",
            ],
            properties: {
              kind: { const: "create-task" },
              id: nonEmptyString,
              parentId: nonEmptyString,
              goal: nonEmptyString,
              outputs: stringList,
              acceptance: stringList,
              priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
              owner: nonEmptyString,
              workflow: nonEmptyString,
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "taskId", "expectedRevision"],
            properties: {
              kind: { const: "update-task" },
              taskId: nonEmptyString,
              expectedRevision,
              goal: nonEmptyString,
              outputs: stringList,
              acceptance: stringList,
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "taskId", "expectedRevision", "summary"],
            properties: {
              kind: { const: "close-task" },
              taskId: nonEmptyString,
              expectedRevision,
              summary: nonEmptyString,
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "taskId", "expectedRevision", "reason"],
            properties: {
              kind: { const: "unblock-task" },
              taskId: nonEmptyString,
              expectedRevision,
              reason: nonEmptyString,
            },
          },
        ],
      },
    },
    conditions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "observer"],
        properties: {
          id: nonEmptyString,
          observer: nonEmptyString,
          taskId: nonEmptyString,
          expectedState: nonEmptyString,
          fallback: nonEmptyString,
        },
      },
    },
  },
} as const;

type OwnerResult = ProjectAppTaskHandlerResult & {
  disposition: "converged" | "progressing" | "waiting";
};

function field(task: string, name: string): string | undefined {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "m");
  return task.match(pattern)?.[1]?.trim();
}

function triggerBlock(task: string): string {
  return task.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";
}

export const name = "knowledge-planner";
export const description =
  "Scout knowledge-library planner. Reviews the project task tree and performs the smallest useful library maintenance step.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir =
    field(ctx.task, "app") ?? "/app/projects/scout-knowledge-lib.app";
  const projectDir =
    field(ctx.task, "project") ?? "/app/projects/scout-knowledge-lib";
  const taskTreePath = resolveTaskTreePath(appDir);
  const prompt =
    `You are Scout maintaining the Scout Knowledge Library as a project.

The old heartbeat-owned library has been extracted into a V3 project:
- Domain workspace: ${projectDir}
- App/control plane: ${appDir}
- Durable library: ${projectDir}/knowledge
- External shared corpus: /app/shared/knowledge

Your job in this workflow is not a freeform heartbeat. Review the project task
tree, understand the trigger, and do the smallest useful maintenance step.

Start by reading:
- ${appDir}/project.json
- ${taskTreePath}
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
- If the trigger contains library-health signals, do not only refresh a broad
  parent task. For each P1 signal, either propose one concrete child-task action
  with current evidence and next action, or record an exact accepted no-op reason.
- Treat future-dated project/library content as a time-trust repair before
  doing more synthesis. Correct the date when it is wrong; otherwise record why
  the future date is intentional.
- If a repeated-library-health-signal appears, inspect the matching task. If the
  task is real, propose an update with current facts and a next action. If no
  concrete task exists, propose one.
- A bare active task with only a next_action is not closure. When a represented
  health task lacks progress evidence, do one small concrete library step or
  record the exact reason it cannot move yet.
- If the trigger contains active-task-not-moving, inspect each named task and
  finish one of these outcomes: make a small domain change and record evidence,
  close the task with result, or escalate with the exact blocker and waiting
  condition.
- If oversized notes are intentionally tolerated, record that per note with the
  reason. Do not let tolerated notes keep firing as unexplained drift.
- If unsourced backlog keeps growing, select a small batch or record the exact
  capacity blocker and next batch target.
- If human-navigation-missing appears, create knowledge/README.md first. Keep it
  short and human-facing; do not duplicate the full INDEX.
- If reports-layout-backlog appears, move only one small report batch and update
  references. Do not reorganize the whole library in one pass.

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
- Existing-task actions require the exact revision shown in the tree. Never
  mutate or create task ids beginning with \`runtime/\`.
- You may edit Scout-owned knowledge and report files when that is the smallest
  useful domain step. Task actions describe the durable organization change;
  they are not a substitute for evidence that the domain change happened.
- If no useful library or organization change is warranted, return an empty
  actions array with the exact reason.
- Finish with disposition, summary, evidence, actions, and exact Conditions when
  waiting. Use \`progressing\` when a useful step landed but more work remains,
  \`converged\` when no further action is needed now, and \`waiting\` only for an
  identified external fact.

${triggerBlock(ctx.task)}`.trim();

  const result = await ctx.runAgent("scout", prompt, {
    timeoutMs: 1_800_000,
    schema: ownerResultSchema as never,
  });
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Scout owner maintenance session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }

  const ownerResult = result.structuredResult as unknown as OwnerResult;
  ctx.emit({
    type: "project.knowledge.maintained",
    project: "scout-knowledge-lib",
    summary: ownerResult.summary,
    disposition: ownerResult.disposition,
    proposedActions: ownerResult.actions ?? [],
    evidence: ownerResult.evidence,
  });
  return ctx.done(ownerResult.summary, ownerResult);
}
