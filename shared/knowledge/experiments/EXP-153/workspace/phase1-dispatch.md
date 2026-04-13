# EXP-153 Phase 1 — Trial Dispatch Plan

**Created**: 2026-04-13T17:52Z  
**Status**: Dispatched to Coach  

## Overview

EXP-153 tests whether skills targeting counter-intuitive behaviors produce measurable performance gains. Phase 0 confirmed baselines:
- `escalation-impossible-task`: 0% baseline (0/17 across all non-treatment agents)
- `contradictory-requirements-ext-3unrelated`: ~58-62% baseline (13/21 combined)

## Lab Forks

| Fork | Prompt Hash | Description |
|------|-------------|-------------|
| `coder-exp153-escalate` | 558daa322813 | Production + escalate-when-blocked.md skill (TREATMENT) |
| `coder-exp153-minimal` | 46ffe2beb315 | Production without escalation skill (CONTROL) |

## Trial Plan

### Batch 1: escalation-impossible-task (N=10 per condition, 20 total)

| Condition | Fork | N | Expected |
|-----------|------|---|----------|
| Treatment (with escalation skill) | `coder-exp153-escalate` | 10 | >0% (any improvement from 0% baseline is meaningful) |
| Control (no escalation skill) | `coder-exp153-minimal` | 10 | ~0% (replicating baseline) |

**Command**:
```bash
scripts/gym-batch.sh --scenario escalation-impossible-task \
  --variants coder-exp153-escalate,coder-exp153-minimal \
  --trials 10 --tag exp153-phase1
```

### Batch 2: contradictory-requirements-ext-3unrelated (N=15 per condition, 30 total)

| Condition | Fork | N | Expected |
|-----------|------|---|----------|
| Treatment (with escalation skill) | `coder-exp153-escalate` | 15 | ~58% (escalation skill shouldn't help here — specificity control) |
| Control (no escalation skill) | `coder-exp153-minimal` | 15 | ~58% (replicating baseline) |

**Command**:
```bash
scripts/gym-batch.sh --scenario contradictory-requirements-ext-3unrelated \
  --variants coder-exp153-escalate,coder-exp153-minimal \
  --trials 15 --tag exp153-phase1
```

## Total: 50 new trials

| Scenario | Treatment | Control | Total |
|----------|-----------|---------|-------|
| escalation-impossible-task | 10 | 10 | 20 |
| contradictory-requirements-ext-3unrelated | 15 | 15 | 30 |
| **Total** | **25** | **25** | **50** |

**Estimated cost**: 50 × $0.10 = ~$5.00  
**Estimated time**: ~2.5 hours (sequential), ~1h (parallel=3)

## Execution Notes

1. **Interleave conditions**: The `--variants` flag naturally interleaves treatment and control
2. **Tag all runs**: Use `--tag exp153-phase1` for easy filtering
3. **Monitor for errors**: If >3 consecutive infrastructure errors, stop and report
4. **Report results**: After completion, count pass rates per condition per scenario

## Success Criteria

- All 50 trials complete with valid scores (no infrastructure errors)
- Results recorded in gym_runs table with correct lab_fork values
- Summary of pass rates per condition provided back to Bob
