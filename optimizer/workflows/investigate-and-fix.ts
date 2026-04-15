/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * investigate-and-fix — Three-phase workflow: Investigate → Fix → Verify
 *
 * Phase 1: Run the agent to investigate the issue and produce findings
 * Phase 2: Execute the top recommendation from findings
 * Phase 3: Verify the fix was applied correctly
 *
 * Supports early exit via:
 *   - NO_ACTION_NEEDED: Investigation found nothing to fix
 *   - DISPATCH-READY: Finding requires different agent/human action
 *
 * Escalates when:
 *   - Phase 1 fails
 *   - Phase 2 fails or produces no real file changes
 *   - Fix files don't exist on disk
 */

import { existsSync, readFileSync, statSync } from "node:fs";

// ── Workflow metadata ─────────────────────────────────────────────────

export const name = "investigate-and-fix";
export const description =
  "Three-phase workflow to investigate an issue, apply a fix, and verify the result. " +
  "Phase 1 investigates and writes a finding file. Phase 2 executes the fix. " +
  "Phase 3 verifies the fix was applied correctly.";

// ── Helpers ───────────────────────────────────────────────────────────

/** Extract written file paths from task result messages */
function extractWrittenFiles(result: TaskResult): Array<{ path: string; tool: string }> {
  const files: Array<{ path: string; tool: string }> = [];
  if (!result.messages) return files;

  for (const msg of result.messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "toolCall" && (part.name === "write" || part.name === "edit")) {
        if (part.arguments?.path) {
          files.push({ path: part.arguments.path, tool: part.name });
        }
      }
    }
  }
  return files;
}

/** Check if a file exists and has content */
function fileExistsWithContent(path: string): boolean {
  try {
    if (!existsSync(path)) return false;
    const stat = statSync(path);
    return stat.size > 0;
  } catch {
    return false;
  }
}

// ── Execute ───────────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Phase 1: Investigate ────────────────────────────────────────────
  ctx.emit({ type: "step_start", step: "phase1-investigate" } as WorkflowEvent);

  const phase1Task = `Phase 1: INVESTIGATE ONLY — do NOT make changes yet.\n\n${ctx.task}\n\nWrite your findings to a file named finding-*.md in your workspace. Include:\n- What you found\n- Root cause analysis\n- Numbered recommendations (R1, R2, etc.)\n\nIf nothing needs fixing, include "NO_ACTION_NEEDED" in your response.\nIf this needs to be dispatched to another agent, include "DISPATCH-READY" in your response.`;

  const phase1Result = await ctx.runAgent(ctx.agent, phase1Task);
  ctx.emit({ type: "step_done", step: "phase1-investigate", result: phase1Result } as WorkflowEvent);

  if (phase1Result.status === "error") {
    return ctx.escalate("Phase 1 (investigate) failed", { phase1Result });
  }

  const phase1Text = phase1Result.lastAssistantText ?? "";
  const phase1Summary = ctx.summarize(phase1Result);
  const phase1Files = extractWrittenFiles(phase1Result);

  // Check for NO_ACTION_NEEDED
  if (phase1Text.includes("NO_ACTION_NEEDED")) {
    if (phase1Files.length === 0) {
      return ctx.escalate("Phase 1 said NO_ACTION_NEEDED but didn't write a finding file");
    }
    return ctx.done(`Phase 1 complete — no action needed. ${phase1Summary}`);
  }

  // Check for DISPATCH-READY
  if (phase1Text.includes("DISPATCH-READY")) {
    if (phase1Files.length === 0) {
      return ctx.escalate("Phase 1 said DISPATCH-READY but didn't write a finding file");
    }
    return ctx.done(`Phase 1 complete — dispatched for external action. ${phase1Summary}`);
  }

  // ── Phase 2: Fix ───────────────────────────────────────────────────
  ctx.emit({ type: "step_start", step: "phase2-fix" } as WorkflowEvent);

  const phase2Task = `Phase 2: EXECUTE THE FIX based on Phase 1 findings.\n\nPhase 1 findings:\n${phase1Summary}\n\nExecute your TOP recommendation. Make real code/config changes — not just documentation.\n\nDo NOT just update finding files. Modify the actual source files that need fixing.`;

  const phase2Result = await ctx.runAgent(ctx.agent, phase2Task);
  ctx.emit({ type: "step_done", step: "phase2-fix", result: phase2Result } as WorkflowEvent);

  if (phase2Result.status === "error") {
    return ctx.escalate("Phase 2 (fix) failed", { phase2Result });
  }

  const phase2Files = extractWrittenFiles(phase2Result);
  const phase1Paths = new Set(phase1Files.map((f) => f.path));

  // Check that Phase 2 wrote files beyond the finding file
  const newFiles = phase2Files.filter((f) => !phase1Paths.has(f.path));
  if (newFiles.length === 0) {
    return ctx.escalate("Phase 2 did not modify any files beyond the finding file", { phase2Files, phase1Paths: [...phase1Paths] });
  }

  // Verify fix files exist on disk
  const missingFiles = newFiles.filter((f) => !fileExistsWithContent(f.path));
  if (missingFiles.length > 0 && missingFiles.length === newFiles.length) {
    return ctx.escalate(`Phase 2 fix files missing or empty: ${missingFiles.map((f) => f.path).join(", ")}`, { missingFiles });
  }

  // ── Phase 3: Verify ────────────────────────────────────────────────
  ctx.emit({ type: "step_start", step: "phase3-verify" } as WorkflowEvent);

  const phase2Summary = ctx.summarize(phase2Result);
  const verifiedFiles = newFiles.filter((f) => fileExistsWithContent(f.path));

  ctx.emit({
    type: "step_done",
    step: "phase3-verify",
    result: phase2Result,
  } as WorkflowEvent);

  // Build final summary
  const summary = [
    `Phase 1: Finding — ${phase1Summary.slice(0, 100)}`,
    `Phase 2: Fix applied — ${verifiedFiles.length} file(s) modified`,
    `Phase 3: Verification ✅ — ${verifiedFiles.map((f) => f.path.split("/").pop()).join(", ")}`,
  ].join("\n");

  return ctx.done(summary);
}
