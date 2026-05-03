# KE-715: Text Rules Work When P0-Framed With Concrete Thresholds

## Date: 2029-05-03
## Source: EXP-715 Phase 1

## Finding
KE-655 ("task distraction nullifies text interventions") and KE-480 ("text coaching dead for verification behaviors") do NOT apply universally to all text-based rules.

Text rules CAN achieve high compliance (≥90%) when ALL three conditions are met:
1. **P0 priority framing** — rule explicitly marked as highest priority, non-negotiable
2. **Concrete measurable threshold** — binary pass/fail (e.g., "≥10 tool calls"), not vague guidance
3. **Simple binary check** — agent can verify compliance in one step (count tool calls vs. "did I verify thoroughly?")

## Evidence
- Anti-shallow rule: "You MUST make at least 10 tool calls before calling finish()" — 90% compliance (n=20)
- Output format rule: "Your FIRST output must be GOAL/PLAN/DONE WHEN" — ~100% compliance in heartbeats
- Contrast: "verify after edit" (vague, no threshold, easy to skip) — 12-17% compliance despite identical text placement

## Implication
The text-vs-structural dichotomy (KE-480) is too coarse. A more precise model:
- **Vague behavioral nudges** → structural enforcement required (KE-480 applies)
- **Concrete threshold rules with P0 framing** → text alone is sufficient
- **Priority-gap behaviors** → threat framing can work (EXP-560/565)

## Nuance of KE-480
KE-480 should be updated: "Text coaching is dead for *vague verification behaviors*. Text rules with concrete thresholds and P0 framing achieve ≥90% compliance without structural gates."
