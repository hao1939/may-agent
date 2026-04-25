# EXP-222 Phase 1: Skill Context Size Audit

**Date**: 2026-04-25
**Status**: COMPLETE

## Total Skill Context Budget

| Category | Est. Tokens | Count |
|---|---|---|
| Shared SKILL.md files (active) | ~53,614 | 38 |
| Shared loose .md skills | ~8,454 | 8 |
| Bob-specific skills | ~7,813 | 10 |
| **Total per-session** | **~69,881** | **56** |

**~70K tokens** of skill context loaded every session, regardless of task.

## Top 10 Skills by Size (shared)

| Skill | Est. Tokens |
|---|---|
| error-handling | 3,620 |
| skill-lifecycle | 2,921 |
| materialize-intermediate-findings | 2,486 |
| request-triage-memoization | 2,425 |
| deliverable-integrity | 2,388 |
| obstacle-pivot | 2,323 |
| budget-before-act | 2,308 |
| state-check-before-action | 2,256 |
| delegation-verification | 2,212 |
| coder-edit-discipline | 2,143 |

Top 10 alone = ~25K tokens (36% of total).

## Skill Categorization by Scenario Relevance

### For Judgment scenarios (contradictory-requirements, etc.)
**Relevant (~5 skills, ~8K tokens):**
- contradiction-detection, evidence-over-narrative, verification, verification-consistency, structured-plan-writing

**Irrelevant (~33 skills, ~45K+ tokens):**
- cli-coding, web-scraping, test-mock-awareness, agent-gym, coder-edit-discipline, delegation-verification, l3-delegation-metrics, etc.

### For Debugging scenarios (cascading-fix-trap, etc.)
**Relevant (~6 skills, ~14K tokens):**
- error-handling, obstacle-pivot, coder-edit-discipline, file-safety, test-integrity-check, baseline-before-change

**Irrelevant (~32 skills, ~39K+ tokens):**
- evaluator-scoring, knowledge-sharing, web-scraping, contradiction-detection, agent-growth, etc.

### For Code Quality scenarios (sql-injection, etc.)
**Relevant (~5 skills, ~9K tokens):**
- coder-edit-discipline, file-safety, verification, test-integrity-check, cli-coding

**Irrelevant (~33 skills, ~44K+ tokens):**
- evaluator-scoring, delegation-verification, knowledge-sharing, agent-growth, materialize-intermediate-findings, etc.

## Key Finding

Selective loading could reduce skill context by **60-85%** (from ~70K to 8-14K tokens). This meets the EXP-222 Phase 2 threshold of ≥50% reduction easily.

## Implications

If H-EXP-022b holds, we'd save ~15%+ of total token usage per session. More importantly, reduced noise may improve task focus (H-EXP-022a).

## Next Step
Phase 2: Create scenario-specific .lab/ configurations with trimmed skill sets, then run gym comparisons.
