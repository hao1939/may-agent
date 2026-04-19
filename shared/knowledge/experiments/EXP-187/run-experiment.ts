#!/usr/bin/env bun
/**
 * EXP-187: Discriminative Keyword Bookmarks experiment runner.
 * Runs 15 questions × 2 arms (control INDEX vs treatment INDEX).
 * Checks whether agent response cites the correct KE-xxx in session transcript.
 */

import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_ROOT = "/app";
const KNOWLEDGE_ROOT = join(PROJECT_ROOT, "agents/shared/knowledge");
const MAY_BIN = join(PROJECT_ROOT, "bundle/may-agent");
const AGENTS_ROOT = join(PROJECT_ROOT, "agents");

const questions = [
  { q: "What evidence do we have about whether text rules or SOUL.md edits fix judgment failures?", ke: "KE-002" },
  { q: "How does decision topology predict whether a workflow will help or hurt?", ke: "KE-015" },
  { q: "Where in a session do agent errors concentrate — early or late?", ke: "KE-022" },
  { q: "What workflow eliminated sycophancy completely?", ke: "KE-029" },
  { q: "Does forced externalization work because it provides correct information, or for some other reason?", ke: "KE-034" },
  { q: "Is content quality or structural access more important for knowledge utilization?", ke: "KE-052" },
  { q: "Does forced externalization help with debugging tasks like cascading-fix-trap?", ke: "KE-054" },
  { q: "Do structural guards eventually train agents to self-verify without the guard?", ke: "KE-106" },
  { q: "What happens when you combine multiple interventions on the same task?", ke: "KE-123" },
  { q: "Do few-shot examples help or hurt on open-ended discovery tasks?", ke: "KE-133" },
  { q: "What is the primary source of wasted reads in agent sessions?", ke: "KE-140" },
  { q: "Do all agents respond the same way to verification guards?", ke: "KE-143" },
  { q: "What happens when agents are given freedom to externalize reasoning in any format they choose?", ke: "KE-156" },
  { q: "Is structured output format purely overhead, or does it provide task decomposition benefits?", ke: "KE-159" },
  { q: "How do you predict which gym scenarios will produce useful experimental signal?", ke: "KE-171" },
];

const controlIndex = readFileSync(join(KNOWLEDGE_ROOT, "INDEX.md"), "utf-8");
const treatmentIndex = readFileSync(join(import.meta.dirname, "index-treatment.md"), "utf-8");

interface TrialResult {
  arm: "A" | "B";
  questionNum: number;
  question: string;
  correctKE: string;
  citedCorrectKE: boolean;
  citedKEs: string[];
  readCount: number;
  error: boolean;
}

function extractKEsFromSession(stateDir: string): { kes: string[], reads: number } {
  // Find session.jsonl in state dir
  const historyDir = join(stateDir, "sessions", "history");
  if (!existsSync(historyDir)) return { kes: [], reads: 0 };
  
  const sessions = readdirSync(historyDir);
  if (sessions.length === 0) return { kes: [], reads: 0 };
  
  const sessionDir = join(historyDir, sessions[0]);
  const jsonlPath = join(sessionDir, "session.jsonl");
  if (!existsSync(jsonlPath)) return { kes: [], reads: 0 };
  
  const content = readFileSync(jsonlPath, "utf-8");
  
  // Extract KE citations from assistant messages
  const kePattern = /KE-\d{3}/g;
  const allKEs = [...new Set((content.match(kePattern) || []))];
  
  // Count read() tool calls
  const reads = (content.match(/"name"\s*:\s*"read"/g) || []).length;
  
  return { kes: allKEs, reads };
}

function runTrial(arm: "A" | "B", qIdx: number): TrialResult {
  const { q, ke } = questions[qIdx];
  const index = arm === "A" ? controlIndex : treatmentIndex;
  
  const workDir = mkdtempSync(join(tmpdir(), `exp187-${arm}-${qIdx}-`));
  const stateDir = join(workDir, ".state");
  mkdirSync(stateDir, { recursive: true });

  // Copy knowledge entries
  const knowledgeDir = join(workDir, "knowledge");
  mkdirSync(join(knowledgeDir, "entries"), { recursive: true });
  cpSync(join(KNOWLEDGE_ROOT, "entries"), join(knowledgeDir, "entries"), { recursive: true });
  writeFileSync(join(knowledgeDir, "INDEX.md"), index);

  const taskContent = `You are a research assistant with access to a knowledge base in the knowledge/ directory. The knowledge/INDEX.md file lists all available knowledge entries.

Answer the following question and cite the specific knowledge entry (KE-xxx) that best supports your answer. Read the INDEX first to find relevant entries, then read the specific entry to confirm.

Question: ${q}

Requirements:
- Cite the specific KE-xxx ID in your answer
- Base your answer on the content of the knowledge entry
- Be concise (2-3 sentences)`;

  writeFileSync(join(workDir, "task.md"), taskContent);

  let error = false;
  
  try {
    execSync(
      `"${MAY_BIN}" --oneshot --agent coder --task-file "${join(workDir, "task.md")}" --timeout=3`,
      {
        cwd: workDir,
        env: { ...process.env, AGENTS_ROOT, STATE_DIR: stateDir },
        timeout: 4 * 60 * 1000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch {
    error = true;
  }

  const { kes: citedKEs, reads: readCount } = extractKEsFromSession(stateDir);
  const citedCorrectKE = citedKEs.includes(ke);

  // Cleanup
  try { rmSync(workDir, { recursive: true, force: true }); } catch {}

  const result: TrialResult = {
    arm, questionNum: qIdx + 1, question: q, correctKE: ke,
    citedCorrectKE, citedKEs, readCount, error,
  };

  console.error(`[${arm}] Q${qIdx + 1} (${ke}): ${citedCorrectKE ? "✅" : "❌"} cited=[${citedKEs.join(",")}] reads=${readCount}${error ? " ⚠️ERR" : ""}`);
  return result;
}

console.error("=== EXP-187: Starting experiment ===");
const results: TrialResult[] = [];

console.error("\n--- Arm A (control) ---");
for (let i = 0; i < questions.length; i++) results.push(runTrial("A", i));

console.error("\n--- Arm B (treatment) ---");
for (let i = 0; i < questions.length; i++) results.push(runTrial("B", i));

// Compute
const armA = results.filter(r => r.arm === "A");
const armB = results.filter(r => r.arm === "B");
const armAHits = armA.filter(r => r.citedCorrectKE).length;
const armBHits = armB.filter(r => r.citedCorrectKE).length;
const armARate = armAHits / armA.length;
const armBRate = armBHits / armB.length;
const armAReads = armA.reduce((s, r) => s + r.readCount, 0) / armA.length;
const armBReads = armB.reduce((s, r) => s + r.readCount, 0) / armB.length;

// Fisher's exact (one-sided, B > A)
function logFact(n: number) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
function hypergeomProb(a: number, b: number, c: number, d: number) {
  const n = a + b + c + d;
  return Math.exp(logFact(a+b) + logFact(c+d) + logFact(a+c) + logFact(b+d) - logFact(n) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
}
let pValue = 0;
const N = armA.length;
const totalHits = armAHits + armBHits;
for (let bHits = armBHits; bHits <= Math.min(N, totalHits); bHits++) {
  const aHits = totalHits - bHits;
  if (aHits < 0 || aHits > N) continue;
  pValue += hypergeomProb(aHits, N - aHits, bHits, N - bHits);
}

const output = {
  experiment: "EXP-187",
  armA: { correct: armAHits, total: N, rate: Math.round(armARate * 100), avgReads: Math.round(armAReads * 10) / 10 },
  armB: { correct: armBHits, total: N, rate: Math.round(armBRate * 100), avgReads: Math.round(armBReads * 10) / 10 },
  difference_pp: Math.round((armBRate - armARate) * 100),
  p_value: Math.round(pValue * 10000) / 10000,
  details: results.map(r => ({ arm: r.arm, q: r.questionNum, ke: r.correctKE, hit: r.citedCorrectKE, reads: r.readCount })),
};

console.log(JSON.stringify(output, null, 2));
