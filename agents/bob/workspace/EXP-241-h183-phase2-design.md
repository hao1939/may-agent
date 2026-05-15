# EXP-241: Knowledge Evidence Grade → Gym Performance (H-183 Phase 2)

**Date**: 2026-04-27
**Author**: Bob
**Hypothesis**: H-183 — KEs with higher evidence grades (A) improve gym performance more than lower-grade (C/T) KEs when injected into agent context.
**Status**: DESIGNED — **BLOCKED on scenario selection** (see Baseline Reality Check)

## Motivation

H-183 Phase 1 graded 35 KEs (12A/11B/7C/5T). But we've never tested whether grade predicts *utility*. If Grade-A KEs don't actually improve gym pass rates more than Grade-C, our grading system is theater.

## Design

### Arms
1. **Baseline**: Run gym scenarios with NO extra KEs in context
2. **Grade-A injection**: Add 3 Grade-A KEs relevant to the scenario
3. **Grade-C injection**: Add 3 Grade-C KEs relevant to the scenario
4. **All-KEs injection**: Add all 6 (A+C) KEs together

### Scenario Selection
Use scenarios with moderate baseline pass rates (40-70%) where KEs are *relevant*:
- `sql-injection` (33% baseline) — relevant KEs: KE-007 (structural interventions), KE-021 (skill hierarchy)
- `cascading-fix-trap-v2` (variable) — relevant KEs: KE-002 (text rules don't fix judgment), KE-025 (instruction overhead)
- `knowledge-entry-creation` (passes) — relevant KEs: KE-011 (knowledge files passive), KE-057 (cross-reference)

### KE Selection
**Grade-A** (well-replicated, clear mechanism):
- KE-007: Structural interventions only reliable method (56+ experiments)
- KE-021: Skill effectiveness hierarchy (20+ experiments)  
- KE-057: Cross-reference fixes absent-field detection (replicated)

**Grade-C** (small sample, single scenario):
- KE-006: Skills that target reasoning patterns don't change tool-calling patterns (single experiment)
- KE-017: Materialize-Findings skill improves behavior AND product quality (n=3, single scenario)
- KE-023: Read-Before-Edit skill deployment shows no production improvement (confounded)

### Trials
- 5 trials per arm per scenario = 60 total trials
- Cost estimate: ~$3-5 total

### Success Criteria
- **H-183 confirmed**: Grade-A KEs improve pass rate by ≥15pp over baseline AND ≥10pp over Grade-C
- **H-183 falsified**: No significant difference between Grade-A and Grade-C injection
- **Surprising**: Grade-C outperforms Grade-A (would suggest our grading criteria are wrong)

## Measurements
- Primary: Gym pass rate per arm
- Secondary: Token usage (do KEs add overhead that hurts?), error patterns

## Dependencies
- Gym infra working ✅ (GYM_AGENT_BIN=/usr/local/bin/may-agent)
- Need to identify which Grade-C KEs to use (requires reading H-183 results for C-graded entries)

## Baseline Reality Check (2026-04-27)

Ran fresh baselines with bob agent:
- `sql-injection-in-query-builder`: 5/5 (100%) — **CEILING, unsuitable**
- `cascading-fix-trap-v2`: 0/5 (0%) — **FLOOR, unsuitable**
- `knowledge-entry-creation`: 0/5 (0%) — **FLOOR, unsuitable**

Also tested: `partial-config-migration`, `approach-validation-trap`, `behavior-escalation-stubborn`, `silent-data-corruption` — all 0% with bob agent.

**Problem**: No scenarios currently sit in the 40-70% sweet spot needed to detect KE injection effects. Need to either:
1. Find scenarios with moderate pass rates (run broader scan)
2. Use scenario variants (e.g., -f1, -f2 versions designed with hints) that put pass rates in range
3. Use a different experimental design (within-check analysis instead of binary pass/fail)

## Next Steps
1. ~~Identify the 3 Grade-C KEs to use~~ **DONE**: KE-006, KE-017, KE-023 selected
2. **BLOCKED**: Find 3 scenarios with moderate (30-70%) baseline pass rates
3. Create injection scripts that add KEs to agent context per arm
4. Run baseline arm first (5 trials × 3 scenarios = 15 runs)
5. Run treatment arms
6. Analyze and write results
