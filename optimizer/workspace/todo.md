# TODO

## 🔴 FOCUS — TOP PRIORITY

- [ ] **F3: Score-Reactive Coaching Trigger** — Verify that when evaluate-sessions finds needs_improvement, coach's todo.md gets a coaching item in the same cron cycle. Test by checking recent needs_improvement evals and whether coach was notified.
- [ ] **Shared docs: Add "No Chores" boundary** — Make explicit that agents do cognitive work, not infrastructure checks. Add to `agents/shared/philosophy.md` or new shared file.
- [ ] **LLM-to-JS replacement opportunities** — Ongoing. Review each optimizer run for predictable-pattern LLM calls that could be JS.

# Tracking

- [x] CONVENTIONS.md: Add `[STUCK]` escalation convention — Done (lines 209-225).
- [x] Analyze session patterns — Done (improvement-proposals.md, 301 lines).
- [x] SubagentManager health API — Design complete, deferred.
- [x] CONVENTIONS.md: Add completion evidence convention — Done (lines 189-206).
- [x] LLM-to-JS #1: Aborted session evaluations — Done (writeSkippedEvaluations).
- [x] Shrink guard for write tool — Done (50% threshold).
- [x] LLM-to-JS #2: Auto-skip orphaned sessions — Done.
- [x] LLM-to-JS #3: system-status + evaluate-sessions JS handlers — Done.
