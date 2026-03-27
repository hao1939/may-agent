/**
 * context-learn.ts — Post-session context extraction.
 *
 * Reads a completed session's transcript, extracts durable project facts,
 * and writes them to agents/<name>/context.md.
 *
 * Triggered by the "context-learn" event emitted after evaluation.
 * Mechanical extraction only — no LLM needed.
 *
 * What it extracts:
 *   - Commands that failed then succeeded (agent discovered the right command)
 *   - File paths the agent discovered after searching
 *   - Error patterns that required workarounds
 *   - Project runtime/tooling facts from config files read
 *
 * What it ignores:
 *   - Session-specific details ("fixed typo in line 42")
 *   - Things that are obvious from file contents
 *   - Anything already in context.md
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface ContextLearnOptions {
  /** Path to the agent's directory (agents/<name>/) */
  agentDir: string;
  /** Session transcript as message objects */
  messages: Array<{
    role: string;
    content: unknown;
    toolName?: string;
    isError?: boolean;
  }>;
  /** Max size of context.md in bytes */
  maxSize?: number;
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  index: number;
}

interface ToolResult {
  toolName: string;
  content: string;
  isError: boolean;
  index: number;
}

/** Extract durable facts from a session transcript and update context.md. */
export function learnFromSession(opts: ContextLearnOptions): { added: string[]; removed: string[] } {
  const { agentDir, messages, maxSize = 2048 } = opts;
  const contextPath = join(agentDir, "context.md");

  // Parse tool calls and results
  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content as Array<Record<string, unknown>>) {
        if (part.type === "toolCall" || part.type === "tool_use") {
          const args = typeof part.arguments === "string"
            ? tryParseJson(part.arguments)
            : (part.arguments ?? part.input ?? {}) as Record<string, unknown>;
          toolCalls.push({ name: (part.name ?? part.toolName ?? "") as string, args, index: i });
        }
      }
    }
    if (msg.role === "toolResult" || msg.role === "tool") {
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? (msg.content as Array<{ text?: string }>).map(p => p.text ?? "").join("\n")
          : "";
      toolResults.push({
        toolName: (msg.toolName ?? "") as string,
        content: text,
        isError: msg.isError === true,
        index: i,
      });
    }
  }

  const facts: string[] = [];

  // Pattern 1: Command correction — bash failed then a similar command succeeded
  extractCommandCorrections(toolCalls, toolResults, facts);

  // Pattern 2: Runtime/tooling discovery from config files
  extractRuntimeFacts(toolCalls, toolResults, facts);

  // Pattern 3: Path discovery after failed attempts
  extractPathDiscoveries(toolCalls, toolResults, facts);

  if (facts.length === 0) {
    return { added: [], removed: [] };
  }

  // Load existing context.md
  let existing: string[] = [];
  try {
    existing = readFileSync(contextPath, "utf-8").split("\n");
  } catch { /* file may not exist */ }

  // Deduplicate against existing content
  const added: string[] = [];
  for (const fact of facts) {
    const normalized = fact.toLowerCase().trim();
    if (!existing.some(line => line.toLowerCase().includes(normalized))) {
      existing.push(`- ${fact}`);
      added.push(fact);
    }
  }

  if (added.length === 0) {
    return { added: [], removed: [] };
  }

  // Trim to max size (drop oldest lines first)
  let content = existing.join("\n");
  while (content.length > maxSize) {
    const idx = content.indexOf("\n", 1);
    if (idx === -1) break;
    content = content.slice(idx + 1);
  }

  mkdirSync(dirname(contextPath), { recursive: true });
  writeFileSync(contextPath, content);

  return { added, removed: [] };
}

// ── Pattern extractors ─────────────────────────────────────────────────

function extractCommandCorrections(calls: ToolCall[], results: ToolResult[], facts: string[]): void {
  // Find bash commands that failed, then a corrected version succeeded
  const bashCalls = calls.filter(c => c.name === "bash");
  const bashResults = results.filter(r => r.toolName === "bash");

  for (let i = 0; i < bashCalls.length - 1; i++) {
    const call = bashCalls[i];
    const result = bashResults.find(r => r.index > call.index && r.index < (bashCalls[i + 1]?.index ?? Infinity));
    if (!result || !result.isError) continue;

    const failedCmd = String(call.args.command ?? "");
    const errorText = result.content.slice(0, 500).toLowerCase();

    // Look for a subsequent successful bash call that's similar
    for (let j = i + 1; j < bashCalls.length; j++) {
      const nextCall = bashCalls[j];
      const nextResult = bashResults.find(r => r.index > nextCall.index && r.index < (bashCalls[j + 1]?.index ?? Infinity));
      if (!nextResult || nextResult.isError) continue;

      const successCmd = String(nextCall.args.command ?? "");

      // npm → bun correction
      if (failedCmd.startsWith("npm ") && successCmd.startsWith("bun ")) {
        facts.push(`Use 'bun' not 'npm' — '${failedCmd.slice(0, 40)}' failed, '${successCmd.slice(0, 40)}' worked`);
        break;
      }
      // node → bun/deno correction
      if (failedCmd.startsWith("node ") && (successCmd.startsWith("bun ") || successCmd.startsWith("deno "))) {
        const runtime = successCmd.split(" ")[0];
        facts.push(`Use '${runtime}' not 'node' — '${failedCmd.slice(0, 40)}' failed, '${successCmd.slice(0, 40)}' worked`);
        break;
      }
      // npm test → other test runner
      if (failedCmd.includes("npm test") && (successCmd.includes("bun test") || successCmd.includes("deno test") || successCmd.includes("vitest") || successCmd.includes("jest"))) {
        facts.push(`Test runner: '${successCmd.slice(0, 50)}' (not 'npm test')`);
        break;
      }
      // command not found → correct command
      if (errorText.includes("command not found") || errorText.includes("not found")) {
        const failedBin = failedCmd.split(" ")[0];
        const successBin = successCmd.split(" ")[0];
        if (failedBin !== successBin) {
          facts.push(`Use '${successBin}' not '${failedBin}' — '${failedBin}' not available`);
          break;
        }
      }

      // General: same base command, different args — failed then succeeded
      // e.g., "bun test/file.js" failed → "bun test" worked
      const failedParts = failedCmd.split(/\s+/);
      const successParts = successCmd.split(/\s+/);
      if (failedParts[0] === successParts[0] && failedCmd !== successCmd) {
        // Only capture if the commands are meaningfully different (not just cd prefix differences)
        const failedCore = failedCmd.replace(/^cd [^ ]+ && /, "");
        const successCore = successCmd.replace(/^cd [^ ]+ && /, "");
        if (failedCore !== successCore && failedCore.split(/\s+/)[0] === successCore.split(/\s+/)[0]) {
          facts.push(`Correct command: '${successCore.slice(0, 60)}' (not '${failedCore.slice(0, 60)}')`);
          break;
        }
      }
    }
  }
}

function extractRuntimeFacts(calls: ToolCall[], results: ToolResult[], facts: string[]): void {
  // Look for config files that reveal runtime/tooling info
  const readCalls = calls.filter(c => c.name === "read");

  for (const call of readCalls) {
    const path = String(call.args.path ?? "");
    const result = results.find(r => r.index > call.index && !r.isError);
    if (!result) continue;
    const content = result.content;

    // deno.json → Deno runtime
    if (path.endsWith("deno.json") || path.endsWith("deno.jsonc")) {
      facts.push("Project uses Deno runtime (deno.json found)");
    }
    // bunfig.toml or package.json with bun references
    if (path.endsWith("bunfig.toml")) {
      facts.push("Project uses Bun runtime (bunfig.toml found)");
    }
    // package.json with engine hints
    if (path.endsWith("package.json") && content.includes('"bun"')) {
      if (content.includes('"runtime"') && content.includes('"bun"')) {
        facts.push("Project uses Bun runtime (package.json runtime field)");
      }
    }
  }
}

function extractPathDiscoveries(calls: ToolCall[], results: ToolResult[], facts: string[]): void {
  // Find read/bash calls that failed with "not found" then agent found the right path
  const readCalls = calls.filter(c => c.name === "read");

  for (let i = 0; i < readCalls.length - 1; i++) {
    const call = readCalls[i];
    const result = results.find(r => r.index > call.index);
    if (!result || !result.isError) continue;

    const failedPath = String(call.args.path ?? "");
    if (!failedPath) continue;

    // Look for a successful read of a similar file
    for (let j = i + 1; j < readCalls.length; j++) {
      const nextCall = readCalls[j];
      const nextResult = results.find(r => r.index > nextCall.index);
      if (!nextResult || nextResult.isError) continue;

      const successPath = String(nextCall.args.path ?? "");
      // Same filename, different directory
      const failedFile = failedPath.split("/").pop();
      const successFile = successPath.split("/").pop();
      if (failedFile && failedFile === successFile && failedPath !== successPath) {
        facts.push(`'${successFile}' is at '${successPath}' (not '${failedPath}')`);
        break;
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function tryParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
