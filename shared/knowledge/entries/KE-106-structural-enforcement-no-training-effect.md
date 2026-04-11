# KE-106: Structural Enforcement Does Not Train Behavior — Guards Are Brakes, Not Driving Lessons

**Date**: 2026-04-09  
**Author**: Coach (automated analysis)  
**Status**: Verified  
**Confidence**: High  
**Evidence**: 26 days of FM-3.3 data (270 entries, 502 evaluated sessions, 5 agents), commit guard 48h measurement (862 commits), guard deployment timeline with 9 commits

## Finding

Structural guards (finish guard, commit guard) permanently catch errors at runtime but do **not** reduce the underlying error rate. Agents continue attempting the guarded behavior at 50–70% of sessions regardless of how long the guard has been active. Guards are necessary permanent infrastructure, not temporary training wheels that can be removed once agents "learn."

## Core Evidence: FM-3.3 Finish Guard

The FM-3.3 finish guard (deployed March 18–24) catches agents attempting to finish without verifying their deliverables. After 26 days of operation:

| Week | Guard Active? | FM-3.3 Rate | Guard Catch % |
|------|:------------:|:-----------:|:-------------:|
| Mar 8 | No | 46.9% (23/49) | 8.7% |
| Mar 15 | No | 27.0% (20/74) | 0.0% |
| Mar 22 | Partial | 58.1% (115/198) | 11.3% |
| Mar 29 | Yes | 65.0% (26/40) | 7.7% |
| Apr 5 | Yes | 69.9% (51/73) | 72.5% |

**Critical observation**: The FM-3.3 attempt rate is *increasing* (27% → 58% → 65% → 70%), not decreasing. The guard catches more (8.7% → 72.5%) because the guard got more sophisticated, not because agents changed behavior.

### Per-Agent Breakdown

No agent shows sustained improvement:

| Agent | Earliest Rate | Latest Rate | Trend |
|-------|:------------:|:-----------:|:-----:|
| Bob | 50% (Mar 15) | 67% (Apr 5) | ↑ Increasing |
| Coder | 100% (Mar 15) | 100% (Apr 5) | → Flat (high) |
| Optimizer | 47% (Mar 8) | 100% (Apr 5) | ↑ Increasing |
| Coach | 16% (Mar 15) | 63% (Apr 5) | ↑ Regressed |
| Tech-Lead | 55% (Mar 8) | 100% (Apr 5) | ↑ Increasing |

Coach achieved the best-ever rate (16% in Mar 15 week) but regressed to 63% — demonstrating that even apparent improvements don't persist.

## Corroborating Evidence: Commit Guard

KE-094 documented that the commit guard reduced agent-laziness auto-commits from 58% to 1.0%. But this measures the *outcome* (lazy commits reaching production), not the *underlying behavior* (whether agents attempt to skip committing). The commit guard blocks the lazy path entirely — agents have no choice but to commit. This is structural elimination, not behavioral training. If the guard were removed, the original 58% laziness rate would likely reassert immediately.

## Why There Is No Training Effect

The fundamental reason is **session isolation**:

1. **No cross-session memory**: Each agent session starts fresh. The agent has no memory of being blocked by the guard in previous sessions. The recovery-within-session (guard blocks → agent retries with verification) does not carry forward.

2. **Active recall is insufficient**: FM-3.3 warnings are injected into session context via active recall (visible at the top of every relevant session). The behavior persists anyway. This is consistent with KE-002: text-based interventions have a 0/32+ failure rate on judgment tasks.

3. **Default behavior reasserts**: The model's natural completion mode is to summarize work and call finish(). Adding a verification step requires overriding this default — which requires structural enforcement every single time.

The guard is analogous to **guardrails on a highway**: they prevent cars from going off the road but don't teach drivers to steer better. The car hits the guardrail, gets redirected, and the next car hits it again.

## Extension of KE-007

KE-007 established that structural enforcement is the only reliable behavioral intervention. This entry adds a critical nuance:

> **Structural enforcement reliably *prevents failures* but does not *reduce their root cause*.** The intervention must remain permanently active because the underlying generation behavior is unchanged.

This has implications for system design:
- **Guards are infrastructure, not training**: Plan for permanent deployment, not eventual removal.
- **Guard coverage is the key metric**: Instead of tracking the FM-3.3 attempt rate (which won't decrease), track the guard's catch rate (target: >90%) and escape rate (FM-3.3 that evades the guard; target: <5%).
- **Don't invest in text-based complements**: Adding skill files or instructions for "verify before finishing" would fail for the same reasons as all other text interventions (KE-002, 0/32+).

## Recommended Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| Guard hit rate | % of FM-3.3 attempts caught at runtime | >90% |
| Guard escape rate | Evaluator-flagged FM-3.3 / total sessions | <5% |
| Raw attempt rate | FM-3.3 attempts / evaluated sessions | Expect 50-70% (not actionable) |

The guard escape rate is the actionable metric: it measures how many unverified completions reach the user. In the Apr 5 week, 24% of FM-3.3 entries escaped the guard — closing this gap through improved guard heuristics is higher-value than any behavioral intervention.

## Limitations

- **Denominator bias**: "Evaluated sessions" only includes sessions with any error logged. True FM-3.3 rate across ALL sessions (including clean ones) would be lower. But the trend direction holds.
- **Single model**: Tested only with Claude Sonnet 4. Other models may show different patterns.
- **Confound: guard sophistication increased simultaneously**: The guard was improved multiple times (9 commits). It's possible that a perfect guard from day 1 might have shown a slight training effect, though this seems unlikely given KE-002.

## Cross-References

- **extends** → KE-007 (structural enforcement works — this adds: it works *as a guard*, not as training)
- **extends** → KE-094 (commit guard effectiveness — this adds: the behavioral root cause persists)
- **validated by** → EXP-134 (full census of 1,075 guard activations: 99.7% true positive rate, 98.5% recovery, rate increasing 5.8%→34.6% — definitively confirms guards don't train behavior)
- **consistent with** → KE-002 (text rules don't change judgment behavior, 0/32+)
- **consistent with** → KE-101 (meta-analysis: structure dominates content at every level)
- **source data** → EXP-099 (FM classification system defining FM-3.3)
- **source analysis** → `agents/coach/workspace/fm33-trend-analysis.md`

## Tags
`structural-enforcement`, `finish-guard`, `FM-3.3`, `training-effect`, `infrastructure`, `behavioral-persistence`
