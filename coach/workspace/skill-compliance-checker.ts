#!/usr/bin/env bun
/**
 * Skill Compliance Checker (IT-110 / EXP-252)
 * 
 * Parses session.jsonl files and measures compliance with deployed skills:
 * 1. read-before-edit: Before edit(), agent has read() same file earlier
 * 2. verify-after-edit: After edit(), agent reads same file within 2 turns
 * 3. verify-before-finish: Agent runs verification in last 5 calls before finish(success)
 * 
 * Usage: bun agents/coach/workspace/skill-compliance-checker.ts [--agent <name>] [--limit <N>]
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const agentFilter = args.includes("--agent") ? args[args.indexOf("--agent") + 1] : null;
const limit = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1]) : 50;

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

interface SessionMessage {
  role: string;
  content?: any[];
  timestamp?: number;
}

function extractToolCalls(messages: SessionMessage[]): { name: string; path?: string; status?: string }[] {
  const calls: { name: string; path?: string; status?: string }[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "toolCall") {
          const tc: any = { name: block.name };
          if (block.arguments?.path) tc.path = block.arguments.path;
          if (block.name === "finish" && block.arguments?.status) tc.status = block.arguments.status;
          if (block.name === "finish" && block.arguments?.verification_evidence) {
            tc.hasEvidence = block.arguments.verification_evidence?.length > 0;
          }
          calls.push(tc);
        }
      }
    }
  }
  return calls;
}

function checkReadBeforeEdit(calls: { name: string; path?: string }[]): { pass: number; fail: number; details: string[] } {
  let pass = 0, fail = 0;
  const details: string[] = [];
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].name === "edit" && calls[i].path) {
      const editPath = calls[i].path;
      const priorRead = calls.slice(0, i).some(c => c.name === "read" && c.path === editPath);
      if (priorRead) { pass++; } 
      else { fail++; details.push(`edit(${editPath}) at index ${i} — no prior read`); }
    }
  }
  return { pass, fail, details };
}

function checkVerifyAfterEdit(calls: { name: string; path?: string }[]): { pass: number; fail: number } {
  let pass = 0, fail = 0;
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].name === "edit" && calls[i].path) {
      // edit() is self-verifying (shows diff), so we consider it a pass if next calls don't need explicit read
      // But the skill says to read after write(), not edit(). Let's check write() instead.
      // Actually the skill is verify-after-edit which includes edit. Check next 2 calls.
      const next2 = calls.slice(i + 1, i + 3);
      const hasRead = next2.some(c => c.name === "read" && c.path === calls[i].path);
      if (hasRead) pass++; else fail++;
    }
  }
  return { pass, fail };
}

function checkVerifyAfterWrite(calls: { name: string; path?: string }[]): { pass: number; fail: number } {
  let pass = 0, fail = 0;
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].name === "write" && calls[i].path) {
      const next2 = calls.slice(i + 1, i + 3);
      const hasRead = next2.some(c => c.name === "read" && c.path === calls[i].path);
      if (hasRead) pass++; else fail++;
    }
  }
  return { pass, fail };
}

function checkVerifyBeforeFinish(calls: { name: string; path?: string; status?: string }[]): { pass: number; fail: number } {
  let pass = 0, fail = 0;
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].name === "finish" && (calls[i] as any).status === "success") {
      const prev5 = calls.slice(Math.max(0, i - 5), i);
      const hasVerify = prev5.some(c => ["read", "bash"].includes(c.name));
      if (hasVerify) pass++; else fail++;
    }
  }
  return { pass, fail };
}

// Collect sessions
const sessionsDir = ".state/sessions";
const historyDir = join(sessionsDir, "history");
const sessionDirs: string[] = [];

// Active sessions
for (const d of readdirSync(sessionsDir)) {
  if (d.startsWith("s_")) sessionDirs.push(join(sessionsDir, d));
}
// History sessions
if (existsSync(historyDir)) {
  for (const d of readdirSync(historyDir)) {
    if (d.startsWith("s_")) sessionDirs.push(join(historyDir, d));
  }
}

// Load meta and filter
interface SessionResult {
  id: string;
  agent: string;
  readBeforeEdit: { pass: number; fail: number };
  verifyAfterWrite: { pass: number; fail: number };
  verifyBeforeFinish: { pass: number; fail: number };
}

const results: SessionResult[] = [];
let processed = 0;

// Sort by most recent first
sessionDirs.sort((a, b) => {
  const ta = parseInt(a.split("s_")[1]?.split("_")[0] || "0");
  const tb = parseInt(b.split("s_")[1]?.split("_")[0] || "0");
  return tb - ta;
});

for (const dir of sessionDirs) {
  if (processed >= limit) break;
  
  const metaPath = join(dir, "meta.json");
  const sessionPath = join(dir, "session.jsonl");
  
  if (!existsSync(sessionPath)) continue;
  
  let agent = "unknown";
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      agent = meta.agent || "unknown";
    } catch {}
  }
  
  if (agentFilter && agent !== agentFilter) continue;
  
  try {
    const lines = readFileSync(sessionPath, "utf-8").trim().split("\n");
    const messages: SessionMessage[] = lines.map(l => JSON.parse(l));
    const calls = extractToolCalls(messages);
    
    if (calls.length < 3) continue; // Skip trivial sessions
    
    results.push({
      id: dir.split("/").pop() || "",
      agent,
      readBeforeEdit: checkReadBeforeEdit(calls),
      verifyAfterWrite: checkVerifyAfterWrite(calls),
      verifyBeforeFinish: checkVerifyBeforeFinish(calls),
    });
    processed++;
  } catch {}
}

// Aggregate by agent
interface AgentStats {
  rbe_pass: number; rbe_fail: number;
  vaw_pass: number; vaw_fail: number;
  vbf_pass: number; vbf_fail: number;
  sessions: number;
}

const byAgent: Record<string, AgentStats> = {};
for (const r of results) {
  if (!byAgent[r.agent]) byAgent[r.agent] = { rbe_pass: 0, rbe_fail: 0, vaw_pass: 0, vaw_fail: 0, vbf_pass: 0, vbf_fail: 0, sessions: 0 };
  const a = byAgent[r.agent];
  a.rbe_pass += r.readBeforeEdit.pass;
  a.rbe_fail += r.readBeforeEdit.fail;
  a.vaw_pass += r.verifyAfterWrite.pass;
  a.vaw_fail += r.verifyAfterWrite.fail;
  a.vbf_pass += r.verifyBeforeFinish.pass;
  a.vbf_fail += r.verifyBeforeFinish.fail;
  a.sessions++;
}

const pct = (p: number, f: number) => {
  const total = p + f;
  if (total === 0) return "N/A";
  return `${((p / total) * 100).toFixed(0)}% (${p}/${total})`;
};

console.log("# Skill Compliance Report");
console.log(`Sessions analyzed: ${results.length}`);
console.log(`\n## By Agent\n`);
console.log("| Agent | Sessions | read-before-edit | verify-after-write | verify-before-finish |");
console.log("|-------|----------|-----------------|-------------------|---------------------|");

const sorted = Object.entries(byAgent).sort((a, b) => b[1].sessions - a[1].sessions);
for (const [agent, s] of sorted) {
  console.log(`| ${agent} | ${s.sessions} | ${pct(s.rbe_pass, s.rbe_fail)} | ${pct(s.vaw_pass, s.vaw_fail)} | ${pct(s.vbf_pass, s.vbf_fail)} |`);
}

// Global totals
const totals: AgentStats = { rbe_pass: 0, rbe_fail: 0, vaw_pass: 0, vaw_fail: 0, vbf_pass: 0, vbf_fail: 0, sessions: 0 };
for (const s of Object.values(byAgent)) {
  totals.rbe_pass += s.rbe_pass; totals.rbe_fail += s.rbe_fail;
  totals.vaw_pass += s.vaw_pass; totals.vaw_fail += s.vaw_fail;
  totals.vbf_pass += s.vbf_pass; totals.vbf_fail += s.vbf_fail;
  totals.sessions += s.sessions;
}
console.log(`| **TOTAL** | **${totals.sessions}** | **${pct(totals.rbe_pass, totals.rbe_fail)}** | **${pct(totals.vaw_pass, totals.vaw_fail)}** | **${pct(totals.vbf_pass, totals.vbf_fail)}** |`);
