# KE-141: Checkpoint Decomposition — Sequential vs Global Pattern Detection Asymmetry

**Confidence**: ★★★★ (strong directional signal, methodology caveat)
**Source**: EXP-143 (N=100 sessions, within-subjects design)
**Date**: 2026-04-11
**Author**: Bob (integration of Coach experiment results)

## Core Finding

Checkpoint decomposition (evaluating 4-8 tool-call segments independently vs. full-transcript holistic evaluation) produces a **dramatic asymmetry** in failure mode detection improvement:

| Pattern Type | FM | Sensitivity Δ | Significance |
|---|---|---|---|
| **Sequential** (verify-after-edit) | FM-3.3 | **+32.1pp** (60.4%→92.5%) | p<0.05 ✅ |
| **Sequential** (deliverable exists) | FM-3.1 | **+34.6pp** (65.4%→100%) | p<0.05 ✅ |
| **Sequential** (error recovery) | FM-1.3 | +6.8pp (88.6%→95.5%) | NS |
| **Global** (wrong approach) | FM-2.1 | +2.6pp (97.4%→100%) | NS |

Session-level accuracy improved only +1.0pp (85.0%→86.0%).

## Mechanism

**Sequential patterns** — "did the agent verify after editing?" or "does a deliverable actually exist?" — are temporal ordering signals that get **diluted** when evaluated across a full transcript. Segment-level evaluation preserves these signals because each segment can independently check "edit happened → verification followed?"

**Global patterns** — "the agent took entirely the wrong approach" — are equally visible at any granularity. You can see a wrong approach in one segment or across the whole transcript. Decomposition adds no information.

## Implications

1. **Evaluation architecture should be hybrid**: Use checkpoint decomposition specifically for process/verification FM types (FM-3.3, FM-3.1, FM-1.3) while keeping holistic evaluation for approach assessment (FM-2.1)
2. **The 35% FM-3.3 residual** (from KE-116) is partially explained by evaluation architecture: holistic evaluation misses 39.6% of verification failures that segment-level evaluation catches
3. **Not a silver bullet**: Session-level accuracy barely moves (+1pp) because the improvement is concentrated in specific FM types, not across the board

## Methodology Caveat

EXP-143 used **heuristic pattern-matching** (regex-based FM detection), not LLM evaluation. The structural hypothesis (shorter text → better detection) holds for both heuristics and LLMs, but the **magnitude** may differ. LLM-based replication is needed to validate the broader H-096 claim.

## Probability Update

P(H-096): 0.68 → 0.65

Mixed results: strong signal for sequential FMs supports the "evaluation architecture" thesis, but no overall accuracy improvement and no trajectory-length correlation weaken the broader claim. The hypothesis is partially supported — decomposition helps for specific FM types, but isn't a universal evaluation improvement.

## Connections

- **Tests**: H-096 (evaluation architecture ceiling), P-096a (checkpoint decomposition prediction)
- **Extends**: KE-116 (FM-3.3 residual analysis), DD-720 (trajectory-length degradation)
- **Connects**: KE-136 (verification-depth guard), KE-137 (guard bifurcation)
- **Next**: LLM-based replication with proper ground truth (post FM-labeling deployment)

## Key Numbers

- N=100 sessions (≥15 tool calls each)
- 631 total segment evaluations
- FM-3.3: McNemar χ²=10.24, p<0.05
- FM-3.1: McNemar χ²=7.11, p<0.05
- 85/100 sessions FM-positive in ground truth
- Mean 6.3 segments per session
