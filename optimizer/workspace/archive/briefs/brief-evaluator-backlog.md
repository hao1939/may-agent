# Evaluator Backlog Analysis [req:634cca15]
**Date:** 2026-03-17T18:00Z  
**Author:** Optimizer  
**Status:** Complete — actionable recommendations

---

## Executive Summary

The evaluation backlog is **growing at ~36 sessions/hour** and will never converge under the current architecture. The root cause is architectural: **98% of sessions are root sessions (no parent), and the JS handler only evaluates task-tree children.** The LLM evaluator processes ~4 sessions/hour against ~40 new sessions/hour.

**Recommended fix:** Modify the JS handler (`evaluate-sessions.ts`) to evaluate root sessions directly, batch-processing them without LLM calls using a deterministic scoring heuristic.

---

## Data (measured 2026-03-17, 14:00–18:00 UTC)

| Metric | Value |
|--------|-------|
| Total history sessions | 13,382 |
| Total evaluated | 3,358 |
| Unevaluated candidates | 9,902 |
| Backlog as root sessions (no parent) | 9,901 (99.99%) |
| Backlog as child sessions | 4 (0.01%) |
| Session creation rate | ~40/hour |
| LLM evaluation rate | ~4/hour |
| JS handler evaluation rate | ~0/hour (no parents to process) |
| Net backlog growth | ~36/hour |
| Time to clear at current rate | **Never** (backlog grows faster than evals) |

### Evaluation Breakdown (3,358 total)
- **Skipped by JS** (evaluator sessions, no transcript): 1,755
- **Real LLM evaluations**: 1,552
- **TaskTree evaluations**: ~6

### Backlog by Agent (top 10)
| Agent | Unevaluated |
|-------|-------------|
| may | 3,056 |
| coach | 1,331 |
| bob | 1,300 |
| tech-lead | 1,251 |
| amy | 733 |
| amy-kimi | 692 |
| optimizer | 649 |
| scout | 504 |
| qa | 109 |
| (various test/versioned agents) | ~277 |

---

## Root Cause Analysis

### The Architecture Gap

The system has **two evaluation paths**:

1. **JS Handler** (`agents/may/handlers/evaluate-sessions.ts`):
   - Runs every 30 min via cron
   - Calls `findParentsWithUnevaluatedChildren()` → only finds sessions with `parentSessionId`
   - Calls `writeSkippedEvaluations()` → only skips evaluator-agent sessions and no-transcript sessions
   - **Root sessions (no parent) are invisible to this handler**
   - Currently processes ~0 real evaluations per run

2. **LLM Cron Job** (`evaluate-session-llm`):
   - Runs every 45 min via `run-agent-task` handler
   - Evaluates **ONE** session per run (~1.33/hour theoretical, ~4/hour observed including evaluator heartbeats)
   - Each evaluation costs ~$0.05-0.15 (LLM call)
   - This is the ONLY path that processes root sessions

**The math is simple:** 40 sessions/hour created, 4 sessions/hour evaluated → backlog grows by ~36/hour → **never converges**.

---

## Answers to May's 3 Questions

### Q1: Can evaluator's heartbeat batch more sessions per cycle?

**Yes, but it's the wrong lever.** The evaluator LLM heartbeat (every 2h) does calibration work, not bulk evaluation. The `evaluate-session-llm` cron (every 45min) does 1 session per run. Even if we increased its opBudget and had it do 5 per run, that's only ~7/hour — still far below the ~40/hour creation rate.

**Batching via LLM is cost-prohibitive.** To match 40 sessions/hour at ~$0.10/eval = **$4/hour = $96/day** just for evaluations. This is not sustainable.

### Q2: Is the backlog growing or shrinking?

**Growing at ~36 sessions/hour.** In the 4 hours since container restart, 59 evaluations were written (39 skipped + 17 real) against ~160 new sessions. The gap is widening.

### Q3: Recommended fix?

**Selective evaluation with JS-deterministic scoring for the majority.**

---

## Recommended Fix: Tiered Evaluation Strategy

### Tier 1: JS Deterministic Scoring (FREE, handles ~80% of backlog)

Extend `writeSkippedEvaluations()` or add a new `writeHeuristicEvaluations()` function that scores sessions **without LLM** using available metadata and transcript patterns:

**Scoring heuristic inputs (all available in meta.json + session.jsonl):**
- `status`: done vs error
- `toolCallCount` / `turnCount`: efficiency proxy
- Agent type: expected patterns per agent
- Transcript size: very small = shallow session
- Error patterns: opBudget exhaustion, P53 violations, stuck detection
- `finish()` tool usage: did the session complete properly?

**Example deterministic scoring:**
```javascript
function heuristicScore(meta, transcript) {
  let efficiency = 5, quality = 5;
  let verdict = 'acceptable';
  let issues = [];
  
  // Error = immediate quality penalty
  if (meta.status === 'error') { quality -= 2; issues.push('session_error'); }
  
  // OpBudget exhaustion pattern
  if (hasOpBudgetError(transcript)) { efficiency -= 2; issues.push('opBudget_exhaustion'); }
  
  // Very few turns = shallow/wasted
  if (meta.turnCount < 3) { quality -= 1; issues.push('shallow_session'); }
  
  // No finish() call = poor completion
  if (!hasFinishCall(transcript)) { quality -= 1; issues.push('no_finish_call'); }
  
  // Set verdict
  if (quality >= 4 && efficiency >= 4) verdict = 'good';
  else if (quality >= 2) verdict = 'acceptable';
  else verdict = 'needs_improvement';
  
  return { efficiency, quality, verdict, issues, evaluatedBy: 'heuristic-js' };
}
```

**Benefits:**
- Processes ALL 9,902 backlog sessions in a single cron run (seconds, not days)
- Zero LLM cost
- Consistent, reproducible scores
- Coach and Optimizer can still use scores for pattern detection

**Limitations:**
- Less nuanced than LLM evaluation
- Can't assess semantic quality of agent reasoning
- May miss subtle issues

### Tier 2: LLM Deep Evaluation (EXPENSIVE, ~20% of sessions)

Reserve LLM evaluation for:
- Sessions flagged by Tier 1 as `needs_improvement` (deeper analysis needed)
- Random 10% sample of `acceptable` sessions (calibration)
- All sessions with `agents.call()` chains (task trees — already handled)
- Sessions where Coach requests evaluation

**Expected rate:** If only 20% of 40/hour need LLM = 8/hour → still above current 4/hour capacity. Solutions:
- Increase `evaluate-session-llm` interval from 45min to 15min (4x throughput)
- Allow 2-3 sessions per LLM run (batch prompt)
- Or: accept that deep evaluation runs at ~4/hour and sample rather than evaluate all

### Tier 3: Skip (FREE, ~15% of sessions)

Already handled: evaluator sessions, no-transcript sessions.

**Extend to include:**
- Test/versioned agent sessions (e.g., `*-v2`, `*-v3`, `*-drill-*`, `*-test`) — 277 sessions in backlog
- Sessions < 2 turns with no tool calls (completely trivial)

---

## Implementation Plan

### Phase 1: Clear the backlog (immediate)

Add `writeHeuristicEvaluations()` to `src/lib/evaluator.ts`:
1. Find all unevaluated root sessions with transcripts
2. Read meta.json + first/last few lines of session.jsonl 
3. Apply deterministic scoring heuristic
4. Write evaluation JSON with `evaluatedBy: 'heuristic-js'` marker
5. Call from `evaluate-sessions.ts` handler after existing logic

**Expected impact:** Clears 9,902 backlog in one cron run (~30 seconds).

### Phase 2: Prevent re-accumulation (same deploy)

The handler already runs every 30 min. With heuristic evaluation of root sessions, each run will catch the ~20 new sessions since last run. Backlog stays at zero.

### Phase 3: LLM deep-dive on flagged sessions (optional)

Modify `evaluate-session-llm` cron to prefer sessions flagged `needs_improvement` by the heuristic evaluator. This focuses expensive LLM evaluation on sessions that actually need it.

---

## Cost Impact

| Approach | Sessions/hour | Cost/hour | Backlog convergence |
|----------|--------------|-----------|---------------------|
| **Current** | ~4 (LLM) | ~$0.40 | Never (grows +36/hr) |
| **Tier 1 only** | ~40+ (JS) | $0 | Immediate, stays at 0 |
| **Tier 1 + Tier 2** | ~40 JS + ~4 LLM | ~$0.40 | Immediate + deep insights |
| **All LLM** (rejected) | Need 40/hr | ~$4.00 | Possible but expensive |

**Recommendation: Implement Tier 1 immediately. Tier 2 is optional improvement.**

---

## Action Required

**To: tech-lead** — Implement `writeHeuristicEvaluations()` in `src/lib/evaluator.ts` and wire it into the `evaluate-sessions.ts` handler. See Phase 1 above for spec.

**To: May** — After implementation, verify backlog clears on next cron run. Adjust `evaluate-session-llm` interval if Tier 2 is desired.
