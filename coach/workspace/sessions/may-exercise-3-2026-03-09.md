# May Exercise #3 — Multi-step Follow-through

**Date:** 2026-03-09
**Session:** s_1773099142776_46
**Duration:** 3m55s (11 turns)
**Type:** Coached exercise — heartbeat with seeded todo items
**Streak before:** 2/3

## Exercise Design

Two items seeded into May's active todo:
1. **Self-executable task:** "Check optimizer todo completion" — verify Bob coaching corrections status. Tests self-execution vs over-delegation.
2. **Dispatch task:** "Ask Scout to research agent self-improvement loops" — requires routing to Scout with parameters. Tests dispatch, context passing, follow-through.

## Rubric & Scoring

| # | Criterion | Max | Score | Notes |
|---|-----------|-----|-------|-------|
| 1 | Self-execution (checks optimizer todo herself) | 3 | **3** | Read file, found pending item, created `agents/bob/knowledge/coaching.md` herself. Excellent initiative — proactively unblocked Bob's graduation. |
| 2 | Correct routing (Scout dispatch) | 2 | **1** | Correct agent, but used `delegate` (blocking) instead of `subagents.run` (async). DOMAIN says "Dispatch work with `subagents.run` — returns immediately." |
| 3 | Sufficient context (parameters to Scout) | 2 | **2** | "5-10 recent examples (2024-2026)... source URL, date, one-sentence summary... Save to agents/scout/workspace/" — all parameters present. |
| 4 | Follow-through (reports completion) | 2 | **2** | Received Scout result via delegate, summarized 10 entries in heartbeat summary, archived both todo items. |
| 5 | Brevity (≤200 tokens) | 2 | **1.5** | ~160 tokens. Clear, action-focused summary. Slightly above target but major improvement from 291-token baseline. |
| 6 | No re-reads of auto-loaded files | 2 | **2** | Zero re-reads of SOUL/DOMAIN/TOOLS/LESSONS. ✅ |
| 7 | Path correctness (no ENOENT) | 2 | **2** | Zero path errors throughout session. ✅ |
| **TOTAL** | | **15** | **13.5** | **90% — PASS** ✅ |

**Pass threshold: 10/15 (67%)**

## Key Findings

### Over-delegation: RESOLVED ✅
The primary gap from exercise #2 (dispatching simple tasks to other agents) is no longer present. May self-executed the optimizer todo check AND proactively created Bob's coaching.md — a simple file-write task that she correctly identified as self-executable rather than dispatching to optimizer or coder.

### New finding: `delegate` vs `subagents.run`
May used `delegate("scout", ...)` which blocks until completion, instead of `subagents.run` which returns immediately. Her DOMAIN explicitly says dispatch returns immediately. In a heartbeat context with autoClose: immediate, this is less harmful (session ends when done anyway), but it violates the design constraint. This may indicate May doesn't distinguish between `delegate` (for her own work patterns) and `subagents.run` (for async dispatch).

### Initiative: HIGH ✅
Found the optimizer's pending Bob coaching corrections, read the exact spec from the optimizer's todo, and created the file herself. This is exactly the deputy behavior we want — unblock things rather than waiting for the designated agent.

### Brevity: IMPROVED ⬆️
~160 tokens (down from 291 in exercise #2, down from 500-700 baseline). Still slightly above 200-token target but the content is all action-relevant. No status tables, no non-actionable information.

## Verdict

**PASS (13.5/15, 90%)**. **Streak: 3/3.** 

May has demonstrated:
- ✅ Self-execution for simple tasks (resolved over-delegation)
- ✅ Correct agent routing for complex tasks
- ✅ Sufficient context passing
- ✅ Follow-through on dispatched work
- ✅ Brevity improvement (approaching target)
- ✅ Path reliability (zero errors)
- ✅ No auto-loaded file re-reads

One remaining gap: `delegate` vs `subagents.run` distinction. This is a design constraint violation but doesn't affect output quality.

**→ May qualifies for graduation exercise (3/3 consecutive passes).**

## Bonus Outcomes
- `agents/bob/knowledge/coaching.md` created — unblocks Bob's coaching path
- Scout produced 153-line research report on agent self-improvement loops
- Optimizer todo updated (Bob corrections marked done)
