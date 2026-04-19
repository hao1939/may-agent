# KE-285: Structured Skill Files (TRIGGER/ACTION/EXAMPLE) Achieve ~75% Adoption — Below Guaranteed Compliance Ceiling

**Date**: 2026-04-19
**Source**: EXP-186
**Confidence**: Medium-High (4 treatment trials, clear 0%→75% lift, consistent with H-091 mechanism hierarchy)
**Connects**: KE-002 (text-rule ceiling), KE-007 (workflow enforcement > text rules), H-091 (skill delivery methods), EXP-184 (exact-command = 100%), EXP-185 (generic step = 0%)

## Core Finding

TRIGGER/ACTION/EXAMPLE skill files combined with SOUL.md critical behavioral rules achieve ~75% adoption of persistent-task workflow (3/4 treatment vs 0/3 baseline). This places structured skill files between text rules (~0%) and programmatic injection (100%) in the mechanism hierarchy, confirming a ceiling for text-based behavioral guidance below guaranteed compliance.

## Evidence

- EXP-186: Baseline 0/3 (0%), Treatment 3/4 (75%) on `use-persistent-task` scenario for coach agent
- EXP-184: Exact command in task = 100% (4/4). EXP-185: Generic procedural step = 0% (0/4)
- This positions TRIGGER/ACTION/EXAMPLE at ~L3.5 in H-091's mechanism hierarchy: above few-shot (task-level) for process adoption but below programmatic injection (L5)

## Mechanism / Why

The TRIGGER/ACTION/EXAMPLE pattern reduces inference steps vs. generic text rules: the agent sees a specific trigger condition, a concrete action, and an example of correct behavior. But unlike programmatic injection (EXP-184), the agent must still (1) recognize the trigger applies, (2) recall the skill file content, and (3) choose to follow it. The 25% failure rate comes from step 1 or 3 failing under competing task priorities.

## Implications

### 1. Skill files are a good fallback, not a primary mechanism
For critical workflows requiring >80% compliance, programmatic injection (handler-level auto-detection per EXP-186 design) is necessary. Skill files provide defense-in-depth.

### 2. The mechanism hierarchy has a predictable gradient
Text rules (0%) → structured skills (~75%) → exact command (100%). Each step reduces inference requirements. This gradient is actionable for choosing the right enforcement level per behavior criticality.

### 3. TRIGGER/ACTION/EXAMPLE is the best text-based pattern we've found
75% is a substantial improvement over generic text rules (0%) and urgency framing (~33%, per H-091). For non-critical behaviors where programmatic enforcement is too costly, this pattern is the recommended approach.

## Actionable

- Use TRIGGER/ACTION/EXAMPLE skill files for medium-criticality behaviors where 75% adoption is acceptable
- For high-criticality behaviors (persistent-task, security checks), implement programmatic injection per EXP-186 design
- Update skill file authoring guidelines to mandate TRIGGER/ACTION/EXAMPLE format

## Open Questions

- Would additional treatment trials narrow the confidence interval? (N=4 is small)
- Does the 75% rate hold across different agents and scenario types?
- Can the pattern be enhanced (e.g., adding a VERIFY step) to push closer to 80%?
