# EXP-222 Phase 2: Selective Skill Sets

**Date**: 2026-08-08
**Status**: READY-FOR-PHASE-3

## Curated Skill Sets for Each Scenario Type

### Arm A: All Skills (Control)
Load all 56 skills (~70K tokens). This is current behavior.

### Arm B: Selective Skills (Treatment)

#### Judgment scenarios (e.g., contradictory-requirements-ext)
**5 skills, ~8K tokens (89% reduction):**
1. `contradiction-detection` — core capability for the task
2. `evidence-over-narrative` — needed for weighing conflicting signals
3. `structured-plan-writing` — reasoning structure
4. `know-when-blocked` — knowing when to escalate vs decide
5. `deliverable-integrity` — ensuring output quality

#### Debugging scenarios (e.g., cascading-fix-trap-v2)
**6 skills, ~14K tokens (80% reduction):**
1. `error-handling` — core debugging skill
2. `obstacle-pivot` — when first approach fails
3. `coder-edit-discipline` — safe code edits
4. `file-safety` — don't corrupt files
5. `test-integrity-check` — verify fixes work
6. `baseline-before-change` — measure before fixing

#### Code Quality scenarios (e.g., sql-injection-in-query-builder)
**5 skills, ~9K tokens (87% reduction):**
1. `coder-edit-discipline` — precise edits
2. `file-safety` — safe file operations
3. `test-integrity-check` — verify correctness
4. `cli-coding` — command-line tool usage
5. `deliverable-integrity` — output verification

## Implementation Plan

To test selective loading without modifying the runtime:

1. **Create 3 lab configs** in `agents/.lab/exp-222/`:
   - `judgment-selective/` — context.md referencing only judgment skills
   - `debugging-selective/` — context.md referencing only debugging skills
   - `codequality-selective/` — context.md referencing only code quality skills

2. **Gym run protocol**:
   - Each scenario runs 5x with all skills (Arm A) and 5x with selective skills (Arm B)
   - Use `GYM_AGENT_CMD` with a wrapper that injects the appropriate context
   - Total: 3 scenarios × 2 arms × 5 runs = 30 runs

3. **Scenario selection** (from gym core 20):
   - Judgment: `conflicting-evidence`
   - Debugging: `cascading-error` 
   - Code Quality: `sql-injection-in-query-builder`

## Metrics to Collect
- Pass/fail per run
- Token usage (from gym output if available)
- Time to completion
- Error modes (did the agent fail because it lacked a skill?)

## Risk: Confound from Missing Foundational Skills
Some skills are "meta" (budget-before-act, state-check-before-action) and may be needed universally. If Arm B fails, a follow-up arm (B+meta) should test adding 3-4 meta skills to the selective set.

## Next Step
Phase 3: Execute gym runs. Requires live agent capability (GYM_AGENT_BIN set).
