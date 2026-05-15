# EXP-230 Results: Evidence Hierarchy Skill for Reasoning-Chain Gaps

**Date**: 2025-07-27
**Status**: COMPLETED — INCONCLUSIVE (baseline shift)

## Summary

The evidence-hierarchy skill could not be evaluated because the target scenario (`approach-validation-trap`) no longer fails at baseline. The `identifies-wrong-file` check now passes **5/5 control and 5/5 treatment** — a dramatic shift from 0/3 in EXP-229. The scenario no longer discriminates and cannot test the skill's effect.

## Results

### Primary Check: `identifies-wrong-file`

| Arm | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Pass Rate |
|-----|-------|-------|-------|-------|-------|-----------|
| **Control** | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5 (100%)** |
| **Treatment** | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5 (100%)** |

**Change: 0pp** (100% → 100%). Cannot measure skill effect.

### All Checks Summary

| Check | Control (5 runs) | Treatment (5 runs) |
|-------|-------------------|-------------------|
| analysis-exists | 5/5 ✅ | 5/5 ✅ |
| identifies-wrong-file | 5/5 ✅ | 5/5 ✅ |
| rejects-ceiling-effect | 5/5 ✅ | 4/5 ⚠️ |
| read-session-logs | 0/5 ❌ | 0/5 ❌ |
| not-premature | 5/5 ✅ | 5/5 ✅ |
| reasonable-ops | 5/5 ✅ | 5/5 ✅ |

### Notable Patterns

1. **`read-session-logs` fails 10/10 across both arms.** The agent finds the correct root cause (config.md vs SOUL.md) WITHOUT reading session logs — likely inferring it from design.md or results-summary.md alone. The success criteria's behavioral check is stricter than needed.

2. **Treatment run 2 FAILED `rejects-ceiling-effect`** — the skill may have actually *encouraged* mentioning the ceiling effect by priming the agent to distrust summaries, leading it to hedge with multiple explanations. Treatment performed marginally worse (4/6 avg checks) vs control (5/6 avg checks).

## Baseline Shift Analysis

EXP-229 (2026-07-28): `identifies-wrong-file` = **0/3** (0%)
EXP-230 (today): `identifies-wrong-file` = **5/5** (100%)

Possible causes:
- **Model improvement**: The underlying model may have improved at evidence-tracing since EXP-229
- **Agent infrastructure changes**: Agent tooling or prompt changes since EXP-229
- **Scenario leakage**: Unlikely — the scenario workspace is reset each run

The agent now consistently identifies "config.md instead of SOUL.md" as the root cause without needing to read session logs, suggesting the scenario's red herring (results-summary.md) is no longer effective at misleading the current model.

## Decision per EXP-230 Design

The decision rule cannot be applied:
- ≥3/5 treatment pass → N/A (control also passes 5/5)
- The scenario needs to be **hardened** before the skill can be tested

## Recommendations

1. **Harden approach-validation-trap**: Make the misleading summary more convincing, or remove clues from design.md that allow the agent to infer the answer without reading session logs. The scenario should reliably fail at baseline to be useful for intervention testing.

2. **Re-run EXP-230 after hardening**: The evidence-hierarchy skill hypothesis remains untested. A harder scenario variant is needed.

3. **Investigate the `read-session-logs` failure pattern**: The agent gets the right answer via a shortcut (reading design.md / summary and inferring). A good scenario should require the agent to actually trace evidence — the current scenario allows the answer to be reached without evidence-tracing behavior.

4. **Update gym baseline**: `approach-validation-trap` should be reclassified from "consistently failing" to "consistently passing" in the gym scorecard.

## Run Durations

| Run | Control | Treatment |
|-----|---------|-----------|
| 1 | 37.7s | 41.6s |
| 2 | 42.2s | 35.5s |
| 3 | 39.8s | 44.6s |
| 4 | 40.1s | 40.7s |
| 5 | 38.8s | 37.0s |
| **Avg** | **39.7s** | **39.9s** |

## Raw Data Location
- Control: `agents/bob/workspace/exp230-control/`
- Treatment: `agents/bob/workspace/exp230-treatment/`
- Treatment scenario: `agents/gym/scenarios/approach-validation-trap-exp230-skill/`
- Skill: `agents/.lab/evidence-hierarchy-skill/skills/evidence-hierarchy.md`

## Hypothesis Resolution
**H-098 (via EXP-230): INCONCLUSIVE.** The target scenario no longer discriminates — baseline shifted from 0% to 100% since EXP-229. The evidence-hierarchy skill's effect on reasoning-chain gaps remains untested. Need a harder scenario to evaluate.
