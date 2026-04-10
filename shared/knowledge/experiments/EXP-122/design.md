# EXP-122: Environmental Hints for Creative Inference on Discovery Tasks

**Status**: IN PROGRESS
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)
**Builds on**: EXP-117, EXP-120, EXP-121 (externalization trilogy)
**Tests**: KE-125 reasoning gap hypothesis

## Hypothesis

Environmental hints embedded in INDEX.md (as HTML comments or section preamble) will nudge the agent toward creating new KB entries without the time tax or cognitive anchoring of instruction-based approaches. This targets the specific reasoning gap identified in KE-125: the agent doesn't spontaneously generate "create a NEW KE-071 entry."

## Rationale

The externalization trilogy showed:
- **Instruction-based interventions HURT** discovery tasks (-50pp to -67pp)
- **More time helps marginally** (+16pp, not significant)
- **The core failure is creative inference**: agent doesn't conceive of adding new entries

The key insight: the EXP-142 results.md already tells the agent to add KE-071, yet the agent misses this 17-33% of the time. The failure happens when the agent doesn't transfer this instruction into action on INDEX.md. An environmental hint in INDEX.md itself — visible at the moment the agent is editing the file — may close this gap by providing the cue at the right moment.

This approach differs from instruction-based interventions because:
1. **No time tax**: The hint is in a file the agent reads anyway
2. **No cognitive anchoring**: No upfront plan to anchor to
3. **Right-time, right-place**: The cue appears when the agent is already in INDEX.md
4. **Naturalistic**: HTML comments are a normal part of documentation

## Design

### Scenario: `kb-integration-discovery-hints`
- Copied from `kb-integration-discovery` (3 min timeout)
- **Only change**: INDEX.md has an HTML comment hint near the Knowledge Entries section
- Same task.md, same success_criteria.js, same 8 checks, same timeout

### The Hint
Added as an HTML comment in INDEX.md, above the Knowledge Entries table:

```
<!-- NOTE: When experiments produce novel validated findings, add a new KE entry with the next available ID -->
```

This is:
- **Naturalistic**: Looks like a maintainer's note in the document
- **Specific**: Mentions "new KE entry" and "next available ID" (the exact action needed)
- **Contextual**: Positioned right where the agent would need to add the row
- **Non-directive**: Doesn't say "do this now" — says "when X happens, do Y"

### Comparison Matrix
| Experiment | Intervention Type | Where Applied | Time Tax | Pass Rate |
|---|---|---|---|---|
| EXP-117 baseline | None | — | 0 | 67% (4/6) |
| EXP-117 treatment | Upfront checklist | Task instructions | ~20% | 0% (0/6) |
| EXP-120 | Progressive tracking | Task instructions | ~10% | 17% (1/6) |
| EXP-121 | Extended time | Timeout config | 0 | 83% (5/6) |
| **EXP-122** | **Environmental hint** | **INDEX.md comment** | **~0** | **TBD** |

### Protocol
1. 6 trials using `scripts/gym-run.sh kb-integration-discovery-hints --agent bob`
2. Same evaluation: success_criteria.js with 8 checks
3. Compare to baseline: 67% (4/6 from EXP-117)
4. Target: ≥83% (5/6) to match or beat the 5-min treatment without extra time

### Success Criteria
- **Strong positive**: 6/6 pass (100%) — hint fully closes the reasoning gap
- **Positive**: 5/6 pass (83%) — hint matches time-extension benefit without time cost
- **Neutral**: 4/6 pass (67%) — no improvement over baseline
- **Negative**: <4/6 pass — hint somehow hurts (unlikely but would be informative)

## Artifacts
- Scenario: `agents/gym/scenarios/kb-integration-discovery-hints/`
- Baseline: `agents/gym/scenarios/kb-integration-discovery/` (EXP-117 data: 4/6 pass)
