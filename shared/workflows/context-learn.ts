/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Context Learning Workflow
 *
 * Extracts durable knowledge from text (transcript, error log, PR review, etc.)
 * and merges it into an agent's context.md file.
 *
 * The key design choice: the LLM produces the COMPLETE merged context.md, not a
 * list of add/remove patches. This lets it:
 *   - Merge related facts ("bun 1.0" + "bun 1.2" → "Project uses Bun 1.2")
 *   - Resolve conflicts ("config at X" vs "config at Y" → keep latest)
 *   - Remove stale facts contradicted by new evidence
 *   - Reorganize for coherence instead of append-only growth
 *
 * ## Task Format
 *
 * ```
 * agent: coder
 * contextPath: agents/coder/context.md
 *
 * <transcript text or session summary>
 * ```
 *
 * The `agent:` line specifies whose context to update.
 * The `contextPath:` line specifies where to write.
 * Both are optional — defaults to coder and agents/coder/context.md.
 *
 * ## Steps
 *
 * 1. Parse: extract agent name, context path, and source text
 * 2. Extract + Merge: LLM reads source text + existing context.md,
 *    produces the complete updated context.md content
 * 3. Write: save the merged result
 * 4. Verify: confirm file is valid and under size limit
 *
 * ## Reuse
 *
 * Triggerable from:
 *   - Post-session event handler (automatic after evaluation)
 *   - CLI: `may send coach "workflow context-learn agent:coder\n<transcript>"`
 *   - Another workflow (via ctx.runWorkflow)
 *   - Cron job (periodic review of recent sessions)
 */

export const name: string = "context-learn";

export const description: string =
  "Extract durable knowledge from text and merge into an agent's context.md. " +
  "LLM produces the complete merged context — handles conflicts, dedup, and staleness. " +
  "Input: agent name + text to learn from. Output: updated context.md.";

// ── Constants ──────────────────────────────────────────────────────────

const MAX_CONTEXT_SIZE = 2048;

const MERGE_PROMPT = `You are a context management system. You maintain a knowledge file (context.md) for an AI agent — a concise collection of durable facts that help the agent work effectively on its project.

## Your Job

You receive:
1. The agent's CURRENT context.md (may be empty)
2. New text to learn from (a session transcript, error log, code review, etc.)

You must output the COMPLETE UPDATED context.md content.

## Rules

**What belongs in context.md:**
- Correct commands discovered through trial and error (e.g., "Use 'bun test' not 'npm test'")
- Runtime, tooling, and infrastructure facts (e.g., "Project uses Deno with DuckDB")
- Architectural patterns and constraints (e.g., "DB uses lazy init — call getDb() not import db")
- File locations that aren't obvious (e.g., "Config is at config/pipeline.toml not src/config.ts")
- User preferences and team conventions
- Known gotchas and workarounds

**What does NOT belong:**
- Session-specific details ("Fixed typo in line 42 of utils.js")
- Obvious truths ("JavaScript uses curly braces")
- Opinions or speculation
- Anything already covered by the agent's SOUL.md or common-sense.md

**Merging rules:**
- If a new fact updates an existing one, REPLACE the old with the new (e.g., "Bun 1.0" → "Bun 1.2")
- If a new fact contradicts an existing one, KEEP the new one (it's from the more recent session)
- If two facts are about the same topic, MERGE them into one line
- REMOVE facts that the new text proves are stale or wrong
- Keep the file UNDER 30 lines. If it would exceed 30, drop the least useful facts.

## Output Format

Output ONLY the complete context.md content inside a code fence. Each fact is a markdown bullet point. Group related facts together.

\`\`\`markdown
- Project uses Bun 1.2 runtime (not Node.js)
- Run tests with 'bun test' (not 'npm test' or 'node test/file.js')
- Config at config/pipeline.toml, validated with Zod
- DB uses lazy init — always call getDb(), never import db directly
- Temperature readings stored in Kelvin, convert before display
\`\`\`

If there is nothing new to learn AND the existing context needs no changes, output the existing context unchanged inside the code fence.

If the existing context is empty and there's nothing to learn, output:

\`\`\`markdown
\`\`\``;

// ── Task Parser ────────────────────────────────────────────────────────

interface ParsedTask {
  agentName: string;
  contextPath: string;
  text: string;
}

const AGENT_LINE = /^agent:\s*(\S+)\s*$/im;
const CONTEXT_PATH_LINE = /^contextPath:\s*(\S+)\s*$/im;

function parseTask(raw: string): ParsedTask {
  let agentName = "coder";
  let contextPath = "agents/coder/context.md";

  const agentMatch = raw.match(AGENT_LINE);
  if (agentMatch) {
    agentName = agentMatch[1];
    contextPath = `agents/${agentName}/context.md`;
    raw = raw.replace(AGENT_LINE, "");
  }

  const pathMatch = raw.match(CONTEXT_PATH_LINE);
  if (pathMatch) {
    contextPath = pathMatch[1];
    raw = raw.replace(CONTEXT_PATH_LINE, "");
  }

  const text = raw.trim();
  if (!text) {
    throw new Error("Context-learn workflow requires text to analyze (transcript, error log, etc.)");
  }

  return { agentName, contextPath, text };
}

// ── Response Parsing ───────────────────────────────────────────────────

function parseMergedContext(response: string): string | null {
  // Extract content from markdown code fence
  const match = response.match(/```(?:markdown)?\s*\n([\s\S]*?)```/);
  if (!match) return null;

  const content = match[1].trim();
  // Empty context is valid (nothing to learn)
  return content;
}

// ── Workflow Execute ───────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Step 1: Parse ──────────────────────────────────────────────────

  let parsed: ParsedTask;
  try {
    parsed = parseTask(ctx.task);
  } catch (err) {
    return ctx.escalate(
      err instanceof Error ? err.message : "Failed to parse context-learn task",
    );
  }

  const { agentName, contextPath, text } = parsed;

  // Cap input text for the LLM
  const cappedText = text.length > 8000
    ? text.slice(0, 3000) + "\n\n[... truncated ...]\n\n" + text.slice(-5000)
    : text;

  // Read existing context
  let existingContext = "";
  try {
    const fs = await import("node:fs");
    if (fs.existsSync(contextPath)) {
      existingContext = fs.readFileSync(contextPath, "utf-8").trim();
    }
  } catch { /* ok */ }

  // ── Step 2: Extract + Merge via LLM ────────────────────────────────

  ctx.emit({ type: "step_start", step: "extract-and-merge" });

  const prompt = [
    MERGE_PROMPT,
    "",
    `## Agent: ${agentName}`,
    "",
    `## Current context.md`,
    existingContext ? `\`\`\`\n${existingContext}\n\`\`\`` : "(empty — this is the first learning session)",
    "",
    `## New text to learn from`,
    cappedText,
    "",
    "Output the complete updated context.md:",
  ].join("\n");

  const extractResult = await ctx.runAgent("evaluator", prompt);

  if (extractResult.status === "error") {
    return ctx.escalate("LLM extraction/merge failed", {
      agent: agentName,
      error: extractResult.error,
    });
  }

  const mergedContent = parseMergedContext(extractResult.lastAssistantText ?? "");
  if (mergedContent === null) {
    return ctx.escalate("LLM response did not contain a valid markdown code fence", {
      agent: agentName,
      response: (extractResult.lastAssistantText ?? "").slice(0, 500),
    });
  }

  // ── Step 3: Write ──────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "write-context" });

  const fs = await import("node:fs");
  const path = await import("node:path");

  // Enforce size limit
  let finalContent = mergedContent;
  if (finalContent.length > MAX_CONTEXT_SIZE) {
    // Drop from the top (oldest facts) to fit
    const lines = finalContent.split("\n");
    while (lines.join("\n").length > MAX_CONTEXT_SIZE && lines.length > 1) {
      lines.shift();
    }
    finalContent = lines.join("\n");
  }

  if (!finalContent && !existingContext) {
    return ctx.done(`No facts to persist for ${agentName} — nothing learned.`);
  }

  fs.mkdirSync(path.dirname(contextPath), { recursive: true });
  fs.writeFileSync(contextPath, finalContent);

  // ── Step 4: Verify ─────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "verify" });

  const verified = fs.existsSync(contextPath);
  const finalSize = verified ? fs.statSync(contextPath).size : 0;
  const lineCount = finalContent.split("\n").filter(l => l.startsWith("- ")).length;

  if (!verified) {
    return ctx.escalate("context.md was not written successfully", { contextPath });
  }

  // ── Diff summary ───────────────────────────────────────────────────

  const oldLines = new Set(existingContext.split("\n").filter(l => l.startsWith("- ")));
  const newLines = new Set(finalContent.split("\n").filter(l => l.startsWith("- ")));

  const added = [...newLines].filter(l => !oldLines.has(l));
  const removed = [...oldLines].filter(l => !newLines.has(l));
  const kept = [...newLines].filter(l => oldLines.has(l));

  return ctx.done(
    `## Context Learning: ${agentName}\n\n` +
    `**File**: ${contextPath} (${finalSize} bytes, ${lineCount} facts)\n\n` +
    (added.length > 0 ? `### Added/Updated (${added.length})\n${added.join("\n")}\n\n` : "") +
    (removed.length > 0 ? `### Removed/Replaced (${removed.length})\n${removed.join("\n")}\n\n` : "") +
    (kept.length > 0 ? `### Kept (${kept.length})\n` : "") +
    (!added.length && !removed.length ? "No changes — existing context is up to date.\n" : ""),
  );
}
