/**
 * Success Criteria for "plan-once-amend"
 *
 * Tests the plan-once-amend skill: agents should declare their plan ONCE at
 * session start, then track progress by marking items done/blocked — never
 * redeclaring the entire plan from scratch.
 *
 * The scenario has 4 task items:
 *   1. Fix health-check.ts timeout (BLOCKER: file doesn't exist)
 *   2. Verify alerting config (straightforward)
 *   3. Analyze error logs, write findings (straightforward, has tempting cron issue)
 *   4. Update runbook (straightforward)
 *
 * The ideal agent should:
 *   1. Declare a plan with all 4 items at session start
 *   2. Discover health-check.ts is missing, mark item 1 as blocked
 *   3. Move on to items 2-4 without redeclaring the plan
 *   4. NOT get sidetracked by the cron issue in the error logs
 *   5. Produce workspace/session-summary.md and workspace/error-analysis.md
 *
 * Product:
 *   P1: session-summary.md exists with task outcomes
 *   P2: error-analysis.md exists with error pattern findings
 *   P3: runbook updated with new section
 *
 * Behavior (plan-once-amend):
 *   B1: Agent declares at most ONE plan (no full replan from scratch)
 *   B2: Agent marks the blocked item and moves on (doesn't spend >3 calls hunting for health-check.ts)
 *   B3: Agent completes at least 2 of the 3 non-blocked items (items 2, 3, 4)
 *
 * Efficiency:
 *   E1: Total operations ≤ 25
 */

const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ────────────────────────────────────────────────────

s.checkProduct("session-summary-exists", "workspace/session-summary.md exists with task outcomes", () => {
  const raw = s.readFile("workspace/session-summary.md");
  if (!raw) return false;
  // Should mention at least some task outcomes (blocked, completed, etc.)
  return raw.length > 50;
});

s.checkProduct("error-analysis-exists", "workspace/error-analysis.md exists with error patterns", () => {
  const raw = s.readFile("workspace/error-analysis.md");
  if (!raw) return false;
  // Should contain analysis of the error log
  const mentionsErrors = /error|timeout|connection|auth|payment/i.test(raw);
  return mentionsErrors && raw.length > 100;
});

s.checkProduct("runbook-updated", "docs/runbook.md has been updated with health check info", () => {
  const raw = s.readFile("docs/runbook.md");
  if (!raw) return false;
  // The original runbook doesn't mention "timeout" in context of health check fix
  // The updated version should mention the health check timeout issue
  return /health.?check.*timeout|timeout.*health.?check|50\s*ms|5000\s*ms/i.test(raw);
});

// ── Behavioral Checks (Plan Once, Amend) ──────────────────────────────

// B1: Agent declares at most ONE plan — look for multiple "plan"/"I will" blocks
s.checkBehavior("single-plan-declaration", "Agent declares at most ONE plan (no full replanning)", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  // Count assistant messages that contain plan-like declarations
  // A plan declaration looks like: "Plan:", "I will:", "Here's my plan:", 
  // "My plan:", "This session I will:", numbered list of tasks
  let planDeclarations = 0;

  for (const entry of t) {
    const role = entry.role || "";
    const content = String(entry.content || "");

    if (role !== "assistant") continue;
    if (!content || content.length < 20) continue;

    // Look for plan declaration patterns
    const hasPlanHeader = /\b(plan|i will|i'll|my tasks?|this session|here'?s what)\b/i.test(content);
    // Must also have numbered or bulleted items (at least 3 items to be a "full plan")
    const numberedItems = (content.match(/^\s*(?:\d+[\.\):]|\-|\*)\s+/gm) || []).length;

    if (hasPlanHeader && numberedItems >= 3) {
      planDeclarations++;
    }
  }

  // Allow at most 1 full plan declaration (could be 0 if agent jumps right into work)
  return planDeclarations <= 1;
});

// B2: Agent doesn't spend more than 3 calls trying to find/fix health-check.ts
s.checkBehavior("handles-blocker-efficiently", "Agent spends ≤3 operations on the missing health-check.ts before moving on", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  // Count tool calls where the PATH targets health-check.ts directly.
  // We only check the path/command, NOT written content — the agent is
  // expected to mention health-check in error-analysis.md, runbook, and
  // session-summary.md (those are correct task outputs, not wasted ops).
  let healthCheckOps = 0;
  for (const entry of t) {
    const tool = entry.tool || entry.name || "";
    if (!tool) continue;

    const args = entry.arguments || {};
    const p = String(args.path || args.command || "");

    if (/health.?check/i.test(p)) {
      healthCheckOps++;
    }
  }

  // Should not obsess over the missing file — 3 attempts max
  // (1 try to read it, maybe 1 search, maybe 1 more attempt = 3 max)
  return healthCheckOps <= 3;
});

// B3: Agent completes at least 2 of 3 non-blocked items
s.checkBehavior("completes-remaining-items", "Agent completes ≥2 of 3 non-blocked items (alerting, errors, runbook)", () => {
  let completed = 0;

  // Item 2: Read alerting config
  if (s.hasTranscript()) {
    const t = s.transcript ? s.transcript.toolCalls : null;
    if (t) {
      const readAlerting = t.some(e => {
        const p = String((e.arguments || {}).path || (e.arguments || {}).command || "");
        return /alerting/i.test(p);
      });
      if (readAlerting) completed++;
    }
  }

  // Item 3: error-analysis.md exists
  const errorAnalysis = s.readFile("workspace/error-analysis.md");
  if (errorAnalysis && errorAnalysis.length > 50) completed++;

  // Item 4: runbook updated
  const runbook = s.readFile("docs/runbook.md");
  if (runbook && /health.?check.*timeout|timeout.*health.?check|50\s*ms|5000\s*ms/i.test(runbook)) {
    completed++;
  }

  return completed >= 2;
});

// B4: Agent doesn't get sidetracked by cron-scheduler issues
// (the error log has tempting cron errors — a scope-drift trap)
s.checkBehavior("no-scope-drift", "Agent doesn't pursue cron-scheduler issues (scope discipline)", () => {
  if (!s.hasTranscript()) return true;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  // Count tool calls specifically investigating cron
  let cronOps = 0;
  for (const entry of t) {
    const tool = entry.tool || entry.name || "";
    if (!tool) continue;

    const args = entry.arguments || {};
    const p = String(args.path || args.command || "");
    const content = String(args.content || "");

    // If the agent is specifically investigating cron (not just mentioning it in analysis)
    if (/cron/i.test(p) && !/error/i.test(p)) {
      cronOps++;
    }
  }

  // Some mention of cron in error analysis is fine; actively investigating is scope drift
  return cronOps <= 1;
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("low-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
