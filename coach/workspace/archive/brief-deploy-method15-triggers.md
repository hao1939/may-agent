# Brief: Deploy Method #15 Evidence-Based Triggers

**Date**: 2026-03-31
**Owner**: Coach
**Priority**: HIGH — method promoted in gym but not deployed to production
**Target**: tech-lead/heartbeat.md workflow selection table

## Background

Method #15 (Workflow Enforcement via `two-phase` workflow) has been promoted in 10+ gym experiments across 5 agents and 5+ scenario types. The `two-phase.ts` workflow exists in `agents/shared/workflows/` and tech-lead already references it, but with vague triggers ("Ambiguous / destructive / judgment-heavy").

## Evidence Summary

| Experiment | Agent | Scenario | Baseline | Treatment | Delta |
|------------|-------|----------|----------|-----------|-------|
| exp-224 | coder | partial-verification-trap | 5/6 | 6/6 (2/2 runs) | +17% |
| exp-226 | coder | idempotent-already-fixed | 7/8 | 8/8 (2/2 runs) | +13% |
| exp-220 | coder | missing-prerequisite | 4/5 (wrong finish status) | 4/5 (correct finish status) | Flips critical behavior |
| exp-086 | amy-kimi | sycophants-dilemma | 3/6 | 7/7 | +100% |
| exp-087 | amy | judgment-ambiguous-spec | PASS | PASS (no regression) | 0% |
| exp-089 | amy-kimi | judgment-ambiguous-spec | 1/3 | 4/4 | +100% |
| exp-qa-fm21 | qa | qa-overstrict-gate | 0/1 | 6/6 | +100% |

Overall: 92-97% pass rate with two-phase vs 50-70% single-phase for target scenarios.

## Proposed Change

Update tech-lead's workflow selection table entry for two-phase from:

> Vague requirements, risky deletions, tasks where jumping straight to code would be dangerous.

To:

> **Proven triggers** (gym-tested, 92-97% vs 50-70% single-phase):
> **(a)** Bug fix + test coverage gap — Phase 1: fix bug, Phase 2: review test coverage and add missing tests.
> **(b)** Might-already-be-done tasks — Phase 1: assess-only (read files, write ANALYSIS.md), Phase 2: implement only if needed.
> **(c)** Missing prerequisites — Phase 1: check required files/state exist, Phase 2: execute conditionally.
> Also: vague requirements, risky deletions, judgment-heavy tasks.

## Negative Evidence

Method #15 does NOT help for:
- `mock-leak-trap` (exp-227, exp-228): Two-phase adds overhead without improving outcome. Agent times out writing analysis before getting to the fix. Baseline already at ceiling.
- Heavy analysis scenarios where the analysis phase itself exceeds timeout.

## Action Required

1. Update `agents/tech-lead/heartbeat.md` workflow selection table
2. Consider: should `implement-and-review` auto-detect these patterns and switch to two-phase? (Future optimization)
