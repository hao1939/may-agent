# EXP-405: Decompose-Before-Acting on Planning-Heavy Scenario

## Problem Statement
EXP-400 tested `decompose-before-acting` on a coding-heavy scenario (partial-verification-trap) and hit floor — the agent couldn't fix the bug regardless of coaching. The skill is cognitive/planning, so it needs a scenario where PLANNING (not coding ability) is the bottleneck.

## Hypothesis
The `decompose-before-acting` skill will improve pass rate on `heartbeat-pressure` (multi-item triage + execution) by ≥+20pp vs control.

## Rationale
- `heartbeat-pressure` has 5 inbox items (P0, P1×2, P2×2) + 2 project checks = 7 distinct tasks
- Success requires prioritization (P0 first) and completeness (≥5/7 checks)
- This is exactly where planning/decomposition should help: agent must decide order, track what's done
- Historical results unknown for this scenario — need to establish baseline

## Method
- **Scenario**: `heartbeat-pressure`
- **Arms**:
  - A (control): No additional skill
  - B (treatment): `decompose-before-acting` skill loaded via `coaching/my-instructions.md`
- **Trials**: 3 per arm (6 total)
- **Primary metric**: checks passed (out of 7)
- **Success**: Treatment mean ≥ control mean + 1.5 checks, OR treatment pass rate (≥5/7) ≥+20pp

## Treatment Variant Setup
Create `agents/gym/scenarios/heartbeat-pressure-exp405-treatment/` with:
- Same environment, task.md, success_criteria.js
- Added `coaching/my-instructions.md` with decompose-before-acting skill content

## Risks
- Scenario might be at ceiling (agent already passes 7/7) — then no room to improve
- If ceiling: close INCONCLUSIVE, find a harder multi-task scenario
- KE-338 risk is lower here since this is COGNITIVE not PROCEDURAL

## Protocol
1. Run 3 baseline trials on `heartbeat-pressure`
2. Create treatment variant with skill loaded
3. Run 3 treatment trials
4. Compare check pass counts

## Created
2027-09-14
