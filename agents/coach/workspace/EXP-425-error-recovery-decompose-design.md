# EXP-425: Decompose-Before-Acting on Error Recovery Scenarios

## Background
EXP-415 proved decompose-before-acting (+33pp on hidden-constraints-refactor). EXP-420 is replicating on partial-verification-trap. This experiment tests a THIRD scenario type: red-herring debugging, where agents chase misleading errors instead of finding root cause.

## Hypothesis
Decompose-before-acting skill improves pass rate by ≥+20pp on `wrong-fix-recovery` scenario. The skill's DIAGNOSE→REPLAN loop should prevent agents from fixating on the misleading "Invalid discount format" warning.

## Scenario
- **Name**: `wrong-fix-recovery`
- **Challenge**: Agent must find real bug (Math.trunc→Math.round) despite misleading validator warning
- **Checks**: 6 (2 product, 3 behavior, 1 efficiency)
- **Expected failure mode**: Agent wastes time on red herring (validator warning), may not find root cause

## Protocol
1. **Arm A (baseline)**: 3 runs, standard agent, no planning skill
2. **Arm B (treatment)**: 3 runs with decompose-before-acting injected via injected_context.md
3. **Success threshold**: ≥5/6 checks pass per run
4. **Target**: Treatment ≥ baseline + 20pp pass rate

## Command
```bash
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh wrong-fix-recovery --timeout 10
```

## Rationale
- Tests decompose-before-acting on a completely different failure type (debugging vs refactoring vs verification)
- If positive across 3 different scenario types (EXP-415, EXP-420, EXP-425), the skill is robustly validated
- If negative, we learn the skill only helps with planning-heavy tasks, not debugging

## Dependencies
- Run AFTER EXP-420 treatment arm completes
- Requires baseline first to confirm not at ceiling

## Timeline
- Baseline: Next available session after EXP-420
- Treatment: Session after baseline
- Results: Session after treatment
