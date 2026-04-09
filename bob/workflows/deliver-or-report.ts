/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * deliver-or-report workflow — Anti-Non-Delivery Guard
 *
 * Addresses FM-3.1 (non-delivery / task incompletion) by splitting work
 * into two mechanically separate phases:
 *
 * Phase 1 — Analyze & Plan: Read context, produce a concrete plan
 *   specifying exactly which deliverable file(s) will be written.
 *
 * Phase 2 — Execute & Deliver: Receive the plan, write the deliverable(s).
 *   If a write fails, retry with alternative approach.
 *   Must produce at least one artifact on disk.
 *
 * The structural separation prevents analysis paralysis (Mode A) because
 * Phase 2's ONLY job is to write. The retry mandate prevents failure
 * non-recovery (Mode B) because Phase 2 explicitly retries on write errors.
 *
 * Input: The original task string (passed through as ctx.task).
 */

import { existsSync } from "node:fs";

export const name: string = "deliver-or-report";

export const description: string =
  "Multi-phase delivery workflow. Phase 1: analyze and plan (identify " +
  "deliverables). Phase 2: write deliverables to disk. Phase 2b: " +
  "retry any missing deliverables (auto-triggered when Phase 2 misses " +
  "planned files). Phase 3: verify ALL planned files exist. Prevents " +
  "non-delivery (FM-3.1) and partial-delivery (FM-2.6).";

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract file paths mentioned in text (looks for common patterns like
 * `workspace/...`, `agents/...`, backtick-quoted paths, etc.)
 */
function extractFilePaths(text: string): string[] {
  const patterns = [
    /`([a-zA-Z0-9_./-]+\.[a-zA-Z]{1,5})`/g,              // `path/to/file.ext`
    /(?:write|create|update|produce|output)[^`]*`([^`]+)`/gi, // write to `file`
    /((?:workspace|agents|knowledge|skills)\/[a-zA-Z0-9_./-]+)/g,  // workspace/... paths
  ];

  const paths = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const p = match[1].trim();
      // Filter out obvious non-paths
      if (p.length > 3 && p.includes("/") && !p.startsWith("http")) {
        paths.add(p);
      }
    }
  }
  return [...paths];
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Analyze & Plan
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase1-analyze" });

  const phase1Prompt =
    `## Phase 1: Analyze & Plan (DO NOT WRITE DELIVERABLES YET)\n\n` +
    `### Task\n${ctx.task}\n\n` +
    `### Instructions\n` +
    `Your job in this phase is ONLY to analyze and plan. Do NOT write any deliverable files yet.\n\n` +
    `1. Read all necessary context files to understand the task.\n` +
    `2. Determine exactly what deliverable(s) must be produced.\n` +
    `3. For each deliverable, specify:\n` +
    `   - The exact file path where it will be written\n` +
    `   - A brief outline of what it should contain\n` +
    `4. Output your plan in this format:\n\n` +
    `\`\`\`\n` +
    `DELIVERABLES:\n` +
    `1. [file path] — [what it contains]\n` +
    `2. [file path] — [what it contains]\n` +
    `\n` +
    `PLAN:\n` +
    `[Step-by-step plan for Phase 2 to execute]\n` +
    `\`\`\`\n\n` +
    `⚠️ Do NOT call write() or edit() on deliverable files in this phase.\n` +
    `   You MAY read files. You MAY write scratch notes to agents/bob/workspace/ if helpful.\n` +
    `   Phase 2 will handle all deliverable writing.`;

  const phase1 = await ctx.runAgent("bob", phase1Prompt);
  if (phase1.status === "error") {
    return ctx.escalate("Phase 1 (analyze) failed", { error: phase1.error });
  }

  const planText = phase1.lastAssistantText ?? "";
  const plannedFiles = extractFilePaths(planText);

  ctx.emit({ type: "step_done", step: "phase1-analyze" } as any);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Execute & Deliver
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase2-deliver" });

  const phase2Prompt =
    `## Phase 2: Write Deliverables NOW\n\n` +
    `### Original Task\n${ctx.task}\n\n` +
    `### Plan from Phase 1\n${planText}\n\n` +
    `### Instructions — YOUR ONLY JOB IS TO WRITE THE DELIVERABLES\n` +
    `You have already analyzed the task in Phase 1. The plan is above.\n` +
    `Now execute it:\n\n` +
    `1. Write each deliverable file listed in the plan.\n` +
    `2. After each write/edit call, verify it succeeded (read back the file).\n` +
    `3. If a write fails:\n` +
    `   - Try \`edit()\` with exact text match\n` +
    `   - If edit fails, try \`write()\` with full content\n` +
    `   - If write fails, try \`bash("cat > filepath << 'ENDOFFILE'\\n...\\nENDOFFILE")\`\n` +
    `   - If ALL fail, report exactly what failed and why.\n` +
    `4. Do NOT spend time re-analyzing. The analysis is done. WRITE.\n` +
    `5. Before calling finish(), verify EVERY planned deliverable exists on disk.\n\n` +
    `⚠️ You MUST produce at least one deliverable file. If you finish without\n` +
    `   writing any file, this session has FAILED. Analysis without output = failure.\n\n` +
    `⚠️ If finish(status: "success") is called, at least one deliverable MUST exist.`;

  const phase2 = await ctx.runAgent("bob", phase2Prompt);
  if (phase2.status === "error") {
    return ctx.escalate("Phase 2 (deliver) failed", { error: phase2.error });
  }

  ctx.emit({ type: "step_done", step: "phase2-deliver" } as any);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Verify artifacts exist (pure JS — no LLM)
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase3-verify" });

  const phase2Text = phase2.lastAssistantText ?? "";
  const allMentionedFiles = [
    ...plannedFiles,
    ...extractFilePaths(phase2Text),
  ];

  // Deduplicate
  const uniqueFiles = [...new Set(allMentionedFiles)];
  const verified: string[] = [];
  const missing: string[] = [];

  for (const filePath of uniqueFiles) {
    if (existsSync(filePath)) {
      verified.push(filePath);
    } else {
      missing.push(filePath);
    }
  }

  ctx.emit({ type: "step_done", step: "phase3-verify" } as any);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2b: Retry missing files (if any)
  // ═══════════════════════════════════════════════════════════════════
  let finalVerified = [...verified];
  let finalMissing = [...missing];

  if (verified.length > 0 && missing.length > 0) {
    ctx.emit({ type: "step_start", step: "phase2b-complete-missing" });

    const phase2bPrompt =
      `## Phase 2b: Complete Missing Deliverables\n\n` +
      `### Original Task\n${ctx.task}\n\n` +
      `### Plan from Phase 1\n${planText}\n\n` +
      `### Status: INCOMPLETE — ${missing.length} of ${uniqueFiles.length} deliverables missing\n\n` +
      `### ✅ Already completed:\n` +
      verified.map(f => `- ${f}`).join("\n") + "\n\n" +
      `### ❌ Still missing — YOU MUST COMPLETE THESE:\n` +
      missing.map(f => `- ${f}`).join("\n") + "\n\n" +
      `### Instructions\n` +
      `Phase 2 completed ${verified.length} of ${uniqueFiles.length} planned deliverables.\n` +
      `The remaining ${missing.length} file(s) listed above were NOT written.\n\n` +
      `1. For each missing file, write it NOW using the plan from Phase 1.\n` +
      `2. If a file path doesn't exist, \`ls\` the parent directory to find the correct path.\n` +
      `3. If the file genuinely needs to be created (new entry), create it.\n` +
      `4. Verify each file exists after writing.\n` +
      `5. Do NOT re-do already-completed files. Focus ONLY on the missing ones.\n\n` +
      `⚠️ Every file listed under "Still missing" MUST exist on disk before you finish.\n` +
      `   If you cannot write a file, explain exactly why in your finish() summary.`;

    const phase2b = await ctx.runAgent("bob", phase2bPrompt);

    // Re-check all files after retry
    finalVerified = [];
    finalMissing = [];
    for (const filePath of uniqueFiles) {
      if (existsSync(filePath)) {
        finalVerified.push(filePath);
      } else {
        finalMissing.push(filePath);
      }
    }

    ctx.emit({ type: "step_done", step: "phase2b-complete-missing" } as any);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Result
  // ═══════════════════════════════════════════════════════════════════
  const hasDeliverables = finalVerified.length > 0;
  const allDelivered = hasDeliverables && finalMissing.length === 0;

  if (allDelivered) {
    return ctx.done(
      `## Delivery Complete — ALL ${finalVerified.length} deliverables verified\n\n` +
      `### Deliverables Verified on Disk\n` +
      finalVerified.map(f => `- ✅ ${f}`).join("\n") + "\n" +
      `\n### Phase 1 Plan\n${planText.slice(0, 500)}\n\n` +
      `### Phase 2 Output\n${phase2Text.slice(0, 500)}`
    );
  } else if (hasDeliverables) {
    // Partial delivery — some files exist but not all
    return ctx.done(
      `## Delivery PARTIAL — ${finalVerified.length}/${uniqueFiles.length} deliverables\n\n` +
      `### ✅ Verified on Disk\n` +
      finalVerified.map(f => `- ✅ ${f}`).join("\n") + "\n" +
      `\n### ❌ Missing after retry\n` +
      finalMissing.map(f => `- ❌ ${f}`).join("\n") + "\n" +
      `\n### Phase 1 Plan\n${planText.slice(0, 500)}\n\n` +
      `### Phase 2 Output\n${phase2Text.slice(0, 500)}`
    );
  } else {
    return ctx.escalate(
      "Non-delivery detected: Phase 2 completed but no deliverable files found on disk",
      {
        plannedFiles: uniqueFiles,
        phase1Summary: planText.slice(0, 300),
        phase2Summary: phase2Text.slice(0, 300),
      }
    );
  }
}
