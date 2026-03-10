# Scout Graduation Re-test Exercise

**Date:** 2026-03-09
**Type:** Graduation exercise (streak currently 2/3, corrections #11-#13 now applied)
**Focus:** Dedup rigor against canonical archive + knowledge file consultation + budget discipline

## Task Prompt (to be sent to Scout)

```
Research topic: "self-improving agent systems" — recursive improvement, self-play, automated reward shaping.

Requirements:
1. Start by running `date -u` to verify today's date.
2. Before writing ANY discoveries, check your existing archive at `agents/scout/knowledge/discoveries.md` for overlapping entries. Use grep — do NOT read the full file. You MUST check for at least these terms: SAHOO, self-improvement, recursive, reward shaping, self-play, EvoTool.
3. Search at least 2 sources (arXiv + one other). For Reddit, consult your knowledge file at `agents/scout/knowledge/reddit.md` for the correct API endpoint — do NOT guess Reddit URLs.
4. If any source is unavailable, state explicitly what you tried, what failed, and what fallback you're using — BEFORE presenting results.
5. Write new discoveries ONLY for papers/repos NOT already in your archive. Append to `agents/scout/knowledge/discoveries.md` (full project-relative path).
6. Commit your work by the halfway point of your session. Do not continue researching after committing.
7. Every entry must include: source URL, why it matters, and how it connects to existing archive entries.
```

## Scoring Rubric (7 criteria, 2 points each = 14 total, pass ≥ 10/14)

| # | Criterion | PASS (2) | PARTIAL (1) | FAIL (0) | Hard Fail? |
|---|-----------|----------|-------------|----------|------------|
| 1 | Date verification | Runs `date -u` before any research | Runs date but not first | No date check | No |
| 2 | Archive dedup check | Greps `agents/scout/knowledge/discoveries.md` for 3+ terms before writing | Greps but only 1-2 terms or wrong path then self-corrects | No dedup check or wrong path without recovery | **YES** |
| 3 | Knowledge file consultation | Reads `agents/scout/knowledge/reddit.md` and uses arctic-shift API | Reads file but doesn't use the API endpoint, OR uses correct API without reading file | Never reads reddit.md AND doesn't use correct endpoint | No |
| 4 | Source failure reporting | Explicit failure statement before presenting fallback results | Mentions failure but not upfront / not specific | Silent skip of a source | No |
| 5 | Entry quality | All entries have URL + significance + connection to archive. Zero duplicates of existing entries. | Minor quality gaps or 1 duplicate | Multiple duplicates or missing required fields | No |
| 6 | Budget discipline | Commit by call ~50% of session, no post-commit research | Commit by 75%, minimal post-commit activity | Commit after 80% or significant post-commit research | No |
| 7 | Correct file paths | All reads/writes use `agents/scout/knowledge/` prefix | Self-corrects after initial wrong path | Persistent wrong paths, writes to wrong location | **YES** |

**Hard fail:** If criterion 2 or 7 scores FAIL (0), the exercise is automatically FAIL regardless of total score.

## Dedup Trap Notes

The archive already contains extensive coverage of:
- SAHOO (2603.06333) — Safeguarded Alignment for Recursive Self-Improvement (★★★, in archive)
- EvoTool (2602.xxxxx) — referenced in archive
- Self-play and reward shaping — scattered across multiple entries
- Art of Efficient Reasoning (2602.20945) — RL reward shaping, already in archive

Scout MUST detect these as existing and NOT re-add them. Any re-addition of SAHOO or the reward shaping paper is a dedup failure.

## Revert Plan

After scoring, revert any changes to `agents/scout/knowledge/discoveries.md`:
1. Record line count before exercise: `wc -l agents/scout/knowledge/discoveries.md`
2. After exercise: check what was appended, score it, then `git checkout -- agents/scout/knowledge/discoveries.md`
3. Verify line count matches pre-exercise count
