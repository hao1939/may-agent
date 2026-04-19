#!/usr/bin/env bun
/**
 * EXP-187: Discriminative Keyword Bookmarks experiment runner.
 * Runs 15 questions × 2 arms (control INDEX vs treatment INDEX).
 * Checks whether agent response cites the correct KE-xxx.
 */

import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../../..");
const KNOWLEDGE_ROOT = resolve(import.meta.dirname, "../../");
const MAY_BIN = join(PROJECT_ROOT, "bundle/may-agent");

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

// Read INDEX files
const controlIndex = readFileSync(join(KNOWLEDGE_ROOT, "INDEX.md"), "utf-8");
const treatmentIndex = readFileSync(join(import.meta.dirname, "index-treatment.md"), "utf-8");

interface TrialResult {
  arm: "A" | "B";
  questionNum: number;
  question: string;
  correctKE: string;
  citedCorrectKE: boolean;
  citedKEs: string[];
  agentOutput: string;
  error: boolean;
}

function runTrial(arm: "A" | "B", qIdx: number): TrialResult {
  const { q, ke } = questions[qIdx];
  const index = arm === "A" ? controlIndex : treatmentIndex;
  
  const workDir = mkdtempSync(join(tmpdir(), `exp187-${arm}-${qIdx}-`));
  const stateDir = join(workDir, ".state");
  mkdirSync(stateDir, { recursive: true });

  // Copy knowledge entries so agent can read them
  const knowledgeDir = join(workDir, "knowledge");
  mkdirSync(join(knowledgeDir, "entries"), { recursive: true });
  cpSync(join(KNOWLEDGE_ROOT, "entries"), join(knowledgeDir, "entries"), { recursive: true });
  
  // Write the INDEX
  writeFileSync(join(knowledgeDir, "INDEX.md"), index);

  // Create task file
  const taskContent = `You are a research assistant with access to a knowledge base in the knowledge/ directory. The knowledge/INDEX.md file lists all available knowledge entries.

Answer the following question and cite the specific knowledge entry (KE-xxx) that best supports your answer. Read the INDEX first to find relevant entries, then read the specific entry to confirm.

Question: ${q}

Requirements:
- Cite the specific KE-xxx ID in your answer
- Base your answer on the content of the knowledge entry
- Be concise (2-3 sentences)`;

  const taskFile = join(workDir, "task.md");
  writeFileSync(taskFile, taskContent);

  // Create minimal agent config
  const agentDir = join(workDir, "agents", "coder");
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, "agent.json"), JSON.stringify({
    name: "coder",
    model: "claude-sonnet-4-20250514",
    tools: ["read", "bash", "edit", "write"],
    systemPrompt: "You are a research assistant. Answer questions by consulting the knowledge base."
  }));

  let output = "";
  let error = false;
  
  try {
    output = execSync(
      `"${MAY_BIN}" --oneshot --agent coder --task-file "${taskFile}" --timeout=3`,
      {
        cwd: workDir,
        env: {
          ...process.env,
          AGENTS_ROOT: join(workDir, "agents"),
          STATE_DIR: stateDir,
        },
        timeout: 4 * 60 * 1000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch (err: any) {
    output = err.stdout || err.stderr || "";
    error = true;
  }

  // Extract cited KEs from output
  const kePattern = /KE-\d{3}/g;
  const citedKEs = [...new Set((output.match(kePattern) || []))];
  const citedCorrectKE = citedKEs.includes(ke);

  // Cleanup
  try { rmSync(workDir, { recursive: true, force: true }); } catch {}

  const result: TrialResult = {
    arm,
    questionNum: qIdx + 1,
    question: q,
    correctKE: ke,
    citedCorrectKE,
    citedKEs,
    agentOutput: output.slice(0, 500),
    error,
  };

  console.error(`[${arm}] Q${qIdx + 1} (${ke}): ${citedCorrectKE ? "✅" : "❌"} cited=[${citedKEs.join(",")}]${error ? " ⚠️ERROR" : ""}`);
  return result;
}

// Run all trials
console.error("=== EXP-187: Starting experiment ===");
console.error(`Arms: A (control flat INDEX), B (treatment keyword INDEX)`);
console.error(`Questions: ${questions.length}`);

const results: TrialResult[] = [];

// Run Arm A
console.error("\n--- Arm A (control) ---");
for (let i = 0; i < questions.length; i++) {
  results.push(runTrial("A", i));
}

// Run Arm B
console.error("\n--- Arm B (treatment) ---");
for (let i = 0; i < questions.length; i++) {
  results.push(runTrial("B", i));
}

// Compute results
const armA = results.filter(r => r.arm === "A");
const armB = results.filter(r => r.arm === "B");
const armACitations = armA.filter(r => r.citedCorrectKE).length;
const armBCitations = armB.filter(r => r.citedCorrectKE).length;
const armARate = armACitations / armA.length;
const armBRate = armBCitations / armB.length;
const diff = armBRate - armARate;

// Fisher's exact test approximation (simple)
function fisherExact2x2(a: number, b: number, c: number, d: number): number {
  // a=armA success, b=armA fail, c=armB success, d=armB fail
  const n = a + b + c + d;
  const logFact = (n: number) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
  const logP = logFact(a+b) + logFact(c+d) + logFact(a+c) + logFact(b+d) - logFact(n) - logFact(a) - logFact(b) - logFact(c) - logFact(d);
  return Math.exp(logP);
}

// One-sided p-value (B > A)
let pValue = 0;
const totalSuccess = armACitations + armBCitations;
const totalFail = (armA.length - armACitations) + (armB.length - armBCitations);
for (let x = armBCitations; x <= Math.min(armB.length, totalSuccess + totalFail); x++) {
  const a = totalSuccess - x; // armA successes if armB has x
  if (a < 0 || a > armA.length) continue;
  const b = armA.length - a;
  const d = armB.length - x;
  if (d < 0) continue;
  pValue += fisherExact2x2(a, b, x, d);
}

// Output summary
const output = {
  experiment: "EXP-187",
  arms: {
    A: { name: "control (flat INDEX)", correct: armACitations, total: armA.length, rate: armARate },
    B: { name: "treatment (keyword INDEX)", correct: armBCitations, total: armB.length, rate: armBRate },
  },
  difference_pp: Math.round(diff * 100),
  p_value: pValue,
  details: results.map(r => ({
    arm: r.arm,
    q: r.questionNum,
    correctKE: r.correctKE,
    cited: r.citedCorrectKE,
    citedKEs: r.citedKEs,
    error: r.error,
  })),
};

console.log(JSON.stringify(output, null, 2));
