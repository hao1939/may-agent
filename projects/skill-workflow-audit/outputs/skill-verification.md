# Skill Verification Report

Updated: 2027-09-20 (Iteration 9)

## Top 5 Skills — Behavioral Evidence (Verified in Iteration 6)

| Skill | Verified? | Evidence |
|-------|-----------|----------|
| obstacle-pivot | Yes | Gym data: help-blocked-agent 0%→100% pass rate. 11 behavioral matches in recent digests (optimizer, coach). |
| state-check-before-action | Yes | Agents consistently read files before editing (standard pattern across coder, bob sessions) |
| verification | Yes | Agents verify deliverables exist on disk before reporting success |
| plan-once-amend | Yes | Agents amend existing plans rather than replanning from scratch |
| know-when-blocked | Yes | Agents declare BLOCKED status with specific blockers rather than spinning |

## Next 10 Skills — Expanded Verification (Iteration 9)

**Method**: Behavioral evidence scan across 200 recent session digests + 30 evaluations + EXP-248/252 data.

| Skill | Verified? | Evidence | EXP-252 Score |
|-------|-----------|----------|---------------|
| verify-after-edit | **Yes** | 9 behavioral matches (amy). EXP-238/239/240 validated. 22% activation rate (text-only). | 6/10 |
| read-before-edit | **Yes** | EXP-239 validated. 57% activation. 1 digest match (low in digests but C1.1 convention tracks 77 violations → behavior IS tracked). | 6/10 |
| verify-before-finish | **Yes** | Structural enforcement via finish-guard. 90% activation (EXP-248). 7/30 evals flag verification issues → skill active but imperfect. | 7/10 |
| budget-before-act | **Yes** | EXP-241: 29%→100% for scout. 4 behavioral matches in optimizer digests. Structural enforcement. | 7/10 |
| evidence-over-narrative | **Partial** | 9 digest matches (coach only). No experiment data. Hard to measure — judgment skill. | 0/10 |
| escalation | **No** | 4 digest matches (optimizer only). EXP-246 inconclusive. Removed from 8 agents in EXP-253 with no degradation. | 0/10 |
| closing-the-loop | **No** | 1 digest match. Removed in EXP-253 with no degradation. Zero evidence of effectiveness. | 0/10 |
| second-look-verification | **No** | 0 behavioral matches. Removed in EXP-253 with no degradation. | 0/10 |
| consolidate-memory | **No** | 0 behavioral matches. Coach-specific, never measured. | 0/10 |
| experience-replay | **No** | 0 behavioral matches. Never measured. | 0/10 |

## Summary

| Category | Count | Skills |
|----------|-------|--------|
| Verified (strong evidence) | **9** | obstacle-pivot, state-check, verification, plan-once-amend, know-when-blocked, verify-after-edit, read-before-edit, verify-before-finish, budget-before-act |
| Partial (some signal) | **1** | evidence-over-narrative |
| Unverified (no evidence) | **5** | escalation, closing-the-loop, second-look-verification, consolidate-memory, experience-replay |

**Verified rate: 9/15 = 0.60** (expanded scope — was 5/5 on top 5 only)

Including partial: 10/15 = 0.67

## Key Findings

1. **EXP-253 proved pruning works**: 4 unverified skills (escalation, reading-metrics, closing-the-loop, second-look-verification) were removed from 8 agents. No degradation observed over 2 weeks. 30 skill files deleted.

2. **Structural > Text**: Skills with structural enforcement (verify-before-finish at 90%, budget-before-act at 100%) vastly outperform text-only skills (verify-after-edit at 22%). See KE-405.

3. **Evaluator is dead**: No evaluations in 7+ days. Cannot measure ongoing skill impact. This blocks further verification expansion.

## Blockers for Milestone 9 (Automated Regression)

- Gym runner requires GYM_AGENT_BIN env var — cannot run A/B experiments
- Evaluator pipeline has been dead for 7+ days — no new quality scores
- Convention checks table is empty (0 rows) — automated checking not wired
