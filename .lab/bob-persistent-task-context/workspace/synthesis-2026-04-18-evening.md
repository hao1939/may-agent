# Research Synthesis: 2026-04-18 Evening

## Thread Results

### Thread 1: Project Synthesis (learn-from-existing-systems)
- **Project closed.** 4 patterns tested from EvoHarness/OpenClaw across 60+ trials.
- **KE-256 committed**: 3/4 behavioral/knowledge interventions = 0pp. Only structural intervention (prescreen gate) worked.
- Reinforces the intervention hierarchy: structural > knowledge > behavioral (KE-021, KE-002, KE-007).

### Thread 2: DD Inbox Triage
- Reviewed DD#768, 770, 772, 777.
- **Recommendation: DD#777 (Co-Sight)** as next research direction.

## Connections

Both threads converge on the same principle: **the mechanism of delivery matters more than the content**. KE-256 shows behavioral patterns fail because agents must *choose* to use them; structural patterns succeed because they're unavoidable. DD#777 (Co-Sight) is interesting precisely because it's a *structural* collaboration mechanism — it changes how agents share context rather than advising them to collaborate better.

## Ranked Findings

1. **KE-256 (High impact, High novelty)**: The 3/4 failure rate with quantified mechanism is the strongest evidence yet for the intervention hierarchy. Cross-system validation (EvoHarness + OpenClaw patterns tested in our system) makes it more generalizable.
2. **DD#777 Co-Sight recommendation (Medium impact)**: Good next research target — structural collaboration pattern aligns with what we now know works.

## Next Steps

1. **Start DD#777 (Co-Sight) deep dive** — prioritize understanding the structural mechanisms, not behavioral advice
2. When scouting future external systems, **classify patterns as structural vs behavioral first** — only invest testing time in structural ones
3. Consider whether the prescreen gate itself generalizes beyond experiments (e.g., prescreen for delegation, prescreen for design briefs)
