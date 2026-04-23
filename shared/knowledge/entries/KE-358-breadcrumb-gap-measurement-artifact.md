# KE-358: Breadcrumb Action-Rate Gap Is Mostly Measurement Artifact

**Date**: 2026-04-23
**Source**: EXP-204 Phase 1
**Confidence**: Medium-High
**Connects**: H-204a (attention competition), H-204b (structural enforcement — weakened), H-204c (breadcrumb quality — falsified)

## Core Finding

The measured breadcrumb action rate (54-64%) dramatically understates true performance. 38% of "non-actions" are agents *correctly* skipping metrics they already addressed in prior sessions. True action rate is ~77%, near the 80% target.

## Evidence

- EXP-204: 22 heartbeat sessions sampled across may (55% raw) and coach (73% raw)
- 8 non-action cases categorized: 3 already-handled (correct), 3 competing-priority, 2 stale/structural metric
- Reclassifying already-handled as correct: 17/22 = 77% true action rate
- 0/8 non-actions caused by vague breadcrumbs — agents always understood what to do

## Mechanism / Why

The measurement script treats "no new action on red metric" as failure, but doesn't check whether the agent acted on that metric in a prior session within 24h. Cross-session state is invisible to the per-session metric.

## Implications

### 1. Measurement scripts need cross-session awareness
Per-session metrics that don't account for prior-session actions create phantom failures. Fix the script before adding workflow gates.

### 2. Structural enforcement is not needed here
H-204b (add gates/guards for metric compliance) is weakened. Agents already act at ~77% when correctly measured. Gates would add overhead for 3% gain.

### 3. Attention competition is the real (small) gap
The remaining 5/22 genuine misses are attention competition (agent did other work instead). A lightweight prompt nudge suffices — not a gate.

## Actionable

- Fix breadcrumb action-rate measurement to recognize prior-session coverage within 24h window
- Add trailing-metric exemption for metrics agents can't improve in one session
- Do NOT build workflow gates for this — the problem is measurement, not behavior

## Open Questions

- Does the 77% rate hold with larger N? (22 is small)
- Is coach's higher rate (73% vs may 55%) due to ownership motivation or structural differences?
