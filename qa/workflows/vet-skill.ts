/// <reference path="../../../src/workflow-defs.d.ts" />

/**
 * vet-skill workflow — Skill Vetter (Security Static Analysis)
 *
 * Scans a skill/tool definition file for dangerous patterns that indicate
 * supply-chain attacks: obfuscated payloads, remote code execution,
 * eval/exec injection, and prompt injection attempts.
 *
 * Source: agents/bob/workspace/ralph-experiment-1.md
 *
 * Input:  Task string containing a file path (JSON `{"path":"..."}` or plain path).
 * Output: `{ status: "PASS" | "FAIL" | "WARN", issues: string[] }`
 */

import { readFileSync, existsSync } from "node:fs";

export const name: string = "vet-skill";

export const description: string =
  "Static-analysis security scan for skill/tool files. " +
  "Detects base64 obfuscation, curl/wget piping to shell, eval/exec injection, " +
  "and prompt injection attempts. " +
  "Task format: JSON with 'path' field, or a plain file path string.";

// ── Types ──────────────────────────────────────────────────────────────

interface VetResult {
  status: "PASS" | "FAIL" | "WARN";
  issues: string[];
}

interface DangerPattern {
  id: string;
  severity: "FAIL" | "WARN";
  pattern: RegExp;
  description: string;
}

// ── Danger Patterns ────────────────────────────────────────────────────

const DANGER_PATTERNS: DangerPattern[] = [
  // 1. Obfuscation — base64 encoding used to hide payloads
  {
    id: "BASE64_USAGE",
    severity: "FAIL",
    pattern: /\bbase64\b/gi,
    description: "base64 encoding/decoding detected — may hide malicious payloads",
  },
  {
    id: "B64DECODE",
    severity: "FAIL",
    pattern: /\bb64decode\b/gi,
    description: "b64decode call detected — likely obfuscated payload",
  },

  // 2. Remote execution — curl/wget piped to a shell
  {
    id: "CURL_PIPE_SHELL",
    severity: "FAIL",
    pattern: /(\||>)[^`\n]*\b(bash|sh|zsh)\b/gi,
    description: "Output piped to shell — potential remote code execution",
  },

  // 3. Dynamic code execution — eval / exec with non-literal args
  {
    id: "EVAL_CALL",
    severity: "FAIL",
    pattern: /\beval\s*\(/gi,
    description: "eval() detected — arbitrary code execution risk",
  },
  {
    id: "EXEC_CALL",
    severity: "WARN",
    pattern: /\bexec\s*\(/gi,
    description: "exec() detected — review arguments for injection risk",
  },

  // 4. Prompt injection — attempts to override system prompts
  {
    id: "PROMPT_INJECTION_IGNORE",
    severity: "FAIL",
    pattern: /ignore\s+(all\s+)?previous\s+instructions/gi,
    description: "Prompt injection attempt: 'ignore previous instructions'",
  },
  {
    id: "PROMPT_INJECTION_SYSTEM",
    severity: "FAIL",
    pattern: /you\s+are\s+now\s+(a|an)\s+/gi,
    description: "Prompt injection attempt: role reassignment",
  },
  {
    id: "PROMPT_INJECTION_DISREGARD",
    severity: "FAIL",
    pattern: /disregard\s+(all\s+)?(prior|previous|above)\s+/gi,
    description: "Prompt injection attempt: 'disregard prior instructions'",
  },
  {
    id: "PROMPT_INJECTION_OVERRIDE",
    severity: "FAIL",
    pattern: /\bnew\s+instructions?\s*:/gi,
    description: "Prompt injection attempt: 'new instructions' override",
  },

  // 5. Additional shell dangers
  {
    id: "SHELL_REVERSE",
    severity: "FAIL",
    pattern: /\/dev\/(tcp|udp)\//gi,
    description: "Reverse shell pattern detected (/dev/tcp or /dev/udp)",
  },
  {
    id: "PYTHON_EXEC",
    severity: "WARN",
    pattern: /python[23]?\s+-c\s+/gi,
    description: "Inline python execution — review for malicious code",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function parseInput(task: string): string {
  // Try JSON first
  try {
    const parsed = JSON.parse(task);
    if (typeof parsed.path === "string") {
      return parsed.path.trim();
    }
  } catch {
    // Not JSON
  }

  // Try key:value format
  const match = task.match(/(?:^|\n)\s*path\s*:\s*(.+)/i);
  if (match) {
    return match[1].trim();
  }

  // Assume the entire task is a file path (trim whitespace and quotes)
  const cleaned = task.trim().replace(/^["']|["']$/g, "");
  if (cleaned.length > 0 && cleaned.length < 500 && !cleaned.includes("\n")) {
    return cleaned;
  }

  throw new Error(
    `Could not parse vet-skill input. Expected a file path, JSON {"path":"..."}, ` +
    `or "path: <filepath>". Got: ${task.slice(0, 200)}`
  );
}

function scanContent(content: string, filePath: string): VetResult {
  const issues: string[] = [];
  const lines = content.split("\n");
  let worstSeverity: "PASS" | "WARN" | "FAIL" = "PASS";

  for (const dp of DANGER_PATTERNS) {
    // Check each line individually to report line numbers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Reset regex lastIndex (since we use /g flag)
      dp.pattern.lastIndex = 0;
      if (dp.pattern.test(line)) {
        const lineNum = i + 1;
        const trimmedLine = line.trim();
        const preview = trimmedLine.length > 120
          ? trimmedLine.slice(0, 120) + "…"
          : trimmedLine;
        issues.push(
          `[${dp.severity}] ${dp.id}: ${dp.description} ` +
          `(${filePath}:${lineNum}: \`${preview}\`)`
        );

        // Escalate severity
        if (dp.severity === "FAIL") {
          worstSeverity = "FAIL";
        } else if (dp.severity === "WARN" && worstSeverity !== "FAIL") {
          worstSeverity = "WARN";
        }
      }
    }
  }

  // Heuristic: detect high-entropy strings (potential encrypted/encoded payloads)
  // A simple check: any string of 40+ alphanumeric chars with mixed case
  const highEntropyPattern = /[A-Za-z0-9+/=]{40,}/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    highEntropyPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = highEntropyPattern.exec(line)) !== null) {
      const sample = match[0];
      // Only flag if it has mixed case (not all-lower or all-upper — those are likely normal)
      const hasUpper = /[A-Z]/.test(sample);
      const hasLower = /[a-z]/.test(sample);
      const hasDigit = /[0-9]/.test(sample);
      if (hasUpper && hasLower && hasDigit) {
        const lineNum = i + 1;
        const preview = sample.length > 60 ? sample.slice(0, 60) + "…" : sample;
        issues.push(
          `[WARN] HIGH_ENTROPY: Suspicious high-entropy string (${sample.length} chars) ` +
          `(${filePath}:${lineNum}: \`${preview}\`)`
        );
        if (worstSeverity === "PASS") {
          worstSeverity = "WARN";
        }
        break; // One warning per line is enough
      }
    }
  }

  return { status: worstSeverity, issues };
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 0: Parse input
  let filePath: string;
  try {
    filePath = parseInput(ctx.task);
  } catch (err: any) {
    return ctx.escalate("Failed to parse vet-skill input", { error: err.message });
  }

  // Step 1: Verify file exists
  ctx.emit({ type: "step_start", step: "file-check" });
  if (!existsSync(filePath)) {
    return ctx.escalate(`File not found: ${filePath}`, { path: filePath });
  }

  // Step 2: Read file content
  ctx.emit({ type: "step_start", step: "read-file" });
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err: any) {
    return ctx.escalate(`Failed to read file: ${filePath}`, { error: err.message });
  }

  // Step 3: Run static analysis
  ctx.emit({ type: "step_start", step: "static-analysis" });
  const result = scanContent(content, filePath);

  // Step 4: Build summary
  const statusEmoji = result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "🚫";
  const summary = [
    `${statusEmoji} Skill Vetter: **${result.status}**`,
    `File: ${filePath}`,
    `Issues found: ${result.issues.length}`,
    "",
    ...result.issues.map((issue) => `- ${issue}`),
  ].join("\n");

  // Emit the structured result as JSON for programmatic consumption
  const jsonResult = JSON.stringify({ status: result.status, issues: result.issues }, null, 2);

  ctx.emit({ type: "step_start", step: "result" });

  if (result.status === "FAIL") {
    // For FAIL, we still return done (the scan completed successfully),
    // but the summary makes the failure clear
    return ctx.done(`${summary}\n\n---\nJSON Result:\n\`\`\`json\n${jsonResult}\n\`\`\``);
  }

  return ctx.done(`${summary}\n\n---\nJSON Result:\n\`\`\`json\n${jsonResult}\n\`\`\``);
}
