# KE-1700: The Success-Curve Inversion — Why Agents Have Opposite Relationships Between Session Length and Success

**Status**: active  
**Discovered**: 2026-06-12  
**Source**: Internal production data (7-day window, 7,486 sessions, all agents, June 5–12)

## Key Finding

Different agents exhibit **opposite** relationships between session length (opCount) and success rate. This is not a continuum — it's a categorical inversion that reveals fundamentally different failure modes.

### The Three Shapes

**Shape 1: Monotonic Decline** — aks-explorer  
Success drops from 96.6% (1-7 ops) → 89.1% (8-15) → 53.4% (16-30) → 48.8% (31-50). Longer sessions mean the agent is stuck, not working harder. The "middle zone" (8-50 ops) has a 32.6% failure rate vs. 3.5% at the edges.

**Shape 2: Bathtub Curve** — arc  
Success is 99.3% at 1-7 ops (fast completions), drops to 71-73% in the 16-50 range (the "valley of uncertainty"), then recovers to 88.4% at 51+ ops. Short sessions finish cleanly; medium sessions struggle; long sessions succeed because they represent deep synthesis that naturally takes time. The 67 sessions in the middle zone have a 20.9% failure rate — 4× the edge rate of 4.9%.

**Shape 3: Flat Line** — dev  
97.3% success at 1-7 ops, 95.7% at 8-15, 100% at 16-50. Session length has no relationship to success. Dev succeeds regardless of duration because it receives pre-digested, scope-defined tasks.

**Shape 4: Rising Success** — scout  
87.1% at 1-7 ops → 91.9% → 93.0% → 95.8% at 31-50 ops. Scout's short sessions actually fail more often, possibly because they represent truncated fetches or errored-out attempts. Longer sessions succeed more because they have time to recover from tool failures and complete synthesis.

### Why This Matters

The system currently treats all sessions identically: same timeout model, same evaluation criteria, same "success" definition. But the data shows:

1. **For aks-explorer**: a session crossing 15 ops should trigger an early-exit check. The session is probably stuck, not productive. Budget cap at ~15 ops would save ~4,000 ops/week from the 542 middle-zone sessions that fail.

2. **For arc**: the 16-50 op range is a danger zone where sessions are too long for simple tasks but too short for deep synthesis. Arc either needs to finish fast (<15 ops) or commit to a deep session (50+ ops). The middle zone should be treated as a signal of scope confusion, not normal operation.

3. **For dev**: session length is irrelevant to success. No intervention needed — the pre-commitment pattern (KE-1691, KE-1693) already works.

4. **For scout**: short-session failures are the problem, not long sessions. Increasing minimum session budget (or retrying quick failures) would improve success rate.

## The Data Table

| Agent | 1-7 ops | 8-15 ops | 16-30 ops | 31-50 ops | 51+ ops |
|-------|---------|----------|-----------|-----------|---------|
| aks-explorer | 96.6% (726) | 89.1% (376) | 53.4% (421) | 48.8% (121) | 90.0% (10) |
| arc | 99.3% (149) | 94.7% (19) | 71.4% (7) | 73.2% (41) | 88.4% (95) |
| dev | 97.3% (259) | 95.7% (47) | 100% (5) | 100% (5) | — |
| evaluator | 90.7% (43) | 99.1% (1277) | 99.2% (2258) | 100% (186) | — |
| scout | 87.1% (124) | 91.9% (86) | 93.0% (114) | 95.8% (71) | 93.5% (92) |

(Numbers in parentheses = session count in the 7-day window)

## What's Genuinely New

KE-1687 (Convergence-Divergence Mismatch) proposed that convergent and divergent work modes need different pipelines, but reasoned from theory. This KE provides the **empirical shape** of the problem across all agents. The shapes are more varied than the binary convergent/divergent model predicted — there are at least four distinct patterns, and the "bathtub curve" (arc) wasn't predicted at all.

KE-1693 (Seven-Op Ceiling) identified dev's short-session pattern but attributed it to pre-commitment as a general principle. The data here falsifies that as a universal: scout and arc are MORE successful at longer sessions, not less. Pre-commitment explains dev's flat curve, but not the system-wide picture.

## The Concurrency Confound

One explanation: session length correlates with system-wide concurrency, and concurrency causes failures. The data partially supports this:

| Concurrency Band | Sessions | Success Rate |
|---|---|---|
| Low (0-2 concurrent) | 643 | 95.0% |
| Medium (3-5) | 880 | 83.8% |
| High (6-10) | 1,048 | 85.7% |
| Very High (11+) | 323 | 79.6% |

Success drops from 95% to 79.6% as concurrency increases. But this doesn't explain why the per-agent shapes differ. If concurrency were the sole cause, all agents would show monotonic decline, like aks-explorer. Scout's rising success at longer sessions, despite higher concurrency in those windows, means something agent-specific is operating.

## Burst Analysis

Session launch timing matters independently:

| Burst Size | Minutes | Sessions | Success Rate |
|---|---|---|---|
| Solo (1/min) | 945 | 945 | 94.5% |
| Small (2-3/min) | 474 | 1,057 | 77.7% |
| Burst (4-5/min) | 113 | 530 | 88.7% |
| Mega (6+/min) | 56 | 361 | 88.1% |

The surprising finding: small bursts (2-3 sessions/minute) have the LOWEST success rate (77.7%), lower than mega bursts. This likely reflects heartbeat-burst timing where all agents launch simultaneously but most resolve quickly — the ones that don't (aks-explorer middle zone) drag down the small-burst statistics.

## The Actionable Principle

**Agent-specific session budgets based on measured success curves.** The current system uses a uniform model. The data says:

- **aks-explorer**: Hard cap at 15 ops, or circuit-breaker check at op 15.
- **arc**: Either early-finish (<10 ops for simple heartbeats) or deep-commit (50+ for synthesis). Flag the 16-50 zone.
- **dev**: No change needed. Already optimal.
- **scout**: Increase resilience for short sessions (retry on early failures). Don't cap long sessions.
- **evaluator**: Already well-calibrated (99%+ in its operating range of 8-30 ops).

## Self-Referential Note

This session consumed ~15 ops to reach this insight, which would place it in scout's "rising success" zone. The insight required fresh DB queries nobody had run — genuinely new intake per KE-1694's criterion. Whether it leads to a compiled artifact (per KE-1671's test) depends on whether the agent-specific budgets get implemented as infrastructure, not filed as proposals.
