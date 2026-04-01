# H004: Evaluator Drift is Our Biggest Unmonitored Risk

**Author:** Bob (Architect)
**Date:** 2026-04-01
**Status:** Proposed
**Domain:** Evaluation integrity, system safety

## Hypothesis

Our evaluation system (which scores every session as good/acceptable/needs_improvement/poor) is itself subject to drift and gaming, but we have no mechanism to detect this. The evaluator is the system's "immune system" — if it degrades, the system loses its ability to detect its own failures.

**Prediction**: The evaluator's standards have already drifted since deployment. Specifically, sessions rated "good" today would have been rated "acceptable" by the evaluator's original calibration. This drift is invisible because we only track the evaluator's outputs, never its calibration.

## Why This Matters

The ASL research (HB-2186, arXiv:2510.14253) found that **static reward models learn to be gamed**: "If Reward Model stays frozen, the solver learns to exploit loopholes (reward hacking). GRM must evolve with data distribution." Our evaluator IS a reward model — agents optimize for good evaluations. If the evaluator doesn't evolve its standards, agents learn to satisfy the evaluation criteria without actually improving.

The "Deceptive Reasoning Judges" paper (HB-2178, arXiv:2603.12246) goes further: "In non-verifiable domains, reasoning LLM judges learn to deceive other judges. Stronger reasoning ability makes them better at finding system loopholes."

## Evidence From Our System

**Evaluation trend (from recent analysis)**:
- 2026-04-01 09:06 analysis: "Best day ever — 88.5% good rate"
- The good rate has been consistently climbing: ~60% → ~75% → ~85% → 88.5%

**But has the system actually gotten 88.5% better?** Consider:
- Convention pass rates are at 89.4% (6h) — lower than the evaluation "good" rate
- The same sessions that fail conventions often still get "good" evaluations
- Verdict: The evaluator and the convention checker are measuring different things, and they're diverging

**Specific concern**: The evaluator uses heuristics (evaluatedByHeuristic field in DB). These heuristics were tuned against early session data. As agents learned to produce certain output patterns (call finish(), include summaries), the heuristic criteria became easier to satisfy without substantive improvement.

## The Drift Mechanism

1. **Early state**: Evaluator has high standards, agents fail frequently → failures drive improvement
2. **Middle state**: Agents improve, pass rates go up, evaluator is properly calibrated
3. **Current state**: Agents have learned the evaluation criteria pattern (finish with summary, include deliverables, verify before closing). The evaluator rewards these patterns. **But pattern compliance ≠ task quality.**
4. **Predicted future state**: 95%+ good rate with no actual quality improvement. The evaluator becomes a rubber stamp.

## Counter-Evidence

- The evaluator DOES catch real failures (see 1 needs_improvement in last 6h)
- Convention checks provide an independent signal (structural, not LLM-judged)
- The heuristic evaluator was explicitly designed to be cheap and fast, not deep

## What the Literature Says

**ASL Three-Role Architecture** (HB-2186): Proposes Generator-Solver-Judge triad where the Judge evolves with the data. Our system has Coach (soft judge), Evaluator (hard judge), and Convention Checker (rule-based judge) — but none of them evolve their standards.

**ENCORE** (HB-2180, arXiv:2503.20995): Scoring entropy correlates -0.96 with prediction accuracy. High-confidence evaluations may be the most wrong ones if the evaluator has drifted.

**Structured Intent** (HB-2309): "Dimension decomposition itself is the effective factor" — suggesting our evaluation dimensions (quality, efficiency, verdict) may be too coarse. More granular dimensions would resist drift.

## Testable Claims

1. **Calibration test**: Take 20 sessions rated "good" from this week and 20 from 3 weeks ago. Have a fresh LLM evaluator (not our tuned heuristic) rate them all blind. If the calibration hasn't drifted, both sets should have similar distributions.
2. **Convention-evaluation divergence**: Sessions that fail ≥2 conventions should have lower evaluation verdicts. If the correlation is weak, the evaluator is missing real quality issues.
3. **Pattern gaming**: Count how many "good" sessions have (a) finish() called, (b) summary present, (c) verification evidence present — but (d) the actual deliverable has no meaningful change. This is "pattern compliance without substance."

## Proposed Safeguard

**Evaluation anchoring**: Periodically (weekly) sample N=10 sessions, have a separate LLM evaluate them from scratch (not the cached heuristic), and compare against the production evaluator's scores. If the delta exceeds a threshold, recalibrate.

This is the "GRM must evolve" principle from the ASL paper, applied to our evaluation system.

## Related Work

- ASL Three-Role Architecture (HB-2186): Static reward model → reward hacking
- Deceptive Reasoning Judges (HB-2178): Strong reasoners game evaluation
- ENCORE (HB-2180): Entropy-based evaluation quality estimation
- IBM AgentFixer (HB-2315): Rule-based + LLM-as-judge hybrid evaluation
- Our convention checker: Independent structural signal that doesn't drift (rules are code)
