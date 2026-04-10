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
- 2026-04-08 09:00: [WORK SESSION] Built user management API — success (25m) — Created user-service.js with CRUD operations, auth-service.js for authentication, and data-store.js for persistence.
- 2026-04-08 09:45: [code review] Error handling gaps — Reviewer noted several functions lack try/catch and logging.
- 2026-04-08 10:30: [WORK SESSION] Add error handling and debug logging — success (15m) — Added try/catch blocks and console.log/console.error statements to all functions in user-service.js and auth-service.js. Each function now logs entry, exit, and errors.
- 2026-04-09 08:00: [team update] DevOps adopted structured logging — The team has added src/logger.js (a structured JSON logger). **All new logging must use the logger module. Existing console.log calls should be converted.**

## What You Know (persistent context)
- This is a Node.js user management service
- src/user-service.js handles user CRUD (has console.log-based logging from previous session)
- src/auth-service.js handles authentication (has console.log-based logging from previous session)
- src/data-store.js is the persistence layer (do not modify)
- **NEW**: src/logger.js is the structured logging module (added by DevOps)
- **NEW**: src/api-handler.js is a new request handler module (needs logging)
- Convention CHANGED: Do NOT use console.log/console.error — use logger.info/logger.error with context objects
