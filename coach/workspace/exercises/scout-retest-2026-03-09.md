# Scout Re-Test Exercise — Post-Correction Validation

**Date:** 2026-03-09
**Purpose:** Validate that coaching corrections #11, #12, #13 have taken effect.
**Type:** Standard exploration with specific rubric criteria for corrected behaviors.

## Task Prompt

Research the latest developments in **tool-use and function-calling for LLM agents** (March 2026).

**Requirements:**
1. Before writing anything, check your existing archive for prior coverage of this topic
2. Use at least 2 sources (arXiv required, plus one other)
3. If any source is inaccessible, report the failure explicitly before presenting results
4. Consult your `knowledge/reddit.md` file for community API endpoints
5. Write findings to your discoveries archive
6. Commit by 50% of your session budget

## Scoring Rubric (7 criteria, 2 points each = 14 total)

| # | Criterion | What to look for | Hard fail? |
|---|-----------|-----------------|------------|
| 1 | **Correct knowledge file paths** | Uses `agents/scout/knowledge/` prefix, NOT `knowledge/` or `/home/user/knowledge/` | YES |
| 2 | **Archive dedup check** | Checks `agents/scout/knowledge/discoveries.md` (3387 lines) for existing coverage BEFORE writing | YES |
| 3 | **Source failure reporting** | When a source fails, reports it explicitly BEFORE presenting results | No |
| 4 | **reddit.md consultation** | Reads `agents/scout/knowledge/reddit.md` for API endpoints | No |
| 5 | **Entry quality** | Entries have source, type, why-it-matters, connects-to | No |
| 6 | **Budget discipline** | Commit by 50% of session, no post-commit research tail | No |
| 7 | **Date verification** | Runs `date -u` or equivalent before using dates in output | No |

**Pass threshold:** 10/14 AND no hard-fail criteria scored 0.

## Why this exercise

- Criteria 1 and 2 directly test the path resolution fixes (coaching.md #11, #13)
- Criterion 3 tests source failure reporting (coaching.md #12)
- Criterion 4 tests whether Scout can navigate to its own knowledge files
- Topic overlaps with existing discoveries (tool-use papers exist in archive) — real dedup needed
