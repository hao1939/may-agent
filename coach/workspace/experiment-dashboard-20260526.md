# Experiment Dashboard — 2026-05-26

## Active/Deployed Experiments Awaiting Measurement

| ID | Name | Status | Deployed | Measurement Needed |
|----|------|--------|----------|-------------------|
| EXP-530 | Structural Verification Gate | DEPLOYED | master-worker.ts:451 | n=20+ worker sessions (have n=3) |
| EXP-540 | Path Normalization | DEPLOYED | master-worker.ts:451 | tech-lead C7.1 re-measurement |

## Recently Closed (2026-05)

| ID | Name | Result | Impact |
|----|------|--------|--------|
| EXP-510 | Worker Completion Checklist | ✅ POSITIVE | Write rate +39pp, finish +69pp |
| EXP-520 | Heartbeat Artifact Gate | ✅ POSITIVE | 100% recovery (7/7 triggers) |
| EXP-500 | Read-Before-Edit Structural | ✅ POSITIVE | Edit failure 15.4% → 0% |

## Notification Processed

**EXP-510 + EXP-520 deployment confirmed** (received 2h ago):
- EXP-510: master-worker.ts:450-452 — ✅ already closed with formal results
- EXP-520: heartbeat-data.ts:437-462 — ✅ already closed with formal results
- Both are permanent infrastructure. No action needed.

## Convention Violation Priorities (from last measurement)

| Priority | Agent | Convention | Pass Rate | Addressable? |
|----------|-------|-----------|-----------|-------------|
| 1 | qa | C1.4/C8.2 | 14.3% | Structural (EXP-510 pattern) |
| 2 | tech-lead | C7.1 | 39.1% | EXP-540 deployed, awaiting data |
| 3 | may | C1.7 | 64.3% | EXP-530 addresses this |
| 4 | bob/coach | C1.1 | 74-78% | EXP-500 structural fix active |

## Next Experiment Candidates

### EXP-545: QA Finish-Call Structural Gate (P1)
**Problem**: QA has 14.3% finish() compliance — worst in system. Text rule (EXP-440) confirmed NEGATIVE.
**Hypothesis**: Structural gate in QA's workflow (same pattern as EXP-520) → ≥50% finish compliance.
**Design status**: NOT STARTED — ready for design this session.

### EXP-550: Cumulative Structural Injection Measurement (P2)
**Problem**: We've deployed EXP-500, 510, 520, 530, 540 but don't have a combined measurement of the structural injection approach's total impact on system quality.
**Hypothesis**: Combined structural interventions raised system-wide task completion from ~37% to ≥70%.
**Design status**: Needs production data accumulation.

## Key Learning (meta)

**The structural injection era is working.** Since pivoting from text coaching (KE-480) to structural prompt-level injection:
- EXP-500: 15.4% → 0% edit failures (PERFECT)
- EXP-510: +39pp write rate, +69pp finish rate
- EXP-520: 100% artifact recovery
- EXP-530: Early positive signal (n=3)
- EXP-540: Deployed, awaiting measurement

**Pattern**: Inject requirements at code level (master-worker.ts / heartbeat-data.ts prompt assembly) where agents CANNOT ignore them, rather than documenting rules in context.md files.

## Experiment Velocity

- **Closed this month**: 5 (EXP-490, 495, 500, 510, 520)
- **Active awaiting data**: 2 (EXP-530, 540)
- **Design pipeline**: 1 (EXP-545 QA finish gate)
- **Total experiments run**: 55+ (since EXP-250)
- **Positive rate**: ~35% (structural interventions: ~80%)

## Session Log

- Processed notification: EXP-510/520 deployment confirmed (already closed)
- Updated dashboard with current state
- Identified EXP-545 as next experiment target
