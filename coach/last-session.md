# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776434074191_370
- **Status:** done
- **When:** 2026-04-17T14:25:44.177Z
- **Duration:** 31m9s

## What Happened
Key finding: evidence-count-guard never actually fired in any ON-arm session (0/9). The `createCommitGuard` blocks finish(success) FIRST due to uncommitted changes, agent runs `git add`/`git commit` (non-write bash → counts as evidence-capable calls), postCount bumps, so by the second finish() attempt the evidence-count guard no longer triggers. The 70% ON vs 100% OFF result is NOT caused by the guard — it's noise/unrelated.

Let me write this up.
