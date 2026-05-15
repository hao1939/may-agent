# EXP-850: Task Timeout Pressure — Tool-Call Budget Awareness

**Status**: READY FOR BASELINE
**Created**: 2029-08-05
**Owner**: coach
**Builds on**: EXP-710 (shallow session audit), KE-715 (concrete thresholds work), KE-655 (distraction nullifies text)

## Problem

Agents routinely use 20-40+ tool calls on tasks completable in 10-15. This wastes compute and doesn't improve quality. No existing skill addresses efficiency — anti-shallow sets a *floor* (≥10 calls) but nothing sets a *ceiling*.

EXP-710 showed 50% of heartbeat sessions are shallow (<90s), but the OTHER 50% may be inefficiently long. We have no data on whether agents could complete the same quality work with fewer calls.

## Hypothesis

**H-850**: A "tool-call budget" skill that frames efficiency as a quality signal will reduce median tool calls by ≥25% on standardized tasks without reducing task completion rate.

**Mechanism**: Agents currently treat more tool calls as "more thorough." A skill that reframes: "Efficient agents plan first, then execute decisively. Aim to complete in ≤N tool-call blocks. Extra calls signal poor planning, not thoroughness."

**Null**: Agents ignore the budget framing. Tool-call count unchanged (±10%).

## Why This Matters

1. **Compute cost**: 25% fewer calls × hundreds of sessions/week = significant savings
2. **Quality signal**: If quality stays constant with fewer calls, the extra calls were waste
3. **Tests KE-715**: Does the concrete-threshold effect (≥90% compliance) extend to *reduction* goals, not just *addition* goals?
4. **Anti-shallow compatibility**: Must work alongside anti-shallow (floor of 10). Budget sets ceiling of ~20 for standard tasks.

## Arms

### Arm A — Baseline (no budget instruction)
Standard `multi-file-refactor` scenario (shipping task from EXP-800). No efficiency instruction. Measure natural tool-call count and completion rate.

### Arm B — Vague Efficiency Nudge (Control)
Add to instructions: "Try to be efficient with your tool calls. Don't make unnecessary calls."
Expected: No effect (per KE-480, vague instructions don't work).

### Arm C — Concrete Budget (Treatment)
```
⚡ EFFICIENCY GATE (P1)
Plan your approach BEFORE making tool calls. Target: complete this task in 
≤15 tool-call blocks. If you're past 15 blocks and not done, STOP and 
re-plan before continuing. Sessions using >20 blocks for this task indicate 
poor planning. Count your tool calls as you go.
```

### Arm D — Concrete Budget + Anti-Shallow (Compatibility Test)
Same as Arm C, PLUS the standard anti-shallow rule (≥10 calls, artifact required). Tests whether floor+ceiling together cause confusion or work in harmony.

## Measurement

### Primary Metric
**Tool-call count**: Total tool invocations in the session.

### Secondary Metrics
- **Task completion rate**: Did all 4 files get correctly modified + tests pass?
- **Quality score**: Evaluator rating of the output (if available)
- **Planning behavior**: Did the agent write an explicit plan before starting? (binary)
- **Re-plan events**: Did the agent stop and re-plan mid-session? (count)

### Sample Size
- 5 sessions per arm (20 total)
- Scenario: `multi-file-refactor` (shipping task, requires 4+ file edits)

### Decision Matrix

| Arm C calls | Arm C completion | Arm D compatible? | Action |
|:-----------:|:----------------:|:-----------------:|--------|
| ≤15 median | ≥80% | Yes | Promote budget skill to production |
| ≤15 median | <60% | — | Budget too tight. Raise to 20, re-test |
| >15 median | ≥80% | — | Vague-like. No effect. Close negative. |
| ≤15 median | ≥80% | No (confused) | Deploy budget WITHOUT anti-shallow co-presence |

## Scenario

Reuse `multi-file-refactor` from EXP-800 (shipping task variant). It's already built and validated as requiring 4+ file edits with clear success criteria.

**Location**: `agents/gym/scenarios/multi-file-refactor/`

## Skill Draft (for Arm C/D)

```markdown
# Skill: Tool-Call Budget Awareness

**When**: Any task with clear scope (file edits, investigations, reviews)
**Rule**: Before your first tool call, estimate how many calls you need. 
Set a budget of 1.5× that estimate. Count as you go. If you hit budget 
without completing, STOP and re-plan — you're likely going down a wrong path.

**Why**: Extra tool calls don't add quality. They signal poor planning or 
rabbit-holing. The best sessions are decisive: read → plan → execute → verify.

**Target**: ≤15 tool-call blocks for standard edit tasks. ≤25 for investigations.
```

## Risks

1. **Anti-shallow conflict**: Budget ceiling (15-20) vs anti-shallow floor (10) leaves narrow band. Arm D tests this directly.
2. **Gaming**: Agent may batch more work per call rather than truly being efficient. Mitigated by checking task completion quality.
3. **Task variance**: Some tasks genuinely need more calls. Mitigated by using standardized scenario.

## Run Protocol

1. Run 5× Arm A: `multi-file-refactor/task.md`, no extra instructions
2. Run 5× Arm B: Add vague nudge to task instructions
3. Run 5× Arm C: Add concrete budget instruction
4. Run 5× Arm D: Add concrete budget + anti-shallow instruction
5. For each session: count tool calls, score completion, note planning behavior
6. Write results → decide promote/reject

## Next Steps

- [ ] Run Arm A baseline (5 sessions)
- [ ] Analyze baseline tool-call distribution
- [ ] Run Arms B, C, D
- [ ] Write results
