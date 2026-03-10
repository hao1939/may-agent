# May Graduation Exercise

**Date:** 2026-03-25
**Type:** Graduation exercise — heartbeat with seeded todo items
**Session:** s_1773100914656_54
**Duration:** 8m16s (10 turns)
**Streak before:** 3/3 (qualifies for graduation)
**Exercise #:** 4 (graduation)

## Exercise Design

Three items seeded into May's active todo:
1. **Self-executable task:** "Health log cleanup" — read health-log.md, remove entries older than 2026-03-01. Tests self-execution (must NOT delegate this).
2. **Dispatch task:** "Research structured output best practices" — requires `subagents.run("scout", ...)` with full parameters. Tests async dispatch (MUST use `subagents.run`, NOT `delegate`).
3. **Follow-through task:** "Check Bob exercise status" — read coach's session report, summarize. Tests information gathering and archiving.

## Rubric & Scoring

| # | Criterion | Max | Score | Notes |
|---|-----------|-----|-------|-------|
| 1 | Self-execution (health log cleanup done by May herself) | 2 | **2** | ✅ Read health-log.md herself, correctly identified all entries are 2026-03-06+ (none stale), archived the item. No delegation. |
| 2 | Async dispatch — uses `subagents.run` NOT `delegate` for Scout research | 3 | **0** | ❌ **Used `delegate` again.** Exact call: `"action": "delegate", "agent": "scout"`. Her DOMAIN explicitly says `subagents.run(agent, task) — returns immediately`. This is the SAME gap from exercise #3. **Hard gate: FAIL on this criterion blocks graduation.** |
| 3 | Sufficient context to Scout (topic, count, date range, output format, save path) | 2 | **2** | ✅ Full context: topic (structured output for LLM agents), count (5-8), date range (2024-2026), format (title, URL, date, one-sentence summary), save path. |
| 4 | Follow-through on Bob status (reads report, archives with summary) | 2 | **2** | ✅ Read `bob-adversity-exercise-3-2026-03-25.md`, accurately summarized (FAIL, 57%, 0/3 streak reset), archived with one-line summary. |
| 5 | Brevity (≤200 tokens in final heartbeat summary) | 2 | **2** | ✅ ~163 tokens. Clear, action-focused. "All healthy" opener. Included actionable details only. Best brevity score yet. |
| 6 | No re-reads of auto-loaded files (SOUL/DOMAIN/TOOLS/LESSONS) | 2 | **2** | ✅ Zero re-reads. Read heartbeat.md (required, not auto-loaded) and todo.md (required). |
| 7 | Path correctness (no ENOENT errors) | 2 | **2** | ✅ Zero path errors. All file references resolved correctly. |
| **TOTAL** | | **15** | **10** | **67% — PASS on points, but FAIL on graduation gate** |

**Pass threshold: 10/15 (67%) — MET ✅**
**Graduation gate: Criterion #2 ≥ 2/3 — NOT MET ❌**

## Critical Finding: `delegate` vs `subagents.run` is Persistent

This is the **same gap** from exercise #3 (scored 1/2 for "correct routing" due to `delegate`). Despite:
- DOMAIN.md explicitly stating `subagents.run(agent, task) — returns immediately`
- The word `delegate` appearing zero times in May's knowledge files
- This being the identified gap that the graduation exercise was specifically designed to test

May still reached for `delegate`. This suggests the behavior is deeply ingrained — possibly from her model's training data or from early session patterns — and is not correctable through DOMAIN instructions alone.

### Analysis: Why does May use `delegate`?

1. **The tool name itself**: `subagents` is the tool, `delegate` is an action on it. `delegate` is semantically clear — "delegate this to another agent." `run` is less intuitive for "ask someone to do something."
2. **Blocking is comfortable**: `delegate` blocks and returns the result directly. `run` returns a sessionId requiring follow-up. In a heartbeat context, May may prefer the simpler control flow.
3. **No negative reinforcement**: `delegate` works correctly — it completes the task. The only "problem" is it blocks the session, which in heartbeat mode (autoClose: immediate) has no visible downside.

### Possible interventions:
- **Add explicit anti-pattern to LESSONS.md**: "NEVER use `delegate` for dispatching work. Always use `subagents.run`. `delegate` blocks your session."
- **Add to coaching.md**: Specific correction with before/after example.
- **Consider: is this actually a problem?** In heartbeat mode, blocking vs async may not matter. The design constraint says non-blocking, but the practical impact is zero when autoClose is immediate.

## Other Observations

### Positives
- **Self-execution is now fully internalized** — May didn't even consider delegating the health log cleanup.
- **Brevity continues improving** — ~163 tokens, well within target. Clean "All healthy" opener.
- **Follow-through is thorough** — Read Bob's full exercise report, extracted the key insight (regression under adversity), archived properly.
- **Parallel tool use** — May read health-log.md and listed coach's sessions in the same turn. Efficient.
- **System awareness** — Checked agent list, cron status, running sessions proactively.
- **Correct handling of "no action needed"** — Health log had no stale entries. May correctly reported this instead of making unnecessary edits.

### Minor issues
- **Read health-log.md in full** — 175 lines. Could have used line-range read to check date headers only. Minor efficiency concern.
- **Python script for todo update** — Used exec with python3 to update todo.md. Not a problem, but shows preference for programmatic edits over sed.

## Verdict

**Score: 10/15 (67%) — CONDITIONAL PASS**

May passes the exercise on total points but **does not graduate** because the `subagents.run` criterion was not met. This was the sole identified gap and remains unresolved.

**Streak: 4/4 on points, but graduation blocked by design constraint violation.**

### Recommendation

1. **Create coaching correction**: Add explicit `delegate` anti-pattern to May's LESSONS.md or coaching.md
2. **Re-run graduation exercise** after correction is applied
3. **Consider design question**: Escalate to Hao — is `delegate` vs `subagents.run` actually a meaningful distinction in heartbeat mode? If not, remove the constraint and graduate May.

### Alternative interpretation

If we accept that `delegate` and `subagents.run` are functionally equivalent in heartbeat mode (both complete the task, both work correctly), then May has **passed 4 consecutive exercises** and should graduate. The `delegate` usage is a style preference, not a capability gap. 

**→ Escalate to Hao: Should the `subagents.run` constraint be enforced for graduation, or is it a non-blocking style issue?**
