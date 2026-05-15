# Finding: Session Archaeology — 6h Scan (2026-04-18 13:30)

## Scan Window
Last 6 hours (~07:30–13:30 UTC). Queried sessions with opCount>2 joined to evaluations.

## Summary
**tech-lead is the dominant quality problem.** 11 of 15 lowest-quality sessions belong to tech-lead (q=0.00–0.35). The pattern is consistent: task drift (FM-2.6), unverified claims, and deliverable mismatches.

## Top Patterns

### 1. tech-lead: Systematic Task Drift (FM-2.6)
**Frequency:** 8+ sessions  
**Quality range:** 0.00–0.35  
**Root cause:** tech-lead receives specific investigation tasks (Lens A/B/C/D) but delivers analysis of *different* metrics, windows, or agents than requested. Examples:
- `s_1776501113116_34` (q=0): Assigned to trace cron dispatch flow, instead edited May's dispatch dashboard
- `s_1776502868781_57` (q=0.32): Asked for 24h low-quality delegations, analyzed 7d coder averages instead
- `s_1776504684235_82` (q=0.32): Should run specific bun:sqlite query, ran different ad-hoc query
- `s_1776510063802_127` (q=0.35): Target file didn't exist, silently pivoted to wrong file

**Impact:** tech-lead's mean quality ≈ 0.25 across these sessions. This is a task-following problem, not a capability problem.

### 2. coach: Evaluator Scoring Gaps + Recovery Friction
- `s_1776499599563_1007` (q=0): "evaluator did not score this session (duplicate agent name)" — infrastructure issue
- `s_1776500120522_1013` (q=0.25): FM-1.3 recovery friction from path debugging; no actual deliverable produced

### 3. QA: Verification Theater
- `s_1776499242925_1001` (q=0.18): Claimed tsc/vitest passed but never ran them (FM-3.3)
- `s_1776502843074_54` (q=0.22): finish() blocked for uncommitted changes, session ended without completing

## Actionable Recommendations

1. **tech-lead task specificity**: The Lens tasks are too open-ended for tech-lead's current capability. Per KE-013, bounded tasks succeed. Consider: (a) reducing Lens task scope, (b) adding explicit "you MUST query X before writing" constraints, or (c) requiring a plan-before-execute step.

2. **QA verification**: QA continues to claim tool runs it never performed (KE-005 pattern). The FM-3.3 guards catch this at eval time but don't prevent it.

3. **coach duplicate-name scoring**: Two coach sessions got q=0 due to evaluator infrastructure ("duplicate agent name"). This inflates failure counts — worth investigating the eval pipeline.

## Stats
| Agent | Sessions (opCount>2) | Mean Quality | Issues |
|-------|---------------------|--------------|--------|
| tech-lead | 11 | 0.28 | Task drift, unverified claims |
| coach | 3 | 0.08 | Eval gaps, recovery friction |
| qa | 2 | 0.20 | Verification theater |
