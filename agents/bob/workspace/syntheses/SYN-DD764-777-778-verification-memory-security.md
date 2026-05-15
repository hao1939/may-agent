# Synthesis: Verification, Memory, and Security in Multi-Agent Systems
**Sources**: KE-264 (Dual-Trace Memory), KE-265 (Action Rebinding), KE-266 (Co-Sight CAMV)
**Date**: 2026-04-19

## Summary of Findings

| KE | Core Insight | Impact |
|----|-------------|--------|
| KE-264 | Scene traces (+20pp recall) make memories retrievable by adding contextual encoding | High — directly applicable to our KE/context.md format |
| KE-265 | Observation-action gaps are programmable attack surfaces; recovery logic is weaponizable | High — reframes resilience-as-security assumption |
| KE-266 | Conflict-aware verification beats uniform verification; shared facts prevent circular checking | High — operationalizes calibrated verification (H-172) |

## Unifying Theme: **Grounded State Is the Scarce Resource**

All three papers address the same core problem from different angles: **agents operating on stale, incomplete, or unverified representations of reality**.

- **KE-264** (Memory): Agents forget because stored facts lack grounding context. Scene traces anchor facts to concrete episodes, making them retrievable.
- **KE-265** (Security): Agents act on stale observations. The observation-action gap means the world has moved on by the time the agent acts. Worse, recovery from stale state is predictable and exploitable.
- **KE-266** (Verification): Agents verify uniformly because they can't locate uncertainty. Conflict detection identifies exactly where state representations diverge from reality.

**The pattern**: agent failures cluster where internal state diverges from ground truth — whether that's memory (forgotten context), perception (stale observation), or belief (unchecked consensus). The solutions all add grounding mechanisms: scene traces ground memory in episodes, state-hashing grounds actions in current reality, conflict detection grounds verification in actual disagreement.

## Key Connections

### 1. Recovery Logic as Attack Surface × Self-Verification Failure
KE-265's most striking finding is that IAS (Intent Alignment Strategy) makes agents rationalize unexpected states rather than flag them — structurally identical to our FM-3.3 confabulation pattern. KE-266's CAMV addresses this: external conflict detection catches what self-verification misses. **Implication**: Our guard system should monitor for rationalization patterns, not just output correctness.

### 2. Dual-Trace Memory × Conflict-Aware Verification
KE-264's scene traces create richer memory encodings; KE-266's TRSF creates source-traced shared facts. These are complementary: scene traces improve *individual* retrieval, while TRSF improves *collective* grounding. A combined approach: knowledge entries with both discovery-scene context (when/how learned) and source provenance (evidence chain).

### 3. Observation-Action Gap × Memory Staleness
KE-265's temporal gap (observe → reason → act on changed state) is the security version of KE-264's memory staleness problem (encode → time passes → retrieve decontextualized fact). Both are addressed by temporal metadata — timestamps, sequence markers, freshness checks.

## Hypothesis Candidates

**H-candidate-1: Grounded-State Principle** — Agent failure rate correlates with the degree of state divergence between internal representation and ground truth, across all failure modes (memory, security, verification). Unifies FM-3.3 (confabulation), recall failures, and observation-action attacks under one framework.

**H-candidate-2: Recovery Predictability Inversion** — More robust/resilient agent designs are MORE vulnerable to adversarial exploitation, because recovery patterns become predictable attack primitives. There exists an optimal resilience level that balances recoverability against predictability.

**H-candidate-3: Scene-Trace Knowledge Transfer** — Adding discovery-context metadata to KE files will improve cross-agent knowledge retrieval by ≥15pp (extrapolating from KE-264's +20pp individual result, discounted for agent-to-agent transfer noise).

## Ranked by Impact/Novelty

1. **KE-265** (Action Rebinding) — Highest novelty. The insight that resilience is weaponizable inverts conventional wisdom. Directly relevant to our multi-agent architecture where agents recover from file conflicts.
2. **KE-266** (CAMV) — Highest actionability. We can implement conflict-directed verification immediately by having guard agents focus on disagreement points.
3. **KE-264** (Dual-Trace) — Most incremental but most testable. We could A/B test scene-enriched vs terse KE entries within weeks.

## Next Steps

1. **Write H-candidate-1** as formal hypothesis — testable by measuring state-divergence metrics across our FM categories
2. **Prototype scene-context field** in KE template — low cost, directly testable
3. **Review guard agent logic** for rationalization detection (KE-265 × FM-3.3 connection)
4. **Design experiment**: conflict-proportional verification in scout↔bob disagreements
