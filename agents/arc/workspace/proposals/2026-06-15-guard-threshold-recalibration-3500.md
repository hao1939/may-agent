# Proposal: Raise guard.triggered-count-24h and guard.warned-count-24h thresholds to 3,500

## Problem

Both `guard.triggered-count-24h` and `guard.warned-count-24h` have been
continuously above their 2,500 threshold since at least 2026-06-11 (metric
alert IDs 1726 and 1727, created 2026-06-11, still unresolved). Current
readings: 3,217 and 3,188 respectively.

The breach is **structural, not behavioral**. Per KE-1930 (2026-06-14),
~57% of all guard triggers are commit-guard ambient warnings from
shared-worktree concurrency:

| Signal | Count (24h) | Share |
|--------|------------|-------|
| commit-ambient (uncommitted files) | ~1,000 | 31% |
| commit-finish (finish() uncommitted) | ~820 | 26% |
| SESSION_BASH_CAT/READ/GREP | ~710 | 22% |
| READ_DEDUP | ~285 | 9% |
| Edit-Without-Read | ~100 | 3% |
| Others | ~6–43 each | <2% ea |
| **Total** | ~3,200 | 100% |

The structural noise floor is ~1,800/day from commit-guard alone (every
aks-explorer tool call fires an ambient warning when the shared worktree has
dirty files, which it always does). This was the rationale when thresholds
were raised from 2,000 to 2,500 on 2026-06-10 (commit 483ca44d8), but the
floor has since risen with aks-explorer's increased session volume.

## Evidence

- **8 consecutive snapshots** (guards.md appendix) show the count between
  3,100–3,260 with no monoculture regime and stable composition.
- **Metric alert #1726/#1727** have been open for 2+ days with no
  resolution path — the breach cannot be fixed by behavioral change
  because the dominant signal is infrastructure noise.
- **guards.md itself** recommends: "raise threshold to ~3,500 or suppress
  commit-guard ambient warnings for shared-worktree agents. This
  recommendation has persisted for 3+ days without action."
- The last calibration (2,000 → 2,500) used the same rationale and was
  approved/applied by may.

## Proposed Change

In `metrics-snapshot.ts` (or wherever guard threshold config lives):

```
guard.triggered-count-24h: threshold 2500 → 3500
guard.warned-count-24h:    threshold 2500 → 3500
```

This provides ~300 count headroom above the current structural floor
(~3,200/day) while still catching genuine behavioral deterioration
(a new guard signal type or a monoculture episode would push past 3,500).

## Expected Impact

- Alerts #1726 and #1727 resolve immediately.
- System operators stop dismissing perpetually-open guard alerts, restoring
  signal value to the metric.
- The guard metric regains its role as a behavioral-change detector rather
  than a structural-noise counter.

## Risks

- **False quiet**: A genuine behavioral regression that adds ~300 triggers/day
  would be masked. Mitigated by: the guard composition breakdown in guards.md
  would still show the new signal type; per-signal analysis remains possible.
- **Ratchet concern** (KE-1842): This is the third threshold raise. Each
  loosening reduces the metric's sensitivity. If the noise floor keeps
  climbing, the right fix is suppressing ambient commit-guard warnings at
  the source rather than raising the threshold again.

## Alternative (deferred)

Suppress commit-guard ambient warnings for sessions that have no deliverables
matching the dirty files. This is the root-cause fix but requires a code
change to the commit-guard's "ambient" classification logic. The threshold
raise is a stopgap that should be paired with a note to revisit if the
floor rises again.
