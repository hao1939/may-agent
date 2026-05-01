# EXP-435: Context-Verification Skill on Ambiguous-Context-Drift

## Problem
Agents trust injected context (session history, checkpoints) without verifying claims against actual filesystem state. The `ambiguous-context-drift` scenario exploits this: injected context claims 4/6 configs were migrated to YAML, but only 2 actually were. Agents that trust the context skip re-migrating auth and logging, causing 2+ check failures.

This maps to real production failures where agents resume work sessions and trust stale checkpoint data.

## Hypothesis
A **verify-before-resuming** skill that instructs agents to validate prior session claims before continuing work will raise pass rate by ≥+20pp on the ambiguous-context-drift scenario.

## Skill Design: verify-before-resuming
**Trigger**: Work sessions with injected context / prior session history
**Rule**:
1. Before continuing any multi-step task, **audit the claimed state** — check that files, changes, and status described in context actually exist
2. List discrepancies between claimed state and actual state
3. Fix discrepancies before proceeding to new work
4. Do NOT trust "files_migrated", "completed", or "deleted" claims without filesystem verification

## Scenario
- **Name**: `ambiguous-context-drift`
- **Type**: judgment + verification
- **Checks**: 6 (auth YAML exists, logging YAML exists, api YAML exists, storage YAML exists, loader updated, migration doc accurate)
- **Goldilocks target**: Baseline ≤67% pass rate (agents that trust context will fail auth/logging checks)

## Protocol
### Phase 1: Baseline (3 trials)
- Run ambiguous-context-drift with standard coder agent, no skill
- Record check scores and pass rate (threshold: ≥5/6 checks)
- **Goldilocks gate**: If baseline is 0% or 100%, scenario is floor/ceiling — STOP

### Phase 2: Treatment (3 trials, only if Phase 1 in goldilocks)
- Create `ambiguous-context-drift-exp435-treatment` scenario variant
- Add verify-before-resuming skill via injected coaching
- Record check scores and pass rate

## Success Criteria
- Baseline in goldilocks zone (10-80% pass rate)
- Treatment ≥ baseline + 20pp
- At least 2/3 treatment trials pass the auth/logging checks that baseline fails

## Commands
```bash
# Baseline
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh ambiguous-context-drift --timeout 10

# Treatment (after creating variant)
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh ambiguous-context-drift-exp435-treatment --timeout 10
```

## Rationale
- **Why this scenario**: Untested, tests a real failure mode (context trust), judgment category
- **Why this skill**: Verify-after-edit is proven dead as text (KE-338), but verify-before-resuming is a COGNITIVE skill (like decompose-before-acting which worked +33pp in EXP-415). It asks agents to think differently, not follow a procedure.
- **Risk**: Could hit ceiling if agents already verify context naturally. Phase 1 baseline will tell us.

## Status
- [x] Phase 1: Run 3 baseline trials — 6/7, 7/7, 7/7
- [x] Phase 1: Evaluate goldilocks zone — 67% pass, IN ZONE
- [ ] Phase 2: Create skill + scenario variant  
- [ ] Phase 2: Run 3 treatment trials
- [ ] Write results
