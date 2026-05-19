/**
 * E2E fixture iteration workflow (lite, no LLM).
 *
 * Reads project.md, advances an iteration counter in frontmatter, round-trips a
 * multi-line `stop_reason` value through SDK's project-schema encode/decode
 * (Bug E regression surface), and writes back. No agent calls.
 *
 * Used by e3a-project-iteration-loop.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseProjectMeta,
  updateProjectField,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

export const name = "e2e-iteration-stub";
export const description = "Fixture iteration workflow for e2e tests (no LLM).";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Task is expected to be "iterate <projectId>".
  const m = ctx.task.match(/^iterate\s+(\S+)/);
  if (!m) return ctx.done("e2e-iteration-stub: bad task; expected 'iterate <projectId>'");

  const projectId = m[1];
  const projectFile = join(ctx.projectsRoot, projectId, "project.md");

  let content = readFileSync(projectFile, "utf-8");
  const meta = parseProjectMeta(content);

  // Round-trip stop_reason — proves Bug E fix works through SDK.
  const stopReason = meta.stop_reason ?? "fresh";
  // The very act of read → write should leave the value byte-for-byte intact
  // for round-trippable shapes (single-line or quoted multi-line).
  content = updateProjectField(content, "stop_reason", stopReason);

  // Advance iteration counter.
  const current = parseInt(meta.iteration ?? "0", 10) || 0;
  const next = current + 1;
  content = updateProjectField(content, "iteration", String(next));

  writeFileSync(projectFile, content, "utf-8");

  ctx.emit({
    type: "e2e.iteration.complete",
    projectId,
    iteration: next,
    stop_reason_len: stopReason.length,
  });

  return ctx.done(`e2e-iteration-stub completed iteration ${next} for ${projectId}`);
}
