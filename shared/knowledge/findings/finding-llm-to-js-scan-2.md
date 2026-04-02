# Finding: LLM-to-JS Opportunity Scan #2

**Date**: 2026-03-18T14:49Z
**Periodic task**: LLM-to-JS opportunity scan

## Key Finding: Growth-Cycle Gym Test Step → JS Handler

### Current State
Coach's `growth-cycle.ts` workflow runs **4 separate LLM sessions** per experiment:
1. **Diagnose** (368KB session) — requires LLM judgment ✅
2. **Fork & Patch** (364KB session) — requires LLM judgment ✅  
3. **Gym Test** (41KB session) — **MECHANICAL** ❌ just runs gym-run.sh + parses JSON
4. **Record** (265KB session) — **PARTIALLY MECHANICAL** ❌ promote/discard is formulaic

### The Problem
Step 3 is pure IO: run `scripts/gym-run.sh <scenario> --agent <agent> --lab <fork> --timeout 3`, capture JSON output, run baseline for comparison. An LLM session for this is ~41KB of tokens just for bash commands and JSON parsing.

Step 4's promote/discard decision is a simple comparison (patched_score > baseline_score → promote, else discard). Only the method-catalog update genuinely needs LLM judgment.

### Proposed JS Solution
**Merge Steps 3+4 into a JS handler** (`gym-test-and-record.ts`):
1. Accept params: `{ fork, agent, scenarios, method, errorPattern }`
2. Run gym-run.sh for each scenario (baseline + patched)
3. Parse JSON results
4. Apply decision rule: patched > baseline → promote, else discard
5. Append to experiments.jsonl (structured JSON, no LLM needed)
6. Call promote_agent/discard_agent programmatically
7. Return results to the workflow — Step 4 becomes a single LLM session that just updates method-catalog.md with observations

### Savings Estimate
- Per growth-cycle: eliminate 1 full LLM session (Step 3), simplify Step 4
- ~41KB + partial 265KB = ~150-200KB tokens saved per experiment
- Coach runs ~4-8 experiments/day = **600KB-1.6MB tokens/day saved**
- At $15/M tokens (Opus) = **$9-24/day ($270-720/month)**

### Second Finding: Coach Ceiling Effect Waste

Coach's last 4 experiments (exp-061 to exp-064) all hit the same problem:
**All available test agents (amy, may, amy-kimi) pass ALL scenarios at baseline.**

This means Coach is burning sessions:
- Creating new scenarios → agents still pass
- Running growth-cycles → inconclusive (ceiling effect)
- Each wasted cycle = 4 LLM sessions × ~260KB avg = ~1MB

75 experiments logged, but recent ones are all "INCONCLUSIVE" or "ALL PASS".
Coach's heartbeat says "NEVER IDLE — ALWAYS EXPLORE" but this leads to
burning tokens on experiments that can't produce signal.

**Fix**: Coach should self-gate on ceiling-effect detection:
- If last 3+ experiments were inconclusive/all-pass → STOP creating scenarios
- Focus on method invention (Step 4) or wait for harder scenarios from Hao
- Or: register `coder` agent in oneshot runtime (the agent that actually fails)

### Session Volume Context
- Coach: 20 of last 100 sessions (20% of all sessions)
- 11 heartbeats, 4 growth-cycle steps, 2 reflect, 2 common-sense-verify, 1 consolidate-memory
- 7 of 11 heartbeats had ≤15 lines (largely idle)

### Actions
1. **Gym-test JS handler** → Send design to tech-lead for implementation
2. **Ceiling-effect guard** → Add to coach heartbeat as self-gating rule
3. **Register coder in oneshot** → Send to tech-lead (coder is the agent that actually fails)
