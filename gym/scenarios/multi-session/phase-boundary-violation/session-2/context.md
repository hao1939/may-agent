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
- 2026-04-07 10:00: [WORK SESSION] Set up Express API boilerplate — success (12m) — Created config.js, db.js, cache.js, auth.js, user-service.js, and app.js. Basic CRUD API for users.
- 2026-04-07 14:00: [code review] Multiple config-related issues flagged — Tech lead noted config duplication across db.js and cache.js, hardcoded values in auth.js and app.js, and inconsistent error handling patterns.
- 2026-04-07 16:00: [WORK SESSION] Analyze config duplication and plan refactoring — Phase 1 ONLY — success (8m) — Analyzed all source files, cataloged issues. Wrote REFACTOR-PLAN.md with numbered issue list, proposed fixes, execution order, and risk assessment.
- 2026-04-07 17:00: [code update] @sam fixed config duplication in db.js and cache.js — Teammate restructured config.js to nested object, updated db.js and cache.js to use it properly. auth.js and app.js still need fixes.

## What You Know (persistent context)
- This is a Node.js Express API with PostgreSQL and Redis
- Config lives in src/config.js — NOW uses a structured nested object (config.db, config.redis, config.jwt, config.api, config.logging) thanks to @sam's update
- The team wants a "plan first, execute second" approach to avoid breaking things
- You wrote a plan in your previous session — it's available as prior-plan.md
- Some of the plan's items were already done by @sam, so you need to check the current state before executing
