import { existsSync, readFileSync, statSync } from "node:fs";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

/**
 * investigate-and-fix — Analysis that forces action
 *
 * Optimizer's #1 anti-pattern: produces detailed findings with concrete
 * recommendations, then stops. 51% of work sessions produce findings
 * with zero follow-through (Optimizer's own measurement, Apr 13).
 *
 * This workflow enforces a 3-phase structure:
 *   Phase 1: INVESTIGATE — Agent analyzes the problem, writes finding
 *   Phase 2: FIX — Agent executes the top recommended action from Phase 1
 *   Phase 3: VERIFY — JS checks that files were actually modified
 *
 * Phase 2 is the key innovation: the finding from Phase 1 is passed back
 * with explicit instructions to execute the fix, not just recommend it.
 *
 * If Phase 1 concludes no action is needed (monitoring-only), the workflow
 * accepts that — but the agent must explicitly say "NO_ACTION_NEEDED" with
 * justification. This prevents lazy "no action" cop-outs while allowing
 * genuine monitoring-only findings.
 *
 * Usage:
 *   workflow.run('investigate-and-fix', task)
 *
 * The task should describe what to investigate. Examples:
 *   - "Mode D: Workflow Health — check adoption rates and fix gaps"
 *   - "Investigate why coach sessions average 46 ops and fix the top cause"
 *   - "Analyze scout's 78-op session and implement a prevention"
 */

export const name: string = "investigate-and-fix";

export const description: string =
  "3-phase workflow: investigate → fix → verify. " +
  "Prevents the 'write finding but never act' anti-pattern. " +
  "Phase 1 produces analysis, Phase 2 executes the top fix, " +
  "Phase 3 verifies files were actually changed.";

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract file paths that were written/edited during a session.
 */
function extractWrittenFiles(messages: any[]): string[] {
  const paths = new Set<string>();

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;

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

/** Placeholder patterns indicating stub content */
const PLACEHOLDER_PATTERNS = [
  /TODO[:\s]/i,
  /FIXME[:\s]/i,
  /\bplaceholder\b/i,
  /lorem ipsum/i,
  /insert .* here/i,
];

interface FileCheck {
  path: string;
  exists: boolean;
  sizeBytes: number;
  issues: string[];
}

function checkFile(filePath: string): FileCheck {
  const result: FileCheck = { path: filePath, exists: false, sizeBytes: 0, issues: [] };

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
    if (content.trim().length < 10) {
      result.issues.push(`Content too short (${content.trim().length} chars)`);
    }

    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        result.issues.push(`Placeholder pattern: "${match[0]}"`);
        break;
      }
    }
  } catch (err: any) {
    result.issues.push(`Read error: ${err.message}`);
  }

  return result;
}

/**
 * Check if Phase 1 output indicates no action is needed.
 * The agent must explicitly use the NO_ACTION_NEEDED marker.
 */
function isNoActionNeeded(text: string): boolean {
  return /NO_ACTION_NEEDED/i.test(text);
}

/**
 * Check if finding text contains DISPATCH-READY marker
 * (meaning it should be dispatched to another agent, not self-fixed)
 */
function isDispatchReady(text: string): boolean {
  return /DISPATCH[_-]READY/i.test(text);
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: INVESTIGATE — analyze the problem, write finding
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase1-investigate" });

  const investigateTask =
    `## Phase 1: INVESTIGATE\n\n` +
    `${ctx.task}\n\n` +
    `### Requirements\n` +
    `1. Query data, read files, analyze the problem thoroughly\n` +
    `2. Write your finding to a workspace file (finding-*.md)\n` +
    `3. Include a "## Recommendations" section with specific, actionable fixes\n` +
    `4. Each recommendation must specify:\n` +
    `   - What file(s) to change\n` +
    `   - What the change is (concrete, not vague)\n` +
    `   - Expected impact\n` +
    `5. Rank recommendations by priority (R1 = highest)\n\n` +
    `### Important\n` +
    `After this phase, YOU will be asked to execute your top recommendation.\n` +
    `So make R1 something you can actually do right now — not "monitor" or "wait".\n` +
    `If genuinely no action is needed, write "NO_ACTION_NEEDED" with justification.\n` +
    `If the fix requires a different agent, write "DISPATCH-READY" with the target agent.`;

  const phase1 = await ctx.runAgent(ctx.agent, investigateTask);

  if (phase1.status === "error") {
    return ctx.blocked("Phase 1 (investigate) failed", { error: phase1.error });
  }

  const phase1Summary = ctx.summarize(phase1, {
    includeResponse: true,
    includeKeyFacts: true,
    includeErrors: true,
    maxLength: 6000,
  });

  const phase1Text = phase1.lastAssistantText ?? "";
  const phase1Files = extractWrittenFiles(phase1.messages ?? []);

  ctx.emit({ type: "step_done", step: "phase1-investigate" } as any);

  // ── Check for NO_ACTION_NEEDED ──────────────────────────────────
  if (isNoActionNeeded(phase1Text)) {
    // Verify finding was actually written
    if (phase1Files.length === 0) {
      return ctx.blocked(
        "Phase 1 claimed NO_ACTION_NEEDED but didn't write a finding file. " +
        "Even monitoring-only findings must be documented."
      );
    }
    return ctx.done(
      `## Investigation complete — no action needed\n\n` +
      `Finding written to: ${phase1Files.join(", ")}\n\n` +
      `Agent assessment: ${phase1Text.slice(0, 500)}`
    );
  }

  // ── Check for DISPATCH-READY ────────────────────────────────────
  if (isDispatchReady(phase1Text)) {
    // Verify finding was written
    if (phase1Files.length === 0) {
      return ctx.blocked(
        "Phase 1 marked DISPATCH-READY but didn't write a finding file."
      );
    }
    return ctx.done(
      `## Investigation complete — dispatched to another agent\n\n` +
      `Finding written to: ${phase1Files.join(", ")}\n\n` +
      `The fix requires a different agent. Use agents.message() to dispatch.\n\n` +
      `Agent assessment: ${phase1Text.slice(0, 500)}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: FIX — execute the top recommendation from Phase 1
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase2-fix" });

  const fixTask =
    `## Phase 2: EXECUTE THE FIX\n\n` +
    `You just completed an investigation. Here's what you found:\n\n` +
    `${phase1Summary}\n\n` +
    `### Your job now\n` +
    `Execute your TOP recommendation (R1) from the finding above.\n\n` +
    `**Rules:**\n` +
    `- Actually edit/write the files. Don't just plan or describe.\n` +
    `- If R1 involves editing another agent's heartbeat.md, do it.\n` +
    `- If R1 involves fixing a config file, do it.\n` +
    `- If R1 involves building a small tool/script, do it.\n` +
    `- Commit your changes with a clear commit message.\n` +
    `- If you truly cannot execute R1 (permissions, risk too high), execute R2.\n\n` +
    `**Do NOT:**\n` +
    `- Write another finding document\n` +
    `- Create a "plan" or "proposal" instead of making the change\n` +
    `- Skip the fix because it "needs more investigation"\n`;

  const phase2 = await ctx.runAgent(ctx.agent, fixTask);

  if (phase2.status === "error") {
    return ctx.blocked("Phase 2 (fix) failed", {
      error: phase2.error,
      phase1Files,
    });
  }

  const phase2Text = phase2.lastAssistantText ?? "";
  const phase2Files = extractWrittenFiles(phase2.messages ?? []);

  ctx.emit({ type: "step_done", step: "phase2-fix" } as any);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: VERIFY — JS check that files were actually modified
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "phase3-verify" });

  // Combine files from both phases (Phase 1 = finding, Phase 2 = fix)
  const allFiles = [...new Set([...phase1Files, ...phase2Files])];
  const fixOnlyFiles = phase2Files.filter(f => !phase1Files.includes(f));

  // The critical check: Phase 2 must have written/edited files BEYOND
  // just the finding document from Phase 1
  if (fixOnlyFiles.length === 0) {
    // Phase 2 didn't produce any new file changes — it just wrote more docs
    return ctx.blocked(
      `Phase 2 did not modify any files beyond the Phase 1 finding. ` +
      `The fix was not executed — agent likely wrote another document ` +
      `instead of making the actual change.\n\n` +
      `Phase 1 files: ${phase1Files.join(", ")}\n` +
      `Phase 2 files: ${phase2Files.join(", ")}\n\n` +
      `Phase 2 summary: ${phase2Text.slice(0, 500)}`
    );
  }

  // Verify fix files exist and are valid
  const checks = fixOnlyFiles.map(checkFile);
  const failed = checks.filter(c => c.issues.length > 0);
  const hardFailed = failed.filter(c => !c.exists || c.sizeBytes === 0);

  const reportLines: string[] = [];
  for (const c of checks) {
    if (c.issues.length === 0) {
      reportLines.push(`- ✅ \`${c.path}\` (${c.sizeBytes} bytes)`);
    } else {
      reportLines.push(`- ❌ \`${c.path}\`: ${c.issues.join("; ")}`);
    }
  }

  ctx.emit({ type: "step_done", step: "phase3-verify" } as any);

  if (hardFailed.length > 0) {
    return ctx.blocked(
      `Fix verification failed: ${hardFailed.length} file(s) missing or empty`,
      {
        fixFiles: fixOnlyFiles,
        verificationReport: reportLines.join("\n"),
        failedFiles: hardFailed.map(c => ({ path: c.path, issues: c.issues })),
      }
    );
  }

  return ctx.done(
    `## Investigation + Fix complete (3 phases)\n\n` +
    `### Phase 1: Finding\n` +
    `Written to: ${phase1Files.join(", ") || "(no finding file)"}\n\n` +
    `### Phase 2: Fix applied\n` +
    `Modified: ${fixOnlyFiles.join(", ")}\n\n` +
    `### Phase 3: Verification\n` +
    `${reportLines.join("\n")}\n\n` +
    `### Summary\n` +
    `${phase2Text.slice(0, 500)}`
  );
}
