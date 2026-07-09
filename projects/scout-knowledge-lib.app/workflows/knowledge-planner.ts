import {
  resolveTaskTreePath,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

function field(task: string, name: string): string | undefined {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "m");
  return task.match(pattern)?.[1]?.trim();
}

function triggerBlock(task: string): string {
  return task.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";
}

function resultSummary(result: unknown): string {
  if (!result || typeof result !== "object") return String(result);
  const record = result as {
    summary?: unknown;
    message?: unknown;
    status?: unknown;
  };
  const text = record.summary ?? record.message ?? JSON.stringify(result);
  return typeof text === "string" ? text : JSON.stringify(text);
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
- update the task tree when project understanding or next work changes

Health-signal closure rules:
- If the trigger contains library-health signals, do not only update a broad
  parent task. For each P1 signal, either update/create one concrete child task
  with current evidence and next action, or record an exact accepted no-op
  reason.
- Treat future-dated project/library content as a time-trust repair before
  doing more synthesis. Correct the date when it is wrong; otherwise record why
  the future date is intentional.
- If a repeated-library-health-signal appears, inspect the matching task. If the
  task is real, refresh it with current facts and a next action. If no concrete
  task exists, create one.
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
- If no useful library change is warranted, update the task tree or finish with
  the exact reason.

${triggerBlock(ctx.task)}`.trim();

  const result = await ctx.runAgent("scout", prompt);
  const summary = resultSummary(result);
  ctx.emit({
    type: "project.knowledge.maintained",
    project: "scout-knowledge-lib",
    summary,
  });
  return ctx.done(summary);
}
