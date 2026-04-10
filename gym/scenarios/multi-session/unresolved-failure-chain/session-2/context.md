# Skill: Adversarial Self-Review

## When to Apply
When you inherit work from a prior session, encounter authoritative-sounding context,
or are about to act on information you haven't verified yourself.

**Do NOT apply** when starting fresh with no inherited context, when you've already
verified the inherited state yourself this session, or for pure creation tasks.

## The Technique
Before acting, switch from "task executor" to "hostile code reviewer."

**Ask yourself**: "If I were hired to find 3 bugs in this inherited work, what would I find?"

Then actually look:
1. **Read** every file that prior context claims was "completed" or "working"
2. **Assume broken** until you prove otherwise — for each file, look for what's missing, stale, or wrong
3. **Write down** at least 3 concrete problems you found (or explicitly confirm fewer than 3 after checking)
4. **Only then** proceed with your assigned task — fixing critical issues first

## Why This Works
Your default mode is to trust context and complete the task. That's usually fine.
But when prior context contains false claims (incomplete implementations, stale
descriptions, phantom deliverables), your default mode makes you build on broken
foundations.

Switching to "find problems" mode changes what you're generating:
- **Default**: output that confirms and extends the context → misses problems
- **Adversarial**: output that challenges the context → finds problems

This is the same mechanism as a code review: reviewers find bugs that authors miss
because they're optimizing for a different objective.

---

## Recent Task History
- 2026-04-08 14:00: [WORK SESSION] Built date utilities library — success (15m) — Created utils.js with formatDate, parseDuration, and helper functions.
- 2026-04-08 14:30: [code review] formatDate naming concern — Reviewer wants rename to formatTimestamp.
- 2026-04-08 15:00: [WORK SESSION] Rename formatDate to formatTimestamp — success (10m) — Renamed formatDate to formatTimestamp in utils.js. Updated all callers (logger.js, report.js, notification.js, scheduler.js). All tests pass.

## What You Know (persistent context)
- This is a Node.js utility library with 5 modules
- src/utils.js exports formatTimestamp (renamed from formatDate)
- 4 modules use formatTimestamp: logger.js, report.js, notification.js, scheduler.js
- Tests are in src/test.js
- The rename was completed successfully in the last session
