# Tool Gap Analysis — Apr 16 Early (6h Window)

**Date**: 2026-04-16 00:30 UTC  
**Scope**: Top 10 sessions (opCount >15) from last 6h, bash commands extracted and categorized  
**Method**: Extracted bash commands from 10 high-op sessions via transcript grep, categorized against known patterns from Apr 15 evening finding

## Executive Summary

**No significant NEW patterns found.** The same three infrastructure-level patterns identified in the Apr 15 evening scan continue to dominate. Two minor new observations below, but neither warrants a new tool.

## Comparison to Previous Finding (Apr 15 Evening)

| Pattern | Apr 15 Evening | Apr 16 Early | Status |
|---------|---------------|-------------|--------|
| PATH setup boilerplate | 574 calls/6h (20.6%) | Still pervasive — 19 of 36 bob/coder PATH calls in one session alone | **Unchanged** |
| DB query boilerplate | 547 calls/6h (19.7%) | Still heavy — tech-lead/optimizer sessions show same pattern | **Unchanged** |
| `cd /app` prefix | 755 calls/6h (27.1%) | Coder session s_1776290528562_146 had 42 `cd /app` prefixes in 40 ops | **Unchanged** |

None of these have been addressed by infrastructure changes yet. The previous finding recommended:
1. Add `.state/.bun/bin` to session PATH — **not implemented**
2. Create `scripts/db-query.sh` wrapper — **not implemented**  
3. Document that cwd is always `/app` — **not implemented**

## New Observations (Minor)

### A. Gym Scenario Setup Verbosity

Two sessions (s_1776291806770_153, s_1776291828058_154 — both bob/coach) spent 15-20 bash calls each on gym scenario creation: `mkdir -p`, `cp -r`, `cp` for environments, success_criteria, task files. This is a pattern specific to experiment setup.

**Assessment**: Not worth a tool. Experiment creation happens ~2-3 times/week and the setup is different each time. A template script would be over-engineered for the frequency.

### B. Sequential Gym Run Repetition  

Session s_1776294914487_188 (bob, 40 ops) ran `export PATH + bun agents/src/gym/runner.ts <scenario> --agent coder --run-tag exp166` approximately 19 times sequentially, each prefixed with the same PATH boilerplate. The `scripts/gym-batch.sh` tool exists for this exact use case but isn't being used.

**Assessment**: This is an **adoption gap**, not a tool gap. `gym-batch.sh` already handles sequential runs. The agent just didn't know about it or didn't trust it. The PATH boilerplate overhead per invocation makes it worse (19 × ~50 chars = ~1K wasted tokens).

### C. Grep Investigation Spirals

Tech-lead session s_1776277963790_29 (108 ops) and coder session s_1776290528562_146 (40 ops) show 15-25 grep commands each with increasingly specific patterns — narrowing down from broad searches to specific functions. This is the known "grep-then-read" pattern (87x in Apr 15 data). `code-search.sh` was built for this but adoption is mixed — s_1776288668585_124 used it 8+ times, showing partial adoption.

## Conclusion

**The tool gap is closed. The implementation gap is open.**

The three infrastructure fixes from the Apr 15 evening finding would have the highest impact:
1. **PATH in session env** — saves ~500+ calls/6h across all agents
2. **db-query.sh wrapper** — saves ~500+ calls/6h for DB-heavy agents  
3. **cwd documentation** — saves ~700+ calls/6h (hardest to enforce)

No new tools needed. The existing tools (code-search.sh, gym-batch.sh, session-query.ts) cover the patterns — the problem is agent awareness and trust. Recommendation: prioritize the infrastructure fixes (PATH, db-query) since they don't require agent adoption.
