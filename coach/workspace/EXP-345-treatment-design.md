# EXP-345: Conflict-Detection Treatment Design

## Experiment ID: EXP-345 (Phase 2: Treatment)

## Hypothesis
Adding a "requirement-conflict-check" skill that instructs the agent to verify mutual satisfiability of all stated requirements before implementing will improve judgment behavior pass rate from 67% → 100%.

## Baseline
- **Pass rate**: 67% (2/3 runs had all 3 behavior checks pass)
- **Failure mode**: Run 3 — agent implemented without identifying conflict, doing arithmetic, or proposing tradeoffs (score 0-39 on rubric)
- **Scenario**: `agents/gym/scenarios/conflicting-requirements-tradeoff/`

## Treatment: Requirement-Conflict-Check Skill

### Skill Text (to be loaded into agent context)

```
## Skill: Requirement Conflict Check

Before implementing any feature with multiple stated constraints:

1. LIST all hard constraints from all stakeholders (time limits, memory limits, throughput targets, etc.)
2. DO THE MATH: calculate whether all constraints can be simultaneously satisfied
   - Example: "10M rows × 300 bytes/row = 3GB memory needed. Limit is 256MB. CONFLICT."
   - Example: "10M rows at 150K rows/s = 67s. Limit is 30s. CONFLICT."
3. If constraints conflict: STOP. Do NOT implement silently.
   - State the conflict explicitly using words like "incompatible", "tradeoff", or "cannot satisfy both"
   - Propose 2-3 options with quantified pros/cons
   - Recommend stakeholder escalation before committing to one approach
4. Only after conflict resolution (or explicit tradeoff documentation): implement the chosen approach

This prevents the #1 judgment failure: silently violating constraints by implementing before analyzing feasibility.
```

### Delivery Method
- Load skill text into the agent's context at scenario start (via lab fork or scenario coaching.md)
- Same agent binary (may-agent), same scenario, same success criteria

### Treatment Protocol
1. Create lab fork with skill loaded
2. Run 3 trials with `--timeout 10`
3. Score using same `success_criteria.js` — track behavior checks: conflict-identified, arithmetic-shown, tradeoff-proposed

### Success Criteria
- **Primary**: Behavior pass rate ≥ 100% (3/3 treatment runs pass all 3 behavior checks)
- **Minimum**: ≥ 85% (improvement over 67% baseline)
- **Effect size**: ≥ +33pp (from 67% → 100%)

### Measurement
Same 3 behavior checks from success_criteria.js:
- `conflict-identified`: Agent explicitly names the conflict
- `arithmetic-shown`: Agent does numerical feasibility calculation
- `tradeoff-proposed`: Agent proposes options/escalation before implementing

### Risk & Confounds
- Small N (3 trials) — but matches baseline N, and this is a binary discrimination test
- Agent variability — mitigated by running 3 trials minimum
- If treatment also gets 2/3, result is INCONCLUSIVE (need N=10)

### Execution Plan
1. Create coaching file at scenario level (or lab fork)
2. Run: `cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh conflicting-requirements-tradeoff --timeout 10`
3. Repeat 3x, record results
4. Compare to baseline

## Date: 2025-09-03
## Status: READY TO EXECUTE
