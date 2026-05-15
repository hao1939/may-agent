# Connection Note: arXiv:2604.26561 → H-210 / EXP-251 Phase 2

**Date**: 2026-04-30
**Paper**: "Preserving Disagreement: Architectural Heterogeneity Reduces Artificial Consensus"
**Source**: Scout triage (★★★★), connects DD#535, CR#290, H-210

## Key Insight from Paper

Architectural heterogeneity (using different models/configurations per agent perspective) is a structural intervention that preserves disagreement *without* sharing raw context between agents. The paper introduces a "trustworthy tension rate" metric — the proportion of inter-agent disagreements that reflect genuine uncertainty vs. artificial consensus collapse.

## Connection to H-210 (Selective Transparency)

H-210 posits that structured constraint metadata (taint tokens) can reduce CFVs without full context sharing. This paper provides an *alternative* mechanism: instead of propagating metadata about constraints, you preserve diversity by ensuring agents have architecturally different perspectives.

**Key tension**: Our current approach (EXP-251) focuses on *information flow* to fix CFVs. This paper suggests *structural diversity* as complementary/alternative.

## Implications for EXP-251 Phase 2

### Scenario A (Contradictory Coaching) — Direct Application

The paper's framework suggests a **4th condition** we should consider:

4. **Heterogeneous evaluators**: Instead of one evaluator producing both F1 and F2, use two evaluator personas with different weights (conciseness-favoring vs. thoroughness-favoring). The contradiction becomes a *feature* — a "trustworthy tension" signal — rather than a bug to resolve.

This reframes the metric: instead of "does agent detect contradiction?" → "does the system preserve the tension as useful signal?"

### New Metric: Trustworthy Tension Rate (TTR)

For Scenario A, add: what percentage of flagged contradictions represent genuine trade-offs vs. true inconsistencies? A system that collapses all tensions into consensus may score well on CFV-detection but poorly on decision quality.

### Scenario B (Stale-Finding Delegation) — Less Relevant

Staleness is genuinely a bug, not productive tension. The paper's framework doesn't apply here.

### Scenario C (Budget) — Tangential

Could argue heterogeneous budget preferences prevent race-to-bottom, but thin.

## Decision

- **Do NOT add Condition 4 to Phase 2 yet** — it would expand scope beyond current hypothesis
- **DO add TTR as secondary metric to Scenario A** — cheap to measure, high insight value
- **Queue as H-211**: "Architectural heterogeneity as CFV-prevention complement to metadata propagation" — test in Phase 3 if Phase 2 confirms metadata value

## Action Items

- [x] Document connection (this file)
- [ ] Add TTR metric to EXP-251 Phase 2 Scenario A measurement section
- [ ] Draft H-211 for Phase 3 heterogeneity arm
