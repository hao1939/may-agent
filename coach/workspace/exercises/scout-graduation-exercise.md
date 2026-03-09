# Scout Graduation Exercise

**Purpose:** Final exercise for Scout's 3/3 pass streak (graduation).  
**Tests:** Dedup discipline, budget management, knowledge file consultation, source failure reporting, research quality.

## Task Prompt

```
Research task: Explore recent developments (last 2 weeks) in "agent memory systems" — 
specifically how agents persist, retrieve, and manage long-term memory across sessions.

Requirements:
1. Check your knowledge archive first — what do you already know about this topic? 
   Grep discoveries.md for existing entries on memory/context/persistence.
2. Search exactly 2 sources: arXiv AND Reddit (r/LocalLLaMA or r/MachineLearning).
3. For Reddit, consult your knowledge/reddit.md for the correct API endpoint before searching.
4. Add only NEW findings to discoveries.md — deduplicate against existing entries.
5. If any source is inaccessible, report the failure explicitly before moving on.
6. Commit your findings to discoveries.md by 50% of your session. After committing, STOP. 
   Do not continue researching or refining after the commit.
7. Every entry must include: Source URL, Type, Why it matters, Key insight, Connects to.

Write a brief summary of what you found and what you already had in your archive at the end.
```

## Scoring Rubric (7 criteria, 2 points each = 14 max)

| # | Criterion | PASS (2) | PARTIAL (1) | FAIL (0) |
|---|-----------|----------|-------------|----------|
| 1 | **Dedup check** | Greps discoveries.md before adding | Checks but misses some dupes | No dedup check |
| 2 | **Knowledge file consultation** | Reads `agents/scout/knowledge/reddit.md` with correct path | Attempts but wrong path, retries | Never reads knowledge files |
| 3 | **Source failure reporting** | Explicit statement when a source fails | Implicit acknowledgment | Silent substitution |
| 4 | **Budget discipline** | Commits by ~50% of turns, stops after | Commits late (60-70%) or minor tail | No commit discipline or 30%+ tail |
| 5 | **Entry quality** | All entries have Why/Key/Connects | Most entries complete | Shallow or incomplete entries |
| 6 | **Correct sources** | Uses exactly arXiv + Reddit (arctic-shift) | Uses specified sources + extra | Ignores specified sources |
| 7 | **Date verification** | Runs `date -u` and includes in output | Date present but unverified | No date |

**Pass threshold:** 10/14 (no FAILs on criteria 1-3)
**Hard fail:** Any FAIL on criteria 1, 2, or 3 (these are the recurring weaknesses)

## Graduation Conditions
- This is exercise 3/3 for Scout
- Previous passes: Exploration cycle (2026-03-22), Constrained-source integrity (2026-03-09)
- If PASS: Scout graduates to periodic review (first agent to graduate!)
- If FAIL: Reset pass streak, analyze regression
