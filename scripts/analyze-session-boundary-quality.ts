#!/usr/bin/env bun
/**
 * EXP-037: Session Boundary Quality Analysis (H-068)
 *
 * Tests H-068 P1: "Agent output quality in final 20% of sessions will be
 * measurably lower than output in the 40-80% range."
 *
 * Method:
 * - Read session transcripts from history
 * - For each session with >8 assistant turns, split into segments:
 *   - Early (0-40%), Middle (40-80%), Late (80-100%)
 * - Measure per-segment:
 *   - Tool error rate (hard errors / total tool calls)
 *   - Tool call diversity (unique tools / total calls)
 *   - Average tool result length (proxy for meaningful work vs quick checks)
 *   - Whether finish() was rushed (finish in final turn with minimal content)
 *
 * Output: aggregate statistics comparing Middle vs Late segments
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

const SESSIONS_DIR = "agents/.state/sessions/history";
const MIN_ASSISTANT_TURNS = 8;  // Need enough turns to split meaningfully

interface ToolCall {
  name: string;
  turnIndex: number;
}

interface ToolResult {
  turnIndex: number;
  isError: boolean;
  contentLength: number;
}

interface SessionAnalysis {
  sessionId: string;
  agent: string;
  totalAssistantTurns: number;
  totalToolCalls: number;
  segments: {
    early: SegmentMetrics;   // 0-40%
    middle: SegmentMetrics;  // 40-80%
    late: SegmentMetrics;    // 80-100%
  };
}

interface SegmentMetrics {
  toolCalls: number;
  toolErrors: number;
  errorRate: number;
  uniqueTools: number;
  avgResultLength: number;
  hasFinishCall: boolean;
}

const HARD_ERROR_PATTERN = /ENOENT|Cannot find module|Validation failed|SyntaxError|TypeError|ReferenceError|Error:/i;

async function analyzeSession(sessionDir: string): Promise<SessionAnalysis | null> {
  const metaPath = join(sessionDir, "meta.json");
  const sessionPath = join(sessionDir, "session.jsonl");

  try {
    const metaRaw = await readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaRaw);

    // Only analyze completed sessions with enough ops
    if (meta.status !== "done" || (meta.opCount ?? 0) < 6) return null;

    const sessionRaw = await readFile(sessionPath, "utf-8");
    const lines = sessionRaw.trim().split("\n");

    const messages: any[] = [];
    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }

    // Count assistant turns
    const assistantTurns: number[] = [];
    const toolCalls: ToolCall[] = [];
    const toolResults: ToolResult[] = [];

    let turnIndex = 0;
    for (const msg of messages) {
      if (msg.role === "assistant") {
        assistantTurns.push(turnIndex);

        // Extract tool calls from content
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block?.type === "toolCall" || block?.type === "tool_use") {
              toolCalls.push({
                name: block.name || "unknown",
                turnIndex,
              });
            }
          }
        }
        turnIndex++;
      } else if (msg.role === "toolResult" || msg.role === "tool") {
        // Extract tool result info
        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = msg.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text || "")
            .join(" ");
        }

        const isError = text.length < 500 && HARD_ERROR_PATTERN.test(text);
        toolResults.push({
          turnIndex: turnIndex - 1, // belongs to previous assistant turn
          isError,
          contentLength: text.length,
        });
      }
    }

    if (assistantTurns.length < MIN_ASSISTANT_TURNS) return null;

    const totalTurns = assistantTurns.length;
    const earlyEnd = Math.floor(totalTurns * 0.4);
    const middleEnd = Math.floor(totalTurns * 0.8);

    // Classify tool calls by segment
    function getSegmentMetrics(startTurn: number, endTurn: number): SegmentMetrics {
      const segToolCalls = toolCalls.filter(tc => tc.turnIndex >= startTurn && tc.turnIndex < endTurn);
      const segToolResults = toolResults.filter(tr => tr.turnIndex >= startTurn && tr.turnIndex < endTurn);

      const errors = segToolResults.filter(r => r.isError).length;
      const uniqueTools = new Set(segToolCalls.map(tc => tc.name)).size;
      const avgLen = segToolResults.length > 0
        ? segToolResults.reduce((sum, r) => sum + r.contentLength, 0) / segToolResults.length
        : 0;
      const hasFinish = segToolCalls.some(tc => tc.name === "finish");

      return {
        toolCalls: segToolCalls.length,
        toolErrors: errors,
        errorRate: segToolCalls.length > 0 ? errors / segToolCalls.length : 0,
        uniqueTools,
        avgResultLength: Math.round(avgLen),
        hasFinishCall: hasFinish,
      };
    }

    return {
      sessionId: sessionDir.split("/").pop() || "",
      agent: meta.agent,
      totalAssistantTurns: totalTurns,
      totalToolCalls: toolCalls.length,
      segments: {
        early: getSegmentMetrics(0, earlyEnd),
        middle: getSegmentMetrics(earlyEnd, middleEnd),
        late: getSegmentMetrics(middleEnd, totalTurns),
      },
    };
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== EXP-037: Session Boundary Quality Analysis (H-068) ===\n");
  console.log(`Hypothesis: Agent quality degrades in final 20% of sessions`);
  console.log(`Method: Compare tool error rates and patterns across Early/Middle/Late segments\n`);

  const entries = await readdir(SESSIONS_DIR);
  const sessionDirs = entries
    .filter(e => e.startsWith("s_"))
    .map(e => join(SESSIONS_DIR, e));

  console.log(`Found ${sessionDirs.length} session directories`);

  const results: SessionAnalysis[] = [];
  let processed = 0;

  for (const dir of sessionDirs) {
    const analysis = await analyzeSession(dir);
    if (analysis) results.push(analysis);
    processed++;
    if (processed % 100 === 0) process.stderr.write(`  processed ${processed}/${sessionDirs.length}\r`);
  }

  console.log(`\nAnalyzed ${results.length} sessions with >= ${MIN_ASSISTANT_TURNS} assistant turns`);

  // Aggregate by segment
  const agg = {
    early: { toolCalls: 0, errors: 0, totalResultLen: 0, resultCount: 0, sessions: 0 },
    middle: { toolCalls: 0, errors: 0, totalResultLen: 0, resultCount: 0, sessions: 0 },
    late: { toolCalls: 0, errors: 0, totalResultLen: 0, resultCount: 0, sessions: 0 },
  };

  for (const r of results) {
    for (const seg of ["early", "middle", "late"] as const) {
      const m = r.segments[seg];
      agg[seg].toolCalls += m.toolCalls;
      agg[seg].errors += m.toolErrors;
      agg[seg].totalResultLen += m.avgResultLength * m.toolCalls;
      agg[seg].resultCount += m.toolCalls;
      agg[seg].sessions++;
    }
  }

  console.log("\n=== Aggregate Results ===\n");
  console.log("Segment     | Tool Calls | Errors | Error Rate | Avg Result Len");
  console.log("------------|------------|--------|------------|---------------");
  for (const seg of ["early", "middle", "late"] as const) {
    const a = agg[seg];
    const errorRate = a.toolCalls > 0 ? (a.errors / a.toolCalls * 100).toFixed(1) : "0.0";
    const avgLen = a.resultCount > 0 ? Math.round(a.totalResultLen / a.resultCount) : 0;
    console.log(
      `${seg.padEnd(12)}| ${String(a.toolCalls).padEnd(11)}| ${String(a.errors).padEnd(7)}| ${errorRate.padEnd(11)}%| ${avgLen}`,
    );
  }

  // Per-session error rate comparison (paired test)
  console.log("\n=== Per-Session Middle vs Late Error Rate ===\n");
  let lateWorse = 0;
  let middleWorse = 0;
  let same = 0;
  let lateHigherErrorSum = 0;
  let pairsWithBothCalls = 0;

  for (const r of results) {
    const m = r.segments.middle;
    const l = r.segments.late;
    if (m.toolCalls > 0 && l.toolCalls > 0) {
      pairsWithBothCalls++;
      const diff = l.errorRate - m.errorRate;
      lateHigherErrorSum += diff;
      if (diff > 0) lateWorse++;
      else if (diff < 0) middleWorse++;
      else same++;
    }
  }

  console.log(`Sessions with tool calls in both Middle and Late: ${pairsWithBothCalls}`);
  console.log(`Late has higher error rate: ${lateWorse} (${(lateWorse / pairsWithBothCalls * 100).toFixed(1)}%)`);
  console.log(`Middle has higher error rate: ${middleWorse} (${(middleWorse / pairsWithBothCalls * 100).toFixed(1)}%)`);
  console.log(`Same error rate: ${same} (${(same / pairsWithBothCalls * 100).toFixed(1)}%)`);
  console.log(`Mean error rate difference (Late - Middle): ${(lateHigherErrorSum / pairsWithBothCalls * 100).toFixed(2)}pp`);

  // Agent breakdown
  console.log("\n=== By Agent ===\n");
  const byAgent = new Map<string, { middle: number[]; late: number[] }>();
  for (const r of results) {
    if (!byAgent.has(r.agent)) byAgent.set(r.agent, { middle: [], late: [] });
    const entry = byAgent.get(r.agent)!;
    if (r.segments.middle.toolCalls > 0) entry.middle.push(r.segments.middle.errorRate);
    if (r.segments.late.toolCalls > 0) entry.late.push(r.segments.late.errorRate);
  }

  console.log("Agent       | N   | Middle Err% | Late Err%  | Delta");
  console.log("------------|-----|------------|------------|------");
  for (const [agent, data] of [...byAgent.entries()].sort((a, b) => b[1].middle.length - a[1].middle.length)) {
    const mAvg = data.middle.length > 0 ? data.middle.reduce((a, b) => a + b, 0) / data.middle.length * 100 : 0;
    const lAvg = data.late.length > 0 ? data.late.reduce((a, b) => a + b, 0) / data.late.length * 100 : 0;
    const n = Math.min(data.middle.length, data.late.length);
    console.log(
      `${agent.padEnd(12)}| ${String(n).padEnd(4)}| ${mAvg.toFixed(1).padEnd(11)}| ${lAvg.toFixed(1).padEnd(11)}| ${(lAvg - mAvg) >= 0 ? "+" : ""}${(lAvg - mAvg).toFixed(1)}pp`,
    );
  }

  // Late-session rushing indicator: finish() calls
  console.log("\n=== finish() Distribution ===\n");
  let finishInLate = 0;
  let finishInMiddle = 0;
  let finishInEarly = 0;
  let noFinish = 0;
  for (const r of results) {
    if (r.segments.late.hasFinishCall) finishInLate++;
    else if (r.segments.middle.hasFinishCall) finishInMiddle++;
    else if (r.segments.early.hasFinishCall) finishInEarly++;
    else noFinish++;
  }
  console.log(`finish() in Early (0-40%): ${finishInEarly} (${(finishInEarly / results.length * 100).toFixed(1)}%)`);
  console.log(`finish() in Middle (40-80%): ${finishInMiddle} (${(finishInMiddle / results.length * 100).toFixed(1)}%)`);
  console.log(`finish() in Late (80-100%): ${finishInLate} (${(finishInLate / results.length * 100).toFixed(1)}%)`);
  console.log(`No finish() call: ${noFinish} (${(noFinish / results.length * 100).toFixed(1)}%)`);

  // Tool diversity comparison
  console.log("\n=== Tool Diversity (unique tools / total calls) ===\n");
  let middleDivSum = 0, lateDivSum = 0, divN = 0;
  for (const r of results) {
    const m = r.segments.middle;
    const l = r.segments.late;
    if (m.toolCalls >= 2 && l.toolCalls >= 2) {
      middleDivSum += m.uniqueTools / m.toolCalls;
      lateDivSum += l.uniqueTools / l.toolCalls;
      divN++;
    }
  }
  if (divN > 0) {
    console.log(`Middle avg diversity: ${(middleDivSum / divN).toFixed(3)}`);
    console.log(`Late avg diversity: ${(lateDivSum / divN).toFixed(3)}`);
    console.log(`N = ${divN} sessions with >= 2 calls in both segments`);
  }

  // Summary
  console.log("\n=== CONCLUSION ===\n");
  if (pairsWithBothCalls > 0) {
    const avgDiff = lateHigherErrorSum / pairsWithBothCalls * 100;
    if (avgDiff > 1.0) {
      console.log(`H-068 P1 SUPPORTED: Late-session error rate is ${avgDiff.toFixed(1)}pp higher than middle.`);
      console.log(`${lateWorse}/${pairsWithBothCalls} sessions show higher error rates in final 20%.`);
    } else if (avgDiff < -1.0) {
      console.log(`H-068 P1 CONTRADICTED: Late-session error rate is ${Math.abs(avgDiff).toFixed(1)}pp LOWER than middle.`);
    } else {
      console.log(`H-068 P1 INCONCLUSIVE: Error rate difference (${avgDiff.toFixed(1)}pp) is within noise range.`);
    }
  }
}

main().catch(console.error);
