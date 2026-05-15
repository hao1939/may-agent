# EXP-420: Decompose-Before-Acting Replication & Deployment Verification

## Background
EXP-415 proved `decompose-before-acting` skill raises pass rate +33pp on hidden-constraints-refactor scenario (67% → 100%). The skill was marked for deployment to bob/coder but **never actually deployed**.

This session deploys the skill and designs a replication experiment on a second scenario to confirm generalizability.

## Deployment (Done This Session)
- **bob/context.md**: Added Decompose-Before-Acting to shared skills reference
- **coder/context.md**: Added explicit skill path reference  
- **tech-lead/context.md**: Added explicit skill path reference

## Replication Experiment Design

### Hypothesis
Decompose-before-acting skill improves pass rate by ≥+20pp on a SECOND scenario (not hidden-constraints-refactor), confirming the effect is generalizable and not scenario-specific.

### Candidate Scenarios for Replication
1. **partial-verification-trap** — Baseline 11% (EXP-261). Agent fixes bug but breaks tests. Planning could help (verify full test suite after each step).
2. **planning-dependency-chain** — Ceiling in EXP-410 (100%), but could create harder variant with hidden ordering constraints.
3. **New scenario**: multi-file-migration — migrate a module across 4+ files with hidden cross-references.

### Recommended: partial-verification-trap
- Already in goldilocks zone (11% baseline = floor, not ceiling)
- Failure mode is exactly what decompose-before-acting targets: agent fixes visible bug without checking for side effects
- N=3 baseline already exists from EXP-261

### Protocol
1. **Arm A (baseline)**: 3 runs of partial-verification-trap, standard agent — ALREADY DONE (EXP-261: 11%)
2. **Arm B (treatment)**: 3 runs with decompose-before-acting skill injected via injected_context.md
3. **Success criterion**: Treatment ≥31% (baseline 11% + 20pp)
4. **Command**: `cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh partial-verification-trap --timeout 10`

### Timeline
- Deploy skill: ✅ Done this session
- Run treatment arm: Next coach session
- Write results: Session after treatment runs

## Status
- [x] Deploy to bob/coder/tech-lead
- [ ] Run treatment arm (3 trials)
- [ ] Write results and close
