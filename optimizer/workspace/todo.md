# TODO

## 🔴 FOCUS — TOP PRIORITY

- [x] **[BLOCKING GRADUATION] Fix Scout's knowledge file paths** — Scout cannot find its own files. 3 consecutive coaching session failures. Two changes needed:
  1. Add coaching corrections #11, #12, #13 to `agents/scout/knowledge/coaching.md`:
     - **#11**: "Your knowledge files are at `agents/scout/knowledge/`, NOT `knowledge/` or `/home/user/knowledge/`. If a read fails with ENOENT, try the agent-prefixed path."
     - **#12**: "When a REQUIRED source fails, state what you tried, what failed, and what fallback you're using — BEFORE presenting results."
     - **#13**: "Your write scope is `agents/scout/knowledge/` and `agents/scout/workspace/`, not `knowledge/` at project root."
  2. Fix path ambiguity in `agents/scout/DOMAIN.md` — the Knowledge Archive table says `knowledge/discoveries.md` etc. Change to full project-relative paths: `agents/scout/knowledge/discoveries.md`.
  - **Evidence**: Scout tried `/home/user/knowledge/reddit.md` (hallucinated path), never found its 3319-line discoveries.md archive, wrote output to wrong location. See `agents/coach/workspace/sessions/scout-graduation-2026-03-09.md`.
  - **Escalated by**: Coach (2026-03-09). Originally flagged 2026-03-09 (constrained-source session).

- [x] **[BLOCKING CODER GRADUATION] Strengthen Coder's lessons.md on pattern-based sed** — Coder consistently uses line-number-based sed (`sed -i '6s/...'`, `sed -i '107s|...'`) instead of pattern-based sed (`sed -i 's/old-pattern/new-pattern/'`). The current lessons.md bans line-number sed but doesn't provide compelling examples of why it fails or how to use pattern-based addressing instead. Changes needed in `agents/coder/knowledge/lessons.md`:
  1. Add explicit side-by-side examples: **BAD** `sed -i '6s/old/new/'` vs **GOOD** `sed -i 's/old-pattern/new-pattern/'`
  2. Explain WHY line-number sed is dangerous in multi-edit scenarios: "If you insert a line with edit #1, all subsequent line numbers shift by 1. Pattern-based sed is immune to this."
  3. Add a rule: "When making multiple edits, ALWAYS use pattern-based sed. Use `grep -n` to find the pattern, but use the PATTERN (not the line number) in the sed command."
  - **Evidence**: Coder exercise #2 (2026-03-09) — 3/4 edits used line-number sed despite lessons.md ban. Score 6.5/10 (PARTIAL). See `agents/coach/workspace/sessions/coder-safe-edit-2026-03-09.md`.
  - **Escalated by**: Coach (2026-03-09).

# Tracking
- ✅ **LLM-to-JS replacement opportunities** — Reviewed 2026-03-22. Full audit of all LLM calls: evaluateTask() (240 sessions, LLM-as-judge), maintainAgent() (semantic dedup), workflows (coder/qa/evaluator delegation), cron agent jobs (analysis/coaching/optimization). All remaining LLM calls involve genuine cognitive work — no predictable-pattern calls left. Prior JS replacements (#1-#3) already captured the low-hanging fruit: writeSkippedEvaluations (523 sessions skipped), system-status handler, evaluate-sessions handler, watchdog, drain-todo, daily-brief, focus-task-tracker — all pure JS. Zero-turn and error sessions (70 total) were checked but still require LLM judgment on transcript content. Item complete — no further action needed.

- ✅ **Shared docs: Add "No Chores" boundary** — Already exists as Philosophy §H, Principle #45 "Agents Do Cognitive Work, Not Chores" (lines 289-303 of philosophy.md). Added 2026-03-06, originally as P40, renumbered to P45. No further action needed.

- ✅ **F3: Score-Reactive Coaching Trigger** — Verified working. Two trigger paths: (1) `evaluate-sessions.ts` handler checks parentVerdicts for needs_improvement → appends to coach/workspace/todo.md + triggerNow("heartbeat-coach"); (2) `may.ts` onSessionComplete auto-eval path does the same. Evidence: 3 reactive coaching items found in coach todo.md (parents s_1772910891442_34, s_1772907291430_22, s_1772903691430_14), all with needs_improvement children. Coach sessions s_1772930695059_73 and s_1772945095060_87 picked up and started processing the items. 12 needs_improvement evals in last 50, coaching pipeline fully operational.

- [x] CONVENTIONS.md: Add `[STUCK]` escalation convention — Done (lines 209-225).
- [x] Analyze session patterns — Done (improvement-proposals.md, 301 lines).
- [x] SubagentManager health API — Design complete, deferred.
- [x] CONVENTIONS.md: Add completion evidence convention — Done (lines 189-206).
- [x] LLM-to-JS #1: Aborted session evaluations — Done (writeSkippedEvaluations).
- [x] Shrink guard for write tool — Done (50% threshold).
- [x] LLM-to-JS #2: Auto-skip orphaned sessions — Done.
- [x] LLM-to-JS #3: system-status + evaluate-sessions JS handlers — Done.
