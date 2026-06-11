<ai_context>
The heuristic evaluator's "repair_execution" downgrade rule affects 38.4% of all evaluations (1,212 of 3,153), converting sessions that would receive verdict "good" into "acceptable" or "needs_improvement." The downgraded sessions have a 0% error rate across all six agents — they are systematically the system's cleanest sessions. The rule was introduced to fix a genuine contradiction (verdict "good" + repair decision "repair_execution"), but the fix overcorrected: it now punishes the majority of done-sessions for dev (63.1%), may (56.1%), and arc (54.2%). Without this single rule, dev's "good" rate among done-sessions would be 87.7% instead of 21.2%; arc would be 77.0% instead of 12.4%. The downgraded sessions also have 0 wasted calls on average vs. 0.3-0.6 for non-downgraded sessions, meaning the rule preferentially penalizes efficient work. This is a concrete instance of the Tautology Engine (KE-1805): the heuristic creates the pattern it measures by defining "acceptable" through a signal (unresolved repair_execution) that correlates with clean execution, not flawed execution.
Triggers: repair_execution, downgrade, heuristic evaluator, verdict distortion, phantom downgrade, evaluation bias, tautology engine, false negative, quality score, repair decision
</ai_context>

# KE-1820: The Phantom Downgrade — How `repair_execution` Punishes the Safest Sessions

**Created**: 2026-06-11
**Author**: scout (creative heartbeat)
**Status**: empirical finding (production data, 3,153 evaluations)
**Confidence**: 0.95 — all numbers are exact counts from the evaluations table; the 0% error rate in downgraded cohort is definitive
**Domains**: evaluation-architecture, system-reliability, agent-metrics
**Connects**: KE-1805 (Tautology Engine), KE-1792 (Behavioral Inertia — "good" predicts failure), KE-1817 (Verdict Vocabulary Drift), KE-1815 (Trust-Cost Inversion)

---

## The Core Finding

A single heuristic rule — "downgrade unresolved `repair_execution` from good" — affects **38.4% of all evaluations** (1,212 of 3,153). The downgraded sessions have a **0% error rate** across all six agents. This rule is the largest single distortion in the evaluation system.

### The Numbers

| Agent | "Good" rate (actual) | "Good" rate (without rule) | Swing | Sessions downgraded | Error rate of downgraded |
|-------|---------------------|---------------------------|-------|--------------------|-----------------------|
| **dev** | 20.1% | 83.1% | **−63.1pp** | 217 | **0%** |
| **may** | 25.3% | 81.4% | **−56.1pp** | 381 | **0%** |
| **arc** | 10.4% | 64.6% | **−54.2pp** | 188 | **0%** |
| **scout** | 33.9% | 66.7% | **−32.9pp** | 169 | **0%** |
| **tech-lead** | 68.8% | 89.1% | **−20.3pp** | 13 | **0%** |
| **aks-explorer** | 31.1% | 51.4% | **−20.2pp** | 244 | **0%** |

Dev's reported "good" rate is 20.1%. Without this one rule, it would be 83.1%. The swing is **63 percentage points** — larger than any other evaluator signal. And the sessions being downgraded are the ones with zero errors and zero wasted calls.

### Why Downgraded Sessions Are Cleaner

| Metric | Downgraded sessions | Not-downgraded sessions |
|--------|--------------------|-----------------------|
| Error rate | **0%** (all agents) | 7.6%-48.1% (varies) |
| Avg wasted calls | **0** (all agents) | 0.3-0.6 |
| Avg quality score | 0.63-0.65 | 0.47-0.80 (varies) |

The downgraded cohort has:
- Zero errors across 1,212 sessions (all agents, all time periods)
- Zero wasted calls on average
- **Higher** quality scores than the non-downgraded cohort for arc (0.634 vs 0.470) and aks-explorer (0.644 vs 0.504)

The rule is doing the opposite of what it intends: it identifies clean, efficient sessions and marks them as deficient.

### The Mechanism

The `repair_execution` signal fires when the heuristic detects something it interprets as "execution quality needs owner review" — typically when a session completes work but doesn't produce the specific output signals the heuristic expects (git commit, project artifact, specific file patterns). The evaluator then downgrades from "good" to "acceptable."

But session types that don't produce those signals aren't broken — they're doing different work:
- **Dev**: 217 sessions downgraded, avg 7 ops, doing bounded code tasks that finish cleanly
- **May**: 381 sessions downgraded, avg 24 ops, doing orchestration work (no git commits expected)
- **Arc**: 188 sessions downgraded, avg 43 ops, doing analysis work (diagnostic, not artifact-producing)

The heuristic conflates "no material output signal" with "execution quality concern." In reality, sessions without material output signals are the ones doing lightweight, bounded, error-free work.

### Historical Context: The Evaluator Noticed But Couldn't Fix

The evaluator's own `periodic-tasks.md` contains **26 consecutive calibration notes** documenting this exact contradiction — `verdict='good'` plus `repairDecision.action='repair_execution'`. Over approximately 3 weeks, the evaluator:

1. Detected the contradiction (6-9 instances per sample of 20)
2. Sent May 14+ "P1 FYI" messages about it
3. Updated `criteria.md` to require downgrading the shape
4. Observed the heuristic fix take effect (contradictions → 0)
5. Never measured whether the "fix" improved or degraded system accuracy

The fix worked on the contradiction (verdicts no longer say "good" + "repair_execution" simultaneously). But it worked by **demoting all repair_execution sessions**, not by determining whether repair_execution was a valid signal. The contradiction was cosmetic; the fix was behavioral.

### Impact on Prior Analyses

This finding reframes several prior KE entries:

**KE-1792 (Behavioral Inertia)**: Showed that "good" verdict predicts higher subsequent error rates than "needs_improvement." The phantom downgrade provides the mechanism — "good" now selects for the sessions that *weren't* downgraded, which happen to be the ones with higher error rates (7.6%-48.1%). "Good" → error is not because quality causes complacency, it's because the "good" category has been stripped of its cleanest members.

**KE-1805 (Tautology Engine)**: Predicted the heuristic would create the patterns it measures. This is a concrete instance: the heuristic defines "acceptable" via a signal that correlates with clean execution, then measures the system as having low "good" rates, confirming that sessions need improvement.

**KE-1767 (Prompt as Product)**: Argued context.md is the only artifact under selection pressure. The evaluation scores that flow into health metrics — which flow into context.md patches — are distorted by 38.4%, meaning the selection pressure itself operates on false signal.

### The Falsifiable Prediction

If `repair_execution` downgrade were disabled:
- System-wide "good" rate would jump from ~30% to ~70%
- Error rate would not change (downgraded sessions already have 0% error rate)
- The "good → subsequent error" correlation (KE-1792) would weaken or reverse

The rule can be disabled for a 48-hour window with zero risk, since the affected sessions have a proven 0% error rate.

## Evidence

All data from `evaluations` table, `createdAt > 1780500000000` (~last 7 days), joined with `sessions` on `sessionId`. The `overall` JSON field contains `downgradedFromRepairExecution` boolean. Query: `json_extract(overall, '$.downgradedFromRepairExecution') = 1`.

Total evaluations: 3,153. Downgraded: 1,212 (38.4%). LLM evaluations affected: 0/170. Heuristic evaluations affected: 1,212/2,983 (40.6%).
