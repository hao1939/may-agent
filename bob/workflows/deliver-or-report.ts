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
  "deliverables). Early-exit check: if Phase 1 already wrote all planned " +
  "files (KE-002, ~50% of runs), skip Phase 2 entirely. Otherwise, " +
  "Phase 2: write deliverables to disk (narrowed to missing files only " +
  "when some already exist). Phase 2b: retry any missing deliverables " +
  "(auto-triggered when Phase 2 misses planned files). Phase 3: verify " +
  "ALL planned files exist (pure JS). Phase 3b: LLM-based content " +
  "verification — a SEPARATE session reads back every deliverable and " +
  "confirms contents match the plan (anti-FM-3.3: catches fabricated " +
  "verification evidence). Prevents non-delivery (FM-3.1), " +
  "partial-delivery (FM-2.6), and verification gaps (FM-3.3).";

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

/**
 * Extract file paths that were written/edited during a session.
 *
 * Uses THREE extraction strategies (in priority order):
 * 1. Tool call blocks — reads write()/edit() invocations from assistant messages
 * 2. Compacted context — parses "Files written:" / "Files edited:" from compaction summaries
 * 3. Tool result blocks — parses "Wrote N bytes to <path>" from tool results
 *
 * Strategy 2 is critical: when sessions are long (>20 ops), compaction replaces
 * early assistant messages with a summary that lists files as text, removing the
 * original toolCall blocks. Without strategy 2, long Phase 1 sessions always
 * return 0 paths, defeating the early exit check.
 */
function extractWrittenFilePaths(messages: any[]): string[] {
  const paths = new Set<string>();

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;

    // Strategy 1: Tool call blocks on assistant messages (pre-compaction)
    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block.type === "toolCall" && (block.name === "write" || block.name === "edit")) {
          const p = block.arguments?.path;
          if (typeof p === "string" && p.length > 0) {
            paths.add(p);
          }
        }
      }
    }

    // Strategy 2: Compacted context summaries (post-compaction)
    // Format: "Files written: path1, path2" / "Files edited: path1, path2"
    if (msg.role === "user") {
      for (const block of msg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          const writtenMatch = block.text.match(/Files written:\s*(.+)/);
          if (writtenMatch) {
            for (const p of writtenMatch[1].split(",").map((s: string) => s.trim())) {
              if (p.length > 0) paths.add(p);
            }
          }
          const editedMatch = block.text.match(/Files edited:\s*(.+)/);
          if (editedMatch) {
            for (const p of editedMatch[1].split(",").map((s: string) => s.trim())) {
              if (p.length > 0) paths.add(p);
            }
          }
        }
      }
    }

    // Strategy 3: Tool result blocks (write tool output format)
    // Format: "✅ Wrote N bytes to <path>"
    if (msg.role === "toolResult") {
      for (const block of msg.content ?? []) {
        if (block.type === "text" && typeof block.text === "string") {
          const writeMatch = block.text.match(/Wrote \d+ bytes to ([^\s(]+)/);
          if (writeMatch) {
            paths.add(writeMatch[1]);
          }
          const editMatch = block.text.match(/Edit applied to ([^\s(]+)/);
          if (editMatch) {
            paths.add(editMatch[1]);
          }
        }
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
    `## Phase 1: Analyze & Plan — BUDGET: 15 TOOL CALLS MAX\n\n` +
    `### Task\n${ctx.task}\n\n` +
    `### Instructions — STRICT 15 TOOL CALL BUDGET\n` +
    `You have a **hard budget of 15 tool calls** for this phase. Plan accordingly.\n\n` +
    `1. Read the 2-4 most relevant context files (be selective — NOT every file).\n` +
    `2. Determine exactly what deliverable(s) must be produced.\n` +
    `3. For each deliverable, specify the exact file path and a brief content outline.\n` +
    `4. Call finish() with your plan. Your plan does NOT need to be perfect — Phase 2 has full context too.\n\n` +
    `Output format:\n` +
    `\`\`\`\n` +
    `DELIVERABLES:\n` +
    `1. [file path] — [what it contains]\n` +
    `2. [file path] — [what it contains]\n` +
    `\n` +
    `PLAN:\n` +
    `[Step-by-step plan for Phase 2 to execute]\n` +
    `\`\`\`\n\n` +
    `### ⛔ STRICT RULES\n` +
    `- **DO NOT write or edit ANY deliverable files** — a separate Phase 2 session handles all writing.\n` +
    `- **DO NOT verify anything** — a separate Phase 3 session handles verification.\n` +
    `- **DO NOT read more than 5 files** — be selective, not exhaustive.\n` +
    `- **DO NOT call callAgent() or spawn sub-agents** — Phase 2 handles execution. Calling callAgent triggers recursive workflow nesting that wastes hundreds of ops.\n` +
    `- **If you've used 10 tool calls, STOP reading and write your plan NOW.**\n` +
    `- You MAY write scratch notes to agents/bob/workspace/ if helpful.\n\n` +
    `The most efficient Phase 1 sessions read 2-3 files and finish in under 10 tool calls.\n` +
    `You will NOT be penalized for a brief plan — Phase 2 can read additional files as needed.`;

  const phase1 = await ctx.runAgent("bob", phase1Prompt);
  if (phase1.status === "error") {
    return ctx.escalate("Phase 1 (analyze) failed", { error: phase1.error });
  }

  // Extract plan from ALL assistant messages (not just lastAssistantText,
  // which is typically just the finish() summary without file paths).
  const allAssistantText = (phase1.messages ?? [])
    .filter((m: any) => m.role === "assistant")
    .flatMap((m: any) => (m.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text))
    .join("\n");
  // Use full text for file path extraction, but cap for prompt injection
  const planTextFull = allAssistantText || phase1.lastAssistantText || "";
  const planText = planTextFull.length > 4000 ? planTextFull.slice(0, 4000) + "\n[...truncated]" : planTextFull;

  // Extract file paths from TWO sources:
  // 1. Tool calls (write/edit) — most reliable, shows what Phase 1 ACTUALLY wrote
  // 2. Text content — catches paths mentioned in plan but not yet written
  const writtenFiles = extractWrittenFilePaths(phase1.messages ?? []);
  const textFiles = extractFilePaths(planTextFull);
  const plannedFiles = [...new Set([...writtenFiles, ...textFiles])];

  ctx.emit({ type: "step_done", step: "phase1-analyze" } as any);

  // Log extracted paths for observability
  if (plannedFiles.length > 0) {
    ctx.emit({ type: "step_start", step: `file-check: ${plannedFiles.length} paths (${writtenFiles.length} from tool calls, ${textFiles.length} from text)` });
  } else {
    ctx.emit({ type: "step_start", step: "file-check: 0 planned files detected (early-exit disabled)" });
  }

  // ═══════════════════════════════════════════════════════════════════
  // EARLY EXIT CHECK: Did Phase 1 already write the deliverables?
  // (KE-002: ~50% of the time, bob writes files despite "DO NOT WRITE"
  //  instruction. When that happens, Phase 2 is redundant.)
  // ═══════════════════════════════════════════════════════════════════
  const alreadyExist: string[] = [];
  const stillMissing: string[] = [];

  for (const filePath of plannedFiles) {
    if (existsSync(filePath)) {
      alreadyExist.push(filePath);
    } else {
      stillMissing.push(filePath);
    }
  }

  let phase2Text = "";
  let phase2Messages: any[] = [];
  let phase2FinishDeliverables: string[] = [];
  const allPlannedFound = plannedFiles.length > 0 && stillMissing.length === 0;
  const somePlannedFound = alreadyExist.length > 0 && stillMissing.length > 0;

  if (allPlannedFound) {
    // ─── FAST PATH: All deliverables already exist — skip Phase 2 ───
    ctx.emit({ type: "step_start", step: "phase2-skipped-early-delivery" });
    phase2Text = `[Phase 2 skipped: all ${alreadyExist.length} planned deliverable(s) already written by Phase 1]\n` +
      alreadyExist.map(f => `- ✅ ${f}`).join("\n");
    ctx.emit({ type: "step_done", step: "phase2-skipped-early-delivery" } as any);

  } else if (somePlannedFound) {
    // ─── NARROW PATH: Some exist — Phase 2 only writes missing ones ──
    ctx.emit({ type: "step_start", step: "phase2-deliver-remaining" });

    const phase2NarrowPrompt =
      `## Phase 2: Write REMAINING Deliverables Only — BUDGET: 25 TOOL CALLS MAX\n\n` +
      `### Original Task\n${ctx.task}\n\n` +
      `### Plan from Phase 1\n${planText}\n\n` +
      `### ✅ Already written (Phase 1 wrote these — DO NOT redo):\n` +
      alreadyExist.map(f => `- ${f}`).join("\n") + "\n\n" +
      `### ❌ Still missing — WRITE THESE NOW:\n` +
      stillMissing.map(f => `- ${f}`).join("\n") + "\n\n" +
      `### Instructions — STRICT 25 TOOL CALL BUDGET\n` +
      `You have a **hard budget of 25 tool calls** for this phase. Plan accordingly.\n\n` +
      `Phase 1 already wrote ${alreadyExist.length} of ${plannedFiles.length} deliverables.\n` +
      `You ONLY need to write the ${stillMissing.length} missing file(s) listed above.\n\n` +
      `1. Write each missing deliverable file.\n` +
      `2. After each write/edit call, verify it succeeded (read back the file).\n` +
      `3. If a write fails, try edit() → write() → bash("cat > ...") in order.\n` +
      `4. Do NOT re-analyze. Do NOT rewrite already-completed files. Just write the missing ones.\n` +
      `5. Before calling finish(), verify every missing file now exists on disk.\n\n` +
      `⚠️ You MUST write the missing file(s). Finishing without them = failure.\n` +
      `⚠️ **If you've used 20 tool calls, STOP and call finish() NOW** — deliverable quality matters more than thoroughness.\n\n` +
      `⛔ DO NOT call callAgent() or spawn sub-agents — this creates infinite nested workflows that waste hundreds of ops. Write the deliverables yourself.`;

    const phase2 = await ctx.runAgent("bob", phase2NarrowPrompt);
    if (phase2.status === "error") {
      return ctx.escalate("Phase 2 (deliver-remaining) failed", { error: phase2.error });
    }
    phase2Text = phase2.lastAssistantText ?? "";
    phase2Messages = phase2.messages ?? [];
    phase2FinishDeliverables = (phase2.finishResult?.deliverables ?? []).map((d: any) => d.path).filter(Boolean);

    ctx.emit({ type: "step_done", step: "phase2-deliver-remaining" } as any);

  } else {
    // ─── NORMAL PATH: No deliverables exist yet — full Phase 2 ──────
    ctx.emit({ type: "step_start", step: "phase2-deliver" });

    const phase2Prompt =
      `## Phase 2: Write Deliverables NOW — BUDGET: 25 TOOL CALLS MAX\n\n` +
      `### Original Task\n${ctx.task}\n\n` +
      `### Plan from Phase 1\n${planText}\n\n` +
      `### Instructions — STRICT 25 TOOL CALL BUDGET\n` +
      `You have a **hard budget of 25 tool calls** for this phase. Plan accordingly.\n` +
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
      `⚠️ If finish(status: "success") is called, at least one deliverable MUST exist.\n\n` +
      `⚠️ **If you've used 20 tool calls, STOP and call finish() NOW** — deliverable quality matters more than thoroughness.\n\n` +
      `⛔ DO NOT call callAgent() or spawn sub-agents — this creates infinite nested workflows that waste hundreds of ops. Write the deliverables yourself.`;

    const phase2 = await ctx.runAgent("bob", phase2Prompt);
    if (phase2.status === "error") {
      return ctx.escalate("Phase 2 (deliver) failed", { error: phase2.error });
    }
    phase2Text = phase2.lastAssistantText ?? "";
    phase2Messages = phase2.messages ?? [];
    phase2FinishDeliverables = (phase2.finishResult?.deliverables ?? []).map((d: any) => d.path).filter(Boolean);

    ctx.emit({ type: "step_done", step: "phase2-deliver" } as any);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: Verify artifacts — existence check (pure JS) + content
  // verification (LLM). The LLM phase catches FM-3.3 (fabricated
  // verification evidence) by making a SEPARATE session read back
  // every deliverable and confirm contents match the plan.
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase3-existence-check" });

  const allMentionedFiles = [
    ...plannedFiles,
    ...extractFilePaths(phase2Text),
    // P-fix: Also extract from Phase 2's actual tool calls (write/edit) and
    // structured finish() deliverables — these are the most reliable sources
    // because they reflect what the agent ACTUALLY did, not just what it said.
    // Root cause: phase2.lastAssistantText is often a brief verification summary
    // (e.g., "All verified ✅") without full file paths, so extractFilePaths()
    // returns nothing. But the session messages contain the actual write/edit
    // tool calls, and finishResult.deliverables has explicitly declared paths.
    ...extractWrittenFilePaths(phase2Messages),
    ...phase2FinishDeliverables,
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

  ctx.emit({ type: "step_done", step: "phase3-existence-check" } as any);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2b: Retry missing files (if any)
  // ═══════════════════════════════════════════════════════════════════
  let finalVerified = [...verified];
  let finalMissing = [...missing];

  if (verified.length > 0 && missing.length > 0) {
    ctx.emit({ type: "step_start", step: "phase2b-complete-missing" });

    const phase2bPrompt =
      `## Phase 2b: Complete Missing Deliverables — BUDGET: 20 TOOL CALLS MAX\n\n` +
      `### Original Task\n${ctx.task}\n\n` +
      `### Plan from Phase 1\n${planText}\n\n` +
      `### Status: INCOMPLETE — ${missing.length} of ${uniqueFiles.length} deliverables missing\n\n` +
      `### ✅ Already completed:\n` +
      verified.map(f => `- ${f}`).join("\n") + "\n\n" +
      `### ❌ Still missing — YOU MUST COMPLETE THESE:\n` +
      missing.map(f => `- ${f}`).join("\n") + "\n\n" +
      `### Instructions — STRICT 20 TOOL CALL BUDGET\n` +
      `You have a **hard budget of 20 tool calls** for this phase.\n\n` +
      `Phase 2 completed ${verified.length} of ${uniqueFiles.length} planned deliverables.\n` +
      `The remaining ${missing.length} file(s) listed above were NOT written.\n\n` +
      `1. For each missing file, write it NOW using the plan from Phase 1.\n` +
      `2. If a file path doesn't exist, \`ls\` the parent directory to find the correct path.\n` +
      `3. If the file genuinely needs to be created (new entry), create it.\n` +
      `4. Verify each file exists after writing.\n` +
      `5. Do NOT re-do already-completed files. Focus ONLY on the missing ones.\n\n` +
      `⚠️ Every file listed under "Still missing" MUST exist on disk before you finish.\n` +
      `   If you cannot write a file, explain exactly why in your finish() summary.\n\n` +
      `⛔ DO NOT call callAgent() or spawn sub-agents — this creates infinite nested workflows that waste hundreds of ops. Write the deliverables yourself.`;

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
  // PHASE 3b: LLM-based content verification (anti-FM-3.3)
  //
  // A SEPARATE session reads back every deliverable file and confirms
  // contents match the plan. This catches fabricated verification
  // evidence — the previous phases may CLAIM they verified, but this
  // phase actually performs the verification in isolation.
  // ═══════════════════════════════════════════════════════════════════
  let verificationReport = "";

  if (finalVerified.length > 0) {
    ctx.emit({ type: "step_start", step: "phase3b-content-verify" });

    const fileList = finalVerified.map((f, i) => `${i + 1}. \`${f}\``).join("\n");
    const phase3bPrompt =
      `## Phase 3: VERIFY Deliverable Contents (READ-ONLY)\n\n` +
      `### Original Task\n${ctx.task}\n\n` +
      `### Plan from Phase 1\n${planText}\n\n` +
      `### Deliverable files to verify:\n${fileList}\n\n` +
      `### Instructions — YOUR ONLY JOB IS TO VERIFY\n` +
      `A previous phase wrote the deliverable files listed above.\n` +
      `Your job is to READ each file and confirm its contents are correct.\n\n` +
      `For EACH file:\n` +
      `1. Call \`read("${finalVerified[0]}")\` (or the actual path) to read its full contents.\n` +
      `2. Check: Does it match what the plan specified?\n` +
      `3. Check: Is it well-formed (valid syntax, no placeholders, no TODO stubs)?\n` +
      `4. Check: Does it actually address the original task?\n\n` +
      `After reading ALL files, call finish() with:\n` +
      `- status: "success" if ALL files pass verification\n` +
      `- status: "failure" if ANY file has issues\n` +
      `- verification_evidence: For each file, cite the EXACT content you read\n` +
      `  (first 2-3 lines or key section) proving you actually read it.\n\n` +
      `⚠️ You MUST actually call read() on each file. Do NOT fabricate evidence.\n` +
      `⚠️ Do NOT write or edit any files. This phase is READ-ONLY.\n` +
      `⚠️ If a file is empty, malformed, or doesn't match the plan, report failure.\n\n` +
      `⛔ DO NOT call workflow.run(), callAgent(), or spawn sub-agents/sub-workflows. Your job is ONLY to read files and report pass/fail. Calling workflow.run() creates infinite nested workflows that waste hundreds of ops.`;

    const phase3b = await ctx.runAgent("bob", phase3bPrompt);

    // Extract the verification result
    const phase3bText = phase3b.lastAssistantText ?? "";
    const phase3bFailed = phase3b.status === "error" ||
      phase3bText.toLowerCase().includes("status: \"failure\"") ||
      phase3bText.toLowerCase().includes("status: 'failure'") ||
      phase3bText.toLowerCase().includes("verification failed");

    verificationReport = phase3bText;

    if (phase3bFailed) {
      ctx.emit({ type: "step_done", step: "phase3b-content-verify (FAILED)" } as any);
      return ctx.escalate(
        "Content verification failed: Phase 3b found issues with deliverable contents",
        {
          verifiedFiles: finalVerified,
          verificationReport: verificationReport.slice(0, 1000),
          phase1Summary: planText.slice(0, 300),
        }
      );
    }

    ctx.emit({ type: "step_done", step: "phase3b-content-verify" } as any);
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
      `\n### Content Verification (Phase 3b)\n${verificationReport.slice(0, 500)}\n\n` +
      `### Phase 1 Plan\n${planText.slice(0, 500)}\n\n` +
      `### Phase 2 Output\n${phase2Text.slice(0, 500)}`
    );
  } else if (hasDeliverables) {
    // Partial delivery — some files exist but not all
    return ctx.done(
      `## Delivery PARTIAL — ${finalVerified.length}/${uniqueFiles.length} deliverables\n\n` +
      `### ✅ Verified on Disk\n` +
      finalVerified.map(f => `- ✅ ${f}`).join("\n") + "\n" +
      `\n### Content Verification (Phase 3b)\n${verificationReport.slice(0, 500)}\n\n` +
      `### ❌ Missing after retry\n` +
      finalMissing.map(f => `- ❌ ${f}`).join("\n") + "\n" +
      `\n### Phase 1 Plan\n${planText.slice(0, 500)}\n\n` +
      `### Phase 2 Output\n${phase2Text.slice(0, 500)}`
    );
  } else {
    // Check if the agent reported success via finish() even though no file paths were
    // detected — this may indicate the task was already done (no writes needed).
    const phase2FinishStatus = (() => {
      // Extract from last phase2 messages (search for finish tool call)
      for (let i = phase2Messages.length - 1; i >= 0; i--) {
        const msg = phase2Messages[i];
        if (msg.role === "assistant" && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "toolCall" && block.name === "finish") {
              return block.arguments?.status;
            }
          }
        }
      }
      return undefined;
    })();

    if (phase2FinishStatus === "success") {
      // Agent claimed success but no files detected — likely an "already done" task
      return ctx.done(
        `## Delivery Complete (pre-existing) — agent reported success, no new files needed\n\n` +
        `### Note\nPhase 2 reported success via finish() but no deliverable file paths were detected.\n` +
        `This typically means the task's deliverables already existed before the workflow started.\n\n` +
        `### Phase 2 Summary\n${phase2Text.slice(0, 500)}\n\n` +
        `### Phase 1 Plan\n${planText.slice(0, 500)}`
      );
    }

    return ctx.escalate(
      "Non-delivery detected: Phase 2 completed but no deliverable files found on disk",
      {
        plannedFiles: uniqueFiles,
        phase1Summary: planText.slice(0, 300),
        phase2Summary: phase2Text.slice(0, 300),
        phase2FinishStatus,
        phase2FinishDeliverables,
        phase2WrittenFiles: extractWrittenFilePaths(phase2Messages),
      }
    );
  }
}
