/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Context Learning Workflow
 *
 * Extracts durable knowledge from a session transcript and persists it
 * to the agent's context.md file.
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
 * The `contextPath:` line specifies where to write (resolved relative to project root).
 * Both are optional — defaults to coder and agents/coder/context.md.
 *
 * ## How It Works
 *
 * 1. Parse: extract agent name, context path, and transcript from task
 * 2. Extract: run evaluator agent to identify durable facts from transcript
 * 3. Apply: write facts to context.md (add/remove with dedup and size cap)
 * 4. Verify: read back and confirm the file is valid
 *
 * ## Reuse
 *
 * Can be triggered from:
 *   - Post-session event handler (automatic)
 *   - CLI: `may send coach "workflow context-learn agent:coder\n<transcript>"`
 *   - Another workflow (via ctx.runWorkflow)
 *   - Cron job (periodic review of recent sessions)
 */

export const name: string = "context-learn";

export const description: string =
  "Extract durable knowledge from text and persist to an agent's context.md. " +
  "Input: agent name + transcript/text. Output: updated context.md with new facts. " +
  "Uses evaluator for cheap LLM extraction. Handles dedup and size trimming.";

// ── Constants ──────────────────────────────────────────────────────────

const MAX_CONTEXT_SIZE = 2048;

const EXTRACT_PROMPT = `You are a context extraction system. You read text and extract DURABLE facts worth remembering for future work on the same project.

## Rules
- Extract only facts that would help the SAME agent working on the SAME project in the future
- Each fact must be one line, specific and actionable
- DO NOT extract: session-specific details ("fixed bug in line 42"), obvious truths, opinions, generic advice
- DO extract: correct commands discovered through trial and error, runtime/tooling facts, architectural patterns, gotchas, implicit constraints, file locations, user preferences
- Maximum 5 facts (be selective — only genuinely useful ones)
- If nothing new was learned, output an empty array

## Output format
Output ONLY a JSON array inside a code fence. Each element has "action" and "content":

\`\`\`json
[
  { "action": "add", "content": "Run tests with 'bun test' — project uses bun:test module, 'node test/file.js' fails" },
  { "action": "remove", "content": "old fact that this session proved wrong" }
]
\`\`\`

Use "remove" only when the text proves a previously-known fact is wrong.
Output \`[]\` if nothing worth learning.`;

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

// ── JSON Parsing ───────────────────────────────────────────────────────

interface ContextUpdate {
  action: "add" | "remove";
  content: string;
}

function parseUpdates(text: string): ContextUpdate[] {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u: unknown): u is ContextUpdate =>
        typeof u === "object" && u !== null &&
        "action" in u && "content" in u &&
        typeof (u as Record<string, unknown>).action === "string" &&
        typeof (u as Record<string, unknown>).content === "string" &&
        ((u as Record<string, unknown>).action === "add" || (u as Record<string, unknown>).action === "remove"),
    );
  } catch {
    return [];
  }
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

  // Read existing context (for dedup instructions)
  let existingContext = "";
  try {
    const fs = await import("node:fs");
    if (fs.existsSync(contextPath)) {
      existingContext = fs.readFileSync(contextPath, "utf-8").trim();
    }
  } catch { /* ok */ }

  // ── Step 2: Extract via LLM ────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "extract-facts" });

  const extractPrompt = [
    EXTRACT_PROMPT,
    "",
    `## Agent: ${agentName}`,
    existingContext ? `\n## Already known (do not duplicate)\n${existingContext}\n` : "",
    `## Text to analyze`,
    cappedText,
    "",
    "Output the JSON array:",
  ].join("\n");

  const extractResult = await ctx.runAgent("evaluator", extractPrompt);

  if (extractResult.status === "error") {
    return ctx.escalate("LLM extraction failed", {
      agent: agentName,
      error: extractResult.error,
    });
  }

  const updates = parseUpdates(extractResult.lastAssistantText ?? "");
  if (updates.length === 0) {
    return ctx.done(`No new facts extracted for ${agentName} — session was trivial or nothing new learned.`);
  }

  // ── Step 3: Apply to context.md ────────────────────────────────────

  ctx.emit({ type: "step_start", step: "apply-updates" });

  const fs = await import("node:fs");
  const path = await import("node:path");

  let lines: string[] = [];
  try { lines = fs.readFileSync(contextPath, "utf-8").split("\n"); } catch { /* file may not exist */ }

  const added: string[] = [];
  const removed: string[] = [];

  for (const u of updates) {
    const trimmed = u.content.trim();
    if (u.action === "add") {
      if (!lines.some(line => line.toLowerCase().includes(trimmed.toLowerCase()))) {
        lines.push(`- ${trimmed}`);
        added.push(trimmed);
      }
    } else if (u.action === "remove") {
      const before = lines.length;
      lines = lines.filter(l => !l.toLowerCase().includes(trimmed.toLowerCase()));
      if (lines.length < before) removed.push(trimmed);
    }
  }

  if (added.length === 0 && removed.length === 0) {
    return ctx.done(`All ${updates.length} extracted fact(s) already known for ${agentName}.`);
  }

  // Trim to max size
  let content = lines.join("\n");
  while (content.length > MAX_CONTEXT_SIZE) {
    const idx = content.indexOf("\n", 1);
    if (idx === -1) break;
    content = content.slice(idx + 1);
  }

  fs.mkdirSync(path.dirname(contextPath), { recursive: true });
  fs.writeFileSync(contextPath, content);

  // ── Step 4: Verify ─────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "verify" });

  const verified = fs.existsSync(contextPath);
  const finalSize = verified ? fs.statSync(contextPath).size : 0;

  if (!verified) {
    return ctx.escalate("context.md was not written successfully", { contextPath });
  }

  // ── Done ───────────────────────────────────────────────────────────

  const addedList = added.map(f => `  + ${f}`).join("\n");
  const removedList = removed.map(f => `  - ${f}`).join("\n");

  return ctx.done(
    `## Context Learning: ${agentName}\n\n` +
    `**File**: ${contextPath} (${finalSize} bytes)\n\n` +
    (added.length > 0 ? `### Added (${added.length})\n${addedList}\n\n` : "") +
    (removed.length > 0 ? `### Removed (${removed.length})\n${removedList}\n\n` : "") +
    `Total facts in context: ${lines.filter(l => l.startsWith("- ")).length}`,
  );
}
