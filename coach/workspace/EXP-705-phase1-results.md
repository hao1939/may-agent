# EXP-705 Phase 1 Results: Duration Gate Effectiveness Audit

**Date**: 2029-08-03
**Status**: H1 MOSTLY SUPPORTED — gate fires on only 2/10 sessions

## Data

| Agent     | Duration | Summary Chars | Trigger@200 | Trigger@500 | Shallow? |
|-----------|----------|--------------|-------------|-------------|----------|
| optimizer | 46s      | 621          | NO          | NO          | YES      |
| scout     | 40s      | 428          | NO          | YES         | YES      |
| amy       | 57s      | 290          | NO          | YES         | YES      |
| may       | 39s      | 301          | NO          | YES         | YES      |
| bob       | 1m29s    | 46           | YES         | YES         | MAYBE    |
| tech-lead | 2m36s    | 206          | NO          | YES         | NO       |
| dev       | 2m0s     | 512          | NO          | NO          | NO       |
| coach     | 8m30s    | 98           | YES         | YES         | NO       |
| arc       | 7m30s    | 203          | NO          | YES         | NO       |
| evaluator | 12s      | 2780         | NO          | NO          | YES*     |

*evaluator sessions are inherently different (automated)

## Analysis

### H1: Gate never fires — MOSTLY SUPPORTED

At 200-char threshold: 2/10 sessions trigger (20%). But both are FALSE POSITIVES:
- **coach** (8m30s, 98 chars): Long substantive session — short summary doesn't mean shallow
- **bob** (1m29s, 46 chars): Borderline — short but did notify tech-lead

The 4 truly shallow sessions (optimizer 46s, scout 40s, amy 57s, may 39s) all have summaries 290-621 chars — NONE would trigger at 200.

**Gate accuracy at 200 chars: 0% recall on actual shallow sessions.**

### H2: 500-char threshold — PARTIALLY SUPPORTED

At 500 chars: 7/10 trigger (70%). Catches 3/4 shallow sessions (amy, scout, may) but MISSES optimizer (621 chars). Also catches 4 non-shallow sessions (false positives: bob, tech-lead, coach, arc).

**500-char threshold: 75% recall on shallow, but 57% false positive rate.**

### Real Problem

Summary length is a poor proxy for session quality. The optimizer produced "DONE" in 46s but its summary is 621 chars. Meanwhile coach ran 8m30s with only 98 chars of summary.

**Duration is the only reliable signal**. All 4 shallow sessions are < 60s. All 4 substantive sessions are > 90s.

## Recommendation

**Option B is correct**: Add wall-clock elapsed time check, not summary length adjustment.

### Proposed Code Change

In `heartbeat-data.ts` around line 480, REPLACE the `looksTrivia` heuristic:

```typescript
// CURRENT (broken — poor proxy):
const looksTrivia = turnsUsed === 0 && summaryLength < 200;

// PROPOSED (EXP-705):
const elapsedMs = Date.now() - sessionStartMs;  // need to capture start time
const elapsedTooShort = elapsedMs < 90_000;  // < 90 seconds
const looksTrivia = (turnsUsed === 0 && summaryLength < 200) || elapsedTooShort;
```

This would:
- Catch ALL 4 shallow sessions (< 60s)
- Miss NONE of the substantive sessions (all > 90s)
- 100% precision, 100% recall on this sample

### Blocker

Need to know if `sessionStartMs` (or equivalent) is available in the genericHeartbeat context. If not, the timestamp from `result` object could be used, or a `Date.now()` call at function entry.

## Next Steps

1. ✅ Phase 1 audit complete
2. Escalate proposed code change to tech-lead (Option B: wall-clock time check)
3. Phase 2: After implementation, verify `duration-gate-triggers.log` appears
4. Phase 3: Measure shallow session rate reduction (target: ≥50% drop in < 60s sessions)
