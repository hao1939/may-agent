# Finding: Optimizer Self-Efficiency Analysis (Mode C)
**Date:** 2026-04-20 | **Window:** Last 6 hours | **Sessions:** 149 | **Total ops:** 1,221

## Executive Summary

Optimizer ran 149 sessions averaging 8.2 ops each. **35 sessions (23.5%) were zero-op** — mostly review sessions that returned verdicts without tool calls. Only 2% of wall-clock time was spent on zero-op sessions, so the waste is in **session startup overhead**, not time. The bigger concern: **42 of 112 evaluated sessions (37.5%) scored "needs_improvement"** with avg efficiency of 0.33.

## Key Findings

### 1. Zero-Op and 1-Op Sessions (41 total, 27.5%)

| Bucket | Count | What they are |
|--------|-------|---------------|
| 0-ops | 35 | Review-only calls from persistent-task workflow. Optimizer acts as reviewer, returns verdict without tool calls. |
| 1-op | 6 | Same pattern — reviews that needed just one read before deciding. |

**Root cause:** The persistent-task workflow calls optimizer as reviewer. When the reviewer can decide from the prompt context alone (e.g., "worker was interrupted, CONTINUE"), no tools are needed. This is **correct behavior** — the zero-op sessions are fast (avg 12s) and cheap. The real question is whether 35 review sessions could be batched or filtered pre-call.

### 2. Op Distribution by Kind

| Kind | Sessions | Avg Ops | Total Ops |
|------|----------|---------|-----------|
| call | 115 | 7.9 | 914 |
| job | 34 | 9.0 | 307 |

No "heartbeat" or "persistent-task" kind — optimizer's sessions are either direct calls (reviews + work iterations) or cron jobs. The 115 call sessions dominate; most are persistent-task work/review iterations.

### 3. High-Op Sessions (>20 ops): 18 sessions, 551 ops (45% of all ops)

**Top offenders:**
- **68 ops** — Fixing workflowRunId tracking gap (investigation + implementation)
- **57 ops** — Persistent-task iteration 15 (workflow-first project)
- **41 ops** — Persistent-task workflow runner
- **37 ops** — Workflow-first culture P0 project

These are legitimate deep work sessions. The 68-op investigation session is the only outlier — that's an unusually long session that could have been split into investigation + implementation phases.

### 4. Productive vs Wasted Calls

The evaluations table shows 0 productive/0 wasted (fields not populated), but **verdict + efficiency scores** tell the story:

| Verdict | Sessions | Avg Ops | Avg Efficiency | Avg Quality |
|---------|----------|---------|----------------|-------------|
| needs_improvement | 42 | 6.6 | 0.33 | 0.27 |
| acceptable | 37 | 13.2 | 0.58 | 0.69 |
| good | 25 | 4.0 | 0.83 | 0.82 |
| skipped | 8 | 5.2 | — | — |

**Critical insight:** "good" sessions average only 4 ops while "needs_improvement" average 6.6 ops. More ops ≠ better results. The best sessions are focused and brief.

**Top issues in needs_improvement sessions:**
- Making unverified claims (saying 100% coverage when data shows otherwise)
- Edit failures not caught — claiming work done when edits didn't apply
- Violating explicit constraints (editing files when told REVIEW ONLY)
- Metric methodology errors
- Relying on assertions instead of tool evidence

### 5. Time Efficiency

| Bucket | Sessions | Avg Duration | Per-Op Time |
|--------|----------|-------------|-------------|
| 0-ops | 33 | 12s | — |
| 1-op | 6 | 46s | 46.0s |
| 2-5 ops | 41 | 213s | 83.7s |
| 6-10 ops | 30 | 97s | 13.2s |
| 11-20 ops | 19 | 169s | 11.1s |
| 21+ ops | 18 | 243s | 7.9s |

**Anomaly:** 2-5 op sessions take 83.7s per op — much slower than 6+ op sessions (8-13s/op). These may be sessions where the LLM is "thinking hard" but not acting, or sessions hitting errors/retries on their few calls.

## Recommendations

### R1: Pre-filter trivial reviews (saves ~15 sessions/6h)
When the persistent-task worker was interrupted or made zero progress, skip the optimizer review call entirely. The orchestrator already knows the session was interrupted — no need for a reviewer to say "CONTINUE."

### R2: Fix the accuracy problem in work sessions
37.5% "needs_improvement" rate is too high. The top issues are all **verification failures** — optimizer claims results without checking. Add a self-check step: before calling `finish()`, verify each claim with a tool call.

### R3: Investigate the slow 2-5 op sessions
83.7s per op is 6-10x slower than normal. These sessions may be spending most time on prompt processing rather than tool use. Consider whether they're doing too much "reasoning" in context and too little actual work.

### R4: Cap investigation sessions at ~30 ops
The 68-op session is an outlier. For investigation tasks, set a soft cap: investigate in one session, implement in the next. This improves reviewability and reduces blast radius of wrong approaches.

### R5: Populate productiveCalls/wastedCalls in evaluations
These fields are all zero — the heuristic evaluator isn't filling them. Fixing this would enable much sharper efficiency analysis.
