/// <reference path="../../../src/lib/workflow-defs.d.ts" />

import { existsSync, readFileSync, statSync } from "node:fs";

/**
 * verify-wrap — Minimal verification wrapper workflow
 *
 * Extracted from bob's deliver-or-report Phase 3b. Two phases:
 *   Phase 1: Agent executes task normally
 *   Phase 2: JS-based file verification (existence, non-empty, no placeholders)
 *
 * Phase 2 was originally an LLM session but 93% of verification sessions
 * exited at 0 ops (LLM chose to skip verification). Converted to pure JS
 * on 2026-04-13 — saves ~27 LLM sessions/day.
 *
 * Designed for any agent that needs workflow-level verification enforcement.
 * Uses ctx.agent to delegate to the calling agent. See EXP-137/EXP-138.
 */

export const name: string = "verify-wrap";

export const description: string =
  "Minimal 2-phase verification wrapper. Phase 1: agent executes task. " +
  "Phase 2: pure JS verification — checks files exist, are non-empty, " +
  "and have no placeholder content. No LLM cost for Phase 2.";

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

// ── JS-based file verification ─────────────────────────────────────────

/** Patterns that indicate placeholder/stub content */
const PLACEHOLDER_PATTERNS = [
  /TODO[:\s]/i,
  /FIXME[:\s]/i,
  /XXX[:\s]/i,
  /\bplaceholder\b/i,
  /\bstub\b/i,
  /lorem ipsum/i,
  /insert .* here/i,
  /\.\.\.\s*$/m, // trailing ellipsis (common stub pattern)
];

interface FileVerifyResult {
  path: string;
  exists: boolean;
  sizeBytes: number;
  issues: string[];
  preview: string; // first ~200 chars for the report
}

/**
 * Verify a single file: exists, non-empty, no obvious placeholders.
 * Returns a structured result instead of using LLM judgment.
 */
function verifyFile(filePath: string): FileVerifyResult {
  const result: FileVerifyResult = {
    path: filePath,
    exists: false,
    sizeBytes: 0,
    issues: [],
    preview: "",
  };

  if (!existsSync(filePath)) {
    result.issues.push("File does not exist");
    return result;
  }

  result.exists = true;
  try {
    const stat = statSync(filePath);
    result.sizeBytes = stat.size;

    if (stat.size === 0) {
      result.issues.push("File is empty (0 bytes)");
      return result;
    }

    const content = readFileSync(filePath, "utf-8");
    result.preview = content.slice(0, 200);

    // Check for very small files (likely stubs)
    const trimmed = content.trim();
    if (trimmed.length < 10) {
      result.issues.push(`File content too short (${trimmed.length} chars after trim)`);
    }

    // Check for placeholder patterns
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        result.issues.push(`Contains placeholder pattern: "${match[0]}"`);
        break; // One placeholder flag is enough
      }
    }
  } catch (err: any) {
    result.issues.push(`Read error: ${err.message}`);
  }

  return result;
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Execute task normally
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase1-execute" });

  const phase1 = await ctx.runAgent(ctx.agent, ctx.task);
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
  // PHASE 2: Verify — pure JS reads back every written file
  // (Replaces LLM session that was 93% zero-op — 2026-04-13)
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase2-verify" });

  const results = writtenFiles.map(verifyFile);
  const passed = results.filter((r) => r.issues.length === 0);
  const failed = results.filter((r) => r.issues.length > 0);

  ctx.emit({ type: "step_done", step: "phase2-verify" } as any);

  // Build verification report
  const reportLines: string[] = [];
  for (const r of results) {
    if (r.issues.length === 0) {
      reportLines.push(`- ✅ \`${r.path}\` (${r.sizeBytes} bytes)`);
    } else {
      reportLines.push(
        `- ❌ \`${r.path}\`: ${r.issues.join("; ")}`
      );
    }
  }
  const verificationReport = reportLines.join("\n");

  if (failed.length > 0) {
    // Only escalate if files are missing or empty — placeholder warnings
    // are informational (many legit files mention "TODO" in context)
    const hardFailures = failed.filter(
      (r) => !r.exists || r.sizeBytes === 0
    );
    if (hardFailures.length > 0) {
      return ctx.escalate(
        `Content verification failed: ${hardFailures.length} file(s) missing or empty`,
        {
          writtenFiles,
          verificationReport,
          failedFiles: hardFailures.map((r) => ({
            path: r.path,
            issues: r.issues,
          })),
        }
      );
    }
    // Soft failures (placeholder patterns) — warn but don't block
  }

  return ctx.done(
    `## Verified ${writtenFiles.length} file(s) — JS verification (no LLM cost)\n\n` +
      `### Verification results:\n${verificationReport}\n\n` +
      `### Phase 1 summary:\n${(phase1.lastAssistantText ?? "").slice(0, 500)}`
  );
}
