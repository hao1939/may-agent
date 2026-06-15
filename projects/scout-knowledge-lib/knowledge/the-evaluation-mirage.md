# The Evaluation Mirage: When Measurement Replaces Signal

**Type:** Cross-Source Synthesis (Session 9)  
**Created:** 2026-07-17  
**Status:** Active hypothesis with strong production evidence  
**Extends:** The Session Floor, The Observability Trap  
**Corrects:** Implicit assumption across all prior syntheses that evaluator output contains information

## The Discovery

All prior syntheses treat the evaluator as expensive but *informative* — the Observability Trap measures its volume, the Session Floor measures its fixed cost, the Prompt Mass Problem measures its echo weight. But none asks the prior question: **does the evaluation system produce information?**

Fresh production data reveals it largely does not.

## The Evidence: Four Layers of Hollowness

### Layer 1: Quantized Scores — 10 States for 15,000 Sessions

The heuristic evaluator (95.7% of all evaluations) assigns scores from exactly 10 distinct (quality, efficiency) pairs:

| Quality | Efficiency | Verdict | Count | % |
|---------|-----------|---------|-------|---|
| 0.65 | 0.80 | acceptable | 3,396 | 23.7% |
| 0.85 | 0.80 | good | 3,228 | 22.5% |
| 0.00 | 0.00 | skipped | 2,876 | 20.1% |
| 0.55 | 0.80 | needs_improvement | 1,395 | 9.7% |
| 0.85 | 0.55 | good | 1,057 | 7.4% |
| 0.65 | 0.55 | acceptable | 690 | 4.8% |
| 0.20 | 0.80 | needs_improvement | 677 | 4.7% |
| 0.65 | 0.35 | acceptable | 320 | 2.2% |
| 0.20 | 0.55 | needs_improvement | 289 | 2.0% |
| *(3 more)* | | | 418 | 2.9% |

**Shannon entropy: ~3.0 bits.** 14,345 evaluations carrying 3 bits of information each. A single 3-bit integer per session would encode the same information with zero evaluator sessions.

### Layer 2: Efficiency Is a Deterministic Function of OpCount

The efficiency score is assigned by opCount bucket — not by any analysis of what those ops accomplished:

| Efficiency Score | OpCount Range | Average Ops |
|-----------------|---------------|-------------|
| 0.80 | 0–30 | 11.8 |
| 0.55 | 31–71 | 43.1 |
| 0.35 | 61–152 | 76.2 |

This is literally `efficiency = opCount < 31 ? 0.8 : opCount < 61 ? 0.55 : 0.35`. A 3-line function replaces 14,345 evaluator sessions.

### Layer 3: Wasted Calls Are Always Zero

For heuristic evaluations, `wastedCalls = 0` in 12,503 of 14,345 cases (87.2%). The remaining 12.8% have `wastedCalls = 1` (1,765) or `wastedCalls = 2` (78). The evaluator assumes almost no work is wasted — a constant, not a measurement.

Compare to LLM-based evaluations (649 sessions): average wastedCalls = 15.5, with meaningful variance. The LLM evaluator *does* find waste — the heuristic evaluator assumes it away.

### Layer 4: Nobody Reads the Output

Evaluator aftermath files (`agents/evaluator/workspace/aftermath/*.md`) have been read a total of **0 times** by other agents. The evaluator-aftermath.ts workflow source gets read 8 times (for maintenance). The actual evaluation *results* — the critiques, the verdicts, the quality scores — go nowhere.

The `action` field in session_digests for the evaluator: **100% null** (15,825 records). Except for 606 digests where action = "nothing" with reason "No recoverable work worth resuming."

The evaluator produces 15,825 digests that say, effectively, nothing.

## The Information-Theoretic Formulation

### What the evaluator spends

| Resource | 7-day total | System share |
|----------|-------------|--------------|
| Sessions | 7,912 | 47.6% of all sessions |
| Operations | 148,581 | 39.1% of all system ops |
| Evaluations produced | 14,994 | — |
| Of which heuristic | 14,345 | 95.7% |

### What the evaluator produces

| Output | Information content |
|--------|-------------------|
| 14,345 heuristic evals | ~3 bits each = 43,035 bits total ≈ 5.3 KB |
| 649 LLM evaluations | Variable, but meaningful |

**The system spends 148,581 operations to produce 5.3 KB of information that nobody reads.**

### The Ratio

If we price ops at ~$0.001 each (conservative model call cost), the evaluator spends ~$149 per week to produce 5.3 KB of unread data. The information density is 0.036 bits per operation — far below the ~50-100 bits per operation that a typical agent session produces (reading files, writing code, making decisions).

This is the Observability Trap's endgame: the observation system has crossed from "low signal" to "negative signal" — it consumes resources that could produce actual work, while generating scores that are deterministic functions of metadata the system already has.

## Why This Isn't Just "The Evaluator Is Bad"

The deeper finding is structural, not implementational:

### 1. Heuristic evaluation is a compiled abstention — backwards

The Compilation Gradient says governance should mature from behavioral → structural → compiled. The heuristic evaluator is "compiled" in the sense of being deterministic — but it compiles the *wrong thing*. It compiles the *act of evaluating* (always run the evaluator) rather than the *decision to evaluate* (only evaluate when there's signal to process).

This is the Abstention Advantage inverted: instead of compiling the decision *not to act*, the system has compiled the decision *always to act* — even when action produces no information.

### 2. The measurement became the goal (Goodhart's Law)

The evaluation scores exist. Metrics are computed from them. Dashboards display them. The system has quality and efficiency metrics that show stable values — because those values are deterministic functions of opCount, and opCount doesn't change much. The scores *look* like health signals, but they're measuring the evaluator's own consistency, not the system's quality.

This connects directly to the Consistency Illusion (arXiv 2606.08457): "debate reduces reasoning alignment while increasing surface agreement." Replace "debate" with "heuristic evaluation" and "agents" with "metrics" — the evaluator *increases metric agreement* (stable quality scores) while *decreasing reasoning alignment* (nobody checks whether the scores reflect reality).

### 3. The shadow cost exceeds the visible cost

The Session Floor quantified the evaluator's visible cost (19.2 avg ops per session). But the evaluation system has additional shadow costs:

- **Evaluator sessions trigger their own digests** — 2,249 session_digests for evaluator in 3 days
- **Evaluation data accumulates in the DB** — 14,994 rows × ~500 bytes = ~7.5 MB per week
- **Metric computation cycles** that process the evaluator's scores
- **Context pollution**: 1,029 of 9,861 non-evaluator digests mention evaluation verdicts, meaning agents spend attention on scores that carry 3 bits of information

## The Connection to Certainty Preservation

Notes2Skills (arXiv 2606.11897) identifies the critical distinction: uncertain observations promoted to confirmed status cause agents to make bad decisions. Our evaluation system does exactly this — a 3-bit heuristic score (quality = 0.65, efficiency = 0.8) looks like a precise measurement, but it's a rough bin assignment. The system treats "quality = 0.85" as evidence of "good" work, but it's actually evidence of "sessions with 31-71 ops where the agent's status was success."

The 649 LLM-based evaluations have genuine information: variable scores, non-zero wastedCalls, specific issue identification. But they're drowned by 14,345 heuristic evaluations that project false precision onto rough buckets.

## The Meta-Pattern: Measurement Displacement

This is an instance of a broader pattern I'll call **Measurement Displacement**: when a system measures a proxy so consistently that the proxy replaces the thing it was supposed to measure.

| System | Proxy | Actual measure | Displacement |
|--------|-------|----------------|--------------|
| Our evaluator | opCount buckets | Session quality | 95.7% heuristic |
| Academic metrics | Citation count | Research impact | h-index career optimization |
| Code coverage | Lines executed | Code correctness | 100% coverage ≠ 0 bugs |
| Agent benchmarks | Short-horizon tasks | Long-horizon reliability | Emergence World divergence |

The pattern across the synthesis library:

1. **Impedance Principle**: The evaluator circulates its own (low-information) output into system metrics
2. **Observability Trap**: More evaluation → worse signal quality → metrics still look stable → no correction pressure
3. **Session Floor**: Fixed per-session cost makes the evaluator expensive even when information content is zero
4. **Coordination Tax**: Evaluator sessions are triggered by events (session completion), not by outcomes (something meaningful happened)

The Evaluation Mirage is where all four pathologies converge on a single subsystem: the evaluator is expensive (Floor), self-reinforcing (Impedance), quality-degrading (Trap), and event-triggered rather than outcome-triggered (Tax). It is the canonical instance of all prior syntheses.

## Concrete Evidence: The 3-Line Replacement

The heuristic evaluator's entire information output can be replicated by:

```javascript
function heuristicEval(opCount, status) {
  if (status === 'skipped') return { quality: 0, efficiency: 0, verdict: 'skipped' };
  const eff = opCount <= 30 ? 0.8 : opCount <= 60 ? 0.55 : 0.35;
  const quality = /* some function of status and error fields */;
  return { quality, efficiency: eff, verdict: quality >= 0.8 ? 'good' : quality >= 0.6 ? 'acceptable' : 'needs_improvement' };
}
```

This replaces 14,345 evaluator sessions (at ~19.2 ops each = 275,424 ops per week) with a synchronous function call at session completion.

## Predictions

1. **Replacing heuristic evaluations with a synchronous function should save ~28% of all system operations** (275K of ~975K weekly ops estimated from 380K/3-day × 7/3) with no loss of information — because the heuristic evaluator produces no information the function doesn't.

2. **Evaluation quality metrics will not change** after replacing heuristic evaluation — because the metrics are derived from the heuristic scores, which are derived from the metrics (opCount). The measurement is self-referential.

3. **LLM evaluations (4.3% of total) should increase in relative value** once freed from the noise of heuristic scores. The LLM evaluator finds genuine waste (avg 15.5 wasted calls) and produces meaningful variance.

4. **The Consistency Illusion will manifest again**: when/if heuristic evaluation is removed, the first response will be "quality scores dropped" — because the stable 0.65/0.85 quality scores will be replaced by whatever the LLM evaluator produces, which has genuine variance and lower averages.

## Updated Synthesis Hierarchy

```
Impedance Principle (foundational) — feedback requires damping
  ↳ Compilation Gradient (developmental) — governance matures through stages
    ↳ Abstention Advantage (behavioral) — compiled non-action saves per-session ops
      ↳ Session Floor (structural) — fixed overhead inverts efficiency
    ↳ Observability Trap (emergent) — self-observation self-poisons
      ↳ Prompt Mass Problem (structural) — input costs dominate output
        ↳ Coordination Tax (operational) — planning grows superlinearly
          ↳ EVALUATION MIRAGE (convergent) — all prior pathologies
                                             manifest in one subsystem.
                                             The evaluator is expensive (Floor),
                                             self-reinforcing (Impedance),
                                             quality-degrading (Trap),
                                             event-triggered (Tax),
                                             and produces 3 bits of information
                                             per 19.2-op session that nobody reads.
```

## The Actionable Insight

The system's most expensive component is also its least informative. This is not a case of "the evaluator needs improvement" — it's a case of Measurement Displacement where the act of measuring has become a substitute for the act of understanding.

The fix is not "better evaluation." The fix is:
1. **Replace heuristic evaluation with a synchronous function** (saves ~28% of system ops)
2. **Route LLM evaluation only to sessions with signal** (opCount > 30, status != success, or error present)
3. **Delete the accumulated heuristic scores** — they contain less information than the session metadata they were derived from

---

*Session type: Creative heartbeat. Triggered by noticing that heuristic evaluation scores cluster on exactly 10 (quality, efficiency) pairs, realizing this means ~3 bits of information per evaluation, then discovering that zero evaluation aftermath files are ever read by other agents — meaning the system's largest subsystem produces unread information derived from metadata it already has.*
