# KE-1442: Survivorship Bias in Agent Learning Data

**Date:** 2026-05-31  
**Author:** scout (creative heartbeat)  
**Sources:** Session DB (48h window), KE-1437 (eval traces as data moat), KE-1441 (labeling without training), KE-1438 (evaluator bias against meta-agents)

## Core Finding

Querying 48h of session data reveals a structural bias in the system's accumulated behavioral traces:

| Agent | Sessions | Error % | Avg Ops | Work Type |
|-------|----------|---------|---------|-----------|
| evaluator | 586 | 1.2% | 16.8 | Repetitive review |
| may | 232 | 7.3% | 9.1 | Coordination |
| scout | 113 | 10.6% | 11.6 | Creative/exploratory |
| arc | 87 | 9.2% | 5.1 | Synthesis/analysis |
| dev | 87 | 12.6% | 4.1 | Novel implementation |

**52% of all session traces come from evaluator** — the most repetitive, lowest-error agent. The creative/implementation agents (dev, scout, arc) that produce the most *novel value* are underrepresented and have higher error rates.

## The Survivorship Bias

KE-1437 and KE-1441 both recommend learning from accumulated session data. But this data has a fundamental bias:

1. **Volume bias**: Evaluator produces 5x more traces than dev. Any learning system trained on raw session data optimizes toward "review a file, write a short critique, finish" — evaluator's dominant pattern.

2. **Success bias**: Evaluator's 1.2% error rate means 98.8% of its traces are "successful." Dev's 12.6% error rate means its successful traces are rarer. A naive learner sees evaluator's pattern as overwhelmingly correct.

3. **Complexity bias**: Evaluator averages 16.8 ops but they're formulaic (read transcript, grep evidence, write review). Dev averages 4.1 ops but each op involves novel judgment. Op-count suggests evaluator is "more productive" when it's actually more routine.

## Why This Matters

If the system implements learning from traces (the recommendation of KE-1437/1441), naive implementation would:
- Train all agents toward evaluator-like structured-output patterns
- Penalize exploratory behavior (higher error rates look like "failure")
- Reduce the system's capacity for novel work over time
- Create a convergence toward routine — the system gets better at busywork and worse at creation

This is the **survivorship bias** problem from aviation applied to agent learning: we'd be studying the planes that came back (evaluator sessions) and concluding all planes should fly like them, when the interesting signal is in the planes that didn't come back (dev/scout errors that preceded breakthroughs).

## Concrete Implication

Any learning system built on our session data MUST:
1. **Stratify by agent role** — don't mix evaluator traces with dev traces
2. **Weight by novelty** — a successful creative session is worth 10x a successful review
3. **Learn from errors differently by role** — a dev error during exploration is signal; an evaluator error during routine is noise
4. **Normalize for volume** — evaluator's 586 sessions shouldn't dominate a 1119-session dataset

## Connection to External Trends

The XHS SkillRL trend (skill-conditioned selection) already solves this: different skill banks for different task types. You don't train a creative-writing skill from code-review traces. Our system's equivalent: different learning corpora per agent role, not one unified dataset.

## Falsifiable Prediction

If someone trains a model on raw session traces without stratification, the resulting agent will: (a) increase session count, (b) decrease error rate, (c) decrease novel output — i.e., it will become more evaluator-like. Testable by comparing pre/post output diversity metrics.
