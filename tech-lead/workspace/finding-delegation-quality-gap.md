# Finding: Delegation Quality Gap (0.80 vs 0.85 target)

**Date**: 2026-04-18 | **Lens**: B (Flow Complexity) | **Severity**: Medium

## Summary

The delegation quality metric (tracked in `agents/tech-lead/workspace/heartbeat-context.md:3`) targets 0.85 but actual 24h average across all 213 delegated sessions is **0.73**. The gap is driven by three clear patterns: (1) self-delegated sessions from coach/tech-lead/bob scoring 0 due to evaluator skipping same-agent delegations, (2) FM-2.6 (reasoning-action mismatch) and FM-3.3 (deliverable integrity) failures in tech-lead→tech-lead lens sessions, and (3) coder retry sessions scoring poorly.

## Evidence

### By delegator → delegatee (24h, n=213)

| Delegator → Agent | Avg Quality | Count | Low (<0.5) |
|---|---|---|---|
| tech-lead → qa | 0.15 | 1 | 1 |
| tech-lead → tech-lead | 0.63 | 26 | 9 (35%) |
| coach → coach | 0.64 | 31 | 7 (23%) |
| bob → may | 0.66 | 9 | 3 |
| tech-lead → coder | 0.69 | 30 | 6 (20%) |
| scout → scout | 0.76 | 7 | 1 |
| bob → bob | 0.78 | 60 | 6 |
| optimizer → optimizer | 0.85 | 48 | 0 |

### Top drag factors

**1. Zero-score "evaluator skipped" sessions (n≈8, quality=0)**
Coach→coach and bob→bob self-delegations get `quality=0` with issue "evaluator did not score this session (duplicate agent name)". These zeros heavily drag the average. This is an evaluator bug, not a delegation quality issue.

**2. Tech-lead lens sessions: FM-2.6 + FM-3.3 (n=26, avg=0.63)**
Tech-lead self-delegates investigation tasks (Lens A/B/C/D) which consistently fail on:
- `FM-2.6` (DRIFT): reasoning-action mismatch — investigations wander from the stated question
- `FM-3.3` (DELIVERABLE_MISSING): deliverable file not written before session ends
- `PHASE_VIOLATION`: exceeding op budgets

**3. Coder retry sessions (attempt 2/2) score low (n≈6, avg≈0.40)**
The verified-coder workflow's retry sessions (`"Fix Required (attempt 2/2)"`) produce scope violations and ghost deliverables. Issues: `SCOPE_VIOLATION`, `FM-3.3/VERIFICATION_FAILURE`, `MISALIGNED_SUCCESS`.

### What's working well
- **optimizer → optimizer**: 0.85 avg, 0 low-scoring sessions (n=48) — proves bounded automated tasks hit target
- **bob → bob**: 0.78 avg (n=60) — persistent task iterations mostly acceptable

## Root Causes

1. **Evaluator zero-score bug**: Same-agent delegations (parent=child agent name) get quality=0 instead of being properly evaluated. This inflates the failure count artificially.
2. **Unbounded investigation tasks**: Tech-lead lens sessions are open-ended despite phase caps. Per KE-013, boundedness is the primary driver of quality.
3. **Retry session framing**: "attempt 2/2" tasks lack sufficient context about what specifically failed, leading to scope drift.

## Recommendations (do NOT implement — separate sessions)

1. **Fix evaluator zero-score bug**: In `evaluation-sync.ts`, handle same-agent parent/child delegations — either evaluate them normally or exclude from metric. This alone would raise avg from 0.73 to ~0.78.
2. **Narrow lens task scope**: Make investigation tasks more bounded — specify exact queries to run, exact output format, max 1 file to read. Currently they're open-ended discovery tasks that violate KE-013.
3. **Enrich retry context**: In verified-coder workflow, include the specific error output and diff of prior attempt in the retry task, not just "fix the failing verification."
4. **Exclude self-delegations from metric**: If the "delegation quality" metric is meant to measure cross-agent delegation, filter out same-agent cases.
