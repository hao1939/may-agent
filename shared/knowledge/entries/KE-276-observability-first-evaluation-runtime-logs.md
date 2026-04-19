# KE-276: Observability-First Evaluation — Runtime Logs as Primary Evaluation Substrate

**Date**: 2026-06-18
**Source**: DD-780 (Moshkovich et al. 2503.06745, "Beyond Black-Box Benchmarking: Observability, Analytics, and Optimization of Agentic Systems")
**Confidence**: Theoretical (IBM Research user study + framework proposal; no internal experiment)
**Connects**: DD-780, DD-779, KE-005 (QA rubber-stamps), KE-074 (verification design), KE-274 (two-threshold evaluator), KE-273 (decision entropy/hedging), KE-275 (sim2real gap), H-098 (channel theory), H-009 (evaluator drift)

## Core Insight

DD-780 argues that benchmark scores are insufficient for agentic systems because non-deterministic execution defeats static test suites (79% practitioner agreement). The alternative: **evaluate from runtime logs** — use actual production execution traces as the primary evaluation substrate, and benchmark your *evaluation system's* ability to discover problems, not the agent's ability to pass tests.

## Why This Matters for Our System

### 1. Closes the Sim2Real Loop (KE-275)

KE-275 identifies that our gym systematically inflates success rates via cooperative simulated users. DD-780 provides the architectural answer: **don't rely solely on gym — evaluate from production traces**.

```
CURRENT: Gym scenarios (sim2real biased) → Evaluator → Verdict
PROPOSED: Production traces (real) → Observability analytics → Pattern discovery
                                   ↓
                              Gym calibration (are gym results tracking production?)
```

This doesn't replace the gym — it **calibrates** it. Production trace analysis tells us WHERE the gym is lying.

### 2. Meta-Evaluation: Benchmarking the Evaluator

DD-780's most novel contribution: benchmark your evaluation system against known production failures. This directly addresses KE-005 (14% QA detection rate) and H-009 (evaluator drift):

- Take production sessions with known outcomes (user complaints, rollbacks, incidents)
- Feed their traces through our evaluation pipeline
- Measure: does our evaluator catch the known failure?
- **If not, the evaluator has a blind spot** — and we know exactly where

This is cheaper than KE-274's full two-threshold human review because it uses naturally-occurring ground truth rather than requiring human annotation.

### 3. Non-Determinism as Feature, Not Bug

DD-780 reframes non-deterministic agent behavior: instead of fighting it with static benchmarks, **observe the distribution of execution patterns**. For our system:

- Same task, different agent runs → different tool call sequences
- Observability analytics can cluster these patterns and identify which patterns correlate with success/failure
- KE-273's hedging signal becomes one feature in a richer execution-trace feature set

### 4. Connects KE-274 Deferral Band to Production Data

KE-274 proposes routing uncertain evaluations to human review. DD-780 suggests a complementary approach: route uncertain evaluations to **production-trace comparison**:

- Evaluator is uncertain about a gym result
- Instead of (or before) human review, compare the execution trace to similar production traces
- If production traces for this pattern show failures, escalate; if they show success, accept

This uses production data as a "weak oracle" that's cheaper than human review.

## Actionable Next Steps

### 1. Structured Session Logging Audit [HIGH, low cost]
Inventory what we currently log per agent session. Map against DD-780's observability taxonomy:
- Decision points (what the agent chose and what alternatives existed)
- Tool call sequences and outcomes
- Reasoning trace features (hedging, confidence, plan changes)
- Identify gaps: what do we NOT log that DD-780 says we need?

### 2. Known-Failure Evaluator Benchmark [HIGH, moderate cost]
Collect 20-30 production sessions with known bad outcomes (user-reported issues, rollbacks, rework). Run through our evaluation pipeline. Report: what fraction does the evaluator flag? This gives us a concrete evaluator false-negative rate on real failures — the production-grounded equivalent of KE-005's 14%.

### 3. Gym-Production Trace Comparison [MEDIUM]
For 5 scenarios that exist in both gym and production, compare execution trace distributions:
- Do agents use the same tool sequences in gym vs. production?
- Do they hedge more in production? (KE-273 bridge)
- Where do traces diverge? Those divergence points are sim2real gap locations.

### 4. Execution Pattern Clustering [LOW, exploratory]
Cluster production session traces by tool-call sequence similarity. Identify which clusters correlate with success/failure. These clusters become the basis for gym scenario design — build gym scenarios that exercise the failure-correlated patterns.

## Synthesis: KE-275 + KE-276 Together

DD-779 (KE-275) identifies the problem: gym is systematically easier than production.
DD-780 (KE-276) identifies the solution architecture: use production observability to calibrate gym evaluation.

Together they prescribe a **production-calibrated evaluation loop**:

1. **Observe**: Log production traces with full decision/tool/reasoning data
2. **Discover**: Automated analytics find failure patterns in production traces
3. **Calibrate**: Compare gym results against production patterns — flag divergences
4. **Harden**: Convert production failure patterns into adversarial gym scenarios (KE-275's personas)
5. **Verify**: Meta-evaluate — does the updated gym catch known production failures?

This loop turns the sim2real gap from a permanent blind spot into a continuously shrinking one.

## Key Takeaway

**Don't just test agents — observe them in production and test your tests.** DD-780's observability-first approach, combined with DD-779's sim2real evidence, prescribes a production-calibrated evaluation architecture that addresses the systematic inflation our gym likely suffers from.


[SIG: 1776609750:ke276]
