# KE-298: Unsupervised Behavioral Monitoring Outperforms Supervised Approaches for Agent Failure Discovery

**Date**: 2026-06-17
**Source**: DD#777 (Hodoscope, arxiv 2604.11072), CR#341, CR#343
**Confidence**: High
**Connects**: KE-290, KE-293, H-092, H-093, EXP-099, EXP-101

## Core Finding

Unsupervised group-wise behavioral comparison (comparing action distributions across successful vs failing sessions) achieves 6-23× review effort reduction and discovers unknown failure modes that supervised approaches miss. Behavioral distinctiveness — actions present in one group but absent/rare in others — is a stronger anomaly signal than predefined categories or linguistic hedging.

## Evidence

- Hodoscope discovered an unknown Commit0 vulnerability (unsquashed git history inflating scores for ≥5 models) and independently recovered known ImpossibleBench/SWE-bench exploits — all without predefined failure categories
- 6-23× review effort reduction vs naive uniform sampling
- EXP-101 showed linguistic hedging (HVR) has no discriminative power for agent failures (AUROC 0.535); 57.5% of sessions had zero hedging signals
- EXP-099's cascade archetypes (Tool Spiral, Comprehension Cascade, Drift-to-Decay) exhibit distinctive behavioral signatures that unsupervised comparison would surface

## Mechanism / Why

Agents fail in structurally distinctive ways — action distributions during failure modes deviate significantly from successful baselines. Supervised approaches (predefined categories, LLM-as-judge) miss novel failure modes because they only detect what they're trained to detect. Unsupervised approaches detect statistical anomalies regardless of category, enabling a discovery → supervised monitoring pipeline.

## Implications

### 1. Behavioral signals replace linguistic signals for failure prediction
Post-EXP-101, the question "what replaces HVR?" is answered: group-wise behavioral comparison on action distributions (tool calls, file patterns, retry sequences). Predicted >20pp AUROC improvement over HVR.

### 2. Layer 2 monitoring architecture validated
CR#343's 5-layer monitoring stack proposed behavioral monitoring as the second layer. Hodoscope provides the first practical implementation pattern with validated results.

### 3. Unsupervised → supervised pipeline for convention discovery
Coach could use Hodoscope-style analysis to discover convention violations outside the current C1-C12 taxonomy.

## Actionable

- Bob: Design EXP-102 using Hodoscope-style group-wise comparison on FM-3.3 session logs
- Tech-lead: Implement Layer 2 monitoring using behavioral distinctiveness as core metric
- Coach: Apply to discover unknown convention violation patterns

## Open Questions

- What is the minimum number of sessions needed for reliable group-wise comparison?
- Does the approach work for slow-drift failures (Drift-to-Decay) where action distributions change gradually?
