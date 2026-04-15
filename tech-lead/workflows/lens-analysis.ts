/// <reference path="../../../src/lib/workflow-defs.d.ts" />

import { existsSync, readFileSync, statSync } from "node:fs";

/**
 * lens-analysis — D-o-R phased Lens investigation workflow
 *
 * Enforces Definition-of-Ready phase boundaries for tech-lead Lens sessions:
 *   Phase 1: SCOPE (≤3 ops) — read targets, state hypothesis
 *   Phase 2: INVESTIGATE (≤10 ops) — gather evidence, no writing
 *   Phase 3: WRITE (≤5 ops) — produce findings deliverable
 *   Phase 4: EXIT (1 op) — finish()
 *
 * Total budget: ≤20 ops. Prevents the 40-96 op bloat pattern.
 *
 * Based on verify-wrap pattern: Phase 1 runs the agent with embedded
 * phase boundaries in the task. Phase 2 does JS-based file verification
 * (no LLM cost). The key difference from plain verify-wrap: the phase
 * boundary instructions are structurally embedded, not advisory text.
 *
 * Fix-creep guard: Task explicitly instructs "do NOT fix inline."
 * Verification catches missing deliverables.
 */

export const name: string = "lens-analysis";

export const description: string =
  "D-o-R phased Lens investigation workflow. Embeds phase boundaries " +
  "(SCOPE ≤3 ops, INVESTIGATE ≤10, WRITE ≤5, EXIT 1) in the task string " +
  "and verifies the findings deliverable exists. Total budget: 20 ops.";

// ── Input parsing ──────────────────────────────────────────────────────

interface ParsedInput {
  lens: string;
  target: string;
  deliverable: string;
  rawTask: string;
}

/**
 * Parse the task string. Expected format:
 *   Lens <X>: <target description>
 *   deliverable: agents/tech-lead/workspace/<name>.md
 *
 * If deliverable is not specified, auto-generates from the task.
 */
function parseInput(raw: string): ParsedInput {
  // Extract lens identifier (A/B/C/D or descriptive)
  const lensMatch = raw.match(/Lens\s+([A-Z](?:[^:]*)?)\s*:/i);
  const lens = lensMatch ? lensMatch[1].trim() : "unknown";

  // Extract deliverable path
  const deliverableMatch = raw.match(/^deliverable:\s*(.+)$/m);
  let deliverable: string;
  if (deliverableMatch) {
    deliverable = deliverableMatch[1].trim();
  } else {
    // Auto-generate from task — slug the first 40 chars of the target
    const slug = raw
      .replace(/^Lens\s+[A-Z](?:[^:]*)?\s*:\s*/i, "")
      .replace(/^deliverable:\s*.+$/m, "")
      .trim()
      .slice(0, 40)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "");
    deliverable = `agents/tech-lead/workspace/finding-${slug}.md`;
  }

  // Target is the task minus metadata
  const target = raw
    .replace(/^deliverable:\s*.+$/m, "")
    .trim();

  return { lens, target, deliverable, rawTask: raw };
}

// ── Phase boundary task construction ───────────────────────────────────

function buildPhasedTask(parsed: ParsedInput): string {
  return `${parsed.target}

## PHASE BOUNDARIES — Hard Caps (Not Suggestions)

You are running in a D-o-R (Definition-of-Ready) phased workflow. These op budgets are enforced:

### Phase 1: SCOPE (≤3 ops)
- Read 1-3 target files. Count lines, identify boundaries.
- Write a 1-sentence objective as a comment or mental note.
- **GATE**: If scope spans >3 files or >1000 lines, NARROW before proceeding.

### Phase 2: INVESTIGATE (≤10 ops)
- Gather evidence: read, grep, query. Follow code paths, count layers.
- Take mental notes on findings. Do NOT start writing the deliverable yet.
- Do NOT start fixing, cleaning up, or deleting code you find.
- **GATE**: At op ~13 total, STOP investigating. You have enough evidence.

### Phase 3: WRITE (≤5 ops)
- Write findings to: \`${parsed.deliverable}\`
- Include: summary, evidence (with file paths + line numbers), severity, recommended action.
- **GATE**: The deliverable file exists and is non-empty. You are DONE.

### Phase 4: EXIT (1 op)
- Call finish(). Do NOT start fixing what you found.
- If you discovered something worth fixing, note it as a follow-up in the findings doc.
- The fix is a SEPARATE session — it will be dispatched from the next heartbeat.

**Total budget: ≤20 ops.** You should finish well under this.

## Fix-Creep Guard
The #1 anti-pattern is: "I found dead code, let me delete it now." DON'T. 
Write the finding, exit, and let the fix be a separate session.

## Deliverable
Write your findings to: \`${parsed.deliverable}\`
This file will be verified after you finish. It must exist and be non-empty.`;
}

// ── JS-based file verification (from verify-wrap) ──────────────────────

const PLACEHOLDER_PATTERNS = [
  /TODO[:\s]/i,
  /FIXME[:\s]/i,
  /XXX[:\s]/i,
  /\bplaceholder\b/i,
  /\bstub\b/i,
  /lorem ipsum/i,
  /insert .* here/i,
  /\.\.\.\s*$/m,
];

interface FileVerifyResult {
  path: string;
  exists: boolean;
  sizeBytes: number;
  issues: string[];
  preview: string;
}

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

    const trimmed = content.trim();
    if (trimmed.length < 50) {
      result.issues.push(`File content too short (${trimmed.length} chars) — likely a stub`);
    }

    // Check for placeholder patterns
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        result.issues.push(`Contains placeholder pattern: "${match[0]}"`);
        break;
      }
    }
  } catch (err: any) {
    result.issues.push(`Read error: ${err.message}`);
  }

  return result;
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Parse input ────────────────────────────────────────────────────
  const parsed = parseInput(ctx.task);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: Execute Lens analysis with embedded phase boundaries
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "lens-analysis" });

  const phasedTask = buildPhasedTask(parsed);
  const phase1 = await ctx.runAgent(ctx.agent, phasedTask);

  if (phase1.status === "error") {
    return ctx.escalate("Lens analysis session failed", { error: phase1.error });
  }

  ctx.emit({ type: "step_done", step: "lens-analysis" } as any);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Verify deliverable — pure JS (no LLM cost)
  // ═══════════════════════════════════════════════════════════════════
  ctx.emit({ type: "step_start", step: "verify-deliverable" });

  const verifyResult = verifyFile(parsed.deliverable);

  ctx.emit({ type: "step_done", step: "verify-deliverable" } as any);

  // Also check for any other files written (bonus verification)
  const otherFiles = extractWrittenFiles(phase1.messages ?? [])
    .filter((f) => f !== parsed.deliverable);
  const otherResults = otherFiles.map(verifyFile);

  // Build report
  const allResults = [verifyResult, ...otherResults];
  const reportLines = allResults.map((r) => {
    if (r.issues.length === 0) {
      return `- ✅ \`${r.path}\` (${r.sizeBytes} bytes)`;
    }
    return `- ❌ \`${r.path}\`: ${r.issues.join("; ")}`;
  });

  const opsUsed = phase1.turnsUsed ?? "unknown";

  // Hard failure: deliverable missing or empty
  if (!verifyResult.exists || verifyResult.sizeBytes === 0) {
    return ctx.escalate(
      `Lens analysis deliverable missing or empty: ${parsed.deliverable}`,
      {
        deliverable: parsed.deliverable,
        opsUsed,
        verificationReport: reportLines.join("\n"),
      }
    );
  }

  return ctx.done(
    `## Lens ${parsed.lens} Analysis Complete\n\n` +
      `**Deliverable**: \`${parsed.deliverable}\` (${verifyResult.sizeBytes} bytes)\n` +
      `**Ops used**: ${opsUsed}\n\n` +
      `### Verification:\n${reportLines.join("\n")}\n\n` +
      `### Preview:\n${verifyResult.preview}\n\n` +
      `### Agent summary:\n${(phase1.lastAssistantText ?? "").slice(0, 500)}`
  );
}

// ── Helper: extract written files from messages ─────────────────────

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
  }
  return [...paths];
}
