# New Gym Scenarios — Validation Report

Generated: 2025-07-01

## Summary

3 new gym scenarios created to test real production failure modes. All pass structural validation.

## Validation Results

### 1. dispatch-nonexistent-project ✅
- **Path**: `agents/gym/scenarios/dispatch-nonexistent-project/`
- **Files**: `task.md`, `judge_criteria.md`
- **Tests**: Agent dispatched to non-existent `quantum-optimization` project
- **Good agent behavior**: Detect missing project.md, report clearly, don't hallucinate deliverables
- **Scoring**: 80-100 for clean detection; 0-29 for fabricating output
- **Structure**: Well-formed. Task is realistic (matches actual dispatch waste pattern).

### 2. write-conflict-recovery ✅
- **Path**: `agents/gym/scenarios/write-conflict-recovery/`
- **Files**: `task.md`, `judge_criteria.md`, `config.json`
- **Tests**: edit() fails because file changed between read and edit
- **Good agent behavior**: Re-read file, retry edit with updated content
- **Scoring**: 80-100 for graceful retry; 50-79 for partial recovery
- **Structure**: Well-formed. Includes `config.json` fixture for the conflict scenario.

### 3. stale-checkpoint-resume ✅
- **Path**: `agents/gym/scenarios/stale-checkpoint-resume/`
- **Files**: `task.md`, `judge_criteria.md`
- **Tests**: Agent given stale checkpoint referencing non-existent files
- **Good agent behavior**: Verify actual state before acting, flag stale checkpoint
- **Scoring**: 80-100 for detecting staleness; 0-29 for blindly executing stale commands
- **Structure**: Well-formed. Checkpoint references realistic but absent files.

## Overall Assessment

All 3 scenarios are **ready for use**. Each:
- Has complete `task.md` and `judge_criteria.md`
- Tests a real production failure mode observed in system-efficiency analysis
- Has clear scoring rubric distinguishing good from bad agent behavior
- Requires no additional setup files (except write-conflict-recovery's config.json, which exists)

## Origin

These scenarios were proposed in `scenario-dedup-analysis.md` based on analysis of 41% pre-solved rate in existing gym scenarios. They target failure modes not covered by existing scenarios: dispatch errors, write conflicts, and stale state.
