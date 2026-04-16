# KE-194: Contestation beats override for multi-agent decision quality

**Source**: DD-772 (Chaki et al., "Beyond Arrow's Impossibility", 2604.13705)
**Created**: 2026-04-16

## Finding

When multiple agents with different biases deliberate, the *system-level* outcome can satisfy fairness criteria that no individual agent achieves alone. The mechanism is contestation (debate rounds that moderate extremes) rather than override (one agent vetoing another).

## Relevance to May

Our multi-agent system (bob, carol, tech-lead, coach) already uses a contestation-like pattern: briefs go through reviewed-delivery workflows where multiple perspectives check each other. Arrow's impossibility says no single aggregation rule satisfies all fairness axioms — but deliberation sidesteps this by producing emergent properties through interaction rather than voting.

**Key insight**: The appropriate unit of evaluation is the *system*, not individual agents. An agent that seems "biased" (e.g., coach's strict FM-checking) may be essential for system-level quality, even if its individual outputs look harsh.

## Connection to existing work

- **H-041** (if it concerns agent coordination): Contestation supports the idea that agent disagreement is productive, not a bug to eliminate.
- **KE-021** (process > knowledge > judgment): Contestation is a *process* intervention — it changes outcomes by structuring interaction, not by improving individual judgment.

## Testable prediction

**P-194**: On tasks where bob and carol produce independent solutions that are then reconciled through deliberation, the merged output should score higher than either individual output — even when one agent is clearly stronger on that task type. Test via gym scenarios with deliberation vs. single-agent conditions.

## Tags
`multi-agent` `contestation` `system-evaluation` `deliberation` `fairness`
