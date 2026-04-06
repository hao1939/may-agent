#!/usr/bin/env bun
/**
 * EXP-039 Phase A: Compare contextual vs isolated transcript formatting.
 *
 * This script demonstrates the information isolation by formatting real
 * session transcripts both ways and showing what gets stripped.
 *
 * Usage:
 *   bun scripts/exp039-compare-transcripts.ts [sessionId]
 *
 * If no sessionId, picks a recent completed session from .state/sessions/.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Import both formatters
// We can't import directly in a script context easily, so we inline the logic
// by reading the session and calling our functions

const SESSIONS_DIR = ".state/sessions";

interface SimpleMessage {
  role: string;
  content: any;
  toolName?: string;
  toolCallId?: string;
}

function loadSessionMessages(sessionDir: string): SimpleMessage[] {
  const jsonlPath = join(sessionDir, "session.jsonl");
  if (!existsSync(jsonlPath)) return [];
  const text = readFileSync(jsonlPath, "utf-8");
  const messages: SimpleMessage[] = [];
  for (const line of text.trim().split("\n")) {
    try {
      const msg = JSON.parse(line);
      if (msg && typeof msg === "object" && msg.role) {
        messages.push(msg);
      }
    } catch { /* skip */ }
  }
  return messages;
}

function formatContextual(messages: SimpleMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (!msg.role) continue;
    lines.push(`## ${msg.role}`);

    if (msg.role === "toolResult") {
      const fullText = msg.content?.map((c: any) => (c.type === "text" ? c.text : "")).join("") ?? "";
      const text = fullText.slice(0, 2000);
      lines.push(`[tool_result: ${msg.toolName}] ${text}`);
    } else if (typeof msg.content === "string") {
      lines.push(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === "string") lines.push(block);
        else if (block.type === "text") lines.push(block.text);
        else if (block.type === "toolCall") {
          const args = JSON.stringify(block.arguments ?? block.input ?? {}).slice(0, 500);
          lines.push(`[tool_call: ${block.name}] ${args}`);
        }
        else if (block.type === "thinking") lines.push(`[thinking] ${block.thinking?.slice(0, 200)}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatIsolated(messages: SimpleMessage[]): string {
  const lines: string[] = [];
  let isFirstUser = true;

  for (const msg of messages) {
    if (!msg.role) continue;

    if (msg.role === "user") {
      if (isFirstUser) {
        lines.push(`## task_specification`);
        if (typeof msg.content === "string") {
          lines.push(msg.content);
        } else if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (typeof block === "string") lines.push(block);
            else if (block?.type === "text") lines.push(block.text);
          }
        }
        lines.push("");
        isFirstUser = false;
      }
      continue;
    }

    if (msg.role === "toolResult") {
      const fullText = msg.content?.map((c: any) => (c.type === "text" ? c.text : "")).join("") ?? "";
      const text = fullText.slice(0, 2000);
      const suffix = fullText.length > 2000 ? ` [truncated from ${fullText.length} chars]` : "";
      lines.push(`## tool_result: ${msg.toolName}`);
      lines.push(`${text}${suffix}`);
      lines.push("");
      continue;
    }

    if (msg.role === "assistant") {
      if (!Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        if (block?.type === "toolCall") {
          if (block.name === "finish") {
            const args = block.arguments ?? block.input ?? {};
            const sanitized: Record<string, unknown> = {};
            if (args.status) sanitized.status = args.status;
            if (args.blockers) sanitized.has_blockers = true;
            lines.push(`## tool_call: finish`);
            lines.push(JSON.stringify(sanitized));
          } else {
            const args = JSON.stringify(block.arguments ?? block.input ?? {}).slice(0, 500);
            lines.push(`## tool_call: ${block.name}`);
            lines.push(args);
          }
          lines.push("");
        }
      }
      continue;
    }
  }

  return lines.join("\n");
}

function countBlocks(messages: SimpleMessage[]): {
  userMessages: number;
  assistantTexts: number;
  thinkingBlocks: number;
  toolCalls: number;
  toolResults: number;
  finishCalls: number;
} {
  let userMessages = 0, assistantTexts = 0, thinkingBlocks = 0;
  let toolCalls = 0, toolResults = 0, finishCalls = 0;

  for (const msg of messages) {
    if (msg.role === "user") userMessages++;
    if (msg.role === "toolResult") toolResults++;
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text") assistantTexts++;
        if (block.type === "thinking") thinkingBlocks++;
        if (block.type === "toolCall") {
          toolCalls++;
          if (block.name === "finish") finishCalls++;
        }
      }
    }
  }
  return { userMessages, assistantTexts, thinkingBlocks, toolCalls, toolResults, finishCalls };
}

// ── Main ───────────────────────────────────────────────────────────────

const requestedId = process.argv[2];

// Find session directories
let sessionDirs: string[] = [];
if (requestedId) {
  const dir = join(SESSIONS_DIR, requestedId);
  if (existsSync(dir)) sessionDirs = [dir];
  else {
    console.error(`Session ${requestedId} not found in ${SESSIONS_DIR}`);
    process.exit(1);
  }
} else {
  // Find recent sessions with transcripts
  const entries = readdirSync(SESSIONS_DIR).filter(e => e.startsWith("s_"));
  sessionDirs = entries
    .map(e => join(SESSIONS_DIR, e))
    .filter(d => existsSync(join(d, "session.jsonl")))
    .sort()
    .slice(-5); // last 5 sessions
}

console.log("=" .repeat(72));
console.log("EXP-039: Contextual vs Isolated Transcript Comparison");
console.log("=" .repeat(72));

for (const dir of sessionDirs) {
  const sessionId = dir.split("/").pop() || "";
  const messages = loadSessionMessages(dir);
  if (messages.length === 0) continue;

  const contextual = formatContextual(messages);
  const isolated = formatIsolated(messages);
  const blocks = countBlocks(messages);

  const reductionPct = ((1 - isolated.length / contextual.length) * 100).toFixed(1);

  console.log(`\n${"─".repeat(72)}`);
  console.log(`Session: ${sessionId}`);
  console.log(`Messages: ${messages.length}`);
  console.log(`\nBlock counts:`);
  console.log(`  User messages:     ${blocks.userMessages} (isolated keeps: 1)`);
  console.log(`  Assistant texts:   ${blocks.assistantTexts} (isolated keeps: 0)`);
  console.log(`  Thinking blocks:   ${blocks.thinkingBlocks} (isolated keeps: 0)`);
  console.log(`  Tool calls:        ${blocks.toolCalls} (isolated keeps: ${blocks.toolCalls})`);
  console.log(`  Tool results:      ${blocks.toolResults} (isolated keeps: ${blocks.toolResults})`);
  console.log(`  finish() calls:    ${blocks.finishCalls} (isolated: status only)`);
  console.log(`\nTranscript sizes:`);
  console.log(`  Contextual:  ${(contextual.length / 1024).toFixed(1)} KB`);
  console.log(`  Isolated:    ${(isolated.length / 1024).toFixed(1)} KB`);
  console.log(`  Reduction:   ${reductionPct}%`);

  // Show what was stripped
  const strippedItems: string[] = [];
  if (blocks.assistantTexts > 0) strippedItems.push(`${blocks.assistantTexts} reasoning text blocks`);
  if (blocks.thinkingBlocks > 0) strippedItems.push(`${blocks.thinkingBlocks} thinking blocks`);
  if (blocks.userMessages > 1) strippedItems.push(`${blocks.userMessages - 1} follow-up user messages`);
  if (blocks.finishCalls > 0) strippedItems.push(`finish() self-narrative (summary/evidence/deliverables)`);

  console.log(`  Stripped:    ${strippedItems.join(", ")}`);

  // Show first 500 chars of each for comparison
  console.log(`\n--- Contextual (first 500 chars) ---`);
  console.log(contextual.slice(0, 500));
  console.log(`\n--- Isolated (first 500 chars) ---`);
  console.log(isolated.slice(0, 500));
}

console.log(`\n${"=".repeat(72)}`);
console.log(`\nKey insight: The isolated transcript contains only what the agent DID`);
console.log(`(tool calls + results), not what the agent SAID about what it did.`);
console.log(`A verifier reading the isolated version must form its own judgment`);
console.log(`from the raw artifacts, preventing confirmation bias from agent narrative.`);
