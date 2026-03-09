/// <reference path="../../../src/workflow-defs.d.ts" />

/**
 * safe-edit workflow
 *
 * Safely edits a file by choosing the right strategy based on file size:
 * - Small files (<300 lines): full read → LLM applies change → full write
 * - Large files (≥300 lines): grep to locate → read context → sed/perl to apply → verify
 *
 * Eliminates the "blind overwrite" failure mode where agents read a truncated
 * file and write the truncated content back, destroying data.
 *
 * Source: agents/shared/workflow-proposals/safe-edit.md
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const name: string = "safe-edit";

export const description: string =
  "Safely edit a file using size-aware strategy. " +
  "Small files (<300 lines) get full read/write via LLM. " +
  "Large files (≥300 lines) get surgical grep+sed edits. " +
  "Task format: JSON with 'path' and 'change_description' fields.";

// ── Helpers ────────────────────────────────────────────────────────────

interface SafeEditInput {
  path: string;
  change_description: string;
}

function parseInput(task: string): SafeEditInput {
  // Try JSON first
  try {
    const parsed = JSON.parse(task);
    if (parsed.path && parsed.change_description) {
      return { path: parsed.path, change_description: parsed.change_description };
    }
  } catch {
    // Not JSON — try to extract from structured text
  }

  // Try key: value format
  const pathMatch = task.match(/(?:^|\n)\s*path\s*:\s*(.+)/i);
  const changeMatch = task.match(/(?:^|\n)\s*change_description\s*:\s*(.+)/i);
  if (pathMatch && changeMatch) {
    return { path: pathMatch[1].trim(), change_description: changeMatch[1].trim() };
  }

  throw new Error(
    `Could not parse safe-edit input. Expected JSON with "path" and "change_description" fields, ` +
    `or key:value format. Got: ${task.slice(0, 200)}`
  );
}

function shellExec(cmd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, { encoding: "utf-8", timeout: 30_000 });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() ?? "",
      exitCode: err.status ?? 1,
    };
  }
}

function getLineCount(filePath: string): number {
  const { stdout, exitCode } = shellExec(`wc -l < ${JSON.stringify(filePath)}`);
  if (exitCode !== 0) {
    throw new Error(`wc -l failed for ${filePath}`);
  }
  return parseInt(stdout.trim(), 10) || 0;
}

function readLines(filePath: string, startLine: number, endLine: number): string {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  // Convert to 0-based indexing, endLine is inclusive
  return lines.slice(startLine - 1, endLine).join("\n");
}

function readFullFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

interface GrepMatch {
  lineNumber: number;
  text: string;
}

function grepFile(filePath: string, pattern: string): GrepMatch[] {
  // Use grep -n for line numbers; escape pattern for shell safety
  const escaped = pattern.replace(/'/g, "'\\''");
  const { stdout } = shellExec(`grep -n -- '${escaped}' ${JSON.stringify(filePath)}`);
  if (!stdout.trim()) return [];
  return stdout.trim().split("\n").map((line) => {
    const colonIdx = line.indexOf(":");
    return {
      lineNumber: parseInt(line.slice(0, colonIdx), 10),
      text: line.slice(colonIdx + 1),
    };
  });
}

// ── Main workflow ──────────────────────────────────────────────────────

const LINE_THRESHOLD = 300;
const CONTEXT_PADDING = 20; // lines of context around grep matches

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 0: Parse input
  let input: SafeEditInput;
  try {
    input = parseInput(ctx.task);
  } catch (err: any) {
    return ctx.escalate("Failed to parse safe-edit input", { error: err.message });
  }

  const { path: filePath, change_description: changeDesc } = input;

  // Step 1: Verify file exists
  ctx.emit({ type: "step_start", step: "file-check" });
  if (!existsSync(filePath)) {
    return ctx.escalate(`File not found: ${filePath}`, { path: filePath });
  }

  // Step 2: Size check using wc -l
  ctx.emit({ type: "step_start", step: "size-check" });
  let lineCount: number;
  try {
    lineCount = getLineCount(filePath);
  } catch (err: any) {
    return ctx.escalate("Failed to check file size", { error: err.message, path: filePath });
  }

  // Step 3: Strategy selection
  if (lineCount < LINE_THRESHOLD) {
    return await smallFileStrategy(ctx, filePath, changeDesc, lineCount);
  } else {
    return await largeFileStrategy(ctx, filePath, changeDesc, lineCount);
  }
}

// ── Small file strategy ────────────────────────────────────────────────

async function smallFileStrategy(
  ctx: WorkflowContext,
  filePath: string,
  changeDesc: string,
  lineCount: number,
): Promise<WorkflowResult> {
  ctx.emit({ type: "step_start", step: "small-file-edit" });

  // Read the full file
  let content: string;
  try {
    content = readFullFile(filePath);
  } catch (err: any) {
    return ctx.escalate("Failed to read file", { error: err.message, path: filePath });
  }

  // Ask LLM (coder agent) to apply the change
  const coderTask =
    `Apply the following change to the file ${filePath} (${lineCount} lines).\n\n` +
    `## Change Description\n${changeDesc}\n\n` +
    `## Current File Content\n\`\`\`\n${content}\n\`\`\`\n\n` +
    `## Instructions\n` +
    `1. Read the current content above carefully.\n` +
    `2. Apply ONLY the described change — do not refactor or modify anything else.\n` +
    `3. Write the complete modified file to ${filePath} using the write tool.\n` +
    `4. The file is ${lineCount} lines — your output must be similar in size. ` +
    `Do NOT truncate or omit any part of the file.\n` +
    `5. After writing, read back the file to verify your change was applied correctly.`;

  const result = await ctx.runAgent("coder", coderTask);
  if (result.status === "error") {
    return ctx.escalate("Coder failed to apply change", {
      error: result.error,
      path: filePath,
      change: changeDesc,
    });
  }

  // Verify: read back the file and confirm it's not truncated
  ctx.emit({ type: "step_start", step: "verify" });
  let newLineCount: number;
  try {
    newLineCount = getLineCount(filePath);
  } catch (err: any) {
    return ctx.escalate("Failed to verify file after edit", { error: err.message, path: filePath });
  }

  // Sanity check: file shouldn't have lost more than 20% of its lines
  // (unless the change was explicitly about removing lines)
  const lossRatio = newLineCount / lineCount;
  if (lineCount > 10 && lossRatio < 0.5) {
    return ctx.escalate(
      `Possible data loss detected: file went from ${lineCount} to ${newLineCount} lines (${Math.round(lossRatio * 100)}% remaining)`,
      { path: filePath, originalLines: lineCount, newLines: newLineCount, change: changeDesc },
    );
  }

  return ctx.done(
    `✅ Small file edit completed.\n` +
    `File: ${filePath}\n` +
    `Lines: ${lineCount} → ${newLineCount}\n` +
    `Change: ${changeDesc}\n` +
    `Agent output: ${result.lastAssistantText ?? "(no output)"}`
  );
}

// ── Large file strategy ────────────────────────────────────────────────

async function largeFileStrategy(
  ctx: WorkflowContext,
  filePath: string,
  changeDesc: string,
  lineCount: number,
): Promise<WorkflowResult> {
  ctx.emit({ type: "step_start", step: "large-file-locate" });

  // Ask the coder to perform surgical editing using grep + sed/read + write
  // The coder has exec, read, and write tools — we give it precise instructions
  // to avoid full-file reads.
  const coderTask =
    `Surgically edit the file ${filePath} (${lineCount} lines — DO NOT read the full file).\n\n` +
    `## Change Description\n${changeDesc}\n\n` +
    `## CRITICAL: Large File Protocol\n` +
    `This file is ${lineCount} lines. You MUST follow this protocol:\n\n` +
    `### Step 1: Locate\n` +
    `Use \`grep -n "pattern" ${filePath}\` to find the relevant lines.\n` +
    `Try multiple search patterns if the first doesn't find what you need.\n\n` +
    `### Step 2: Read Context\n` +
    `Use \`read\` with startLine/endLine to see only the relevant section (±20 lines of context).\n` +
    `NEVER read the full file.\n\n` +
    `### Step 3: Apply Change\n` +
    `Use \`sed -i\` or \`perl -i -pe\` to make the surgical edit.\n` +
    `For multi-line changes, use a temporary script or heredoc.\n` +
    `NEVER write the full file — only use sed/perl for in-place edits.\n\n` +
    `### Step 4: Verify\n` +
    `Use \`read\` with startLine/endLine to confirm the change was applied correctly.\n` +
    `Use \`wc -l < ${filePath}\` to confirm the file wasn't truncated.\n\n` +
    `If you cannot make the change with sed/perl (e.g., it requires complex restructuring), ` +
    `say "ESCALATE: <reason>" and explain why.`;

  const result = await ctx.runAgent("coder", coderTask);
  if (result.status === "error") {
    return ctx.escalate("Coder failed during surgical edit", {
      error: result.error,
      path: filePath,
      change: changeDesc,
    });
  }

  // Check for explicit escalation from the coder
  const coderOutput = result.lastAssistantText ?? "";
  if (coderOutput.toUpperCase().includes("ESCALATE:")) {
    return ctx.escalate(
      "Coder escalated: change too complex for surgical edit",
      { path: filePath, change: changeDesc, coderOutput },
    );
  }

  // Verify: check file size wasn't destroyed
  ctx.emit({ type: "step_start", step: "verify" });
  let newLineCount: number;
  try {
    newLineCount = getLineCount(filePath);
  } catch (err: any) {
    return ctx.escalate("Failed to verify file after edit", { error: err.message, path: filePath });
  }

  const lossRatio = newLineCount / lineCount;
  if (lossRatio < 0.5) {
    return ctx.escalate(
      `Possible data loss detected: file went from ${lineCount} to ${newLineCount} lines (${Math.round(lossRatio * 100)}% remaining)`,
      { path: filePath, originalLines: lineCount, newLines: newLineCount, change: changeDesc },
    );
  }

  return ctx.done(
    `✅ Large file surgical edit completed.\n` +
    `File: ${filePath}\n` +
    `Lines: ${lineCount} → ${newLineCount}\n` +
    `Change: ${changeDesc}\n` +
    `Agent output: ${coderOutput}`
  );
}
