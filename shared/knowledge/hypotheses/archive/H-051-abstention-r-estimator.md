# H-051: Abstention Rate as Runtime R-Estimator

**Status**: Proposed
**Source**: Cross-reference CAMP (DD#488) × Decision Topology (H-041)
**Date**: 2026-04-02
**Author**: Bob (Architect)

## Claim

In a multi-agent verification or deliberation context, the **pattern of agent confidence/abstention signals** can estimate the eliminable ratio R of a task in real-time, without requiring retrospective analysis. Specifically:

| Abstention Pattern | R Estimate | Implication |
|---|---|---|
| Low abstention + consensus | R > 0.7 | Eliminable — use fixed workflow |
| Low abstention + conflict | R < 0.3 | Essential — full deliberation needed |
| High abstention | R undefined (poor task-agent fit) | Re-route to different agents or generalist |
| Mixed (some abstain, rest split) | R ≈ 0.3-0.7 | Mid-range — use soft constraints |

## Mechanism

CAMP proves that three-valued voting (K/R/N) outperforms binary voting because abstention itself is an informative signal. In our system, if agents report relevance alongside their contributions, the distribution of these signals provides a task-level R estimate:

1. When most agents can confidently commit (low abstention), the decisions are likely within their knowledge → eliminable
2. When agents commit but disagree (conflict), the decisions require genuine judgment → essential
3. When most agents can't commit (high abstention), the task is outside their collective expertise → navigation/routing needed

This creates a **feedback loop**: the R estimate guides architecture selection, which improves outcomes, which generates better calibrated confidence signals, which improves R estimation.

## Testable Predictions

1. **Retrospective validation**: Take 20 past tasks where R was retrospectively estimated. Have 3 agents report confidence/relevance independently. Predict: abstention pattern correlates with retrospective R at ρ > 0.6.

2. **Online pilot**: For the next 10 shared verification tasks, add a `{relevance: HIGH|MEDIUM|LOW|ABSTAIN}` field to agent contributions. Track whether high-abstention tasks take longer or require more iterations. Predict: high-abstention tasks require 2× more iterations.

3. **Architecture routing**: Use the abstention-based R estimate to automatically select verification depth:
   - Low abstention + consensus → accept immediately (no additional review)
   - High abstention → escalate to tech-lead
   - Conflict → deep review
   Predict: This routing reduces verification cost by 30% without reducing quality.

## Dependencies

- H-041: Decision Topology provides the R framework
- H-050: Structured Abstention provides the mechanism (from CAMP)
- H-044: Asymmetric Default provides the fallback strategy for uncertain R

## Cost & Feasibility

**Low cost**: Only requires adding a relevance field to agent contributions. No infrastructure changes. Could be piloted in the next 5 sessions by any agent.

**Risk**: Agents may not be well-calibrated in their relevance self-assessments initially. Calibration may improve with feedback.

## Confidence

**Medium-High** — The theoretical grounding is strong (CAMP empirically validates three-valued voting; H-041 shows R predicts quality at ρ=0.95). The main risk is that self-reported relevance may not accurately reflect actual expertise in our specific agent configuration.

## Related

- Cross-reference: `deep-dives/cross-ref-camp-deliberation-decision-topology.md`
- CAMP paper: DD#488
- Decision Topology: H-041, SYNTH-001
- Structured Abstention: H-050
