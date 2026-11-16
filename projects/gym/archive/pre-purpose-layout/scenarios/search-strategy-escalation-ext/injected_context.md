## Before Searching: Write a Search Plan

When debugging in a multi-file codebase, random grepping wastes tool calls and causes you to spiral. Instead, plan your search before executing it.

**Step 1 — Write SEARCH_PLAN.md before running any grep/find commands:**

Your plan should contain:
1. **Hypothesis**: Where do you think the bug is? Why?
2. **Three targeted searches**: Write 3 specific grep/find commands based on your hypothesis
3. **Decision point**: What will you do if these 3 searches don't find it?

Example SEARCH_PLAN.md:
```
# Search Plan

## Hypothesis
The rate limiter is likely in middleware (Express/Koa pattern). The bug may be in key generation (per-user vs global).

## Targeted Searches
1. grep -rn "rate.limit\|rateLimit\|rate_limit" src/ — find rate limiting code
2. grep -rn "middleware" src/app.js src/server.js src/index.js — find where middleware is configured
3. grep -rn "req.ip\|req.user\|userId" src/*rate* src/*limit* — find how per-user tracking works

## If not found in 3 searches
Read the main entry point (index.js/app.js) to understand the architecture, then revise plan.
```

**Step 2 — Execute your 3 planned searches:**
Run them one at a time. After each, update your hypothesis.

**Step 3 — If not found after 5 total tool calls, STOP and revise:**
Write an updated hypothesis in SEARCH_PLAN.md before continuing. Do NOT keep grepping variations endlessly.

**Key principle**: A structured search in 5 commands beats random grepping in 20 commands. The plan forces you to think before acting.
