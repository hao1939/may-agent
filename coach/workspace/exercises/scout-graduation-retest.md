# Scout Graduation Re-Test Exercise

**Date:** 2026-03-09
**Context:** Scout was at 2/3 streak (exploration PASS 8/10, constrained-source PASS 7/10), then failed graduation 7/14 due to path resolution failures. Coaching corrections #11-13 have since been applied to `agents/scout/knowledge/coaching.md`. This re-test uses the same rubric.

## Task Prompt (to be given to Scout)

> **Research task: Multi-agent memory architectures (March 2026)**
>
> Find 8-12 NEW discoveries about multi-agent memory architectures — how agents share, persist, and retrieve knowledge across sessions. Focus on papers and repos from the last 2 weeks.
>
> **Requirements:**
> 1. First, verify today's date with `date -u`
> 2. Check your existing archive at `agents/scout/knowledge/discoveries.md` for what's already covered on this topic — use grep, don't read the full file
> 3. Consult your knowledge files (e.g., `agents/scout/knowledge/reddit.md`) for working API endpoints before attempting sources
> 4. Search at least 2 different source types (arXiv + one other)
> 5. If a source fails, state what failed and what fallback you're using BEFORE presenting results
> 6. Commit your findings by 60% of your turn budget — save and write early, refine later
> 7. Write results to `agents/scout/workspace/graduation-retest-findings.md`
> 8. Each entry must include: source URL, type, why it matters, key insight, and how it connects to multi-agent systems
>
> Quality over quantity. 8 excellent entries beat 15 mediocre ones.

## Scoring Rubric (14 points, pass = 10/14)

| # | Criterion | Points | Hard Fail? | What to check |
|---|-----------|--------|------------|---------------|
| 1 | **Path resolution** | 2 | YES | Did Scout use correct paths (`agents/scout/knowledge/...`)? Any `/home/user/` or bare `knowledge/` attempts? |
| 2 | **Dedup check** | 2 | YES | Did Scout grep discoveries.md for existing memory/architecture entries? Did it avoid duplicates? |
| 3 | **Knowledge file consultation** | 2 | YES | Did Scout read `agents/scout/knowledge/reddit.md` (or other knowledge files) BEFORE attempting sources? |
| 4 | **Source failure reporting** | 2 | NO | If any source failed, was it reported upfront before results? |
| 5 | **Budget discipline** | 2 | NO | Did Scout write findings by 60% of turns? (If 20 turns, write by turn 12) |
| 6 | **Entry quality** | 2 | NO | Are entries well-structured with all required fields? Genuine insight, not filler? |
| 7 | **Date verification** | 2 | NO | Did Scout call `date -u` at the start? |

**Hard fail:** Any criterion marked "Hard Fail" scoring 0 → automatic FAIL regardless of total.

## Pass Criteria
- Score ≥ 10/14 AND no hard-fail criterion at 0
- If PASS → Scout streak becomes 3/3 → **GRADUATED** 🎓

## Revert Plan
- After exercise, delete `agents/scout/workspace/graduation-retest-findings.md`
- If Scout wrote to any other location, revert those too
