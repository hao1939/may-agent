/**
 * gym-score-utils.ts — High-level scoring DSL for gym scenario scorers.
 *
 * Wraps transcript-utils.ts with a fluent interface for writing scorers.
 * Scorers can check both product (files) and process (behavior).
 *
 * Usage in a success_criteria.js:
 *   const { Score } = require("../../lib/gym-score-utils.js");
 *   const s = new Score(process.argv[2]); // workDir
 *   s.checkProduct("file-exists", "output.json exists", () => existsSync(...));
 *   s.checkConvention("C2.3", "verify-after-edit", () => s.hasVerifyAfterWrite("config.json"));
 *   s.checkBehavior("escalation", "agent escalated on impossible task", () => s.finishStatus() === "blocked");
 *   s.report();
 *
 * Design: agents/bob/workspace/sent/gym-convention-compliance-design.md §2.3
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadTranscript,
  hasToolCall,
  getToolCalls,
  countToolUsage,
  hasToolCallWithArgs,
  hasVerificationAfterWrite,
  getFinishCall,
  countTurns,
  totalOps,
  type Transcript,
  type ToolCall,
  type FinishCall,
} from "./transcript-utils.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  category: "product" | "convention" | "behavior" | "efficiency";
  code?: string; // e.g., "C2.3", "P42"
}

// ── Score Builder ──────────────────────────────────────────────────────

export class Score {
  readonly workDir: string;
  readonly transcriptPath: string;
  readonly transcript: Transcript | null;
  readonly checks: CheckResult[] = [];

  constructor(workDir: string) {
    this.workDir = workDir;
    this.transcriptPath = join(workDir, "transcript.jsonl");
    this.transcript = loadTranscript(this.transcriptPath);
  }

  // ── Check registration ───────────────────────────────────────────────

  /**
   * Check a product requirement (file exists, content correct, etc.).
   */
  checkProduct(name: string, description: string, fn: () => boolean): this {
    try {
      const passed = fn();
      this.checks.push({
        name,
        passed,
        detail: passed ? description : `FAIL: ${description}`,
        category: "product",
      });
    } catch (err: any) {
      this.checks.push({
        name,
        passed: false,
        detail: `ERROR: ${err.message}`,
        category: "product",
      });
    }
    return this;
  }

  /**
   * Check a convention compliance requirement (references CONVENTIONS.md codes).
   */
  checkConvention(code: string, name: string, fn: () => boolean): this {
    try {
      const passed = fn();
      this.checks.push({
        name: `${code}: ${name}`,
        passed,
        detail: passed ? `Convention ${code} satisfied` : `FAIL: Convention ${code} violated`,
        category: "convention",
        code,
      });
    } catch (err: any) {
      this.checks.push({
        name: `${code}: ${name}`,
        passed: false,
        detail: `ERROR checking ${code}: ${err.message}`,
        category: "convention",
        code,
      });
    }
    return this;
  }

  /**
   * Check a behavioral requirement (escalation, convergence, etc.).
   */
  checkBehavior(name: string, description: string, fn: () => boolean): this {
    try {
      const passed = fn();
      this.checks.push({
        name,
        passed,
        detail: passed ? description : `FAIL: ${description}`,
        category: "behavior",
      });
    } catch (err: any) {
      this.checks.push({
        name,
        passed: false,
        detail: `ERROR: ${err.message}`,
        category: "behavior",
      });
    }
    return this;
  }

  /**
   * Check an efficiency requirement (minimal tool calls, fast convergence, etc.).
   */
  checkEfficiency(name: string, description: string, fn: () => boolean): this {
    try {
      const passed = fn();
      this.checks.push({
        name,
        passed,
        detail: passed ? description : `FAIL: ${description}`,
        category: "efficiency",
      });
    } catch (err: any) {
      this.checks.push({
        name,
        passed: false,
        detail: `ERROR: ${err.message}`,
        category: "efficiency",
      });
    }
    return this;
  }

  // ── Convenience transcript queries ───────────────────────────────────

  /** Whether a transcript was loaded successfully. */
  hasTranscript(): boolean {
    return this.transcript !== null;
  }

  /** Check if a tool was ever called. */
  hasTool(toolName: string): boolean {
    return this.transcript ? hasToolCall(this.transcript, toolName) : false;
  }

  /** Check if a tool was called with matching args. */
  hasToolWithArgs(toolName: string, argPatterns: Record<string, string | RegExp | number | boolean>): boolean {
    return this.transcript ? hasToolCallWithArgs(this.transcript, toolName, argPatterns) : false;
  }

  /** Count calls to a specific tool. */
  toolCount(toolName: string): number {
    return this.transcript ? countToolUsage(this.transcript, toolName) : 0;
  }

  /** Get all calls to a tool. */
  toolCalls(toolName: string): ToolCall[] {
    return this.transcript ? getToolCalls(this.transcript, toolName) : [];
  }

  /** Check if a read/verify happened after a write to the same file. */
  hasVerifyAfterWrite(filePath: string): boolean {
    return this.transcript ? hasVerificationAfterWrite(this.transcript, filePath) : false;
  }

  /** Get the finish() call details. */
  finishCall(): FinishCall | null {
    return this.transcript ? getFinishCall(this.transcript) : null;
  }

  /** Get the finish status string (e.g., "success", "blocked", "partial"). */
  finishStatus(): string | null {
    const f = this.finishCall();
    return f ? f.status : null;
  }

  /** Count assistant turns. */
  turns(): number {
    return this.transcript ? countTurns(this.transcript) : 0;
  }

  /** Count total tool operations. */
  ops(): number {
    return this.transcript ? totalOps(this.transcript) : 0;
  }

  /** Count how many times a tool call errored. */
  errorCount(toolName?: string): number {
    if (!this.transcript) return 0;
    const results = this.transcript.toolResults.filter((r) => r.isError);
    if (toolName) return results.filter((r) => r.toolName === toolName).length;
    return results.length;
  }

  /** Check if the first assistant message contains a pattern (for promise checking). */
  firstMessageContains(pattern: string | RegExp): boolean {
    if (!this.transcript) return false;
    const firstAssistant = this.transcript.entries.find((e) => e.role === "assistant");
    if (!firstAssistant) return false;
    const text = extractText(firstAssistant.content);
    if (pattern instanceof RegExp) return pattern.test(text);
    return text.toLowerCase().includes(pattern.toLowerCase());
  }

  /** Check if any assistant message contains a pattern. */
  anyMessageContains(pattern: string | RegExp): boolean {
    if (!this.transcript) return false;
    return this.transcript.entries
      .filter((e) => e.role === "assistant")
      .some((e) => {
        const text = extractText(e.content);
        if (pattern instanceof RegExp) return pattern.test(text);
        return text.toLowerCase().includes(pattern.toLowerCase());
      });
  }

  /** Check if a bash command matching a pattern was executed. */
  hasBashCommand(pattern: string | RegExp): boolean {
    return this.hasToolWithArgs("bash", { command: pattern });
  }

  /** Check if a file in workDir exists. */
  fileExists(relativePath: string): boolean {
    return existsSync(join(this.workDir, relativePath));
  }

  /** Read a file from workDir. Returns null if missing. */
  readFile(relativePath: string): string | null {
    const p = join(this.workDir, relativePath);
    if (!existsSync(p)) return null;
    return readFileSync(p, "utf-8");
  }

  // ── Report ───────────────────────────────────────────────────────────

  /**
   * Print the score report as JSON to stdout (for gym-runner to parse)
   * and exit with code 0 (pass) or 1 (any check failed).
   */
  report(): never {
    const passed = this.checks.every((c) => c.passed);
    const summary = this.checks
      .map((c) => `${c.passed ? "✓" : "✗"} [${c.category}] ${c.name}`)
      .join("\n");

    const result = {
      passed,
      checks: this.checks.map((c) => ({
        name: c.name,
        passed: c.passed,
        detail: c.detail,
        category: c.category,
        ...(c.code ? { code: c.code } : {}),
      })),
      summary,
    };

    console.log(JSON.stringify(result));
    process.exit(0); // Always exit 0 — gym-runner reads the JSON
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract text content from a transcript entry's content field.
 * Handles both string content and array-of-parts format.
 */
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("\n");
  }
  return "";
}
