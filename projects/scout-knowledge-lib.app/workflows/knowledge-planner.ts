import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

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
- ${appDir}/tasks/tree.json
- ${projectDir}/README.md
- ${projectDir}/knowledge/INDEX.md

Valid durable outcomes:
- update an existing knowledge note to reduce duplication or improve reuse
- repair ${projectDir}/knowledge/INDEX.md navigation
- add a source-grounded finding only when no existing note fits
- write a compact report under ${projectDir}/reports/
- update ${appDir}/tasks/tree.json when project understanding or next work changes

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
