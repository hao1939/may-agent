#!/usr/bin/env bun
/**
 * EXP-039 Phase B: Direct LLM Evaluation Comparison
 * 
 * Calls the LLM evaluator (GPT-5.2 via LiteLLM) directly with both
 * contextual and isolated prompts. No manager runtime needed.
 * 
 * Uses the OpenAI-compatible API endpoint.
 * 
 * Usage: bun scripts/exp039-phase-b-run.ts [--sample N]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:4000";
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || process.env.ANTHROPIC_API_KEY || "not-needed";
const MODEL = "gpt-5.2"; // Same model as evaluator agent
const PROMPTS_DIR = "agents/shared/knowledge/experiments/EXP-039/phase-b-prompts";
const RESULTS_FILE = "agents/shared/knowledge/experiments/EXP-039/phase-b-results.jsonl";

interface EvalScores {
  quality: number;
  efficiency: number;
  verdict: string;
  issues: string[];
}

// ── Evaluator system prompt ────────────────────────────────────────────

const EVALUATOR_SYSTEM = `You are an expert evaluator assessing agent performance in multi-agent task trees.

Score each agent independently based on their role and the observable evidence in the transcript.

## Scoring Guidelines
- quality: 0.0-1.0 (0=critical failure, 0.5=acceptable, 0.8=good, 1.0=excellent)
- efficiency: 0.0-1.0 (0=wasted all tokens, 0.5=some waste, 0.8=mostly efficient, 1.0=direct path)
- verdict: "critical_failure" | "needs_improvement" | "acceptable" | "good" | "excellent"
- issues: array of specific problems found (empty if none)

## Output Format
Output ONLY a JSON block in a code fence:

\`\`\`json
{
  "agents": {
    "agent_name": {
      "quality": 0.0,
      "efficiency": 0.0,
      "productive_calls": 0,
      "wasted_calls": 0,
      "verdict": "string",
      "issues": ["issue1", "issue2"]
    }
  },
  "overall": {
    "quality": 0.0,
    "efficiency": 0.0,
    "verdict": "string",
    "result_delivered": true
  }
}
\`\`\`

Be a SKEPTICAL AUDITOR. Score based on structural evidence (files changed, tests passed, exit codes), not agent claims.`;

// ── API call ───────────────────────────────────────────────────────────

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `${MODEL_BASE_URL}/v1/chat/completions`;
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
    temperature: 0.1, // Low temp for more consistent scoring
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LITELLM_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error: ${response.status} ${text.slice(0, 500)}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || "";
}

// ── Parse evaluation response ──────────────────────────────────────────

function parseEvalResponse(text: string): { overall: EvalScores; agents: Record<string, EvalScores> } {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n\s*```/);
  const defaultResult = {
    overall: { quality: 0, efficiency: 0, verdict: "needs_improvement", issues: [] as string[] },
    agents: {} as Record<string, EvalScores>,
  };

  if (!jsonMatch) return defaultResult;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.agents && typeof parsed.agents === "object") {
      for (const [name, scores] of Object.entries(parsed.agents)) {
        const s = scores as Record<string, unknown>;
        defaultResult.agents[name] = {
          quality: typeof s.quality === "number" ? s.quality : 0,
          efficiency: typeof s.efficiency === "number" ? s.efficiency : 0,
          verdict: typeof s.verdict === "string" ? s.verdict : "needs_improvement",
          issues: Array.isArray(s.issues) ? (s.issues as string[]) : [],
        };
      }
    }
    if (parsed.overall && typeof parsed.overall === "object") {
      const o = parsed.overall as Record<string, unknown>;
      defaultResult.overall = {
        quality: typeof o.quality === "number" ? o.quality : 0,
        efficiency: typeof o.efficiency === "number" ? o.efficiency : 0,
        verdict: typeof o.verdict === "string" ? o.verdict : "needs_improvement",
        issues: [],
      };
    }
  } catch { /* keep defaults */ }

  return defaultResult;
}

// ── Main ───────────────────────────────────────────────────────────────

const maxSamples = parseInt(process.argv.find(a => a.startsWith("--sample"))?.split("=")?.[1] ?? "3");

console.log("=" .repeat(76));
console.log("EXP-039 Phase B: Direct LLM Evaluator Comparison");
console.log(`Model: ${MODEL} @ ${MODEL_BASE_URL}`);
console.log(`Max samples: ${maxSamples}`);
console.log("=" .repeat(76));

if (!existsSync(PROMPTS_DIR)) {
  console.log(`\nNo prompts found at ${PROMPTS_DIR}`);
  console.log("Run: bun scripts/exp039-phase-b.ts --run  (to generate prompts first)");
  process.exit(1);
}

// Find prompt pairs
const files = readdirSync(PROMPTS_DIR);
const treeIds = [...new Set(files.map(f => f.replace(/_isolated\.md$|_contextual\.md$/, "")))];

console.log(`\nFound ${treeIds.length} prompt pairs`);

// Sort by smallest file size first (cheapest to test)
const treesBySize = treeIds.map(id => {
  const isolatedFile = join(PROMPTS_DIR, `${id}_isolated.md`);
  const size = existsSync(isolatedFile) ? readFileSync(isolatedFile).length : Infinity;
  return { id, size };
}).sort((a, b) => a.size - b.size);

const results: Array<{
  treeId: string;
  contextual: ReturnType<typeof parseEvalResponse>;
  isolated: ReturnType<typeof parseEvalResponse>;
  qualityDelta: number;
  efficiencyDelta: number;
  verdictChanged: boolean;
}> = [];

let tested = 0;
for (const { id: treeId } of treesBySize) {
  if (tested >= maxSamples) break;

  const isolatedFile = join(PROMPTS_DIR, `${treeId}_isolated.md`);
  const contextualFile = join(PROMPTS_DIR, `${treeId}_contextual.md`);
  
  if (!existsSync(isolatedFile) || !existsSync(contextualFile)) continue;

  const isolatedPrompt = readFileSync(isolatedFile, "utf-8");
  const contextualPrompt = readFileSync(contextualFile, "utf-8");

  // Extract existing scores from the prompt header
  const existingMatch = isolatedPrompt.match(/# Existing scores: (.+)/);
  console.log(`\n── ${treeId} ──`);
  console.log(`   Existing scores: ${existingMatch?.[1] ?? "unknown"}`);
  console.log(`   Isolated prompt: ${isolatedPrompt.length} chars`);
  console.log(`   Contextual prompt: ${contextualPrompt.length} chars`);

  // Skip very large prompts (>200K chars) — they'd be truncated or too expensive
  if (isolatedPrompt.length > 200_000) {
    console.log("   ⏭  Skipping (prompt too large > 200K chars)");
    continue;
  }

  try {
    // Call with contextual prompt
    console.log("   📝 Running contextual evaluation...");
    const contextualResponse = await callLLM(EVALUATOR_SYSTEM, contextualPrompt);
    const contextualResult = parseEvalResponse(contextualResponse);
    console.log(`      Overall: Q=${contextualResult.overall.quality} E=${contextualResult.overall.efficiency} V=${contextualResult.overall.verdict}`);
    
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));

    // Call with isolated prompt  
    console.log("   🔒 Running isolated evaluation...");
    const isolatedResponse = await callLLM(EVALUATOR_SYSTEM, isolatedPrompt);
    const isolatedResult = parseEvalResponse(isolatedResponse);
    console.log(`      Overall: Q=${isolatedResult.overall.quality} E=${isolatedResult.overall.efficiency} V=${isolatedResult.overall.verdict}`);

    const qualityDelta = isolatedResult.overall.quality - contextualResult.overall.quality;
    const efficiencyDelta = isolatedResult.overall.efficiency - contextualResult.overall.efficiency;
    const verdictChanged = isolatedResult.overall.verdict !== contextualResult.overall.verdict;

    results.push({
      treeId,
      contextual: contextualResult,
      isolated: isolatedResult,
      qualityDelta,
      efficiencyDelta,
      verdictChanged,
    });

    console.log(`   📊 Delta: Q=${qualityDelta > 0 ? "+" : ""}${qualityDelta.toFixed(2)} E=${efficiencyDelta > 0 ? "+" : ""}${efficiencyDelta.toFixed(2)} V:${verdictChanged ? "CHANGED" : "same"}`);

    // Per-agent comparison
    const allAgents = new Set([...Object.keys(contextualResult.agents), ...Object.keys(isolatedResult.agents)]);
    for (const agent of allAgents) {
      const ctx = contextualResult.agents[agent];
      const iso = isolatedResult.agents[agent];
      if (ctx && iso) {
        const aq = iso.quality - ctx.quality;
        console.log(`      ${agent}: Q ${ctx.quality}→${iso.quality} (${aq >= 0 ? "+" : ""}${aq.toFixed(2)}) V: ${ctx.verdict}→${iso.verdict}`);
        if (iso.issues.length > 0) {
          console.log(`        Issues (isolated): ${iso.issues.slice(0, 3).join("; ")}`);
        }
      }
    }

    tested++;
  } catch (err) {
    console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────

if (results.length > 0) {
  console.log(`\n${"═".repeat(76)}`);
  console.log("SUMMARY");
  console.log("═".repeat(76));

  const avgQDelta = results.reduce((s, r) => s + r.qualityDelta, 0) / results.length;
  const avgEDelta = results.reduce((s, r) => s + r.efficiencyDelta, 0) / results.length;
  const verdictChanges = results.filter(r => r.verdictChanged).length;
  const qualityDrops = results.filter(r => r.qualityDelta < -0.05).length;
  const qualityGains = results.filter(r => r.qualityDelta > 0.05).length;

  console.log(`  Trees compared:      ${results.length}`);
  console.log(`  Avg quality delta:   ${avgQDelta >= 0 ? "+" : ""}${avgQDelta.toFixed(3)}`);
  console.log(`  Avg efficiency delta: ${avgEDelta >= 0 ? "+" : ""}${avgEDelta.toFixed(3)}`);
  console.log(`  Verdict changes:     ${verdictChanges}/${results.length}`);
  console.log(`  Quality drops (>0.05): ${qualityDrops}`);
  console.log(`  Quality gains (>0.05): ${qualityGains}`);

  if (Math.abs(avgQDelta) > 0.1) {
    console.log(`\n📊 SIGNIFICANT: Isolated evaluation ${avgQDelta < 0 ? "LOWERS" : "RAISES"} quality by ${Math.abs(avgQDelta).toFixed(2)}`);
    console.log("   → Agent self-narrative DOES influence LLM evaluator scoring.");
    console.log("   → H-009 SUPPORTED: confirmation bias detected in LLM evaluator.");
  } else if (Math.abs(avgQDelta) > 0.05) {
    console.log(`\n📊 WEAK SIGNAL: Quality delta (${avgQDelta >= 0 ? "+" : ""}${avgQDelta.toFixed(3)}) suggests minor bias.`);
    console.log("   → More samples needed to confirm.");
  } else {
    console.log(`\n📊 NOT SIGNIFICANT: Quality delta (${avgQDelta >= 0 ? "+" : ""}${avgQDelta.toFixed(3)}) is within noise.`);
    console.log("   → Agent self-narrative may not strongly influence LLM evaluator.");
    console.log("   → H-009 NOT SUPPORTED for LLM evaluation path.");
  }

  // Save results
  const resultLines = results.map(r => JSON.stringify({
    ...r,
    timestamp: Date.now(),
    model: MODEL,
  }));
  
  mkdirSync(join(PROMPTS_DIR, ".."), { recursive: true });
  writeFileSync(RESULTS_FILE, resultLines.join("\n") + "\n");
  console.log(`\nResults saved to ${RESULTS_FILE}`);
} else {
  console.log("\nNo results to report.");
}
