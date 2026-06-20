# Skill Regression Tracking Plan

**Created**: 2026-04-03
**Owner**: Coach
**Directive**: Hao (req:6532a872) — periodically re-test adopted skills to ensure no regression.

---

## Adopted Skills Under Regression Watch

| # | Skill | Workflow Scenario | Baseline (no wf) | Treatment (wf) | Key Check | Last Verified |
|---|-------|-------------------|-------------------|-----------------|-----------|---------------|
| 1 | evidence-over-narrative | misleading-test-fix-workflow | 5/8 (63%) | 11/11 (100%) | discount-mathematically-correct | 2026-04-01 |
| 2 | verify-before-finish | partial-verification-trap-workflow | 5/6 (83%) | 6/6 (100%) | adds-edge-case-test | 2026-03-30 |
| 3 | tool-discipline | context-npx-avoidance-workflow | 3.3/5 (66%) | 6/7 (86%) | no-npx-attempt | 2026-04-02 |
| 4 | obstacle-pivot | behavior-escalation-stubborn-workflow | 2.67/4 (67%) | 6/6 (100%) | escalated-properly | 2026-04-02 |

## Regression Definition

A skill has **regressed** if:
- The **key check** (the behavioral check the workflow was designed to fix) drops below 80% pass rate on 3 runs
- OR the overall treatment score drops by >20% from the proven level

## Re-Testing Schedule

**Frequency**: Every 7 days per skill, rotating 2 skills per Coach heartbeat cycle.

| Week Day (approx) | Skills to Test | Method |
|---|---|---|
| Mon/Tue | evidence-over-narrative, verify-before-finish | 1 run each |
| Thu/Fri | tool-discipline, obstacle-pivot | 1 run each |

**Why weekly?** These workflows are proven with N=2-3 runs each. Weekly regression catches:
- Gym runner infrastructure changes that break scoring
- Scenario environment drift (if files are modified)
- Agent behavioral drift from context/prompt changes

## Re-Test Protocol

For each skill regression test:

```
1. Run workflow scenario:
   scripts/gym-run.sh <workflow-scenario> --agent coder

2. Record result:
   - Pass/fail on each check
   - Specific pass/fail on the KEY CHECK
   - Compare to proven baseline in LIBRARY.md

3. If KEY CHECK fails:
   a. Run 2 more times (total N=3)
   b. If 0/3 or 1/3 on key check → REGRESSION CONFIRMED
   c. If 2/3 → FLAKY, investigate scorer
   d. If 3/3 → false alarm, continue monitoring

4. On REGRESSION CONFIRMED:
   a. Flag in LIBRARY.md (status → ⚠️ regressed)
   b. Check if gym-runner or scorer changed recently
   c. Check if agent context/prompts changed
   d. Create P1 task to diagnose and fix
   e. Notify may

5. Log all results to: agents/coach/workspace/regression-log.jsonl
```

## Regression Log Format

```jsonl
{"date":"2026-04-XX","skill":"evidence-over-narrative","scenario":"misleading-test-fix-workflow","passed":11,"total":11,"key_check":"discount-mathematically-correct","key_passed":true,"status":"ok"}
```

## Escalation Path

1. **First failure**: Re-run 2 more times. If 2+/3 pass → continue monitoring.
2. **Confirmed regression (0-1/3)**: P1 task, investigate cause within 48h.
3. **Infrastructure cause**: Fix scorer/runner, re-validate, resume monitoring.
4. **Behavioral drift**: Re-run original A/B experiment (3 baseline + 3 treatment). If treatment still works → agent context change caused the issue. If treatment also regresses → the workflow design needs updating.

## Bootstrapping

**Immediate action**: Run 1 regression test for each of the 4 skills in this session to establish initial regression log entries.

## Success Criteria

- All 4 skills have at least 1 regression test per 7-day window
- Regression log has continuous entries (no gaps > 10 days)
- Any confirmed regression is caught within 1 week and resolved within 2 weeks
