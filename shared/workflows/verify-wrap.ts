/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * verify-wrap — Minimal verification wrapper workflow
 *
 * Extracted from bob's deliver-or-report Phase 3b. Two phases:
 *   Phase 1: Agent executes task normally
 *   Phase 2: SEPARATE session reads back all written files, confirms content
 *
 * This is the "minimum viable verification workflow" — no retry logic,
 * no early-exit, no plan extraction. Just execute → verify.
 *
 * Designed for reliant agents (scout, optimizer, may) who lack
 * workflow-level verification enforcement. See EXP-137/EXP-138.
 */

export const name: string = "verify-wrap";

export const description: string =
  "Minimal 2-phase verification wrapper. Phase 1: agent executes task. " +
  "Phase 2: separate session reads back all written/edited files and " +
  "confirms contents match the task. Prevents FM-3.3 (skip verification).";

/**
 * Extract file paths that were written/edited during a session.
 * Reads write()/edit() tool calls from assistant messages, plus
 * "Wrote N bytes to <path>" from tool results.
 */
function extractWrittenFiles(messages: any[]): string[] {
  const paths = new Set<string>();

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;

    // Tool call blocks on assistant messages
    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (
          block.type === "toolCall" &&
          (block.name === "write" || block.name === "edit")
        ) {
          const p = block.arguments?.path;
          if (typeof p === "string" && p.length > 0) paths.add(p);
        }
      }
    }

    // Tool result blocks: "Wrote N bytes to <path>"
    if (msg.role === "toolResult") {
      for (const block of msg.content ?? []) {
        if (block.type === "text" && typeof block.text === "string") {
          const writeMatch = block.text.match(/Wrote \d+ bytes to ([^\s(]+)/);
          if (writeMatch) paths.add(writeMatch[1]);
          const editMatch = block.text.match(/Edit applied to ([^\s(]+)/);
          if (editMatch) paths.add(editMatch[1]);
        }
      }
    }

    // Compacted context: "Files written: path1, path2"
    if (msg.role === "user") {
      for (const block of msg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          for (const label of ["Files written:", "Files edited:"]) {
            const match = block.text.match(new RegExp(`${label}\\s*(.+)`));
            if (match) {
              for (const p of match[1].split(",").map((s: string) => s.trim())) {
                if (p.length > 0) paths.add(p);
              }
            }
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
  // PHASE 1: Execute task normally
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase1-execute" });

  const phase1 = await ctx.runAgent("optimizer", ctx.task);
  if (phase1.status === "error") {
    return ctx.escalate("Phase 1 (execute) failed", { error: phase1.error });
  }

  const writtenFiles = extractWrittenFiles(phase1.messages ?? []);
  ctx.emit({ type: "step_done", step: "phase1-execute" } as any);

  // If no files were written, nothing to verify
  if (writtenFiles.length === 0) {
    return ctx.done(
      "Phase 1 complete — no files written/edited, verification skipped.\n\n" +
        `Agent summary: ${(phase1.lastAssistantText ?? "").slice(0, 500)}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Verify — separate session reads back every written file
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase2-verify" });

  const fileList = writtenFiles.map((f, i) => `${i + 1}. \`${f}\``).join("\n");
  const verifyPrompt =
    `## VERIFICATION TASK (READ-ONLY)\n\n` +
    `A previous session completed this task:\n` +
    `> ${ctx.task.slice(0, 500)}\n\n` +
    `It wrote/edited these files:\n${fileList}\n\n` +
    `### Your job: READ each file and verify its contents.\n\n` +
    `For EACH file:\n` +
    `1. Call \`read()\` to read its full contents.\n` +
    `2. Confirm: file exists and is non-empty.\n` +
    `3. Confirm: content matches the task requirements.\n` +
    `4. Confirm: no placeholders, TODOs, or stub content.\n\n` +
    `After reading ALL files, call finish() with:\n` +
    `- status: "success" if all files pass\n` +
    `- status: "failure" if any file has issues\n` +
    `- verification_evidence: For each file, cite specific content you read\n\n` +
    `⚠️ You MUST call read() on each file. Do NOT fabricate evidence.\n` +
    `⚠️ Do NOT write or edit any files. This is READ-ONLY.`;

  const phase2 = await ctx.runAgent("optimizer", verifyPrompt);

  ctx.emit({ type: "step_done", step: "phase2-verify" } as any);

  // Check if verification passed
  const verifyText = phase2.lastAssistantText ?? "";
  const verifyFailed =
    phase2.status === "error" ||
    verifyText.toLowerCase().includes("status: \"failure\"") ||
    verifyText.toLowerCase().includes("status: 'failure'") ||
    verifyText.toLowerCase().includes("verification failed");

  if (verifyFailed) {
    return ctx.escalate(
      "Content verification failed in Phase 2",
      { writtenFiles, verificationReport: verifyText.slice(0, 1000) }
    );
  }

  return ctx.done(
    `## Verified ${writtenFiles.length} file(s)\n\n` +
      `### Files verified:\n` +
      writtenFiles.map((f) => `- ✅ ${f}`).join("\n") +
      `\n\n### Verification report:\n${verifyText.slice(0, 500)}`
  );
}
