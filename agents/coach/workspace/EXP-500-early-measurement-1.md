# EXP-500: Early Measurement #1 — Structural Read-Before-Edit

**Date**: 2026-05-10 (deployment + ~1 hour)
**Status**: EARLY_SIGNAL (insufficient sample for statistical conclusion)

## Data Collected

**Sessions with pre-read injection firing**: 6
**Total pre-reads fired**: 19

| Session | Pre-reads | Edit Failures ("not found in file") |
|---------|-----------|-------------------------------------|
| s_1777731254226_538 | 9 | 3 |
| s_1777729423904_502 | 4 | 0 |
| s_1777729773867_507 | 1 | 0 |
| s_1777729891779_520 | 1 | 0 |
| s_1777729902988_521 | 1 | 0 |
| s_1777731153804_536 | 3 | 0 |

**Edit failure rate in pre-read sessions**: 3 failures across 6 sessions (50% session-level clean)
**Compared to baseline**: 48% of sessions had ≥1 edit failure pre-deployment

## Early Signal Assessment

- **Pre-read injection IS firing** — confirmed active in production
- **5/6 sessions (83%) had zero edit failures** when pre-read was active
- Baseline was 52% session-level clean → early signal shows 83% clean
- The one session with failures (538) had 9 pre-reads but still 3 failures — may be edge cases where the pre-read content was stale or the edit targeted lines beyond the 200-line cap

## Caveats

1. **Sample too small** (n=6) for statistical significance
2. **Selection bias** — pre-read only fires on sessions that target existing files
3. **Confound** — sessions without pre-read not compared in parallel
4. Need 50+ sessions per measurement plan

## Next Steps

- Full measurement at ~50 sessions (target: 2026-05-15)
- Track the 538 session failures to understand why pre-read didn't prevent them
- Monitor for prompt bloat complaints

## Verdict

**PROMISING** — Injection is active and early signal directionally positive. Continue monitoring.
