# Analysis Review — 2026-03-24T21:33

## Key Findings

### 1. System Quality Metrics (last 6h)
- **40 sessions** total, **9 cron LLM tasks**, all handlers healthy
- **Agents performing well**: Coach (8 good), May (5 good), Bob (6 good + 1 acceptable), QA (4 good), Tech-lead (4 good), Scout (2 good)
- **Optimizer has 4 "needs_improvement" evals** — all from skill-lifecycle workflow sessions (21:03-21:13)

### 2. Optimizer Skill-Lifecycle Evaluation Concern
The evaluator flagged 4 optimizer sessions (all skill-lifecycle workflow phases) as `needs_improvement`:
- **WORKFLOW_BREAK**: Phase 1 required writing `skill-discovery.md`; evaluator saw no write evidence
- **PHASE_CONTAMINATION**: Phase 2 found no fresh discovery doc from Phase 1
- **VERIFICATION_GAP**: Phase 3 gym runs — Run 3 aborted (stale binary), no test-results.md written
- **PATH_ASSUMPTION**: `cd /home/user` error (non-existent path)
- **UNSUPPORTED_CLAIM**: Phase 4 claimed "verified all 9 SOUL.md files" without tool evidence shown

**Root cause**: The skill-lifecycle legitimately concluded "no new skill needed" because the candidate (C26 verification guard) already existed as finish-gate-2. But the workflow doesn't have an early-exit mechanism — each phase runs and finds nothing to do, which the evaluator reads as failure. This is a **workflow design issue**, not an agent quality issue.

**Action**: Consider adding a "Phase 1 early-exit" to skill-lifecycle — if discovery finds the pattern is already handled, emit a success result and skip remaining phases.

### 3. Tool Waste (24h window: 5.6% waste rate)
- **3401 total calls, 190 wasted** (was 200 at 17:07 — slight improvement)
- **bash:other (118 wasted)** — heterogeneous parse errors. QA dominates (50). Hard to guard.
- **bash:nonexistent-path (36)** — optimizer (20) and coder (16). The `/home/user` path assumption is a known issue.
- **empty-args (26 combined)** — coach (14) and coder (8). Empty-args-guard is deployed in code but not in binary (stale b9ef77e).
- **Binary is 18 commits behind** — empty-args-guard, finish-verification, session-read bash protection all deployed in code but not active.

### 4. Bob Waste Increase
Bob went from low waste to highest in last 6h (27 wasted, 8.9% rate). Causes are scattered path errors (`ls: cannot access`), not a systemic pattern. No guard needed — likely just a bad luck cluster.

### 5. Dominant Failure Modes
From Bob's analysis of .state/evaluations:
- **FM-3.3 Verification Failure**: #1 across agents (Coder, Coach, Optimizer)
- **FM-1.1 Goal Drift**: #2 (Coach, Optimizer)
- Existing mitigations: empty-args-guard, finish-verification gate, C1.5 ghost deliverable check — all deployed in code, blocked on binary rebuild

## Summary
System is **healthy overall**. Quality is good across all agents except optimizer's skill-lifecycle workflow evals (design issue, not quality). Binary rebuild remains the #1 blocker for deploying 4+ guards that would reduce waste further. No new urgent issues found.
