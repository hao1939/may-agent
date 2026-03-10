# TODO

## 🔴 FOCUS — TOP PRIORITY

- [ ] **[QA COACHING] Broaden write() avoidance in QA DOMAIN.md/LESSONS.md** — QA's anti-write() rules are truncation-conditional ("if read was truncated, don't use write"). But QA uses write() for surgical fixes even when the file was NOT truncated (2026-03-10 exercise: rewrote entire 197-line file to change one character). Broaden the rule: "For surgical fixes (1-3 lines), ALWAYS use sed via exec. Reserve write() for creating new files or complete rewrites where you are the original author." Files to update: `agents/qa/DOMAIN.md` (line 44 area) and `agents/qa/LESSONS.md`. **Evidence**: `agents/coach/workspace/sessions/qa-code-review-2026-03-10.md`. **Escalated by**: Coach (2026-03-10).

- [ ] **[MAY COACHING] Add `subagents.run` vs `delegate` clarification to May's LESSONS.md** — May consistently uses `delegate` (blocking) instead of `subagents.run` (async) when dispatching work in heartbeats. Her DOMAIN says "Dispatch work with `subagents.run(agent, task)` — returns immediately" but LESSONS.md doesn't reinforce this. Add to `agents/may/LESSONS.md`:
  - "Use `subagents.run(agent, task)` to dispatch work — it returns immediately and you can continue. `delegate` blocks your session until the sub-agent finishes. In heartbeats, always use `subagents.run`."
  - **Evidence**: May exercise #3 (2026-03-09) — used `delegate("scout", ...)` which blocked for 2m58s. DOMAIN explicitly says dispatch returns immediately. See `agents/coach/workspace/sessions/may-exercise-3-2026-03-09.md`.
  - **Escalated by**: Coach (2026-03-09).

## Completed

- [x] **[BLOCKING GRADUATION] Fix Scout's knowledge file paths** — Applied by May (2026-03-09). Coaching corrections #11-13 added to `agents/scout/knowledge/coaching.md`. DOMAIN.md paths fixed.

- [x] **[BLOCKING CODER GRADUATION] Strengthen Coder's lessons.md on pattern-based sed** — Applied by May (2026-03-23). Created `agents/coder/knowledge/lessons.md` with pattern-sed rules, side-by-side examples, multi-edit guidance.

- [x] **[BLOCKING BOB GRADUATION] Add adversity-handling lessons to Bob's coaching.md** — Applied by May (2026-03-09). Created `agents/bob/knowledge/coaching.md` with 3 corrections: file existence check, post-sed verification, diagnose before retry.

# Tracking
- ✅ **LLM-to-JS replacement opportunities** — Reviewed 2026-03-22. All remaining LLM calls involve genuine cognitive work. Item complete.
- ✅ **Shared docs: Add "No Chores" boundary** — Already exists as Philosophy §H, Principle #45.
- ✅ **F3: Score-Reactive Coaching Trigger** — Verified working.

- [x] CONVENTIONS.md: Add `[STUCK]` escalation convention — Done (lines 209-225).
- [x] Analyze session patterns — Done (improvement-proposals.md, 301 lines).
- [x] SubagentManager health API — Design complete, deferred.
- [x] CONVENTIONS.md: Add completion evidence convention — Done (lines 189-206).
- [x] LLM-to-JS #1: Aborted session evaluations — Done (writeSkippedEvaluations).
- [x] Shrink guard for write tool — Done (50% threshold).
- [x] LLM-to-JS #2: Auto-skip orphaned sessions — Done.
- [x] LLM-to-JS #3: system-status + evaluate-sessions JS handlers — Done.
