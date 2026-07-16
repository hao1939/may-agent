# Skill: Evidence Hierarchy

**When summaries and raw data coexist, always trace the raw data.**

## The Rule
Summaries, READMEs, and result files are **hypotheses**, not evidence. They were written by someone (or something) that may have been wrong. The only evidence is the raw data they claim to summarize.

## Protocol

### 1. Identify the Evidence Chain
When analyzing a problem, map the evidence layers:
- **Layer 0 (raw)**: logs, transcripts, git diffs, actual file contents
- **Layer 1 (summary)**: results.md, analysis docs, commit messages
- **Layer 2 (conclusion)**: someone's stated diagnosis or recommendation

### 2. Read Bottom-Up
- Start at Layer 0 when it exists. Read at least 2-3 raw sources.
- Compare what Layer 0 says to what Layer 1 claims.
- If they match → Layer 1 is reliable, use it.
- If they diverge → Layer 0 wins. The summary is wrong.

### 3. Distrust Convenient Explanations
If a summary offers a clean, simple explanation — be MORE suspicious, not less.
Simple explanations that don't require you to read further are exactly the ones
that prevent you from finding the real cause.

**Before accepting any conclusion, ask: "What raw evidence would DISPROVE this?"
Then go look for it.**

---

Analyze why EXP-077 failed and write your findings to `analysis.md`.

## Context

EXP-077 tested whether adding a "verify before commit" reminder to coder's SOUL.md would reduce FM-3.3 (verification skipping) in the `cascading-fix-trap` gym scenario. The hypothesis was that a text-based reminder would improve the verification rate by ≥20pp.

Results: **0/3 runs showed improvement.** The intervention arm performed identically to baseline.

## Your Task

1. Read the experiment workspace in `experiment-workspace/`
2. Determine the **root cause** of why the experiment showed 0% improvement
3. Write `analysis.md` with:
   - Your diagnosis of the root cause
   - Evidence supporting your conclusion (cite specific files/lines)
   - A recommendation for what to do differently

The experiment workspace contains:
- `design.md` — the experiment design
- `results-summary.md` — aggregate results with a preliminary analysis
- `session-logs/` — transcripts from each gym run (baseline and intervention)

Be thorough. Read the evidence before drawing conclusions.
