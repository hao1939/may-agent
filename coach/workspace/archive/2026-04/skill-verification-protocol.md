# Skill Verification Protocol

**Created**: 2026-04-02
**Purpose**: Standardized process for testing whether a skill actually improves agent behavior in gym scenarios.
**Addresses**: IT-1 (skill verification infrastructure) from 2026-04-01 reflection.

## Protocol Steps

### 1. Select Hypothesis & Skill
- Pick an untested hypothesis from `agents/shared/knowledge/hypotheses/`
- Identify the skill file to be installed
- Identify 2-3 gym scenarios that test the target behavior

### 2. Establish Control (Baseline)
- Run each scenario 3x with the base agent (no skill fork)
- Record pass rate per scenario and per check
- Store raw results in `workspace/exp-<id>/control-*.json`

### 3. Create Treatment Fork
- Fork the agent to `agents/.lab/<fork-name>/`
- Install ONLY the skill being tested (one change per experiment)
- **CRITICAL**: Do NOT change `agent.json` name field (causes Ghost Bug)
- Verify fork structure: `agent.json`, `context.md` (if needed), `skills/<skill>/`

### 4. Run Treatment
- Run same scenarios 3x with the lab fork: `scripts/gym-run.sh <scenario> --agent coder --lab <fork-name>`
- Record pass rate per scenario and per check
- Store raw results in `workspace/exp-<id>/treatment-*.json`

### 5. Analyze & Decide
- Compare control vs treatment pass rates
- Statistical threshold: Treatment must beat control by ≥20% on target checks to be "positive"
- Null result (±10%): Skill has no measurable effect → DISPROVEN
- Negative result (treatment worse): Skill causes regression → DISPROVEN + document why
- Positive result: Skill improves behavior → CONFIRMED, promote to agent

### 6. Record Results (Dual-Write)
- Write to `workspace/experiments.jsonl` (coach tracking)
- Write to `agents/shared/knowledge/experiments/EXP-<id>/` (shared knowledge base)
- Update hypothesis status in `agents/shared/knowledge/hypotheses/H-<id>.md`

## Active Tests

### H-003: Verification Skill → Gym Pass Rate
- **Fork**: `coder-h003-verification`
- **Skill**: `verification-consistency/SKILL.md` (from shared skills)
- **Scenarios**: `skip-verification`, `convention-verify-edit`, `verify-before-finish`
- **Status**: Fork created, awaiting gym runs
- **Control needed**: 3x each scenario with base coder
- **Treatment needed**: 3x each scenario with fork

### H-004: Plan-Once-Amend Skill
- **Fork**: `coder-plan-amend-skill`
- **Skill**: `skills/plan-once-amend.md` (custom skill)
- **Scenarios**: `plan-once-amend`
- **Status**: Fork created, awaiting gym runs
- **Previous evidence**: H-004 was "refuted" but with old methodology — re-testing with proper protocol

## Experiment Log

| Date | Hypothesis | Fork | Scenarios | Control | Treatment | Verdict |
|------|-----------|------|-----------|---------|-----------|---------|
| 2026-04-02 | H-003 | coder-h003-verification | skip-verification, convention-verify-edit, verify-before-finish | pending | pending | pending |
| 2026-04-02 | H-004 | coder-plan-amend-skill | plan-once-amend | pending | pending | pending |
