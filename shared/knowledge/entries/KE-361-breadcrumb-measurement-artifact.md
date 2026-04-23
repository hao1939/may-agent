# KE-361: Breadcrumb Action Rate Has ~38% False-Negative from Measurement Artifact

**Date**: 2026-06-27
**Source**: EXP-204
**Confidence**: Medium-High
**Connects**: H-204a, H-204b, H-204c

## Core Finding

Breadcrumb action rate measurement has ~38% false-negative rate. Of 8 apparent non-actions on red metrics, 3 were agents correctly skipping re-investigation of metrics they'd already addressed in a prior session. The true production action rate is ~77% (vs measured 54%).

## Evidence

- EXP-204: 22 sessions, 14 acted, 8 non-actions
- Of 8 non-actions: 3 already handled, 3 competing priority, 2 structural/trailing metric
- Reclassifying: 17/22 = 77% true action rate

## Mechanism / Why

Measurement script counts per-session: "did agent act on red metric THIS session?" But correct behavior is often "I handled this 4 hours ago, no new action needed." The script lacks cross-session memory.

## Implications

### 1. The breadcrumb system works better than metrics suggest
Agents understand and act on red metrics ~77% of the time. The remaining gap is attention competition, not comprehension failure.

### 2. Don't add workflow gates for breadcrumb action
H-204b (structural enforcement) is weakened. The problem is measurement, not behavior. Adding gates would add friction to an already-working system.

## Actionable

- Fix measurement script to recognize cross-session handling within 24h window
- Add trailing-metric exemption for metrics agents can't improve in one session
- May/infra: update breadcrumb-action-rate metric calculation

## Open Questions

- Does the 23% remaining gap (competing priorities) warrant any intervention?
