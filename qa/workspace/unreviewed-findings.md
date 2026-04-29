# QA Heartbeat — Unreviewed Findings (2026-04-29)

## Context
Attempted repo-wide `git log` from `/app` failed because `/app` is not a git repo. The relevant git repo is `/app/agents`.

## Verification Performed
- `tsc --noEmit` run in `/app/agents`: PASS (no output, exit 0)
- `vitest --run` run in `/app/agents`: PASS (512 tests)

## Changes Spot-checked
- Read: `agents/shared/may-agent-docs/design/telegram-notifications.md` (lines 1–120)
  - This is a design doc describing context-enriched Telegram replies.
  - No code/runtime impact detected from the doc itself.

## Findings
### IMPORTANT — QA process/ergonomics
- Project root `/app` is not a git repo; git operations must be run in `/app/agents` (agent repo) or `/app/.state` (state repo). Consider documenting this in QA playbook/heartbeat guidance to avoid wasted cycles.

## Verdict
No blocking issues found in the codebase during this heartbeat; typecheck and full test suite passed.
