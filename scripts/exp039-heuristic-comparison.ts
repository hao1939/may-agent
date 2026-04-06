#!/usr/bin/env bun
/**
 * EXP-039 Phase A: Run isolated vs contextual heuristic evaluation.
 *
 * This script compares heuristic evaluation scores between:
 * - Control: Full session with agent self-narratives (current behavior)
 * - Treatment: Isolated session — only task + tool calls + tool results
 *
 * The key question: does removing agent self-narrative change how the
 * heuristic evaluator scores sessions? If so, which direction?
 *
 * Usage:
 *   bun scripts/exp039-heuristic-comparison.ts
 *
 * Reads all sessions in .state/sessions/ and scores each both ways.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SESSIONS_DIR = ".state/sessions";

interface SimpleMessage {
  role: string;
  content: any;
  toolName?: string;
  toolCallId?: string;
}

interface PersistedSession {
  id: string;
  agent: string;
  status: string;
  startedAt?: number;
  error?: string;
  task?: string;
  [key: string]: any;
}

function loadSessionMeta(sessionDir: string): PersistedSession | null {
  const metaPath = join(sessionDir, "meta.json");
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch { return null; }
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

/**
 * Extract finish() params from messages — mirrors evaluator.ts logic.
 */
function extractFinishParams(messages: SimpleMessage[]): Record<string, any> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    if (!Array.isArray(msg.content)) continue;
    for (let j = msg.content.length - 1; j >= 0; j--) {
      const block = msg.content[j];
      if (block?.type !== "toolCall" || block?.name !== "finish") continue;
      let args = block.arguments ?? block.input;
      if (typeof args === "string") {
        try { args = JSON.parse(args); } catch { continue; }
      }
      if (args && typeof args === "object") return args;
    }
  }
  return null;
}

/**
 * Build an "isolated" version of messages where agent self-narrative is stripped.
 * This simulates what the heuristic evaluator would see in the isolated condition.
 *
 * For the heuristic evaluator, the key changes are:
 * - finish() params are stripped (no summary/evidence/deliverables)
 * - The transcript string used for pattern matching has no agent reasoning
 */
function buildIsolatedTranscript(messages: SimpleMessage[]): string {
  const lines: string[] = [];
  let isFirstUser = true;

  for (const msg of messages) {
    if (!msg.role) continue;

    if (msg.role === "user") {
      if (isFirstUser) { isFirstUser = false; }
      // User messages contribute to transcript for pattern matching
      continue;
    }

    if (msg.role === "toolResult") {
      const fullText = msg.content?.map((c: any) => (c.type === "text" ? c.text : "")).join("") ?? "";
      const text = fullText.slice(0, 2000);
      lines.push(`[tool_result: ${msg.toolName}] ${text}`);
    }

    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "toolCall") {
          if (block.name === "finish") {
            // In isolated mode, finish exists but args are stripped
            lines.push(`"finish"`);
            lines.push(`"name":"finish"`);
          } else {
            const args = JSON.stringify(block.arguments ?? block.input ?? {}).slice(0, 500);
            lines.push(`"type":"toolCall"`);
            lines.push(`[tool_call: ${block.name}] ${args}`);
          }
        }
        // text and thinking blocks are STRIPPED
      }
    }
  }
  return lines.join("\n");
}

/**
 * Build a "contextual" transcript — same as current evaluator (full content).
 */
function buildContextualTranscript(messages: SimpleMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (!msg.role) continue;

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
          lines.push(`"type":"toolCall"`);
          lines.push(`"name":"${block.name}"`);
          lines.push(`[tool_call: ${block.name}] ${args}`);
          // Include finish args in contextual mode (self-narrative)
          if (block.name === "finish") {
            lines.push(`"finish"`);
            lines.push(`"name":"finish"`);
          }
        }
        else if (block.type === "thinking") lines.push(`[thinking]`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Simplified heuristic scorer matching evaluator.ts logic.
 * Returns scores for both contextual and isolated conditions.
 */
function scoreSession(
  session: PersistedSession,
  transcript: string,
  finishParams: Record<string, any> | null,
): {
  quality: number;
  efficiency: number;
  verdict: string;
  issues: string[];
} {
  let efficiency = 3;
  let quality = 3;
  const issues: string[] = [];

  const toolCallMatches = transcript.match(/"type":"toolCall"/g);
  const totalToolCalls = toolCallMatches?.length ?? 0;
  const assistantTurns = (transcript.match(/"role":"assistant"/g) || []).length;

  // 1. Session status
  if (session.status === "error") {
    const errMsg = session.error ?? "";
    if (/Turn limit reached/i.test(errMsg)) {
      efficiency -= 1;
      issues.push("turn_limit_hit");
    } else if (/litellm|BadRequestError/i.test(errMsg)) {
      issues.push("provider_error");
    } else {
      quality -= 1;
      issues.push("session_error");
    }
  }

  // 3. Shallow sessions
  if (assistantTurns <= 1 && totalToolCalls === 0) {
    quality -= 2;
    issues.push("shallow_session");
  }

  // 4. finish() scoring
  const hasFinishCall = transcript.includes('"finish"') || transcript.includes('"name":"finish"');

  if (finishParams) {
    const finishStatus = finishParams.status;
    const hasEvidence = Array.isArray(finishParams.verification_evidence) && finishParams.verification_evidence.length > 0;
    const hasDeliverables = Array.isArray(finishParams.deliverables) && finishParams.deliverables.length > 0;

    if (finishStatus === "success") {
      if (hasEvidence) {
        quality += 2;
        issues.push("finish_success_verified");
      } else {
        quality += 1;
        issues.push("finish_success_unverified");
      }
      if (hasDeliverables) issues.push("has_deliverables");
    } else if (finishStatus === "partial") {
      issues.push("finish_partial");
    } else if (finishStatus === "failure" || finishStatus === "blocked") {
      quality -= 1;
      issues.push(`finish_${finishStatus}`);
    }
  } else if (hasFinishCall) {
    quality += 1;
  } else if (session.status === "done" && assistantTurns > 2) {
    issues.push("no_finish_call");
  }

  // 5. Successful session with tool usage
  if (session.status === "done" && totalToolCalls >= 3) {
    efficiency += 1;
    quality += 1;
  }

  // 5b. Semantic quality signals
  if (finishParams && finishParams.status === "success") {
    const summary = finishParams.summary ?? "";
    const evidence = finishParams.verification_evidence ?? [];

    if (summary.length < 30) {
      quality -= 1;
      issues.push("hollow_summary");
    }

    if (evidence.length > 0) {
      const vagueEvidence = evidence.filter((e: unknown) => {
        const s = typeof e === "string" ? e : "";
        return s.length < 20 || !/step|bash|read|edit|write|test|output|exit|pass|fail|confirm/i.test(s);
      });
      if (vagueEvidence.length === evidence.length) {
        quality -= 1;
        issues.push("vague_verification_evidence");
      }
    }
  }

  efficiency = Math.max(1, Math.min(5, efficiency));
  quality = Math.max(1, Math.min(5, quality));

  let verdict: string;
  if (quality >= 4 && efficiency >= 4) verdict = "good";
  else if (quality >= 2 && efficiency >= 2) verdict = "acceptable";
  else verdict = "needs_improvement";

  return { quality, efficiency, verdict, issues };
}

// ── Main ───────────────────────────────────────────────────────────────

const entries = readdirSync(SESSIONS_DIR).filter(e => e.startsWith("s_"));
const sessionDirs = entries
  .map(e => join(SESSIONS_DIR, e))
  .filter(d => existsSync(join(d, "session.jsonl")) && existsSync(join(d, "meta.json")));

console.log("=" .repeat(76));
console.log("EXP-039 Phase A: Heuristic Evaluation — Contextual vs Isolated");
console.log("=" .repeat(76));
console.log(`Sessions found: ${sessionDirs.length}\n`);

interface ComparisonResult {
  sessionId: string;
  agent: string;
  contextual: { quality: number; efficiency: number; verdict: string; issues: string[] };
  isolated: { quality: number; efficiency: number; verdict: string; issues: string[] };
  qualityDelta: number;
  verdictChanged: boolean;
}

const results: ComparisonResult[] = [];

for (const dir of sessionDirs) {
  const sessionId = dir.split("/").pop() || "";
  const meta = loadSessionMeta(dir);
  if (!meta) continue;
  if (meta.agent === "evaluator") continue;
  if (meta.status === "running" || meta.status === "idle") continue;

  const messages = loadSessionMessages(dir);
  if (messages.length === 0) continue;

  const finishParams = extractFinishParams(messages);

  // Contextual: full transcript, full finish params
  const contextualTranscript = buildContextualTranscript(messages);
  const contextualScore = scoreSession(meta, contextualTranscript, finishParams);

  // Isolated: stripped transcript, NO finish params (they are self-narrative)
  const isolatedTranscript = buildIsolatedTranscript(messages);
  const isolatedScore = scoreSession(meta, isolatedTranscript, null);

  results.push({
    sessionId,
    agent: meta.agent,
    contextual: contextualScore,
    isolated: isolatedScore,
    qualityDelta: isolatedScore.quality - contextualScore.quality,
    verdictChanged: isolatedScore.verdict !== contextualScore.verdict,
  });
}

// ── Summary ────────────────────────────────────────────────────────────

console.log(`\nSessions compared: ${results.length}`);
console.log(`\n${"─".repeat(76)}`);
console.log("Per-session comparison:");
console.log(`${"─".repeat(76)}`);

for (const r of results) {
  const marker = r.verdictChanged ? " ⚡" : "";
  console.log(
    `  ${r.sessionId.slice(0, 30).padEnd(30)} ` +
    `${r.agent.padEnd(12)} ` +
    `Q: ${r.contextual.quality}→${r.isolated.quality}  ` +
    `E: ${r.contextual.efficiency}→${r.isolated.efficiency}  ` +
    `V: ${r.contextual.verdict.padEnd(18)}→${r.isolated.verdict}${marker}`
  );
}

// Aggregate stats
const verdictChanges = results.filter(r => r.verdictChanged);
const qualityDrops = results.filter(r => r.qualityDelta < 0);
const qualitySame = results.filter(r => r.qualityDelta === 0);
const qualityGains = results.filter(r => r.qualityDelta > 0);

const contextualVerdicts: Record<string, number> = {};
const isolatedVerdicts: Record<string, number> = {};
for (const r of results) {
  contextualVerdicts[r.contextual.verdict] = (contextualVerdicts[r.contextual.verdict] || 0) + 1;
  isolatedVerdicts[r.isolated.verdict] = (isolatedVerdicts[r.isolated.verdict] || 0) + 1;
}

console.log(`\n${"─".repeat(76)}`);
console.log("Aggregate Results:");
console.log(`${"─".repeat(76)}`);
console.log(`  Quality delta distribution:`);
console.log(`    Drops (isolated < contextual):  ${qualityDrops.length} (${(qualityDrops.length / results.length * 100).toFixed(1)}%)`);
console.log(`    Same:                           ${qualitySame.length} (${(qualitySame.length / results.length * 100).toFixed(1)}%)`);
console.log(`    Gains (isolated > contextual):  ${qualityGains.length} (${(qualityGains.length / results.length * 100).toFixed(1)}%)`);
console.log(`  Verdict changes: ${verdictChanges.length}/${results.length} (${(verdictChanges.length / results.length * 100).toFixed(1)}%)`);
console.log(`\n  Contextual verdict distribution: ${JSON.stringify(contextualVerdicts)}`);
console.log(`  Isolated verdict distribution:   ${JSON.stringify(isolatedVerdicts)}`);

// Average quality scores
const avgContextualQ = results.reduce((s, r) => s + r.contextual.quality, 0) / results.length;
const avgIsolatedQ = results.reduce((s, r) => s + r.isolated.quality, 0) / results.length;
const avgContextualE = results.reduce((s, r) => s + r.contextual.efficiency, 0) / results.length;
const avgIsolatedE = results.reduce((s, r) => s + r.isolated.efficiency, 0) / results.length;

console.log(`\n  Average quality:    contextual=${avgContextualQ.toFixed(2)}  isolated=${avgIsolatedQ.toFixed(2)}  delta=${(avgIsolatedQ - avgContextualQ).toFixed(2)}`);
console.log(`  Average efficiency: contextual=${avgContextualE.toFixed(2)}  isolated=${avgIsolatedE.toFixed(2)}  delta=${(avgIsolatedE - avgContextualE).toFixed(2)}`);

// Key finding
console.log(`\n${"=".repeat(76)}`);
if (verdictChanges.length > 0) {
  const pctChanged = (verdictChanges.length / results.length * 100).toFixed(1);
  const dir = avgIsolatedQ < avgContextualQ ? "lower" : "higher";
  console.log(`\n📊 KEY FINDING: Removing agent self-narrative changes ${pctChanged}% of verdicts.`);
  console.log(`   Isolated evaluation produces ${dir} quality scores on average.`);
  console.log(`   This suggests the evaluator IS influenced by agent self-description.`);
} else {
  console.log(`\n📊 FINDING: No verdict changes detected — heuristic evaluator may not be`);
  console.log(`   strongly influenced by agent self-narrative in current sessions.`);
}
console.log(`   (Note: This tests the HEURISTIC evaluator only. The LLM evaluator may`);
console.log(`   show stronger effects — that requires gym runs with real agent sessions.)`);
