#!/usr/bin/env bun
/**
 * EXP-037b: Session Boundary Quality — Deeper Analysis
 *
 * The initial analysis (EXP-037) found NO error rate increase in late segments.
 * This follow-up checks subtler quality signals:
 * 1. Repeated tool calls (same tool + similar args = retrying/stuck)
 * 2. Sessions ending in error/interrupted vs done — where do errors cluster?
 * 3. Tool call velocity (calls per turn) — rushing = more calls per turn
 * 4. Verification behavior — do agents verify less at the end?
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

const SESSIONS_DIR = "agents/.state/sessions/history";
const MIN_ASSISTANT_TURNS = 10;

interface TurnInfo {
  turnIndex: number;
  toolCalls: { name: string; argsSnippet: string }[];
  isRepeat: boolean;  // same tool+args as previous turn
}

async function analyzeSession(sessionDir: string) {
  const metaPath = join(sessionDir, "meta.json");
  const sessionPath = join(sessionDir, "session.jsonl");

  try {
    const metaRaw = await readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaRaw);
    if ((meta.opCount ?? 0) < 8) return null;

    const sessionRaw = await readFile(sessionPath, "utf-8");
    const lines = sessionRaw.trim().split("\n");
    const messages: any[] = [];
    for (const line of lines) {
      try { messages.push(JSON.parse(line)); } catch {}
    }

    // Build turn-level info
    const turns: TurnInfo[] = [];
    let turnIndex = 0;

    for (const msg of messages) {
      if (msg.role === "assistant") {
        const toolCalls: { name: string; argsSnippet: string }[] = [];
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block?.type === "toolCall" || block?.type === "tool_use") {
              const args = block.arguments ?? block.input ?? {};
              const argsStr = typeof args === "string" ? args : JSON.stringify(args);
              toolCalls.push({
                name: block.name || "unknown",
                argsSnippet: argsStr.slice(0, 100),
              });
            }
          }
        }

        // Check if this turn repeats the previous one
        let isRepeat = false;
        if (turns.length > 0 && toolCalls.length === 1) {
          const prev = turns[turns.length - 1];
          if (prev.toolCalls.length === 1 &&
              prev.toolCalls[0].name === toolCalls[0].name &&
              prev.toolCalls[0].argsSnippet === toolCalls[0].argsSnippet) {
            isRepeat = true;
          }
        }

        turns.push({ turnIndex, toolCalls, isRepeat });
        turnIndex++;
      }
    }

    if (turns.length < MIN_ASSISTANT_TURNS) return null;

    return { sessionId: sessionDir.split("/").pop(), agent: meta.agent, status: meta.status, turns };
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== EXP-037b: Deeper Session Boundary Quality Analysis ===\n");

  const entries = await readdir(SESSIONS_DIR);
  const sessionDirs = entries.filter(e => e.startsWith("s_")).map(e => join(SESSIONS_DIR, e));

  const results: NonNullable<Awaited<ReturnType<typeof analyzeSession>>>[] = [];
  for (const dir of sessionDirs) {
    const analysis = await analyzeSession(dir);
    if (analysis) results.push(analysis);
  }

  console.log(`Analyzed ${results.length} sessions with >= ${MIN_ASSISTANT_TURNS} turns\n`);

  // 1. Repeat rate by segment
  console.log("=== 1. Repeated Tool Calls (same tool+args as prev turn) ===\n");
  const repeatData = { early: { repeats: 0, total: 0 }, middle: { repeats: 0, total: 0 }, late: { repeats: 0, total: 0 } };

  for (const r of results) {
    const n = r.turns.length;
    const earlyEnd = Math.floor(n * 0.4);
    const middleEnd = Math.floor(n * 0.8);

    for (let i = 0; i < n; i++) {
      const seg = i < earlyEnd ? "early" : i < middleEnd ? "middle" : "late";
      repeatData[seg].total++;
      if (r.turns[i].isRepeat) repeatData[seg].repeats++;
    }
  }

  console.log("Segment     | Turns  | Repeats | Repeat Rate");
  console.log("------------|--------|---------|------------");
  for (const seg of ["early", "middle", "late"] as const) {
    const d = repeatData[seg];
    const rate = d.total > 0 ? (d.repeats / d.total * 100).toFixed(1) : "0.0";
    console.log(`${seg.padEnd(12)}| ${String(d.total).padEnd(7)}| ${String(d.repeats).padEnd(8)}| ${rate}%`);
  }

  // 2. Tool calls per turn (velocity)
  console.log("\n=== 2. Tool Call Velocity (calls per turn) ===\n");
  const velData = { early: { calls: 0, turns: 0 }, middle: { calls: 0, turns: 0 }, late: { calls: 0, turns: 0 } };

  for (const r of results) {
    const n = r.turns.length;
    const earlyEnd = Math.floor(n * 0.4);
    const middleEnd = Math.floor(n * 0.8);

    for (let i = 0; i < n; i++) {
      const seg = i < earlyEnd ? "early" : i < middleEnd ? "middle" : "late";
      velData[seg].turns++;
      velData[seg].calls += r.turns[i].toolCalls.length;
    }
  }

  console.log("Segment     | Turns  | Calls  | Calls/Turn");
  console.log("------------|--------|--------|----------");
  for (const seg of ["early", "middle", "late"] as const) {
    const d = velData[seg];
    const vel = d.turns > 0 ? (d.calls / d.turns).toFixed(2) : "0.00";
    console.log(`${seg.padEnd(12)}| ${String(d.turns).padEnd(7)}| ${String(d.calls).padEnd(7)}| ${vel}`);
  }

  // 3. Verification behavior — count read/bash calls in late vs middle
  console.log("\n=== 3. Verification Behavior (read/bash calls suggest checking work) ===\n");
  const verifyData = {
    middle: { verify: 0, total: 0 },
    late: { verify: 0, total: 0 },
  };

  const VERIFY_TOOLS = new Set(["read", "bash", "read_file"]);
  const BUILD_TOOLS = new Set(["edit", "write", "write_file"]);

  for (const r of results) {
    const n = r.turns.length;
    const earlyEnd = Math.floor(n * 0.4);
    const middleEnd = Math.floor(n * 0.8);

    for (let i = earlyEnd; i < n; i++) {
      const seg = i < middleEnd ? "middle" : "late";
      for (const tc of r.turns[i].toolCalls) {
        verifyData[seg].total++;
        if (VERIFY_TOOLS.has(tc.name)) verifyData[seg].verify++;
      }
    }
  }

  console.log("Segment     | Total  | Verify | Verify Rate");
  console.log("------------|--------|--------|------------");
  for (const seg of ["middle", "late"] as const) {
    const d = verifyData[seg];
    const rate = d.total > 0 ? (d.verify / d.total * 100).toFixed(1) : "0.0";
    console.log(`${seg.padEnd(12)}| ${String(d.total).padEnd(7)}| ${String(d.verify).padEnd(7)}| ${rate}%`);
  }

  // 4. Sessions that hit errors — compare turn distribution
  console.log("\n=== 4. Error Sessions vs Done Sessions ===\n");
  const errorSessions = results.filter(r => r.status === "error");
  const doneSessions = results.filter(r => r.status === "done");
  console.log(`Done sessions: ${doneSessions.length}`);
  console.log(`Error sessions: ${errorSessions.length}`);

  // 5. Most common late-segment tools
  console.log("\n=== 5. Most Common Tools by Segment ===\n");
  const toolCounts = { early: new Map<string, number>(), middle: new Map<string, number>(), late: new Map<string, number>() };

  for (const r of results) {
    const n = r.turns.length;
    const earlyEnd = Math.floor(n * 0.4);
    const middleEnd = Math.floor(n * 0.8);

    for (let i = 0; i < n; i++) {
      const seg = i < earlyEnd ? "early" : i < middleEnd ? "middle" : "late";
      for (const tc of r.turns[i].toolCalls) {
        toolCounts[seg].set(tc.name, (toolCounts[seg].get(tc.name) || 0) + 1);
      }
    }
  }

  for (const seg of ["early", "middle", "late"] as const) {
    const sorted = [...toolCounts[seg].entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = [...toolCounts[seg].values()].reduce((a, b) => a + b, 0);
    console.log(`${seg.toUpperCase()} (${total} total calls):`);
    for (const [tool, count] of sorted) {
      console.log(`  ${tool.padEnd(20)} ${count} (${(count / total * 100).toFixed(1)}%)`);
    }
  }

  // 6. Per-agent calls/turn comparison
  console.log("\n=== 6. Calls/Turn by Agent (Middle vs Late) ===\n");
  const agentVel = new Map<string, { middle: { calls: number; turns: number }; late: { calls: number; turns: number } }>();

  for (const r of results) {
    if (!agentVel.has(r.agent)) agentVel.set(r.agent, {
      middle: { calls: 0, turns: 0 },
      late: { calls: 0, turns: 0 },
    });
    const n = r.turns.length;
    const earlyEnd = Math.floor(n * 0.4);
    const middleEnd = Math.floor(n * 0.8);
    const entry = agentVel.get(r.agent)!;

    for (let i = earlyEnd; i < n; i++) {
      const seg = i < middleEnd ? "middle" : "late";
      entry[seg].turns++;
      entry[seg].calls += r.turns[i].toolCalls.length;
    }
  }

  console.log("Agent       | Mid C/T | Late C/T | Delta");
  console.log("------------|---------|----------|------");
  for (const [agent, data] of [...agentVel.entries()].sort((a, b) => b[1].middle.turns - a[1].middle.turns)) {
    const mVel = data.middle.turns > 0 ? data.middle.calls / data.middle.turns : 0;
    const lVel = data.late.turns > 0 ? data.late.calls / data.late.turns : 0;
    console.log(
      `${agent.padEnd(12)}| ${mVel.toFixed(2).padEnd(8)}| ${lVel.toFixed(2).padEnd(9)}| ${(lVel - mVel) >= 0 ? "+" : ""}${(lVel - mVel).toFixed(2)}`,
    );
  }
}

main().catch(console.error);
