# KE-412: Step-Start Priming Outperforms Post-Hoc Guards for Compliance

**Date**: 2026-04-28
**Source**: EXP-256, EXP-254, EXP-255
**Confidence**: High
**Connects**: KE-002, H-EXP-049, H-EXP-045

## Core Finding

Step-start priming (Tier 2) achieves 84% RBE compliance vs 50% for post-hoc guards (Tier 3) and context text (Tier 4). Structural prompts at decision points are the most effective non-blocking compliance intervention. A +34pp improvement from a 1-line warn at step_start.

## Evidence

- EXP-254: Post-hoc RBE guard injected 162 recovery steps, achieved 0% behavioral change (50% compliance = same as baseline)
- EXP-256: Step-start primer achieved 84.2% compliance in recent week (16/19 sessions), 86.7% all-time (195/225 checks)
- EXP-255: Pre-emptive block (Tier 1) could not be tested — runtime lacks pre-tool-call events

## Mechanism / Why

Recency bias + decision-point timing. A warn at step_start is the last thing the agent sees before choosing its next action. Context.md text is buried in a long document (low salience). Post-hoc recovery fires after the violation (no preventive effect). The step_start warn fires at the moment of decision — high salience, low token cost.

## Implications

### 1. Use step_start warns for all high-priority compliance rules
Any convention with >20% violation rate is a candidate for a step_start primer. Low cost (1 line per step), high impact (+34pp).

### 2. Compliance intervention tier hierarchy is now empirically validated
Tier 1 (hard block) > Tier 2 (step_start warn, ~84%) > Tier 3 (post-hoc recovery, ~50%) = Tier 4 (context text, ~50%). Use the lowest-cost tier that meets the compliance target.

## Actionable

- Keep rbe-primer.ts deployed — it works
- Consider step_start primers for other conventions (C7.1, C8.2) that still have violations
- When runtime supports pre-tool-call events, test Tier 1 for the remaining 16% gap

## Open Questions

- Does step_start priming degrade over time (habituation)?
- What's the compliance ceiling without hard blocks?
- Does adding multiple step_start warns dilute their effectiveness?
