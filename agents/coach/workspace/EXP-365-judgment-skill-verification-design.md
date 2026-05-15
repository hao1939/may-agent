# EXP-365: Judgment Skill Verification & Expansion

## Status: DESIGNED — Ready for gym execution

## Problem
EXP-345 deployed `requirement-conflict-check` skill to bob and coder (directional positive: 67% vs 0% baseline). However:
1. Sample was tiny (3 runs per arm)
2. Never verified in production
3. Multiple judgment scenarios exist (`cascade-judgment`, `escalation-judgment-*`, `conflicting-evidence`) — skill may generalize

## Hypothesis
The `requirement-conflict-check` skill improves pass rates on judgment-class scenarios by ≥20pp compared to no-skill baseline.

## Design

### Phase 1: Replication (5 trials each arm)
- **Scenario**: `conflicting-requirements-tradeoff`
- **Baseline**: No skill loaded (standard agent)
- **Treatment**: `requirement-conflict-check` skill via coaching/my-instructions.md
- **Trials**: 5 per arm (up from 3 in EXP-345)
- **Success**: Treatment ≥ baseline + 20pp

### Phase 2: Generalization (3 trials each arm)
- **Scenarios**: `cascade-judgment`, `conflicting-evidence`
- **Same arms as Phase 1**
- **Success**: Treatment ≥ baseline + 10pp on at least 1 additional scenario

### Phase 3: Durability check
- Read recent bob/coder sessions for evidence of conflict-detection behavior
- If found: skill is durable. If not: skill needs reinforcement.

## Execution Commands
```bash
cd /app/agents
export GYM_AGENT_BIN=/usr/local/bin/may-agent

# Phase 1 baseline
bash test/gym/run-gym.sh conflicting-requirements-tradeoff --timeout 10

# Phase 1 treatment (with skill loaded)
bash test/gym/run-gym.sh conflicting-requirements-tradeoff --timeout 10 --instructions agents/skills/requirement-conflict-check.md
```

## Success Criteria
- ≥5 baseline + 5 treatment runs complete
- Treatment pass rate ≥ baseline + 20pp on primary scenario
- Generalization: ≥1 additional scenario shows improvement

## Predecessor
- EXP-345 (POSITIVE, directional, N=3)

## Expected Output
- `EXP-365-phase1-results.md` with pass rates and confidence
- Decision: promote skill system-wide or limit to current deployment
