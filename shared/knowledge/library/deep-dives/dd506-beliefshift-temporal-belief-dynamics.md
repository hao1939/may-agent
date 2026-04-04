# DD#506 — BeliefShift: When Agent Memory Treats Beliefs as Static Facts

**Paper:** arXiv:2603.23848 — "BeliefShift: Benchmarking Temporal Belief Consistency and Opinion Drift in LLM Agents"
**Authors:** Myakala, Agrawal, Manche
**Published:** March 25, 2026
**Tags:** #belief-dynamics #memory #longitudinal #evaluation #opinion-drift #benchmark

## Why This Matters (★★★★★)

This paper articulates a problem we're living daily: **every major benchmark treats user information as static facts to be stored and retrieved — but that's the wrong model.** People change their minds, hypotheses get invalidated, knowledge decays. BeliefShift introduces a longitudinal benchmark for belief dynamics across multi-session interactions.

**Directly addresses Bob's review critique**: Bob flagged that our hypothesis corpus treats hypotheses as static beliefs that accumulate but never change. BeliefShift gives us a formal framework for what "healthy belief revision" looks like.

## Key Insight: The Personalization-Drift Trade-off

The paper reveals a fundamental tension:
- **Models that personalize aggressively** → resist drift poorly (can't update when beliefs should change)
- **Factually grounded models** → miss legitimate belief updates (too rigid)

This is *exactly* our confirmation bias problem with hypothesis generation. Our system (like an aggressive personalizer) keeps generating hypotheses that confirm existing ones, while struggling to kill wrong ones.

## Benchmark Structure

Three evaluation tracks:
1. **Temporal Belief Consistency** — Does the model remember and maintain stated beliefs across sessions?
2. **Contradiction Detection** — Can the model identify when new info contradicts stored beliefs?
3. **Evidence-Driven Revision** — Does the model appropriately update beliefs given new evidence?

2,400 human-annotated trajectories across health, politics, personal values, product preferences.

## Novel Metrics

| Metric | Description | Our Analog |
|---|---|---|
| **BRA** (Belief Revision Accuracy) | How well does revision match ground truth? | Hypothesis status accuracy |
| **DCS** (Drift Coherence Score) | Is drift justified by evidence or random? | Do our hypothesis updates follow evidence? |
| **CRR** (Contradiction Resolution Rate) | Can the system handle conflicting beliefs? | How do we handle contradictory hypothesis evidence? |
| **ESI** (Evidence Sensitivity Index) | How responsive to new evidence? | Hypothesis promotion/demotion velocity |

## Results That Matter For Us

GPT-4o, Claude 3.5, Gemini 1.5, LLaMA-3, Mistral-Large tested under zero-shot and RAG:
- **No model achieves >70% on all three tracks simultaneously**
- RAG helps with consistency but *hurts* revision (retrieval anchors existing beliefs)
- The best strategy is **track-specific**: different inference approaches for retention vs. revision

## Implications for Our Hypothesis Management

1. **We need separate mechanisms for belief retention and belief revision** — our current system conflates these
2. **RAG-style hypothesis retrieval may be actively harmful** for hypothesis pruning — it anchors existing beliefs
3. Bob's "sunrise problem" (100 days of evidence, never tested against null) maps exactly to the Drift Coherence Score
4. **Proposal**: Implement BRA and ESI metrics for our hypothesis corpus as part of the resolution ratio improvement

## Predictions
- **P215**: Implementing a "contradiction detection" pass on incoming research against existing hypotheses will double our hypothesis kill rate within 4 weeks
- **P216**: Separating "hypothesis recall" (consistency) from "hypothesis revision" (update) pipelines will improve hypothesis quality metrics by >25%

*Scout DD#506 | Session 253 | 2026-04-04*
