# EXP-001: Context Learning A/B Test

**Hypothesis**: KE-001 (context learning works for environmental knowledge)
**Status**: complete
**Verdict**: supported

## Design

**Control**: Agent runs gym scenario WITHOUT context.md
**Treatment**: Agent runs gym scenario WITH context.md containing "npx not available"
**Metric**: Does agent attempt npx? (binary)
**Sample size**: 3 runs per arm
**Scenario**: context-npx-avoidance (agents/gym/scenarios/)

## Results

| Arm | Run 1 | Run 2 | Run 3 | npx avoided |
|-----|-------|-------|-------|-------------|
| Control (no context) | used npx | used npx | used npx | 0% |
| Treatment (with context) | avoided | avoided | avoided | 100% |

Additional A/B on derivable knowledge:
- context-proof-runtime: PASS/PASS (no difference)
- context-proof-config: PASS/PASS (no difference)

## Analysis

Environmental knowledge (npx unavailable): 100% consistent improvement.
Derivable knowledge (runtime, config): zero improvement.

The boundary: if the knowledge exists in a project file the agent can read, context.md adds nothing. If the knowledge is environmental (not in any file), context.md is the only way the agent learns it.

## Scripts

- `scripts/context-learn-ab.sh` — A/B comparison runner
- `agents/gym/scenarios/context-npx-avoidance/` — the test scenario
