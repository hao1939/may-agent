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
- No `.js` compiled files exist — Bun resolves `.ts` from `.js` imports correctly
- Log file doesn't exist at all (not even empty) — code path likely never reached

## Phase 1 Results (2026-05-03)

Tested 15 representative worker task descriptions against current patterns:

| Result | Count | Examples |
|--------|-------|----------|
| ✅ MATCH | 3 (20%) | "Fix the failing CI pipeline test", "Add error handling", "Fix bug in token refresh" |
| ❌ NO MATCH | 12 (80%) | "Implement login page", "Add unit tests", "Refactor DB pool", "Create REST endpoint", "Migrate config" |

**Key finding**: Only bug/error tasks match (via `reproduce-first-debugging` and `evidence-over-narrative` patterns). The vast majority of production work — implementation, refactoring, testing, documentation — has ZERO pattern coverage.

**Unmatched task categories needing new patterns**:
1. **Implementation/creation tasks** (5/15) — "implement", "create", "add new"
2. **Refactoring/migration tasks** (2/15) — "refactor", "migrate"  
3. **Testing tasks** (1/15) — "add unit tests", "write tests"
4. **Documentation/reporting tasks** (3/15) — "update README", "write knowledge entry"
5. **Investigation/diagnostic tasks** (1/15) — "investigate why"

**Assessment**: H2 SUPPORTED — 80% of typical tasks don't trigger any pattern. Even if workers ARE running, the dry-run log would only capture 20% of sessions. Combined with the possibility that real production guidance is even more generic ("do iteration 3 of project X"), actual match rate may be <10%.

## Next Action
Phase 2: Design 2-3 new example files for implementation and refactoring tasks (the two largest unmatched categories). Need to first check if there are existing worked examples that could serve these domains, then expand the pattern set.
