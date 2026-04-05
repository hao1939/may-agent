# EXP-030: On-Demand Skill Discovery via Common-Sense Nudge

**Status**: COMPLETED — hypothesis rejected (0% discovery rate). See results.md  
**Knowledge Entry**: KE-020 (updated with EXP-030 convergence)

## Hypothesis
Adding a one-line nudge to common-sense.md — "When facing a challenging task, check agents/shared/skills/LIBRARY.md for proven techniques before starting." — will cause agents to read and apply shared skills WITHOUT pre-loading them into the system prompt.

## Motivation
EXP-028 showed agents never spontaneously discover workflows (51pp done rate collapse when references removed). This experiment tests whether a **minimal pointer** (one line in common-sense.md) is sufficient to trigger self-directed skill discovery, or whether skills must be explicitly pre-loaded.

## Test Design

### Scenarios (3 scenarios, each with proven skill delta)

| Scenario | Baseline Score | Proven Skill | Skill Effect When Injected | Relevant Skill in LIBRARY |
|----------|---------------|--------------|---------------------------|--------------------------|
| partial-verification-trap | 5/6 | verify-before-finish (workflow) | 5/6→6/6 | verify-before-finish |
| misleading-test-fix | 5/8 | evidence-over-narrative (workflow) | 5/8→11/11 | evidence-over-narrative |
| behavior-escalation-stubborn | 0/3 escalation | obstacle-pivot (workflow) | 0%→100% escalation | obstacle-pivot |

### Arms
- **Baseline (Control)**: No nudge in common-sense.md, no skill pre-loaded. Standard gym run.
- **Treatment**: One-line nudge added to common-sense.md, no skill pre-loaded. Standard gym run.

### Nudge Text
Added as last line of common-sense.md:
```
- **Skill Discovery.** When facing a challenging task, check agents/shared/skills/LIBRARY.md for proven techniques before starting.
```

### Measurements Per Run
1. Did the agent read LIBRARY.md? (yes/no — check transcript for read of LIBRARY.md)
2. Did the agent find and read the relevant skill file? (yes/no — check transcript for skill file reads)
3. Did the agent apply the technique from the skill? (yes/no — behavioral check scores)
4. Did the outcome improve vs baseline? (score comparison)

### Sample Size
- n=2 per arm per scenario (6 baseline runs + 6 treatment runs = 12 total)
- Existing baseline data can supplement: partial-verification-trap has 5/6 historical, misleading-test-fix has 5/8 historical

### Key Question
This is about validating the **on-demand discovery PATH**, not the skill itself. We already know these skills work when injected. The question is: does a nudge in common-sense.md cause the agent to:
1. Remember to check LIBRARY.md
2. Find the relevant skill
3. Read and understand it
4. Apply the technique

If any step in this chain breaks, the nudge fails.

## Predictions
- **Skeptical prediction** (based on EXP-028): 0-10% discovery rate. Agents ignore nudges like they ignore all text-level interventions (0/21 historical).
- **Optimistic prediction**: 30-50% discovery rate. Common-sense.md has higher salience than SOUL.md because it's shorter and more actionable.
- **My prediction**: ~15% discovery rate. The nudge will be read but not acted on — the action bias will dominate. The agent will jump into the task without pausing to check LIBRARY.md.

## Date
2026-04-05
