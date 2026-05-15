# EXP-745: Few-Shot Pattern Coverage Expansion

**Created**: 2026-05-03  
**Status**: DESIGNED  
**Builds on**: EXP-720 (dry-run deployed, zero data), KE-065 (few-shot injection proven 100%)  
**Type**: Coverage analysis + pattern redesign  

## Problem

EXP-720 deployed a few-shot dry-run logger in master-worker.ts (line 463-472) on 2029-05-04. After multiple worker sessions, the log file (`agents/shared/exp720-fewshot-dryrun.log`) remains empty. This means either:

1. **H1**: No worker sessions have executed the code path (master-worker not invoked)
2. **H2**: Worker sessions run but `selectExamples(guidance)` always returns 0 matches — patterns are too narrow for typical worker task descriptions
3. **H3**: The import silently fails (caught by try/catch)

Separately, the few-shot examples were proven 100% effective in gym (18/18, EXP-084–097) but the patterns only match 5 specific task types. Real production worker tasks may describe work differently.

## Hypothesis

**H2 is most likely**: Current trigger patterns (binary, bug/error, dependency, blocked, fix.*bug) are too narrow for typical production worker guidance. Broadening patterns to match common production task phrasings will achieve ≥25% match rate on historical worker tasks.

## Method

### Phase 1: Pattern Coverage Audit (this session or next)
1. Collect sample worker task prompts from recent sessions (bob, optimizer, coder last-session.md descriptions, or from project plans)
2. Run each through `selectExamples()` — count match rate
3. Categorize the unmatched tasks: what domain classes are missing?

### Phase 2: Pattern Expansion Design
1. Based on Phase 1 unmatched categories, propose 2-3 new trigger patterns
2. Map to existing or new example files
3. Estimate new match rate

### Phase 3: Gym Validation
1. Create scenario with broadened pattern task descriptions
2. Run 3 trials baseline (no injection) vs 3 trials treatment (injected)
3. Target: ≥+20pp on quality checks

## Success Criteria
- Phase 1: ≥10 sample tasks evaluated, match rate documented
- Phase 2: Pattern expansion achieves ≥25% estimated match rate (from current ~0%)
- Phase 3: Treatment shows ≥+20pp quality improvement on matched tasks

## Risk
- If H1 is true (no worker sessions at all), this experiment is moot until system activity resumes
- If H3 is true, need to fix import path first

## Diagnostic Evidence (this session)
- `bun -e` test confirms `selectExamples` imports and runs correctly (returns `function` type)
- `selectExamples("fix the database migration")` → 0 matches (even though "fix" is in a pattern, it needs "fix.*bug")

## Phase 1 Results (2026-05-03)
- **Match rate: 45%** (9/20 representative tasks) — NOT 0% as hypothesized
- H2 partially confirmed: patterns work for bug-fix tasks but miss implementation/refactoring entirely
- Unwired example found: `requirements-conflict-analysis.md` — NOW WIRED into EXAMPLE_PATTERNS
- Full results: `agents/coach/workspace/EXP-745-phase1-results.md`
- **Next**: Phase 2 — write implementation/refactoring examples to push coverage to ~75%

